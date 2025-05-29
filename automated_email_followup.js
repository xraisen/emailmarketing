/**
 * @file automated_email_followup.js
 * @description Manages the sending of automated, generic follow-up emails to leads 
 * who haven't replied to the initial outreach after a defined period. Also includes
 * logic for cleaning up old leads by marking them as 'ABANDONED'.
 */

/**
 * Sends follow-up emails to leads who are in 'SENT' status and haven't been contacted recently (e.g., 3 days).
 * This function iterates through leads, checks their eligibility for a follow-up, generates AI content,
 * formats it, sends the email, and updates the lead's status and last contact date in the Google Sheet.
 * It uses a script lock to prevent concurrent executions and includes error handling and batch flushing.
 * 
 * Relies on global constants: `CONFIG` (for SPREADSHEET_ID, EMAIL_FOOTER, EMAIL_BATCH_SIZE), 
 * `STATUS` (for lead status values like SENT, FOLLOW_UP_1), `LEADS_SHEET_NAME`.
 * Relies on global functions: `logAction` (for logging), `getColumnIndexMap` (from Utilities.js),
 * `getAIEmailContent` (from automated_email_sender.js), `getFollowUpEmailPrompt` (from prompt.js),
 * `formatPlainTextEmailBody` (from Utilities.js), `sendEmail` (from automated_email_sender.js).
 * 
 * @return {void} This function does not return a value but performs actions like sending emails and updating sheets.
 */
function followUpEmails() {
  // Attempt to acquire a script lock to prevent simultaneous executions. Timeout after 10 seconds.
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { 
    try {
      logAction('FollowUpBatchStart', null, null, 'Follow-up email batch process started with lock.', 'INFO');
      let emailsSentThisExecution = 0;

      // Open the Google Spreadsheet and specific sheet for leads.
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
    if (!sheet) {
      // Log error and exit if the sheet is not found.
      logAction('FollowUpBatchError', null, null, `Sheet '${LEADS_SHEET_NAME}' not found.`, 'ERROR');
      console.error(`Sheet '${LEADS_SHEET_NAME}' not found.`);
      return;
    }

    // Get all data from the sheet.
    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();
    const headers = allData[0]; // First row is headers.
    const leadDataRows = allData.slice(1); // Remaining rows are lead data.

    // Create a map of column names to their indices for easy data access.
    const colIdx = getColumnIndexMap(headers); 

    // Define and verify that all required columns are present in the sheet.
    const requiredColumns = ['Email', 'Status', 'Last Contact', 'First Name', 'Last Service', 'Lead ID'];
    for (const colName of requiredColumns) {
      if (colIdx[colName] === undefined) {
        logAction('FollowUpBatchError', null, null, `Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`, 'ERROR');
        console.error(`Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`);
        return;
      }
    }

    for (let i = 0; i < leadDataRows.length; i++) {
      const currentRow = leadDataRows[i];
      const actualSheetRow = i + 2; // +1 for header row, +1 for 0-based index to 1-based row number.

      // Extract lead data using column indices.
      const email = currentRow[colIdx['Email']];
      const currentStatus = currentRow[colIdx['Status']];
      const lastContactDateStr = currentRow[colIdx['Last Contact']];
      const firstName = currentRow[colIdx['First Name']];
      const lastService = currentRow[colIdx['Last Service']];
      const leadId = currentRow[colIdx['Lead ID']];

      // Criteria for sending a follow-up: Lead status must be 'SENT'.
      if (currentStatus === STATUS.SENT) {
        // Validate 'Last Contact' date.
        if (!lastContactDateStr) {
          logAction('FollowUpWarning', leadId, email, 'Missing Last Contact date. Skipping follow-up.', 'WARNING');
          console.warn(`Missing Last Contact date for Lead ID ${leadId || 'N/A'}, Email: ${email} at row ${actualSheetRow}.`);
          continue; // Skip to next lead if date is missing.
        }

        let lastContactDate;
        try {
          lastContactDate = new Date(lastContactDateStr);
          if (isNaN(lastContactDate.getTime())) { // Check if the parsed date is valid.
            throw new Error("Invalid date value from sheet: " + lastContactDateStr);
          }
        } catch (e) {
          logAction('FollowUpWarning', leadId, email, `Invalid Last Contact date format: '${lastContactDateStr}'. Error: ${e.message}`, 'WARNING');
          console.warn(`Invalid Last Contact date for Lead ID ${leadId || 'N/A'}, Email: ${email} at row ${actualSheetRow}: ${lastContactDateStr}`);
          continue; // Skip to next lead if date is invalid.
        }
        
        // Calculate the difference in days between today and the last contact date.
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date to the beginning of the day for accurate day difference.
        lastContactDate.setHours(0,0,0,0); // Normalize lastContactDate as well.

        const diffTime = Math.abs(today.getTime() - lastContactDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Convert time difference to days.

        // Send follow-up if it has been 3 or more days since the last contact.
        // TODO: Consider making '3' (days for follow-up) a CONFIG property.
        if (diffDays >= 3) {
          // Optional: Implement a daily quota for follow-up emails if needed.
          // if (emailsSentThisExecution >= CONFIG.DAILY_FOLLOW_UP_QUOTA) { // Assuming a new CONFIG property
          //   logAction('FollowUpQuotaReached', null, null, 'Follow-up quota reached for this execution.', 'INFO');
          //   break; 
          // }

          // Generate AI content for the follow-up email.
          // Note: `getAIEmailContent` now takes (promptText) directly. The prompt function `getFollowUpEmailPrompt` prepares this text.
          const followUpPromptText = getFollowUpEmailPrompt(firstName, lastService);
          const aiContent = getAIEmailContent(followUpPromptText); 
          
          if (!aiContent) {
            logAction('FollowUpAIError', leadId, email, 'Failed to generate AI content for follow-up email.', 'ERROR');
            console.error(`AI content generation failed for follow-up: Lead ID ${leadId}, Email: ${email}`);
            continue; // Skip to next lead if AI content generation fails.
          }

          const subject = `Following up on your Free Audit for ${lastService}`;
          
          // Format the AI-generated body and append the standard email footer.
          const formattedAIBody = formatPlainTextEmailBody(aiContent); 
          const finalFollowUpEmailBody = formattedAIBody + "\n\n" + CONFIG.EMAIL_FOOTER;

          // Attempt to send the email.
          if (sendEmail(email, subject, finalFollowUpEmailBody, leadId)) {
            // If email sent successfully, update the lead's status and last contact date.
            sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.FOLLOW_UP_1);
            sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
            emailsSentThisExecution++;
            logAction('FollowUpEmailSent', leadId, email, `Follow-up email sent. Subject: ${subject}`, 'SUCCESS');

            // Flush spreadsheet changes in batches to avoid exceeding execution time limits.
            if (emailsSentThisExecution > 0 && emailsSentThisExecution % CONFIG.EMAIL_BATCH_SIZE === 0) {
              SpreadsheetApp.flush();
              logAction('FollowUpBatchFlush', null, null, `Flushed spreadsheet changes after ${emailsSentThisExecution} follow-up emails.`, 'INFO');
            }
          } else {
            // Log if sending the email failed.
            logAction('FollowUpSendFail', leadId, email, 'Failed to send follow-up email via sendEmail function.', 'WARNING');
          }
        }
      }
    }

    SpreadsheetApp.flush(); // Ensure all pending changes are saved.
    logAction('FollowUpBatchEnd', null, null, `Follow-up email batch process finished. Emails sent in this run: ${emailsSentThisExecution}`, 'INFO');
    console.log(`Follow-up email batch finished. Total emails sent in this run: ${emailsSentThisExecution}`);

    } catch (e) { // Catch any critical errors during the process.
      const errorMessage = `Error in followUpEmails: ${e.message} ${e.stack ? ' Stack: ' + e.stack : ''}`;
      logAction('FollowUpCriticalError', null, null, errorMessage, 'CRITICAL');
      console.error(errorMessage);
    } finally {
      lock.releaseLock(); // Always release the lock.
      logAction('FollowUpLockReleased', null, null, 'Lock released for followUpEmails.', 'DEBUG');
    }
  } else {
    // Log if the script lock could not be obtained.
    logAction('FollowUpLockError', null, null, 'Could not obtain lock for followUpEmails after 10 seconds. Batch run skipped.', 'ERROR');
    console.warn('Could not obtain lock for followUpEmails. Batch run skipped.');
  }
}

/**
 * Iterates through leads in 'FOLLOW_UP_1' status and marks them as 'ABANDONED' 
 * if their 'Last Contact' date is older than a specified period (e.g., 4 days).
 * This function helps in managing the lead lifecycle by identifying leads that are no longer responsive.
 * It uses a script lock for safe concurrent execution and performs batch updates to the sheet.
 * 
 * Relies on global constants: `CONFIG` (for SPREADSHEET_ID, EMAIL_BATCH_SIZE), 
 * `STATUS` (for lead status values like FOLLOW_UP_1, ABANDONED), `LEADS_SHEET_NAME`.
 * Relies on global functions: `logAction` (for logging), `getColumnIndexMap` (from Utilities.js).
 * 
 * @return {void} This function does not return a value but updates lead statuses in the Google Sheet.
 */
function cleanupLeads() {
  // Attempt to acquire a script lock.
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { 
    try {
      logAction('CleanupLeadsStart', null, null, 'Cleanup leads process started with lock.', 'INFO');
      let leadsAbandonedThisRun = 0;
      let updatesSinceLastFlush = 0;

      // Access the Google Spreadsheet and the "Leads" sheet.
      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
    if (!sheet) {
      // Log error and exit if the sheet is not found.
      logAction('CleanupLeadsError', null, null, `Sheet '${LEADS_SHEET_NAME}' not found.`, 'ERROR');
      console.error(`Sheet '${LEADS_SHEET_NAME}' not found.`);
      return;
    }

    // Retrieve all data from the sheet.
    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();
    const headers = allData[0];
    const leadDataRows = allData.slice(1);

    // Get column indices.
    const colIdx = getColumnIndexMap(headers); 

    // Verify essential columns for cleanup are present.
    const requiredColumns = ['Status', 'Last Contact', 'Lead ID', 'Email'];
    for (const colName of requiredColumns) {
      if (colIdx[colName] === undefined) {
        logAction('CleanupLeadsError', null, null, `Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`, 'ERROR');
        console.error(`Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`);
        return;
      }
    }

    for (let i = 0; i < leadDataRows.length; i++) {
      const currentRow = leadDataRows[i];
      const actualSheetRow = i + 2; // +1 for header, +1 for 0-based to 1-based

      const currentStatus = currentRow[colIdx['Status']];
      const leadId = currentRow[colIdx['Lead ID']];
      const email = currentRow[colIdx['Email']];

      if (currentStatus === STATUS.FOLLOW_UP_1) {
        const lastContactDateStr = currentRow[colIdx['Last Contact']];

        if (!lastContactDateStr) {
          logAction('CleanupLeadsWarning', leadId, email, 'Missing Last Contact date for FOLLOW_UP_1 lead. Skipping.', 'WARNING');
          console.warn(`Missing Last Contact date for FOLLOW_UP_1 lead ID ${leadId || 'N/A'}, Email: ${email} at row ${actualSheetRow}.`);
          continue;
        }

        let lastContactDate;
        try {
          lastContactDate = new Date(lastContactDateStr);
          if (isNaN(lastContactDate.getTime())) { // Check if date is valid
            throw new Error("Invalid date value");
          }
        } catch (e) {
          logAction('CleanupLeadsWarning', leadId, email, `Invalid Last Contact date format for FOLLOW_UP_1 lead: '${lastContactDateStr}'. Error: ${e.message}`, 'WARNING');
          console.warn(`Invalid Last Contact date for FOLLOW_UP_1 lead ID ${leadId || 'N/A'}, Email: ${email} at row ${actualSheetRow}: ${lastContactDateStr}`);
          continue;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date to the beginning of the day
        lastContactDate.setHours(0,0,0,0); // Normalize lastContactDate to the beginning of the day

        const diffTime = Math.abs(today.getTime() - lastContactDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 4) {
          sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.ABANDONED);
          sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
          leadsAbandonedThisRun++;
          updatesSinceLastFlush++;
          logAction('CleanupLeadAbandoned', leadId, email, 'Lead status changed to ABANDONED.', 'SUCCESS');

          if (updatesSinceLastFlush >= CONFIG.EMAIL_BATCH_SIZE) {
            SpreadsheetApp.flush();
            logAction('CleanupLeadsFlush', null, null, `Flushed spreadsheet changes during cleanup after ${updatesSinceLastFlush} updates.`, 'INFO');
            updatesSinceLastFlush = 0;
          }
        }
      }
    }

    if (updatesSinceLastFlush > 0) { // Check if there are any pending changes before final flush
        SpreadsheetApp.flush(); // Final flush
    }
    logAction('CleanupLeadsEnd', null, null, `Cleanup leads process finished. Leads marked abandoned: ${leadsAbandonedThisRun}`, 'INFO');
    console.log(`Cleanup leads process finished. Total leads marked abandoned in this run: ${leadsAbandonedThisRun}`);

    } catch (e) { // This is the single, correct catch block for critical errors
      const errorMessage = `Error in cleanupLeads: ${e.message} ${e.stack ? ' Stack: ' + e.stack : ''}`;
      logAction('CleanupLeadsCriticalError', null, null, errorMessage, 'CRITICAL');
      console.error(errorMessage);
    } finally {
      lock.releaseLock();
      logAction('CleanupLeadsLockReleased', null, null, 'Lock released for cleanupLeads.', 'DEBUG');
    }
  } else {
    logAction('CleanupLeadsLockError', null, null, 'Could not obtain lock for cleanupLeads after 10 seconds. Cleanup run skipped.', 'ERROR');
    console.warn('Could not obtain lock for cleanupLeads. Cleanup run skipped.');
  }
}