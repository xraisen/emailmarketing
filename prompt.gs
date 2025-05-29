// File: prompt.gs - AI system prompts

const INITIAL_EMAIL_PROMPT_TEMPLATE = "Write a unique 2-line email to ${firstName} about ${lastService}. Offer a free audit. Vary tone (e.g., professional, friendly, urgent) and phrasing for randomness. Keep it human, concise, and professional. Include \"Reply STOP to unsubscribe\" at the end.";

const FOLLOW_UP_EMAIL_PROMPT_TEMPLATE = "Write a unique 2-line follow-up email to ${firstName} about ${lastService}. Remind them of the free audit. Vary tone and phrasing, distinct from the initial email. Keep it human, concise, and professional. Include \"Reply STOP to unsubscribe\" at the end.";

/**
 * Generates the prompt for an initial email.
 * @param {string} firstName The first name of the lead.
 * @param {string} lastService The last service provided to the lead.
 * @return {string} The formatted prompt string.
 */
function getInitialEmailPrompt(firstName, lastService) {
  return INITIAL_EMAIL_PROMPT_TEMPLATE
    .replace('${firstName}', firstName)
    .replace('${lastService}', lastService);
}

/**
 * Generates the prompt for a follow-up email.
 * @param {string} firstName The first name of the lead.
 *   @param {string} lastService The last service provided to the lead.
 * @return {string} The formatted prompt string.
 */
function getFollowUpEmailPrompt(firstName, lastService) {
  return FOLLOW_UP_EMAIL_PROMPT_TEMPLATE
    .replace('${firstName}', firstName)
    .replace('${lastService}', lastService);
}
