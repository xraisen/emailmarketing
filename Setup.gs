// File: Setup.gs - Handles initial setup and configuration for the project.

/**
 * Initializes the 'Leads' and 'Logs' sheets in the spreadsheet.
 * Creates sheets if they don't exist and sets up header rows.
 */
function initializeSheets() {
  logAction('InitializeSheets', null, null, 'Starting sheet initialization.', 'INFO');

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    if (!ss) {
      logAction('InitializeSheets', null, null, `Failed to open spreadsheet with ID: ${CONFIG.SPREADSHEET_ID}`, 'ERROR');
      console.error(`Failed to open spreadsheet with ID: ${CONFIG.SPREADSHEET_ID}`);
      return;
    }

    // Define sheet configurations
    const sheetConfigs = [
      {
        name: LEADS_SHEET_NAME,
        headers: ['First Name', 'Email', 'Phone', 'Last Service', 'Status', 'Last Contact', 'Lead ID']
      },
      {
        name: LOGS_SHEET_NAME,
        headers: ['Timestamp', 'Action', 'Lead ID', 'Email', 'Details', 'Status']
      }
    ];

    sheetConfigs.forEach(config => {
      let sheet = ss.getSheetByName(config.name);

      if (!sheet) {
        sheet = ss.insertSheet(config.name);
        logAction('InitializeSheets', null, null, `Created sheet: ${config.name}`, 'INFO');
        console.log(`Created sheet: ${config.name}`);
        // Set headers for the new sheet
        setHeaders(sheet, config.headers, config.name);
      } else {
        // Check and set headers if necessary
        const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        if (!areHeadersCorrect(currentHeaders, config.headers)) {
          logAction('InitializeSheets', null, null, `Headers missing or incorrect for sheet: ${config.name}. Setting headers.`, 'INFO');
          setHeaders(sheet, config.headers, config.name);
        } else {
          logAction('InitializeSheets', null, null, `Headers already correct for sheet: ${config.name}`, 'DEBUG');
        }
      }
    });

    logAction('InitializeSheets', null, null, 'Sheet initialization completed successfully.', 'INFO');
  } catch (e) {
    logAction('InitializeSheets', null, null, `Error during sheet initialization: ${e.message}`, 'ERROR');
    console.error(`Error during sheet initialization: ${e.toString()} ${e.stack}`);
  }
}

/**
 * Sets the header row for a given sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet object.
 * @param {string[]} headers An array of header strings.
 * @param {string} sheetName The name of the sheet (for logging).
 */
function setHeaders(sheet, headers, sheetName) {
  try {
    // Clear the first row only if it has content to avoid unnecessary clearing
    if (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1) {
        const firstRowRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
        // Check if the first row is blank before clearing. This is a bit tricky,
        // as getValues() on a completely blank row might return [[]] or similar.
        // A more robust check might involve checking if any cell in the first row has data.
        // However, for simplicity, we clear if there's *any* data or formatting.
        // For a truly new sheet, this might be redundant but harmless.
        // For an existing sheet with incorrect headers, this is necessary.
        firstRowRange.clearContent(); 
    }
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1); // Freeze the header row
    logAction('SetHeaders', null, null, `Headers set for sheet: ${sheetName}`, 'INFO');
    console.log(`Headers set for sheet: ${sheetName}`);
  } catch (e) {
    logAction('SetHeaders', null, null, `Error setting headers for sheet ${sheetName}: ${e.message}`, 'ERROR');
    console.error(`Error setting headers for sheet ${sheetName}: ${e.toString()}`);
  }
}

/**
 * Checks if the current headers match the expected headers.
 * @param {string[]} currentHeaders An array of current header strings.
 * @param {string[]} expectedHeaders An array of expected header strings.
 * @return {boolean} True if headers are correct, false otherwise.
 */
function areHeadersCorrect(currentHeaders, expectedHeaders) {
  if (!currentHeaders || currentHeaders.length === 0 && expectedHeaders.length === 0) return true; // Both empty is fine
  if (!currentHeaders || expectedHeaders.length !== currentHeaders.length) return false;
  for (let i = 0; i < expectedHeaders.length; i++) {
    if (currentHeaders[i] !== expectedHeaders[i]) {
      return false;
    }
  }
  return true;
}

// Example of how you might call this, perhaps from a menu item or a trigger:
// function onOpen() {
//   initializeSheets();
// }
