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
 * @property {boolean} isInvalidPhone
 * @property {string} [rawPhone]
 */

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
 * @param {string[]} existingPhones
 * @returns {ReviewContactRow[]}
 */
export function mapDeviceContactsToReviewRows(contacts, existingPhones = []) {
  const existingSet = new Set(
    (existingPhones || []).map((phone) => normalizeIsraeliPhone(phone)).filter(Boolean)
  );
  const seenInBatch = new Set();
  const rows = [];

  (contacts || []).forEach((contact, index) => {
    const fullName = pickContactName(contact) || `איש קשר ${index + 1}`;
    const rawPhone = pickContactPhone(contact);
    const phone = normalizeIsraeliPhone(rawPhone);
    const isInvalidPhone = !phone || !isLikelyValidIsraeliMobile(phone);
    const isDuplicate =
      Boolean(phone) && (existingSet.has(phone) || seenInBatch.has(phone));

    if (phone) seenInBatch.add(phone);

    rows.push({
      id: `contact-${index}-${phone || "none"}-${Math.random().toString(36).slice(2, 7)}`,
      fullName,
      phone,
      rawPhone,
      selected: Boolean(phone) && !isDuplicate && !isInvalidPhone,
      isDuplicate,
      isInvalidPhone
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
