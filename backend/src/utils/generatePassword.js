import crypto from "crypto";

const CHARSET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";

export function generateSecurePassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += CHARSET[bytes[i] % CHARSET.length];
  }
  return password;
}
