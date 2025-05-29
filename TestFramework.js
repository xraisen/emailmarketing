// TestFramework.js
// Helper functions for mocking and logging in tests for the $0 Cost Auto Email Sender project.

// Logs a test message with a standardized prefix
function logTestMessage(message) {
  Logger.log("[TEST] " + message);
}

// Mocks a global function, preserving the original and returning a restore function
function mockFunction(obj, functionName, mockImplementation) {
  if (typeof obj === 'undefined' || obj === null || typeof obj[functionName] === 'undefined') { // Added null check for obj
    logTestMessage("Warning: Object or function " + functionName + " not available to mock. Object: " + obj + ", FunctionName: " + functionName);
    if (!(obj === Logger && functionName === 'log')) {
        try { Logger.log("Detailed warning: Object for " + functionName + " is " + typeof obj + (obj ? ", keys: " + Object.keys(obj) : "")); } catch(e) {}
    }
    return { restore: function() { logTestMessage("Restore attempted for unmockable " + functionName + " - no action taken.");} };
  }
  const originalFunction = obj[functionName];
  obj[functionName] = mockImplementation;
  // Attempt to get a meaningful name for the object being mocked
  let objectName = 'UnknownObject';
  if (obj) {
    if (obj.name) objectName = obj.name;
    else if (obj.constructor && obj.constructor.name) objectName = obj.constructor.name;
    else if (typeof obj === 'function' && functionName === null) objectName = obj.name || 'UnnamedFunctionItself'; // If mocking the function itself
  }
  logTestMessage("Mocked " + functionName + " on object " + objectName);
  return {
    restore: function() {
      obj[functionName] = originalFunction;
      logTestMessage("Restored " + functionName + " on object " + objectName);
    }
  };
}

// Mocks GmailApp.sendEmail to capture arguments without sending actual emails
function mockGmailSendEmail(captureCallback) {
  return mockFunction(GmailApp, 'sendEmail', function(to, subject, body, options) {
    const args = { to: to, subject: subject, body: body, options: options };
    logTestMessage("MOCK GmailApp.sendEmail called with: " + JSON.stringify(args));
    if (captureCallback) captureCallback(args);
  });
}

// Mocks UrlFetchApp.fetch with custom behavior for specific URLs
function mockUrlFetchAppFetch(urlHandlers, defaultResponse) {
  return mockFunction(UrlFetchApp, 'fetch', function(url, params) {
    logTestMessage("MOCK UrlFetchApp.fetch called for URL: " + url);
    for (const handler of urlHandlers) {
      if (url.includes(handler.urlPattern)) {
        if (handler.callback) handler.callback(url, params);
        return {
          getResponseCode: function() { return handler.responseCode || 200; },
          getContentText: function() { return handler.contentText || "Mock response"; }
        };
      }
    }
    logTestMessage("MOCK UrlFetchApp.fetch called for unhandled URL (using default or fallback): " + url);
    if (defaultResponse && typeof defaultResponse === 'function') {
         return defaultResponse(url, params);
    }
    return {
      getResponseCode: function() { return 404; },
      getContentText: function() { return "Mock: URL not found and no default handler."; }
    };
  });
}

// Mocks Utilities.formatDate to return a fixed formatted time
function mockUtilitiesFormatDate(mockFormattedTime) {
  return mockFunction(Utilities, 'formatDate', function(date, tz, format) {
    logTestMessage("MOCK Utilities.formatDate called with date: " + date + ", tz: " + tz + ", format: " + format + ". Returning: " + mockFormattedTime);
    return mockFormattedTime;
  });
}

// Temporarily sets a CONFIG value and returns a function to restore it
function withTempConfig(configKey, tempValue) {
  const originalValue = CONFIG[configKey];
  CONFIG[configKey] = tempValue;
  logTestMessage("Set CONFIG." + configKey + " to: " + tempValue + " (Original: " + originalValue + ")");
  return function restoreConfig() {
    CONFIG[configKey] = originalValue;
    logTestMessage("Restored CONFIG." + configKey + " to: " + originalValue);
  };
}

// --- Test Functions Start Here ---

function testBookingDetection() {
    logTestMessage("Starting testBookingDetection...");

    // --- CONFIGURATION & MOCK DATA ---
    const mockLead = { 
        firstName: "TestJohn", 
        email: "john.test.booking@example.com", 
        status: STATUS.PENDING, 
        lastService: "Test Service", 
        phone: "1234567890",
        leadId: "TEST_BOOK_001"
    };

    const mockCalendlyEventPayload = {
        "event": "invitee.created",
        "payload": {
            "email": mockLead.email, 
            "name": mockLead.firstName + " TestDoe", 
            "scheduled_event": { "start_time": "2025-05-30T10:00:00Z" },
            "uri": "https://api.calendly.com/scheduled_events/EVENT_UUID/invitees/INVITEE_UUID"
        }
    };

    // --- SPREADSHEET ACCESS ---
    logTestMessage("Accessing Spreadsheet...");
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); 
    var leadsSheet = ss.getSheetByName(LEADS_SHEET_NAME);    
    if (!leadsSheet) {
        logTestMessage("ERROR: 'Leads' sheet not found. Aborting test.");
        return;
    }
    var headers = leadsSheet.getRange(1, 1, 1, leadsSheet.getLastColumn()).getValues()[0];
    var columnIndexMap = getColumnIndexMap(headers); 

    // --- LEAD SETUP ---
    logTestMessage("Setting up test lead: " + mockLead.email);
    var testLeadRowNumber = -1;
    var data = leadsSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) { 
        if (data[i][columnIndexMap['Email']] === mockLead.email) {
            testLeadRowNumber = i + 1;
            logTestMessage("Lead found at row " + testLeadRowNumber + ". Ensuring status is PENDING.");
            leadsSheet.getRange(testLeadRowNumber, columnIndexMap['Status'] + 1).setValue(STATUS.PENDING);
            break;
        }
    }
    if (testLeadRowNumber === -1) {
        var newRowData = headers.map(function(header) {
            switch(header) {
                case 'First Name': return mockLead.firstName;
                case 'Email': return mockLead.email;
                case 'Status': return mockLead.status;
                case 'Last Service': return mockLead.lastService;
                case 'Phone': return mockLead.phone;
                case 'Lead ID': return mockLead.leadId;
                default: return ""; 
            }
        });
        leadsSheet.appendRow(newRowData);
        testLeadRowNumber = leadsSheet.getLastRow();
        logTestMessage("Appended mock lead '" + mockLead.email + "' at row " + testLeadRowNumber);
    }
    SpreadsheetApp.flush(); 

    // --- MOCKING EXTERNAL FUNCTIONS ---
    logTestMessage("Setting up mocks for external functions...");
    var mockCreateCalendarEventCalledWith = null;
    var mockSendPRAlertCalledWith = null;

    // In Apps Script, global functions are properties of the global 'this' object.
    // It's important that createCalendarEvent and sendPRAlert are defined globally in their respective .js files.
    const createCalendarEventMock = mockFunction(this, 'createCalendarEvent', function(...args) { 
        mockCreateCalendarEventCalledWith = args; 
        logTestMessage('MOCK createCalendarEvent called with: ' + JSON.stringify(args)); 
    });

    const sendPRAlertMock = mockFunction(this, 'sendPRAlert', function(...args) { 
        mockSendPRAlertCalledWith = args; 
        logTestMessage('MOCK sendPRAlert called with: ' + JSON.stringify(args)); 
    });
    
    // --- CONSTRUCT MOCK EVENT & EXECUTE doPost ---
    var mockEvent = { 
        postData: { contents: JSON.stringify(mockCalendlyEventPayload) }, 
        headers: { 'calendly-webhook-signature': 'test-signature-dummy' } 
    };
    logTestMessage("Calling doPost(mockEvent)...");
    var doPostResponseText = "N/A";
    try {
        var rawResponse = doPost(mockEvent); 
        if (rawResponse && typeof rawResponse.getContent === 'function') {
            doPostResponseText = rawResponse.getContent();
        }
        logTestMessage("doPost response: " + doPostResponseText);
    } catch(e) {
        logTestMessage("ERROR calling doPost: " + e.toString() + " Stack: " + (e.stack ? e.stack : "N/A"));
    }

    // --- VERIFICATION ---
    logTestMessage("Verifying lead status...");
    SpreadsheetApp.flush(); 
    var updatedStatus = leadsSheet.getRange(testLeadRowNumber, columnIndexMap['Status'] + 1).getValue();
    logTestMessage("Expected status: " + STATUS.BOOKED + ". Actual status: " + updatedStatus);
    if (updatedStatus === STATUS.BOOKED) {
        logTestMessage("SUCCESS: testBookingDetection passed. Lead status updated to BOOKED.");
    } else {
        logTestMessage("FAILURE: testBookingDetection failed. Status was '" + updatedStatus + "', expected '" + STATUS.BOOKED + "'.");
    }
    logTestMessage("Mock createCalendarEvent was called with: " + JSON.stringify(mockCreateCalendarEventCalledWith));
    logTestMessage("Mock sendPRAlert was called with: " + JSON.stringify(mockSendPRAlertCalledWith));

    // --- TEARDOWN (Restore Mocks) ---
    logTestMessage("Restoring original functions...");
    if (createCalendarEventMock) createCalendarEventMock.restore();
    if (sendPRAlertMock) sendPRAlertMock.restore();
    
    logTestMessage("testBookingDetection finished.");
}

// Placeholder for other test functions (testEmailToProspect, testEmailToPR, testSlackNotification)
// These would also need to be refactored to use the helper functions if they exist.
// For now, this subtask focuses only on testBookingDetection.
// If those functions were indeed added in previous steps, they should be here.
// Assuming they are not present based on prior read_files outputs for TestFramework.js.

function testEmailToProspect() {
    logTestMessage("Starting testEmailToProspect...");

    const mockLead = { 
        firstName: "TestJane", 
        email: "jane.prospect.test@example.com", 
        lastService: "SEO Audit",
        leadId: "TEST_PROSPECT_001" 
    };
    const mockAiResponseText = "Hi TestJane, interested in a free SEO Audit? Let's discuss. Reply STOP to unsubscribe";
    const expectedSubject = "Free Audit for " + mockLead.lastService;
    var capturedEmailArgs = null;
    var geminiApiCalled = false;
    
    const gmailMock = mockGmailSendEmail(args => capturedEmailArgs = args);
    const urlFetchMock = mockUrlFetchAppFetch(
        [{ 
            urlPattern: "generativelanguage.googleapis.com", 
            callback: () => geminiApiCalled = true,
            contentText: JSON.stringify({ candidates: [{ content: { parts: [{ text: mockAiResponseText }] } }] })
        }],
        (url, params) => { // Default handler for un-intercepted URLs
            logTestMessage("Unhandled UrlFetchApp.fetch call in testEmailToProspect: " + url);
            return { getResponseCode: function() { return 404; }, getContentText: function() { return "Mock: URL not specifically handled in test."; }};
        }
    );

    logTestMessage("Executing email generation and sending logic...");
    var aiContent = null;
    try {
        aiContent = getAIEmailContent(mockLead.firstName, mockLead.lastService, getInitialEmailPrompt); 
    } catch (e) {
        logTestMessage("ERROR during getAIEmailContent: " + e.toString());
    }
    
    if (aiContent) {
        logTestMessage("AI content generated: " + aiContent);
        try {
            sendEmail(mockLead.email, expectedSubject, aiContent, mockLead.leadId);
        } catch (e) {
            logTestMessage("ERROR during sendEmail: " + e.toString());
        }
    } else {
        logTestMessage("Skipped calling sendEmail because AI content was null.");
    }

    var testPassed = true;
    if (!geminiApiCalled) {
        logTestMessage("FAILURE: Gemini API (UrlFetchApp) was not called as expected.");
        testPassed = false;
    } else {
        logTestMessage("SUCCESS: Gemini API (UrlFetchApp) was called.");
    }

    if (!capturedEmailArgs) {
        logTestMessage("FAILURE: GmailApp.sendEmail was not called.");
        testPassed = false;
    } else {
        if (capturedEmailArgs.to !== mockLead.email) {
            logTestMessage("FAILURE: Email recipient mismatch. Expected: " + mockLead.email + ", Got: " + capturedEmailArgs.to);
            testPassed = false;
        } else { logTestMessage("SUCCESS: Email recipient matches."); }
        if (capturedEmailArgs.subject !== expectedSubject) {
            logTestMessage("FAILURE: Email subject mismatch. Expected: '" + expectedSubject + "', Got: '" + capturedEmailArgs.subject + "'");
            testPassed = false;
        } else { logTestMessage("SUCCESS: Email subject matches."); }
        if (capturedEmailArgs.body !== mockAiResponseText) {
            logTestMessage("FAILURE: Email body mismatch. Expected: '" + mockAiResponseText + "', Got: '" + capturedEmailArgs.body + "'");
            testPassed = false;
        } else { logTestMessage("SUCCESS: Email body matches mock AI response."); }
    }

    if(testPassed) { logTestMessage("Overall SUCCESS: testEmailToProspect passed."); } 
    else { logTestMessage("Overall FAILURE: testEmailToProspect failed."); }

    gmailMock.restore();
    urlFetchMock.restore();
    logTestMessage("testEmailToProspect finished.");
}

function testEmailToPR() {
    logTestMessage("Starting testEmailToPR...");

    const mockLeadData = { 
        firstName: "TestBooker", 
        lastService: "Premium Package",
        leadEmail: "booker.test@example.com",
        leadPhone: "0987654321",
        bookingTime: "2025-06-15T14:30:00Z", 
        leadId: "TEST_PR_002"
    };
    const expectedPrEmailRecipient = "test@example.com"; // As per user spec for verification
    const mockFormattedTime = "2025-06-15 10:30 MOCK_TZ"; 
    
    var capturedPrEmailArgs = null;
    var slackApiCalled = false; // To check if UrlFetchApp for Slack was called
    // var formatDateCalled = false; // Removed as per earlier refactoring; mockUtilitiesFormatDate logs its call

    // Use withTempConfig to set PR_EMAIL for this test
    const restorePrEmailConfig = withTempConfig('PR_EMAIL', expectedPrEmailRecipient);

    // --- MOCKING ---
    logTestMessage("Setting up mocks (with temp CONFIG.PR_EMAIL set to: " + CONFIG.PR_EMAIL + ")");
    const gmailMock = mockGmailSendEmail(args => capturedPrEmailArgs = args);
    const urlFetchMock = mockUrlFetchAppFetch(
        [{ urlPattern: "hooks.slack.com", callback: () => slackApiCalled = true, contentText: "ok" }],
        (url, params) => { 
            logTestMessage("Unhandled UrlFetchApp.fetch call in testEmailToPR: " + url);
            return { getResponseCode: function() { return 404; }, getContentText: function() { return "Mock: URL not handled."; }};
        }
    );
    const formatDateMock = mockUtilitiesFormatDate(mockFormattedTime);

    // --- EXECUTION ---
    logTestMessage("Executing sendPRAlert logic...");
    try {
        sendPRAlert(
            mockLeadData.firstName, 
            mockLeadData.lastService, 
            mockLeadData.leadEmail, 
            mockLeadData.leadPhone, 
            mockLeadData.bookingTime, 
            mockLeadData.leadId
        );
    } catch (e) {
        logTestMessage("ERROR during sendPRAlert execution: " + e.toString() + " Stack: " + (e.stack || 'N/A'));
    }

    // --- VERIFICATION ---
    logTestMessage("Verifying PR email parameters...");
    var testPassed = true;

    // Explicitly check if CONFIG.PR_EMAIL was correctly set by withTempConfig during the call
    // This is an internal check of the test setup itself.
    // The actual recipient check is done on capturedPrEmailArgs.to
    if (CONFIG.PR_EMAIL !== expectedPrEmailRecipient) {
        logTestMessage("CRITICAL TEST SETUP FLAW: CONFIG.PR_EMAIL was '" + CONFIG.PR_EMAIL + "' during sendPRAlert execution, not the expected temporary value of '" + expectedPrEmailRecipient + "'. The withTempConfig might not have worked as expected or was restored prematurely.");
        // This would be a fundamental issue with the test's premise if it occurred.
    }


    if (!capturedPrEmailArgs) {
        logTestMessage("FAILURE: GmailApp.sendEmail was not called for PR alert.");
        testPassed = false;
    } else {
        if (capturedPrEmailArgs.to !== expectedPrEmailRecipient) {
            // This check is now against the temporarily set expectedPrEmailRecipient
            logTestMessage("FAILURE: PR Email recipient mismatch. Expected (and temp CONFIG.PR_EMAIL): '" + expectedPrEmailRecipient + "', Got: '" + capturedPrEmailArgs.to + "'");
            testPassed = false;
        } else {
            logTestMessage("SUCCESS: PR Email recipient matches expected temporary value '" + expectedPrEmailRecipient + "'.");
        }

        const expectedPrSubject = "NEW CALL - " + mockLeadData.firstName;
        if (capturedPrEmailArgs.subject !== expectedPrSubject) {
            logTestMessage("FAILURE: PR Email subject mismatch. Expected: '" + expectedPrSubject + "', Got: '" + capturedPrEmailArgs.subject + "'");
            testPassed = false;
        } else {
            logTestMessage("SUCCESS: PR Email subject matches.");
        }

        const expectedPrBody = "Service: " + mockLeadData.lastService + "\nTime: " + mockFormattedTime + "\nContact: " + mockLeadData.leadEmail + " | " + mockLeadData.leadPhone;
        if (capturedPrEmailArgs.body !== expectedPrBody) {
            logTestMessage("FAILURE: PR Email body mismatch. Expected: \n'" + expectedPrBody + "'\nGot: \n'" + capturedPrEmailArgs.body + "'");
            testPassed = false;
        } else {
            logTestMessage("SUCCESS: PR Email body matches.");
        }
    }
    
    if (CONFIG.SLACK_WEBHOOK_URL && CONFIG.SLACK_WEBHOOK_URL !== 'YOUR_SLACK_WEBHOOK_URL_PLACEHOLDER_IF_ANY' && !slackApiCalled && urlFetchMock) {
        // Check if originalUrlFetchAppFetch was defined before assuming it was mockable
        logTestMessage("INFO: Slack API (UrlFetchApp) was not called for PR alert. This is acceptable if Slack is not configured or if this test is email-only focused for sendPRAlert's email part.");
    }


    if(testPassed) {
        logTestMessage("Overall SUCCESS: testEmailToPR passed.");
    } else {
        logTestMessage("Overall FAILURE: testEmailToPR failed. See logs above for details.");
    }

    // --- TEARDOWN (Restore Mocks & Config) ---
    logTestMessage("Restoring original functions and CONFIG values...");
    if(gmailMock) gmailMock.restore();
    if(urlFetchMock) urlFetchMock.restore();
    if(formatDateMock) formatDateMock.restore();
    
    restorePrEmailConfig(); // Restore CONFIG.PR_EMAIL

    logTestMessage("testEmailToPR finished.");
}


function testSlackNotification() {
    logTestMessage("Starting testSlackNotification...");
    const mockLeadData = { 
        firstName: "TestSlacker", 
        lastService: "Ultimate Plan",
        leadEmail: "slacker.test@example.com",
        leadPhone: "5555555555",
        bookingTime: "2025-07-04T16:00:00Z", 
        leadId: "TEST_SLACK_003"
    };
    const expectedTestSlackWebhookUrl = "https://hooks.slack.com/services/test/webhook";
    const mockFormattedTime = "2025-07-04 12:00 MOCK_TZ";
    var capturedSlackCallArgs = null;
    var emailApiCalled = false; // To check if GmailApp.sendEmail was called
    var formatDateCalled = false; // To check if Utilities.formatDate was called by the mock

    const restoreConfigSlackUrl = withTempConfig('SLACK_WEBHOOK_URL', expectedTestSlackWebhookUrl);
    
    const gmailMock = mockGmailSendEmail(() => emailApiCalled = true);
    const urlFetchMock = mockUrlFetchAppFetch(
      [{ 
          urlPattern: expectedTestSlackWebhookUrl, 
          callback: (url, params) => capturedSlackCallArgs = { url: url, params: params },
          contentText: "ok" 
      }],
      (url, params) => { // Default handler
          logTestMessage("Unhandled UrlFetchApp.fetch call in testSlackNotification: " + url);
          return { getResponseCode: function() { return 404; }, getContentText: function() { return "Mock: URL not handled."; }};
      }
    );
    // For Utilities.formatDate, we want to ensure our mock is called.
    // The mockUtilitiesFormatDate helper already logs when its mock implementation is called.
    const formatDateMock = mockUtilitiesFormatDate(mockFormattedTime);
    // formatDateCalled flag is removed as we rely on the helper's logging.


    try {
        sendPRAlert(mockLeadData.firstName, mockLeadData.lastService, mockLeadData.leadEmail, mockLeadData.leadPhone, mockLeadData.bookingTime, mockLeadData.leadId);
    } catch (e) {
        logTestMessage("ERROR during sendPRAlert for Slack test: " + e.toString() + " Stack: " + (e.stack || 'N/A'));
    }

    var testPassed = true;
    if (!capturedSlackCallArgs) {
        logTestMessage("FAILURE: UrlFetchApp.fetch not called for Slack with URL: " + expectedTestSlackWebhookUrl);
        testPassed = false;
    } else {
        if (capturedSlackCallArgs.url !== expectedTestSlackWebhookUrl) {
            logTestMessage("FAILURE: Slack Webhook URL. Expected: '" + expectedTestSlackWebhookUrl + "', Got: '" + capturedSlackCallArgs.url + "'");
            testPassed = false;
        } else { logTestMessage("SUCCESS: Slack Webhook URL matches."); }
        const expectedSlackText = "New Call Alert!\nLead: " + mockLeadData.firstName + "\nService: " + mockLeadData.lastService + "\nTime: " + mockFormattedTime + "\nContact: " + mockLeadData.leadEmail + " | " + mockLeadData.leadPhone;
        try {
            const payloadObject = JSON.parse(capturedSlackCallArgs.params.payload);
            if (payloadObject.text !== expectedSlackText) {
                logTestMessage("FAILURE: Slack message text. Expected: \n'" + expectedSlackText + "'\nGot: \n'" + payloadObject.text + "'");
                testPassed = false;
            } else { logTestMessage("SUCCESS: Slack message text matches."); }
        } catch (ex) {
            logTestMessage("FAILURE: Could not parse Slack payload: " + ex.toString() + "; Payload: " + capturedSlackCallArgs.params.payload);
            testPassed = false;
        }
    }
    // The check for formatDateCalled is removed. We rely on mockUtilitiesFormatDate helper's logging.
    // Example: logTestMessage("MOCK Utilities.formatDate called with date: [...] Returning: [...]");

    if(testPassed) { logTestMessage("Overall SUCCESS: testSlackNotification passed."); }
    else { logTestMessage("Overall FAILURE: testSlackNotification failed."); }

    gmailMock.restore();
    urlFetchMock.restore();
    if (formatDateMock) formatDateMock.restore(); // Restore using the helper's restore method
    restoreConfigSlackUrl();
    logTestMessage("testSlackNotification finished.");
}
