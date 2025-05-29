// Check if a global logAction exists and is the more complex one (e.g., logging to a sheet)
// For simplicity in this subtask, we'll define it scoped to this file if not globally available,
// or assume the global one will be used if present.
// A more robust check might involve typeof this.logAction !== 'function' if Utilities was a class,
// but for standalone functions in Apps Script, direct definition or checking globalThis might be options.

// Let's ensure a simple, console-based logAction is available if a more complex one isn't.
// This ensures that findLeadData and getLeadInteractionHistory can always log something.
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
    if (typeof Logger !== 'undefined') {
      Logger.log(logEntry);
    } else {
      console.log(logEntry);
    }
  }
  console.log("Utilities.js: Defined local fallback logAction.");
} else {
  console.log("Utilities.js: Global logAction found. Will use it.");
}

// File: Utilities.js - Utility functions for the CRM Automation project

/**
 * Finds lead data (firstName, status) from a given sheet.
 * Assumes logAction is globally available or this function is used where it's defined.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet object to search in.
 * @param {string} leadId The Lead ID to search for.
 * @param {string} email The email address to search for.
 * @return {object|null} An object with {firstName, status} or null if not found.
 */
function findLeadData(sheet, leadId, email) {
  try {
    if (!sheet) {
      // Using console.error as a fallback if logAction isn't available when this specific utility is called.
      console.error('findLeadData: Sheet object is null.'); 
      logAction('FindLeadDataError', leadId, email, 'Sheet object provided was null.', 'ERROR');
      return null;
    }
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const leadIdCol = headers.indexOf("Lead ID");
    const emailCol = headers.indexOf("Email");
    const firstNameCol = headers.indexOf("First Name");
    const statusCol = headers.indexOf("Status");

    if (leadIdCol === -1 || emailCol === -1 || firstNameCol === -1 || statusCol === -1) {
      const errorMessage = 'One or more required columns not found in the sheet headers: ' + headers.join(', ');
      console.error('findLeadData: ' + errorMessage);
      logAction('FindLeadDataError', leadId, email, 'Required column missing in Leads sheet. Headers: ' + headers.join(', '), 'ERROR');
      return null;
    }

    for (let i = 1; i < data.length; i++) {
      const rowLeadId = data[i][leadIdCol];
      const rowEmail = data[i][emailCol];

      const emailToCompare = email ? String(email).toLowerCase() : null;
      const rowEmailToCompare = rowEmail ? String(rowEmail).toLowerCase() : null;

      if ((leadId && rowLeadId === leadId) || (emailToCompare && rowEmailToCompare === emailToCompare)) {
        return {
          firstName: data[i][firstNameCol] || "Prospect",
          status: data[i][statusCol] || "Unknown"
        };
      }
    }
  } catch (e) {
    const exceptionMessage = `Exception in findLeadData: ${e.message} ${e.stack}`;
    console.error(exceptionMessage);
    logAction('FindLeadDataError', leadId, email, exceptionMessage, 'ERROR');
    return null;
  }
  return null; // Not found
}

/**
 * Retrieves and summarizes the interaction history of a lead from logs and Gmail.
 * Assumes CONFIG, LEADS_SHEET_NAME, LOGS_SHEET_NAME, logAction are globally available.
 * @param {string} leadId The Lead ID.
 * @param {string} email The lead's email address.
 * @return {string} A concise summary of the interaction history, or a message indicating no/partial history.
 */
function getLeadInteractionHistory(leadId, email) {
  let historySummary = "";
  let leadFirstName = "Prospect";
  let leadStatus = "Unknown";
  let initialHistoryGenerated = false; // Flag to check if basic lead info was added

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); // Main point of failure for Spreadsheet service

    // 1. Get Lead's First Name and Status from Leads Sheet
    try {
      const leadsSheet = ss.getSheetByName(LEADS_SHEET_NAME);
      if (leadsSheet) {
        const leadData = findLeadData(leadsSheet, leadId, email);
        if (leadData) {
          leadFirstName = leadData.firstName || leadFirstName;
          leadStatus = leadData.status || leadStatus;
        }
      } else {
         logAction('GetLeadHistory_LeadsSheetError', leadId, email, `Leads sheet '${LEADS_SHEET_NAME}' not found.`, 'WARNING');
         historySummary += `(Warning: Leads sheet '${LEADS_SHEET_NAME}' not found. Cannot retrieve name/status.)\n`;
      }
      historySummary += `Interaction History with ${leadFirstName} (${email || leadId}):\n`;
      historySummary += `- Current Lead Status: ${leadStatus}.\n`;
      initialHistoryGenerated = true;
    } catch (e) {
      logAction('GetLeadHistory_LeadsSheetError', leadId, email, `Error accessing Leads sheet: ${e.message}`, 'WARNING');
      historySummary += "(Warning: Could not retrieve latest lead status/name details due to error.)\n";
    }

    // 2. Get Logs from Logs Sheet
    try {
      const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
      if (logsSheet) {
        const logValues = logsSheet.getDataRange().getValues();
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
          for (let i = logValues.length - 1; i >= 1; i--) { // Start from end for recent logs
            if (logValues[i][logLeadIdCol] === leadId) {
              relevantLogs.push({
                action: logValues[i][logActionCol],
                details: logValues[i][logDetailsCol] ? String(logValues[i][logDetailsCol]).substring(0, 70) : '',
                timestamp: new Date(logValues[i][logTimestampCol]).toLocaleDateString()
              });
              if (relevantLogs.length >= 3) break;
            }
          }
          if (relevantLogs.length > 0) {
            historySummary += "Recent Logs:\n";
            relevantLogs.reverse().forEach(log => {
              historySummary += `  - ${log.timestamp}: ${log.action} - ${log.details}...\n`;
            });
          } else {
             historySummary += "Recent Logs: No specific logs found for this Lead ID.\n";
          }
        }
      } else {
        historySummary += "Recent Logs: (Logs sheet not found)\n";
        logAction('GetLeadHistory_LogsSheetError', leadId, email, `Logs sheet '${LOGS_SHEET_NAME}' not found.`, 'WARNING');
      }
    } catch (e) {
      logAction('GetLeadHistory_LogsSheetError', leadId, email, `Error accessing Logs sheet: ${e.message}`, 'WARNING');
      historySummary += "(Warning: Could not retrieve some log history due to error.)\n";
    }

    // 3. Get from Gmail Thread
    try {
      if (email) { // Only attempt Gmail search if email is provided
        if (typeof GmailApp !== 'undefined' && GmailApp) { // Check if service is available
            const threads = GmailApp.search(`(to:${email} OR from:${email}) in:inbox`, 0, 1); // last thread
            if (threads.length > 0) {
              const messages = threads[0].getMessages();
              if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                const snippet = lastMessage.getPlainBody().substring(0, 100);
                const messageDate = new Date(lastMessage.getDate()).toLocaleDateString();
                const from = lastMessage.getFrom();
                historySummary += `Last Email in Thread (${messageDate}):\n`;
                historySummary += `  - From: ${from}\n`;
                historySummary += `  - Snippet: "${snippet}..."\n`;

                if (messages.length > 1) {
                  const secondLastMessage = messages[messages.length - 2];
                  const snippet2 = secondLastMessage.getPlainBody().substring(0, 100);
                  const messageDate2 = new Date(secondLastMessage.getDate()).toLocaleDateString();
                  const from2 = secondLastMessage.getFrom();
                  historySummary += `Second Last Email (${messageDate2}):\n`;
                  historySummary += `  - From: ${from2}\n`;
                  historySummary += `  - Snippet: "${snippet2}..."\n`;
                }
              } else {
                 historySummary += "Gmail Thread: Last thread found but contains no messages.\n";
              }
            } else {
              historySummary += "Gmail Thread: No recent threads found with this email.\n";
            }
        } else {
            logAction('GetLeadHistory_GmailError', leadId, email, 'GmailApp service not available.', 'WARNING');
            historySummary += "(Warning: Could not retrieve Gmail history - GmailApp service unavailable.)\n";
        }
      } else {
          historySummary += "Gmail Thread: Email not provided for search.\n";
      }
    } catch (e) {
      logAction('GetLeadHistory_GmailError', leadId, email, `Error accessing Gmail: ${e.message}`, 'WARNING');
      historySummary += `(Warning: Could not retrieve Gmail history due to error: ${e.message})\n`;
    }

  } catch (e) { // Main catch for catastrophic errors (e.g. SPREADSHEET_ID wrong, Spreadsheet service completely down)
    logAction('GetLeadHistoryError', leadId, email, `Critical Error during history retrieval: ${e.message} ${e.stack}`, 'ERROR');
    // If the basic history wasn't even generated, return a more direct error. Otherwise, append to what was gathered.
    if (!initialHistoryGenerated) {
      return `(Critical Error: Could not retrieve interaction history for ${email || leadId} - ${e.message})\n`;
    }
    historySummary += `(Critical Error impacting history retrieval: ${e.message})\n`;
  }

  // Check if only the initial lines and status were added and no real content from logs/gmail
  const linesInSummary = historySummary.split('\n').filter(line => line.trim() !== '' && !line.startsWith("(Warning:") && !line.startsWith("(Error:")).length;
  if (linesInSummary <= 2 && initialHistoryGenerated) { // e.g., "Interaction History with..." and "Current Lead Status..."
      return `No significant prior interaction found for ${leadFirstName} (${email || leadId}). Current Status: ${leadStatus}.`;
  }
  
  return historySummary;
}

/**
 * Truncates a string to a maximum length, appending a message if truncated.
 * @param {string} str The string to truncate.
 * @param {number} maxLength The maximum desired length of the string (including truncation message).
 * @param {string} [truncationMessage="..."] The message to append if truncation occurs.
 * @return {string} The truncated string, or the original if within limits.
 */
function truncateString(str, maxLength, truncationMessage = "...") {
  if (!str || typeof str !== 'string') {
    return str; // Or return "" if preferred for non-strings
  }
  if (str.length <= maxLength) {
    return str;
  }
  // Ensure truncationMessage itself isn't longer than maxLength
  if (truncationMessage.length > maxLength) {
      return truncationMessage.substring(0, maxLength);
  }
  
  const effectiveMaxLength = maxLength - truncationMessage.length;
  
  // It's possible effectiveMaxLength becomes 0 or negative if maxLength is very small
  // and equal to or less than truncationMessage.length. In this case, just return the truncated message.
  if (effectiveMaxLength <= 0) { 
     return truncationMessage.substring(0, maxLength); 
  }
  return str.substring(0, effectiveMaxLength) + truncationMessage;
}
