# AI-Powered Sales Assistant - Google Apps Script Project

## 1. Project Overview

This Google Apps Script project automates and enhances email outreach and follow-up processes for sales prospecting. It leverages the Gemini AI to understand prospect replies, generate context-aware responses, and manage lead progression through various engagement stages. The system aims to act as an intelligent assistant, handling initial outreach, processing replies with nuanced understanding, and flagging leads that require manual attention.

## 2. Key Features

*   **AI-Driven Reply Processing**: Uses Gemini to classify prospect replies, identifying interested services, key concerns, sentiment, and AI's confidence in the classification.
*   **Contextual AI Follow-Ups**: Generates personalized follow-up emails based on the AI's understanding of the prospect's reply and past interaction history.
*   **Interaction Memory**: Maintains a history of interactions (from logs and Gmail threads) to provide context to the AI for more coherent and relevant communication.
*   **Manual Review Workflow**: Flags leads for manual review (`NEEDS_MANUAL_REVIEW` status) based on low AI confidence, negative/neutral sentiment for generic inquiries, or AI failures, with email notifications to admin.
*   **Automated Initial Outreach**: Sends initial cold emails via `dailyEmailBatch`.
*   **Automated Generic Follow-Ups**: Sends timed follow-up emails if no reply is received after initial outreach.
*   **Standardized Plain Text Emails**: Ensures all emails are well-formatted plain text for readability and professionalism.
*   **Lead Management**: Tracks lead statuses (Pending, Sent, Hot, Unqualified, Booked, Abandoned, Needs Manual Review) in a Google Sheet.
*   **Logging**: Comprehensive logging of actions, AI interactions, and errors to a dedicated Google Sheet.
*   **Testing Framework**: Includes a suite of unit and integration tests for key functionalities.

## 3. File Structure Overview

*   **`Config.js`**: Central configuration file for all settings (Spreadsheet ID, API Keys, Calendly links, service profiles, email footer, status definitions, etc.). **User MUST update this file.**
*   **`Utilities.js`**: Contains helper functions for tasks like data retrieval from sheets, string manipulation (truncation, formatting), interaction history generation, and a fallback logger.
*   **`prompt.js`**: Defines functions that generate the detailed instructional prompts for the Gemini AI for various tasks (classification, email generation). Includes plain text formatting standards.
*   **`automated_email_sender.js`**: Houses the core logic for AI interactions (`getAIEmailContent`, `classifyProspectReply`, `generateAIContextualFollowUp`), email sending (`sendEmail`), initial outreach (`dailyEmailBatch`), and reply processing (`processReplies`).
*   **`automated_email_followup.js`**: Manages the sending of generic follow-up emails (`followUpEmails`) and lead cleanup (`cleanupLeads`).
*   **`automated_calendly.js`**: (Assumed from project context, may not be directly modified by this AI) Handles Calendly webhook events to update lead statuses to 'BOOKED'.
*   **`TestFramework.js`**: Contains the testing infrastructure, mock objects, and all test functions for the project.
*   **`appsscript.json`**: The Apps Script manifest file, defining project properties, scopes, and triggers.
*   **`README.md`**: This file - project documentation.

## 4. Setup Instructions

### 4.1. Copying the Project
1.  Make a copy of this Google Apps Script project.
2.  Open the copied project.

### 4.2. Configuration (`Config.js`)
Open the `Config.js` file and **update the following constants** with your specific information:
*   `CONFIG.SPREADSHEET_ID`: The ID of your Google Sheet where lead and log data will be stored.
*   `CONFIG.GEMINI_API_KEY`: Your API key for the Gemini AI model.
*   `CONFIG.CALENDLY_LINK`: Your default Calendly booking link.
*   `CONFIG.PR_EMAIL`: The email address for receiving important notifications (e.g., for leads needing manual review, PR alerts).
*   `CONFIG.AI_SERVICES_PROFILE`: Review and update the service definitions, keywords, descriptions, and specific Calendly links to match your offerings.
*   *(Optional)* `CONFIG.SLACK_WEBHOOK_URL`: If you want Slack notifications.
*   *(Optional but Recommended for Calendly Integration)* `CONFIG.CALENDLY_SIGNING_KEY`, `CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN`, `CONFIG.ORGANIZATION_URI`.
*   Other settings like `USER_TIMEZONE`, `DAILY_EMAIL_QUOTA` can be reviewed and adjusted as needed.

### 4.3. Google Sheet Setup
1.  Create a new Google Spreadsheet (or use an existing one) and note its ID for `Config.js`.
2.  **Create two sheets** within this spreadsheet with the exact names:
    *   `Leads` (as defined in `LEADS_SHEET_NAME` in `Config.js`)
    *   `Logs` (as defined in `LOGS_SHEET_NAME` in `Config.js`)
3.  **Essential Columns for "Leads" sheet**:
    *   `Lead ID` (Text)
    *   `First Name` (Text)
    *   `Email` (Text)
    *   `Last Service` (Text - e.g., the service initially pitched)
    *   `Status` (Text - will be populated by the script, e.g., PENDING, SENT, HOT)
    *   `Last Contact` (Date/Time - updated by script)
    *   `Phone` (Text - optional, used in PR alerts)
    *   *(Other columns can be added as needed for your own tracking)*
4.  **Essential Columns for "Logs" sheet**:
    *   `Timestamp` (Date/Time)
    *   `Action` (Text - e.g., DailyBatchStart, SendEmailSuccess, ProcessRepliesAIFollowUp)
    *   `Lead ID` (Text)
    *   `Email` (Text)
    *   `Details` (Text - details of the action or error message)
    *   `Status` (Text - e.g., SUCCESS, ERROR, INFO, WARNING)

### 4.4. Apps Script Project Setup
1.  **Services**: Ensure the following Google services are enabled (usually by default): Gmail, Sheets, UrlFetch, LockService, Script.
2.  **Permissions (Scopes)**: When you first run a function that requires authorization (e.g., sending an email), Google will prompt you to authorize the script. Review the requested permissions. Key scopes used include:
    *   `https://www.googleapis.com/auth/script.external_request` (for UrlFetch to call Gemini API)
    *   `https://www.googleapis.com/auth/spreadsheets` (to read/write to your Google Sheet)
    *   `https://www.googleapis.com/auth/gmail.send` (to send emails)
    *   `https://www.googleapis.com/auth/gmail.readonly` (to read replies)
    *   `https://www.googleapis.com/auth/script.send_mail` (potentially for error notifications if `MailApp` is used, though `GmailApp` is primary for prospect emails)
    *   `https://www.googleapis.com/auth/script.scriptapp` (for triggers, webhooks if used for Calendly)
    *   `https://www.googleapis.com/auth/script.storage` (if script properties are used)
    *   `https://www.googleapis.com/auth/script.container.ui` (if a UI is ever added)

### 4.5. Triggers
Set up time-driven triggers for the main automation functions:
1.  Go to "Triggers" (clock icon) in the Apps Script editor.
2.  Click "Add Trigger".
3.  For `dailyEmailBatch`: Choose event source "Time-driven", select a time of day (e.g., every morning).
4.  For `processReplies`: Choose event source "Time-driven", select a frequency (e.g., every hour or every 15 minutes).
5.  For `followUpEmails` (and `cleanupLeads` if separate): Choose event source "Time-driven", select a frequency (e.g., daily).

## 5. How to Run Tests
1.  Open `TestFramework.js` in the Apps Script editor.
2.  Select the function `masterTestRunner` (or `runAllTests`) from the function dropdown menu at the top.
3.  Click the "Run" button (play icon).
4.  View logs (`Ctrl+Enter` or `Cmd+Enter`) to see test results (PASS/FAIL messages).

## 6. Core Workflows

### 6.1. Initial Email Outreach (`dailyEmailBatch`)
- Runs on a daily trigger.
- Fetches leads with "PENDING" status from the "Leads" sheet.
- Generates a concise, AI-written cold email using `getInitialEmailPrompt`.
- Sends the email via `GmailApp`.
- Updates lead status to "SENT" and logs the action.

### 6.2. Reply Processing (`processReplies`)
- Runs on a frequent trigger (e.g., hourly).
- Fetches unread emails.
- Matches sender to leads in the "Leads" sheet (status "SENT" or "FOLLOW_UP_1").
- Handles opt-outs ("stop", "unsubscribe").
- Retrieves interaction history using `getLeadInteractionHistory`.
- Uses `classifyProspectReply` (Gemini AI) to analyze reply content for service interest, key concerns, sentiment, and AI confidence.
- Based on AI classification:
    - **Negative Sentiment**: Marks lead "UNQUALIFIED".
    - **Low Confidence / Generic / AI Failure**: Marks lead "NEEDS_MANUAL_REVIEW" and sends an admin notification.
    - **Positive/Neutral Specific Interest (Good Confidence)**:
        - Generates a contextual follow-up email using `generateAIContextualFollowUp`.
        - Sends the AI-generated email with appropriate Calendly link.
        - Marks lead "HOT" and sends an admin PR alert.
- Logs all actions and AI interactions.

### 6.3. Generic Follow-Ups (`followUpEmails`)
- Runs on a daily trigger.
- Identifies leads in "SENT" status who haven't been contacted for a set period (e.g., 7 days).
- Generates a concise AI follow-up email using `getFollowUpEmailPrompt`.
- Sends the email and updates status to "FOLLOW_UP_1".

---
*Make sure to regularly monitor the "Logs" sheet for system activity and any errors.*
