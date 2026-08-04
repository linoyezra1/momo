const AGENT_TOKEN_KEY = "momo_agent_token";
const AGENT_PROFILE_KEY = "momo_agent_profile";

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
    sessionStorage.removeItem(AGENT_PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function setAgentProfile(agent) {
  try {
    if (!agent) {
      sessionStorage.removeItem(AGENT_PROFILE_KEY);
      return;
    }
    sessionStorage.setItem(AGENT_PROFILE_KEY, JSON.stringify(agent));
  } catch {
    // ignore
  }
}

export function getAgentProfile() {
  try {
    const raw = sessionStorage.getItem(AGENT_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
