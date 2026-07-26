/**
 * Client-side mirror of backend/src/utils/loginCredentials.js
 * Keep in sync — WhatsApp paste often appends trailing \n/\r.
 */

const INVISIBLE_CHARS_RE =
  /[\u200B-\u200D\u2060\uFEFF\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

const LINE_BREAKS_RE = /[\r\n\u0085\u2028\u2029]+/g;

const ALL_WHITESPACE_RE = /\s+/g;

export function normalizeLoginUsername(value) {
  return String(value ?? "")
    .replace(INVISIBLE_CHARS_RE, "")
    .replace(ALL_WHITESPACE_RE, "")
    .trim();
}

export function normalizeLoginPassword(value) {
  return String(value ?? "")
    .replace(INVISIBLE_CHARS_RE, "")
    .replace(LINE_BREAKS_RE, "")
    .replace(ALL_WHITESPACE_RE, "")
    .trim();
}

/** @deprecated prefer normalizeLoginUsername / normalizeLoginPassword */
export function normalizeCredential(value) {
  return normalizeLoginPassword(value);
}
