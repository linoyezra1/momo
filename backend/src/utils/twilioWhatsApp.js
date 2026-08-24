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

/** Approved WhatsApp Card SID: barak_finance_conference_qr (כנס only). */
export const CONFERENCE_RSVP_CONTENT_SID_DEFAULT = "HX9d0b8803b34c2ab350ccc213c7d1dd87";
/** Previous Card SIDs (keep recognizing for in-flight / old env). */
const CONFERENCE_RSVP_CONTENT_SID_LEGACY_SIDS = [
  "HX19ff27eee129f0405599114db4635802",
  "HX109869c36946f3ecd97dc94421d45be2"
];

export function resolveConferenceContentSid() {
  const fromEnv = String(process.env.TWILIO_CONFERENCE_RSVP_CONTENT_SID || "").trim();
  if (fromEnv.startsWith("HX")) return fromEnv;
  return CONFERENCE_RSVP_CONTENT_SID_DEFAULT;
}

/** Where the conference Card SID came from (for Railway diagnostics). */
export function describeConferenceContentSid() {
  const fromEnv = String(process.env.TWILIO_CONFERENCE_RSVP_CONTENT_SID || "").trim();
  if (fromEnv.startsWith("HX")) {
    return {
      contentSid: fromEnv,
      sidSource: "env:TWILIO_CONFERENCE_RSVP_CONTENT_SID"
    };
  }
  return {
    contentSid: CONFERENCE_RSVP_CONTENT_SID_DEFAULT,
    sidSource: "default:CONFERENCE_RSVP_CONTENT_SID_DEFAULT"
  };
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
 * Diagnostic-only: dump Content variables + ApprovalRequests for 63028 investigations.
 * Never throws — logging must not block send.
 */
export async function logTwilioContentApprovalDiagnostics(contentSid, label = "diag") {
  const tag = `[Twilio][diag-63028][${label}]`;
  const sid = String(contentSid || "").trim();
  if (!sid.startsWith("HX")) {
    console.warn(`${tag} skip — invalid contentSid=${sid}`);
    return;
  }

  try {
    const client = getTwilioClient();
    const content = await client.content.v1.contents(sid).fetch();
    const variableKeys = extractContentVariableKeys(content);
    const types = content.types || {};
    const typeSummaries = {};
    for (const [typeName, typeDef] of Object.entries(types)) {
      if (!typeDef || typeof typeDef !== "object") continue;
      typeSummaries[typeName] = {
        hasTitle: Boolean(typeDef.title),
        hasSubtitle: Boolean(typeDef.subtitle),
        hasBody: Boolean(typeDef.body),
        titleSample: typeof typeDef.title === "string" ? typeDef.title.slice(0, 80) : null,
        bodyHasVar1: typeof typeDef.body === "string" && typeDef.body.includes("{{1}}"),
        mediaCount: Array.isArray(typeDef.media) ? typeDef.media.length : 0,
        mediaSample: Array.isArray(typeDef.media)
          ? typeDef.media.map((m) => String(m).slice(0, 120))
          : [],
        buttonCount: Array.isArray(typeDef.actions) ? typeDef.actions.length : 0
      };
    }

    console.log(
      `${tag} Content fetch sid=${content.sid} friendlyName=${content.friendlyName || content.friendly_name || "?"} ` +
        `language=${content.language || "?"} variableKeys=[${variableKeys.join(",")}] ` +
        `variablesJson=${JSON.stringify(content.variables || {})}`
    );
    console.log(`${tag} Content types=${JSON.stringify(typeSummaries)}`);

    // Approval / WhatsApp submission shape (where Meta param count often differs from Content UI)
    let approvalPayload = null;
    try {
      if (client.content?.v1?.contents?.(sid)?.approvalRequests?.fetch) {
        approvalPayload = await client.content.v1.contents(sid).approvalRequests.fetch();
      }
    } catch (approvalErr) {
      console.warn(
        `${tag} approvalRequests.fetch failed: ${approvalErr?.message || approvalErr}`
      );
    }
    if (!approvalPayload) {
      try {
        if (client.content?.v1?.contentAndApprovals?.(sid)?.fetch) {
          approvalPayload = await client.content.v1.contentAndApprovals(sid).fetch();
        }
      } catch (caaErr) {
        console.warn(
          `${tag} contentAndApprovals.fetch failed: ${caaErr?.message || caaErr}`
        );
      }
    }

    if (approvalPayload) {
      const slim = {
        sid: approvalPayload.sid,
        name: approvalPayload.name || approvalPayload.friendlyName,
        approvalRequests: approvalPayload.approvalRequests || approvalPayload.approval_requests,
        whatsapp: approvalPayload.whatsapp,
        status: approvalPayload.status,
        category: approvalPayload.category,
        allowCategoryChange: approvalPayload.allowCategoryChange,
        types: approvalPayload.types ? Object.keys(approvalPayload.types) : undefined,
        variables: approvalPayload.variables
      };
      console.log(`${tag} Approval payload (slim)=${JSON.stringify(slim)}`);
      try {
        console.log(
          `${tag} Approval payload (full, truncated)=${JSON.stringify(approvalPayload).slice(0, 4000)}`
        );
      } catch {
        console.log(`${tag} Approval payload could not be stringified`);
      }
    } else {
      console.warn(`${tag} No ApprovalRequests payload available — check Console manually`);
    }
  } catch (error) {
    console.warn(`${tag} Content diagnostics failed: ${error?.message || error}`);
  }
}

/** Snapshot of Twilio Content SID env vars (for deploy/env mismatch checks). */
export function logTwilioContentSidEnvSnapshot(label = "diag") {
  const tag = `[Twilio][diag-63028][${label}]`;
  const pick = (name) => {
    const raw = String(process.env[name] || "").trim();
    return raw ? raw : "(unset)";
  };
  console.log(
    `${tag} ENV SIDs ` +
      `TWILIO_CONFERENCE_RSVP_CONTENT_SID=${pick("TWILIO_CONFERENCE_RSVP_CONTENT_SID")} ` +
      `resolvedConference=${resolveConferenceContentSid()} ` +
      `TWILIO_CONTENT_SID=${pick("TWILIO_CONTENT_SID")} ` +
      `TWILIO_STANDARD_INVITE_CONTENT_SID=${pick("TWILIO_STANDARD_INVITE_CONTENT_SID")} ` +
      `TWILIO_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID=${pick("TWILIO_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID")} ` +
      `TWILIO_COPY_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID=${pick("TWILIO_COPY_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID")}`
  );
}

function summarizeContentVariables(contentVariables) {
  let raw =
    typeof contentVariables === "string"
      ? contentVariables
      : contentVariables != null
        ? JSON.stringify(contentVariables)
        : "";
  let keys = [];
  let parseOk = false;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      keys = Object.keys(parsed || {}).sort((a, b) => Number(a) - Number(b));
      parseOk = true;
    } catch {
      parseOk = false;
    }
  }
  return {
    raw: raw || "(none)",
    keys,
    keyCount: keys.length,
    parseOk,
    hasKeys2to5: keys.some((k) => ["2", "3", "4", "5"].includes(k))
  };
}

/**
 * Conference WhatsApp Card (barak_finance_conference_qr): ONLY {{1}} = guest name.
 * Static media is baked into the template — do NOT pass key "2" (Twilio Support).
 */
export function buildConferenceContentVariables(guestName) {
  const name = sanitizeWhatsAppTemplateVariable(guestName, CONFERENCE_GUEST_NAME_FALLBACK);
  return `{"1":${JSON.stringify(name)}}`;
}

export function isConferenceContentSid(contentSid) {
  const sid = String(contentSid || "").trim();
  if (!sid.startsWith("HX")) return false;
  return (
    sid === resolveConferenceContentSid() ||
    sid === CONFERENCE_RSVP_CONTENT_SID_DEFAULT ||
    CONFERENCE_RSVP_CONTENT_SID_LEGACY_SIDS.includes(sid)
  );
}

/**
 * Normalize contentVariables for a conference Card send: exactly one key "1".
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
  const diagTag = "[Twilio][diag-63028][messages.create]";

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

      const varsBeforeEnforce = summarizeContentVariables(variablesJson);
      console.log(
        `${diagTag} BEFORE_ENFORCE contentSid=${String(contentSid).trim()} ` +
          `isConferenceSid=${isConferenceContentSid(contentSid)} ` +
          `keyCount=${varsBeforeEnforce.keyCount} keys=[${varsBeforeEnforce.keys.join(",")}] ` +
          `hasKeys2to5=${varsBeforeEnforce.hasKeys2to5} raw=${varsBeforeEnforce.raw}`
      );

      // Absolute guard for conference Card SID — only {"1": name} (Twilio Support).
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

      const varsAfter = summarizeContentVariables(messagePayload.contentVariables);
      const forbiddenKeys = ["body", "mediaUrl", "from", "statusCallback"].filter((k) =>
        Object.prototype.hasOwnProperty.call(messagePayload, k)
      );
      console.log(
        `${diagTag} FINAL_PAYLOAD payloadKeys=[${Object.keys(messagePayload).join(",")}] ` +
          `forbiddenKeysPresent=[${forbiddenKeys.join(",") || "none"}] ` +
          `contentSid=${messagePayload.contentSid} ` +
          `messagingServiceSid=${messagingServiceSid} ` +
          `contentVariables keyCount=${varsAfter.keyCount} keys=[${varsAfter.keys.join(",")}] ` +
          `hasKeys2to5=${varsAfter.hasKeys2to5} raw=${varsAfter.raw} to=${displayPhone}`
      );
      console.log(
        `[Twilio] messages.create contentSid=${messagePayload.contentSid} ` +
          `payloadKeys=${Object.keys(messagePayload).join(",")} ` +
          `contentVariables=${messagePayload.contentVariables || "(none)"} ` +
          `to=${displayPhone}`
      );

      result = await client.messages.create(messagePayload);

      // Create succeeded — 63028 often appears later as Delivery Warning (async).
      console.log(
        `${diagTag} CREATE_OK messageSid=${result?.sid || "?"} status=${result?.status || "?"} ` +
          `errorCode=${result?.errorCode ?? result?.error_code ?? "(none)"} ` +
          `errorMessage=${result?.errorMessage || result?.error_message || "(none)"} ` +
          `numMedia=${result?.numMedia ?? result?.num_media ?? "?"} ` +
          `hasBody=${Boolean(result?.body)} bodyLen=${String(result?.body || "").length} ` +
          `NOTE=63028 may still appear later on WhatsApp delivery even when CREATE_OK`
      );
    } else {
      console.log(
        `${diagTag} FREE_TEXT_PATH (no contentSid) bodyLen=${String(body || "").length} to=${displayPhone}`
      );
      result = await client.messages.create({ body, messagingServiceSid, to });
    }

    console.log(
      `SUCCESS: וואטסאפ נשלח בהצלחה למספר ${displayPhone} מאת משתמש ${displaySender}`
    );
    return result;
  } catch (error) {
    const reason = formatTwilioFailureReason(error);
    console.error(
      `${diagTag} CREATE_FAIL code=${error?.code ?? "?"} status=${error?.status ?? "?"} ` +
        `message=${error?.message || reason}`
    );
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
  const { contentSid, sidSource } = describeConferenceContentSid();
  const contentVariables = buildConferenceContentVariables(guestName);
  console.log(
    `[Twilio][conference-send] contentSid=${contentSid} sidSource=${sidSource} ` +
      `contentVariables=${contentVariables}`
  );
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

