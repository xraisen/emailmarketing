# $0 Cost Auto Email Sender

## Overview

The $0 Cost Auto Email Sender is a Google Apps Script-based system designed to automate email outreach, follow-ups, reply processing, and lead management. It leverages a suite of Google services (Sheets, Gmail, Apps Script, Calendar), the Gemini API for AI-powered email personalization, and Calendly for appointment booking.

**Key Features:**

*   **AI-Generated Personalized Emails:** Utilizes the Gemini API to craft unique initial and follow-up emails for each lead.
*   **Scheduled & Automated Sending:** Emails and follow-ups are sent out on a predefined schedule.
*   **Automated Lead Status Updates:** Lead statuses are automatically updated in a Google Sheet based on email sends, replies, and bookings.
*   **Reply Processing:** Intelligently processes incoming email replies to identify positive interest, disinterest, or neutral responses.
*   **PR Alerts:** Sends real-time notifications via Email and Slack (if configured) for important lead events (positive replies, new bookings).
*   **Calendly Integration:** Seamlessly integrates with Calendly webhooks to track when leads book appointments.
*   **Google Calendar Event Creation:** Automatically creates Google Calendar events for confirmed bookings, inviting the lead.
*   **Comprehensive Logging:** Keeps detailed logs of all actions in a dedicated Google Sheet.

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

*   When a lead books a call via the Calendly link sent to them:
    *   Calendly sends a webhook notification to your deployed Google Apps Script Web App.
    *   The `doPost(e)` function in `automated_calendly.gs` processes this:
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
    *   Example Log entries:
        ```
        [Timestamp], CalendlyWebhookReceived, , , Received POST request on Calendly webhook with lock., INFO
        [Timestamp], CalendlySignatureCheck, , , Calendly signature header present and signing key configured..., INFO (or other signature status)
        [Timestamp], CalendlyPayload, , [lead_email_from_payload], Payload parsed. Event type: invitee.created..., DEBUG
        [Timestamp], CalendlyLeadBooked, [LeadID], [lead_email_from_payload], Lead status updated to BOOKED. Booking time: [ISO Booking Time], SUCCESS
        [Timestamp], PR_ALERT_EMAIL_SUCCESS, [LeadID], [lead_email_from_payload], PR Email alert sent. Subject: NEW CALL - [FirstNameFromSheet], SUCCESS
        [Timestamp], PR_ALERT_SLACK_SUCCESS, [LeadID], [lead_email_from_payload], PR Slack alert sent., SUCCESS
        [Timestamp], CALENDAR_EVENT_SUCCESS, [LeadID], [lead_email_from_payload], Created calendar event. ID: [CalendarEventID], SUCCESS
        [Timestamp], CalendlyWebhookLockReleased, , , Lock released for Calendly doPost., DEBUG
        ```

**4. System Outcomes:**

*   **Lead Progression:** Leads automatically move through various statuses in your 'Leads' sheet, from `PENDING` to `SENT`, `FOLLOW_UP_1`, and finally to `HOT`, `UNQUALIFIED`, `ABANDONED`, or `BOOKED`.
*   **Automation:** Initial emails, follow-up sequences, and initial reply sorting are handled automatically.
*   **Notifications:** Your team is kept informed of positive lead interactions and new bookings through email and Slack alerts.
*   **Centralized Logging:** All system actions, successes, and errors are meticulously recorded in the 'Logs' sheet, providing a clear audit trail and aiding in troubleshooting.

## Setup Requirements & Instructions

Follow these steps carefully to set up your $0 Cost Auto Email Sender.

**A. Prerequisites:**

*   **Google Account:** You'll need a standard Google account (e.g., @gmail.com or a Google Workspace account) to use Google Sheets, Gmail, Google Calendar, and Google Apps Script.
*   **Calendly Account:** A free Calendly account is sufficient, as it allows for webhook integrations.
*   **Gemini API Key:**
    *   Obtain this key from [Google AI Studio](https://aistudio.google.com/app/apikey) (recommended for ease) or the Google Cloud Console.
    *   The Gemini API typically has a free tier, but be mindful of its usage limits and Google's terms of service.
*   **Slack Workspace (Optional):** If you wish to receive PR alerts in Slack, you'll need a Slack workspace where you have permission to add an Incoming Webhook.

**B. Script Installation:**

1.  **Create Google Apps Script Project:**
    *   Go to [script.google.com](https://script.google.com) and click "New project".
    *   Alternatively, open Google Drive, click "New" > "More" > "Google Apps Script".
    *   Give your project a descriptive name (e.g., "$0 Cost Auto Email Sender").
2.  **Copy Script Files:**
    *   In the Apps Script editor, you'll see a default `Code.gs` file. You can delete its content or rename it.
    *   You need to create a separate script file for each `.gs` file provided with this system. The filenames must match exactly:
        *   `Config.gs`
        *   `Setup.gs`
        *   `Utilities.gs`
        *   `prompt.gs`
        *   `automated_email_sender.gs`
        *   `automated_email_followup.gs`
        *   `automated_email_sendPRAlert.gs`
        *   `automated_calendly.gs`
    *   To create a new file: Click the "+" icon next to "Files" in the Apps Script editor, choose "Script", and enter the filename (e.g., `Config`).
    *   Copy the entire content of each provided `.gs` file and paste it into the corresponding, newly created file in your Apps Script project.

**C. Configuration (`Config.gs`):**

Open the `Config.gs` file in your Apps Script editor. This file centralizes all essential settings. You **must** update the following placeholder values in the `CONFIG` object:

*   `GEMINI_API_KEY`: Replace `"YOUR_GEMINI_API_KEY"` with your actual Gemini API Key.
    ```javascript
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY', // User to provide
    ```
*   `CALENDLY_LINK`: Replace `"YOUR_CALENDLY_LINK"` with your public Calendly booking page link (e.g., `https://calendly.com/your-username/30min`). This is the link sent to 'HOT' leads.
    ```javascript
    CALENDLY_LINK: 'YOUR_CALENDLY_LINK', // User to provide - this is the public booking page link
    ```
*   `PR_EMAIL`: Replace `"YOUR_PR_EMAIL"` with the email address where you want to receive PR (Public Relations/Notification) alerts for new bookings or hot leads.
    ```javascript
    PR_EMAIL: 'YOUR_PR_EMAIL', // User to provide
    ```
*   `USER_TIMEZONE`: Replace `"YOUR_USER_TIMEZONE"` with your IANA timezone string. This is **critical** for ensuring automated triggers run at the correct local times for your operations.
    *   Examples: `America/New_York`, `Europe/London`, `Asia/Tokyo`.
    *   Find a list of valid IANA timezones [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).
    ```javascript
    USER_TIMEZONE: 'YOUR_USER_TIMEZONE', // User to provide, e.g., 'America/New_York'
    ```

The following `CONFIG` values are also important and have pre-filled values that you might need to adjust or understand:

*   `SPREADSHEET_ID`: This is the ID of the Google Sheet where your 'Leads' and 'Logs' data will be stored.
    *   The provided value `'1nAn6J_FZr8pnvxn6uzRGM4jAYIWeiUOw0i8X0MEReN4'` is likely a placeholder from development.
    *   **Action:** Create a new Google Sheet for this system. Copy the ID from its URL (e.g., in `https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit`, `THIS_IS_THE_ID` is the ID). Paste this ID into the `SPREADSHEET_ID` field.
*   `SLACK_WEBHOOK_URL` (Optional): If you plan to use Slack alerts:
    *   Replace the placeholder URL (e.g., `'https://hooks.slack.com/services/...'` or `"YOUR_SLACK_WEBHOOK_URL_IF_USING"`) with your actual Slack Incoming Webhook URL.
    *   If you don't use Slack, ensure this is set to an empty string (`''`) or a placeholder value like `"YOUR_SLACK_WEBHOOK_URL"` to prevent errors and skip Slack notifications.
*   `CALENDLY_SIGNING_KEY`: This key (`'ar4IECr0BU-Tl850T9JU60ro4z5XVV76wt4d5T131Eo'`) is used by the script to log information about the signature received from Calendly. For actual signature verification (which is a more advanced setup not fully implemented for verification in this version, only logging), Calendly would need to sign its webhook requests with this exact key, or you'd use a key provided by Calendly. For now, it's primarily for logging and debugging.

**D. Authorizations:**

When you first run functions that interact with Google services (like sending emails, accessing sheets, creating calendar events) or external services (like Gemini API or Slack via `UrlFetchApp`), Google Apps Script will prompt you for authorization.
*   A dialog box will appear: "Authorization required".
*   Click "Review Permissions".
*   Choose your Google account.
*   You might see a "Google hasn’t verified this app" screen. This is normal for personal Apps Script projects. Click "Advanced", then click "Go to [Your Project Name] (unsafe)".
*   Review the permissions the script needs (e.g., access Gmail, Google Sheets, Google Calendar, connect to external services). Click "Allow".

**E. Initial Setup Functions (Run Manually from Apps Script Editor):**

From the Apps Script editor, you need to run two functions once to prepare the system:
1.  **Run `initializeSheets()`:**
    *   In the toolbar, select `initializeSheets` from the function dropdown menu (it might say `Select function`).
    *   Click the "Run" button (looks like a play icon).
    *   This will create the 'Leads' and 'Logs' sheets (with frozen header rows) in the Google Sheet you specified in `CONFIG.SPREADSHEET_ID`. Open your Google Sheet to verify they are created correctly.
2.  **Run `setupTriggers()`:**
    *   Select `setupTriggers` from the function dropdown.
    *   Click "Run".
    *   This will delete any old triggers associated with the project and create the new time-based triggers for the automated functions (`dailyEmailBatch`, `followUpEmails`, `processReplies`, `cleanupLeads`).
    *   You can verify the triggers by clicking on the "Triggers" icon (looks like a clock) on the left sidebar of the Apps Script editor.

**F. Deploy Web App (for Calendly Webhook):**

The Calendly integration requires a Web App URL. When a lead books an appointment, Calendly sends a notification (webhook) to this URL.
1.  In the Apps Script Editor, click the "Deploy" button (usually in the top right).
2.  Select "New deployment".
3.  Next to "Select type", click the gear icon and choose "Web app".
4.  **Description:** Enter a description, for example, "Calendly Webhook for Auto Email Sender v1".
5.  **Execute as:** Select "Me ([your email address])". This means the script runs with your permissions.
6.  **Who has access:** Select "Anyone". **This is crucial.** Calendly's servers need to be able to reach this URL without requiring a Google login. The URL is long and unguessable, providing security through obscurity. The `doPost` function is also designed to only process valid Calendly events.
7.  Click "Deploy".
8.  After deployment, Google will provide a **Web app URL**. Copy this URL. You'll need it for the next step.

**G. Setup Calendly Webhook:**

You need to configure Calendly to send "invitee.created" event notifications to your deployed Web App URL.

*   **Method 1: Programmatic Setup (Recommended, using functions in `Setup.gs`)**
    1.  **Obtain Calendly Personal Access Token (PAT):**
        *   Log in to your Calendly account.
        *   Navigate to "Integrations" (or your account settings where API tokens are managed).
        *   Find the "API & Webhooks" section or similar.
        *   Generate a new Personal Access Token (PAT). **Copy this token immediately and store it securely.** You won't be able to see it again.
    2.  **Run `getCalendlyOrganizationUri`:**
        *   Go to the `Setup.gs` file in your Apps Script editor.
        *   You'll need to pass your PAT to this function. The easiest way to do this for a one-time run is to temporarily modify a line in the script or create a temporary helper function. For example, add a new function in any `.gs` file:
            ```javascript
            function runGetOrgUri() {
              getCalendlyOrganizationUri("YOUR_CALENDLY_PERSONAL_ACCESS_TOKEN_HERE");
            }
            ```
            Replace the placeholder with your actual PAT.
        *   Select `runGetOrgUri` from the function dropdown and click "Run".
        *   The Organization URI will be shown in a dialog box or in the execution logs (View > Logs). **Copy this Organization URI.**
    3.  **Run `createCalendlyWebhookSubscription`:**
        *   Similar to the step above, prepare to run this function by providing your PAT, the Organization URI you just copied, and the Web App URL from Step F. Example helper function:
            ```javascript
            function runCreateWebhook() {
              createCalendlyWebhookSubscription(
                "YOUR_CALENDLY_PERSONAL_ACCESS_TOKEN_HERE",
                "COPIED_ORGANIZATION_URI_FROM_PREVIOUS_STEP",
                "YOUR_DEPLOYED_WEB_APP_URL_FROM_STEP_F"
              );
            }
            ```
        *   Replace placeholders with your actual values.
        *   Select `runCreateWebhook` from the function dropdown and click "Run".
        *   Check the dialog box or execution logs for a success message.

*   **Method 2: Manual Setup (In Calendly UI)**
    1.  Log in to your Calendly account.
    2.  Navigate to "Integrations", then find the "API & Webhooks" section.
    3.  Look for "Webhook Subscriptions" and click "Add Webhook" or a similar option.
    4.  **Webhook URL:** Paste the Web App URL you copied during deployment (Step F).
    5.  **Events:** Select or input the event type: `invitee.created`.
    6.  **Signing Key:**
        *   The script has a `CONFIG.CALENDLY_SIGNING_KEY` (e.g., `'ar4IECr0BU-Tl850T9JU60ro4z5XVV76wt4d5T131Eo'`). This key is used by *your script* to attempt to verify the signature of incoming webhooks *if Calendly signs them with this specific key*.
        *   When you create a webhook via the Calendly UI, Calendly usually *generates its own signing key for that subscription and shows it to you*. For your script to then verify the webhook, you would copy the key *Calendly provides* and update `CONFIG.CALENDLY_SIGNING_KEY` in your `Config.gs` file to match it.
        *   If the Calendly UI asks *you* to provide a signing key for *them* to use, that's less common for their standard webhook setup.
        *   **Recommendation for simplicity with manual UI setup:** If Calendly provides you with a signing key, update `CONFIG.CALENDLY_SIGNING_KEY` in your script. If it doesn't, the script's current signature check will primarily log the presence of a signature header and the key configured in `Config.gs`, rather than performing a guaranteed verification unless the keys align. The programmatic setup (Method 1) is generally more robust for API interactions.

## Example Scenario

Here's how the system might work for a single lead:

*   **Day 0:** You add "Laura Chen" (`laura.chen@example.com`, last service: "Website Design") to the 'Leads' sheet with `Status = PENDING`.

*   **Day 1, 9:00 AM (Trigger: `dailyEmailBatch`):**
    *   System picks up Laura Chen.
    *   Gemini API generates a personalized email: "Hi Laura, following up on your interest in Website Design. Would you be open to a free consultation?..."
    *   Email sent. Laura's `Status` -> `SENT`. `Last Contact` updated.
    *   Log: `DailyBatchEmailSent, [Laura's LeadID], laura.chen@example.com, Initial email sent.`

*   **Day 1, 10:30 AM (Laura replies "Yes, sounds interesting! Tell me more."):**
    *   **11:00 AM (Trigger: `processReplies`):**
        *   System detects Laura's unread reply.
        *   Keywords "yes", "interesting" are found.
        *   Laura's `Status` -> `HOT`. `Last Contact` updated.
        *   Email sent to Laura: "Great to hear, Laura! You can book your free consultation here: [Your Calendly Link]".
        *   PR Alert Email sent to `CONFIG.PR_EMAIL`: "NEW CALL - Laura Chen... Service: Website Design, Time: Pending".
        *   Slack Alert (if configured): "New Call Alert! Lead: Laura Chen... Service: Website Design, Time: Pending".
        *   Log: `ProcessRepliesHotLead, [Laura's LeadID], laura.chen@example.com, Lead marked HOT. Calendly link sent. PR alert triggered.`

*   **Day 1, 2:00 PM (Laura clicks the Calendly link and books a call for Day 3, 10:00 AM):**
    *   **2:00 PM (Calendly Webhook -> `doPost(e)` function is triggered immediately):**
        *   System receives webhook from Calendly.
        *   Laura's `Status` -> `BOOKED`. `Last Contact` updated to booking time (Day 3, 10:00 AM).
        *   PR Alert Email sent: "NEW CALL - Laura Chen... Service: Website Design, Time: [Day 3, 10:00 AM Formatted, e.g., 2024-07-17 10:00 EDT]".
        *   Slack Alert: "New Call Alert! Lead: Laura Chen... Service: Website Design, Time: [Day 3, 10:00 AM Formatted]".
        *   Google Calendar event created for Day 3, 10:00 AM - 10:30 AM.
            *   Title: `Free Audit with Laura Chen (Website Design)`
            *   Attendees: `laura.chen@example.com` (receives an invitation).
            *   Description: Includes contact info, service, and Lead ID.
        *   Log: `CalendlyLeadBooked, [Laura's LeadID], laura.chen@example.com, Lead status updated to BOOKED...`
        *   Log: `CALENDAR_EVENT_SUCCESS, [Laura's LeadID], laura.chen@example.com, Created calendar event. ID: [CalendarEventID]`

## Troubleshooting

*   **Check Logs First:** The 'Logs' sheet in your Google Spreadsheet is the primary place to find detailed information about operations, successes, and errors. Look for `ERROR`, `WARNING`, or `CRITICAL` status messages. The `Details` column will provide context.
*   **Authorization Issues:**
    *   If functions seem to fail silently or you see "Authorization required" errors in logs, it might be due to missing permissions.
    *   Manually run a core function (e.g., `dailyEmailBatch` or `sendPRAlert` from the Apps Script editor by selecting it and clicking "Run"). This should trigger an authorization prompt if needed. Follow the steps in "D. Authorizations".
    *   Check the Apps Script Dashboard ([script.google.com](https://script.google.com) -> "My Executions") for a history of script runs, their status, and any error messages.
*   **Triggers Not Running:**
    *   Verify triggers are listed under the "Triggers" section (clock icon on the left sidebar) in the Apps Script editor.
    *   Check their "Last run" time and status. Click the three dots (...) next to a trigger and select "Executions" for a detailed history of that trigger.
    *   Ensure `CONFIG.USER_TIMEZONE` in `Config.gs` is correctly set to your valid IANA timezone. Incorrect timezones can cause triggers to fire at unexpected times.
*   **Emails Not Sending / Content Issues:**
    *   Check your Gmail "Sent" folder to see if emails are being dispatched.
    *   Be aware of your Gmail account's daily sending limits. Personal Gmail accounts have stricter limits than Google Workspace accounts.
    *   Ensure your `CONFIG.GEMINI_API_KEY` is correct, valid, and has available quota. Check the Gemini API console if you suspect quota issues.
    *   Review the prompts in `prompt.gs` if the AI-generated email content is not as expected.
*   **Calendly Webhook Not Working:**
    *   Double-check the deployed Web App URL in your Calendly webhook settings. It must be exact.
    *   Ensure the Web App is deployed with "Who has access: Anyone". If it's set to "Only myself" or users within your domain, Calendly won't be able to reach it.
    *   Check the 'Logs' sheet for `CalendlyWebhookReceived` entries. If these are missing, Calendly isn't successfully sending data to your script.
    *   If `CalendlyWebhookReceived` entries exist but are followed by errors, the logs should indicate the problem (e.g., issue finding the lead, problems with PR alerts or calendar event creation).
    *   You can test your `doPost(e)` function by simulating a POST request (e.g., using a tool like Postman or another script) with a sample Calendly JSON payload for the `invitee.created` event.
*   **Google Calendar Events Not Created:**
    *   Ensure `CalendarApp` service is not disabled for your account.
    *   Check logs for `CALENDAR_EVENT_ERROR` or `CALENDAR_EVENT_SUCCESS`.
    *   Verify the `bookingTime` from Calendly is a valid date format that Apps Script can parse.
*   **`LockService` Errors ("Could not obtain lock"):**
    *   Messages like `DailyBatchLockError`, `ProcessRepliesLockError`, etc., in the logs indicate that a previous instance of the function was still running when a new trigger attempted to start it. This prevents simultaneous executions that could corrupt data.
    *   If these occur frequently, it might mean functions are taking too long to complete (perhaps due to processing many leads, slow API responses from Gemini, or hitting other service limits) or triggers are too frequent for the typical execution time of your functions.
    *   Consider adjusting `CONFIG.EMAIL_BATCH_SIZE` (if applicable to the long-running function) or, as a last resort, slightly reducing the frequency of the problematic trigger if the issue is persistent and impacts core functionality.

---

This README provides a comprehensive guide to setting up, understanding, and troubleshooting the $0 Cost Auto Email Sender. Remember to carefully replace all placeholder values in `Config.gs` with your actual information for the system to function correctly.
