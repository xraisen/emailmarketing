// File: TestFramework.js - Test functions for CRM Automation

// --- Assertion Helpers ---
function assertEqual(actual, expected, message) {
  var pass = actual === expected;
  if (typeof actual === 'object' && typeof expected === 'object' && actual !== null && expected !== null) {
    // Basic JSON stringify comparison for objects/arrays
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        // Fallback for initial strict check if objects are string-equal but not ref-equal
    } else {
        // Keep fail unless specific logic handles deep comparison
    }
  }
  if (pass || (typeof actual === 'object' && typeof expected === 'object' && actual !== null && expected !== null && JSON.stringify(actual) === JSON.stringify(expected)) ) {
    Logger.log(`  [PASS] ${message}`);
  } else {
    Logger.log(`  [FAIL] ${message}. Expected: "${expected}" (Type: ${typeof expected}), Actual: "${actual}" (Type: ${typeof actual})`);
    console.error(`  [FAIL] ${message}. Expected: "${expected}" (Type: ${typeof expected}), Actual: "${actual}" (Type: ${typeof actual})`);
  }
}

function assertNotNull(actual, message) {
  if (actual !== null && actual !== undefined) {
    Logger.log(`  [PASS] ${message}`);
  } else {
    Logger.log(`  [FAIL] ${message}. Expected not null/undefined, but was: ${actual}`);
    console.error(`  [FAIL] ${message}. Expected not null/undefined, but was: ${actual}`);
  }
}

function assertTrue(actual, message) {
  if (actual === true) {
    Logger.log(`  [PASS] ${message}`);
  } else {
    Logger.log(`  [FAIL] ${message}. Expected true, but was: ${actual}`);
    console.error(`  [FAIL] ${message}. Expected true, but was: ${actual}`);
  }
}

// --- Mocking Infrastructure ---
// Store original global objects that might be replaced by mocks
var __originalSpreadsheetApp = typeof SpreadsheetApp !== 'undefined' ? SpreadsheetApp : undefined;
var __originalGmailApp = typeof GmailApp !== 'undefined' ? GmailApp : undefined;
var __originalUrlFetchApp = typeof UrlFetchApp !== 'undefined' ? UrlFetchApp : undefined;
var __originalUtilities = typeof Utilities !== 'undefined' ? Utilities : undefined;
var __originalLogger = typeof Logger !== 'undefined' ? Logger : undefined;
var __originalCONFIG = typeof CONFIG !== 'undefined' ? CONFIG : undefined;
var __originalSTATUS = typeof STATUS !== 'undefined' ? STATUS : undefined;
var __originalLEADS_SHEET_NAME = typeof LEADS_SHEET_NAME !== 'undefined' ? LEADS_SHEET_NAME : undefined;
var __originalLOGS_SHEET_NAME = typeof LOGS_SHEET_NAME !== 'undefined' ? LOGS_SHEET_NAME : undefined;
var __originalLockService = typeof LockService !== 'undefined' ? LockService : undefined;


// Global map to store original functions that might be mocked by tests using mockFunction(this, 'functionName', ...)
var __globalOriginals = {}; // Use var for Apps Script global behavior if not in strict mode

// Mock for SpreadsheetApp
var MockSpreadsheetApp = {
  _sheetsData: {},
  _currentSpreadsheetId: null,
  _currentSheetName: null,

  openById: function(id) {
    Logger.log(`[MOCK SPREADSHEET] openById called with: ${id}`);
    this._currentSpreadsheetId = id;
    if (!this._sheetsData[id]) this._sheetsData[id] = {};
    return this;
  },
  getSheetByName: function(name) {
    Logger.log(`[MOCK SPREADSHEET] getSheetByName called with: ${name}`);
    this._currentSheetName = name;
    if (!this._sheetsData[this._currentSpreadsheetId] || !this._sheetsData[this._currentSpreadsheetId][name]) {
      Logger.log(`[MOCK SPREADSHEET] No mock data for S_ID:${this._currentSpreadsheetId}, Sheet:${name}. Creating default.`);
      this._sheetsData[this._currentSpreadsheetId] = this._sheetsData[this._currentSpreadsheetId] || {};
      this._sheetsData[this._currentSpreadsheetId][name] = { data: [[]], lastRow: 0, lastCol: 0, _lastSetValue: null, _appendedRows: [] };
    }
    var sheetMockData = this._sheetsData[this._currentSpreadsheetId][name];
    return {
      getDataRange: function() {
        return {
          getValues: function() { return sheetMockData.data; }
        };
      },
      getRange: function(row, col, numRows, numCols) {
        return {
          getValue: function() { return (sheetMockData.data[row-1] && sheetMockData.data[row-1][col-1]) || ""; },
          setValue: function(value) {
            Logger.log(`[MOCK SPREADSHEET] setValue on ${name} at R${row}C${col} = ${value}`);
            if (!sheetMockData.data[row-1]) {
                for(var r_idx = sheetMockData.data.length; r_idx < row; r_idx++) sheetMockData.data.push([]);
            }
            for(var c_idx = (sheetMockData.data[row-1] ? sheetMockData.data[row-1].length : 0); c_idx < col; c_idx++) sheetMockData.data[row-1].push("");
            sheetMockData.data[row-1][col-1] = value;
            sheetMockData._lastSetValue = {row: row, col: col, value: value, sheetName: name};
            if (row > sheetMockData.lastRow) sheetMockData.lastRow = row;
            if (col > sheetMockData.lastCol) sheetMockData.lastCol = col;
          }
        };
      },
      appendRow: function(rowData) { sheetMockData.data.push(rowData); sheetMockData.lastRow = sheetMockData.data.length; sheetMockData._appendedRows.push(rowData); },
      getLastRow: function() { return sheetMockData.lastRow; },
      getLastColumn: function() { return sheetMockData.lastCol; }
    };
  },
  flush: function() { Logger.log("[MOCK SPREADSHEET] flush called"); },
  _setSheetData: function(spreadsheetId, sheetName, dataArray) {
    if (!this._sheetsData[spreadsheetId]) this._sheetsData[spreadsheetId] = {};
    this._sheetsData[spreadsheetId][sheetName] = {
        data: JSON.parse(JSON.stringify(dataArray)), lastRow: dataArray.length,
        lastCol: dataArray.length > 0 ? dataArray[0].length : 0, _lastSetValue: null, _appendedRows: []
    };
  },
  _getLastSetValue: function(spreadsheetId, sheetName) {
      return (this._sheetsData[spreadsheetId] && this._sheetsData[spreadsheetId][sheetName]) ? this._sheetsData[spreadsheetId][sheetName]._lastSetValue : null;
  },
   _clearMockData: function() { this._sheetsData = {}; }
};

// Mock for GmailApp
var MockGmailApp = {
  _threads: [], // Array of mock thread objects
  _lastSearchQuery: null,
  _lastSentEmail: null,
  _lastThreadMarkedRead: false,

  search: function(query, start, max) {
    Logger.log(`[MOCK GMAIL] search called with query: ${query}`);
    this._lastSearchQuery = query;
    // Simple filter for testing, can be made more sophisticated
    return this._threads.filter(thread => thread._queryMatcher ? thread._queryMatcher(query) : true);
  },
  sendEmail: function(to, subject, body, options) {
    Logger.log(`[MOCK GMAIL] sendEmail to ${to} with subject ${subject}`);
    this._lastSentEmail = { to, subject, body, options };
  },
  _addMockThread: function(threadData) { // threadData = {messages: [{body, from, date}], queryMatcher: func}
      var mockMessages = (threadData.messages || []).map(m => ({
          getPlainBody: () => m.body || "",
          getFrom: () => m.from || "",
          getDate: () => m.date || new Date(),
          isUnread: () => m.isUnread !== undefined ? m.isUnread : true, // Default to unread
      }));
      this._threads.push({
          getMessages: () => mockMessages,
          markRead: () => { this._lastThreadMarkedRead = true; Logger.log("[MOCK GMAIL] Thread marked as read."); },
          _queryMatcher: threadData.queryMatcher
      });
  },
  _clearMockData: function() { this._threads = []; this._lastSearchQuery = null; this._lastSentEmail = null; this._lastThreadMarkedRead = false;}
};

// Mock for UrlFetchApp
var MockUrlFetchApp = {
    _mockResponses: {}, // keyed by URL pattern
    _lastFetchUrl: null,
    _lastFetchParams: null,
    fetch: function(url, params) {
        Logger.log(`[MOCK URLFETCH] fetch called for URL: ${url}`);
        this._lastFetchUrl = url;
        this._lastFetchParams = params;
        for (var pattern in this._mockResponses) {
            if (url.includes(pattern)) {
                var mockResp = this._mockResponses[pattern];
                return {
                    getResponseCode: () => mockResp.responseCode || 200,
                    getContentText: () => mockResp.contentText || ""
                };
            }
        }
        return { getResponseCode: () => 404, getContentText: () => "Mock URLFetch: No mock response for " + url };
    },
    _addMockResponse: function(urlPattern, contentText, responseCode = 200) {
        this._mockResponses[urlPattern] = { contentText, responseCode };
    },
    _clearMockData: function() { this._mockResponses = {}; this._lastFetchUrl = null; this._lastFetchParams = null; }
};

// Mock for Utilities
var MockUtilities = {
    formatDate: function(date, tz, format) { return new Date(date).toISOString().substring(0,19).replace('T',' ') + " GMT"; }, // Simple mock
    sleep: function(ms) { return Logger.log(`[MOCK UTILITIES] sleep for ${ms}ms`); },
    getUuid: function() { return 'mock-uuid-' + Math.random().toString(36).substring(2,9); }
};

// Mock for LockService
var MockLockService = {
    getScriptLock: function() { return this; },
    tryLock: function(timeout) { return true; },
    releaseLock: function() {}
};


// Function to setup mocks for a test run
function setupTestMocks() {
  Logger.log("[TEST SETUP] Initializing mocks...");
  // Replace global Apps Script objects with mocks
  this.SpreadsheetApp = MockSpreadsheetApp;
  this.GmailApp = MockGmailApp;
  this.UrlFetchApp = MockUrlFetchApp;
  this.Utilities = MockUtilities;
  this.LockService = MockLockService;

  // Clear any previous mock data
  MockSpreadsheetApp._clearMockData();
  MockGmailApp._clearMockData();
  MockUrlFetchApp._clearMockData();

  // Ensure CONFIG and STATUS are mockable or use defaults
  this.CONFIG = JSON.parse(JSON.stringify(__originalCONFIG || { SPREADSHEET_ID: "test_default_sid", AI_SERVICES_PROFILE: {}, CALENDLY_LINK: "default_link" }));
  this.STATUS = JSON.parse(JSON.stringify(__originalSTATUS || { PENDING: "PENDING", SENT: "SENT", HOT: "HOT", UNQUALIFIED: "UNQUALIFIED" }));
  this.LEADS_SHEET_NAME = __originalLEADS_SHEET_NAME || "Leads";
  this.LOGS_SHEET_NAME = __originalLOGS_SHEET_NAME || "Logs";
  
  // Reset and prepare __globalOriginals for functions that will be mocked using mockFunction(this, ...)
  __globalOriginals = {};
}

// Function to teardown mocks after a test run
function teardownTestMocks() {
  Logger.log("[TEST TEARDOWN] Restoring original global objects...");
  if (__originalSpreadsheetApp) this.SpreadsheetApp = __originalSpreadsheetApp;
  if (__originalGmailApp) this.GmailApp = __originalGmailApp;
  if (__originalUrlFetchApp) this.UrlFetchApp = __originalUrlFetchApp;
  if (__originalUtilities) this.Utilities = __originalUtilities;
  if (__originalLockService) this.LockService = __originalLockService;
  if (__originalCONFIG) this.CONFIG = __originalCONFIG;
  if (__originalSTATUS) this.STATUS = __originalSTATUS;
  if (__originalLEADS_SHEET_NAME) this.LEADS_SHEET_NAME = __originalLEADS_SHEET_NAME;
  if (__originalLOGS_SHEET_NAME) this.LOGS_SHEET_NAME = __originalLOGS_SHEET_NAME;

  // Restore functions mocked using mockFunction(this, ...)
  for (var funcName in __globalOriginals) {
    if (this.hasOwnProperty(funcName) && __globalOriginals.hasOwnProperty(funcName)) {
      this[funcName] = __globalOriginals[funcName].original;
      Logger.log(`[TEST TEARDOWN] Restored global function: ${funcName}`);
    }
  }
  __globalOriginals = {}; // Clear for next run
}

// General purpose mockFunction that stores original in __globalOriginals
function mockFunction(obj, functionName, mockImplementation) {
    var globalFuncName = (obj === this || obj === globalThis) ? functionName : null; // 'this' in Apps Script global scope
    var original = globalFuncName ? (obj[functionName] || undefined) : (obj ? obj[functionName] : undefined);

    if (globalFuncName && !__globalOriginals[globalFuncName]) {
        __globalOriginals[globalFuncName] = { original: original, obj: obj };
    } else if (obj && !obj[`__original_${functionName}`]) {
        try { obj[`__original_${functionName}`] = original; } catch (e) { /* some objects are not extensible */ }
    }
    
    if (obj) obj[functionName] = mockImplementation;
    else if (globalFuncName) this[globalFuncName] = mockImplementation;

    return {
        restore: function() {
            if (globalFuncName && __globalOriginals[globalFuncName]) {
                obj[functionName] = __globalOriginals[globalFuncName].original;
                delete __globalOriginals[globalFuncName];
            } else if (obj && obj[`__original_${functionName}`]) {
                obj[functionName] = obj[`__original_${functionName}`];
                delete obj[`__original_${functionName}`];
            }
        }
    };
}


// --- Test Runner for Memory Feature ---
function runMemoryFeatureTests() {
  Logger.log("\n--- Starting Memory Feature Tests ---");
  
  test_getLeadInteractionHistory_NoHistory();
  test_getLeadInteractionHistory_LogsOnly();
  test_getLeadInteractionHistory_GmailOnly();
  test_getLeadInteractionHistory_FullHistory();
  test_processReplies_UsesHistoryForAIClassification();

  // Adding new tests for manual review and negative sentiment paths
  test_processReplies_lowConfidenceToManualReview();
  test_processReplies_neutralGenericToManualReview();
  test_processReplies_positiveGenericToManualReview();
  test_processReplies_aiGenerationFailureToManualReview();
  test_processReplies_negativeSentimentToUnqualified();

  Logger.log("\n--- Memory Feature Tests Completed ---");
}

// --- Test for formatPlainTextEmailBody ---
function test_formatPlainTextEmailBody_scenarios() {
    Logger.log("\nRunning test_formatPlainTextEmailBody_scenarios...");
    setupTestMocks(); // Basic mocks, though this function is pure

    // Assuming formatPlainTextEmailBody is globally available from Utilities.js
    if (typeof formatPlainTextEmailBody !== 'function') {
        Logger.log("ERROR: formatPlainTextEmailBody function not found globally. Skipping tests.");
        assertTrue(false, "formatPlainTextEmailBody function not found globally.");
        teardownTestMocks();
        return;
    }

    assertEqual(formatPlainTextEmailBody("Para1\nPara2"), "Para1\n\nPara2", "Single newline to double");
    assertEqual(formatPlainTextEmailBody("Para1\n\nPara2"), "Para1\n\nPara2", "Existing double newline preserved");
    assertEqual(formatPlainTextEmailBody("Para1\n\n\nPara2"), "Para1\n\nPara2", "Multiple newlines collapsed to double");
    assertEqual(formatPlainTextEmailBody("  Para1\nPara2  "), "Para1\n\nPara2", "Leading/trailing whitespace trimmed before paragraph joining");
    assertEqual(formatPlainTextEmailBody("Para1\r\nPara2"), "Para1\n\nPara2", "Windows CRLF to double newline");
    assertEqual(formatPlainTextEmailBody("Para1\rPara2"), "Para1\n\nPara2", "Old Mac CR to double newline");
    assertEqual(formatPlainTextEmailBody("Para1"), "Para1", "Single paragraph unchanged");
    assertEqual(formatPlainTextEmailBody(""), "", "Empty string unchanged");
    assertEqual(formatPlainTextEmailBody(null), "", "Null input returns empty string");
    assertEqual(formatPlainTextEmailBody(undefined), "", "Undefined input returns empty string");
    assertEqual(formatPlainTextEmailBody("Para1\n\nPara2\nPara3\n\n\nPara4"), "Para1\n\nPara2\n\nPara3\n\nPara4", "Mixed newlines normalized");
    assertEqual(formatPlainTextEmailBody("\n\nPara1\nPara2\n\n"), "Para1\n\nPara2", "Leading/trailing newlines (resulting in empty paragraphs) removed");
    
    teardownTestMocks();
}

// --- Test Cases ---

function test_getLeadInteractionHistory_NoHistory() {
  Logger.log("\nRunning test_getLeadInteractionHistory_NoHistory...");
  setupTestMocks();
  var leadId = "LID_NoHistory"; var email = "nohistory@example.com";
  var testSpreadsheetId = CONFIG.SPREADSHEET_ID; // Use mocked CONFIG

  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
    ["Lead ID", "Email", "First Name", "Status"], [leadId, email, "NoHistoryLead", STATUS.PENDING]
  ]);
  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [
    ["Timestamp", "Lead ID", "Action", "Details"] // Only headers
  ]);
  MockGmailApp._clearMockData(); // Ensure no threads

  var history = getLeadInteractionHistory(leadId, email); // Test the real function
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("No significant prior interaction found") || history.includes("Current Lead Status: " + STATUS.PENDING), "Summary should indicate no history or only status.");
  var logsSectionPresent = history.includes("Recent Logs:");
  var noLogsMessagePresent = history.includes("No specific logs found for this Lead ID.");
  assertTrue(!logsSectionPresent || noLogsMessagePresent, "Should not list 'Recent Logs:' section if no logs, or indicate none found.");
  var gmailSectionPresent = history.includes("Last Email in Thread");
  var noGmailMessagePresent = history.includes("No recent threads found with this email.");
  assertTrue(!gmailSectionPresent || noGmailMessagePresent, "Should not list 'Last Email in Thread' if none, or indicate none found.");

  teardownTestMocks();
}

function test_getLeadInteractionHistory_LogsOnly() {
  Logger.log("\nRunning test_getLeadInteractionHistory_LogsOnly...");
  setupTestMocks();
  var leadId = "LID_LogsOnly"; var email = "logsonly@example.com";
  var testSpreadsheetId = CONFIG.SPREADSHEET_ID;

  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
    ["Lead ID", "Email", "First Name", "Status"], [leadId, email, "LogsOnlyLead", STATUS.SENT]
  ]);
  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [
    ["Timestamp", "Lead ID", "Action", "Details"],
    [new Date(2023, 1, 1).toISOString(), leadId, "Test Action 1", "Details for log 1"],
    [new Date(2023, 1, 2).toISOString(), leadId, "Test Action 2", "Details for log 2"]
  ]);
  MockGmailApp._clearMockData();

  var history = getLeadInteractionHistory(leadId, email);
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("Test Action 1"), "Should include log action 1");
  assertTrue(history.includes("Details for log 2"), "Should include details for log 2");
  var gmailSectionPresent = history.includes("Last Email in Thread");
  var noGmailMessagePresent = history.includes("No recent threads found with this email.");
  assertTrue(!gmailSectionPresent || noGmailMessagePresent, "Should not include Gmail history or indicate none found.");

  teardownTestMocks();
}

function test_getLeadInteractionHistory_GmailOnly() {
  Logger.log("\nRunning test_getLeadInteractionHistory_GmailOnly...");
  setupTestMocks();
  var leadId = "LID_GmailOnly"; var email = "gmailonly@example.com";
  var testSpreadsheetId = CONFIG.SPREADSHEET_ID;

  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
    ["Lead ID", "Email", "First Name", "Status"], [leadId, email, "GmailOnlyLead", "Contacted"]
  ]);
  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [
    ["Timestamp", "Lead ID", "Action", "Details"]
  ]);
  MockGmailApp._addMockThread({
      messages: [
          { body: "Reply from prospect.", date: new Date(2023,2,2), from: email },
          { body: "My email to them.", date: new Date(2023,2,1), from: "me@example.com" }
      ],
      queryMatcher: function(q) { return q.includes(email); }
  });
  
  var history = getLeadInteractionHistory(leadId, email);
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("Reply from prospect."), "Should include Gmail snippet");
  assertTrue(history.includes("My email to them."), "Should include second Gmail snippet");
  var logsSectionPresent = history.includes("Recent Logs:");
  var noLogsMessagePresent = history.includes("No specific logs found for this Lead ID.");
  assertTrue(!logsSectionPresent || noLogsMessagePresent, "Should not list detailed logs or indicate none found.");
  
  teardownTestMocks();
}

function test_getLeadInteractionHistory_FullHistory() {
  Logger.log("\nRunning test_getLeadInteractionHistory_FullHistory...");
  setupTestMocks();
  var leadId = "LID_FullHistory"; var email = "fullhistory@example.com";
  var testSpreadsheetId = CONFIG.SPREADSHEET_ID;

  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
    ["Lead ID", "Email", "First Name", "Status"], [leadId, email, "FullHistoryLead", STATUS.HOT]
  ]);
  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [
    ["Timestamp", "Lead ID", "Action", "Details"],
    [new Date(2023, 3, 1).toISOString(), leadId, "Log Action 1", "Detail A " + "long detail ".repeat(10)],
    [new Date(2023, 3, 2).toISOString(), leadId, "Log Action 2", "Detail B"],
    [new Date(2023, 3, 3).toISOString(), leadId, "Log Action 3", "Detail C"],
    [new Date(2023, 3, 4).toISOString(), leadId, "Log Action 4", "Detail D (should not appear)"]
  ]);
  MockGmailApp._addMockThread({
    messages: [
        { body: "Latest email from prospect " + "long body ".repeat(10), date: new Date(2023,3,5), from: email },
        { body: "My previous email to them.", date: new Date(2023,3,4), from: "me@example.com" },
        { body: "Even earlier email (should not appear).", date: new Date(2023,3,3), from: email }
    ],
    queryMatcher: function(q) { return q.includes(email); }
  });
  
  var history = getLeadInteractionHistory(leadId, email); 
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("Log Action 1"), "Should include log 1");
  assertTrue(history.includes("Log Action 3"), "Should include log 3");
  assertTrue(!history.includes("Log Action 4"), "Should NOT include log 4 (limit 3 logs in function)");
  assertTrue(history.includes("Latest email from prospect"), "Should include first Gmail snippet");
  assertTrue(history.includes("My previous email to them"), "Should include second Gmail snippet");
  assertTrue(!history.includes("Even earlier email"), "Should NOT include third Gmail snippet (limit 2 emails in function)");
  
  var expectedLogDetail = ("Detail A " + "long detail ".repeat(10)).substring(0,70) + "...";
  assertTrue(history.includes(expectedLogDetail), "Log detail should be truncated. Expected: ..." + expectedLogDetail.slice(-20));
  
  var expectedGmailBody = ("Latest email from prospect " + "long body ".repeat(10)).substring(0,100) + "...";
  assertTrue(history.includes(expectedGmailBody), "Gmail body should be truncated. Expected: ..." + expectedGmailBody.slice(-20));

  teardownTestMocks();
}

function test_processReplies_UsesHistoryForAIClassification() {
    Logger.log("\nRunning test_processReplies_UsesHistoryForAIClassification...");
    setupTestMocks();

    var leadId = "LID_ProcessHistory"; var leadEmail = "processhistory@example.com"; var leadFirstName = "ProcessHist";
    var mockReplyBody = "Yes, I'm interested. Tell me more.";
    var interactionHistorySummaryTestString = "Test interaction history: Previously discussed X, Y, Z.";
    var MAX_HISTORY_LENGTH_FOR_TEST = 2000; 
    var testSpreadsheetId = CONFIG.SPREADSHEET_ID;
    var serviceName = "Specific Service";
    var mockCalendlyLink = "https://calendly.com/specific-service-test";

    CONFIG.AI_SERVICES_PROFILE = { 
        [serviceName]: { calendlyLink: mockCalendlyLink, description: "Test Service Desc" }, 
        "Generic Inquiry": { calendlyLink: CONFIG.CALENDLY_LINK || "default_cal_link" } 
    };
    CONFIG.CALENDLY_LINK = CONFIG.CALENDLY_LINK || "default_test_calendly_link";
    CONFIG.YOUR_NAME = CONFIG.YOUR_NAME || "TestBot";
    CONFIG.EMAIL_FOOTER = CONFIG.EMAIL_FOOTER || "Reply STOP to unsubscribe";


    MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
        ["Lead ID", "Email", "First Name", "Status", "Last Service", "Phone"],
        [leadId, leadEmail, leadFirstName, STATUS.SENT, "Initial Service", "123456789"]
    ]);
    MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [["Timestamp", "Lead ID", "Action", "Details"]]);

    MockGmailApp._addMockThread({
        messages: [{ body: mockReplyBody, from: leadEmail, date: new Date(), isUnread: true }],
        queryMatcher: function(q) { return q.includes("is:unread"); }
    });
     MockGmailApp._addMockThread({ 
        messages: [{ body: mockReplyBody, from: leadEmail, date: new Date() }],
        queryMatcher: function(q) { return q.includes(leadEmail); }
    });


    var receivedHistoryForClassification = null; var receivedHistoryForFollowUp = null;
    var sendEmailCalledArgs = null; var sendPRAlertCalledArgs = null;

    var mockGetLeadInteractionHistory = mockFunction(this, 'getLeadInteractionHistory', function(id, emailArg) {
        return interactionHistorySummaryTestString; 
    });
    var mockClassifyProspectReply = mockFunction(this, 'classifyProspectReply', function(reply, name, history) {
        receivedHistoryForClassification = history; 
        return { identified_services: [serviceName], key_concerns: ["Concern A"], summary_of_need: "Needs Specific Service", sentiment: "positive", classification_confidence: 0.9 };
    });
    var mockRawAIBody = "This is the raw AI body.\nIt might have single newlines.";
    var mockGenerateAIContextualFollowUp = mockFunction(this, 'generateAIContextualFollowUp', function(classifiedData, name, yourName, serviceProfile, history) {
        receivedHistoryForFollowUp = history; 
        return mockRawAIBody; // Return a raw body that formatPlainTextEmailBody will process
    });
    
    // Capture the arguments to sendEmail
    var mockSendEmail = mockFunction(this, 'sendEmail', function(to, subject, body, id) {
      if (to === leadEmail) { // Only capture emails sent to the prospect for this test
        sendEmailCalledArgs = {to,subject,body,id};
      }
      return true; 
    });
    var mockSendPRAlert = mockFunction(this, 'sendPRAlert', function(fn, svc, em, ph, type, id) { sendPRAlertCalledArgs = {fn, svc, em, ph, type, id}; });
    
    // Use REAL formatPlainTextEmailBody and truncateString for this test, assuming they are in Utilities.js
    var originalFormatEmailBody = this.formatPlainTextEmailBody; // Store original if it's global
    var originalTruncateString = this.truncateString;
    this.formatPlainTextEmailBody = (typeof formatPlainTextEmailBody === 'function') ? formatPlainTextEmailBody : function(raw) {return raw.replace(/\n/g, '\n\n');}; // Fallback if not global
    this.truncateString = (typeof truncateString === 'function') ? truncateString : function(str) {return str;};


    if (typeof processReplies === 'function') {
        processReplies(); 
    } else {
        Logger.log("ERROR: processReplies function not found globally for test_processReplies_UsesHistoryForAIClassification.");
        assertTrue(false, "processReplies function not found globally.");
    }

    var truncatedExpectedHistory = this.truncateString(interactionHistorySummaryTestString, MAX_HISTORY_LENGTH_FOR_TEST, " [History truncated]");
    assertEqual(receivedHistoryForClassification, truncatedExpectedHistory, "classifyProspectReply should receive the (potentially truncated) history string.");
    assertEqual(receivedHistoryForFollowUp, truncatedExpectedHistory, "generateAIContextualFollowUp should receive the (potentially truncated) history string.");
    
    assertNotNull(sendEmailCalledArgs, "sendEmail should have been called for the prospect.");
    if(sendEmailCalledArgs) {
      assertEqual(sendEmailCalledArgs.to, leadEmail, "sendEmail TO address check");
      var expectedFormattedAIBody = formatPlainTextEmailBody(mockRawAIBody);
      var expectedCalendlySentence = "Here’s the link to book a meeting: " + mockCalendlyLink;
      var expectedFullBody = expectedFormattedAIBody + "\n\n" + expectedCalendlySentence + "\n\n" + CONFIG.EMAIL_FOOTER;
      assertEqual(sendEmailCalledArgs.body, expectedFullBody, "Email body structure (AI body + Calendly + Footer) is correct.");
      assertTrue(sendEmailCalledArgs.body.endsWith("\n\n" + CONFIG.EMAIL_FOOTER), "Email body should end with correctly spaced footer.");
    }
    
    assertNotNull(sendPRAlertCalledArgs, "sendPRAlert should have been called.");
    if(sendPRAlertCalledArgs) assertEqual(sendPRAlertCalledArgs.em, leadEmail, "sendPRAlert email check");

    var lastSetValue = MockSpreadsheetApp._getLastSetValue(testSpreadsheetId, LEADS_SHEET_NAME);
    assertNotNull(lastSetValue, "Sheet status should have been updated");
    if (lastSetValue) assertEqual(lastSetValue.value, STATUS.HOT, "Lead status should be updated to HOT");

    // Restore mocks
    mockGetLeadInteractionHistory.restore();
    mockClassifyProspectReply.restore();
    mockGenerateAIContextualFollowUp.restore();
    mockSendEmail.restore();
    mockSendPRAlert.restore();
    if (originalFormatEmailBody) this.formatPlainTextEmailBody = originalFormatEmailBody; // Restore if was global
    if (originalTruncateString) this.truncateString = originalTruncateString;

    teardownTestMocks();
}

// --- Main Test Runner Invocation ---
// This will call the test runner from the previous version of the file, plus the new one.
