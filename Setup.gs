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

/**
 * Sets up time-based triggers for various automated functions.
 * Deletes all existing triggers before creating new ones.
 * CONFIG.USER_TIMEZONE must be a valid IANA timezone string (e.g., 'America/New_York').
 */
function setupTriggers() {
  logAction('SetupTriggersStart', null, null, 'Setting up script triggers.', 'INFO');

  try {
    // Delete Existing Triggers
    const existingTriggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    existingTriggers.forEach(trigger => {
      try {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      } catch (e) {
        logAction('SetupTriggersDeleteError', null, null, `Failed to delete trigger ID ${trigger.getUniqueId()}: ${e.message}`, 'WARNING');
        console.warn(`Failed to delete trigger ID ${trigger.getUniqueId()}: ${e.message}`);
      }
    });
    logAction('SetupTriggersDeleted', null, null, `Deleted ${deletedCount} existing trigger(s).`, 'INFO');
    console.log(`Deleted ${deletedCount} existing trigger(s).`);

    // Create New Triggers

    // 1. dailyEmailBatch - Every day around 9 AM
    try {
      if (!CONFIG.USER_TIMEZONE || CONFIG.USER_TIMEZONE === 'YOUR_USER_TIMEZONE') {
        logAction('SetupTriggersConfigError', null, null, 'USER_TIMEZONE not set in CONFIG. Cannot create timezone-specific triggers. dailyEmailBatch trigger skipped.', 'ERROR');
        console.error('USER_TIMEZONE not set in CONFIG. Cannot create timezone-specific triggers. dailyEmailBatch trigger skipped.');
      } else {
        ScriptApp.newTrigger('dailyEmailBatch')
          .timeBased()
          .everyDays(1)
          .atHour(9)
          .inTimezone(CONFIG.USER_TIMEZONE)
          .create();
        logAction('SetupTriggersCreate', null, null, 'Created trigger for dailyEmailBatch at 9 AM.', 'SUCCESS');
        console.log('Created trigger for dailyEmailBatch at 9 AM.');
      }
    } catch (e) {
      logAction('SetupTriggersError', null, null, `Error creating trigger for dailyEmailBatch: ${e.message}. Check function name and USER_TIMEZONE.`, 'ERROR');
      console.error(`Error creating trigger for dailyEmailBatch: ${e.message}. Ensure function exists and USER_TIMEZONE ('${CONFIG.USER_TIMEZONE}') is valid.`);
    }

    // 2. followUpEmails - Every day around 3 PM
    try {
      if (!CONFIG.USER_TIMEZONE || CONFIG.USER_TIMEZONE === 'YOUR_USER_TIMEZONE') {
         logAction('SetupTriggersConfigError', null, null, 'USER_TIMEZONE not set in CONFIG. followUpEmails trigger skipped.', 'ERROR');
         console.error('USER_TIMEZONE not set in CONFIG. followUpEmails trigger skipped.');
      } else {
        ScriptApp.newTrigger('followUpEmails')
          .timeBased()
          .everyDays(1)
          .atHour(15)
          .inTimezone(CONFIG.USER_TIMEZONE)
          .create();
        logAction('SetupTriggersCreate', null, null, 'Created trigger for followUpEmails at 3 PM.', 'SUCCESS');
        console.log('Created trigger for followUpEmails at 3 PM.');
      }
    } catch (e) {
      logAction('SetupTriggersError', null, null, `Error creating trigger for followUpEmails: ${e.message}. Check function name and USER_TIMEZONE.`, 'ERROR');
      console.error(`Error creating trigger for followUpEmails: ${e.message}. Ensure function exists and USER_TIMEZONE ('${CONFIG.USER_TIMEZONE}') is valid.`);
    }

    // 3. cleanupLeads - Every day around 11 PM
    try {
      if (!CONFIG.USER_TIMEZONE || CONFIG.USER_TIMEZONE === 'YOUR_USER_TIMEZONE') {
        logAction('SetupTriggersConfigError', null, null, 'USER_TIMEZONE not set in CONFIG. cleanupLeads trigger skipped.', 'ERROR');
        console.error('USER_TIMEZONE not set in CONFIG. cleanupLeads trigger skipped.');
      } else {
        ScriptApp.newTrigger('cleanupLeads')
          .timeBased()
          .everyDays(1)
          .atHour(23)
          .inTimezone(CONFIG.USER_TIMEZONE)
          .create();
        logAction('SetupTriggersCreate', null, null, 'Created trigger for cleanupLeads at 11 PM.', 'SUCCESS');
        console.log('Created trigger for cleanupLeads at 11 PM.');
      }
    } catch (e) {
      logAction('SetupTriggersError', null, null, `Error creating trigger for cleanupLeads: ${e.message}. Check function name and USER_TIMEZONE.`, 'ERROR');
      console.error(`Error creating trigger for cleanupLeads: ${e.message}. Ensure function exists and USER_TIMEZONE ('${CONFIG.USER_TIMEZONE}') is valid.`);
    }

    // 4. processReplies - Every hour
    try {
      ScriptApp.newTrigger('processReplies')
        .timeBased()
        .everyHours(1)
        .create();
      logAction('SetupTriggersCreate', null, null, 'Created trigger for processReplies every hour.', 'SUCCESS');
      console.log('Created trigger for processReplies every hour.');
    } catch (e) {
      logAction('SetupTriggersError', null, null, `Error creating trigger for processReplies: ${e.message}. Check function name.`, 'ERROR');
      console.error(`Error creating trigger for processReplies: ${e.message}. Ensure function exists.`);
    }

  } catch (error) {
    // Catch-all for major issues like ScriptApp service being unavailable, though unlikely.
    logAction('SetupTriggersCriticalError', null, null, `Critical error during trigger setup: ${error.message} ${error.stack}`, 'CRITICAL');
    console.error(`Critical error during trigger setup: ${error.message} ${error.stack}`);
  }

  logAction('SetupTriggersEnd', null, null, 'Script trigger setup complete.', 'INFO');
  console.log('Script trigger setup complete.');
}
