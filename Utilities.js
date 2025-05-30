/**
 * @file Utilities.js
 * @description Provides utility functions for various tasks such as data retrieval 
 * from sheets, string manipulation, text formatting, and interaction history 
 * generation for the AI Sales Assistant project.
 */

// Check if a global logAction exists and is the more complex one (e.g., logging to a sheet)
// For simplicity in this subtask, we'll define it scoped to this file if not globally available,
// or assume the global one will be used if present.
if (typeof logAction === 'undefined') {
  /**
   * Logs an action to the Apps Script Logger or Console.
   * This is a fallback version for Utilities.js if the main spreadsheet-logging logAction isn't available.
   * @param {string} action The action performed.
   * @param {string|null} leadId The ID of the lead.
   * @param {string|null} email The email address.
   * @param {string} details A description of the action.
   * @param {string} status The status of the action (e.g., 'SUCCESS', 'ERROR', 'INFO').
   */
  function logAction(action, leadId, email, details, status) {
    const logEntry = `[${new Date().toISOString()}] ${status} - Action: ${action}, LeadID: ${leadId || 'N/A'}, Email: ${email || 'N/A'}, Details: ${details}`;
    // Prefer Logger if available (standard Apps Script service)
    if (typeof Logger !== 'undefined') {
      Logger.log(logEntry);
    } else {
      // Fallback to console for other environments or if Logger is somehow unavailable
      console.log(logEntry);
    }
  }
  // console.log("Utilities.js: Defined local fallback logAction."); // Optional: for debugging which logAction is used
} // else {
  // console.log("Utilities.js: Global logAction found. Will use it."); // Optional: for debugging
// }

/**
 * Finds and retrieves specific data for a lead from a given sheet.
 * Searches by Lead ID first, then by email if Lead ID doesn't match or isn't provided.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The Google Sheet object to search within.
 * @param {string|null} leadId The Lead ID to search for. Can be null if searching by email only.
 * @param {string|null} email The email address to search for. Can be null if searching by leadId only.
 * @return {{firstName: string, status: string}|null} An object containing the lead's first name and status, 
 *                                                  or null if the lead is not found or if required columns are missing.
 *                                                  Defaults firstName to "Prospect" and status to "Unknown" if cells are empty.
 * @example
 * const leadsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads");
 * const leadInfo = findLeadData(leadsSheet, "LID123", "test@example.com");
 * if (leadInfo) {
 *   Logger.log(leadInfo.firstName + " has status " + leadInfo.status);
 * }
 */
function findLeadData(sheet, leadId, email) {
  try {
    // Validate sheet object
    if (!sheet || typeof sheet.getDataRange !== 'function') {
      logAction('FindLeadDataError', leadId, email, 'Invalid or null sheet object provided to findLeadData.', 'ERROR');
      return null;
    }

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      logAction('FindLeadDataWarning', leadId, email, 'Sheet is empty, no headers or data found.', 'WARNING');
      return null; // No data to process
    }
    const headers = data[0];

    // Get column indices based on header names for robustness
    const leadIdCol = headers.indexOf("Lead ID");
    const emailCol = headers.indexOf("Email");
    const firstNameCol = headers.indexOf("First Name");
    const statusCol = headers.indexOf("Status");

    // Check if essential columns are present
    if (leadIdCol === -1 || emailCol === -1 || firstNameCol === -1 || statusCol === -1) {
      const errorMessage = 'One or more required columns (Lead ID, Email, First Name, Status) not found in sheet headers: ' + headers.join(', ');
      logAction('FindLeadDataError', leadId, email, errorMessage, 'ERROR');
      return null;
    }

    // Iterate through rows (skipping header row) to find the lead
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowLeadId = row[leadIdCol];
      const rowEmail = row[emailCol];

      // Normalize email for case-insensitive comparison
      const emailToCompare = email ? String(email).toLowerCase() : null;
      const rowEmailToCompare = rowEmail ? String(rowEmail).toLowerCase() : null;

      // Match if Lead ID is provided and matches, OR if email is provided and matches
      if ((leadId && rowLeadId === leadId) || (emailToCompare && rowEmailToCompare === emailToCompare)) {
        return {
          firstName: row[firstNameCol] || "Prospect", // Default if first name is empty
          status: row[statusCol] || "Unknown"        // Default if status is empty
        };
      }
    }
  } catch (e) {
    // Log any unexpected errors during execution
    const exceptionMessage = `Exception in findLeadData: ${e.message} ${e.stack ? 'Stack: ' + e.stack : ''}`;
    logAction('FindLeadDataError', leadId, email, exceptionMessage, 'ERROR');
    return null;
  }
  logAction('FindLeadDataInfo', leadId, email, 'Lead not found in sheet.', 'INFO');
  return null; // Lead not found
}

/**
 * Retrieves and summarizes the interaction history of a lead.
 * This includes the lead's current status, recent logs from the "Logs" sheet,
 * and snippets from the last 1-2 emails in their Gmail thread.
 * Assumes global CONFIG, LEADS_SHEET_NAME, LOGS_SHEET_NAME, and a logAction function are available.
 * @param {string} leadId The Lead ID of the prospect.
 * @param {string} email The email address of the prospect. Used for Gmail search.
 * @return {string} A multi-line string summarizing the interaction history. 
 *                  Returns a "No significant prior interaction found" message if minimal data exists,
 *                  or an error message if critical data retrieval fails.
 */
function getLeadInteractionHistory(leadId, email) {
  let historySummary = "";
  let leadFirstName = "Prospect"; // Default name
  let leadStatus = "Unknown";   // Default status
  let initialHistoryGenerated = false; // Flag to track if basic lead info section was added

  try {
    // Attempt to open the main spreadsheet. This is a critical step.
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); 

    // Section 1: Get Lead's First Name and Status from Leads Sheet
    try {
      const leadsSheet = ss.getSheetByName(LEADS_SHEET_NAME);
      if (leadsSheet) {
        const leadData = findLeadData(leadsSheet, leadId, email); // Use the findLeadData utility
        if (leadData) {
          leadFirstName = leadData.firstName || leadFirstName; // Use default if sheet data is empty
          leadStatus = leadData.status || leadStatus;     // Use default if sheet data is empty
        } else {
          logAction('GetLeadHistory_LeadNotFound', leadId, email, `Lead not found in '${LEADS_SHEET_NAME}' sheet. Using defaults.`, 'WARNING');
        }
      } else {
         logAction('GetLeadHistory_LeadsSheetError', leadId, email, `Leads sheet '${LEADS_SHEET_NAME}' not found.`, 'WARNING');
         historySummary += `(Warning: Leads sheet '${LEADS_SHEET_NAME}' not found. Cannot retrieve name/status.)\n`;
      }
      // Construct initial part of the summary
      historySummary += `Interaction History with ${leadFirstName} (${email || leadId}):\n`; 
      historySummary += `- Current Lead Status: ${leadStatus}.\n`;
      initialHistoryGenerated = true;
    } catch (e) {
      logAction('GetLeadHistory_LeadsSheetError', leadId, email, `Error accessing Leads sheet: ${e.message}`, 'WARNING');
      historySummary += "(Warning: Could not retrieve latest lead status/name details due to error.)\n";
    }

    // Section 2: Get Logs from Logs Sheet
    try {
      const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
      if (logsSheet) {
        const logValues = logsSheet.getDataRange().getValues();
        if (logValues.length > 1) { // Check if there's more than just headers
          const logHeaders = logValues[0];
          const logLeadIdCol = logHeaders.indexOf("Lead ID");
          const logActionCol = logHeaders.indexOf("Action");
          const logDetailsCol = logHeaders.indexOf("Details");
          const logTimestampCol = logHeaders.indexOf("Timestamp");

          if (logLeadIdCol === -1 || logActionCol === -1 || logDetailsCol === -1 || logTimestampCol === -1) {
            historySummary += "Recent Logs: (Error: Log sheet columns missing)\n";
            logAction('GetLeadHistory_LogsSheetError', leadId, email, 'Required column missing in Logs sheet. Headers: ' + logHeaders.join(', '), 'WARNING');
          } else {
            let relevantLogs = [];
            // Iterate from the end of the logs for most recent entries
            for (let i = logValues.length - 1; i >= 1; i--) { 
              if (logValues[i][logLeadIdCol] === leadId) {
                relevantLogs.push({
                  action: logValues[i][logActionCol],
                  details: logValues[i][logDetailsCol] ? String(logValues[i][logDetailsCol]).substring(0, 70) : '', // Truncate details
                  timestamp: new Date(logValues[i][logTimestampCol]).toLocaleDateString() // Format timestamp
                });
                if (relevantLogs.length >= 3) break; // Limit to last 3 relevant logs
              }
            }
            if (relevantLogs.length > 0) {
              historySummary += "Recent Logs:\n";
              relevantLogs.reverse().forEach(log => { // Reverse to show oldest first in this selection
                historySummary += `  - ${log.timestamp}: ${log.action} - ${log.details}...\n`;
              });
            } 
            // If relevantLogs.length is 0, no "Recent Logs" header or "no logs" message is added.
          }
        } else {
           // Log sheet is empty or only headers, do not add "Recent Logs" section or related messages.
           logAction('GetLeadHistory_LogsSheetInfo', leadId, email, 'Log sheet is empty or contains only headers. No logs to add to history.', 'INFO');
        }
      } else {
        // Logs sheet not found, do not add "Recent Logs" section.
        logAction('GetLeadHistory_LogsSheetError', leadId, email, `Logs sheet '${LOGS_SHEET_NAME}' not found.`, 'WARNING');
        // Optionally, add a warning to the summary if this is considered critical for AI context,
        // but per requirements, we are keeping sections clean if empty.
        // historySummary += "(Warning: Logs sheet not found, log history may be incomplete.)\n"; 
      }
    } catch (e) {
      logAction('GetLeadHistory_LogsSheetError', leadId, email, `Error accessing Logs sheet: ${e.message}`, 'WARNING');
      // historySummary += "(Warning: Could not retrieve some log history due to error.)\n"; // Optional warning
    }

    // Section 3: Get from Gmail Thread
    try {
      if (email) { // Only attempt Gmail search if email is provided
        if (typeof GmailApp !== 'undefined' && GmailApp && typeof GmailApp.search === 'function') { 
            const threads = GmailApp.search(`(to:${email} OR from:${email}) in:inbox`, 0, 1); 
            if (threads.length > 0) {
              const messages = threads[0].getMessages();
              if (messages.length > 0) {
                historySummary += `Last Email in Thread (up to 2 most recent):\n`; // Header added only if messages exist
                
                // Get the very last message
                const lastMessage = messages[messages.length - 1];
                const snippet = lastMessage.getPlainBody().substring(0, 100); 
                const messageDate = new Date(lastMessage.getDate()).toLocaleDateString();
                const from = lastMessage.getFrom();
                historySummary += `  - Date: ${messageDate}, From: ${from}\n`;
                historySummary += `    Snippet: "${snippet}..."\n`;

                // Get the second to last message if it exists
                if (messages.length > 1) {
                  const secondLastMessage = messages[messages.length - 2];
                  const snippet2 = secondLastMessage.getPlainBody().substring(0, 100); 
                  const messageDate2 = new Date(secondLastMessage.getDate()).toLocaleDateString();
                  const from2 = secondLastMessage.getFrom();
                  historySummary += `  - Date: ${messageDate2}, From: ${from2}\n`;
                  historySummary += `    Snippet: "${snippet2}..."\n`;
                }
              } 
              // If messages.length is 0, no "Gmail Thread" header or "no messages" message is added.
            } 
            // If threads.length is 0, no "Gmail Thread" header or "no threads" message is added.
        } else {
            logAction('GetLeadHistory_GmailError', leadId, email, 'GmailApp service not available or search function missing.', 'WARNING');
            // historySummary += "(Warning: Could not retrieve Gmail history - GmailApp service unavailable.)\n"; // Optional
        }
      } 
      // If email is not provided, no Gmail search is attempted, and no section is added.
    } catch (e) {
      logAction('GetLeadHistory_GmailError', leadId, email, `Error accessing Gmail: ${e.message}`, 'WARNING');
      historySummary += `(Warning: Could not retrieve Gmail history due to error: ${e.message})\n`;
    }

  } catch (e) { // Main catch for catastrophic errors (e.g. SPREADSHEET_ID wrong, Spreadsheet service completely down)
    logAction('GetLeadHistoryError', leadId, email, `Critical Error during history retrieval: ${e.message} ${e.stack ? 'Stack: ' + e.stack : ''}`, 'ERROR');
    // If the basic history wasn't even generated, return a more direct error. Otherwise, append to what was gathered.
    if (!initialHistoryGenerated) {
      return `(Critical Error: Could not retrieve interaction history for ${email || leadId} - ${e.message})\n`;
    }
    historySummary += `(Critical Error impacting history retrieval: ${e.message})\n`;
  }

  // Check if only the initial lines and status were added and no real content from logs/gmail
  // This helps determine if the history is substantial enough or just basic info.
  const linesInSummary = historySummary.split('\n').filter(line => line.trim() !== '' && !line.startsWith("(Warning:") && !line.startsWith("(Error:") && !line.startsWith("(Critical Error:")).length;
  // Check if, after the initial status line, any actual log or email content was added.
  // The initial summary adds 2 lines: "Interaction History..." and "- Current Lead Status...".
  // If only these 2 lines (or fewer, in case of errors generating even that) are present, it means no significant logs/emails were found.
  if (linesInSummary <= 2 && initialHistoryGenerated) { 
      return `No significant prior interaction found for ${leadFirstName} (${email || leadId}). Current Status: ${leadStatus}.`;
  }
  
  return historySummary.trimEnd(); // Trim any trailing newlines that might result from conditional sections
}

/**
 * Truncates a string to a maximum length, appending a specified message if truncated.
 * Ensures that the returned string, including the truncation message, does not exceed maxLength.
 * @param {string} str The string to truncate.
 * @param {number} maxLength The maximum desired length of the string (including truncation message).
 * @param {string} [truncationMessage="..."] The message to append if truncation occurs. Defaults to "...".
 * @return {string} The truncated string, or the original string if it's within the maxLength.
 *                  Returns the input as is if it's not a string or is null/undefined.
 * @example
 * truncateString("This is a long string", 10, "..."); // Returns "This is..."
 * truncateString("Short", 10); // Returns "Short"
 */
function truncateString(str, maxLength, truncationMessage = "...") {
  // Handle non-string inputs gracefully
  if (!str || typeof str !== 'string') {
    return str; // Or return an empty string: return "";
  }

  // If the string is already within or equal to the max length, return it as is
  if (str.length <= maxLength) {
    return str;
  }

  // Ensure truncationMessage itself isn't longer than maxLength. If so, truncate the message.
  if (truncationMessage.length > maxLength) {
      return truncationMessage.substring(0, maxLength);
  }
  
  // Calculate the length available for the original string part
  const effectiveMaxLength = maxLength - truncationMessage.length;
  
  // If maxLength is very small (e.g., less than or equal to truncationMessage length),
  // it might result in a non-positive effectiveMaxLength. In this case,
  // just return the (potentially truncated) truncationMessage itself, fitting within maxLength.
  if (effectiveMaxLength <= 0) { 
     return truncationMessage.substring(0, maxLength); // Ensure message itself fits
  }
  
  // Truncate the string and append the truncation message
  return str.substring(0, effectiveMaxLength) + truncationMessage;
}

/**
 * Formats a raw AI-generated email body for plain text readability.
 * This function normalizes line endings, trims whitespace, and ensures consistent
 * double newlines between paragraphs, while preserving single newlines within
 * intended single paragraphs (e.g., if AI tries to make a short list without blank lines).
 * @param {string} rawAIBody The raw text generated by the AI.
 * @return {string} The formatted text with normalized paragraph spacing.
 * @example
 * formatPlainTextEmailBody("Hello\nHow are you?\n\nI am fine.\nThanks.");
 * // Returns: "Hello\n\nHow are you?\n\nI am fine.\n\nThanks."
 * formatPlainTextEmailBody("  \nLine1\nLine2\n\nLine3 \n ");
 * // Returns: "Line1\n\nLine2\n\nLine3"
 */
function formatPlainTextEmailBody(rawAIBody) {
  if (!rawAIBody || typeof rawAIBody !== 'string') {
    return rawAIBody || ""; // Return as is if not a string, or empty string if null/undefined
  }

  // 1. Normalize all types of line endings (Windows, old Mac, Unix) to a single Unix-style newline (\n)
  let text = rawAIBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Trim leading/trailing whitespace (including newlines) from the entire string.
  // This prevents empty paragraphs at the very beginning or end.
  text = text.trim();

  // 3. Split into paragraphs by one or more newlines. This treats consecutive newlines as a single break.
  // Then, filter out any "paragraphs" that became empty strings after trimming (e.g., lines with only spaces).
  const paragraphs = text.split(/\n+/).filter(p => p.trim() !== "");
  
  // 4. Join the filtered, trimmed paragraphs with double newlines for consistent spacing.
  return paragraphs.join('\n\n');
}
