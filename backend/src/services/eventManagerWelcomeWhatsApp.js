import {
  isTwilioConfigured,
  sanitizeWhatsAppTemplateVariable,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";

/**
 * Couple onboarding WhatsApp (two templates in sequence):
 *
 * 1) welcome_momoevent — CTA with URL buttons (Approved)
 *    SID: HX97878ac790cd66e73459d9fa3529a0f3
 *    {{1}} couple name · {{2}} event id for /event/{{2}}
 *
 * 2) get_login_credentials — Quick Reply (Approved UTILITY)
 *    Env: TWILIO_GET_LOGIN_CREDENTIALS_CONTENT_SID
 *    Button: "🔑 לקבלת פרטי הגישה" · payload GET_CREDENTIALS
 *    → webhook sends free-text session credentials (whatsappAccessDetailsService)
 */

const WELCOME_CONTENT_SID_DEFAULT = "HX97878ac790cd66e73459d9fa3529a0f3";

export function getAdminWelcomeDisplayName() {
  return String(process.env.ADMIN_DISPLAY_NAME || "").trim() || "momoEVENT";
}

export function getWelcomeContentSid() {
  return String(
    process.env.TWILIO_COUPLE_ACCESS_CONTENT_SID || WELCOME_CONTENT_SID_DEFAULT || ""
  ).trim();
}

export function getLoginCredentialsContentSid() {
  return String(process.env.TWILIO_GET_LOGIN_CREDENTIALS_CONTENT_SID || "").trim();
}

/** Extract `/event/:id` path segment for CTA button variable {{2}}. */
export function extractEventPathId(invitationUrl, userId) {
  if (userId) return String(userId).trim();
  const match = String(invitationUrl || "").match(/\/event\/([^/?#]+)/i);
  return String(match?.[1] || "").trim();
}

export function buildEventManagerWelcomeMessage({ brideName, dashboardUrl, invitationUrl }) {
  const name = String(brideName || "").trim() || "שלום";

  return `שלום ${name},

ברוכים הבאים ל- momoEVENT אישורי הגעה🎉

המערכת שלכם מוכנה לשימוש.
באמצעות המערכת תוכלו לנהל את אישורי ההגעה ולצפות בהזמנה הדיגיטלית.

לבחירתכם, לחצו על הכפתורים למטה.

כניסה למערכת:
${dashboardUrl}

צפייה בהזמנה:
${invitationUrl}

🔑 לקבלת פרטי הגישה — השיבו בהודעה: GET_CREDENTIALS`;
}

export function buildCoupleAccessContentVariables({ brideName, eventPathId }) {
  return JSON.stringify({
    "1": sanitizeWhatsAppTemplateVariable(brideName, "שלום"),
    "2": sanitizeWhatsAppTemplateVariable(eventPathId, "example")
  });
}

async function sendWelcomeTemplate({
  to,
  contactPhone,
  brideName,
  eventPathId,
  userId,
  username,
  senderLabel
}) {
  const contentSid = getWelcomeContentSid();
  if (!contentSid.startsWith("HX")) {
    return { ok: false, reason: "welcome_template_missing" };
  }

  const result = await sendTwilioWhatsAppMessage({
    to,
    contentSid,
    contentVariables: buildCoupleAccessContentVariables({ brideName, eventPathId }),
    userId,
    username,
    senderLabel: senderLabel || username,
    recipientPhone: contactPhone
  });

  return {
    ok: true,
    sid: result?.sid || "",
    contentSid,
    mode: "content_template"
  };
}

/**
 * Second message: approved Quick Reply template with GET_CREDENTIALS button.
 * Requires TWILIO_GET_LOGIN_CREDENTIALS_CONTENT_SID after Meta approval.
 */
async function sendCredentialsQuickReplyTemplate({
  to,
  contactPhone,
  userId,
  username,
  senderLabel
}) {
  const contentSid = getLoginCredentialsContentSid();
  if (!contentSid.startsWith("HX")) {
    console.warn(
      `[WHATSAPP] Skipping get_login_credentials — set TWILIO_GET_LOGIN_CREDENTIALS_CONTENT_SID (user=${username || userId || "unknown"})`
    );
    return { ok: false, reason: "credentials_qr_template_missing" };
  }

  const result = await sendTwilioWhatsAppMessage({
    to,
    contentSid,
    userId,
    username,
    senderLabel: senderLabel || username,
    recipientPhone: contactPhone
  });

  return {
    ok: true,
    sid: result?.sid || "",
    contentSid,
    mode: "content_template"
  };
}

/**
 * Sends welcome CTA template, then credentials Quick Reply template.
 * Falls back to free-text only if TWILIO_COUPLE_ACCESS_ALLOW_FREE_TEXT=true (local/dev).
 */
export async function sendEventManagerWelcomeWhatsApp({
  contactPhone,
  brideName,
  username,
  password,
  dashboardUrl,
  invitationUrl,
  userId,
  senderLabel
}) {
  if (!isTwilioConfigured()) {
    console.error(
      `ERROR: שליחת וואטסאפ נכשלה למספר ${contactPhone || "לא ידוע"} מאת משתמש ${senderLabel || username || userId || "לא ידוע"}. סיבה: Twilio לא מוגדר בשרת`
    );
    return { sent: false, reason: "twilio_not_configured" };
  }

  const to = toTwilioWhatsAppAddress(contactPhone);
  if (!to) {
    console.error(
      `ERROR: שליחת וואטסאפ נכשלה למספר ${contactPhone || "לא ידוע"} מאת משתמש ${senderLabel || username || userId || "לא ידוע"}. סיבה: מספר טלפון לא תקין`
    );
    return { sent: false, reason: "invalid_phone" };
  }

  const allowFreeText =
    String(process.env.TWILIO_COUPLE_ACCESS_ALLOW_FREE_TEXT || "")
      .trim()
      .toLowerCase() === "true";

  const eventPathId = extractEventPathId(invitationUrl, userId);
  const common = {
    to,
    contactPhone,
    userId,
    username,
    senderLabel: senderLabel || username
  };

  try {
    const welcome = await sendWelcomeTemplate({
      ...common,
      brideName,
      eventPathId
    });

    if (!welcome.ok) {
      if (!allowFreeText) {
        console.error(
          `ERROR: שליחת וואטסאפ נכשלה למספר ${contactPhone || "לא ידוע"} מאת משתמש ${senderLabel || username || userId || "לא ידוע"}. סיבה: חסר TWILIO_COUPLE_ACCESS_CONTENT_SID (תבנית welcome_momoevent)`
        );
        return { sent: false, reason: "template_not_configured" };
      }

      const body = buildEventManagerWelcomeMessage({
        brideName,
        dashboardUrl,
        invitationUrl
      });
      const result = await sendTwilioWhatsAppMessage({
        to,
        body,
        userId,
        username,
        senderLabel: senderLabel || username,
        recipientPhone: contactPhone
      });
      return {
        sent: true,
        sid: result?.sid || "",
        to,
        mode: "free_text",
        credentialsQuickReply: { sent: false, reason: "free_text_fallback" }
      };
    }

    const credentialsQr = await sendCredentialsQuickReplyTemplate(common);

    return {
      sent: true,
      sid: welcome.sid,
      to,
      mode: "content_template",
      contentSid: welcome.contentSid,
      credentialsQuickReply: {
        sent: Boolean(credentialsQr.ok),
        reason: credentialsQr.ok ? null : credentialsQr.reason,
        sid: credentialsQr.sid || "",
        contentSid: credentialsQr.contentSid || ""
      }
    };
  } catch (error) {
    return {
      sent: false,
      reason: "send_failed",
      error: error?.message || "WhatsApp send failed"
    };
  }
}
