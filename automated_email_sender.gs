// File: automated_email_sender.gs - Main logic for email sending and reply processing.

/**
 * Generates email content using the Gemini API.
 *
 * @param {string} firstName The first name of the lead.
 * @param {string} lastService The last service provided to the lead.
 * @param {function} promptFunction A function that accepts firstName and lastService 
 *                                  and returns a formatted prompt string.
 * @return {string|null} The AI-generated email content, or null if an error occurred.
 */
function getAIEmailContent(firstName, lastService, promptFunction) {
  const promptText = promptFunction(firstName, lastService);
  const apiKey = CONFIG.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: promptText
      }]
    }]
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Important for handling API errors gracefully
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const jsonResponse = JSON.parse(responseBody);
      // Check for presence of candidates and nested properties before accessing
      if (jsonResponse &&
          jsonResponse.candidates &&
          jsonResponse.candidates.length > 0 &&
          jsonResponse.candidates[0].content &&
          jsonResponse.candidates[0].content.parts &&
          jsonResponse.candidates[0].content.parts.length > 0 &&
          jsonResponse.candidates[0].content.parts[0].text) {
        
        const aiText = jsonResponse.candidates[0].content.parts[0].text;
        logAction('GetAIEmailContent', null, null, 'Successfully retrieved AI content.', 'SUCCESS');
        return aiText;
      } else {
        // Log detailed error if the expected structure is not found
        const detail = `Gemini API response missing expected content structure. Response: ${responseBody.substring(0, 500)}`; // Log first 500 chars
        logAction('GetAIEmailContent', null, null, detail, 'ERROR');
        console.error(detail);
        return null;
      }
    } else {
      // Handle non-200 responses
      const errorDetails = `Gemini API Error: HTTP ${responseCode}. Response: ${responseBody.substring(0,500)}`;
      logAction('GetAIEmailContent', null, null, errorDetails, 'ERROR');
      console.error(errorDetails);
      return null;
    }
  } catch (e) {
    // Handle UrlFetchApp errors (network, etc.)
    const errorMessage = `Error calling Gemini API: ${e.message} ${e.stack}`;
    logAction('GetAIEmailContent', null, null, errorMessage, 'ERROR');
    console.error(errorMessage);
    return null;
  }
}

/**
 * Sends an email using GmailApp and logs the outcome.
 * Includes a delay to respect rate limits.
 *
 * @param {string} to The recipient's email address.
 * @param {string} subject The subject of the email.
 * @param {string} body The content of the email.
 * @param {string} leadId The ID of the lead this email is for (for logging).
 * @return {boolean} True if the email was sent successfully, false otherwise.
 */
function sendEmail(to, subject, body, leadId) {
  try {
    GmailApp.sendEmail(to, subject, body);
    Utilities.sleep(2500); // Wait 2.5 seconds to respect rate limits

    logAction('SendEmailSuccess', leadId, to, 'Subject: ' + subject, 'SUCCESS');
    console.log(`Email sent successfully to: ${to}, Subject: ${subject}`);
    return true;
  } catch (error) {
    const errorMessage = `Error sending email: ${error.message}`;
    logAction('SendEmailError', leadId, to, errorMessage, 'ERROR');
    console.error(`Failed to send email to ${to}. Error: ${errorMessage}`);
    return false;
  }
}

/**
 * Creates a map of column names to their 0-based indices from a header row.
 * @param {string[]} headerRowArray An array of strings representing the header row.
 * @return {Object} An object where keys are column names and values are their indices.
 */
function getColumnIndexMap(headerRowArray) {
  const map = {};
  headerRowArray.forEach((columnName, index) => {
    map[columnName] = index;
  });
/**
 * Processes a batch of leads from the 'Leads' sheet, sending initial emails.
 * Respects daily quotas and batch sizes defined in CONFIG.
 */
function dailyEmailBatch() {
  logAction('DailyBatchStart', null, null, 'Daily email batch process started.', 'INFO');
  let emailsSentThisExecution = 0;

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
    if (!sheet) {
      logAction('DailyBatchError', null, null, `Sheet '${LEADS_SHEET_NAME}' not found.`, 'ERROR');
      console.error(`Sheet '${LEADS_SHEET_NAME}' not found.`);
      return;
    }

    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();
    const headers = allData[0];
    const leadDataRows = allData.slice(1);

    const colIdx = getColumnIndexMap(headers);

    // Verify essential columns exist
    const requiredColumns = ['First Name', 'Email', 'Last Service', 'Status', 'Lead ID', 'Last Contact'];
    for (const colName of requiredColumns) {
      if (colIdx[colName] === undefined) {
        logAction('DailyBatchError', null, null, `Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`, 'ERROR');
        console.error(`Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`);
        return;
      }
    }

    for (let i = 0; i < leadDataRows.length; i++) {
      const currentRow = leadDataRows[i];
      const actualSheetRow = i + 2; // +1 for header, +1 for 0-based to 1-based

      const firstName = currentRow[colIdx['First Name']];
      const email = currentRow[colIdx['Email']];
      const lastService = currentRow[colIdx['Last Service']];
      let currentStatus = currentRow[colIdx['Status']];
      let leadIdValue = currentRow[colIdx['Lead ID']];

      if (currentStatus === STATUS.PENDING) {
        if (emailsSentThisExecution < CONFIG.DAILY_EMAIL_QUOTA) {
          if (!isValidEmail(email)) {
            sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.INVALID_EMAIL);
            logAction('DailyBatchInvalidEmail', leadIdValue, email, 'Invalid email format.', 'ERROR');
            console.warn(`Invalid email for Lead ID ${leadIdValue || 'N/A'} at row ${actualSheetRow}: ${email}`);
            continue;
          }

          if (!leadIdValue) {
            leadIdValue = generateUUID();
            sheet.getRange(actualSheetRow, colIdx['Lead ID'] + 1).setValue(leadIdValue);
            logAction('DailyBatchLeadIDGenerated', leadIdValue, email, 'Generated new Lead ID.', 'INFO');
          }

          const aiContent = getAIEmailContent(firstName, lastService, getInitialEmailPrompt);
          if (!aiContent) {
            logAction('DailyBatchAIError', leadIdValue, email, 'Failed to generate AI content for initial email.', 'ERROR');
            console.error(`AI content generation failed for Lead ID ${leadIdValue}, email: ${email}`);
            continue; 
          }

          const subject = `Free Audit for ${lastService}`; // Simple subject line

          if (sendEmail(email, subject, aiContent, leadIdValue)) {
            sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.SENT);
            sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
            emailsSentThisExecution++;
            logAction('DailyBatchEmailSent', leadIdValue, email, `Initial email sent. Subject: ${subject}`, 'SUCCESS');
          } else {
            // sendEmail logs its own errors, but we can log a specific batch context if needed
            logAction('DailyBatchSendFail', leadIdValue, email, 'Failed to send initial email via sendEmail function.', 'WARNING');
          }

          if (emailsSentThisExecution % CONFIG.EMAIL_BATCH_SIZE === 0) {
            SpreadsheetApp.flush(); // Persist changes in batches
            logAction('DailyBatchFlush', null, null, `Flushed spreadsheet changes after ${emailsSentThisExecution} emails.`, 'INFO');
          }

        } else {
          logAction('DailyBatchQuotaReached', null, null, `Daily email quota reached for this execution: ${emailsSentThisExecution}. Stopping batch.`, 'INFO');
          console.log(`Daily email quota (${CONFIG.DAILY_EMAIL_QUOTA}) reached.`);
          break; 
        }
      }
    }

    SpreadsheetApp.flush(); // Final flush to save any remaining changes
    logAction('DailyBatchEnd', null, null, `Daily email batch process finished. Emails sent in this run: ${emailsSentThisExecution}`, 'INFO');
    console.log(`Daily email batch finished. Total emails sent in this run: ${emailsSentThisExecution}`);

  } catch (e) {
    const errorMessage = `Error in dailyEmailBatch: ${e.message} ${e.stack}`;
    logAction('DailyBatchCriticalError', null, null, errorMessage, 'CRITICAL');
    console.error(errorMessage);
  }
}
