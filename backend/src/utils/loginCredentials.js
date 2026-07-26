/**
 * Normalize couple login credentials for paste/autofill safety.
 * Strips whitespace and common invisible Unicode (bidi marks, zero-width chars).
 * Does NOT change digit formatting (phone usernames stay exact after cleanup).
 */

const INVISIBLE_CHARS_RE =
  /[\u200B-\u200D\u2060\uFEFF\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export function normalizeCredential(value) {
  return String(value ?? "")
    .replace(INVISIBLE_CHARS_RE, "")
    .trim();
}

export function normalizeLoginCredentials({ username, password } = {}) {
  return {
    username: normalizeCredential(username),
    password: normalizeCredential(password)
  };
}
