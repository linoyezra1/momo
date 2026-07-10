const AGENT_TOKEN_KEY = "momo_agent_token";

export function getAgentToken() {
  try {
    return sessionStorage.getItem(AGENT_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAgentToken(token) {
  try {
    sessionStorage.setItem(AGENT_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAgentToken() {
  try {
    sessionStorage.removeItem(AGENT_TOKEN_KEY);
  } catch {
    // ignore
  }
}
