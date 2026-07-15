import {
  isTwilioConfigured,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";

function getEventManagerDisplayName() {
  return (
    String(process.env.EVENT_MANAGER_DISPLAY_NAME || "").trim() ||
    String(process.env.EVENT_MANAGER_USERNAME || "").trim() ||
    "מנהל האירוע"
  );
}

export function getAdminWelcomeDisplayName() {
  return String(process.env.ADMIN_DISPLAY_NAME || "").trim() || "momoEVENT";
}

export function buildEventManagerWelcomeMessage({
  brideName,
  managerName,
  username,
  password,
  dashboardUrl,
  invitationUrl
}) {
  const name = String(brideName || "").trim() || "כלה יקרה";
  const manager = String(managerName || "").trim() || getEventManagerDisplayName();

  return `✨ 🥂 ✨
שלום ${name},

שמחים שבחרתם לנהל את האירוע שלכם עם ${manager}!
יהיה מושלם, אל תדאגו. ❤️

הנה פרטי הגישה שלכם למערכת ניהול המוזמנים וההושבה:
שם משתמש: ${username}
סיסמה: ${password}

🔗 קישור למערכת הניהול שלכם:
${dashboardUrl}

🔗 קישור לצפייה בהזמנה הדיגיטלית שלכם:
${invitationUrl}

נתראה בשמחות!
MomoEvent ✨ 🎉`;
}

/**
 * Operational/utility WhatsApp (free-text body) — does NOT use client coupon credits.
 */
export async function sendEventManagerWelcomeWhatsApp({
  contactPhone,
  brideName,
  username,
  password,
  dashboardUrl,
  invitationUrl,
  managerName,
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

  const body = buildEventManagerWelcomeMessage({
    brideName,
    managerName: managerName || getEventManagerDisplayName(),
    username,
    password,
    dashboardUrl,
    invitationUrl
  });

  try {
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
      to
    };
  } catch (error) {
    // ERROR already logged inside sendTwilioWhatsAppMessage
    return {
      sent: false,
      reason: "send_failed",
      error: error?.message || "WhatsApp send failed"
    };
  }
}
