// File: automated_email_followup.gs - Logic for sending follow-up emails.

/**
 * Processes leads from the 'Leads' sheet and sends follow-up emails.
 */
function followUpEmails() {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { // Try to acquire lock for 10 seconds
    try {
      logAction('FollowUpBatchStart', null, null, 'Follow-up email batch process started with lock.', 'INFO');
      let emailsSentThisExecution = 0;

      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
    if (!sheet) {
      logAction('FollowUpBatchError', null, null, `Sheet '${LEADS_SHEET_NAME}' not found.`, 'ERROR');
      console.error(`Sheet '${LEADS_SHEET_NAME}' not found.`);
      return;
    }

    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();
    const headers = allData[0];
    const leadDataRows = allData.slice(1);

    const colIdx = getColumnIndexMap(headers); // Assuming getColumnIndexMap is in Utilities.gs

    // Verify essential columns exist
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
      const actualSheetRow = i + 2; // +1 for header, +1 for 0-based to 1-based

      const email = currentRow[colIdx['Email']];
      const currentStatus = currentRow[colIdx['Status']];
      const lastContactDateStr = currentRow[colIdx['Last Contact']];
      const firstName = currentRow[colIdx['First Name']];
      const lastService = currentRow[colIdx['Last Service']];
      const leadId = currentRow[colIdx['Lead ID']];

      if (currentStatus === STATUS.SENT) {
        if (!lastContactDateStr) {
          logAction('FollowUpWarning', leadId, email, 'Missing Last Contact date. Skipping follow-up.', 'WARNING');
          console.warn(`Missing Last Contact date for Lead ID ${leadId || 'N/A'}, Email: ${email} at row ${actualSheetRow}.`);
          continue;
        }

        let lastContactDate;
        try {
          lastContactDate = new Date(lastContactDateStr);
          if (isNaN(lastContactDate.getTime())) { // Check if date is valid
            throw new Error("Invalid date value");
          }
        } catch (e) {
          logAction('FollowUpWarning', leadId, email, `Invalid Last Contact date format: '${lastContactDateStr}'. Error: ${e.message}`, 'WARNING');
          console.warn(`Invalid Last Contact date for Lead ID ${leadId || 'N/A'}, Email: ${email} at row ${actualSheetRow}: ${lastContactDateStr}`);
          continue;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date to the beginning of the day
        lastContactDate.setHours(0,0,0,0); // Normalize lastContactDate to the beginning of the day

        const diffTime = Math.abs(today.getTime() - lastContactDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 3) {
          // Check against daily quota if one were to be applied here, for now, no hard cap.
          // if (emailsSentThisExecution >= CONFIG.DAILY_EMAIL_QUOTA) {
          //   logAction('FollowUpQuotaReached', null, null, 'Follow-up quota reached for this execution.', 'INFO');
          //   break; 
          // }

          const aiContent = getAIEmailContent(firstName, lastService, getFollowUpEmailPrompt); // From automated_email_sender.gs (or Utilities if moved)
          if (!aiContent) {
            logAction('FollowUpAIError', leadId, email, 'Failed to generate AI content for follow-up email.', 'ERROR');
            console.error(`AI content generation failed for follow-up: Lead ID ${leadId}, Email: ${email}`);
            continue;
          }

          const subject = `Following up on your Free Audit for ${lastService}`;
          
          const formattedAIBody = formatPlainTextEmailBody(aiContent); // Use the new utility
          // Construct final body: Formatted AI Body + Blank Line + Footer
          // The AI was prompted to include the call to action for the audit itself.
          const finalFollowUpEmailBody = formattedAIBody + "\n\n" + CONFIG.EMAIL_FOOTER;

          if (sendEmail(email, subject, finalFollowUpEmailBody, leadId)) { // From automated_email_sender.gs (or Utilities if moved)
            sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.FOLLOW_UP_1);
            sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
            emailsSentThisExecution++;
            logAction('FollowUpEmailSent', leadId, email, `Follow-up email sent. Subject: ${subject}`, 'SUCCESS');

            if (emailsSentThisExecution > 0 && emailsSentThisExecution % CONFIG.EMAIL_BATCH_SIZE === 0) {
              SpreadsheetApp.flush();
              logAction('FollowUpBatchFlush', null, null, `Flushed spreadsheet changes after ${emailsSentThisExecution} follow-up emails.`, 'INFO');
            }
          } else {
            logAction('FollowUpSendFail', leadId, email, 'Failed to send follow-up email via sendEmail function.', 'WARNING');
          }
        }
      }
    }

    SpreadsheetApp.flush(); // Final flush
    logAction('FollowUpBatchEnd', null, null, `Follow-up email batch process finished. Emails sent in this run: ${emailsSentThisExecution}`, 'INFO');
    console.log(`Follow-up email batch finished. Total emails sent in this run: ${emailsSentThisExecution}`);

    } catch (e) { // This is the single, correct catch block for critical errors
      const errorMessage = `Error in followUpEmails: ${e.message} ${e.stack ? ' Stack: ' + e.stack : ''}`;
      logAction('FollowUpCriticalError', null, null, errorMessage, 'CRITICAL');
      console.error(errorMessage);
    } finally {
      lock.releaseLock();
      logAction('FollowUpLockReleased', null, null, 'Lock released for followUpEmails.', 'DEBUG');
    }
  } else {
    logAction('FollowUpLockError', null, null, 'Could not obtain lock for followUpEmails after 10 seconds. Batch run skipped.', 'ERROR');
    console.warn('Could not obtain lock for followUpEmails. Batch run skipped.');
  }
}

/**
 * Cleans up leads by marking old 'FOLLOW_UP_1' leads as 'ABANDONED'.
 */
function cleanupLeads() {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { // Try to acquire lock for 10 seconds
    try {
      logAction('CleanupLeadsStart', null, null, 'Cleanup leads process started with lock.', 'INFO');
      let leadsAbandonedThisRun = 0;
      let updatesSinceLastFlush = 0;

      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
    if (!sheet) {
      logAction('CleanupLeadsError', null, null, `Sheet '${LEADS_SHEET_NAME}' not found.`, 'ERROR');
      console.error(`Sheet '${LEADS_SHEET_NAME}' not found.`);
      return;
    }

    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();
    const headers = allData[0];
    const leadDataRows = allData.slice(1);

    const colIdx = getColumnIndexMap(headers); // From Utilities.gs

    // Verify essential columns exist
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