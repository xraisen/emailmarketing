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

function getServiceClassificationPrompt(replyText, leadFirstName, serviceProfile, interactionHistorySummary) { // Added interactionHistorySummary
  let servicesList = Object.keys(serviceProfile).map(serviceName => {
    // Ensure serviceProfile[serviceName] and its description exist before trying to access substring
    let descriptionSnippet = "No description available.";
    if (serviceProfile[serviceName] && serviceProfile[serviceName].description) {
      descriptionSnippet = serviceProfile[serviceName].description.substring(0, 100) + "...";
    }
    return `- ${serviceName}: ${descriptionSnippet}`;
  }).join('\n'); // Note: Use double backslash for newline in a single-line string representation if this were for a system that needs it; for Apps Script, '
' is fine.

  // Construct the history part of the prompt, only if interactionHistorySummary has content.
  const historyPromptSection = (interactionHistorySummary && interactionHistorySummary.trim() !== "") ?
`Previous interaction summary with ${leadFirstName}:
${interactionHistorySummary}
---
` : "";

  return `
${historyPromptSection}Prospect ${leadFirstName} replied with: "${replyText}"

My available services are:
${servicesList}

Based on the prospect's reply (considering any previous interactions if summarized), identify the primary service(s) they are interested in from the list above.
Also, list any specific problems or questions they mentioned in their *latest* reply.
Analyze the overall sentiment of the prospect's *latest* reply and classify it as "positive", "neutral", or "negative".
If their inquiry is unclear or doesn't match a specific service, classify services as "Generic Inquiry".

Respond in JSON format with the following structure:
{
  "identified_services": ["Service Name 1", "Service Name 2"],
  "key_concerns": ["Concern 1", "Concern 2"], // From the latest reply
  "summary_of_need": "A specific and actionable summary of what the prospect is explicitly asking for in their latest reply. Focus on key questions or desired outcomes they've stated.",
  "sentiment": "positive", // "positive", "neutral", or "negative"
  "classification_confidence": 0.85 // Your self-assessed confidence (0.0 to 1.0) in the accuracy of identified_services, key_concerns, and summary_of_need based on the reply. Be realistic: use lower scores if the reply is very short, ambiguous, or if your interpretation relies heavily on assumptions.
}
  `;
}

// Make sure CONFIG is accessible if you plan to use CONFIG.EMAIL_FOOTER directly in the prompt.
// However, it's better practice to pass it in or append it later in the email construction process.
// For this task, the prompt string will include a placeholder for the email footer
// or expect it to be appended by the calling function.
// The issue description shows "${CONFIG.EMAIL_FOOTER}" directly in the prompt.

function getContextualFollowUpPrompt(classifiedData, leadFirstName, yourName, serviceProfile, interactionHistorySummary) { // Added interactionHistorySummary
  let relevantServiceDetails = "";
  if (classifiedData && classifiedData.identified_services && classifiedData.identified_services.length > 0) {
    relevantServiceDetails = classifiedData.identified_services.map(serviceName => {
      if (serviceProfile[serviceName] && serviceProfile[serviceName].description) {
        return `Regarding ${serviceName}: ${serviceProfile[serviceName].description}`;
      }
      return ""; // Return empty string if service or its description isn't found
    }).filter(detail => detail !== "").join('\n\n'); // Ensure only non-empty details are joined, and use double newlines for separation
  }

  // Ensure classifiedData and its properties are defined before accessing them
  const identifiedServicesText = (classifiedData && classifiedData.identified_services && classifiedData.identified_services.length > 0) ? classifiedData.identified_services.join(', ') : 'services I offer';
  const keyConcernsText = (classifiedData && classifiedData.key_concerns && classifiedData.key_concerns.length > 0) ? classifiedData.key_concerns.join(', ') : 'not explicitly stated, but they replied positively';
  const summaryOfNeedText = (classifiedData && classifiedData.summary_of_need) ? classifiedData.summary_of_need : 'their general interest in my services.';

  // Construct the history part of the prompt, only if interactionHistorySummary has content.
  const historyPromptSection = (interactionHistorySummary && interactionHistorySummary.trim() !== "") ?
`My name is ${yourName}.
Here's a summary of my past interactions with ${leadFirstName}:
${interactionHistorySummary}
---
` : `My name is ${yourName}.
I previously sent a cold email to ${leadFirstName}.
`;

  return `
${historyPromptSection}
Based on their LATEST reply, ${leadFirstName} seems interested in: ${identifiedServicesText}.
Their specific concerns/questions from the LATEST reply are: ${keyConcernsText}.
Summary of their LATEST need: ${summaryOfNeedText}

My relevant expertise includes:
${relevantServiceDetails}

Write a helpful, expert-toned follow-up email to ${leadFirstName}.
Acknowledge their LATEST reply and specific concerns.
If there's relevant history, subtly weave it in to show you remember them (e.g., "Following up on our previous discussion about X..."). If their latest reply introduces a new topic clearly distinct from the history, a brief acknowledgment of this shift can be good before addressing the new points.
Briefly explain how I can help with the identified service(s)/concerns from their latest reply, drawing from my expertise.
Suggest a meeting and state that you will provide the appropriate Calendly link.
The email should be concise, professional, and encouraging.
End with "Looking forward to helping out,\n${yourName}".
Include "Reply STOP to unsubscribe" at the very end.
  `;
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
