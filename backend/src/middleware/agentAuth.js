import crypto from "crypto";
import { findAgentByCredentials, listAgentAccounts } from "../utils/agentAccounts.js";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function getAgentSecret() {
  return (
    process.env.AGENT_SECRET ||
    process.env.AGENT_PASSWORD ||
    process.env.AGENT_USERNAME ||
    "momo-agent-secret"
  );
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function signAgentToken(agent = {}) {
  const secret = getAgentSecret();
  if (!secret) {
    throw new Error("AGENT_SECRET is not configured");
  }

  const payload = {
    role: "agent",
    agentId: String(agent.id || "").trim(),
    username: String(agent.username || "").trim(),
    displayName: String(agent.displayName || agent.username || "").trim(),
    exp: Date.now() + TOKEN_TTL_MS
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyAgentToken(token) {
  const secret = getAgentSecret();
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
    if (payload.role !== "agent") return null;
    if (!payload.agentId) return null;
    return {
      role: "agent",
      agentId: String(payload.agentId),
      username: String(payload.username || ""),
      displayName: String(payload.displayName || payload.username || ""),
      exp: payload.exp
    };
  } catch {
    return null;
  }
}

export function requireAgent(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const payload = verifyAgentToken(token);
  if (!payload) {
    return res.status(401).json({ message: "נדרשת התחברות נציג" });
  }
  req.agent = {
    id: payload.agentId,
    username: payload.username,
    displayName: payload.displayName
  };
  return next();
}

export function validateAgentCredentials(username, password) {
  const agents = listAgentAccounts();
  if (!agents.length) {
    return { ok: false, reason: "not_configured" };
  }

  const needleUser = String(username || "").trim();
  const needlePass = String(password ?? "");

  for (const agent of agents) {
    if (safeEqual(needleUser, agent.username) && safeEqual(needlePass, agent.password)) {
      return {
        ok: true,
        agent: {
          id: agent.id,
          username: agent.username,
          displayName: agent.displayName
        }
      };
    }
  }

  // Keep timing roughly similar when invalid
  findAgentByCredentials(username, password);
  return { ok: false, reason: "invalid" };
}
