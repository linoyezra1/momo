/**
 * Event Manager staff auth: Mongo accounts (admin-managed) + optional env bootstrap.
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import EventManager from "../models/EventManager.js";
import {
  normalizeLoginPassword,
  normalizeLoginUsername
} from "../utils/loginCredentials.js";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function getEventManagerSecret() {
  return (
    process.env.EVENT_MANAGER_SECRET ||
    process.env.EVENT_MANAGER_PASSWORD ||
    process.env.EVENT_MANAGER_USERNAME ||
    "momo-event-manager"
  );
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function signEventManagerToken({
  eventManagerId = "",
  username = "",
  displayName = "",
  source = "env"
} = {}) {
  const secret = getEventManagerSecret();
  if (!secret) {
    throw new Error("EVENT_MANAGER_SECRET is not configured");
  }

  const payload = {
    role: "eventManager",
    eventManagerId: String(eventManagerId || "").trim(),
    username: String(username || "").trim(),
    displayName: String(displayName || username || "").trim(),
    source: source === "db" ? "db" : "env",
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
  const payload = verifyEventManagerToken(token);
  if (!payload) {
    return res.status(401).json({ message: "נדרשת התחברות מנהל אירועים" });
  }
  req.eventManager = payload;
  return next();
}

function validateEnvCredentials(username, password) {
  const expectedUsername = String(process.env.EVENT_MANAGER_USERNAME || "").trim();
  const expectedPassword = String(process.env.EVENT_MANAGER_PASSWORD || "");

  if (!expectedUsername || !expectedPassword) {
    return { ok: false, reason: "not_configured" };
  }

  if (!safeEqual(username, expectedUsername) || !safeEqual(password, expectedPassword)) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    source: "env",
    eventManagerId: "",
    username: expectedUsername,
    displayName:
      String(process.env.EVENT_MANAGER_DISPLAY_NAME || expectedUsername).trim() || expectedUsername
  };
}

/**
 * Prefer DB account; fall back to EVENT_MANAGER_USERNAME / PASSWORD env bootstrap.
 */
export async function validateEventManagerCredentials(rawUsername, rawPassword) {
  const username = normalizeLoginUsername(rawUsername);
  const password = normalizeLoginPassword(rawPassword);
  if (!username || !password) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const account = await EventManager.findOne({ username }).exec();
    if (account) {
      if (account.active === false) {
        return { ok: false, reason: "inactive" };
      }
      const match = await bcrypt.compare(password, account.passwordHash);
      if (!match) {
        return { ok: false, reason: "invalid" };
      }
      return {
        ok: true,
        source: "db",
        eventManagerId: String(account._id),
        username: account.username,
        displayName: String(account.displayName || account.username).trim() || account.username
      };
    }
  } catch (error) {
    console.error("[EventManager] DB credential lookup failed:", error?.message || error);
  }

  return validateEnvCredentials(username, password);
}

export function serializeEventManagerAccount(doc, { includePassword = false } = {}) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(plain._id),
    username: plain.username,
    displayName: plain.displayName || plain.username,
    active: plain.active !== false,
    loginPassword: includePassword ? plain.loginPassword || "" : undefined,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}
