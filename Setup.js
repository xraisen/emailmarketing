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
        // Make sure sheet is valid before calling methods on it
        if (sheet && typeof sheet.getRange === 'function' && typeof sheet.getLastColumn === 'function') {
          const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          if (!areHeadersCorrect(currentHeaders, config.headers)) {
            logAction('InitializeSheets', null, null, `Headers missing or incorrect for sheet: ${config.name}. Setting headers.`, 'INFO');
            setHeaders(sheet, config.headers, config.name);
          } else {
            logAction('InitializeSheets', null, null, `Headers already correct for sheet: ${config.name}`, 'DEBUG');
          }
        } else if (config.name) { // Only log error if config.name was defined, otherwise sheet itself was problematic earlier
            const errorMsg = `Sheet object for '${config.name}' is invalid or undefined before checking/setting headers.`;
            logAction('InitializeSheets', null, null, errorMsg, 'ERROR');
            console.error(errorMsg);
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
  // --- Start: Add Guard Clause ---
  if (!sheet || typeof sheet.getRange !== 'function' || typeof sheet.getLastRow !== 'function' || typeof sheet.getMaxColumns !== 'function') {
    const errorMsg = `setHeaders called with an invalid or undefined sheet object for sheetName: ${sheetName || 'Unknown'}. Sheet object was: ${String(sheet)}.`;
    // Assuming logAction is globally available or defined in Setup.js or Utilities.js
    // If logAction might not be available here, fallback to console.error or Logger.log
    if (typeof logAction === 'function') {
      logAction('SetHeadersError', null, null, errorMsg, 'ERROR');
    } else {
      console.error(errorMsg); // Use console.error as a robust fallback
      if (typeof Logger !== 'undefined') Logger.log(errorMsg); // Also log to Apps Script logger if available
    }
    return; 
  }
  // --- End: Add Guard Clause ---
  try {
    // Clear the first row only if it has content to avoid unnecessary clearing
    // Check if getLastRow returns a number and it's >= 1
    const lastRow = sheet.getLastRow(); // Get it once
    if (typeof lastRow === 'number' && lastRow >= 1 && sheet.getLastColumn() >= 1) { 
        const firstRowRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
        firstRowRange.clearContent(); 
    }
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1); // Freeze the header row
    logAction('SetHeaders', null, null, `Headers set for sheet: ${sheetName}`, 'INFO');
    console.log(`Headers set for sheet: ${sheetName}`);
  } catch (e) {
    logAction('SetHeaders', null, null, `Error setting headers for sheet ${sheetName}: ${e.message} ${e.stack ? e.stack : ''}`, 'ERROR');
    console.error(`Error setting headers for sheet ${sheetName}: ${e.toString()} ${e.stack ? e.stack : ''}`);
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
      if (!CONFIG.USER_TIMEZONE || CONFIG.USER_TIMEZONE === 'YOUR_USER_TIMEZONE' || CONFIG.USER_TIMEZONE.trim() === '') {
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
      if (!CONFIG.USER_TIMEZONE || CONFIG.USER_TIMEZONE === 'YOUR_USER_TIMEZONE' || CONFIG.USER_TIMEZONE.trim() === '') {
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
      if (!CONFIG.USER_TIMEZONE || CONFIG.USER_TIMEZONE === 'YOUR_USER_TIMEZONE' || CONFIG.USER_TIMEZONE.trim() === '') {
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

/**
 * FOR MANUAL EXECUTION: Retrieves the Calendly Organization URI using the PAT from Config.gs.
 * The user must first set CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN in Config.gs.
 * The output URI should then be copied into CONFIG.ORGANIZATION_URI in Config.gs.
 * @return {string|null} The Organization URI or null if an error occurs.
 */
function getCalendlyOrganizationUri() {
  const token = CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN; 
  if (!token || token === 'YOUR_ACTUAL_PERSONAL_ACCESS_TOKEN_REPLACE_ME' || token.trim() === '') {
    const msg = 'Error: CALENDLY_PERSONAL_ACCESS_TOKEN is not set in Config.js. Please update it with your actual token first.';
    console.error(msg);
    logAction('GetCalendlyOrgUri', null, null, msg, 'ERROR');
    return null;
  }
  const url = 'https://api.calendly.com/users/me';
  const options = {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true // Important for parsing error responses
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      const errHttpMsg = `Error fetching user data from Calendly. HTTP Status: ${responseCode}. Response: ${responseText}`;
      console.error(errHttpMsg);
      logAction('GetCalendlyOrgUri', null, null, errHttpMsg, 'ERROR');
      return null;
    }
    
    const data = JSON.parse(responseText);
    if (!data || !data.resource || !data.resource.current_organization) {
      const errDataMsg = 'Error: Organization URI not found in Calendly API response. Response: ' + responseText;
      console.error(errDataMsg);
      logAction('GetCalendlyOrgUri', null, null, errDataMsg, 'ERROR');
      return null;
    }
    
    const orgUri = data.resource.current_organization;
    const successMsg = `Your Organization URI is: ${orgUri}`;
    console.log(successMsg);
    logAction('GetCalendlyOrgUri', null, null, successMsg, 'SUCCESS');
    
    // Optionally write to a spreadsheet (ensure SPREADSHEET_ID and sheet name are correct)
    // const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); 
    // const sheet = ss.getSheetByName('Config'); 
    // if (sheet) {
    //   sheet.getRange('A1').setValue(orgUri); 
    // }
    return orgUri;

  } catch (e) {
    const exceptionMsg = `Exception in getCalendlyOrganizationUri: ${e.message} ${e.stack ? 'Stack: ' + e.stack : ''}`;
    console.error(exceptionMsg);
    logAction('GetCalendlyOrgUri', null, null, exceptionMsg, 'ERROR');
    return null;
  }
}

/**
 * FOR MANUAL EXECUTION: Creates a Calendly webhook subscription using credentials from Config.gs.
 * User must first set CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN and run getCalendlyOrganizationUri()
 * to set CONFIG.ORGANIZATION_URI in Config.gs.
 * @return {boolean} True if successful, false otherwise.
 */
function createCalendlyWebhookSubscription() {
  const webAppUrl = ScriptApp.getService().getUrl();
  const apiToken = CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN;
  const orgUri = CONFIG.ORGANIZATION_URI;

  if (!webAppUrl || typeof webAppUrl !== 'string' || !webAppUrl.startsWith('https://script.google.com/')) {
    const msg = 'Error: Could not get valid Web App URL. The script must be deployed as a web app first.';
    console.error(msg);
    logAction('CreateCalendlyWebhook', null, null, msg, 'ERROR');
    // It might be useful to inform the user via UI if running from editor, but for now, log.
    // if (typeof SpreadsheetApp !== 'undefined') SpreadsheetApp.getUi().alert(msg);
    return false;
  }

  if (!apiToken || apiToken === 'YOUR_ACTUAL_PERSONAL_ACCESS_TOKEN_REPLACE_ME' || apiToken.trim() === '') {
    const msg = 'Error: CALENDLY_PERSONAL_ACCESS_TOKEN is not set in Config.js. Please update it with your actual token first.';
    console.error(msg);
    logAction('CreateCalendlyWebhook', null, null, msg, 'ERROR');
    return false;
  }

  if (!orgUri || orgUri === 'YOUR_ORGANIZATION_URI_FROM_API_REPLACE_ME' || orgUri.trim() === '') {
    const msg = 'Error: ORGANIZATION_URI is not set in Config.js. Please run getCalendlyOrganizationUri() and update Config.js first.';
    console.error(msg);
    logAction('CreateCalendlyWebhook', null, null, msg, 'ERROR');
    return false;
  }
  
  if (!CONFIG.CALENDLY_SIGNING_KEY || CONFIG.CALENDLY_SIGNING_KEY === 'YOUR_CALENDLY_WEBHOOK_SIGNING_KEY_REPLACE_ME' || CONFIG.CALENDLY_SIGNING_KEY.trim() === '') {
    const msg = 'Error: CALENDLY_SIGNING_KEY is not set in Config.js. Please obtain it from your Calendly webhook settings and update Config.js.';
    console.error(msg);
    logAction('CreateCalendlyWebhook', null, null, msg, 'ERROR');
    return false;
  }


  try {
    const payload = {
      url: webAppUrl,
      events: ['invitee.created', 'invitee.canceled'],
      organization: orgUri,
      scope: 'organization',
      signing_key: CONFIG.CALENDLY_SIGNING_KEY 
    };
    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + apiToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch('https://api.calendly.com/webhook_subscriptions', options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 201) {
      const successMsg = 'Successfully created Calendly webhook subscription for events: invitee.created, invitee.canceled. Response: ' + responseBody;
      console.log(successMsg);
      logAction('CreateCalendlyWebhook', null, null, successMsg, 'SUCCESS');
      return true;
    } else if (responseCode === 409) { // HTTP 409 Conflict
      const conflictMsg = 'Calendly webhook subscription may already exist for this URL and organization (HTTP 409 Conflict). ' +
                          'If you need to update it, please delete the existing one in Calendly admin first. Response: ' + responseBody;
      console.warn(conflictMsg); // Log as warning, but consider it a success for automation.
      logAction('CreateCalendlyWebhook', null, null, conflictMsg, 'WARNING'); 
      return true; // Assuming existing is acceptable.
    } else {
      const errorMsg = 'Error creating Calendly webhook subscription. Code: ' + responseCode + '\nBody: ' + responseBody + '\nEnsure your token, Org URI, and Signing Key in Config.js are correct and the Web App URL is valid.';
      console.error(errorMsg);
      logAction('CreateCalendlyWebhook', null, null, errorMsg, 'ERROR');
      return false;
    }
  } catch (e) {
    const errorMsg = 'Exception in createCalendlyWebhookSubscription: ' + e.toString() + (e.stack ? '\nStack: ' + e.stack : '');
    console.error(errorMsg);
    logAction('CreateCalendlyWebhookError', null, null, errorMsg, 'ERROR');
    return false;
  }
}
