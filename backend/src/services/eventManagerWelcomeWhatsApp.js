import {
  isTwilioConfigured,
  sanitizeWhatsAppTemplateVariable,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";

/**
 * Meta / Twilio Content Template — resubmit as UTILITY.
 *
 * Friendly name: couple_login_access_utility
 * Language: he (Hebrew)
 * Category: UTILITY
 *
 * Body (copy exactly):
 * ✨ 🥂 ✨
 * שלום {{1}},
 *
 * מתרגשים איתכם לקראת האירוע!
 *
 * להלן פרטי הגישה שלך למערכת momoEVENT:
 *
 * שם משתמש: {{2}}
 * סיסמה: {{3}}
 *
 * כניסה למערכת:
 * {{4}}
 *
 * קישור להזמנה הדיגיטלית:
 * {{5}}
 *
 * ✨ 🎉 ✨
 *
 * Variables:
 * 1 = שם הנמען
 * 2 = שם משתמש
 * 3 = סיסמה
 * 4 = קישור כניסה לדשבורד
 * 5 = קישור להזמנה הציבורית
 *
 * Sample values for review:
 * {{1}}=לינוי
 * {{2}}=linoy_itzik
 * {{3}}=TempPass123
 * {{4}}=https://momoevent.up.railway.app/client/login
 * {{5}}=https://momoevent.up.railway.app/event/example
 *
 * After approval: TWILIO_COUPLE_ACCESS_CONTENT_SID=HXxxxxxxxx
 */

const COUPLE_ACCESS_CONTENT_SID_DEFAULT = "";

export function getAdminWelcomeDisplayName() {
  return String(process.env.ADMIN_DISPLAY_NAME || "").trim() || "momoEVENT";
}

function getCoupleAccessContentSid() {
  return String(
    process.env.TWILIO_COUPLE_ACCESS_CONTENT_SID || COUPLE_ACCESS_CONTENT_SID_DEFAULT || ""
  ).trim();
}

export function buildEventManagerWelcomeMessage({
  brideName,
  username,
  password,
  dashboardUrl,
  invitationUrl
}) {
  const name = String(brideName || "").trim() || "כלה יקרה";

  return `✨ 🥂 ✨
שלום ${name},

מתרגשים איתכם לקראת האירוע!

להלן פרטי הגישה שלך למערכת momoEVENT:

שם משתמש: ${username}
סיסמה: ${password}

כניסה למערכת:
${dashboardUrl}

קישור להזמנה הדיגיטלית:
${invitationUrl}

✨ 🎉 ✨`;
}

export function buildCoupleAccessContentVariables({
  brideName,
  username,
  password,
  dashboardUrl,
  invitationUrl
}) {
  const values = {
    "1": sanitizeWhatsAppTemplateVariable(brideName, "כלה יקרה"),
    "2": sanitizeWhatsAppTemplateVariable(username, "-"),
    "3": sanitizeWhatsAppTemplateVariable(password, "-"),
    "4": sanitizeWhatsAppTemplateVariable(
      dashboardUrl,
      "https://momoevent.up.railway.app/client/login"
    ),
    "5": sanitizeWhatsAppTemplateVariable(
      invitationUrl,
      "https://momoevent.up.railway.app"
    )
  };

  return JSON.stringify(values);
}

/**
 * Sends couple login credentials via Meta-approved Content Template when configured.
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

  const contentSid = getCoupleAccessContentSid();
  const allowFreeText =
    String(process.env.TWILIO_COUPLE_ACCESS_ALLOW_FREE_TEXT || "")
      .trim()
      .toLowerCase() === "true";

  try {
    if (contentSid.startsWith("HX")) {
      const contentVariables = buildCoupleAccessContentVariables({
        brideName,
        username,
        password,
        dashboardUrl,
        invitationUrl
      });

      const result = await sendTwilioWhatsAppMessage({
        to,
        contentSid,
        contentVariables,
        userId,
        username,
        senderLabel: senderLabel || username,
        recipientPhone: contactPhone
      });

      return {
        sent: true,
        sid: result?.sid || "",
        to,
        mode: "content_template",
        contentSid
      };
    }

    if (!allowFreeText) {
      console.error(
        `ERROR: שליחת וואטסאפ נכשלה למספר ${contactPhone || "לא ידוע"} מאת משתמש ${senderLabel || username || userId || "לא ידוע"}. סיבה: חסר TWILIO_COUPLE_ACCESS_CONTENT_SID (תבנית Meta מאושרת לפרטי גישה)`
      );
      return { sent: false, reason: "template_not_configured" };
    }

    const body = buildEventManagerWelcomeMessage({
      brideName,
      username,
      password,
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
      mode: "free_text"
    };
  } catch (error) {
    return {
      sent: false,
      reason: "send_failed",
      error: error?.message || "WhatsApp send failed"
    };
  }
}
