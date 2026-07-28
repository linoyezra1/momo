/**
 * WhatsApp session reply: couple requests login credentials via Quick Reply.
 *
 * Template: get_login_credentials
 * SID: HXb15c22c3378d40bc83152a03e14711b4
 * Button: 🔑 לקבלת פרטי הגישה · payload GET_CREDENTIALS
 *
 * Response is always a free-text session message inside the 24h customer window —
 * never another Content Template.
 */
import SystemAuditLog from "../models/SystemAuditLog.js";
import User from "../models/User.js";
import { getClientBaseUrl } from "../utils/clientUrl.js";
import { coupleCanManageVendors } from "../utils/coupleVendors.js";
import { normalizePhone, phoneLookupVariants } from "../utils/guestPhone.js";
import { getEventTypeNoun, isCoupleEventType } from "../utils/eventTypeWording.js";
import {
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";

export const CREDENTIALS_ACTION_ID = "GET_CREDENTIALS";
/** @deprecated use CREDENTIALS_ACTION_ID */
export const ACCESS_DETAILS_ACTION_ID = "GET_ACCESS_DETAILS";

export const CREDENTIALS_BUTTON_TEXT = "🔑 לקבלת פרטי הגישה";
export const CREDENTIALS_BUTTON_TEXT_PLAIN = "לקבלת פרטי הגישה";
export const ACCESS_DETAILS_BUTTON_TEXT = "קבלת פרטי גישה";

const SUPPORT_PHONE =
  String(process.env.MOMOEVENT_SUPPORT_PHONE || "0585915109").trim() || "0585915109";

const MSG_USER_NOT_FOUND = `שלום! המספר ממנו פנית אינו משויך לחשבון פעיל במערכת momoEVENT. ליצירת קשר עם התמיכה: ${SUPPORT_PHONE}.`;

const MSG_NO_CREDENTIALS =
  "החשבון שלך קיים אך טרם הוגדרו פרטי גישה.\nצוות התמיכה יעדכן אותך.";

/** Canonical couple login (user draft had /clinet/ — corrected). */
const PRODUCTION_LOGIN_URL = "https://momoevent.up.railway.app/client/login";

function normalizedInteractionValue(value) {
  return String(value || "").trim();
}

function stripButtonDecorations(value) {
  return normalizedInteractionValue(value)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseInteractiveData(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * Extract button id / text from Twilio inbound WhatsApp webhook fields.
 */
export function extractWhatsAppButtonIdentity({
  body,
  buttonPayload,
  buttonText,
  interactiveData
} = {}) {
  const interactive = parseInteractiveData(interactiveData);
  const payload = normalizedInteractionValue(
    buttonPayload ||
      interactive?.ButtonPayload ||
      interactive?.button_payload ||
      interactive?.id ||
      interactive?.Id ||
      ""
  );
  const text = normalizedInteractionValue(
    buttonText ||
      body ||
      interactive?.ButtonText ||
      interactive?.button_text ||
      interactive?.title ||
      interactive?.Title ||
      ""
  );
  return { payload, text };
}

export function isAccessDetailsRequest({ payload, text } = {}) {
  const p = normalizedInteractionValue(payload).toUpperCase();
  const t = normalizedInteractionValue(text);
  const plain = stripButtonDecorations(t);

  if (p === CREDENTIALS_ACTION_ID || p === ACCESS_DETAILS_ACTION_ID) return true;
  if (t.toUpperCase() === CREDENTIALS_ACTION_ID || t.toUpperCase() === ACCESS_DETAILS_ACTION_ID) {
    return true;
  }
  if (t === CREDENTIALS_BUTTON_TEXT || plain === CREDENTIALS_BUTTON_TEXT_PLAIN) return true;
  if (t === ACCESS_DETAILS_BUTTON_TEXT || plain === ACCESS_DETAILS_BUTTON_TEXT) return true;
  // Soft match: Hebrew title without exact emoji spacing
  if (plain.includes("לקבלת פרטי הגישה") || plain.includes("קבלת פרטי גישה")) return true;
  return false;
}

function eventDisplayLabel(event = {}) {
  if (isCoupleEventType(event.eventType)) {
    const groom = String(event.groomName || "").trim();
    const bride = String(event.brideName || "").trim();
    const noun = getEventTypeNoun(event.eventType);
    if (groom && bride) return `${noun} — ${groom} ו${bride}`;
    return bride || groom || noun;
  }
  if (event.eventType === "ברית") {
    const names = [event.parentName1, event.parentName2]
      .map((n) => String(n || "").trim())
      .filter(Boolean);
    return names.length ? `ברית — ${names.join(" ו")}` : "ברית";
  }
  if (event.eventType === "בת מצווה") {
    return String(event.batMitzvahName || event.parentName1 || "בת מצווה").trim() || "בת מצווה";
  }
  return String(event.eventNames || event.eventType || "אירוע").trim() || "אירוע";
}

/** Prefer bride / primary contact name for "שלום {כלה}". */
export function credentialsGreetingName(event = {}) {
  if (isCoupleEventType(event.eventType)) {
    return String(event.brideName || event.groomName || "").trim();
  }
  if (event.eventType === "ברית") {
    return String(event.parentName1 || event.parentName2 || "").trim();
  }
  if (event.eventType === "בת מצווה") {
    return String(event.parentName1 || event.batMitzvahName || "").trim();
  }
  return String(event.eventNames || "").trim();
}

function buildLoginUrl(origin) {
  const base = String(origin || getClientBaseUrl() || "https://momoevent.up.railway.app").replace(
    /\/+$/,
    ""
  );
  if (base.includes("momoevent.up.railway.app")) {
    return PRODUCTION_LOGIN_URL;
  }
  return `${base}/client/login`;
}

function featuresBlock({ includeVendors = true } = {}) {
  const lines = [
    "✅ עריכת ההזמנה הדיגיטלית המעוצבת שלכם",
    "✅ העלאת מוזמנים מהירה מאנשי קשר או קובץ אקסל",
    "✅ שליחת הודעות WhatsApp ללא הגבלה (נשלח מהמספר האישי שלכם)",
    "במידה ומעוניינים שיגיע ממס טלפון החברה יש לרכוש את השירות",
    "✅ ניהול ומעקב בזמן אמת אחרי אישורי הגעה"
  ];
  if (includeVendors) {
    lines.push("✅ מערכת לניהול ספקים ותקציב האירוע");
  }
  lines.push(
    "✅ מערכת סידורי הושבה חכמה לאלו שאישרו",
    "✅ מערכת דיילת הושבה ליום האירוע"
  );
  return lines.join("\n");
}

export function buildAccessDetailsMessage({
  username,
  password,
  loginUrl,
  brideName,
  includeVendors = true
} = {}) {
  const name = String(brideName || "").trim();
  const greeting = name ? `שלום ${name}! 👋` : "שלום! 👋";
  const user = String(username || "").trim() || "—";
  const pass = String(password || "").trim() || "—";
  const url = String(loginUrl || "").trim() || PRODUCTION_LOGIN_URL;

  return `${greeting}

איזה כיף! הכל מוכן עבורכם ב-momoEVENT אישורי הגעה 🎉

הנה פרטי הגישה האישיים שלכם:
👤 שם משתמש: ${user}
🔑 קוד גישה: ${pass}

מעכשיו, תוכלו לנהל הכל בקלות במקום אחד:
${featuresBlock({ includeVendors })}

כניסה למערכת: ${url}

אנחנו כאן לכל שאלה, תרגישו חופשי לפנות אלינו בווצאפ ${SUPPORT_PHONE} 📱

במזל טוב,
צוות momoEVENT`;
}

export function buildMultiAccountAccessDetailsMessage({
  accounts,
  loginUrl,
  brideName,
  includeVendors = true
} = {}) {
  const name = String(brideName || "").trim();
  const greeting = name ? `שלום ${name}! 👋` : "שלום! 👋";
  const url = String(loginUrl || "").trim() || PRODUCTION_LOGIN_URL;
  const blocks = accounts.map((account, index) => {
    return `—— חשבון ${index + 1}: ${account.eventLabel} ——
👤 שם משתמש: ${account.username}
🔑 קוד גישה: ${account.password}`;
  });

  return `${greeting}

איזה כיף! הכל מוכן עבורכם ב-momoEVENT אישורי הגעה 🎉

נמצאו כמה חשבונות המשויכים למספר זה:

${blocks.join("\n\n")}

מעכשיו, תוכלו לנהל הכל בקלות במקום אחד:
${featuresBlock({ includeVendors })}

כניסה למערכת: ${url}

אנחנו כאן לכל שאלה, תרגישו חופשי לפנות אלינו בווצאפ ${SUPPORT_PHONE} 📱

במזל טוב,
צוות momoEVENT`;
}

async function recordCredentialsAudit({
  phone,
  userId = null,
  status,
  description,
  metadata = {}
}) {
  try {
    await SystemAuditLog.create({
      source: "WHATSAPP_QUICK_REPLY",
      action: CREDENTIALS_ACTION_ID,
      status,
      phone: String(phone || "").trim(),
      userId: userId || null,
      description,
      metadata
    });
  } catch (error) {
    console.error(
      `[WHATSAPP] Failed to write SystemAuditLog: ${error?.message || error}`
    );
  }
}

/**
 * Find couple accounts whose contactPhone matches the inbound WhatsApp number.
 * Always verifies normalizePhone(db) === normalizePhone(inbound).
 */
export async function findUsersByWhatsAppPhone(fromOrPhone) {
  const inboundNormalized = normalizePhone(String(fromOrPhone || "").replace(/^whatsapp:/i, ""));
  if (!inboundNormalized) return [];

  const variants = phoneLookupVariants(inboundNormalized);
  const national = inboundNormalized.startsWith("0")
    ? inboundNormalized.slice(1)
    : inboundNormalized;

  const candidates = await User.find({
    $or: [
      { contactPhone: { $in: variants } },
      ...(national.length >= 9 ? [{ contactPhone: { $regex: `${national}$` } }] : [])
    ]
  })
    .select("username loginPassword contactPhone event managedBy createdAt updatedAt")
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return candidates.filter((user) => {
    const saved = normalizePhone(user.contactPhone);
    return Boolean(saved) && saved === inboundNormalized;
  });
}

async function sendSessionReply({ toPhone, body, userId }) {
  const to = toTwilioWhatsAppAddress(toPhone);
  if (!to) {
    throw new Error("invalid_whatsapp_address");
  }
  return sendTwilioWhatsAppMessage({
    to,
    body,
    userId,
    recipientPhone: toPhone
  });
}

/**
 * Handle GET_CREDENTIALS (and legacy aliases). Returns { handled: true, ... } when claimed.
 */
export async function handleGetAccessDetailsRequest({
  from,
  body,
  buttonPayload,
  buttonText,
  interactiveData,
  origin,
  messageSid
} = {}) {
  const { payload, text } = extractWhatsAppButtonIdentity({
    body,
    buttonPayload,
    buttonText,
    interactiveData
  });

  if (!isAccessDetailsRequest({ payload, text })) {
    return { handled: false, reason: "not_access_details" };
  }

  const inboundPhoneRaw = String(from || "").replace(/^whatsapp:/i, "").trim();
  const inboundPhoneNormalized = normalizePhone(inboundPhoneRaw);
  const inboundPhone = inboundPhoneNormalized || inboundPhoneRaw;
  const timestamp = new Date().toISOString();
  const loginUrl = buildLoginUrl(origin);
  const actionId = CREDENTIALS_ACTION_ID;
  const auditMeta = {
    messageSid: messageSid || "",
    buttonPayload: payload,
    buttonText: text,
    from: from || "",
    timestamp
  };

  console.log(
    `[WHATSAPP] Access details requested\nphone: ${inboundPhone || "unknown"}\npayload: ${payload || "-"}\ntext: ${text || "-"}\ntimestamp: ${timestamp}`
  );

  const users = await findUsersByWhatsAppPhone(from);

  if (!users.length) {
    console.warn(
      `[WHATSAPP] Access details failed - user not found\nphone: ${inboundPhone || "unknown"}\ntimestamp: ${timestamp}`
    );
    await recordCredentialsAudit({
      phone: inboundPhone,
      status: "user_not_found",
      description: "בקשת פרטי גישה — מספר לא משויך לחשבון",
      metadata: auditMeta
    });
    try {
      await sendSessionReply({
        toPhone: inboundPhoneRaw || inboundPhone,
        body: MSG_USER_NOT_FOUND
      });
    } catch (error) {
      console.error(
        `[WHATSAPP] Access details failed - could not notify unknown phone: ${error?.message || error}`
      );
    }
    return { handled: true, action: actionId, reason: "user_not_found" };
  }

  const withCredentials = users.filter((user) => String(user.loginPassword || "").trim());
  if (!withCredentials.length) {
    const first = users[0];
    console.warn(
      `[WHATSAPP] Access details failed - credentials missing\nphone: ${inboundPhone}\nuser_id: ${first._id}\nevent_id: ${first._id}\ntimestamp: ${timestamp}`
    );
    await recordCredentialsAudit({
      phone: inboundPhone,
      userId: first._id,
      status: "credentials_missing",
      description: "בקשת פרטי גישה — חשבון ללא קוד גישה שמור",
      metadata: { ...auditMeta, userIds: users.map((u) => String(u._id)) }
    });
    await sendSessionReply({
      toPhone: inboundPhoneRaw || inboundPhone,
      body: MSG_NO_CREDENTIALS,
      userId: first._id
    });
    return { handled: true, action: actionId, reason: "credentials_missing" };
  }

  const primary = withCredentials[0];
  console.log(
    `[WHATSAPP] Access details matched\nphone: ${inboundPhone}\nuser_id: ${primary._id}\nevent_id: ${primary._id}\ntimestamp: ${timestamp}`
  );

  const brideName = credentialsGreetingName(primary.event);
  const includeVendors = coupleCanManageVendors(primary);

  let messageBody;
  if (withCredentials.length === 1) {
    messageBody = buildAccessDetailsMessage({
      username: primary.username,
      password: primary.loginPassword,
      loginUrl,
      brideName,
      includeVendors
    });
  } else {
    messageBody = buildMultiAccountAccessDetailsMessage({
      loginUrl,
      brideName,
      includeVendors,
      accounts: withCredentials.map((user) => ({
        eventLabel: eventDisplayLabel(user.event),
        username: user.username,
        password: user.loginPassword
      }))
    });
  }

  await sendSessionReply({
    toPhone: inboundPhoneRaw || inboundPhone,
    body: messageBody,
    userId: primary._id
  });

  await recordCredentialsAudit({
    phone: inboundPhone,
    userId: primary._id,
    status: "sent",
    description: "פרטי גישה נשלחו בוואטסאפ (session free-text)",
    metadata: {
      ...auditMeta,
      userIds: withCredentials.map((u) => String(u._id)),
      accountCount: withCredentials.length
    }
  });

  console.log(
    `[WHATSAPP] Access details sent successfully\nphone: ${inboundPhone}\nuser_id: ${primary._id}\naccounts: ${withCredentials.length}`
  );

  return {
    handled: true,
    action: actionId,
    reason: "sent",
    userIds: withCredentials.map((u) => String(u._id))
  };
}
