function stripTrailingSlash(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function baseUrlFromRequest(req) {
  if (!req) {
    return "";
  }

  const host = req.get("x-forwarded-host") || req.get("host") || "";
  if (!host || host.includes("localhost") || host.includes("127.0.0.1")) {
    return "";
  }

  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  return stripTrailingSlash(`${protocol}://${host}`);
}

export function getClientBaseUrl(req) {
  const configured = stripTrailingSlash(process.env.CLIENT_URL);
  if (configured) {
    return configured;
  }

  const fromRequest = baseUrlFromRequest(req);
  if (fromRequest) {
    return fromRequest;
  }

  return "http://localhost:5173";
}

export function buildClientUrl(path, req) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getClientBaseUrl(req)}${normalizedPath}`;
}
