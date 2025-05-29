// File: Config.gs - Centralized configuration storage

const CONFIG = {
  SPREADSHEET_ID: '1nAn6J_FZr8pnvxn6uzRGM4jAYIWeiUOw0i8X0MEReN4', // User Provided
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY', // User to provide
  CALENDLY_LINK: 'YOUR_CALENDLY_LINK', // User to provide - this is the public booking page link
  PR_EMAIL: 'YOUR_PR_EMAIL', // User to provide
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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', // User Provided
  CALENDLY_SIGNING_KEY: 'ar4IECr0BU-Tl850T9JU60ro4z5XVV76wt4d5T131Eo', // User Provided - for webhook verification
  USER_TIMEZONE: 'YOUR_USER_TIMEZONE', // User to provide, e.g., 'America/New_York'
  EMAIL_FOOTER: "Reply STOP to unsubscribe",
  DAILY_EMAIL_QUOTA: 400,
  EMAIL_BATCH_SIZE: 50
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
  INVALID_EMAIL: 'INVALID_EMAIL' // Added as per user feedback discussions
};

// To make CONFIG accessible if script properties are used later for some values
// const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
// For example: CONFIG.GEMINI_API_KEY = SCRIPT_PROPERTIES.getProperty('GEMINI_API_KEY');
// User would then need to set these in File > Project properties > Script properties
