// File: prompt.gs - AI system prompts

const INITIAL_EMAIL_PROMPT_TEMPLATE = "You are an AI assistant generating a plain text email. Adhere to Plain Text Email Formatting Standards.\n\nThe email should be very brief (e.g., 2-3 short sentences). Personalize with '${firstName}'.\nGenerate a subject line like 'Offer: Free Audit for ${lastService}'. This subject should be complete. Note that the system may programmatically add a prefix (e.g., a specific project tag, or 'RE:') to the subject you generate. Do not add such prefixes yourself.\nBody: Briefly introduce the free audit for ${lastService}, highlighting its value. Maintain a human, concise, and professional tone. Use short paragraphs. Ensure the call to action is clear.\nVary tone (e.g., professional, friendly, urgent) and phrasing for randomness.\n\nConclude the email with the following structure, exactly as specified, including the blank line before the footer:\n${emailClosing}\n${signatureName}\n${signatureTitleIfAny}${signatureCompanyIfAny}\n\n${emailFooter}";

const FOLLOW_UP_EMAIL_PROMPT_TEMPLATE = "You are an AI assistant generating a plain text follow-up email. Adhere to Plain Text Email Formatting Standards.\n\nThe email should be very brief (e.g., 2-3 short sentences). Personalize with '${firstName}'.\nGenerate a subject line like 'Follow-up: Free Audit for ${lastService}'. This subject should be complete. Note that the system may programmatically add a prefix (e.g., a specific project tag, or 'RE:') to the subject you generate. Do not add such prefixes yourself.\nBody: Briefly remind ${firstName} about the free audit for ${lastService} offered previously. Maintain a human, concise, and professional tone, distinct from the initial email. Use short paragraphs. Ensure the call to action is clear.\nVary tone and phrasing.\n\nConclude the email with the following structure, exactly as specified, including the blank line before the footer:\n${emailClosing}\n${signatureName}\n${signatureTitleIfAny}${signatureCompanyIfAny}\n\n${emailFooter}";

/**
 * Generates the prompt for an initial email.
 * @param {string} firstName The first name of the lead.
 * @param {string} lastService The last service provided to the lead.
 * @return {string} The formatted prompt string.
 */
function getInitialEmailPrompt(firstName, lastService) {
  // Assuming CONFIG is globally accessible here or passed in. For this context, we'll assume global.
  const signatureTitleIfAny = CONFIG.SIGNATURE_TITLE ? CONFIG.SIGNATURE_TITLE + '\n' : '';
  const signatureCompanyIfAny = CONFIG.SIGNATURE_COMPANY ? CONFIG.SIGNATURE_COMPANY + '\n' : '';

  return INITIAL_EMAIL_PROMPT_TEMPLATE
    .replace('${firstName}', firstName)
    .replace('${lastService}', lastService)
    .replace('${subjectPrefix}', CONFIG.SUBJECT_PREFIX || '') // Ensure empty string if undefined
    .replace('${emailClosing}', CONFIG.EMAIL_CLOSING)
    .replace('${signatureName}', CONFIG.SIGNATURE_NAME)
    .replace('${signatureTitleIfAny}', signatureTitleIfAny)
    .replace('${signatureCompanyIfAny}', signatureCompanyIfAny)
    .replace('${emailFooter}', CONFIG.EMAIL_FOOTER);
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
  "summary_of_need": "A brief summary of what the prospect is asking for in their latest reply.",
  "sentiment": "positive" // "positive", "neutral", or "negative"
}
  `;
}

// Make sure CONFIG is accessible if you plan to use CONFIG.EMAIL_FOOTER directly in the prompt.
// However, it's better practice to pass it in or append it later in the email construction process.
// For this task, the prompt string will include a placeholder for the email footer
// or expect it to be appended by the calling function.
// The issue description shows "${CONFIG.EMAIL_FOOTER}" directly in the prompt.

function getContextualFollowUpPrompt(
  classifiedData,
  leadFirstName,
  yourName, // This is CONFIG.SIGNATURE_NAME
  serviceProfile,
  interactionHistorySummary,
  emailClosing, // New: CONFIG.EMAIL_CLOSING
  signatureTitle, // New: CONFIG.SIGNATURE_TITLE (could be empty)
  signatureCompany, // New: CONFIG.SIGNATURE_COMPANY (could be empty)
  emailFooter // New: CONFIG.EMAIL_FOOTER
) {
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

  // Construct the signature block for the prompt's instruction section
  let signatureBlockInstruction = `${emailClosing}\n${yourName}`;
  if (signatureTitle) {
    signatureBlockInstruction += `\n${signatureTitle}`;
  }
  if (signatureCompany) {
    signatureBlockInstruction += `\n${signatureCompany}`;
  }

  return `
You are an AI assistant generating a plain text follow-up email. Adhere to Plain Text Email Formatting Standards.
${historyPromptSection}
Based on their LATEST reply, ${leadFirstName} seems interested in: ${identifiedServicesText}.
Their specific concerns/questions from the LATEST reply are: ${keyConcernsText}.
Summary of their LATEST need: ${summaryOfNeedText}

My relevant expertise includes:
${relevantServiceDetails}

Write a helpful, expert-toned follow-up email to ${leadFirstName}.
Generate a clear and relevant subject line, for example: "Following up on your inquiry about [Service/Topic]". This subject should be complete. Note that the system may programmatically add a prefix (e.g., a specific project tag, or 'RE:') to the subject you generate. Do not add such prefixes yourself.
Use a personalized salutation (e.g., "Hi ${leadFirstName},").
Acknowledge their LATEST reply and specific concerns using short paragraphs and simple, direct language.
If there's relevant history, subtly weave it in to show you remember them (e.g., "Following up on our previous discussion about X...").
Briefly explain how I can help with the identified service(s)/concerns from their latest reply, drawing from my expertise and clearly stating the value.
Suggest a meeting and state that you will provide the appropriate Calendly link using its full URL (e.g., "You can book a time here: https://calendly.com/your-link/meeting-type").
The email should be concise, professional, encouraging, and avoid spammy language or excessive capitalization.

Conclude the email with the following structure, exactly as specified, including the blank line before the footer:
${signatureBlockInstruction}

${emailFooter}
  `;
}

/**
 * Generates the prompt for a follow-up email.
 * @param {string} firstName The first name of the lead.
 *   @param {string} lastService The last service provided to the lead.
 * @return {string} The formatted prompt string.
 */
function getFollowUpEmailPrompt(firstName, lastService) {
  // Assuming CONFIG is globally accessible here or passed in. For this context, we'll assume global.
  const signatureTitleIfAny = CONFIG.SIGNATURE_TITLE ? CONFIG.SIGNATURE_TITLE + '\n' : '';
  const signatureCompanyIfAny = CONFIG.SIGNATURE_COMPANY ? CONFIG.SIGNATURE_COMPANY + '\n' : '';

  return FOLLOW_UP_EMAIL_PROMPT_TEMPLATE
    .replace('${firstName}', firstName)
    .replace('${lastService}', lastService)
    .replace('${subjectPrefix}', CONFIG.SUBJECT_PREFIX || '') // Ensure empty string if undefined
    .replace('${emailClosing}', CONFIG.EMAIL_CLOSING)
    .replace('${signatureName}', CONFIG.SIGNATURE_NAME)
    .replace('${signatureTitleIfAny}', signatureTitleIfAny)
    .replace('${signatureCompanyIfAny}', signatureCompanyIfAny)
    .replace('${emailFooter}', CONFIG.EMAIL_FOOTER);
}
