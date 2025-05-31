// run_single_test.js (Revised for correct 'this' context and fixed template literals)
const fs = require('fs');
const vm = require('vm');

global.Logger = {
  logs: [],
  log: function(message) { this.logs.push(String(message)); console.log(message); },
  getLog: function() { return this.logs.join('\n'); },
  clear: function() { this.logs = []; }
};

const appsScriptGlobals = {
  SpreadsheetApp: {}, GmailApp: {}, UrlFetchApp: {}, Utilities: global.Utilities || {},
  LockService: {}, Session: { getScriptTimeZone: function() { return "Etc/GMT"; } },
  ScriptApp: { getOAuthToken: function() { return 'mock_oauth_token'; }, getProjectKey: function() { return 'mock_project_key'; }},
  Logger: global.Logger, console: console
};
const context = vm.createContext(appsScriptGlobals);

const filesToLoad = ['Config.js', 'Utilities.js', 'prompt.js', 'automated_calendly.js', 'automated_email_followup.js', 'automated_email_sendPRAlert.js', 'automated_email_sender.js', 'TestFramework.js'];

filesToLoad.forEach(filename => {
  try {
    const filePath = '/app/' + filename;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(fileContent, context, { filename: filename });
  } catch (e) {
    Logger.log(`Error loading ${filename}: ${e.message} \nStack: ${e.stack}`);
    process.exit(1);
  }
});

const testFunctionName = "test_processReplies_negativeSentimentToUnqualified"; // TARGET FUNCTION

if (typeof context[testFunctionName] === 'function') {
  Logger.log(`Executing ${testFunctionName}()... `);
  try {
    context[testFunctionName]();
    Logger.log(`${testFunctionName}() execution completed.`);
  } catch (e) {
    Logger.log(`Error during ${testFunctionName}: ${e.message}`);
    console.error(e.stack);
  }
} else {
  Logger.log(`ERROR: ${testFunctionName} function not found in VM context.`);
}
