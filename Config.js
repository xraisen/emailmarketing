/**
 * @file Config.js
 * @description Centralized configuration for the AI Sales Assistant Google Apps Script project.
 * All user-specific settings, API keys, and global constants are defined here.
 * Ensure all "User MUST provide" or "User Provided" values are correctly set before running the script.
 */
/**
 * @file Config.js
 * @description Centralized configuration for the AI Sales Assistant Google Apps Script project.
 * All user-specific settings, API keys, and global constants are defined here.
 * Ensure all "User MUST provide" or "User Provided" values are correctly set before running the script.
 */

const CONFIG = {
  /** 
   * @type {string} System-defined. Name of the sheet where leads are stored.
   * Used during initialization to reference the correct sheet in the spreadsheet.
   */
  LEADS_SHEET_NAME: 'Leads', // Default name for the Leads sheet

  /** 
   * @type {string} User MUST provide. The ID of the Google Spreadsheet used for storing leads, logs, and configurations.
   * @example 'your_spreadsheet_id_here' 
   */
  SPREADSHEET_ID: '1nAn6J_FZr8pnvxn6uzRGM4jAYIWeiUOw0i8X0MEReN4', 

  /** 
   * @type {string} User MUST provide. Your Google Gemini API Key for AI content generation.
   */
  GEMINI_API_KEY: 'AIzaSyDNne2JbGbYMjUViZsMsb4uyeBkkNSi3Uo', 

  /** 
   * @type {string} User MUST provide. Your main public Calendly booking page link. Used as a default if service-specific links aren't found.
   * @example 'https://calendly.com/your_username/30min' 
   */
  CALENDLY_LINK: 'https://calendly.com/raisencross/30min', // Your main public Calendly booking page link
  
  /**
   * @type {Object} User MUST provide. Service categories for lead classification.
   * Each category has keywords for email matching, a description, and a Calendly link.
   */
  SERVICE_CATEGORIES: {
    "Google Ads Management": {
      keywords: ["google ads", "ppc", "adwords", "campaigns", "performance max", "ad spend", "search ads", "display ads"],
      description: "Expert Google Ads management including Search, Display, and Performance Max campaigns, focusing on strategy, optimization, and results-driven advertising to maximize ROI.",
      calendlyLink: CONFIG.CALENDLY_LINK
    },
    "GMC/Feed Management": {
      keywords: ["gmc", "merchant center", "feed disapproval", "product feed", "shopping ads", "data feed"],
      description: "Specialized in fixing Google Merchant Center feed disapprovals, optimizing product feeds for better ad placements and performance in Shopping Ads, and setting up GMC for new stores.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min"
    },
    "Web Design & Development": {
      keywords: ["website", "web design", "web development", "landing page", "cms", "wordpress", "shopify", "e-commerce site", "responsive design"],
      description: "Full-stack web design and development services, creating responsive and user-friendly websites, high-converting landing pages, and complete CMS builds (WordPress, Shopify, custom solutions).",
      calendlyLink: "https://calendly.com/jose-web-design/30min"
    },
    "Funnels": {
      keywords: ["funnels", "sales funnel", "lead generation funnel", "clickfunnels", "marketing funnel", "conversion funnel"],
      description: "Design and implementation of high-converting sales and lead generation funnels, including strategy, copywriting, and technical setup to nurture leads and drive sales.",
      calendlyLink: CONFIG.CALENDLY_LINK
    },
    "AI Automation": {
      keywords: ["ai automation", "chatbots", "ai agents", "workflow automation", "zapier", "make.com", "integromat", "process automation"],
      description: "Implementing AI-driven automation solutions and custom workflow automations (e.g., using Zapier, Make.com, or custom scripts) to streamline business processes and improve efficiency.",
      calendlyLink: CONFIG.CALENDLY_LINK
    },
    "Tech Strategy": {
      keywords: ["tech strategy", "digital transformation", "it consulting", "saas integration", "crm strategy", "technology roadmap"],
      description: "Providing strategic advice on technology adoption, digital transformation initiatives, SaaS integration, and developing comprehensive technology roadmaps for business growth.",
      calendlyLink: CONFIG.CALENDLY_LINK
    },
    /** 
     * Fallback service profile. Used when the AI cannot clearly identify a specific service 
     * from the prospect's reply or if the inquiry is general.
     */
    "Generic Inquiry": { 
      keywords: [], // Typically empty as it's a fallback
      description: "General discussion about digital marketing needs, technical challenges, or other inquiries where a specific service isn't immediately identifiable. Happy to explore how I can help your business grow.",
      calendlyLink: this.CALENDLY_LINK // ✅ Fixed: Use this.CALENDLY_LINK instead of CALENDLY_LINK
    }
  },
  /** 
   * @type {string} User MUST provide. The email address for receiving important notifications from the system (e.g., leads needing manual review, errors).
   */
  PR_EMAIL: 'raisencross@gmail.com', 

  /** 
   * @type {string} User Provided (Optional). Your Slack Webhook URL for sending notifications to a Slack channel.
   * Leave empty ('') if not used.
   * @example 'https://hooks.slack.com/services/YOUR/SLACK/TOKEN' 
   */
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/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',

  /** 
   * @type {string} User Provided. The signing key from your Calendly webhook settings. Used to verify that incoming webhook requests are genuinely from Calendly.
   */
  CALENDLY_SIGNING_KEY: 'ar4IECr0BU-Tl850T9JU60ro4z5XVV76wt4d5T131Eo', 

  /** 
   * @type {string} User MUST provide. Your Calendly Personal Access Token (PAT). Required for programmatic management of Calendly webhooks (e.g., setup, deletion).
   */
  CALENDLY_PERSONAL_ACCESS_TOKEN: 'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzQ4NDg3NTk0LCJqdGkiOiI1YjVkY2QxNy05YTUxLTQ4YWItODNjMS1mOGY5M2Y0YjhlNjYiLCJ1c2VyX3V1aWQiOiI2ZWQ2MTZjYS1jNzBmLTRmYjctYjM4YS1mNjJlNjE5YjQyZWYifQ.t-SVxLG-f24wSsLRYER7H6o-WY_jTACEYEpP2gs2mPIKRHe9lcV_K3bkoiLQyX8JGGLElci2PLdLyN7U5nhaQA', 

  /** 
   * @type {string} User Provided (Can be auto-discovered by `getCalendlyOrganizationUri()` in Setup.js). Your Calendly Organization URI. Required for webhook setup.
   * @example 'https://api.calendly.com/organizations/YOUR_ORG_UUID'
   */
  ORGANIZATION_URI: 'https://api.calendly.com/organizations/e53097fd-c381-4d5d-831f-b4318121ad2b', 

  /** 
   * @type {string} User MUST provide. Your IANA timezone name. Used for correct date/time handling in logs and scheduling.
   * @example 'America/New_York', 'Europe/London'
   */
  USER_TIMEZONE: 'America/New_York', 

  /** 
   * @type {string} System-defined. Standard email footer for unsubscribe compliance. Appended by the system to outgoing emails.
   */
  EMAIL_FOOTER: "Reply STOP to unsubscribe", 

  /** 
   * @type {number} System-defined. Maximum number of initial cold emails to send per day via the `dailyEmailBatch` function.
   */
  DAILY_EMAIL_QUOTA: 400, 

  /** 
   * @type {number} System-defined. Number of sheet updates to batch together before flushing changes to Google Sheets. Affects multiple functions.
   */
  EMAIL_BATCH_SIZE: 50, 

}

/**
 * Safely gets a value from the CONFIG object.
 * @param {string} key The key to get from CONFIG.
 * @param {*} [defaultValue=undefined] The default value to return if the key doesn't exist.
 * @return {*} The value from CONFIG or defaultValue.
 */
function getConfigValue(key, defaultValue = undefined) {
  return (typeof CONFIG !== 'undefined' && CONFIG !== null && key in CONFIG) ? CONFIG[key] : defaultValue;
}

// Export CONFIG as a module property for ES6 module compatibility
if (typeof module !== 'undefined') {
  module.exports = { CONFIG, getConfigValue };
}
