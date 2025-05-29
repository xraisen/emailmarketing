// File: Config.gs - Centralized configuration storage

const CONFIG = {
  SPREADSHEET_ID: '1nAn6J_FZr8pnvxn6uzRGM4jAYIWeiUOw0i8X0MEReN4', // User Provided. Example: 'your_spreadsheet_id_here'
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY', // User MUST provide their Gemini API Key.
  CALENDLY_LINK: 'YOUR_CALENDLY_LINK', // User MUST provide their public Calendly booking page link. Example: 'https://calendly.com/your_username/30min'
  PR_EMAIL: 'YOUR_PR_EMAIL', // User MUST provide the email address for PR/Notification alerts.
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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', // User Provided (Optional). Example: 'https://hooks.slack.com/services/YOUR/SLACK/TOKEN' or '' if not used.
  CALENDLY_SIGNING_KEY: 'ar4IECr0BU-Tl850T9JU60ro4z5XVV76wt4d5T131Eo', // User Provided. This is from Calendly when setting up a webhook, used to verify webhook authenticity.

  // New / Updated fields for programmatic Calendly webhook setup
  CALENDLY_PERSONAL_ACCESS_TOKEN: 'YOUR_ACTUAL_PERSONAL_ACCESS_TOKEN_REPLACE_ME', // User MUST replace this with their real Calendly Personal Access Token.
  ORGANIZATION_URI: 'YOUR_ORGANIZATION_URI_FROM_API_REPLACE_ME', // User will replace this after running getCalendlyOrganizationUri(), or can get it from Calendly admin panel.

  USER_TIMEZONE: 'YOUR_USER_TIMEZONE', // User MUST provide their IANA timezone. Example: 'America/New_York', 'Europe/London'.
  EMAIL_FOOTER: "Reply STOP to unsubscribe", // Standard email footer.
  DAILY_EMAIL_QUOTA: 400, // Max initial emails to send per day via dailyEmailBatch.
  EMAIL_BATCH_SIZE: 50 // Number of sheet updates to batch before flushing (affects multiple functions).
};

const LEADS_SHEET_NAME = 'Leads';
const LOGS_SHEET_NAME = 'Logs';

const STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FOLLOW_UP_1: 'FOLLOW_UP_1',
  HOT: 'HOT',
  UNQUALIFIED: 'UNQUALIFIED',
  BOOKED: 'BOOKED',
  ABANDONED: 'ABANDONED',
  INVALID_EMAIL: 'INVALID_EMAIL' // For leads with improperly formatted email addresses.
};

// To make CONFIG accessible if script properties are used later for some values:
// const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
// For example, to set GEMINI_API_KEY via script properties:
// 1. Go to File > Project properties > Script properties.
// 2. Add a property with the name "GEMINI_API_KEY" and its value.
// 3. Uncomment the line below and the relevant line for GEMINI_API_KEY in the CONFIG object.
// CONFIG.GEMINI_API_KEY = SCRIPT_PROPERTIES.getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY_FALLBACK_IF_NOT_SET';
// This approach can be more secure for sensitive keys if the script is shared.I have successfully updated the `Config.gs` file.

The changes include:
1.  Added `CALENDLY_PERSONAL_ACCESS_TOKEN: 'YOUR_ACTUAL_PERSONAL_ACCESS_TOKEN_REPLACE_ME'` to the `CONFIG` object.
2.  Added `ORGANIZATION_URI: 'YOUR_ORGANIZATION_URI_FROM_API_REPLACE_ME'` to the `CONFIG` object.
3.  Ensured these new keys are clearly commented as requiring user input.
4.  Verified that no hardcoded example tokens (like the `eyJraWQiOi...` example) are present for these new keys.
5.  Added more descriptive comments for other user-provided fields like `SPREADSHEET_ID`, `GEMINI_API_KEY`, `CALENDLY_LINK`, `PR_EMAIL`, `SLACK_WEBHOOK_URL`, and `USER_TIMEZONE` to guide the user.
6.  Clarified the role of `CALENDLY_SIGNING_KEY`.
7.  Enhanced comments for `DAILY_EMAIL_QUOTA` and `EMAIL_BATCH_SIZE`.
8.  Improved the comments regarding the use of `PropertiesService` for potentially more secure key management.

The `CONFIG` object now correctly reflects the new additions with appropriate placeholders and comments.
