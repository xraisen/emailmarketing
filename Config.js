// File: Config.gs - Centralized configuration storage

const CONFIG = {
  SPREADSHEET_ID: '1nAn6J_FZr8pnvxn6uzRGM4jAYIWeiUOw0i8X0MEReN4', // User Provided. Example: 'your_spreadsheet_id_here'
  GEMINI_API_KEY: 'AIzaSyDNne2JbGbYMjUViZsMsb4uyeBkkNSi3Uo', // User MUST provide their Gemini API Key.
  CALENDLY_LINK: 'https://calendly.com/raisencross/30min', // User MUST provide their public Calendly booking page link. Example: 'https://calendly.com/your_username/30min'
  PR_EMAIL: 'raisencross@gmail.com', // User MUST provide the email address for PR/Notification alerts.
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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', // User Provided (Optional). Example: 'https://hooks.slack.com/services/YOUR/SLACK/TOKEN' or '' if not used.
  CALENDLY_SIGNING_KEY: 'ar4IECr0BU-Tl850T9JU60ro4z5XVV76wt4d5T131Eo', // User Provided. This is from Calendly when setting up a webhook, used to verify webhook authenticity.

  // New / Updated fields for programmatic Calendly webhook setup
  CALENDLY_PERSONAL_ACCESS_TOKEN: 'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzQ4NDg3NTk0LCJqdGkiOiI1YjVkY2QxNy05YTUxLTQ4YWItODNjMS1mOGY5M2Y0YjhlNjYiLCJ1c2VyX3V1aWQiOiI2ZWQ2MTZjYS1jNzBmLTRmYjctYjM4YS1mNjJlNjE5YjQyZWYifQ.t-SVxLG-f24wSsLRYER7H6o-WY_jTACEYEpP2gs2mPIKRHe9lcV_K3bkoiLQyX8JGGLElci2PLdLyN7U5nhaQA', // User MUST replace this with their real Calendly Personal Access Token.
  ORGANIZATION_URI: 'https://api.calendly.com/organizations/e53097fd-c381-4d5d-831f-b4318121ad2b', // User will replace this after running getCalendlyOrganizationUri(), or can get it from Calendly admin panel.

  USER_TIMEZONE: 'America/New_York', // User MUST provide their IANA timezone. Example: 'America/New_York', 'Europe/London'.
  EMAIL_FOOTER: "Reply STOP to unsubscribe", // Standard email footer.
  DAILY_EMAIL_QUOTA: 400, // Max initial emails to send per day via dailyEmailBatch.
  EMAIL_BATCH_SIZE: 50, // Number of sheet updates to batch before flushing (affects multiple functions).

  AI_SERVICES_PROFILE: {
    "Google Ads Management": {
      keywords: ["google ads", "ppc", "adwords", "campaigns", "performance max", "ad spend"],
      description: "Expert Google Ads management including Search, Display, and Performance Max campaigns, focusing on strategy, optimization, and results.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min"
    },
    "GMC/Feed Management": {
      keywords: ["gmc", "merchant center", "feed disapproval", "product feed", "shopping ads"],
      description: "Specialized in fixing Google Merchant Center feed disapprovals, optimizing product feeds for better ad placements, and setting up GMC for new stores.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min"
    },
    "Web Design & Development": {
      keywords: ["website", "web design", "web development", "landing page", "cms", "wordpress", "shopify"],
      description: "Full-stack web design and development, creating responsive websites, high-converting landing pages, and full CMS builds (WordPress, Shopify, custom).",
      calendlyLink: "https://calendly.com/jose-web-design/30min"
    },
    // TODO: Add other core services from your list (Funnels, AI Automation, Tech Strategy)
    // For now, let's add placeholders for them.
    "Funnels": {
      keywords: ["funnels", "sales funnel", "lead generation funnel", "clickfunnels"],
      description: "Design and implementation of high-converting sales and lead generation funnels.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link
    },
    "AI Automation": {
      keywords: ["ai automation", "chatbots", "ai agents", "workflow automation"],
      description: "Implementing AI-driven automation solutions to streamline business processes.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link
    },
    "Tech Strategy": {
      keywords: ["tech strategy", "digital transformation", "it consulting", "saas integration"],
      description: "Providing strategic advice on technology adoption and digital transformation.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link
    },
    "Generic Inquiry": { // Fallback
      keywords: [],
      description: "General discussion about digital marketing needs and how I can help your business grow.",
      calendlyLink: CONFIG.CALENDLY_LINK // Default link
    }
  }
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
  INVALID_EMAIL: 'INVALID_EMAIL', // For leads with improperly formatted email addresses.
  NEEDS_MANUAL_REVIEW: 'NEEDS_MANUAL_REVIEW' // Added for leads requiring manual attention
};

// To make CONFIG accessible if script properties are used later for some values:
// const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
// For example, to set GEMINI_API_KEY via script properties:
// 1. Go to File > Project properties > Script properties.
// 2. Add a property with the name "GEMINI_API_KEY" and its value.
// 3. Uncomment the line below and the relevant line for GEMINI_API_KEY in the CONFIG object.
// CONFIG.GEMINI_API_KEY = SCRIPT_PROPERTIES.getProperty('GEMINI_API_KEY') || 'YOUR_GEMINI_API_KEY_FALLBACK_IF_NOT_SET';
// This approach can be more secure for sensitive keys if the script is shared.
