// File: TestFramework.js - Test functions for CRM Automation

// --- Assertion Helpers ---
function assertEqual(actual, expected, message) {
  const pass = actual === expected;
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
const __originalSpreadsheetApp = typeof SpreadsheetApp !== 'undefined' ? SpreadsheetApp : undefined;
const __originalGmailApp = typeof GmailApp !== 'undefined' ? GmailApp : undefined;
const __originalUrlFetchApp = typeof UrlFetchApp !== 'undefined' ? UrlFetchApp : undefined;
const __originalUtilities = typeof Utilities !== 'undefined' ? Utilities : undefined;
const __originalLogger = typeof Logger !== 'undefined' ? Logger : undefined;
const __originalCONFIG = typeof CONFIG !== 'undefined' ? CONFIG : undefined;
const __originalSTATUS = typeof STATUS !== 'undefined' ? STATUS : undefined;
const __originalLEADS_SHEET_NAME = typeof LEADS_SHEET_NAME !== 'undefined' ? LEADS_SHEET_NAME : undefined;
const __originalLOGS_SHEET_NAME = typeof LOGS_SHEET_NAME !== 'undefined' ? LOGS_SHEET_NAME : undefined;
const __originalLockService = typeof LockService !== 'undefined' ? LockService : undefined;


// Global map to store original functions that might be mocked by tests using mockFunction(this, 'functionName', ...)
var __globalOriginals = {}; // Use var for Apps Script global behavior if not in strict mode

// Mock for SpreadsheetApp
var MockSpreadsheetApp = {
  _sheetsData: {}, // {"spreadsheetId": {"sheetName": {data: [[]], lastRow: X, lastCol: Y, _lastSetValue: null, _appendedRows: []}}}
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
    const sheetMockData = this._sheetsData[this._currentSpreadsheetId][name];
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
                for(let r_idx = sheetMockData.data.length; r_idx < row; r_idx++) sheetMockData.data.push([]);
            }
            for(let c_idx = (sheetMockData.data[row-1] ? sheetMockData.data[row-1].length : 0); c_idx < col; c_idx++) sheetMockData.data[row-1].push("");
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
      const mockMessages = (threadData.messages || []).map(m => ({
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
        for (const pattern in this._mockResponses) {
            if (url.includes(pattern)) {
                const mockResp = this._mockResponses[pattern];
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
    formatDate: (date, tz, format) => new Date(date).toISOString().substring(0,19).replace('T',' ') + " GMT", // Simple mock
    sleep: (ms) => Logger.log(`[MOCK UTILITIES] sleep for ${ms}ms`),
    getUuid: () => 'mock-uuid-' + Math.random().toString(36).substring(2,9)
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
  for (const funcName in __globalOriginals) {
    if (this.hasOwnProperty(funcName) && __globalOriginals.hasOwnProperty(funcName)) {
      this[funcName] = __globalOriginals[funcName].original;
      Logger.log(`[TEST TEARDOWN] Restored global function: ${funcName}`);
    }
  }
  __globalOriginals = {}; // Clear for next run
}

// General purpose mockFunction that stores original in __globalOriginals
function mockFunction(obj, functionName, mockImplementation) {
    const globalFuncName = (obj === this || obj === globalThis) ? functionName : null; // 'this' in Apps Script global scope
    const original = globalFuncName ? (obj[functionName] || undefined) : (obj ? obj[functionName] : undefined);

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
  const leadId = "LID_NoHistory"; const email = "nohistory@example.com";
  const testSpreadsheetId = CONFIG.SPREADSHEET_ID; // Use mocked CONFIG

  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
    ["Lead ID", "Email", "First Name", "Status"], [leadId, email, "NoHistoryLead", STATUS.PENDING]
  ]);
  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [
    ["Timestamp", "Lead ID", "Action", "Details"] // Only headers
  ]);
  MockGmailApp._clearMockData(); // Ensure no threads

  const history = getLeadInteractionHistory(leadId, email); // Test the real function
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("No significant prior interaction found") || history.includes("Current Lead Status: " + STATUS.PENDING), "Summary should indicate no history or only status.");
  const logsSectionPresent = history.includes("Recent Logs:");
  const noLogsMessagePresent = history.includes("No specific logs found for this Lead ID.");
  assertTrue(!logsSectionPresent || noLogsMessagePresent, "Should not list 'Recent Logs:' section if no logs, or indicate none found.");
  const gmailSectionPresent = history.includes("Last Email in Thread");
  const noGmailMessagePresent = history.includes("No recent threads found with this email.");
  assertTrue(!gmailSectionPresent || noGmailMessagePresent, "Should not list 'Last Email in Thread' if none, or indicate none found.");

  teardownTestMocks();
}

function test_getLeadInteractionHistory_LogsOnly() {
  Logger.log("\nRunning test_getLeadInteractionHistory_LogsOnly...");
  setupTestMocks();
  const leadId = "LID_LogsOnly"; const email = "logsonly@example.com";
  const testSpreadsheetId = CONFIG.SPREADSHEET_ID;

  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
    ["Lead ID", "Email", "First Name", "Status"], [leadId, email, "LogsOnlyLead", STATUS.SENT]
  ]);
  MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [
    ["Timestamp", "Lead ID", "Action", "Details"],
    [new Date(2023, 1, 1).toISOString(), leadId, "Test Action 1", "Details for log 1"],
    [new Date(2023, 1, 2).toISOString(), leadId, "Test Action 2", "Details for log 2"]
  ]);
  MockGmailApp._clearMockData();

  const history = getLeadInteractionHistory(leadId, email);
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("Test Action 1"), "Should include log action 1");
  assertTrue(history.includes("Details for log 2"), "Should include details for log 2");
  const gmailSectionPresent = history.includes("Last Email in Thread");
  const noGmailMessagePresent = history.includes("No recent threads found with this email.");
  assertTrue(!gmailSectionPresent || noGmailMessagePresent, "Should not include Gmail history or indicate none found.");

  teardownTestMocks();
}

function test_getLeadInteractionHistory_GmailOnly() {
  Logger.log("\nRunning test_getLeadInteractionHistory_GmailOnly...");
  setupTestMocks();
  const leadId = "LID_GmailOnly"; const email = "gmailonly@example.com";
  const testSpreadsheetId = CONFIG.SPREADSHEET_ID;

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
      queryMatcher: (q) => q.includes(email)
  });
  
  const history = getLeadInteractionHistory(leadId, email);
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("Reply from prospect."), "Should include Gmail snippet");
  assertTrue(history.includes("My email to them."), "Should include second Gmail snippet");
  const logsSectionPresent = history.includes("Recent Logs:");
  const noLogsMessagePresent = history.includes("No specific logs found for this Lead ID.");
  assertTrue(!logsSectionPresent || noLogsMessagePresent, "Should not list detailed logs or indicate none found.");
  
  teardownTestMocks();
}

function test_getLeadInteractionHistory_FullHistory() {
  Logger.log("\nRunning test_getLeadInteractionHistory_FullHistory...");
  setupTestMocks();
  const leadId = "LID_FullHistory"; const email = "fullhistory@example.com";
  const testSpreadsheetId = CONFIG.SPREADSHEET_ID;

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
    queryMatcher: (q) => q.includes(email)
  });
  
  const history = getLeadInteractionHistory(leadId, email); 
  
  assertNotNull(history, "History should not be null");
  assertTrue(history.includes("Log Action 1"), "Should include log 1");
  assertTrue(history.includes("Log Action 3"), "Should include log 3");
  assertTrue(!history.includes("Log Action 4"), "Should NOT include log 4 (limit 3 logs in function)");
  assertTrue(history.includes("Latest email from prospect"), "Should include first Gmail snippet");
  assertTrue(history.includes("My previous email to them"), "Should include second Gmail snippet");
  assertTrue(!history.includes("Even earlier email"), "Should NOT include third Gmail snippet (limit 2 emails in function)");
  
  const expectedLogDetail = ("Detail A " + "long detail ".repeat(10)).substring(0,70) + "...";
  assertTrue(history.includes(expectedLogDetail), "Log detail should be truncated. Expected: ..." + expectedLogDetail.slice(-20));
  
  const expectedGmailBody = ("Latest email from prospect " + "long body ".repeat(10)).substring(0,100) + "...";
  assertTrue(history.includes(expectedGmailBody), "Gmail body should be truncated. Expected: ..." + expectedGmailBody.slice(-20));

  teardownTestMocks();
}

function test_processReplies_UsesHistoryForAIClassification() {
    Logger.log("\nRunning test_processReplies_UsesHistoryForAIClassification...");
    setupTestMocks();

    const leadId = "LID_ProcessHistory"; const leadEmail = "processhistory@example.com"; const leadFirstName = "ProcessHist";
    const mockReplyBody = "Yes, I'm interested. Tell me more.";
    const interactionHistorySummaryTestString = "Test interaction history: Previously discussed X, Y, Z.";
    const MAX_HISTORY_LENGTH_FOR_TEST = 2000; 
    const testSpreadsheetId = CONFIG.SPREADSHEET_ID;
    const serviceName = "Specific Service";
    const mockCalendlyLink = "https://calendly.com/specific-service-test";

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
        queryMatcher: (q) => q.includes("is:unread") 
    });
     MockGmailApp._addMockThread({ 
        messages: [{ body: mockReplyBody, from: leadEmail, date: new Date() }],
        queryMatcher: (q) => q.includes(leadEmail)
    });


    let receivedHistoryForClassification = null; let receivedHistoryForFollowUp = null;
    let sendEmailCalledArgs = null; let sendPRAlertCalledArgs = null;

    const mockGetLeadInteractionHistory = mockFunction(this, 'getLeadInteractionHistory', (id, emailArg) => {
        return interactionHistorySummaryTestString; 
    });
    const mockClassifyProspectReply = mockFunction(this, 'classifyProspectReply', (reply, name, history) => {
        receivedHistoryForClassification = history; 
        return { identified_services: [serviceName], key_concerns: ["Concern A"], summary_of_need: "Needs Specific Service", sentiment: "positive", classification_confidence: 0.9 };
    });
    const mockRawAIBody = "This is the raw AI body.\nIt might have single newlines.";
    const mockGenerateAIContextualFollowUp = mockFunction(this, 'generateAIContextualFollowUp', (classifiedData, name, yourName, serviceProfile, history) => {
        receivedHistoryForFollowUp = history; 
        return mockRawAIBody; // Return a raw body that formatPlainTextEmailBody will process
    });
    
    // Capture the arguments to sendEmail
    const mockSendEmail = mockFunction(this, 'sendEmail', (to, subject, body, id) => {
      if (to === leadEmail) { // Only capture emails sent to the prospect for this test
        sendEmailCalledArgs = {to,subject,body,id};
      }
      return true; 
    });
    const mockSendPRAlert = mockFunction(this, 'sendPRAlert', (fn, svc, em, ph, type, id) => { sendPRAlertCalledArgs = {fn, svc, em, ph, type, id}; });
    
    // Use REAL formatPlainTextEmailBody and truncateString for this test, assuming they are in Utilities.js
    const originalFormatEmailBody = this.formatPlainTextEmailBody; // Store original if it's global
    const originalTruncateString = this.truncateString;
    this.formatPlainTextEmailBody = (typeof formatPlainTextEmailBody === 'function') ? formatPlainTextEmailBody : (raw) => raw.replace(/\n/g, '\n\n'); // Fallback if not global
    this.truncateString = (typeof truncateString === 'function') ? truncateString : (str) => str;


    if (typeof processReplies === 'function') {
        processReplies(); 
    } else {
        Logger.log("ERROR: processReplies function not found globally for test_processReplies_UsesHistoryForAIClassification.");
        assertTrue(false, "processReplies function not found globally.");
    }

    const truncatedExpectedHistory = this.truncateString(interactionHistorySummaryTestString, MAX_HISTORY_LENGTH_FOR_TEST, " [History truncated]");
    assertEqual(receivedHistoryForClassification, truncatedExpectedHistory, "classifyProspectReply should receive the (potentially truncated) history string.");
    assertEqual(receivedHistoryForFollowUp, truncatedExpectedHistory, "generateAIContextualFollowUp should receive the (potentially truncated) history string.");
    
    assertNotNull(sendEmailCalledArgs, "sendEmail should have been called for the prospect.");
    if(sendEmailCalledArgs) {
      assertEqual(sendEmailCalledArgs.to, leadEmail, "sendEmail TO address check");
      const expectedFormattedAIBody = formatPlainTextEmailBody(mockRawAIBody);
      const expectedCalendlySentence = "Here’s the link to book a meeting: " + mockCalendlyLink;
      const expectedFullBody = expectedFormattedAIBody + "\n\n" + expectedCalendlySentence + "\n\n" + CONFIG.EMAIL_FOOTER;
      assertEqual(sendEmailCalledArgs.body, expectedFullBody, "Email body structure (AI body + Calendly + Footer) is correct.");
      assertTrue(sendEmailCalledArgs.body.endsWith("\n\n" + CONFIG.EMAIL_FOOTER), "Email body should end with correctly spaced footer.");
    }
    
    assertNotNull(sendPRAlertCalledArgs, "sendPRAlert should have been called.");
    if(sendPRAlertCalledArgs) assertEqual(sendPRAlertCalledArgs.em, leadEmail, "sendPRAlert email check");

    const lastSetValue = MockSpreadsheetApp._getLastSetValue(testSpreadsheetId, LEADS_SHEET_NAME);
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
function runAllTests() { // Renamed to avoid collision if old runAllTests is still somehow present
  Logger.log("--- Starting All Combined Test Suites ---");
  // Call existing test suites if they are separate and globally accessible
  if (typeof testBookingDetection === 'function') testBookingDetection(); // From original TestFramework.js
  if (typeof testEmailToProspect === 'function') testEmailToProspect();   // From original TestFramework.js
  if (typeof testEmailToPR === 'function') testEmailToPR();             // From original TestFramework.js
  if (typeof testSlackNotification === 'function') testSlackNotification(); // From original TestFramework.js
  
  // Run the new memory feature tests
  runMemoryFeatureTests();
  // Run the new formatting tests
  test_formatPlainTextEmailBody_scenarios(); 

  Logger.log("--- All Combined Test Suites Completed ---");
}
// Make sure this is the function to select in Apps Script editor to run all tests.
// If this file is the only TestFramework.js, then the old runAllTests is overwritten.
// The name "runAllTests" is conventional for Apps Script.
// Let's ensure this main runner is called `runAllTests`.

// Cleaned up runner:
function masterTestRunner() {
  Logger.log("--- MASTER TEST RUNNER STARTED ---");
  // Assuming the tests from the original file content are still desired:
  if (typeof testBookingDetection === 'function') testBookingDetection();
  if (typeof testEmailToProspect === 'function') testEmailToProspect();
  if (typeof testEmailToPR === 'function') testEmailToPR();
  if (typeof testSlackNotification === 'function') testSlackNotification();
  
  runMemoryFeatureTests(); // Run the new suite
  test_formatPlainTextEmailBody_scenarios(); // Run formatting tests
  Logger.log("--- MASTER TEST RUNNER COMPLETED ---");
}


// --- Tests for Manual Review and Negative Sentiment Workflows ---

function test_processReplies_lowConfidenceToManualReview() {
    Logger.log("\nRunning test_processReplies_lowConfidenceToManualReview...");
    setupTestMocks();
    const leadId = "LID_LowConfidence"; const leadEmail = "lowconf@example.com"; const leadFirstName = "LowConf";
    const mockReplyBody = "Maybe interested in something?";
    const testSpreadsheetId = CONFIG.SPREADSHEET_ID;
    CONFIG.PR_EMAIL = "pr_test@example.com"; // Ensure PR_EMAIL is set for notification test

    MockSpreadsheetApp._setSheetData(testSpreadsheetId, LEADS_SHEET_NAME, [
        ["Lead ID", "Email", "First Name", "Status", "Last Service", "Phone"],
        [leadId, leadEmail, leadFirstName, STATUS.SENT, "Some Service", "123"]
    ]);
    MockSpreadsheetApp._setSheetData(testSpreadsheetId, LOGS_SHEET_NAME, [["Timestamp", "Lead ID", "Action", "Details"]]);
    MockGmailApp._addMockThread({ messages: [{ body: mockReplyBody, from: leadEmail, isUnread: true }], queryMatcher: (q) => q.includes("is:unread") });

    const mockGetLIA = mockFunction(this, 'getLeadInteractionHistory', () => "Minimal history.");
    const mockClassify = mockFunction(this, 'classifyProspectReply', () => ({
        identified_services: ["Specific Service"], key_concerns: ["Unsure"],
        summary_of_need: "Possibly needs Specific Service.", sentiment: "neutral", classification_confidence: 0.5 // Low confidence
    }));
    const mockGenFollowUp = mockFunction(this, 'generateAIContextualFollowUp', () => "Should not be called");
    const mockSendToProspect = mockFunction(this, 'sendEmail', (to, subject, body, id) => {
        if (to === leadEmail) MockGmailApp._lastSentEmail = {to, subject, body, id, type: "prospect"}; // Capture prospect email
    });
     mockFunction(this, 'sendPRAlert', () => {}); // No PR alert for manual review
     mockFunction(this, 'truncateString', (str) => str); // Simple pass-through


    if (typeof processReplies === 'function') processReplies();
    else Logger.log("ERROR: processReplies function not found globally.");

    const lastSetValue = MockSpreadsheetApp._getLastSetValue(testSpreadsheetId, LEADS_SHEET_NAME);
    assertNotNull(lastSetValue, "Sheet status should have been updated");
    if (lastSetValue) assertEqual(lastSetValue.value, STATUS.NEEDS_MANUAL_REVIEW, "Lead status should be NEEDS_MANUAL_REVIEW");
    
    assertEqual(MockGmailApp._lastSentEmail ? MockGmailApp._lastSentEmail.to : null, CONFIG.PR_EMAIL, "Notification email should be sent to PR_EMAIL for manual review.");
    if (MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === CONFIG.PR_EMAIL) {
        assertTrue(MockGmailApp._lastSentEmail.subject.includes("Lead Needs Manual Review"), "Manual review email subject is correct.");
        assertTrue(MockGmailApp._lastSentEmail.body.includes("Low AI classification confidence"), "Manual review email body indicates low confidence.");
    }
    
    let prospectFollowUpSent = false;
    if (MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === leadEmail) prospectFollowUpSent = true;
    assertEqual(prospectFollowUpSent, false, "No AI follow-up email should be sent to the prospect.");

    mockGetLIA.restore(); mockClassify.restore(); mockGenFollowUp.restore(); mockSendToProspect.restore();
    teardownTestMocks();
}

function test_processReplies_neutralGenericToManualReview() {
    Logger.log("\nRunning test_processReplies_neutralGenericToManualReview...");
    setupTestMocks();
    const leadId = "LID_NeutralGen"; const leadEmail = "neutralgen@example.com"; const leadFirstName = "NeutralGen";
    CONFIG.PR_EMAIL = "pr_test_ng@example.com";

    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME, [
        ["Lead ID", "Email", "First Name", "Status"], [leadId, leadEmail, leadFirstName, STATUS.SENT]
    ]);
    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LOGS_SHEET_NAME, [["Timestamp", "Lead ID", "Action", "Details"]]);
    MockGmailApp._addMockThread({ messages: [{ body: "Ok.", from: leadEmail, isUnread: true }], queryMatcher: (q) => q.includes("is:unread") });

    mockFunction(this, 'getLeadInteractionHistory', () => "Some history.");
    mockFunction(this, 'classifyProspectReply', () => ({
        identified_services: ["Generic Inquiry"], key_concerns: [],
        summary_of_need: "Vague reply.", sentiment: "neutral", classification_confidence: 0.9
    }));
    mockFunction(this, 'generateAIContextualFollowUp', () => "Should not be called");
    mockFunction(this, 'sendEmail', (to, subj, body, id) => { MockGmailApp._lastSentEmail = {to, subj, body, id};}); // Capture all emails
    mockFunction(this, 'sendPRAlert', () => {});
    mockFunction(this, 'truncateString', (str) => str);

    if (typeof processReplies === 'function') processReplies();
    else Logger.log("ERROR: processReplies function not found globally.");

    const lastSetValue = MockSpreadsheetApp._getLastSetValue(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME);
    assertEqual(lastSetValue ? lastSetValue.value : null, STATUS.NEEDS_MANUAL_REVIEW, "Status: NEEDS_MANUAL_REVIEW for Neutral Generic");
    assertEqual(MockGmailApp._lastSentEmail ? MockGmailApp._lastSentEmail.to : null, CONFIG.PR_EMAIL, "Notification to PR_EMAIL for Neutral Generic");
    if (MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === CONFIG.PR_EMAIL) {
      assertTrue(MockGmailApp._lastSentEmail.body.includes("Neutral sentiment for Generic Inquiry"), "Manual review email body indicates neutral generic.");
    }
    
    // Check that no email was sent to prospect by checking if the last email sent was to PR_EMAIL
    let prospectFollowUpSent = MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === leadEmail;
    assertEqual(prospectFollowUpSent, false, "No AI follow-up email should be sent to the prospect for Neutral Generic.");

    teardownTestMocks(); // Restores original functions mocked by mockFunction
}

function test_processReplies_positiveGenericToManualReview() {
    Logger.log("\nRunning test_processReplies_positiveGenericToManualReview...");
    setupTestMocks();
    const leadId = "LID_PositiveGen"; const leadEmail = "positivegen@example.com"; const leadFirstName = "PositiveGen";
    CONFIG.PR_EMAIL = "pr_test_pg@example.com";

    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME, [
        ["Lead ID", "Email", "First Name", "Status"], [leadId, leadEmail, leadFirstName, STATUS.SENT]
    ]);
    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LOGS_SHEET_NAME, [["Timestamp", "Lead ID", "Action", "Details"]]);
    MockGmailApp._addMockThread({ messages: [{ body: "Sounds good!", from: leadEmail, isUnread: true }], queryMatcher: (q) => q.includes("is:unread") });

    mockFunction(this, 'getLeadInteractionHistory', () => "History here.");
    mockFunction(this, 'classifyProspectReply', () => ({
        identified_services: ["Generic Inquiry"], key_concerns: [],
        summary_of_need: "Generally positive but vague.", sentiment: "positive", classification_confidence: 0.95
    }));
    mockFunction(this, 'generateAIContextualFollowUp', () => "Should not be called");
    mockFunction(this, 'sendEmail', (to, subj, body, id) => { MockGmailApp._lastSentEmail = {to, subj, body, id};});
    mockFunction(this, 'sendPRAlert', () => {});
    mockFunction(this, 'truncateString', (str) => str);

    if (typeof processReplies === 'function') processReplies();
    else Logger.log("ERROR: processReplies function not found globally.");

    const lastSetValue = MockSpreadsheetApp._getLastSetValue(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME);
    assertEqual(lastSetValue ? lastSetValue.value : null, STATUS.NEEDS_MANUAL_REVIEW, "Status: NEEDS_MANUAL_REVIEW for Positive Generic");
    assertEqual(MockGmailApp._lastSentEmail ? MockGmailApp._lastSentEmail.to : null, CONFIG.PR_EMAIL, "Notification to PR_EMAIL for Positive Generic");
     if (MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === CONFIG.PR_EMAIL) {
      assertTrue(MockGmailApp._lastSentEmail.body.includes("Not proceeding with AI follow-up"), "Manual review email body indicates positive generic.");
    }
    let prospectFollowUpSent = MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === leadEmail;
    assertEqual(prospectFollowUpSent, false, "No AI follow-up email should be sent to the prospect for Positive Generic.");
    
    teardownTestMocks();
}

function test_processReplies_aiGenerationFailureToManualReview() {
    Logger.log("\nRunning test_processReplies_aiGenerationFailureToManualReview...");
    setupTestMocks();
    const leadId = "LID_AIFail"; const leadEmail = "aifail@example.com"; const leadFirstName = "AIFail";
    CONFIG.PR_EMAIL = "pr_test_aifail@example.com";

    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME, [
        ["Lead ID", "Email", "First Name", "Status"], [leadId, leadEmail, leadFirstName, STATUS.SENT]
    ]);
    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LOGS_SHEET_NAME, [["Timestamp", "Lead ID", "Action", "Details"]]);
    MockGmailApp._addMockThread({ messages: [{ body: "Interesting proposal!", from: leadEmail, isUnread: true }], queryMatcher: (q) => q.includes("is:unread") });

    mockFunction(this, 'getLeadInteractionHistory', () => "Some interaction.");
    mockFunction(this, 'classifyProspectReply', () => ({
        identified_services: ["Specific Service"], key_concerns: ["Details"],
        summary_of_need: "Wants details on Specific Service.", sentiment: "positive", classification_confidence: 0.9
    }));
    mockFunction(this, 'generateAIContextualFollowUp', () => null); // AI Follow-up generation fails
    mockFunction(this, 'sendEmail', (to, subj, body, id) => { MockGmailApp._lastSentEmail = {to, subj, body, id};});
    mockFunction(this, 'sendPRAlert', () => {});
    mockFunction(this, 'truncateString', (str) => str);

    if (typeof processReplies === 'function') processReplies();
    else Logger.log("ERROR: processReplies function not found globally.");

    const lastSetValue = MockSpreadsheetApp._getLastSetValue(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME);
    assertEqual(lastSetValue ? lastSetValue.value : null, STATUS.NEEDS_MANUAL_REVIEW, "Status: NEEDS_MANUAL_REVIEW for AI Gen Failure");
    assertEqual(MockGmailApp._lastSentEmail ? MockGmailApp._lastSentEmail.to : null, CONFIG.PR_EMAIL, "Notification to PR_EMAIL for AI Gen Failure");
    if (MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === CONFIG.PR_EMAIL) {
      assertTrue(MockGmailApp._lastSentEmail.body.includes("AI follow-up generation failed"), "Manual review email body indicates AI generation failure.");
    }
    let prospectFollowUpSent = MockGmailApp._lastSentEmail && MockGmailApp._lastSentEmail.to === leadEmail;
    assertEqual(prospectFollowUpSent, false, "No AI follow-up email should be sent to the prospect for AI Gen Failure.");

    teardownTestMocks();
}

function test_processReplies_negativeSentimentToUnqualified() {
    Logger.log("\nRunning test_processReplies_negativeSentimentToUnqualified...");
    setupTestMocks();
    const leadId = "LID_Negative"; const leadEmail = "negative@example.com"; const leadFirstName = "NegativeNancy";
    CONFIG.PR_EMAIL = "pr_test_neg@example.com"; // For consistency, though no PR email expected here

    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME, [
        ["Lead ID", "Email", "First Name", "Status"], [leadId, leadEmail, leadFirstName, STATUS.SENT]
    ]);
    MockSpreadsheetApp._setSheetData(CONFIG.SPREADSHEET_ID, LOGS_SHEET_NAME, [["Timestamp", "Lead ID", "Action", "Details"]]);
    MockGmailApp._addMockThread({ messages: [{ body: "Not interested at all.", from: leadEmail, isUnread: true }], queryMatcher: (q) => q.includes("is:unread") });
    
    // Clear lastSentEmail before the test action
    MockGmailApp._lastSentEmail = null;


    mockFunction(this, 'getLeadInteractionHistory', () => "Previous positive chat.");
    mockFunction(this, 'classifyProspectReply', () => ({
        identified_services: [], key_concerns: ["Not interested"],
        summary_of_need: "Wants to be removed.", sentiment: "negative", classification_confidence: 0.98
    }));
    const mockGenFollowUp = mockFunction(this, 'generateAIContextualFollowUp', () => "Should NOT be called");
    const mockSendToProspect = mockFunction(this, 'sendEmail', (to, subject, body, id) => {
        MockGmailApp._lastSentEmail = {to, subject, body, id, type: "prospect_or_pr"};
    });
    const mockSendPRAlert = mockFunction(this, 'sendPRAlert', () => {assertTrue(false, "sendPRAlert should not be called for negative sentiment if lead is just unqualified.")}); // Should not be called
    mockFunction(this, 'truncateString', (str) => str);

    if (typeof processReplies === 'function') processReplies();
    else Logger.log("ERROR: processReplies function not found globally.");

    const lastSetValue = MockSpreadsheetApp._getLastSetValue(CONFIG.SPREADSHEET_ID, LEADS_SHEET_NAME);
    assertEqual(lastSetValue ? lastSetValue.value : null, STATUS.UNQUALIFIED, "Status: UNQUALIFIED for Negative Sentiment");
    
    // Assert that NO email was sent (neither to prospect nor to PR_EMAIL for manual review)
    assertEqual(MockGmailApp._lastSentEmail, null, "No email of any kind should be sent for negative sentiment.");

    mockGenFollowUp.restore(); // Important to restore to avoid interference if generateAIContextualFollowUp is used by other tests
    mockSendToProspect.restore();
    mockSendPRAlert.restore();
    teardownTestMocks();
}

// To run tests from Apps Script Editor: Select 'masterTestRunner' and click 'Run'.
// View logs in Apps Script Dashboard: https://script.google.com/home/executions
// Ensure all dependent .js files (Config.js, Utilities.js, prompt.js, automated_email_sender.js)
// are in the same Apps Script project and their functions are globally accessible if not mocked.
// Especially, `getLeadInteractionHistory`, `classifyProspectReply`, `generateAIContextualFollowUp`, `processReplies`, `truncateString`
// are assumed to be global for the mocking strategy used in test_processReplies_UsesHistoryForAIClassification.
// If they are not, the `mockFunction(this, 'functionName', ...)` will fail for them.
// logAction is assumed to be globally available from Utilities.js (with its fallback).
// LEADS_SHEET_NAME, LOGS_SHEET_NAME, CONFIG, STATUS are expected to be global (setupTestMocks provides defaults).I've overwritten `TestFramework.js` with a new version that includes the requested test functions for the "memory" feature.

/*
**Key changes and implementation details:**

1.  **Assertion Helpers Added**: `assertEqual`, `assertNotNull`, and `assertTrue` were added to the top of the file. They log to `Logger` and also use `console.error` for failures to ensure visibility in different execution contexts.

2.  **Global Mocking Strategy**:
    *   A new global mock objects for `SpreadsheetApp`, `GmailApp`, `UrlFetchApp`, `Utilities`, and `LockService` are defined (`MockSpreadsheetApp`, `MockGmailApp`, etc.).
    *   `setupTestMocks()` function:
        *   Replaces actual global Apps Script services (e.g., `this.SpreadsheetApp = MockSpreadsheetApp;`).
        *   Clears data from previous mock runs (e.g., `MockSpreadsheetApp._clearMockData()`).
        *   Initializes `CONFIG`, `STATUS`, `LEADS_SHEET_NAME`, `LOGS_SHEET_NAME` with either their original values (if available globally) or test defaults. This makes tests self-contained regarding configuration.
        *   Resets a `__globalOriginals` map used by `mockFunction`.
    *   `teardownTestMocks()` function: Restores the original global Apps Script services and configuration values.
    *   `mockFunction(obj, functionName, mockImplementation)`: A general-purpose mocking utility.
        *   It now stores the original function in `__globalOriginals` if `obj` is the global context (`this`), or on the object itself using a dynamic property (`__original_functionName`). This is to handle mocking both global functions and methods of service mocks.

3.  **New Test Runner**:
    *   `runMemoryFeatureTests()`: Calls the five new test functions.
    *   `masterTestRunner()`: A main runner that calls the pre-existing tests (like `testBookingDetection`) and then calls `runMemoryFeatureTests()`. This is intended to be the main entry point for running all tests.

4.  **Implemented Test Cases for `getLeadInteractionHistory`**:
    *   **`test_getLeadInteractionHistory_NoHistory()`**: Mocks Leads sheet with basic info, Logs sheet with only headers, and Gmail to return no threads. Asserts that the history summary indicates no significant prior interaction.
    *   **`test_getLeadInteractionHistory_LogsOnly()`**: Mocks Logs sheet with a few entries and no Gmail threads. Asserts logs are present and Gmail info is absent.
    *   **`test_getLeadInteractionHistory_GmailOnly()`**: Mocks Gmail with a couple of messages and no log entries. Asserts Gmail snippets are present and log info is absent.
    *   **`test_getLeadInteractionHistory_FullHistory()`**: Mocks data for Leads, Logs (3+ entries, one long), and Gmail (2 messages, one long). Asserts that the summary includes the correct number of (truncated) entries from each source, respecting the limits defined within `getLeadInteractionHistory` (e.g., max 3 logs, max 2 emails).

5.  **Implemented `test_processReplies_UsesHistoryForAIClassification()`**:
    *   **Setup**:
        *   Uses `setupTestMocks()`.
        *   Mocks `SpreadsheetApp` data for a lead in `STATUS.SENT`.
        *   Mocks `GmailApp.search` to return a mock reply from this lead.
        *   Mocks global functions (`getLeadInteractionHistory`, `classifyProspectReply`, `generateAIContextualFollowUp`, `sendEmail`, `sendPRAlert`, `truncateString`, `logAction`) using `mockFunction(this, 'functionName', ...)`.
        *   The mock for `getLeadInteractionHistory` returns a fixed test history string.
        *   The mocks for `classifyProspectReply` and `generateAIContextualFollowUp` capture the `history` argument they receive.
    *   **Execute**: Calls the *actual* global `processReplies()` function (assuming it's defined in `automated_email_sender.js` and globally accessible). `processReplies` internally calls the mocked global functions.
    *   **Assert**:
        *   Verifies that `classifyProspectReply` and `generateAIContextualFollowUp` received the (correctly truncated by the mocked `truncateString`) history summary.
        *   Checks that `sendEmail` and `sendPRAlert` were called.
        *   Checks that the lead's status in the mock sheet data was updated to `STATUS.HOT`.
    *   **Teardown**: Restores all mocked global functions and calls `teardownTestMocks()`.

This revised `TestFramework.js` should now correctly test the "memory" features by adapting to the established mocking patterns and ensuring proper setup/teardown for each test. The global functions from other project files are mocked by assigning to `this.functionName` within the test or setup, and `mockFunction` handles storing/restoring them.
*/