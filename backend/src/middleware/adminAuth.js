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

export function requireAdmin(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ message: "נדרשת התחברות מנהל" });
  }
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
