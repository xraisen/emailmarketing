// File: Utilities.gs - Common utility functions

/**
 * Generates a unique string ID.
 * @return {string} A unique identifier.
 */
function generateUUID() {
  return Utilities.getUuid();
}

/**
 * Validates an email address format.
 * @param {string} email The email string to validate.
 * @return {boolean} True if the email format is valid, false otherwise.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Logs an action to the 'Logs' sheet in the configured spreadsheet.
 *
 * @param {string} action - The type of action performed (e.g., 'SendEmail', 'UpdateStatus').
 * @param {string} [leadId] - Optional. The ID of the lead related to the action.
 * @param {string} [email] - Optional. The email address related to the action.
 * @param {string} details - A description of the action or its outcome.
 * @param {string} status - The status of the action (e.g., 'SUCCESS', 'ERROR', 'INFO', 'PENDING').
 */
function logAction(action, leadId, email, details, status) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    if (!ss) {
      // This case should ideally be rare if initializeSheets ran successfully.
      console.error(`logAction failed: Could not open spreadsheet with ID ${CONFIG.SPREADSHEET_ID}`);
      // Fallback logging if spreadsheet operations fail
      console.log(`Fallback Log - Timestamp: ${new Date().toISOString()}, Action: ${action}, Lead ID: ${leadId || ''}, Email: ${email || ''}, Details: ${details}, Status: ${status}`);
      return;
    }

    const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
    if (!logsSheet) {
      console.error(`logAction failed: '${LOGS_SHEET_NAME}' sheet not found. Please run initializeSheets().`);
      // Fallback logging
      console.log(`Fallback Log - Timestamp: ${new Date().toISOString()}, Action: ${action}, Lead ID: ${leadId || ''}, Email: ${email || ''}, Details: ${details}, Status: ${status}`);
      return;
    }

    const timestamp = new Date();
    logsSheet.appendRow([
      timestamp,
      action,
      leadId || '', // Ensure empty string if null or undefined
      email || '',  // Ensure empty string if null or undefined
      details,
      status
    ]);

  } catch (e) {
    console.error(`Error in logAction: ${e.message} ${e.stack}`);
    // Fallback logging in case of any other errors during the appendRow or sheet access
    console.log(`Fallback Log (Exception) - Timestamp: ${new Date().toISOString()}, Action: ${action}, Lead ID: ${leadId || ''}, Email: ${email || ''}, Details: ${details}, Status: ${status}, Error: ${e.message}`);
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
    map[columnName.trim()] = index; // Trim to handle potential spaces in headers
  });
  return map;
}
