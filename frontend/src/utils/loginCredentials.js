/**
 * Client-side mirror of backend credential cleanup (paste / autofill).
 * Keep in sync with backend/src/utils/loginCredentials.js
 */

const INVISIBLE_CHARS_RE =
  /[\u200B-\u200D\u2060\uFEFF\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export function normalizeCredential(value) {
  return String(value ?? "")
    .replace(INVISIBLE_CHARS_RE, "")
    .trim();
}
