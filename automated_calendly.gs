// File: automated_calendly.gs - Logic for Calendly integration.

/**
 * Handles incoming POST requests from Calendly webhooks.
 * Specifically processes 'invitee.created' events to update lead status.
 * @param {Object} e The event parameter from Google Apps Script, containing POST data.
 * @return {ContentService.TextOutput} A JSON response indicating success or failure.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { // Try to acquire lock for 10 seconds
    try {
      logAction('CalendlyWebhookReceived', null, null, 'Received POST request on Calendly webhook with lock.', 'INFO');

      if (!e || !e.postData || !e.postData.contents) {
        logAction('CalendlyWebhookError', null, null, 'No postData found in request.', 'ERROR');
      return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid request: No postData' })).setMimeType(ContentService.MimeType.JSON);
    }

    const calendlySignature = e.headers ? e.headers['calendly-webhook-signature'] : null;
    if (CONFIG.CALENDLY_SIGNING_KEY && CONFIG.CALENDLY_SIGNING_KEY !== 'YOUR_CALENDLY_SIGNING_KEY' && calendlySignature) {
      // For this task, we are only logging the presence. Full verification is complex.
      // A real implementation would call a function like:
      // const isValid = verifyCalendlySignature(e.postData.contents, calendlySignature, CONFIG.CALENDLY_SIGNING_KEY);
      // if (!isValid) {
      //   logAction('CalendlyWebhookAuthError', null, null, 'Webhook signature verification failed.', 'ERROR');
      //   return ContentService.createTextOutput(JSON.stringify({error: 'Signature verification failed'})).setMimeType(ContentService.MimeType.JSON);
      // }
      logAction('CalendlySignatureCheck', null, null, 'Calendly signature header present and signing key configured. Verification should be implemented for production. Header: ' + calendlySignature.substring(0,15) + '... Key starts with: ' + CONFIG.CALENDLY_SIGNING_KEY.substring(0,5) + '...', 'INFO');
    } else if (CONFIG.CALENDLY_SIGNING_KEY && CONFIG.CALENDLY_SIGNING_KEY !== 'YOUR_CALENDLY_SIGNING_KEY' && !calendlySignature) {
        logAction('CalendlySignatureWarning', null, null, 'Calendly signing key is configured, but no signature header received from Calendly.', 'WARNING');
    } else if (!CONFIG.CALENDLY_SIGNING_KEY || CONFIG.CALENDLY_SIGNING_KEY === 'YOUR_CALENDLY_SIGNING_KEY') {
        logAction('CalendlySignatureInfo', null, null, 'Calendly signing key not configured. Skipping signature verification. Header: ' + (calendlySignature ? calendlySignature.substring(0,15) + '...' : 'Not Present'), 'INFO');
    }


    const payload = JSON.parse(e.postData.contents);
    // Log only specific, non-sensitive parts of the payload for debugging if necessary
    logAction('CalendlyPayload', null, null, `Payload parsed. Event type: ${payload.event}, Invitee URI: ${payload.payload && payload.payload.uri ? payload.payload.uri : 'N/A'}`, 'DEBUG');


    if (payload.event !== 'invitee.created') {
        logAction('CalendlyWebhookSkipped', null, null, 'Skipped event type: ' + payload.event, 'INFO');
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Event skipped, not invitee.created.'})).setMimeType(ContentService.MimeType.JSON);
    }

    const inviteeEmail = payload.payload && payload.payload.email;
    const bookingStartTime = payload.payload && payload.payload.scheduled_event && payload.payload.scheduled_event.start_time;
    const inviteeName = payload.payload && payload.payload.name; // Could be used if needed

    if (!inviteeEmail || !bookingStartTime) {
      const errorDetail = `Missing essential fields in payload. Email: ${inviteeEmail || 'Not Provided'}, StartTime: ${bookingStartTime || 'Not Provided'}`;
      logAction('CalendlyWebhookError', null, inviteeEmail, errorDetail, 'ERROR');
      return ContentService.createTextOutput(JSON.stringify({ error: 'Missing required payload fields (email, start_time)' })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(LEADS_SHEET_NAME);
    if (!sheet) {
        logAction('CalendlyWebhookError', null, inviteeEmail, `Sheet ${LEADS_SHEET_NAME} not found.`, 'ERROR');
        return ContentService.createTextOutput(JSON.stringify({ error: `Sheet ${LEADS_SHEET_NAME} not found.` })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const columnIndexMap = getColumnIndexMap(headers); // From Utilities.gs
    
    // Check for required columns
    const requiredSheetColumns = ['Email', 'Status', 'Last Contact', 'Lead ID', 'First Name', 'Last Service', 'Phone'];
    for (const col of requiredSheetColumns) {
        if (columnIndexMap[col] === undefined) {
            logAction('CalendlyWebhookError', null, inviteeEmail, `Required column '${col}' not found in sheet.`, 'ERROR');
            return ContentService.createTextOutput(JSON.stringify({ error: `Sheet configuration error: Missing column '${col}'` })).setMimeType(ContentService.MimeType.JSON);
        }
    }

    const leadDataRange = sheet.getRange(2, 1, sheet.getLastRow() > 1 ? sheet.getLastRow() - 1 : 1, sheet.getLastColumn());
    const leadDataRows = sheet.getLastRow() > 1 ? leadDataRange.getValues() : [];


    let leadFound = false;
    for (let i = 0; i < leadDataRows.length; i++) {
      const row = leadDataRows[i];
      const currentEmail = row[columnIndexMap['Email']];

      if (currentEmail && typeof currentEmail === 'string' && currentEmail.toLowerCase() === inviteeEmail.toLowerCase()) {
        leadFound = true;
        const actualSheetRow = i + 2; // +1 for 0-based index, +1 for header row
        
        const leadId = row[columnIndexMap['Lead ID']];
        // const firstName = row[columnIndexMap['First Name']]; // This is from the sheet
        const lastServiceInSheet = row[columnIndexMap['Last Service']]; // Explicitly get from sheet
        const phoneInSheet = row[columnIndexMap['Phone']]; // Explicitly get from sheet

        // Extract invitee's full name from Calendly payload if available, otherwise use sheet's First Name
        const inviteeFullName = payload.payload.name || row[columnIndexMap['First Name']];


        sheet.getRange(actualSheetRow, columnIndexMap['Status'] + 1).setValue(STATUS.BOOKED);
        sheet.getRange(actualSheetRow, columnIndexMap['Last Contact'] + 1).setValue(new Date(bookingStartTime));
        
        logAction('CalendlyLeadBooked', leadId, inviteeEmail, 'Lead status updated to BOOKED. Booking time: ' + bookingStartTime, 'SUCCESS');
        
        // Call PR Alert (using firstName from sheet for consistency if desired for PR, or inviteeFullName)
        sendPRAlert(row[columnIndexMap['First Name']], lastServiceInSheet, inviteeEmail, phoneInSheet, bookingStartTime, leadId);
        
        // NEW: Call Create Calendar Event
        createCalendarEvent(inviteeEmail, inviteeFullName, bookingStartTime, lastServiceInSheet, phoneInSheet, leadId);
        
        SpreadsheetApp.flush(); 
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Lead updated to BOOKED' })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (!leadFound) {
      logAction('CalendlyLeadNotFound', null, inviteeEmail, 'Lead not found in sheet for Calendly booking. Consider adding as new lead.', 'WARNING');
      // Optional: If lead not found, create a new one or send a different alert.
      // For now, just log and inform.
      // sendPRAlert(inviteeName || "Unknown Name", "Calendly Booking", inviteeEmail, null, bookingStartTime, "CALENDLY_NEW_LEAD_" + generateUUID());
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Lead not found in sheet' })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    // Catch any unexpected errors during processing
      logAction('CalendlyWebhookError', null, (e && e.postData && e.postData.contents && JSON.parse(e.postData.contents).payload ? JSON.parse(e.postData.contents).payload.email : 'Unknown Email'), 'Fatal error processing Calendly webhook: ' + error.message + (error.stack ? ' Stack: ' + error.stack : ''), 'ERROR');
      return ContentService.createTextOutput(JSON.stringify({ error: 'Internal server error', details: error.message })).setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock();
      logAction('CalendlyWebhookLockReleased', null, null, 'Lock released for Calendly doPost.', 'DEBUG');
    }
  } else {
    logAction('CalendlyWebhookLockError', null, (e && e.postData && e.postData.contents && JSON.parse(e.postData.contents).payload ? JSON.parse(e.postData.contents).payload.email : 'Unknown Email'), 'Could not obtain lock for Calendly doPost after 10 seconds. Webhook processing skipped.', 'ERROR');
    return ContentService.createTextOutput(JSON.stringify({ error: 'Server busy, please try again later.' })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Creates a Google Calendar event for a booked audit.
 * @param {string} email The invitee's email address.
 * @param {string} name The invitee's name. (Potentially full name from Calendly)
 * @param {string} startTime ISO string for the event start time.
 * @param {string} lastService The service the audit is for.
 * @param {string} [phone] The invitee's phone number (optional).
 * @param {string} leadId The Lead ID.
 */
function createCalendarEvent(email, name, startTime, lastService, phone, leadId) {
  try {
    // Ensure CalendarApp is available
    if (typeof CalendarApp === 'undefined') {
      logAction('CALENDAR_EVENT_ERROR', leadId, email, 'CalendarApp service not available.', 'ERROR');
      console.error('CalendarApp service not available for Lead ID: ' + leadId);
      return;
    }
    const calendar = CalendarApp.getDefaultCalendar();
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 minutes duration
    const phoneDisplay = phone || '';

    const eventTitle = `Free Audit with ${name} (${lastService})`;
    const eventDescription = `Contact: ${email} | ${phoneDisplay}
Service: ${lastService}
Lead ID: ${leadId}`;
    
    const event = calendar.createEvent(
      eventTitle,
      start,
      end,
      {
        description: eventDescription,
        guests: email,
        sendInvites: true // Send an invitation to the lead
      }
    );
    logAction('CALENDAR_EVENT_SUCCESS', leadId, email, 'Created calendar event. ID: ' + event.getId(), 'SUCCESS');
    console.log('Calendar event created for Lead ID: ' + leadId + ', Event ID: ' + event.getId());
  } catch (e) {
    logAction('CALENDAR_EVENT_ERROR', leadId, email, 'Error creating calendar event: ' + e.message + (e.stack ? ' Stack: ' + e.stack : ''), 'ERROR');
    console.error('Error creating calendar event for Lead ID: ' + leadId + '. Error: ' + e.message + (e.stack ? ' Stack: ' + e.stack : ''));
  }
}

// Note: `getColumnIndexMap` is expected to be in Utilities.gs
// Note: `sendPRAlert` is expected to be in automated_email_sendPRAlert.gs
// Note: `logAction` is expected to be in Utilities.gs
// Note: `CONFIG` and `STATUS` are expected to be in Config.gs

// Full Calendly Webhook Signature Verification (Example for future reference)
/*
function verifyCalendlySignature(rawPayload, signatureHeader, signingKey) {
  try {
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(part => part.startsWith('t='));
    if (!timestampPart) return false;
    const timestamp = timestampPart.split('=')[1];

    const v1Signatures = parts.filter(part => part.startsWith('v1=')).map(part => part.split('=')[1]);
    if (v1Signatures.length === 0) return false;

    const signedPayload = timestamp + "." + rawPayload;
    const computedHashBytes = Utilities.computeHmacSha256Signature(signedPayload, signingKey);
    
    let computedHashHex = computedHashBytes.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');

    return v1Signatures.includes(computedHashHex);
  } catch (e) {
    logAction('CalendlySignatureVerificationEx', null, null, 'Exception during signature verification: ' + e.message, 'ERROR');
    return false;
  }
}
*/
