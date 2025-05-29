/**
 * @file Config.js
 * @description Centralized configuration for the AI Sales Assistant Google Apps Script project.
 * All user-specific settings, API keys, and global constants are defined here.
 * Ensure all "User MUST provide" or "User Provided" values are correctly set before running the script.
 */

const CONFIG = {
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
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min" // Specific link for Google Ads consultations
    },
    "GMC/Feed Management": {
      keywords: ["gmc", "merchant center", "feed disapproval", "product feed", "shopping ads", "data feed"],
      description: "Specialized in fixing Google Merchant Center feed disapprovals, optimizing product feeds for better ad placements and performance in Shopping Ads, and setting up GMC for new stores.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min" // Specific link for GMC/Feed consultations
    },
    "Web Design & Development": {
      keywords: ["website", "web design", "web development", "landing page", "cms", "wordpress", "shopify", "e-commerce site", "responsive design"],
      description: "Full-stack web design and development services, creating responsive and user-friendly websites, high-converting landing pages, and complete CMS builds (WordPress, Shopify, custom solutions).",
      calendlyLink: "https://calendly.com/jose-web-design/30min" // Specific link for Web Design/Dev consultations
    },
    "Funnels": {
      keywords: ["funnels", "sales funnel", "lead generation funnel", "clickfunnels", "marketing funnel", "conversion funnel"],
      description: "Design and implementation of high-converting sales and lead generation funnels, including strategy, copywriting, and technical setup to nurture leads and drive sales.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    "AI Automation": {
      keywords: ["ai automation", "chatbots", "ai agents", "workflow automation", "zapier", "make.com", "integromat", "process automation"],
      description: "Implementing AI-driven automation solutions and custom workflow automations (e.g., using Zapier, Make.com, or custom scripts) to streamline business processes and improve efficiency.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    "Tech Strategy": {
      keywords: ["tech strategy", "digital transformation", "it consulting", "saas integration", "crm strategy", "technology roadmap"],
      description: "Providing strategic advice on technology adoption, digital transformation initiatives, SaaS integration, and developing comprehensive technology roadmaps for business growth.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    /** 
     * Fallback service profile. Used when the AI cannot clearly identify a specific service 
     * from the prospect's reply or if the inquiry is general.
     */
    "Generic Inquiry": { 
      keywords: [], // Typically empty as it's a fallback
      description: "General discussion about digital marketing needs, technical challenges, or other inquiries where a specific service isn't immediately identifiable. Happy to explore how I can help your business grow.",
      calendlyLink: CONFIG.CALENDLY_LINK // Uses the default/general Calendly link
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

  /**
   * @type {Object<string, {keywords: string[], description: string, calendlyLink: string}>}
   * @description Defines the profile of AI services offered. This object is crucial for the AI to:
   * 1. Identify which service(s) a prospect's reply relates to.
   * 2. Understand the context of each service to generate relevant follow-up emails.
   * 3. Provide specific Calendly links for services if available.
   * 
   * Each key in this object is a string representing the service name (e.g., "Google Ads Management").
   * The value for each service name is an object with the following properties:
   * - `keywords`: An array of strings. These keywords help the AI associate a prospect's inquiry with this service. Include common terms, synonyms, and related technologies.
   * - `description`: A string providing a detailed explanation of the service. This description is used in AI prompts to give context when generating emails related to this service.
   * - `calendlyLink`: A string. The specific Calendly booking link for this particular service. If a prospect is interested in this service, this link will be prioritized.
   */
  AI_SERVICES_PROFILE: {
    "Google Ads Management": {
      keywords: ["google ads", "ppc", "adwords", "campaigns", "performance max", "ad spend", "search ads", "display ads"],
      description: "Expert Google Ads management including Search, Display, and Performance Max campaigns, focusing on strategy, optimization, and results-driven advertising to maximize ROI.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min" // Specific link for Google Ads consultations
    },
    "GMC/Feed Management": {
      keywords: ["gmc", "merchant center", "feed disapproval", "product feed", "shopping ads", "data feed"],
      description: "Specialized in fixing Google Merchant Center feed disapprovals, optimizing product feeds for better ad placements and performance in Shopping Ads, and setting up GMC for new stores.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min" // Specific link for GMC/Feed consultations
    },
    "Web Design & Development": {
      keywords: ["website", "web design", "web development", "landing page", "cms", "wordpress", "shopify", "e-commerce site", "responsive design"],
      description: "Full-stack web design and development services, creating responsive and user-friendly websites, high-converting landing pages, and complete CMS builds (WordPress, Shopify, custom solutions).",
      calendlyLink: "https://calendly.com/jose-web-design/30min" // Specific link for Web Design/Dev consultations
    },
    "Funnels": {
      keywords: ["funnels", "sales funnel", "lead generation funnel", "clickfunnels", "marketing funnel", "conversion funnel"],
      description: "Design and implementation of high-converting sales and lead generation funnels, including strategy, copywriting, and technical setup to nurture leads and drive sales.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    "AI Automation": {
      keywords: ["ai automation", "chatbots", "ai agents", "workflow automation", "zapier", "make.com", "integromat", "process automation"],
      description: "Implementing AI-driven automation solutions and custom workflow automations (e.g., using Zapier, Make.com, or custom scripts) to streamline business processes and improve efficiency.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    "Tech Strategy": {
      keywords: ["tech strategy", "digital transformation", "it consulting", "saas integration", "crm strategy", "technology roadmap"],
      description: "Providing strategic advice on technology adoption, digital transformation initiatives, SaaS integration, and developing comprehensive technology roadmaps for business growth.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    /** 
     * Fallback service profile. Used when the AI cannot clearly identify a specific service 
     * from the prospect's reply or if the inquiry is general.
     */
    "Generic Inquiry": { 
      keywords: [], // Typically empty as it's a fallback
      description: "General discussion about digital marketing needs, technical challenges, or other inquiries where a specific service isn't immediately identifiable. Happy to explore how I can help your business grow.",
      calendlyLink: CONFIG.CALENDLY_LINK // Uses the default/general Calendly link
    }
  }
};

// Create SERVICE_CATEGORIES after CONFIG is fully initialized
CONFIG.SERVICE_CATEGORIES = {
  "Google Ads Management": {
    keywords: ['google', 'ads', 'adwords', 'search', 'campaign', 'keyword', 'ppc', 'pay per click'],
    description: "Looking to improve ROI on Google Ads campaigns, expand into new markets, or optimize existing strategies?",
    calendlyLink: CONFIG.CALENDLY_LINK
  },
  "GMC/Feed Management": {
    keywords: ['gmc', 'merchant', 'center', 'feed', 'disapproval', 'product', 'shopping', 'ads', 'data'],
    description: "Need help with Google Merchant Center feed disapprovals, optimizing product feeds, or setting up GMC for new stores?",
    calendlyLink: CONFIG.CALENDLY_LINK
  },
  "Web Design & Development": {
    keywords: ['website', 'web', 'design', 'development', 'landing', 'page', 'cms', 'wordpress', 'shopify', 'e-commerce', 'site', 'responsive'],
    description: "Looking for full-stack web design and development services, including responsive websites and CMS builds?",
    calendlyLink: CONFIG.CALENDLY_LINK
  },
  "Funnels": {
    keywords: ['funnels', 'sales', 'lead', 'generation', 'clickfunnels', 'marketing', 'conversion'],
    description: "Need help designing and implementing high-converting sales and lead generation funnels?",
    calendlyLink: CONFIG.CALENDLY_LINK
  },
  "AI Automation": {
    keywords: ['ai', 'automation', 'chatbots', 'agents', 'workflow', 'zapier', 'make.com', 'integromat', 'process'],
    description: "Looking to implement AI-driven automation solutions and custom workflow automations?",
    calendlyLink: CONFIG.CALENDLY_LINK
  },
  "Tech Strategy": {
    keywords: ['tech', 'strategy', 'digital', 'transformation', 'it', 'consulting', 'saas', 'integration', 'crm', 'technology', 'roadmap'],
    description: "Need strategic advice on technology adoption, digital transformation initiatives, SaaS integration, and technology roadmaps?",
    calendlyLink: CONFIG.CALENDLY_LINK
  },
  "Generic Inquiry": { 
    keywords: [], // Typically empty as it's a fallback
    description: "General discussion about digital marketing needs, technical challenges, or other inquiries where a specific service isn't immediately identifiable. Happy to explore how I can help your business grow.",
    calendlyLink: CONFIG.CALENDLY_LINK // Uses the default/general Calendly link
  }
};

/** 
 * @type {string} User MUST provide. The email address for receiving important notifications from the system (e.g., leads needing manual review, errors).
 */
CONFIG.PR_EMAIL = 'raisencross@gmail.com'; 

/** 
 * @type {string} User Provided (Optional). Your Slack Webhook URL for sending notifications to a Slack channel.
 * Leave empty ('') if not used.
 * @example 'https://hooks.slack.com/services/YOUR/SLACK/TOKEN' 
 */
CONFIG.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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',

/** 
 * @type {string} User Provided. The signing key from your Calendly webhook settings. Used to verify that incoming webhook requests are genuinely from Calendly.
 */
CONFIG.CALENDLY_SIGNING_KEY = 'ar4IECr0BU-Tl850T9JU60ro4z5XVV76wt4d5T131Eo', 

/** 
 * @type {string} User MUST provide. Your Calendly Personal Access Token (PAT). Required for programmatic management of Calendly webhooks (e.g., setup, deletion).
 */
CONFIG.CALENDLY_PERSONAL_ACCESS_TOKEN = 'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzQ4NDg3NTk0LCJqdGkiOiI1YjVkY2QxNy05YTUxLTQ4YWItODNjMS1mOGY5M2Y0YjhlNjYiLCJ1c2VyX3V1aWQiOiI2ZWQ2MTZjYS1jNzBmLTRmYjctYjM4YS1mNjJlNjE5YjQyZWYifQ.t-SVxLG-f24wSsLRYER7H6o-WY_jTACEYEpP2gs2mPIKRHe9lcV_K3bkoiLQyX8JGGLElci2PLdLyN7U5nhaQA', 

/** 
 * @type {string} User Provided (Can be auto-discovered by `getCalendlyOrganizationUri()` in Setup.js). Your Calendly Organization URI. Required for webhook setup.
 * @example 'https://api.calendly.com/organizations/YOUR_ORG_UUID'
 */
CONFIG.ORGANIZATION_URI = 'https://api.calendly.com/organizations/e53097fd-c381-4d5d-831f-b4318121ad2b', 

/** 
 * @type {string} User MUST provide. Your IANA timezone name. Used for correct date/time handling in logs and scheduling.
 * @example 'America/New_York', 'Europe/London'
 */
CONFIG.USER_TIMEZONE = 'America/New_York', 

/** 
 * @type {string} System-defined. Standard email footer for unsubscribe compliance. Appended by the system to outgoing emails.
 */
CONFIG.EMAIL_FOOTER = "Reply STOP to unsubscribe", 

/** 
 * @type {number} System-defined. Maximum number of initial cold emails to send per day via the `dailyEmailBatch` function.
 */
CONFIG.DAILY_EMAIL_QUOTA = 400, 

/** 
 * @type {number} System-defined. Number of sheet updates to batch together before flushing changes to Google Sheets. Affects multiple functions.
 */
CONFIG.EMAIL_BATCH_SIZE = 50, 

  /**
   * @type {Object<string, {keywords: string[], description: string, calendlyLink: string}>}
   * @description Defines the profile of AI services offered. This object is crucial for the AI to:
   * 1. Identify which service(s) a prospect's reply relates to.
   * 2. Understand the context of each service to generate relevant follow-up emails.
   * 3. Provide specific Calendly links for services if available.
   * 
   * Each key in this object is a string representing the service name (e.g., "Google Ads Management").
   * The value for each service name is an object with the following properties:
   * - `keywords`: An array of strings. These keywords help the AI associate a prospect's inquiry with this service. Include common terms, synonyms, and related technologies.
   * - `description`: A string providing a detailed explanation of the service. This description is used in AI prompts to give context when generating emails related to this service.
   * - `calendlyLink`: A string. The specific Calendly booking link for this particular service. If a prospect is interested in this service, this link will be prioritized.
   */
  CONFIG.AI_SERVICES_PROFILE = {
    "Google Ads Management": {
      keywords: ["google ads", "ppc", "adwords", "campaigns", "performance max", "ad spend", "search ads", "display ads"],
      description: "Expert Google Ads management including Search, Display, and Performance Max campaigns, focusing on strategy, optimization, and results-driven advertising to maximize ROI.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min" // Specific link for Google Ads consultations
    },
    "GMC/Feed Management": {
      keywords: ["gmc", "merchant center", "feed disapproval", "product feed", "shopping ads", "data feed"],
      description: "Specialized in fixing Google Merchant Center feed disapprovals, optimizing product feeds for better ad placements and performance in Shopping Ads, and setting up GMC for new stores.",
      calendlyLink: "https://calendly.com/jose-ads-gmc/30min" // Specific link for GMC/Feed consultations
    },
    "Web Design & Development": {
      keywords: ["website", "web design", "web development", "landing page", "cms", "wordpress", "shopify", "e-commerce site", "responsive design"],
      description: "Full-stack web design and development services, creating responsive and user-friendly websites, high-converting landing pages, and complete CMS builds (WordPress, Shopify, custom solutions).",
      calendlyLink: "https://calendly.com/jose-web-design/30min" // Specific link for Web Design/Dev consultations
    },
    "Funnels": {
      keywords: ["funnels", "sales funnel", "lead generation funnel", "clickfunnels", "marketing funnel", "conversion funnel"],
      description: "Design and implementation of high-converting sales and lead generation funnels, including strategy, copywriting, and technical setup to nurture leads and drive sales.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    "AI Automation": {
      keywords: ["ai automation", "chatbots", "ai agents", "workflow automation", "zapier", "make.com", "integromat", "process automation"],
      description: "Implementing AI-driven automation solutions and custom workflow automations (e.g., using Zapier, Make.com, or custom scripts) to streamline business processes and improve efficiency.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    "Tech Strategy": {
      keywords: ["tech strategy", "digital transformation", "it consulting", "saas integration", "crm strategy", "technology roadmap"],
      description: "Providing strategic advice on technology adoption, digital transformation initiatives, SaaS integration, and developing comprehensive technology roadmaps for business growth.",
      calendlyLink: "https://calendly.com/jose-general/30min" // Placeholder, update with specific link or use general
    },
    /** 
     * Fallback service profile. Used when the AI cannot clearly identify a specific service 
     * from the prospect's reply or if the inquiry is general.
     */
    "Generic Inquiry": { 
      keywords: [], // Typically empty as it's a fallback
      description: "General discussion about digital marketing needs, technical challenges, or other inquiries where a specific service isn't immediately identifiable. Happy to explore how I can help your business grow.",
      calendlyLink: CONFIG.CALENDLY_LINK // Uses the default/general Calendly link
    }
/** @type {string} System-defined. The name of the Google Sheet tab containing lead data. */
const LEADS_SHEET_NAME = 'Leads';