const IMPERSONATION_KEY = "momo_impersonation";

function decodeBase64Url(value) {
  const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

export function decodeImpersonationToken(token) {
  const body = String(token || "").split(".")[0];
  if (!body) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(body));
    if (payload?.isImpersonated !== true || !payload.userId) return null;
    if (payload.exp && Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setImpersonationSession({ token, userId, clientName }) {
  const payload = decodeImpersonationToken(token);
  if (!payload || String(payload.userId) !== String(userId)) return null;
  const session = {
    token,
    userId: String(userId),
    clientName: String(clientName || payload.clientName || "").trim() || "לקוח"
  };
  try {
    sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
  return session;
}

export function getImpersonationSession() {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const payload = decodeImpersonationToken(session?.token);
    if (!payload || String(payload.userId) !== String(session.userId)) {
      sessionStorage.removeItem(IMPERSONATION_KEY);
      return null;
    }
    return {
      token: session.token,
      userId: String(session.userId),
      clientName: session.clientName || payload.clientName || "לקוח"
    };
  } catch {
    return null;
  }
}

export function clearImpersonationSession() {
  try {
    sessionStorage.removeItem(IMPERSONATION_KEY);
  } catch {
    // ignore storage errors
  }
}

export function captureImpersonationFromHash() {
  if (typeof window === "undefined") return null;
  const hash = String(window.location.hash || "").replace(/^#/, "");
  if (!hash.includes("impersonate=")) return null;
  const params = new URLSearchParams(hash);
  const token = params.get("impersonate") || "";
  const payload = decodeImpersonationToken(token);
  if (!payload) return null;
  const session = setImpersonationSession({
    token,
    userId: payload.userId,
    clientName: params.get("name") || payload.clientName || ""
  });
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", cleanUrl);
  return session;
}
