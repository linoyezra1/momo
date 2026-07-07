const ADMIN_TOKEN_KEY = "momo_admin_token";

export function getAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAdminToken(token) {
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function clearAdminToken() {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

export function isAdminAuthenticated() {
  return Boolean(getAdminToken());
}
