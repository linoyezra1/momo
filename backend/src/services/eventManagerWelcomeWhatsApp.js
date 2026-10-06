import {
  isTwilioConfigured,
  sanitizeWhatsAppTemplateVariable,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";

/**
 * Couple onboarding WhatsApp (two templates in sequence):
 *
 * 1) momo_welcome_onboarding_v2 — Quick Reply (Marketing)
 *    SID: HXebe5ddfa6d93efa29c8e2396b4d29fdd
 *    Env: TWILIO_COUPLE_ACCESS_CONTENT_SID
 *    {{1}} client name · {{2}} dashboard login URL
 *    Button: "להכניס מוזמנים" · payload ADD_GUESTS_REQUEST
 *
 * 2) copy_get_login_credentials — Quick Reply (Approved UTILITY)
 *    SID: HXaa49007744d72933b0d6db852e715ad6
 *    Sent ~1 minute after welcome (TWILIO_CREDENTIALS_QR_DELAY_MS, default 60000)
 *    Button: "🔑 לקבלת פרטי הגישה" · payload GET_CREDENTIALS
 *    → webhook sends free-text session credentials (whatsappAccessDetailsService)
 */

const WELCOME_CONTENT_SID_DEFAULT = "HXebe5ddfa6d93efa29c8e2396b4d29fdd";
const LOGIN_CREDENTIALS_CONTENT_SID_DEFAULT = "HXaa49007744d72933b0d6db852e715ad6";
const CREDENTIALS_QR_DELAY_MS_DEFAULT = 60_000;

export function getAdminWelcomeDisplayName() {
  return String(process.env.ADMIN_DISPLAY_NAME || "").trim() || "momoEVENT";
}

export function getWelcomeContentSid() {
  return String(
    process.env.TWILIO_COUPLE_ACCESS_CONTENT_SID || WELCOME_CONTENT_SID_DEFAULT || ""
  ).trim();
}

export function getLoginCredentialsContentSid() {
  return String(
    process.env.TWILIO_GET_LOGIN_CREDENTIALS_CONTENT_SID ||
      LOGIN_CREDENTIALS_CONTENT_SID_DEFAULT ||
      ""
  ).trim();
}

export function getCredentialsQuickReplyDelayMs() {
  const raw = Number(process.env.TWILIO_CREDENTIALS_QR_DELAY_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.min(raw, 10 * 60_000);
  return CREDENTIALS_QR_DELAY_MS_DEFAULT;
}

/** Extract `/event/:id` path segment (for invite URL button suffix when used by Twilio). */
export function extractEventPathId(invitationUrl, userId) {
  if (userId) return String(userId).trim();
  const match = String(invitationUrl || "").match(/\/event\/([^/?#]+)/i);
  return String(match?.[1] || "").trim();
}

export function buildEventManagerWelcomeMessage({ brideName, dashboardUrl }) {
  const name = String(brideName || "").trim() || "שלום";
  const dash = String(dashboardUrl || "").trim() || "https://momoevent.up.railway.app/client/login";

  return `שלום ${name},

ברוכים הבאים ל- momoEVENT אישורי הגעה🎉

המערכת שלכם מוכנה.
מה תוכלו לעשות במערכת?
* ניהול והעלאת מוזמנים (מאנשי הקשר, אקסל, ידנית או ישירות דרך הבוט בוואטסאפ)
* שליחת אישורי הגעה ומעקב בזמן אמת
* סידורי הושבה חכמים ודיילת דיגיטלית ביום האירוע
* ניהול תקציב, משימות ומעקב ספקים

 לכניסה למערכת לחצו כאן:
${dash}

אנחנו כאן לכל שאלה : 055-3193433 (זמינים עבורכם 24/6) ❤️

להכניס מוזמנים — השיבו: ADD_GUESTS_REQUEST`;
}

/**
 * Content variables for momo_welcome_onboarding_v2.
 * {{1}} = client display name
 * {{2}} = dashboard login URL
 */
export function buildCoupleAccessContentVariables({ brideName, dashboardUrl }) {
  return JSON.stringify({
    "1": sanitizeWhatsAppTemplateVariable(brideName, "שלום"),
    "2": sanitizeWhatsAppTemplateVariable(
      dashboardUrl,
      "https://momoevent.up.railway.app/client/login"
    )
  });
}

async function sendWelcomeTemplate({
  to,
  contactPhone,
  brideName,
  dashboardUrl,
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
    contentVariables: buildCoupleAccessContentVariables({
      brideName,
      dashboardUrl
    }),
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
 * Scheduled ~1 minute after welcome so the couple can read the first message first.
 */
export async function sendLoginCredentialsQuickReply({
  contactPhone,
  userId,
  username,
  senderLabel
}) {
  if (!isTwilioConfigured()) {
    return { sent: false, reason: "twilio_not_configured" };
  }

  const to = toTwilioWhatsAppAddress(contactPhone);
  if (!to) {
    return { sent: false, reason: "invalid_phone" };
  }

  try {
    const result = await sendCredentialsQuickReplyTemplate({
      to,
      contactPhone,
      userId,
      username,
      senderLabel: senderLabel || username
    });
    if (!result.ok) {
      return { sent: false, reason: result.reason || "template_missing", contentSid: result.contentSid || "" };
    }
    return {
      sent: true,
      sid: result.sid || "",
      contentSid: result.contentSid || "",
      to
    };
  } catch (error) {
    return {
      sent: false,
      reason: "send_failed",
      error: error?.message || "WhatsApp send failed"
    };
  }
}

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

function scheduleCredentialsQuickReply(common, delayMs) {
  const contentSid = getLoginCredentialsContentSid();
  if (!contentSid.startsWith("HX")) {
    console.warn(
      `[WHATSAPP] Skipping scheduled get_login_credentials — template SID missing (user=${common.username || common.userId || "unknown"})`
    );
    return {
      sent: false,
      scheduled: false,
      reason: "credentials_qr_template_missing",
      delayMs: 0,
      contentSid: ""
    };
  }

  const waitMs = Math.max(0, Number(delayMs) || 0);
  console.log(
    `[WHATSAPP] Scheduling get_login_credentials in ${waitMs}ms for ${common.contactPhone || "unknown"} (user=${common.username || common.userId || "unknown"})`
  );

  setTimeout(() => {
    sendCredentialsQuickReplyTemplate(common)
      .then((result) => {
        if (result.ok) {
          console.log(
            `[WHATSAPP] get_login_credentials sent after delay\nphone: ${common.contactPhone || "unknown"}\nsid: ${result.sid || "-"}\nuser: ${common.username || common.userId || "unknown"}`
          );
        } else {
          console.warn(
            `[WHATSAPP] get_login_credentials delayed send skipped: ${result.reason || "unknown"}`
          );
        }
      })
      .catch((error) => {
        console.error(
          `[WHATSAPP] get_login_credentials delayed send failed for ${common.contactPhone || "unknown"}: ${error?.message || error}`
        );
      });
  }, waitMs);

  return {
    sent: false,
    scheduled: true,
    reason: null,
    delayMs: waitMs,
    contentSid,
    sid: ""
  };
}

/**
 * Sends welcome CTA template, then schedules credentials Quick Reply (~1 min later).
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
      dashboardUrl
    });

    if (!welcome.ok) {
      if (!allowFreeText) {
        console.error(
          `ERROR: שליחת וואטסאפ נכשלה למספר ${contactPhone || "לא ידוע"} מאת משתמש ${senderLabel || username || userId || "לא ידוע"}. סיבה: חסר TWILIO_COUPLE_ACCESS_CONTENT_SID (תבנית momo_welcome_onboarding_v2)`
        );
        return { sent: false, reason: "template_not_configured" };
      }

      const body = buildEventManagerWelcomeMessage({
        brideName,
        dashboardUrl
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
        credentialsQuickReply: { sent: false, scheduled: false, reason: "free_text_fallback" }
      };
    }

    const delayMs = getCredentialsQuickReplyDelayMs();
    const credentialsQr = scheduleCredentialsQuickReply(common, delayMs);

    return {
      sent: true,
      sid: welcome.sid,
      to,
      mode: "content_template",
      contentSid: welcome.contentSid,
      credentialsQuickReply: {
        sent: false,
        scheduled: Boolean(credentialsQr.scheduled),
        reason: credentialsQr.reason,
        delayMs: credentialsQr.delayMs,
        sid: "",
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
