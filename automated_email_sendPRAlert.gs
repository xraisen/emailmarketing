// File: automated_email_sendPRAlert.gs - Logic for sending PR alerts.

/**
 * Sends PR alerts via email and Slack.
 * @param {string} firstName The first name of the lead.
 * @param {string} lastService The last service associated with the lead.
 * @param {string} leadEmail The email address of the lead.
 * @param {string} [leadPhone] The phone number of the lead (optional).
 * @param {string|Date} [bookingTime] The booking time (optional). Formats to string or defaults to 'Pending'.
 * @param {string} leadId The Lead ID.
 */
function sendPRAlert(firstName, lastService, leadEmail, leadPhone, bookingTime, leadId) {
  const phoneDisplay = leadPhone || ''; // Default to empty string if null/undefined
  let timeDisplay = 'Pending';

  if (bookingTime) {
    if (bookingTime instanceof Date) {
      // Attempt to format the date, ensuring a valid date object
      try {
        // Use a specific timezone if available, otherwise server timezone
        timeDisplay = Utilities.formatDate(bookingTime, CONFIG.USER_TIMEZONE || Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm z");
      } catch (e) {
        timeDisplay = bookingTime.toString(); // Fallback to simple string conversion if formatting fails
        logAction('PR_ALERT_DATE_FORMAT_WARN', leadId, leadEmail, 'Could not format bookingTime using Utilities.formatDate: ' + e.message, 'WARNING');
      }
    } else {
      timeDisplay = bookingTime.toString(); // Ensure it's a string if not a Date object
    }
  }

  // --- Email Notification ---
  try {
    const emailSubject = `NEW CALL - ${firstName}`;
    const emailBody = `Service: ${lastService}\nTime: ${timeDisplay}\nContact: ${leadEmail} | ${phoneDisplay}`;
    GmailApp.sendEmail(CONFIG.PR_EMAIL, emailSubject, emailBody);
    logAction('PR_ALERT_EMAIL_SUCCESS', leadId, leadEmail, 'PR Email alert sent. Subject: ' + emailSubject, 'SUCCESS');
    console.log(`PR Email alert sent successfully for Lead ID: ${leadId}`);
  } catch (error) {
    const emailErrorMsg = `Error sending PR Email alert: ${error.message} (Lead ID: ${leadId}, Email: ${leadEmail})`;
    logAction('PR_ALERT_EMAIL_ERROR', leadId, leadEmail, emailErrorMsg, 'ERROR');
    console.error(emailErrorMsg);
  }

  // --- Slack Notification ---
  if (!CONFIG.SLACK_WEBHOOK_URL || CONFIG.SLACK_WEBHOOK_URL === 'YOUR_SLACK_WEBHOOK_URL') {
    logAction('PR_ALERT_SLACK_SKIPPED', leadId, leadEmail, 'Slack Webhook URL not configured. Skipping Slack notification.', 'WARNING');
    console.warn('Slack Webhook URL not configured. Skipping Slack notification for Lead ID: ' + leadId);
    return; // Exit if Slack URL is not set
  }
  
  try {
    const slackMessageText = `New Call Alert!\nLead: ${firstName}\nService: ${lastService}\nTime: ${timeDisplay}\nContact: ${leadEmail} | ${phoneDisplay}`;
    const payload = { text: slackMessageText };
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true // Important to get the response code and content for non-200 responses
    };

    const response = UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseContent = response.getContentText();

    if (responseCode === 200) {
      logAction('PR_ALERT_SLACK_SUCCESS', leadId, leadEmail, 'PR Slack alert sent.', 'SUCCESS');
      console.log(`PR Slack alert sent successfully for Lead ID: ${leadId}`);
    } else {
      const slackErrorMsg = `Error sending PR Slack alert. Response Code: ${responseCode}. Response: ${responseContent.substring(0, 500)} (Lead ID: ${leadId})`;
      logAction('PR_ALERT_SLACK_ERROR', leadId, leadEmail, slackErrorMsg, 'ERROR');
      console.error(slackErrorMsg);
    }
  } catch (error) { 
    // This catches network errors or if UrlFetchApp.fetch itself throws an exception (e.g. invalid URL, timeout before any response)
    const slackCatchErrorMsg = `Exception sending PR Slack alert: ${error.message} (Lead ID: ${leadId})`;
    logAction('PR_ALERT_SLACK_ERROR', leadId, leadEmail, slackCatchErrorMsg, 'ERROR');
    console.error(slackCatchErrorMsg);
  }
}
