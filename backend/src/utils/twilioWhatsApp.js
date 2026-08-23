import twilio from "twilio";
import { normalizePhone } from "./guestPhone.js";

const DEFAULT_MESSAGING_SERVICE_SID = "MG42b953157d0a2c06edaa8e088177c31b";

export function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID ||
        DEFAULT_MESSAGING_SERVICE_SID ||
        process.env.TWILIO_PHONE_NUMBER ||
        process.env.TWILIO_WHATSAPP_FROM)
  );
}

export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured on the server");
  }
  return twilio(accountSid, authToken);
}

export function getTwilioWhatsAppFrom() {
  const raw = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_FROM || "";
  const trimmed = String(raw).trim();
  if (!trimmed) {
    throw new Error("TWILIO_PHONE_NUMBER is not configured on the server");
  }
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  if (trimmed.startsWith("+")) return `whatsapp:${trimmed}`;
  return `whatsapp:+${trimmed.replace(/\D/g, "")}`;
}

export function getTwilioMessagingServiceSid() {
  const sid = String(
    process.env.TWILIO_MESSAGING_SERVICE_SID || DEFAULT_MESSAGING_SERVICE_SID
  ).trim();
  if (!sid.startsWith("MG")) {
    throw new Error("TWILIO_MESSAGING_SERVICE_SID must start with MG");
  }
  return sid;
}

export function toTwilioWhatsAppAddress(phone) {
  const domestic = normalizePhone(phone);
  if (!domestic) return "";
  const digits = domestic.startsWith("0") ? `972${domestic.slice(1)}` : domestic.replace(/\D/g, "");
  if (!digits) return "";
  return `whatsapp:+${digits}`;
}

function toContentVariableString(value) {
  if (value == null) return "";
  return String(value);
}

/**
 * WhatsApp-approved templates reject newlines, tabs, 5+ spaces, and empty values in variables.
 * @see https://www.twilio.com/docs/api/errors/21656
 */
export function sanitizeWhatsAppTemplateVariable(value, fallback = "-") {
  let text = toContentVariableString(value)
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/!+$/u, "")
    .replace(/ {2,}/g, " ")
    .trim();

  if (!text) {
    if (fallback === "") return "";
    text = String(fallback).trim();
  }

  return text || (fallback === "" ? "" : "-");
}

const TEMPLATE_VALUE_FALLBACKS = {
  "1": "אורח/ת יקר/ה",
  "2": "משפחה וחברים יקרים, הנכם מוזמנים לאירוע שלנו",
  "3": "פרטי האירוע יתעדכנו בקרוב",
  "4": "https://momoevent.up.railway.app",
  "5": "נתראה בשמחה"
};

const CONFERENCE_GUEST_NAME_FALLBACK = "משקיע/ה יקר/ה";

/** Approved Card SID: barak_finance_conference_invitation (כנס only). */
export const CONFERENCE_RSVP_CONTENT_SID_DEFAULT = "HX109869c36946f3ecd97dc94421d45be2";

export function resolveConferenceContentSid() {
  const fromEnv = String(process.env.TWILIO_CONFERENCE_RSVP_CONTENT_SID || "").trim();
  if (fromEnv.startsWith("HX")) return fromEnv;
  return CONFERENCE_RSVP_CONTENT_SID_DEFAULT;
}

function collectTemplateVariableKeysFromText(text, keys) {
  if (typeof text !== "string" || !text) return;
  for (const match of text.matchAll(/\{\{(\d+)\}\}/g)) {
    keys.add(match[1]);
  }
}

function extractContentVariableKeys(content) {
  const keys = new Set(Object.keys(content?.variables || {}));
  for (const typeDef of Object.values(content?.types || {})) {
    if (!typeDef || typeof typeDef !== "object") continue;
    // Text / media templates
    collectTemplateVariableKeysFromText(typeDef.body, keys);
    // Card templates (twilio/card): title + body hold {{n}} placeholders
    collectTemplateVariableKeysFromText(typeDef.title, keys);
    collectTemplateVariableKeysFromText(typeDef.subtitle, keys);
  }
  return [...keys].sort((a, b) => Number(a) - Number(b));
}

export async function fetchTwilioContentTemplate(contentSid) {
  const client = getTwilioClient();
  const sid = String(contentSid || "").trim();
  if (!sid.startsWith("HX")) {
    throw new Error(`Content SID must start with HX, received: ${sid.slice(0, 8)}...`);
  }

  const content = await client.content.v1.contents(sid).fetch();
  const variableKeys = extractContentVariableKeys(content);
  if (!variableKeys.length) {
    throw new Error(`Content template ${sid} has no variable definitions`);
  }

  return {
    sid: content.sid,
    friendlyName: content.friendlyName || content.friendly_name || "unknown",
    variableKeys,
    defaultVariables: content.variables || {},
    contentTypes: Object.keys(content.types || {})
  };
}

/**
 * Conference Card template (barak_finance_conference_invitation): ONLY {{1}} = guest name.
 * Do not include keys 2–5 — Twilio 63028 if parameter count mismatches.
 */
export function buildConferenceContentVariables(guestName) {
  const name = sanitizeWhatsAppTemplateVariable(guestName, CONFERENCE_GUEST_NAME_FALLBACK);
  // Build JSON manually so we never accidentally include extra keys from object spreads.
  return `{"1":${JSON.stringify(name)}}`;
}

export function isConferenceContentSid(contentSid) {
  const sid = String(contentSid || "").trim();
  if (!sid.startsWith("HX")) return false;
  return sid === resolveConferenceContentSid() || sid === CONFERENCE_RSVP_CONTENT_SID_DEFAULT;
}

/**
 * Normalize contentVariables for a conference Card send: exactly one key "1".
 * Drops any wedding-style keys (2–5) that would trigger Twilio 63028.
 */
export function enforceConferenceContentVariables(contentVariables, guestNameFallback = "") {
  let parsed = {};
  if (typeof contentVariables === "string" && contentVariables.trim()) {
    try {
      parsed = JSON.parse(contentVariables);
    } catch {
      parsed = {};
    }
  } else if (contentVariables && typeof contentVariables === "object") {
    parsed = contentVariables;
  }
  const name =
    parsed["1"] ??
    parsed[1] ??
    guestNameFallback ??
    CONFERENCE_GUEST_NAME_FALLBACK;
  return buildConferenceContentVariables(name);
}

/** Twilio Content API requires string keys ("1"…"N") and a JSON-stringified payload. */
export function buildTwilioContentVariables(
  {
    guestName,
    customOpeningText,
    eventDateTimeLocation,
    rsvpLink,
    closingSignOff
  },
  templateKeys = ["1", "2", "3", "4", "5"]
) {
  const keys = Array.isArray(templateKeys) && templateKeys.length ? templateKeys : ["1", "2", "3", "4", "5"];

  // Hard guard: single-variable templates (conference) must never emit extra keys
  if (keys.length === 1 && keys[0] === "1") {
    return buildConferenceContentVariables(guestName);
  }

  const mappedValues = {
    "1": guestName,
    "2": customOpeningText,
    "3": eventDateTimeLocation,
    "4": rsvpLink,
    "5": closingSignOff
  };

  const variables = {};
  for (const key of keys) {
    variables[key] = sanitizeWhatsAppTemplateVariable(
      mappedValues[key],
      TEMPLATE_VALUE_FALLBACKS[key] || "-"
    );
  }

  return JSON.stringify(variables);
}

export function formatWhatsAppRecipientPhone(toOrPhone) {
  const raw = String(toOrPhone || "").trim();
  if (!raw) return "לא ידוע";
  return raw.replace(/^whatsapp:/i, "") || "לא ידוע";
}

export function formatWhatsAppSenderLabel({ userId, username, senderLabel } = {}) {
  if (senderLabel) return String(senderLabel).trim();
  const parts = [];
  if (userId) parts.push(String(userId));
  if (username) parts.push(String(username));
  return parts.length ? parts.join(" / ") : "לא ידוע";
}

function formatTwilioFailureReason(error) {
  if (!error) return "שגיאה לא ידועה";
  const bits = [];
  if (error.code != null && error.code !== "") bits.push(`code=${error.code}`);
  if (error.status != null && error.status !== "") bits.push(`status=${error.status}`);
  if (error.message) bits.push(String(error.message));
  else if (typeof error === "string") bits.push(error);
  return bits.join(" | ") || "שגיאה לא ידועה";
}

/**
 * Send WhatsApp via Twilio and always log SUCCESS / ERROR for Railway console tracing.
 * Optional context: userId, username, senderLabel, recipientPhone
 *
 * Content templates (contentSid): NEVER send `body` / `mediaUrl` — media & copy live in the template.
 */
export async function sendTwilioWhatsAppMessage({
  to,
  body,
  contentSid,
  contentVariables,
  userId,
  username,
  senderLabel,
  recipientPhone
}) {
  const displayPhone = formatWhatsAppRecipientPhone(recipientPhone || to);
  const displaySender = formatWhatsAppSenderLabel({ userId, username, senderLabel });

  try {
    const client = getTwilioClient();
    const messagingServiceSid = getTwilioMessagingServiceSid();
    let result;
    if (contentSid) {
      let variablesJson =
        typeof contentVariables === "string"
          ? contentVariables
          : contentVariables != null
            ? JSON.stringify(contentVariables)
            : undefined;

      // Absolute guard for conference Card SID — only {"1": name}, never wedding 1–5.
      if (isConferenceContentSid(contentSid)) {
        variablesJson = enforceConferenceContentVariables(variablesJson);
        const keyCount = Object.keys(JSON.parse(variablesJson)).length;
        if (keyCount !== 1) {
          throw new Error(
            `Conference template requires exactly 1 contentVariable, got ${keyCount}: ${variablesJson}`
          );
        }
      }

      // Strict whitelist — do not pass body/mediaUrl/from extras that confuse Content sends.
      const messagePayload = {
        to: String(to),
        contentSid: String(contentSid).trim(),
        messagingServiceSid
      };
      if (variablesJson != null && variablesJson !== "") {
        messagePayload.contentVariables = variablesJson;
      }

      console.log(
        `[Twilio] messages.create contentSid=${messagePayload.contentSid} ` +
          `payloadKeys=${Object.keys(messagePayload).join(",")} ` +
          `contentVariables=${messagePayload.contentVariables || "(none)"} ` +
          `to=${displayPhone}`
      );

      result = await client.messages.create(messagePayload);
    } else {
      result = await client.messages.create({ body, messagingServiceSid, to });
    }

    console.log(
      `SUCCESS: וואטסאפ נשלח בהצלחה למספר ${displayPhone} מאת משתמש ${displaySender}`
    );
    return result;
  } catch (error) {
    const reason = formatTwilioFailureReason(error);
    console.error(
      `ERROR: שליחת וואטסאפ נכשלה למספר ${displayPhone} מאת משתמש ${displaySender}. סיבה: ${reason}`
    );
    throw error;
  }
}

/**
 * Dedicated conference invite send — Card template with ONLY {{1}}.
 * Use this for eventType כנס so wedding helpers cannot inject extra variables or body.
 */
export async function sendConferenceInviteWhatsApp({
  to,
  guestName,
  userId,
  username,
  senderLabel,
  recipientPhone
}) {
  const contentSid = resolveConferenceContentSid();
  const contentVariables = buildConferenceContentVariables(guestName);
  return sendTwilioWhatsAppMessage({
    to,
    contentSid,
    contentVariables,
    userId,
    username,
    senderLabel,
    recipientPhone
  });
}

