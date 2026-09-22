/**
 * Parse WhatsApp / Twilio inbound vCard media into { fullName, phone } contacts.
 */
import vCard from "vcf";

const VCARD_MIME_TYPES = new Set([
  "text/vcard",
  "text/x-vcard",
  "text/directory",
  "application/vcard",
  "application/x-vcard"
]);

export function isVcardMediaContentType(contentType) {
  const raw = String(contentType || "").trim().toLowerCase();
  if (!raw) return false;
  const base = raw.split(";")[0].trim();
  if (VCARD_MIME_TYPES.has(base)) return true;
  return base.includes("vcard");
}

/**
 * Extract MediaUrl/MediaContentType pairs from a Twilio inbound webhook body.
 */
export function extractTwilioInboundMedia(body = {}) {
  const numMedia = Math.max(0, Number(body.NumMedia) || 0);
  const items = [];
  for (let i = 0; i < Math.max(numMedia, 10); i += 1) {
    const url = String(body[`MediaUrl${i}`] || "").trim();
    const contentType = String(body[`MediaContentType${i}`] || "").trim();
    if (!url && !contentType) {
      if (i >= numMedia) break;
      continue;
    }
    if (!url) continue;
    items.push({ index: i, url, contentType });
    if (i + 1 >= numMedia && !body[`MediaUrl${i + 1}`]) break;
  }
  return items;
}

export function extractTwilioVcardMedia(body = {}) {
  return extractTwilioInboundMedia(body).filter((item) =>
    isVcardMediaContentType(item.contentType)
  );
}

function propertyValue(prop) {
  if (prop == null) return "";
  if (Array.isArray(prop)) {
    for (const item of prop) {
      const value = propertyValue(item);
      if (value) return value;
    }
    return "";
  }
  if (typeof prop.valueOf === "function") {
    const valued = prop.valueOf();
    if (valued != null && valued !== prop) return String(valued).trim();
  }
  if (typeof prop === "string" || typeof prop === "number") {
    return String(prop).trim();
  }
  return "";
}

function allPropertyValues(prop) {
  if (prop == null) return [];
  if (Array.isArray(prop)) {
    return prop.map((item) => propertyValue(item)).filter(Boolean);
  }
  const single = propertyValue(prop);
  return single ? [single] : [];
}

function nameFromN(nValue) {
  const parts = String(nValue || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  // N is Family;Given;Additional;Prefix;Suffix
  if (parts.length === 1) return parts[0];
  const [family, given, ...rest] = parts;
  return [given, family, ...rest].filter(Boolean).join(" ").trim();
}

function cleanTelValue(raw) {
  return String(raw || "")
    .replace(/^tel:/i, "")
    .replace(/[^\d+]/g, "")
    .trim();
}

function preferTelValues(card) {
  const telProp = card.get("tel");
  if (!telProp) return [];

  const list = Array.isArray(telProp) ? telProp : [telProp];
  const scored = list
    .map((prop) => {
      const value = cleanTelValue(propertyValue(prop));
      if (!value) return null;
      const typeRaw = prop?.type;
      const types = Array.isArray(typeRaw)
        ? typeRaw.map((t) => String(t).toLowerCase())
        : String(typeRaw || "")
            .toLowerCase()
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
      let score = 0;
      if (types.includes("cell") || types.includes("mobile")) score += 3;
      if (types.includes("pref") || types.includes("voice")) score += 1;
      if (value.startsWith("+972") || value.startsWith("972") || value.startsWith("05")) {
        score += 2;
      }
      return { value, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored.map((row) => row.value);
}

function contactFromCard(card) {
  const fullName =
    propertyValue(card.get("fn")) ||
    nameFromN(propertyValue(card.get("n"))) ||
    "";
  const phones = preferTelValues(card);
  const phone = phones[0] || "";
  if (!fullName && !phone) return null;
  return { fullName: fullName || "איש קשר", phone };
}

/**
 * Normalize CRLF so `vcf` can read VERSION correctly, then parse all cards.
 */
export function parseVcardContacts(rawText) {
  const text = String(rawText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!text) return [];

  const chunks = text
    .split(/END:VCARD/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /BEGIN:VCARD/i.test(chunk))
    .map((chunk) => `${chunk}\nEND:VCARD`.replace(/\n/g, "\r\n"));

  const contacts = [];
  for (const chunk of chunks.length ? chunks : [text.replace(/\n/g, "\r\n")]) {
    try {
      const card = new vCard().parse(chunk);
      const contact = contactFromCard(card);
      if (contact) contacts.push(contact);
    } catch (error) {
      console.warn("[vCard] parse failed:", error?.message || error);
    }
  }

  // Deduplicate identical phone+name pairs within one payload
  const seen = new Set();
  return contacts.filter((contact) => {
    const key = `${contact.fullName}::${contact.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectPropertyDebug(card) {
  return {
    fn: allPropertyValues(card.get("fn")),
    tel: allPropertyValues(card.get("tel")),
    n: allPropertyValues(card.get("n"))
  };
}
