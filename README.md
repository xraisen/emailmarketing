# $0 Cost Auto Email Sender

## Overview

The $0 Cost Auto Email Sender is a Google Apps Script-based system designed to automate email outreach, follow-ups, reply processing, and lead management. It leverages a suite of Google services (Sheets, Gmail, Apps Script, Calendar), the Gemini API for AI-powered email personalization, and Calendly for appointment booking.

**Key Features:**

*   **AI-Generated Personalized Emails:** Utilizes the Gemini API to craft unique initial and follow-up emails for each lead.
*   **Scheduled & Automated Sending:** Emails and follow-ups are sent out on a predefined schedule.
*   **Automated Lead Status Updates:** Lead statuses are automatically updated in a Google Sheet based on email sends, replies, and bookings.
*   **Reply Processing:** Intelligently processes incoming email replies to identify positive interest, disinterest, or neutral responses.
*   **PR Alerts:** Sends real-time notifications via Email and Slack (if configured) for important lead events (positive replies, new bookings).
*   **Calendly Integration:** Seamlessly integrates with Calendly webhooks to track when leads book appointments (`invitee.created`) and when they cancel (`invitee.canceled`).
*   **Google Calendar Event Creation:** Automatically creates Google Calendar events for confirmed bookings, inviting the lead.
*   **Comprehensive Logging:** Keeps detailed logs of all actions, including `invitee.canceled` events, in a dedicated Google Sheet.

**$0 Cost Aspect:**

This system is designed to operate with no direct software costs by utilizing the free tiers of:
*   Google Apps Script (generous free quotas)
*   Gmail (standard account sending limits apply)
*   Google Sheets
*   Google Calendar
*   Gemini API (free tier typically available, subject to Google's terms and quotas)
*   Calendly (free tier allows for webhook integration)
*   Slack (free tier allows for Incoming Webhooks, if used)

## What Will Happen After Setup (Workflow Description)

Once the system is fully set up and operational, here’s a detailed walkthrough of the automated workflow:

**1. Initial Setup & Triggers:**

*   **Sheets Created:** Upon running `initializeSheets()`, two sheets, 'Leads' and 'Logs', are created in your specified Google Spreadsheet.
    *   The 'Leads' sheet will have headers: `First Name`, `Email`, `Phone`, `Last Service`, `Status`, `Last Contact`, `Lead ID`. The header row will be frozen.
    *   The 'Logs' sheet will have headers: `Timestamp`, `Action`, `Lead ID`, `Email`, `Details`, `Status`. The header row will be frozen.
    *   Example Log entries:
        ```
        [Timestamp], InitializeSheets, , , Starting sheet initialization., INFO
        [Timestamp], InitializeSheets, , , Created sheet: Leads, INFO
        [Timestamp], SetHeaders, , , Headers set for sheet: Leads, INFO  // This log implies headers written and row frozen
        [Timestamp], InitializeSheets, , , Created sheet: Logs, INFO
        [Timestamp], SetHeaders, , , Headers set for sheet: Logs, INFO // This log implies headers written and row frozen
        [Timestamp], InitializeSheets, , , Sheet initialization completed successfully., INFO
        ```
*   **Triggers Established:** Running `setupTriggers()` configures automated functions based on your `CONFIG.USER_TIMEZONE`:
    *   `dailyEmailBatch`: Runs daily (e.g., 9 AM) to send initial emails.
    *   `followUpEmails`: Runs daily (e.g., 3 PM) to send follow-ups.
    *   `processReplies`: Runs hourly to check for and process new email replies.
    *   `cleanupLeads`: Runs daily (e.g., 11 PM) to mark old, unresponsive leads as 'ABANDONED'.
    *   Example Log entries:
        ```
        [Timestamp], SetupTriggersStart, , , Setting up script triggers., INFO
        [Timestamp], SetupTriggersDeleted, , , Deleted 0 existing trigger(s)., INFO // Or count of deleted
        [Timestamp], SetupTriggersCreate, , , Created trigger for dailyEmailBatch at 9 AM., SUCCESS
        [Timestamp], SetupTriggersCreate, , , Created trigger for followUpEmails at 3 PM., SUCCESS
        [Timestamp], SetupTriggersCreate, , , Created trigger for cleanupLeads at 11 PM., SUCCESS
        [Timestamp], SetupTriggersCreate, , , Created trigger for processReplies every hour., SUCCESS
        [Timestamp], SetupTriggersEnd, , , Script trigger setup complete., INFO
        ```

**2. Lead Processing Workflow:**

*   **Adding Leads:** You manually add new leads to the 'Leads' sheet with their `First Name`, `Email`, `Phone` (optional), and `Last Service`. Set their initial `Status` to `PENDING`.
*   **Daily Email Batch (`dailyEmailBatch`):**
    *   The system scans for leads with `Status = PENDING`.
    *   For each, it generates a unique, personalized email using the Gemini API and the `getInitialEmailPrompt`.
    *   The email is sent via Gmail.
    *   `Status` is updated to `SENT`, `Last Contact` date is set. A `Lead ID` is generated if missing.
    *   Example Log entries:
        ```
        [Timestamp], DailyBatchStart, , , Daily email batch process started with lock., INFO
        [Timestamp], DailyBatchLeadIDGenerated, [GeneratedLeadID], lead@example.com, Generated new Lead ID., INFO
        [Timestamp], GetAIEmailContent, , , Successfully retrieved AI content., SUCCESS
        [Timestamp], SendEmailSuccess, [GeneratedLeadID], lead@example.com, Subject: Free Audit for [Last Service], SUCCESS
        [Timestamp], DailyBatchEmailSent, [GeneratedLeadID], lead@example.com, Initial email sent. Subject: Free Audit for [Last Service], SUCCESS
        [Timestamp], DailyBatchEnd, , , Daily email batch process finished. Emails sent in this run: 1, INFO
        [Timestamp], DailyBatchLockReleased, , , Lock released for dailyEmailBatch., DEBUG
        ```
*   **Hourly Reply Processing (`processReplies`):**
    *   The system checks your Gmail inbox for unread replies from leads.
    *   **Positive Reply** (e.g., contains "yes", "interested"):
        *   Lead `Status` changes to `HOT`.
        *   An email is sent to the lead with your `CONFIG.CALENDLY_LINK`.
        *   A PR alert is sent via Email (to `CONFIG.PR_EMAIL`) and Slack (if `CONFIG.SLACK_WEBHOOK_URL` is configured). The time in this alert will be 'Pending'.
        *   Example Log entries:
            ```
            [Timestamp], ProcessRepliesStart, , , Hourly reply processing started with lock., INFO
            [Timestamp], ProcessRepliesProcessing, [LeadID], lead@example.com, Processing reply. Subject: Re: Free Audit, DEBUG
            [Timestamp], SendEmailSuccess, [LeadID], lead@example.com, Subject: Next Step: Book Your Free Audit for [Last Service], SUCCESS
            [Timestamp], PR_ALERT_EMAIL_SUCCESS, [LeadID], lead@example.com, PR Email alert sent. Subject: NEW CALL - [FirstName], SUCCESS
            [Timestamp], PR_ALERT_SLACK_SUCCESS, [LeadID], lead@example.com, PR Slack alert sent., SUCCESS
            [Timestamp], ProcessRepliesHotLead, [LeadID], lead@example.com, Lead marked HOT. Calendly link sent. PR alert triggered., SUCCESS
            [Timestamp], ProcessRepliesEnd, , , Hourly reply processing finished., INFO
            [Timestamp], ProcessRepliesLockReleased, , , Lock released for processReplies., DEBUG
            ```
    *   **Negative Reply** (e.g., "no", "stop", "unsubscribe", "not interested"):
        *   Lead `Status` changes to `UNQUALIFIED`.
        *   Example Log entry:
            ```
            [Timestamp], ProcessRepliesUnqualified, [LeadID], lead@example.com, Lead marked UNQUALIFIED., SUCCESS
            ```
    *   **Neutral/Other Reply:**
        *   The reply is logged. No status change by default (manual review may be needed).
        *   Example Log entry:
            ```
            [Timestamp], ProcessRepliesNeutral, [LeadID], lead@example.com, Neutral reply received, requires manual review. Status not changed., INFO
            ```
*   **Follow-Up Emails (`followUpEmails`):**
    *   If a lead has `Status = SENT` and `Last Contact` was >= 3 days ago:
        *   A personalized follow-up email is generated by Gemini API (`getFollowUpEmailPrompt`).
        *   Email is sent. `Status` becomes `FOLLOW_UP_1`, `Last Contact` is updated.
        *   Example Log entries:
            ```
            [Timestamp], FollowUpBatchStart, , , Follow-up email batch process started with lock., INFO
            [Timestamp], GetAIEmailContent, , , Successfully retrieved AI content., SUCCESS
            [Timestamp], SendEmailSuccess, [LeadID], lead@example.com, Subject: Following up on your Free Audit for [Last Service], SUCCESS
            [Timestamp], FollowUpEmailSent, [LeadID], lead@example.com, Follow-up email sent. Subject: Following up on your Free Audit for [Last Service], SUCCESS
            [Timestamp], FollowUpBatchEnd, , , Follow-up email batch process finished..., INFO
            [Timestamp], FollowUpLockReleased, , , Lock released for followUpEmails., DEBUG
            ```
*   **Lead Cleanup (`cleanupLeads`):**
    *   If a lead has `Status = FOLLOW_UP_1` and `Last Contact` was >= 4 days ago:
        *   `Status` changes to `ABANDONED`.
        *   Example Log entries:
            ```
            [Timestamp], CleanupLeadsStart, , , Cleanup leads process started with lock., INFO
            [Timestamp], CleanupLeadAbandoned, [LeadID], lead@example.com, Lead status changed to ABANDONED., SUCCESS
            [Timestamp], CleanupLeadsEnd, , , Cleanup leads process finished..., INFO
            [Timestamp], CleanupLeadsLockReleased, , , Lock released for cleanupLeads., DEBUG
            ```

**3. Calendly Webhook & Google Calendar Event Creation:**

*   **When a lead books a call (`invitee.created` event):**
    *   Calendly sends a webhook notification to your deployed Google Apps Script Web App.
    *   The `doPost(e)` function in `automated_calendly.js` processes this:
        *   It verifies the event is `invitee.created`.
        *   It finds the lead in the 'Leads' sheet by matching the email from the Calendly notification.
        *   The lead's `Status` is updated to `BOOKED`.
        *   The lead's `Last Contact` is updated to the booking start time.
        *   A PR alert is sent via Email and Slack. The time in this alert will be the actual booking time, formatted according to `CONFIG.USER_TIMEZONE` (e.g., `2024-07-15 14:00 EDT`). If `CONFIG.USER_TIMEZONE` is not set, it defaults to UTC (ISO format).
        *   A Google Calendar event is created for the booked time (30-minute duration).
            *   **Event Title:** `Free Audit with [Lead Name] ([Last Service])` (Lead Name from Calendly, Last Service from sheet)
            *   **Attendees:** The lead's email is added as a guest, and they receive a calendar invitation.
            *   **Description:** Includes:
                ```
                Contact: [Lead's Email] | [Lead's Phone (if available in sheet)]
                Service: [Last Service from sheet]
                Lead ID: [Lead's ID from sheet]
                ```
    *   Example Log entries for `invitee.created`:
        ```
        [Timestamp], CalendlyWebhookReceived, , , Received POST request on Calendly webhook with lock., INFO
        [Timestamp], CalendlyPayload, , [lead_email_from_payload], Payload parsed. Event type: invitee.created..., DEBUG
        [Timestamp], CalendlyLeadBooked, [LeadID], [lead_email_from_payload], Lead status updated to BOOKED. Booking time: [ISO Booking Time], SUCCESS
        [Timestamp], PR_ALERT_EMAIL_SUCCESS, [LeadID], [lead_email_from_payload], PR Email alert sent. Subject: NEW CALL - [FirstNameFromSheet], SUCCESS
        [Timestamp], PR_ALERT_SLACK_SUCCESS, [LeadID], [lead_email_from_payload], PR Slack alert sent., SUCCESS
        [Timestamp], CALENDAR_EVENT_SUCCESS, [LeadID], [lead_email_from_payload], Created calendar event. ID: [CalendarEventID], SUCCESS
        [Timestamp], CalendlyWebhookLockReleased, , , Lock released for Calendly doPost., DEBUG
        ```
*   **When a lead cancels a call (`invitee.canceled` event):**
    *   Calendly sends an `invitee.canceled` webhook notification.
    *   The `doPost(e)` function logs this event:
        *   Example Log entry:
            ```
            [Timestamp], CalendlyInviteeCanceled, [CalendlyEventUUID], lead_who_canceled@example.com, Received "invitee.canceled" event. Full payload: {...}, INFO
            ```
        *   Currently, no further automated action (like deleting the calendar event or changing lead status) is taken for cancellations, but the information is logged for manual review and potential future enhancements.

**4. System Outcomes:**

*   **Lead Progression:** Leads automatically move through various statuses in your 'Leads' sheet.
*   **Automation:** Initial emails, follow-up sequences, and initial reply sorting are handled automatically.
*   **Notifications:** Your team is kept informed of positive lead interactions and new bookings.
*   **Centralized Logging:** All system actions, successes, errors, and notable events like cancellations are meticulously recorded in the 'Logs' sheet.

## Setup Requirements & Instructions

Follow these steps carefully to set up your $0 Cost Auto Email Sender.

**A. Prerequisites:**

*   **Google Account:** A standard Google account (e.g., @gmail.com or a Google Workspace account).
*   **Calendly Account:** A free Calendly account is sufficient.
*   **Gemini API Key:**
    *   Obtain from [Google AI Studio](https://aistudio.google.com/app/apikey) or Google Cloud Console.
    *   Be mindful of its usage limits and Google's terms.
*   **Slack Workspace (Optional):** If you want Slack PR alerts.

**B. Script Installation:**

1.  **Create Google Apps Script Project:**
    *   Go to [script.google.com](https://script.google.com) and click "New project".
    *   Rename the project (e.g., "$0 Cost Auto Email Sender").
2.  **Copy Script Files:**
    *   Delete the default `Code.gs` file.
    *   Create a new script file for each `.js` file provided with this system, ensuring filenames match exactly:
        *   `Config.js`, `Setup.js`, `Utilities.js`, `prompt.js`, `automated_email_sender.js`, `automated_email_followup.js`, `automated_email_sendPRAlert.js`, `automated_calendly.js`.
    *   Copy the entire content of each provided `.js` file into the corresponding file in your Apps Script project.

**C. Configuration (`Config.js`):**

Open `Config.js`. You **must** update these placeholders:

*   `CONFIG.GEMINI_API_KEY`: Your Gemini API Key.
*   `CONFIG.CALENDLY_LINK`: Your public Calendly booking page link.
*   `CONFIG.PR_EMAIL`: Email address for PR/notification alerts.
*   `CONFIG.USER_TIMEZONE`: Your IANA timezone string (e.g., `America/New_York`). Find a list [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).
*   `CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN`: Your Calendly Personal Access Token.
    *   To get this: Log in to Calendly > Integrations > API & Webhooks > Generate Token. Copy it immediately.

The following `CONFIG` values are also important:

*   `CONFIG.ORGANIZATION_URI`: Initially a placeholder (`'YOUR_ORGANIZATION_URI_FROM_API_REPLACE_ME'`). This will be filled in Step E.4.
*   `CONFIG.SPREADSHEET_ID`: **Action:** Create a new Google Sheet. Copy its ID from the URL and paste it here.
*   `CONFIG.SLACK_WEBHOOK_URL` (Optional): Your Slack Incoming Webhook URL, or leave as placeholder/empty if not using Slack.
*   `CONFIG.CALENDLY_SIGNING_KEY`: Pre-filled. Used for logging Calendly signature information. For strict verification, you'd update this with a key Calendly provides for a specific webhook subscription.

**D. Authorizations:**

When you first run functions, Apps Script will prompt for authorization.
*   Click "Review Permissions".
*   Choose your Google account.
*   If you see "Google hasn’t verified this app", click "Advanced", then "Go to [Your Project Name] (unsafe)".
*   Grant the necessary permissions.

**E. Initial Setup Functions (Run Manually from Apps Script Editor):**

**Important:** The following setup functions *must* be run manually from the Apps Script editor in the specified order. These steps are crucial for configuring the system. The 'autonomous operation' of this system refers to the automated email sending, reply processing, and lead updates that occur *after* this initial manual setup is successfully completed.

Run these functions from `Setup.js` in the specified order:
1.  **Update `CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN`:** Open `Config.js` and paste your actual Calendly Personal Access Token into the `CALENDLY_PERSONAL_ACCESS_TOKEN` field. Save the file.
2.  **Run `initializeSheets()`:**
    *   Select `initializeSheets` from the function dropdown. Click "Run".
    *   Verify 'Leads' and 'Logs' sheets are created in your Google Sheet.
3.  **Run `getCalendlyOrganizationUri()`:**
    *   Select `getCalendlyOrganizationUri` from the function dropdown. Click "Run".
    *   The Organization URI will be displayed in the Apps Script execution log (View > Logs). **Copy this URI from the logs.**
4.  **Update `CONFIG.ORGANIZATION_URI`:** Open `Config.js` and paste the copied Organization URI into the `ORGANIZATION_URI` field. Save the file.
5.  **Run `setupTriggers()`:**
    *   Select `setupTriggers` from the function dropdown. Click "Run".
    *   Verify triggers are created in the "Triggers" section of Apps Script.

**F. Deploy Web App (for Calendly Webhook):**

1.  Click "Deploy" -> "New deployment".
2.  Gear icon -> "Web app".
3.  **Description:** (e.g., "Calendly Webhook for Auto Email Sender").
4.  **Execute as:** "Me ([your email address])".
5.  **Who has access:** "Anyone".
6.  Click "Deploy". Copy the **Web app URL**.

**G. Setup Calendly Webhook (Programmatic - Recommended):**

1.  **Run `createCalendlyWebhookSubscription(webAppUrl)`:**
    *   You need to pass the Web App URL (copied in Step F) as an argument. The easiest way is to use (or create if not present) the `runCreateWebhookHelper` function in your `Setup.js` file. **It is critical to edit this function before running it**:
        ```javascript
        // In Setup.js:
        function runCreateWebhookHelper() {
          // IMPORTANT: Replace the placeholder string below with your actual Web App URL
          // obtained after deploying your script (see Step F).
          const webAppUrl = "YOUR_DEPLOYED_WEB_APP_URL_HERE"; 

          // --- Do not modify below this line unless you know what you are doing ---
          if (webAppUrl === "YOUR_DEPLOYED_WEB_APP_URL_HERE" || !webAppUrl.startsWith("https://script.google.com/")) {
            console.error("ERROR: webAppUrl in runCreateWebhookHelper is still the placeholder or invalid. Please edit Setup.js.");
            // If logAction is available and configured:
            // logAction('RunWebhookHelper', null, null, 'ERROR: webAppUrl not replaced in Setup.js', 'ERROR');
            return; 
          }
          createCalendlyWebhookSubscription(webAppUrl);
        }
        ```
        **Before running `runCreateWebhookHelper`:**
        1. Ensure you have completed Step F and copied your Web App URL.
        2. **Open `Setup.js` in the Apps Script editor.**
        3. **Replace `"YOUR_DEPLOYED_WEB_APP_URL_HERE"`** within the `runCreateWebhookHelper` function with your actual, copied Web App URL.
        4. Save the `Setup.js` file.
    *   Select `runCreateWebhookHelper` from the function dropdown and click "Run".
    *   Check the Apps Script execution logs (View > Logs in the editor) and/or the 'Logs' sheet (if configured) for a success or error message from this function. It will no longer display a dialog box.
    *   Note: 'Programmatic - Recommended' means running this function (typically via the `runCreateWebhookHelper`) manually from the Apps Script editor. It automates the webhook creation with Calendly but is not a fully autonomous, hands-off step.
*   **Manual Setup Alternative:** You can also set up webhooks manually in Calendly's UI. Point it to your Web App URL and select the `invitee.created` and `invitee.canceled` events. If Calendly provides a signing key during this manual setup, you should update `CONFIG.CALENDLY_SIGNING_KEY` in `Config.js` with that key for more meaningful signature logging/verification.

## Example Scenario

Here's how the system might work for a single lead:

*   **Day 0:** You add "Laura Chen" (`laura.chen@example.com`, last service: "Website Design") to the 'Leads' sheet with `Status = PENDING`.

*   **Day 1, 9:00 AM (Trigger: `dailyEmailBatch`):**
    *   System picks up Laura Chen.
    *   Gemini API generates a personalized email.
    *   Email sent. Laura's `Status` -> `SENT`. `Last Contact` updated.
    *   Log: `DailyBatchEmailSent, [Laura's LeadID], laura.chen@example.com, Initial email sent.`

*   **Day 1, 10:30 AM (Laura replies "Yes, sounds interesting! Tell me more."):**
    *   **11:00 AM (Trigger: `processReplies`):**
        *   System detects Laura's unread reply.
        *   Laura's `Status` -> `HOT`. `Last Contact` updated.
        *   Email sent to Laura: "Great to hear, Laura! You can book your free consultation here: [Your Calendly Link]".
        *   PR Alert Email & Slack sent: "NEW CALL - Laura Chen... Time: Pending".
        *   Log: `ProcessRepliesHotLead, [Laura's LeadID], laura.chen@example.com, Lead marked HOT...`

*   **Day 1, 2:00 PM (Laura clicks Calendly link, books for Day 3, 10:00 AM):**
    *   **2:00 PM (Calendly Webhook for `invitee.created` -> `doPost(e)`):**
        *   System receives webhook. Laura's `Status` -> `BOOKED`. `Last Contact` updated.
        *   PR Alert Email & Slack sent: "NEW CALL - Laura Chen... Time: [Day 3, 10:00 AM Formatted]".
        *   Google Calendar event created for Day 3, 10:00 AM - 10:30 AM, inviting Laura.
        *   Log: `CalendlyLeadBooked, [Laura's LeadID], laura.chen@example.com, Lead status updated to BOOKED...`
        *   Log: `CALENDAR_EVENT_SUCCESS, [Laura's LeadID], laura.chen@example.com, Created calendar event...`

*   **Day 2, 5:00 PM (Laura cancels her Day 3 appointment via Calendly):**
    *   **5:00 PM (Calendly Webhook for `invitee.canceled` -> `doPost(e)`):**
        *   System receives `invitee.canceled` webhook.
        *   Log: `CalendlyInviteeCanceled, [CalendlyEventUUID], laura.chen@example.com, Received "invitee.canceled" event...`
        *   (No further automated action on status/calendar event by default for cancellation).

## Troubleshooting

*   **Check Logs First:** The 'Logs' sheet is your primary diagnostic tool.
*   **Authorization Issues:** Manually run a function (e.g., `dailyEmailBatch`) to trigger auth prompts if needed. Check "My Executions" in Apps Script dashboard.
*   **Triggers Not Running:** Verify in "Triggers" section. Ensure `CONFIG.USER_TIMEZONE` is correct.
*   **Emails Not Sending:** Check Gmail "Sent". Verify Gmail/Gemini quotas. Review `prompt.js`.
*   **Calendly Webhook Issues:**
    *   Double-check Web App URL in Calendly. Deployed with "Anyone" access?
    *   Look for `CalendlyWebhookReceived` in logs. If `invitee.canceled` events aren't logged, ensure the webhook subscription includes this event.
    *   If `CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN` or `CONFIG.ORGANIZATION_URI` were incorrect during `createCalendlyWebhookSubscription`, it might have failed silently or with an error in logs/alerts; re-run that step if needed.
*   **Google Calendar Events:** Check `CALENDAR_EVENT_ERROR` logs.
*   **`LockService` Errors ("Could not obtain lock"):** Indicates functions are running too long or too frequently. Review execution times.

---

This README provides a comprehensive guide. Remember to carefully replace all placeholder values in `Config.js` with your actual information.
