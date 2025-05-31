// run-tests.js

const fs = require('fs');
const vm = require('vm');

// Mock Logger
global.Logger = {
  logs: [],
  log: function(message) {
    this.logs.push(String(message)); // Store messages
    console.log(message); // Also print to console
  },
  getLog: function() { // Legacy compatibility for some Apps Script environments
    return this.logs.join('\n');
  },
  clear: function() {
    this.logs = [];
  }
};

// Mock other Apps Script global objects that might be expected by the scripts
// TestFramework.js will overwrite these with its own mocks during setupTestMocks()
global.SpreadsheetApp = {};
global.GmailApp = {};
global.UrlFetchApp = {};
// Utilities.js will define its own functions. TestFramework.js might mock Utilities object itself.
// So, ensure global.Utilities exists for TestFramework to potentially mock.
global.Utilities = global.Utilities || {};
global.LockService = {};
global.Session = {
  getScriptTimeZone: function() { return "Etc/GMT"; } // A default timezone
};
global.ScriptApp = {
  getOAuthToken: function() { return 'mock_oauth_token'; }, // Mock OAuth token
  getProjectKey: function() { return 'mock_project_key'; }
};


// Files to load, in order of dependency
const filesToLoad = [
  'Config.js',
  'Utilities.js', // logAction is defined here, might be used by other files before TestFramework mocks it
  'prompt.js',
  'automated_calendly.js',
  'automated_email_followup.js',
  'automated_email_sendPRAlert.js',
  'automated_email_sender.js',
  'TestFramework.js' // TestFramework should be loaded last as it contains test runners and mocks
];

// Create a context for the VM
const context = {
  global: global, // Provide access to the Node.js global object
  console: console, // Provide console
  Logger: global.Logger, // Make our mock Logger available in the context
  // Add other Node.js globals if needed, e.g. process, Buffer, etc.
  // However, Apps Script code shouldn't rely on Node.js specific globals.

  // Pre-assign Apps Script service mocks to the context so they appear global to the scripts
  SpreadsheetApp: global.SpreadsheetApp,
  GmailApp: global.GmailApp,
  UrlFetchApp: global.UrlFetchApp,
  Utilities: global.Utilities,
  LockService: global.LockService,
  Session: global.Session,
  ScriptApp: global.ScriptApp
};
vm.createContext(context); // Contextify the object.

// Load and execute files in the created context
filesToLoad.forEach(filename => {
  try {
    const filePath = '/app/' + filename; // Assuming files are in /app
    const fileContent = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(fileContent, context, { filename: filename });
    Logger.log(`Successfully loaded ${filename}`);
  } catch (e) {
    Logger.log(`Error loading ${filename}: ${e.message}`);
    console.error(`Stack trace for ${filename}: ${e.stack}`);
    process.exit(1); // Exit if a core file fails to load
  }
});

// After loading all files, CONFIG, STATUS etc. from Config.js should be in the 'context' object.
// We need to ensure they are also available on the Node.js 'global' object if TestFramework.js
// or other scripts expect them there directly rather than through a sandboxed context.
// TestFramework.js setupTestMocks uses `this.CONFIG = ...` which in Node script top level refers to module.exports, not global.
// It also uses `__originalCONFIG = typeof CONFIG !== 'undefined' ? CONFIG : undefined;`
// So, variables from Config.js need to be truly global.

// Explicitly promote expected globals from Config.js (which are now in 'context') to Node's 'global'
if (context.CONFIG) global.CONFIG = context.CONFIG;
if (context.STATUS) global.STATUS = context.STATUS;
if (context.LEADS_SHEET_NAME) global.LEADS_SHEET_NAME = context.LEADS_SHEET_NAME;
if (context.LOGS_SHEET_NAME) global.LOGS_SHEET_NAME = context.LOGS_SHEET_NAME;
// And any functions loaded into the context that should be global
// Utilities functions are usually global in Apps Script.
// For example, if Utilities.js defines `function logAction(...)`, vm.runInContext would make logAction a property of `context`.
// We need to make sure TestFramework.js can find these.
// TestFramework.js mocks global functions using `mockFunction(this, 'functionName', ...)`
// `this` in the test function refers to the global context for that test.
// So, functions defined in the VM context need to be copied to the Node global scope.

Object.keys(context).forEach(key => {
    if (typeof context[key] === 'function' && !global[key]) {
        global[key] = context[key];
    }
});


// Check if the main test runner function is available
if (typeof runMemoryFeatureTests === 'function') {
  Logger.log("Executing runMemoryFeatureTests()...");
  try {
    runMemoryFeatureTests(); // This function should now find CONFIG, STATUS, etc. globally
    Logger.log("runMemoryFeatureTests() execution completed.");
  } catch (e) {
    Logger.log(`Error during runMemoryFeatureTests: ${e.message}`);
    console.error(e.stack);
  }
} else {
  Logger.log("ERROR: runMemoryFeatureTests function not found. Ensure TestFramework.js is loaded correctly.");
}
