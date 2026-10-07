import crypto from "crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function getAdminSecret() {
  return (
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_USERNAME ||
    ""
  );
}

export function signAdminToken() {
  const secret = getAdminSecret();
  if (!secret) {
    throw new Error("ADMIN_SECRET is not configured");
  }

  const payload = {
    role: "admin",
    exp: Date.now() + TOKEN_TTL_MS
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function signImpersonationToken({ targetUserId, originalAdminId = "admin", clientName = "" }) {
  const secret = getAdminSecret();
  if (!secret) {
    throw new Error("ADMIN_SECRET is not configured");
  }

  const payload = {
    role: "impersonation",
    userId: String(targetUserId),
    isImpersonated: true,
    originalAdminId: String(originalAdminId || "admin"),
    clientName: String(clientName || "").slice(0, 120),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyImpersonationToken(token) {
  const secret = getAdminSecret();
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
    if (payload.role !== "impersonation" || payload.isImpersonated !== true || !payload.userId) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminToken(token) {
  const secret = getAdminSecret();
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
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

export function requireAdmin(req, res, next) {
  const token = extractBearerToken(req);
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ message: "נדרשת התחברות מנהל" });
  }
  return next();
}

/**
 * Admin Bearer OR impersonation Bearer for a specific event (Scheduled Broadcast).
 * For cancel-by-id, event ownership is verified in the handler via req.impersonation.
 */
export function requireAdminOrEventImpersonation(req, res, next) {
  const token = extractBearerToken(req);
  const admin = verifyAdminToken(token);
  if (admin) {
    req.authMode = "admin";
    req.createdByAdminId = "admin";
    req.impersonation = null;
    return next();
  }

  const impersonation = verifyImpersonationToken(token);
  if (!impersonation) {
    return res.status(401).json({ message: "נדרשת התחברות מנהל או צפייה במצב אדמין" });
  }

  const eventId = String(
    req.params.eventId || req.body?.eventId || req.query?.eventId || ""
  ).trim();

  // Cancel route has scheduleId only — ownership checked in handler.
  if (!eventId && req.params.scheduleId) {
    req.authMode = "impersonation";
    req.createdByAdminId = String(impersonation.originalAdminId || "admin");
    req.impersonation = impersonation;
    return next();
  }

  if (!eventId || String(impersonation.userId) !== eventId) {
    return res.status(403).json({ message: "אין הרשאה לתזמן שליחה לאירוע זה" });
  }

  req.authMode = "impersonation";
  req.createdByAdminId = String(impersonation.originalAdminId || "admin");
  req.impersonation = impersonation;
  return next();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function validateAdminCredentials(username, password) {
  const expectedUsername = String(process.env.ADMIN_USERNAME || "").trim();
  const expectedPassword = String(process.env.ADMIN_PASSWORD || "");

  if (!expectedUsername || !expectedPassword) {
    return { ok: false, reason: "not_configured" };
  }

  if (!safeEqual(username, expectedUsername) || !safeEqual(password, expectedPassword)) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}
