/**
 * Multi-agent accounts from env.
 *
 * Preferred:
 *   AGENTS_JSON=[{"id":"agent1","username":"agent1","password":"...","displayName":"סוכן 1"}]
 *
 * Legacy fallback (single agent):
 *   AGENT_USERNAME + AGENT_PASSWORD → id "default"
 */

function parseMainAgentIds() {
  const fromEnv = String(process.env.MAIN_AGENT_IDS || process.env.AGENT_MAIN_AGENT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return new Set(fromEnv);
}

const MAIN_AGENT_IDS = parseMainAgentIds();

function resolveIsMainAgent(raw, id) {
  if (raw?.isMainAgent === true || raw?.mainAgent === true || raw?.scope === "all") {
    return true;
  }
  return MAIN_AGENT_IDS.has(String(id || "").trim());
}

function normalizeAgentEntry(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;
  const username = String(raw.username || "").trim();
  const password = String(raw.password ?? "");
  if (!username || !password) return null;
  const id = String(raw.id || username || `agent${index + 1}`).trim() || `agent${index + 1}`;
  const displayName = String(raw.displayName || raw.name || username).trim() || username;
  const isMainAgent = resolveIsMainAgent(raw, id);
  return { id, username, password, displayName, isMainAgent };
}

export function listAgentAccounts() {
  const rawJson = String(process.env.AGENTS_JSON || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        const agents = parsed.map(normalizeAgentEntry).filter(Boolean);
        if (agents.length) return agents;
      }
    } catch {
      // fall through to legacy
    }
  }

  const username = String(process.env.AGENT_USERNAME || "").trim();
  const password = String(process.env.AGENT_PASSWORD || "");
  if (!username || !password) return [];

  return [
    {
      id: "default",
      username,
      password,
      displayName: String(process.env.AGENT_DISPLAY_NAME || username).trim() || username,
      isMainAgent: MAIN_AGENT_IDS.has("default")
    }
  ];
}

export function getAgentAccountById(agentId) {
  const id = String(agentId || "").trim();
  if (!id) return null;
  return listAgentAccounts().find((agent) => agent.id === id) || null;
}

export function isMainAgentAccount(agentId) {
  const account = getAgentAccountById(agentId);
  return account?.isMainAgent === true;
}

export function findAgentByCredentials(username, password) {
  const agents = listAgentAccounts();
  if (!agents.length) {
    return { ok: false, reason: "not_configured" };
  }

  const needleUser = String(username || "").trim();
  const needlePass = String(password ?? "");
  const match = agents.find(
    (agent) => agent.username === needleUser && agent.password === needlePass
  );
  if (!match) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    agent: {
      id: match.id,
      username: match.username,
      displayName: match.displayName,
      isMainAgent: match.isMainAgent === true
    }
  };
}

export function getAgentDisplayMap() {
  const map = {};
  for (const agent of listAgentAccounts()) {
    map[agent.id] = agent.displayName || agent.username;
  }
  return map;
}
