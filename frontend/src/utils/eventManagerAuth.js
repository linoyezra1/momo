const EVENT_MANAGER_TOKEN_KEY = "momo_event_manager_token";

export function getEventManagerToken() {
  try {
    return sessionStorage.getItem(EVENT_MANAGER_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setEventManagerToken(token) {
  try {
    sessionStorage.setItem(EVENT_MANAGER_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearEventManagerToken() {
  try {
    sessionStorage.removeItem(EVENT_MANAGER_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function isEventManagerAuthenticated() {
  return Boolean(getEventManagerToken());
}
