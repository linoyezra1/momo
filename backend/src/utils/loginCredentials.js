/**
 * Normalize couple login credentials for WhatsApp paste / autofill safety.
 * WhatsApp paste often appends trailing \n/\r or invisible bidi marks.
 */

const INVISIBLE_CHARS_RE =
  /[\u200B-\u200D\u2060\uFEFF\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** CR / LF / NEL / line & paragraph separators */
const LINE_BREAKS_RE = /[\r\n\u0085\u2028\u2029]+/g;

/** Any whitespace (spaces, tabs, newlines, etc.) */
const ALL_WHITESPACE_RE = /\s+/g;

/**
 * Username (often a phone): strip invisible chars + ALL whitespace/newlines.
 */
export function normalizeLoginUsername(value) {
  return String(value ?? "")
    .replace(INVISIBLE_CHARS_RE, "")
    .replace(ALL_WHITESPACE_RE, "")
    .trim();
}

/**
 * Password: strip invisible chars, line breaks, and ALL whitespace.
 * Couple credentials are typically phone digits — spaces/newlines are never intentional.
 */
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

export function normalizeLoginCredentials({ username, password } = {}) {
  return {
    username: normalizeLoginUsername(username),
    password: normalizeLoginPassword(password)
  };
}

/**
 * Hash + store password fields from the SAME cleaned string.
 * Use this for every create/update path — never hash raw req.body.password.
 * @returns {{ plainPassword: string, passwordHash: string }}
 */
export async function buildCouplePasswordFields(rawPassword, bcrypt) {
  const plainPassword = normalizeLoginPassword(rawPassword);
  if (!plainPassword) {
    throw new Error("סיסמה אינה תקינה");
  }
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  return { plainPassword, passwordHash };
}

/**
 * Apply cleaned password to a mongoose user document (both fields in sync).
 */
export async function applyCouplePassword(user, rawPassword, bcrypt) {
  const { plainPassword, passwordHash } = await buildCouplePasswordFields(rawPassword, bcrypt);
  user.passwordHash = passwordHash;
  user.loginPassword = plainPassword;
  return plainPassword;
}
