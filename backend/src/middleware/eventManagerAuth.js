/**
 * Event Manager auth is ENVIRONMENT-ONLY (EVENT_MANAGER_USERNAME / PASSWORD / SECRET).
 * There is no API to create EVENT_MANAGER staff accounts from the app.
 * Only SYSTEM_ADMIN / ops may provision those credentials on the server.
 */
import crypto from "crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function getEventManagerSecret() {
  return (
    process.env.EVENT_MANAGER_SECRET ||
    process.env.EVENT_MANAGER_PASSWORD ||
    process.env.EVENT_MANAGER_USERNAME ||
    ""
  );
}

export function signEventManagerToken() {
  const secret = getEventManagerSecret();
  if (!secret) {
    throw new Error("EVENT_MANAGER_SECRET is not configured");
  }

  const payload = {
    role: "eventManager",
    exp: Date.now() + TOKEN_TTL_MS
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyEventManagerToken(token) {
  const secret = getEventManagerSecret();
  if (!secret || !token) return null;

  const [body, signature] = String(token).split(".");
  if (!body || !signature) return null;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || Number(payload.exp) < Date.now()) return null;
    if (payload.role !== "eventManager") return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireEventManager(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!verifyEventManagerToken(token)) {
    return res.status(401).json({ message: "נדרשת התחברות מנהל אירועים" });
  }
  return next();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function validateEventManagerCredentials(username, password) {
  const expectedUsername = String(process.env.EVENT_MANAGER_USERNAME || "").trim();
  const expectedPassword = String(process.env.EVENT_MANAGER_PASSWORD || "");

  if (!expectedUsername || !expectedPassword) {
    return { ok: false, reason: "not_configured" };
  }

  if (!safeEqual(username, expectedUsername) || !safeEqual(password, expectedPassword)) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}
