// File: automated_email_sender.gs - Main logic for email sending and reply processing.

/**
 * Generates email content using the Gemini API.
 *
 * @param {string} promptText The fully formed prompt text to send to the API.
 * @return {string|null} The AI-generated email content, or null if an error occurred.
 */
function getAIEmailContent(promptText) { // MODIFIED SIGNATURE
  // const promptText = promptFunction(firstName, lastService); // REMOVED
  const apiKey = CONFIG.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: promptText
      }]
    }]
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Important for handling API errors gracefully
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const jsonResponse = JSON.parse(responseBody);
      // Check for presence of candidates and nested properties before accessing
      if (jsonResponse &&
          jsonResponse.candidates &&
          jsonResponse.candidates.length > 0 &&
          jsonResponse.candidates[0].content &&
          jsonResponse.candidates[0].content.parts &&
          jsonResponse.candidates[0].content.parts.length > 0 &&
          jsonResponse.candidates[0].content.parts[0].text) {
        
        const aiText = jsonResponse.candidates[0].content.parts[0].text;
        logAction('GetAIEmailContent', null, null, 'Successfully retrieved AI content.', 'SUCCESS');
        return aiText;
      } else {
        // Log detailed error if the expected structure is not found
        const detail = `Gemini API response missing expected content structure. Response: ${responseBody.substring(0, 500)}`; // Log first 500 chars
        logAction('GetAIEmailContent', null, null, detail, 'ERROR');
        console.error(detail);
        return null;
      }
    } else {
      // Handle non-200 responses
      const errorDetails = `Gemini API Error: HTTP ${responseCode}. Response: ${responseBody.substring(0,500)}`;
      logAction('GetAIEmailContent', null, null, errorDetails, 'ERROR');
      console.error(errorDetails);
      return null;
    }
  } catch (e) {
    // Handle UrlFetchApp errors (network, etc.)
    const errorMessage = `Error calling Gemini API: ${e.message} ${e.stack}`;
    logAction('GetAIEmailContent', null, null, errorMessage, 'ERROR');
    console.error(errorMessage);
    return null;
  }
}

// In automated_email_sender.js
// (Make sure getContextualFollowUpPrompt from prompt.js is accessible)
// (Make sure getAIEmailContent is the modified version)
// (Make sure CONFIG is accessible for yourName if it's stored there, or pass it directly)

function generateAIContextualFollowUp(classifiedData, leadFirstName, yourName, serviceProfile, interactionHistorySummary) { // NEW signature
  try {
    // interactionHistorySummary can be null/empty, so no strict check needed for it here.
    if (!classifiedData || !leadFirstName || !yourName || !serviceProfile) {
      const errorMessage = `Missing one or more required arguments (excluding history) for generateAIContextualFollowUp. classifiedData: ${!!classifiedData}, leadFirstName: ${!!leadFirstName}, yourName: ${!!yourName}, serviceProfile: ${!!serviceProfile}`;
      logAction('GenerateAIFollowUpError', null, null, errorMessage, 'ERROR');
      console.error('GenerateAIFollowUpError: ' + errorMessage);
      return null;
    }

    const followUpPrompt = getContextualFollowUpPrompt(classifiedData, leadFirstName, yourName, serviceProfile, interactionHistorySummary); // NEW: Pass interactionHistorySummary
    logAction('GenerateAIFollowUpInfo', null, null, `Generated follow-up prompt: ${followUpPrompt.substring(0, 200)}...`, 'INFO');


    const emailBody = getAIEmailContent(followUpPrompt);

    if (!emailBody) {
      logAction('GenerateAIFollowUpError', null, null, 'Received null response from getAIEmailContent for follow-up email generation.', 'ERROR');
      console.error('GenerateAIFollowUpError: Received null response from getAIEmailContent for follow-up email generation.');
      return null;
    }

    logAction('GenerateAIFollowUpSuccess', null, null, `Successfully generated AI follow-up email body. Length: ${emailBody.length}`, 'SUCCESS');
    return emailBody;

  } catch (e) {
    const errorMessage = `Error in generateAIContextualFollowUp: ${e.message}. Stack: ${e.stack}`;
    logAction('GenerateAIFollowUpCritical', null, null, errorMessage, 'CRITICAL');
    console.error(errorMessage);
    return null;
  }
}

/**
 * Sends an email using GmailApp and logs the outcome.
 * Includes a delay to respect rate limits.
 *
 * @param {string} to The recipient's email address.
 * @param {string} subject The subject of the email.
 * @param {string} body The content of the email.
 * @param {string} leadId The ID of the lead this email is for (for logging).
 * @return {boolean} True if the email was sent successfully, false otherwise.
 */
function sendEmail(to, subject, body, leadId) {
  try {
    GmailApp.sendEmail(to, subject, body);
    Utilities.sleep(2500); // Wait 2.5 seconds to respect rate limits

    logAction('SendEmailSuccess', leadId, to, 'Subject: ' + subject, 'SUCCESS');
    console.log(`Email sent successfully to: ${to}, Subject: ${subject}`);
    return true;
  } catch (error) {
    const errorMessage = `Error sending email: ${error.message}`;
    logAction('SendEmailError', leadId, to, errorMessage, 'ERROR');
    console.error(`Failed to send email to ${to}. Error: ${errorMessage}`);
    return false;
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
    map[columnName.trim()] = index; // Added trim() for robustness
  });
  return map; 
} 
/**
 * Processes a batch of leads from the 'Leads' sheet, sending initial emails.
 * Respects daily quotas and batch sizes defined in CONFIG.
 */
function dailyEmailBatch() {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { // Try to acquire lock for 10 seconds
    try {
      logAction('DailyBatchStart', null, null, 'Daily email batch process started with lock.', 'INFO');
      let emailsSentThisExecution = 0;

      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
    if (!sheet) {
      logAction('DailyBatchError', null, null, `Sheet '${LEADS_SHEET_NAME}' not found.`, 'ERROR');
      console.error(`Sheet '${LEADS_SHEET_NAME}' not found.`);
      return;
    }

    const dataRange = sheet.getDataRange();
    const allData = dataRange.getValues();
    const headers = allData[0];
    const leadDataRows = allData.slice(1);

    const colIdx = getColumnIndexMap(headers);

    // Verify essential columns exist
    const requiredColumns = ['First Name', 'Email', 'Last Service', 'Status', 'Lead ID', 'Last Contact'];
    for (const colName of requiredColumns) {
      if (colIdx[colName] === undefined) {
        logAction('DailyBatchError', null, null, `Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`, 'ERROR');
        console.error(`Required column '${colName}' not found in '${LEADS_SHEET_NAME}'.`);
        return;
      }
    }

    for (let i = 0; i < leadDataRows.length; i++) {
      const currentRow = leadDataRows[i];
      const actualSheetRow = i + 2; // +1 for header, +1 for 0-based to 1-based

      const firstName = currentRow[colIdx['First Name']];
      const email = currentRow[colIdx['Email']];
      const lastService = currentRow[colIdx['Last Service']];
      let currentStatus = currentRow[colIdx['Status']];
      let leadIdValue = currentRow[colIdx['Lead ID']];

      if (currentStatus === STATUS.PENDING) {
        if (emailsSentThisExecution < CONFIG.DAILY_EMAIL_QUOTA) {
          if (!isValidEmail(email)) {
            sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.INVALID_EMAIL);
            logAction('DailyBatchInvalidEmail', leadIdValue, email, 'Invalid email format.', 'ERROR');
            console.warn(`Invalid email for Lead ID ${leadIdValue || 'N/A'} at row ${actualSheetRow}: ${email}`);
            continue;
          }

          if (!leadIdValue) {
            leadIdValue = generateUUID();
            sheet.getRange(actualSheetRow, colIdx['Lead ID'] + 1).setValue(leadIdValue);
            logAction('DailyBatchLeadIDGenerated', leadIdValue, email, 'Generated new Lead ID.', 'INFO');
          }

          const initialPrompt = getInitialEmailPrompt(firstName, lastService); // Generate prompt first
          const aiContent = getAIEmailContent(initialPrompt); // Pass prompt text directly
          if (!aiContent) {
            logAction('DailyBatchAIError', leadIdValue, email, 'Failed to generate AI content for initial email.', 'ERROR');
            console.error(`AI content generation failed for Lead ID ${leadIdValue}, email: ${email}`);
            continue; 
          }

          const subject = `Free Audit for ${lastService}`; // Simple subject line

          if (sendEmail(email, subject, aiContent, leadIdValue)) {
            sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.SENT);
            sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
            emailsSentThisExecution++;
            logAction('DailyBatchEmailSent', leadIdValue, email, `Initial email sent. Subject: ${subject}`, 'SUCCESS');
          } else {
            // sendEmail logs its own errors, but we can log a specific batch context if needed
            logAction('DailyBatchSendFail', leadIdValue, email, 'Failed to send initial email via sendEmail function.', 'WARNING');
          }

          if (emailsSentThisExecution % CONFIG.EMAIL_BATCH_SIZE === 0) {
            SpreadsheetApp.flush(); // Persist changes in batches
            logAction('DailyBatchFlush', null, null, `Flushed spreadsheet changes after ${emailsSentThisExecution} emails.`, 'INFO');
          }

        } else {
          logAction('DailyBatchQuotaReached', null, null, `Daily email quota reached for this execution: ${emailsSentThisExecution}. Stopping batch.`, 'INFO');
          console.log(`Daily email quota (${CONFIG.DAILY_EMAIL_QUOTA}) reached.`);
          break; 
        }
      }
    }

    SpreadsheetApp.flush(); // Final flush to save any remaining changes
    logAction('DailyBatchEnd', null, null, `Daily email batch process finished. Emails sent in this run: ${emailsSentThisExecution}`, 'INFO');
    console.log(`Daily email batch finished. Total emails sent in this run: ${emailsSentThisExecution}`);

    } catch (e) { // This is the single, correct catch block for critical errors
      const errorMessage = `Error in dailyEmailBatch: ${e.message} ${e.stack ? ' Stack: ' + e.stack : ''}`;
      logAction('DailyBatchCriticalError', null, null, errorMessage, 'CRITICAL');
      console.error(errorMessage);
    } finally {
      lock.releaseLock();
      logAction('DailyBatchLockReleased', null, null, 'Lock released for dailyEmailBatch.', 'DEBUG');
    }
  } else {
    logAction('DailyBatchLockError', null, null, 'Could not obtain lock for dailyEmailBatch after 10 seconds. Batch run skipped.', 'ERROR');
    console.warn('Could not obtain lock for dailyEmailBatch. Batch run skipped.');
  }
}

/**
 * Processes unread email replies from leads.
 */
function processReplies() {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { // Try to acquire lock for 10 seconds
    try {
      logAction('ProcessRepliesStart', null, null, 'Hourly reply processing started with lock.', 'INFO');

      // Pre-computation/Setup
      const YOUR_NAME = "Jose"; // Or from a config
      const AI_SERVICE_PROFILE = CONFIG.AI_SERVICES_PROFILE;
      const DEFAULT_CALENDLY_LINK = CONFIG.CALENDLY_LINK;
      // const EMAIL_FOOTER_TEXT = CONFIG.EMAIL_FOOTER; // AI prompt handles this

      const threads = GmailApp.search('is:unread in:inbox -is:trash', 0, 50);

      if (!threads || threads.length === 0) {
        logAction('ProcessRepliesNoNew', null, null, 'No new unread threads found.', 'INFO');
        return;
      }

      const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
      if (!sheet) {
        logAction('ProcessRepliesError', null, null, `Sheet '${LEADS_SHEET_NAME}' not found.`, 'ERROR');
        console.error(`Sheet '${LEADS_SHEET_NAME}' not found.`);
        return;
      }

      const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIdx = getColumnIndexMap(headerRow);

      const requiredSheetColumns = ['Email', 'Status', 'Last Contact', 'Lead ID', 'First Name', 'Last Service', 'Phone'];
    for (const col of requiredSheetColumns) {
      if (colIdx[col] === undefined) {
        logAction('ProcessRepliesError', null, null, `Required column '${col}' not found in sheet for reply processing.`, 'ERROR');
        return;
      }
    }
    
    const leadDataRange = sheet.getRange(2, 1, sheet.getLastRow() > 1 ? sheet.getLastRow() - 1 : 1, sheet.getLastColumn());
    const leadDataRows = sheet.getLastRow() > 1 ? leadDataRange.getValues() : [];


    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const messages = thread.getMessages();
      if (messages.length === 0) continue;

      const lastMessage = messages[messages.length - 1];
      const fromHeader = lastMessage.getFrom();
      const emailMatch = fromHeader.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      
      if (!emailMatch || emailMatch.length === 0) {
        logAction('ProcessRepliesNoSender', null, null, 'Could not extract sender email from: ' + fromHeader + '. Subject: ' + lastMessage.getSubject(), 'WARNING');
        thread.markRead(); // Mark as read to avoid reprocessing
        continue;
      }
      const senderEmail = emailMatch[0].toLowerCase();
      const body = lastMessage.getPlainBody().toLowerCase();

      logAction('ProcessRepliesProcessing', null, senderEmail, 'Processing reply. Subject: ' + lastMessage.getSubject(), 'DEBUG');

      let leadFoundAndProcessed = false;
      for (let j = 0; j < leadDataRows.length; j++) {
        const leadRow = leadDataRows[j];
        const leadEmailInSheet = leadRow[colIdx['Email']];

        if (leadEmailInSheet && typeof leadEmailInSheet === 'string' && leadEmailInSheet.toLowerCase() === senderEmail) {
          const actualSheetRow = j + 2;
          const leadId = leadRow[colIdx['Lead ID']];
          const firstName = leadRow[colIdx['First Name']];
          const lastService = leadRow[colIdx['Last Service']];
          const phone = leadRow[colIdx['Phone']];
          const currentStatus = leadRow[colIdx['Status']];

          if (currentStatus === STATUS.SENT || currentStatus === STATUS.FOLLOW_UP_1) {
            // 1. Handle explicit opt-out first
            const lowerBody = body.toLowerCase(); // Ensure body is lowercased for opt-out checks
            if (lowerBody.includes('stop') || lowerBody.includes('unsubscribe') || lowerBody.includes('remove me')) {
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.UNQUALIFIED);
                sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
                logAction('ProcessRepliesOptOut', leadId, senderEmail, 'Lead opted out via reply.', 'SUCCESS');
                thread.markRead();
                SpreadsheetApp.flush();
                leadFoundAndProcessed = true;
                break; // from inner lead search loop
            }

            // 2. Attempt AI Classification
            // Pass original body (not lowercased) to AI if it might affect understanding, though prompts.js usually expects it to be handled
            // For this implementation, `body` was already lowercased earlier in the function.

            // New: Get Interaction History
            const interactionHistorySummaryRaw = getLeadInteractionHistory(leadId, senderEmail); // Assuming getLeadInteractionHistory is globally available from Utilities.js
            const MAX_HISTORY_LENGTH = 2000; // Define a constant or use a CONFIG value if preferred
            const interactionHistorySummary = truncateString(interactionHistorySummaryRaw, MAX_HISTORY_LENGTH, " [History truncated]"); // Use truncateString from Utilities.js

            logAction('ProcessRepliesHistory', leadId, senderEmail, `Retrieved interaction history (raw length: ${interactionHistorySummaryRaw ? interactionHistorySummaryRaw.length : 0}, truncated length: ${interactionHistorySummary ? interactionHistorySummary.length : 0}): ${interactionHistorySummary ? interactionHistorySummary.substring(0, 300) + "..." : "None"}`, 'INFO');

            // Modified: Call AI Classification with history (passing the truncated summary)
            const classifiedData = classifyProspectReply(body, firstName, interactionHistorySummary); 
            // The existing 'ProcessRepliesRawClassification' log will include the new sentiment field automatically.
            logAction('ProcessRepliesRawClassification', leadId, senderEmail, `Raw AI classification data: ${JSON.stringify(classifiedData)}`, 'INFO');

            const sentiment = classifiedData ? classifiedData.sentiment : null; // Get sentiment
            const confidence = classifiedData ? classifiedData.classification_confidence : null; // Get confidence
            logAction('ProcessRepliesSentiment', leadId, senderEmail, `AI Classified Sentiment: ${sentiment}`, 'INFO');
            logAction('ProcessRepliesConfidence', leadId, senderEmail, `AI Classification Confidence: ${confidence === null || confidence === undefined ? 'N/A' : confidence.toFixed(2)}`, 'INFO'); // New log

            // Handle negative sentiment explicitly first
            let sendManualReviewNotification = false; // Flag to control single notification
            let manualReviewReason = "";
            const LOW_CONFIDENCE_THRESHOLD = 0.70;

            if (sentiment === "negative") {
                logAction('ProcessRepliesNegativeSentiment', leadId, senderEmail, 'Negative sentiment detected by AI. Marking as UNQUALIFIED.', 'INFO');
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.UNQUALIFIED);
                sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
                // No AI follow-up email is sent.
            
            // New Manual Review Logic
            } else if (!classifiedData) {
                sendManualReviewNotification = true;
                manualReviewReason = "AI classification failed (classifiedData is null).";
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
            } else if (sentiment === "neutral" && classifiedData.identified_services && classifiedData.identified_services.length > 0 && classifiedData.identified_services[0] === "Generic Inquiry") {
                sendManualReviewNotification = true;
                manualReviewReason = `Neutral sentiment for Generic Inquiry. Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}. Summary: ${classifiedData.summary_of_need || 'N/A'}`;
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
            } else if (confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD) {
                sendManualReviewNotification = true;
                manualReviewReason = `Low AI classification confidence: ${confidence.toFixed(2)}. Services: ${(classifiedData.identified_services || []).join(', ')}. Summary: ${classifiedData.summary_of_need || 'N/A'}`;
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
            
            // Main AI Follow-up Path (Positive/Neutral sentiment, Specific Service, Sufficient Confidence)
            } else if (classifiedData.identified_services && classifiedData.identified_services.length > 0 && classifiedData.identified_services[0] !== "Generic Inquiry" && (sentiment === "positive" || sentiment === "neutral")) {
                // This implies confidence is sufficient or null (treated as sufficient if not low)
                logAction('ProcessRepliesAILogic', leadId, senderEmail, `Proceeding with AI follow-up. Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}`, 'INFO');
                // Modified: Call AI Follow-up Generation with history
                const aiFollowUpBodyRaw = generateAIContextualFollowUp(classifiedData, firstName, YOUR_NAME, AI_SERVICE_PROFILE, interactionHistorySummary);

                if (aiFollowUpBodyRaw) {
                    let chosenCalendlyLink = DEFAULT_CALENDLY_LINK;
                    const identifiedServices = classifiedData.identified_services; 

                    if (identifiedServices && identifiedServices.length > 0 && identifiedServices[0] !== "Generic Inquiry") {
                        if (identifiedServices.length === 1) {
                            const serviceName = identifiedServices[0];
                            if (AI_SERVICE_PROFILE[serviceName] && AI_SERVICE_PROFILE[serviceName].calendlyLink) {
                                chosenCalendlyLink = AI_SERVICE_PROFILE[serviceName].calendlyLink;
                                logAction('ProcessRepliesCalendly', leadId, senderEmail, `Single service identified: ${serviceName}. Using its specific link.`, 'INFO');
                            } else {
                                logAction('ProcessRepliesCalendly', leadId, senderEmail, `Single service: ${serviceName}, no specific link. Default.`, 'INFO');
                            }
                        } else { 
                            const servicePriority = ["Web Design & Development", "Google Ads Management", "GMC/Feed Management", "Funnels", "AI Automation", "Tech Strategy"];
                            let foundPriorityLink = false;
                            for (const priorityService of servicePriority) {
                                if (identifiedServices.includes(priorityService) && AI_SERVICE_PROFILE[priorityService] && AI_SERVICE_PROFILE[priorityService].calendlyLink) {
                                    chosenCalendlyLink = AI_SERVICE_PROFILE[priorityService].calendlyLink;
                                    logAction('ProcessRepliesCalendly', leadId, senderEmail, `Multiple services. Priority link for: ${priorityService}`, 'INFO');
                                    foundPriorityLink = true;
                                    break;
                                }
                            }
                            if (!foundPriorityLink) {
                                logAction('ProcessRepliesCalendly', leadId, senderEmail, 'Multiple services. No priority link found. Default.', 'INFO');
                            }
                        }
                    } else { 
                        logAction('ProcessRepliesCalendly', leadId, senderEmail, 'Generic/no specific service. Default Calendly link.', 'INFO');
                    }
                    
                    const formattedAIBody = formatPlainTextEmailBody(aiFollowUpBodyRaw); // Use the new utility
                    const calendlyLinkSentence = "Here’s the link to book a meeting: " + chosenCalendlyLink;
                    
                    // Construct final body: Formatted AI Body + Blank Line + Calendly Sentence + Blank Line + Footer
                    const finalAIFollowUpBody = formattedAIBody + "\n\n" + calendlyLinkSentence + "\n\n" + CONFIG.EMAIL_FOOTER;
                    
                    const subject = `Re: Your Inquiry - ${(classifiedData.identified_services.join(' & ') || "Following Up")}`;

                    if (sendEmail(senderEmail, subject, finalAIFollowUpBody, leadId)) {
                        sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.HOT);
                        sendPRAlert(firstName, classifiedData.identified_services.join(', '), senderEmail, phone, `HOT - AI Classified (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'})`, leadId); 
                        logAction('ProcessRepliesAIFollowUpSent', leadId, senderEmail, `AI Follow-up sent (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}). Classified: ${classifiedData.identified_services.join(', ')}. Subject: ${subject}`, 'SUCCESS');
                    } else {
                        logAction('ProcessRepliesAIFollowUpSendError', leadId, senderEmail, `Failed to send AI follow-up (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}).`, 'ERROR');
                    }
                } else { // AI Follow-up generation failed
                    sendManualReviewNotification = true; // Flag for manual review if AI body generation fails
                    manualReviewReason = `AI follow-up generation failed (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}). Services: ${(classifiedData.identified_services || []).join(', ')}.`;
                    sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
                    // AI Follow-up Generation Failed (aiFollowUpBodyRaw is null)
                    manualReviewReason = `AI follow-up generation failed (returned null). Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}. Classified services: ${(classifiedData.identified_services || []).join(', ')}.`;
                    logAction('ProcessRepliesAIGenerationFail', leadId, senderEmail, manualReviewReason, 'ERROR');
                    
                    sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
                    // sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date()); // This will be set by the notification block
                    logAction('ProcessRepliesSetToManualReview', leadId, senderEmail, `Status set to NEEDS_MANUAL_REVIEW due to AI follow-up generation failure.`, 'WARNING');
                    sendManualReviewNotification = true; // Ensure notification is sent
                }
            } else { // Fallback: Not negative, but not meeting criteria for AI follow-up (e.g., Positive Generic, or other unhandled edge cases)
                sendManualReviewNotification = true;
                manualReviewReason = `Not proceeding with AI follow-up. Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}. Services: ${(classifiedData && classifiedData.identified_services ? classifiedData.identified_services.join(', ') : 'N/A')}. Summary: ${(classifiedData && classifiedData.summary_of_need ? classifiedData.summary_of_need : 'N/A')}.`;
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
                logAction('ProcessRepliesToManualReviewFallback', leadId, senderEmail, manualReviewReason, 'INFO');
            }

            // Send Manual Review Notification Email if flagged
            if (sendManualReviewNotification) {
                sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date()); // Update last contact for manual review cases too
                logAction('ProcessRepliesManualReview', leadId, senderEmail, `Lead flagged for manual review. Reason: ${manualReviewReason}`, 'WARNING');
                const reviewSubject = `Lead Needs Manual Review: ${firstName} (${leadId})`;
                const reviewBody = `Lead: ${firstName} (${senderEmail}, ID: ${leadId}) has been flagged for manual review.\n\nReason: ${manualReviewReason}\n\nPlease review their status and reply in the sheet: https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit\n\nOriginal reply snippet (first 300 chars):\n${body.substring(0,300)}...`;
                try {
                    GmailApp.sendEmail(CONFIG.PR_EMAIL, reviewSubject, reviewBody);
                    logAction('ProcessRepliesManualReviewNotifSent', leadId, senderEmail, 'Manual review notification email sent.', 'INFO');
                } catch (e) {
                    logAction('ProcessRepliesManualReviewNotifError', leadId, senderEmail, `Error sending manual review notification: ${e.message}`, 'ERROR');
                }
            } else if (sheet.getRange(actualSheetRow, colIdx['Status'] + 1).getValue() === STATUS.HOT) { // Only update Last Contact if not already set by manual review path
                 sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
            // 1. Handle explicit opt-out first
            const lowerBody = body.toLowerCase(); // Ensure body is lowercased for opt-out checks
            if (lowerBody.includes('stop') || lowerBody.includes('unsubscribe') || lowerBody.includes('remove me')) {
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.UNQUALIFIED);
                sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
                logAction('ProcessRepliesOptOut', leadId, senderEmail, 'Lead opted out via reply.', 'SUCCESS');
                thread.markRead();
                SpreadsheetApp.flush();
                leadFoundAndProcessed = true;
                break; // from inner lead search loop
            }

            // 2. Attempt AI Classification
            // Pass original body (not lowercased) to AI if it might affect understanding, though prompts.js usually expects it to be handled
            // For this implementation, `body` was already lowercased earlier in the function.

            // New: Get Interaction History
            const interactionHistorySummaryRaw = getLeadInteractionHistory(leadId, senderEmail); // Assuming getLeadInteractionHistory is globally available from Utilities.js
            const MAX_HISTORY_LENGTH = 2000; // Define a constant or use a CONFIG value if preferred
            const interactionHistorySummary = truncateString(interactionHistorySummaryRaw, MAX_HISTORY_LENGTH, " [History truncated]"); // Use truncateString from Utilities.js

            logAction('ProcessRepliesHistory', leadId, senderEmail, `Retrieved interaction history (raw length: ${interactionHistorySummaryRaw ? interactionHistorySummaryRaw.length : 0}, truncated length: ${interactionHistorySummary ? interactionHistorySummary.length : 0}): ${interactionHistorySummary ? interactionHistorySummary.substring(0, 300) + "..." : "None"}`, 'INFO');

            // Modified: Call AI Classification with history (passing the truncated summary)
            const classifiedData = classifyProspectReply(body, firstName, interactionHistorySummary); 
            // The existing 'ProcessRepliesRawClassification' log will include the new sentiment field automatically.
            logAction('ProcessRepliesRawClassification', leadId, senderEmail, `Raw AI classification data: ${JSON.stringify(classifiedData)}`, 'INFO');

            const sentiment = classifiedData ? classifiedData.sentiment : null; // Get sentiment
            const confidence = classifiedData ? classifiedData.classification_confidence : null; // Get confidence
            logAction('ProcessRepliesSentiment', leadId, senderEmail, `AI Classified Sentiment: ${sentiment}`, 'INFO');
            logAction('ProcessRepliesConfidence', leadId, senderEmail, `AI Classification Confidence: ${confidence === null || confidence === undefined ? 'N/A' : confidence.toFixed(2)}`, 'INFO'); // New log

            // Handle negative sentiment explicitly first
            let sendManualReviewNotification = false; // Flag to control single notification
            let manualReviewReason = "";
            const LOW_CONFIDENCE_THRESHOLD = 0.70;

            if (sentiment === "negative") {
                logAction('ProcessRepliesNegativeSentiment', leadId, senderEmail, 'Negative sentiment detected by AI. Marking as UNQUALIFIED.', 'INFO');
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.UNQUALIFIED);
                sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
                // No AI follow-up email is sent.
            
            // New Manual Review Logic
            } else if (!classifiedData) {
                sendManualReviewNotification = true;
                manualReviewReason = "AI classification failed (classifiedData is null).";
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
            } else if (sentiment === "neutral" && classifiedData.identified_services && classifiedData.identified_services.length > 0 && classifiedData.identified_services[0] === "Generic Inquiry") {
                sendManualReviewNotification = true;
                manualReviewReason = `Neutral sentiment for Generic Inquiry. Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}. Summary: ${classifiedData.summary_of_need || 'N/A'}`;
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
            } else if (confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD) {
                sendManualReviewNotification = true;
                manualReviewReason = `Low AI classification confidence: ${confidence.toFixed(2)}. Services: ${(classifiedData.identified_services || []).join(', ')}. Summary: ${classifiedData.summary_of_need || 'N/A'}`;
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
            
            // Main AI Follow-up Path (Positive/Neutral sentiment, Specific Service, Sufficient Confidence)
            } else if (classifiedData.identified_services && classifiedData.identified_services.length > 0 && classifiedData.identified_services[0] !== "Generic Inquiry" && (sentiment === "positive" || sentiment === "neutral")) {
                // This implies confidence is sufficient or null (treated as sufficient if not low)
                logAction('ProcessRepliesAILogic', leadId, senderEmail, `Proceeding with AI follow-up. Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}`, 'INFO');
                // Modified: Call AI Follow-up Generation with history
                const aiFollowUpBodyRaw = generateAIContextualFollowUp(classifiedData, firstName, YOUR_NAME, AI_SERVICE_PROFILE, interactionHistorySummary);

                if (aiFollowUpBodyRaw) {
                    let chosenCalendlyLink = DEFAULT_CALENDLY_LINK;
                    const identifiedServices = classifiedData.identified_services; 

                    if (identifiedServices && identifiedServices.length > 0 && identifiedServices[0] !== "Generic Inquiry") {
                        if (identifiedServices.length === 1) {
                            const serviceName = identifiedServices[0];
                            if (AI_SERVICE_PROFILE[serviceName] && AI_SERVICE_PROFILE[serviceName].calendlyLink) {
                                chosenCalendlyLink = AI_SERVICE_PROFILE[serviceName].calendlyLink;
                                logAction('ProcessRepliesCalendly', leadId, senderEmail, `Single service identified: ${serviceName}. Using its specific link.`, 'INFO');
                            } else {
                                logAction('ProcessRepliesCalendly', leadId, senderEmail, `Single service: ${serviceName}, no specific link. Default.`, 'INFO');
                            }
                        } else { 
                            const servicePriority = ["Web Design & Development", "Google Ads Management", "GMC/Feed Management", "Funnels", "AI Automation", "Tech Strategy"];
                            let foundPriorityLink = false;
                            for (const priorityService of servicePriority) {
                                if (identifiedServices.includes(priorityService) && AI_SERVICE_PROFILE[priorityService] && AI_SERVICE_PROFILE[priorityService].calendlyLink) {
                                    chosenCalendlyLink = AI_SERVICE_PROFILE[priorityService].calendlyLink;
                                    logAction('ProcessRepliesCalendly', leadId, senderEmail, `Multiple services. Priority link for: ${priorityService}`, 'INFO');
                                    foundPriorityLink = true;
                                    break;
                                }
                            }
                            if (!foundPriorityLink) {
                                logAction('ProcessRepliesCalendly', leadId, senderEmail, 'Multiple services. No priority link found. Default.', 'INFO');
                            }
                        }
                    } else { 
                        logAction('ProcessRepliesCalendly', leadId, senderEmail, 'Generic/no specific service. Default Calendly link.', 'INFO');
                    }
                    
                    const formattedAIBody = formatPlainTextEmailBody(aiFollowUpBodyRaw); // Use the new utility
                    const calendlyLinkSentence = "Here’s the link to book a meeting: " + chosenCalendlyLink;
                    
                    // Construct final body: Formatted AI Body + Blank Line + Calendly Sentence + Blank Line + Footer
                    const finalAIFollowUpBody = formattedAIBody + "\n\n" + calendlyLinkSentence + "\n\n" + CONFIG.EMAIL_FOOTER;
                    
                    const subject = `Re: Your Inquiry - ${(classifiedData.identified_services.join(' & ') || "Following Up")}`;

                    if (sendEmail(senderEmail, subject, finalAIFollowUpBody, leadId)) {
                        sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.HOT);
                        sendPRAlert(firstName, classifiedData.identified_services.join(', '), senderEmail, phone, `HOT - AI Classified (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'})`, leadId); 
                        logAction('ProcessRepliesAIFollowUpSent', leadId, senderEmail, `AI Follow-up sent (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}). Classified: ${classifiedData.identified_services.join(', ')}. Subject: ${subject}`, 'SUCCESS');
                    } else {
                        logAction('ProcessRepliesAIFollowUpSendError', leadId, senderEmail, `Failed to send AI follow-up (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}).`, 'ERROR');
                    }
                } else { // AI Follow-up generation failed
                    sendManualReviewNotification = true; // Flag for manual review if AI body generation fails
                    manualReviewReason = `AI follow-up generation failed (Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}). Services: ${(classifiedData.identified_services || []).join(', ')}.`;
                    sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
                    // AI Follow-up Generation Failed (aiFollowUpBodyRaw is null)
                    manualReviewReason = `AI follow-up generation failed (returned null). Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}. Classified services: ${(classifiedData.identified_services || []).join(', ')}.`;
                    logAction('ProcessRepliesAIGenerationFail', leadId, senderEmail, manualReviewReason, 'ERROR');
                    
                    sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
                    // sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date()); // This will be set by the notification block
                    logAction('ProcessRepliesSetToManualReview', leadId, senderEmail, `Status set to NEEDS_MANUAL_REVIEW due to AI follow-up generation failure.`, 'WARNING');
                    sendManualReviewNotification = true; // Ensure notification is sent
                }
            } else { // Fallback: Not negative, but not meeting criteria for AI follow-up (e.g., Positive Generic, or other unhandled edge cases)
                sendManualReviewNotification = true;
                manualReviewReason = `Not proceeding with AI follow-up. Sentiment: ${sentiment}, Confidence: ${confidence ? confidence.toFixed(2) : 'N/A'}. Services: ${(classifiedData && classifiedData.identified_services ? classifiedData.identified_services.join(', ') : 'N/A')}. Summary: ${(classifiedData && classifiedData.summary_of_need ? classifiedData.summary_of_need : 'N/A')}.`;
                sheet.getRange(actualSheetRow, colIdx['Status'] + 1).setValue(STATUS.NEEDS_MANUAL_REVIEW);
                logAction('ProcessRepliesToManualReviewFallback', leadId, senderEmail, manualReviewReason, 'INFO');
            }

            // Send Manual Review Notification Email if flagged
            if (sendManualReviewNotification) {
                sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date()); // Update last contact for manual review cases too
                logAction('ProcessRepliesManualReview', leadId, senderEmail, `Lead flagged for manual review. Reason: ${manualReviewReason}`, 'WARNING');
                const reviewSubject = `Lead Needs Manual Review: ${firstName} (${leadId})`;
                const reviewBody = `Lead: ${firstName} (${senderEmail}, ID: ${leadId}) has been flagged for manual review.\n\nReason: ${manualReviewReason}\n\nPlease review their status and reply in the sheet: https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit\n\nOriginal reply snippet (first 300 chars):\n${body.substring(0,300)}...`;
                try {
                    GmailApp.sendEmail(CONFIG.PR_EMAIL, reviewSubject, reviewBody);
                    logAction('ProcessRepliesManualReviewNotifSent', leadId, senderEmail, 'Manual review notification email sent.', 'INFO');
                } catch (e) {
                    logAction('ProcessRepliesManualReviewNotifError', leadId, senderEmail, `Error sending manual review notification: ${e.message}`, 'ERROR');
                }
            } else if (sheet.getRange(actualSheetRow, colIdx['Status'] + 1).getValue() === STATUS.HOT) { // Only update Last Contact if not already set by manual review path
                 sheet.getRange(actualSheetRow, colIdx['Last Contact'] + 1).setValue(new Date());
            }
            
            thread.markRead();
            SpreadsheetApp.flush(); 
            leadFoundAndProcessed = true;
            break; // Break from inner lead search loop

          } else {
            logAction('ProcessRepliesWrongStatus', leadId, senderEmail, 'Reply from lead with status ' + currentStatus + '. No action taken for this reply.', 'INFO');
            thread.markRead(); // Mark as read to avoid reprocessing this specific email
            leadFoundAndProcessed = true; // Consider it processed for this email, even if no action on lead status
            break; 
          }
        }
      } // End of leads loop

      if (!leadFoundAndProcessed) {
          // If the sender was not found in the leads sheet, or if it was found but not processed (e.g. wrong status and already marked read)
          logAction('ProcessRepliesSenderNotFoundOrNotActionable', null, senderEmail, 'Sender not found in leads sheet or reply already handled/not actionable for status update. Subject: ' + lastMessage.getSubject(), 'INFO');
          // Mark the thread as read to avoid it being picked up again by the general "is:unread" search if no specific lead action was taken
          // but the lead was found and its status was not SENT/FOLLOW_UP_1.
          // If truly not found, this also marks it as read.
          thread.markRead(); 
      }
    } // End of threads loop
    logAction('ProcessRepliesEnd', null, null, 'Hourly reply processing finished.', 'INFO');
    } catch (e) { // This is the single, correct catch block for critical errors
      const errorMessage = `Error in processReplies: ${e.message} ${e.stack ? ' Stack: ' + e.stack : ''}`;
      logAction('ProcessRepliesCriticalError', null, null, errorMessage, 'CRITICAL');
      console.error(errorMessage);
    } finally {
      lock.releaseLock();
      logAction('ProcessRepliesLockReleased', null, null, 'Lock released for processReplies.', 'DEBUG');
    }
  } else {
    logAction('ProcessRepliesLockError', null, null, 'Could not obtain lock for processReplies after 10 seconds. Processing run skipped.', 'ERROR');
    console.warn('Could not obtain lock for processReplies. Processing run skipped.');
  }
}

// (Make sure getServiceClassificationPrompt is accessible, typically true in Apps Script if both are .js files in the same project)
// (Make sure CONFIG is accessible)

function classifyProspectReply(replyText, leadFirstName, interactionHistorySummary) { // NEW signature
  try {
    const serviceProfile = CONFIG.AI_SERVICES_PROFILE;
    if (!serviceProfile) {
      logAction('ClassifyProspectReplyError', null, null, 'CONFIG.AI_SERVICES_PROFILE is not defined.', 'ERROR');
      console.error('ClassifyProspectReplyError: CONFIG.AI_SERVICES_PROFILE is not defined.');
      return null;
    }

    const classificationPrompt = getServiceClassificationPrompt(replyText, leadFirstName, serviceProfile, interactionHistorySummary); // NEW: Pass interactionHistorySummary
    logAction('ClassifyProspectReplyInfo', null, null, `Generated classification prompt: ${classificationPrompt.substring(0, 200)}...`, 'INFO'); // Log part of the prompt

    const jsonStringResponse = getAIEmailContent(classificationPrompt); // Call modified getAIEmailContent

    if (!jsonStringResponse) {
      logAction('ClassifyProspectReplyError', null, null, 'Received null response from getAIEmailContent for classification.', 'ERROR');
      console.error('ClassifyProspectReplyError: Received null response from getAIEmailContent for classification.');
      return null;
    }
    // Log raw response
    logAction('ClassifyProspectReplyRawResp', null, null, `Raw classification response snippet: ${jsonStringResponse.substring(0, 500)}`, 'DEBUG');

    // logAction('ClassifyProspectReplyInfo', null, null, `Received JSON string for classification: ${jsonStringResponse.substring(0,200)}...`, 'INFO'); // This is now covered by RawResp and Parsed logs

    // Attempt to parse the JSON, ensuring it's robust against malformed AI output
    let classifiedData;
    try {
      classifiedData = JSON.parse(jsonStringResponse);
    } catch (parseError) {
      const parseErrorMessage = `Error parsing JSON response in classifyProspectReply: ${parseError.message}. Response string: ${jsonStringResponse}`;
      logAction('ClassifyProspectReplyParseError', null, null, parseErrorMessage, 'ERROR');
      console.error(parseErrorMessage);
      // Try to extract content if it's a common markdown ```json ... ``` block
      const match = jsonStringResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        try {
          classifiedData = JSON.parse(match[1]);
          logAction('ClassifyProspectReplyParseRecovery', null, null, 'Successfully parsed JSON after extracting from markdown.', 'INFO');
        } catch (nestedParseError) {
          const nestedParseErrorMessage = `Error parsing JSON even after markdown extraction: ${nestedParseError.message}. Extracted string: ${match[1]}`;
          logAction('ClassifyProspectReplyNestedParseError', null, null, nestedParseErrorMessage, 'ERROR');
          console.error(nestedParseErrorMessage);
          return null; // Give up if still can't parse
        }
      } else {
        return null; // If not a markdown block, and initial parse failed, return null
      }
    }
    // Log parsed data
    logAction('ClassifyProspectReplyParsed', null, null, `Parsed classification data: ${JSON.stringify(classifiedData).substring(0,500)}`, 'DEBUG');
    
    logAction('ClassifyProspectReplySuccess', null, null, 'Successfully parsed classification response.', 'SUCCESS');
    return classifiedData;

  } catch (e) {
    // Catch any other unexpected errors during the process
    // Using jsonStringResponse in the error message might be problematic if it's not defined due to an error earlier in the try block.
    // So, declare it outside or ensure it's handled. For simplicity, we'll rely on its scope if an error happens after its assignment.
    // If getAIEmailContent fails and returns null, jsonStringResponse will be null.
    const responseForError = typeof jsonStringResponse !== 'undefined' ? jsonStringResponse : 'N/A';
    const errorMessage = `Error in classifyProspectReply: ${e.message}. Response string: ${responseForError}. Stack: ${e.stack}`;
    logAction('ClassifyProspectReplyCritical', null, null, errorMessage, 'CRITICAL');
    console.error(errorMessage);
    return null;
  }
}
