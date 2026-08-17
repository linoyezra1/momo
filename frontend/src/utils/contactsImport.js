/**
 * @typedef {Object} DeviceContactName
 * @property {string} [formatted]
 * @property {string[]} [givenName]
 * @property {string[]} [familyName]
 */

/**
 * @typedef {Object} DeviceContactTel
 * @property {string[]} [value] — Contact Picker API uses string[] for tel
 */

/**
 * @typedef {Object} DeviceContact
 * @property {string[]|DeviceContactName[]} [name]
 * @property {string[]|DeviceContactTel[]} [tel]
 */

/**
 * @typedef {Object} ReviewContactRow
 * @property {string} id
 * @property {string} fullName
 * @property {string} phone
 * @property {boolean} selected
 * @property {boolean} isDuplicate
 * @property {boolean} isExistingDuplicate
 * @property {boolean} isBatchDuplicate
 * @property {boolean} isInvalidPhone
 * @property {string} [rawPhone]
 * @property {object|null} [existingGuest]
 */

import { indexGuestsByPhone } from "./guestDuplicate.js";
import { normalizeIsraeliPhone } from "./phoneNormalize.js";

export const CONTACT_GROUP_OPTIONS = [
  { value: "", label: "ללא קבוצה" },
  { value: "משפחה", label: "משפחה" },
  { value: "חברים", label: "חברים" },
  { value: "עבודה", label: "עבודה" },
  { value: "אחר", label: "אחר" }
];

export function isContactsPickerSupported() {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.contacts && typeof navigator.contacts.select === "function");
}

/** iPhone / iPad — Contact Picker API is not available in Safari/Chrome WebKit. */
export function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = String(navigator.userAgent || "");
  const platform = String(navigator.platform || "");
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  // iPadOS 13+ can report as Mac with touch
  if (platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

function pickContactName(contact) {
  if (!contact) return "";
  const nameField = contact.name;
  if (Array.isArray(nameField) && nameField.length) {
    const first = nameField[0];
    if (typeof first === "string") return first.trim();
    if (first && typeof first === "object") {
      if (first.formatted) return String(first.formatted).trim();
      const given = Array.isArray(first.givenName) ? first.givenName.join(" ") : "";
      const family = Array.isArray(first.familyName) ? first.familyName.join(" ") : "";
      return `${given} ${family}`.trim();
    }
  }
  return "";
}

function pickContactPhone(contact) {
  if (!contact) return "";
  const telField = contact.tel;
  if (!Array.isArray(telField) || !telField.length) return "";

  for (const entry of telField) {
    if (typeof entry === "string" && entry.trim()) return entry.trim();
    if (entry && typeof entry === "object") {
      if (typeof entry === "string") return entry;
      const values = Array.isArray(entry) ? entry : entry.value;
      if (Array.isArray(values) && values[0]) return String(values[0]).trim();
      if (typeof entry.value === "string") return entry.value.trim();
    }
  }
  return "";
}

export function isLikelyValidIsraeliMobile(phone) {
  return /^05\d{8}$/.test(String(phone || ""));
}

/**
 * @param {DeviceContact[]} contacts
 * @param {Array<{phone?: string}>} existingGuests
 * @returns {ReviewContactRow[]}
 */
export function mapDeviceContactsToReviewRows(contacts, existingGuests = []) {
  const existingByPhone = indexGuestsByPhone(existingGuests);
  const seenInBatch = new Set();
  const rows = [];

  (contacts || []).forEach((contact, index) => {
    const fullName = pickContactName(contact) || `איש קשר ${index + 1}`;
    const rawPhone = pickContactPhone(contact);
    const phone = normalizeIsraeliPhone(rawPhone);
    const isInvalidPhone = !phone || !isLikelyValidIsraeliMobile(phone);
    const existingGuest = phone ? existingByPhone.get(phone) || null : null;
    const isExistingDuplicate = Boolean(existingGuest);
    const isBatchDuplicate = Boolean(phone) && seenInBatch.has(phone);
    const isDuplicate = isExistingDuplicate || isBatchDuplicate;

    if (phone) seenInBatch.add(phone);

    rows.push({
      id: `contact-${index}-${phone || "none"}-${Math.random().toString(36).slice(2, 7)}`,
      fullName,
      phone,
      rawPhone,
      selected: Boolean(phone) && !isBatchDuplicate && !isInvalidPhone,
      isDuplicate,
      isExistingDuplicate,
      isBatchDuplicate,
      isInvalidPhone,
      existingGuest
    });
  });

  return rows;
}

export async function pickContactsFromDevice() {
  if (!isContactsPickerSupported()) {
    const error = new Error("Contacts Picker API is not supported");
    error.code = "UNSUPPORTED";
    throw error;
  }

  try {
    const contacts = await navigator.contacts.select(["name", "tel"], { multiple: true });
    if (!Array.isArray(contacts) || !contacts.length) {
      const error = new Error("No contacts selected");
      error.code = "EMPTY";
      throw error;
    }
    return contacts;
  } catch (error) {
    if (error?.code === "EMPTY" || error?.code === "UNSUPPORTED") throw error;
    if (error?.name === "AbortError" || error?.name === "NotAllowedError") {
      const denied = new Error(error.message || "Permission denied");
      denied.code = error.name === "AbortError" ? "ABORTED" : "DENIED";
      throw denied;
    }
    const wrapped = new Error(error?.message || "Failed to open contacts");
    wrapped.code = "FAILED";
    throw wrapped;
  }
}

function unfoldVCardText(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "");
}

function decodeQuotedPrintable(value) {
  const cleaned = String(value || "").replace(/=\n/g, "");
  const bytes = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    if (cleaned[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    bytes.push(cleaned.charCodeAt(i) & 0xff);
  }
  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return cleaned;
  }
}

function unescapeVCardValue(value) {
  return String(value || "")
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseVCardLine(line) {
  const colon = line.indexOf(":");
  if (colon < 1) return null;
  const rawKey = line.slice(0, colon);
  let value = line.slice(colon + 1);
  const keyParts = rawKey.split(";");
  const name = String(keyParts[0] || "")
    .replace(/^item\d+\./i, "")
    .toUpperCase();
  const params = {};
  keyParts.slice(1).forEach((part) => {
    const [paramName, paramValue] = String(part).split("=");
    const key = String(paramName || "").toUpperCase();
    const val = paramValue ? String(paramValue).toUpperCase() : "TRUE";
    params[key] = params[key] ? `${params[key]},${val}` : val;
  });
  if (String(params.ENCODING || "").includes("QUOTED-PRINTABLE")) {
    value = decodeQuotedPrintable(value);
  }
  return { name, params, value: unescapeVCardValue(value) };
}

function nameFromNField(value) {
  const [family, given, additional] = String(value || "").split(";");
  return [given, additional, family].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function telScore(rawPhone, params) {
  const type = `${params.TYPE || ""} ${params.VALUE || ""}`;
  const normalized = normalizeIsraeliPhone(rawPhone);
  if (isLikelyValidIsraeliMobile(normalized)) return 3;
  if (/CELL|MOBILE|IPHONE|PREF/.test(type)) return 2;
  if (normalized) return 1;
  return 0;
}

function pickBestPhone(telEntries) {
  let best = "";
  let bestScore = -1;
  telEntries.forEach(({ value, params }) => {
    const raw = String(value || "")
      .replace(/^tel:/i, "")
      .trim();
    if (!raw) return;
    const score = telScore(raw, params);
    if (score > bestScore) {
      bestScore = score;
      best = raw;
    }
  });
  return best;
}

function parseVCardCard(block) {
  const lines = unfoldVCardText(block)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let fullName = "";
  let structuredName = "";
  const tels = [];

  lines.forEach((line) => {
    const parsed = parseVCardLine(line);
    if (!parsed) return;
    if (parsed.name === "FN" && parsed.value) fullName = parsed.value;
    if (parsed.name === "N" && parsed.value) structuredName = nameFromNField(parsed.value);
    if (parsed.name === "TEL" && parsed.value) tels.push(parsed);
  });

  const name = fullName || structuredName;
  const phone = pickBestPhone(tels);
  if (!name && !phone) return null;
  return {
    name: name ? [name] : [],
    tel: phone ? [phone] : []
  };
}

/** Parse one or more vCard contacts from .vcf text into Contact Picker-like objects. */
export function parseVCardText(text) {
  const source = unfoldVCardText(text);
  const blocks = source.split(/BEGIN:VCARD/i).slice(1);
  const contacts = [];
  blocks.forEach((block) => {
    const card = parseVCardCard(block.split(/END:VCARD/i)[0] || "");
    if (card) contacts.push(card);
  });
  return contacts;
}

function decodeVCardBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export async function parseVCardFile(file) {
  if (!file) {
    const error = new Error("No vCard file");
    error.code = "EMPTY";
    throw error;
  }
  const text = decodeVCardBytes(await file.arrayBuffer());
  const contacts = parseVCardText(text);
  if (!contacts.length) {
    const error = new Error("No contacts found in vCard");
    error.code = "EMPTY";
    throw error;
  }
  return contacts;
}
