const FIELD_LABEL_PREFIXES = [
  "transportation text",
  "dress code text",
  "accommodation text",
  "accommodation title",
  "accommodation subtitle",
  "accommodation body",
  "accommodation details",
  "wedding registry link",
  "registry link",
  "rsvp deadline text",
  "google maps link",
  "venue description",
  "venue address",
  "venue name",
  "countdown date & time",
  "countdown date",
  "wedding date & time",
  "wedding date",
  "date (formatted)",
  "celebration text",
  "intro text",
  "host names",
  "dress code",
  "transportation",
  "accommodation",
  "description",
  "address"
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripFieldLabelPrefixes(text) {
  let value = String(text || "").trim();
  if (!value) {
    return "";
  }

  for (const label of FIELD_LABEL_PREFIXES) {
    const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:?\\s*`, "i");
    if (pattern.test(value)) {
      value = value.replace(pattern, "").trim();
      break;
    }
  }

  return value;
}

export function stripDecorativeQuotes(text) {
  let value = String(text || "").trim();
  if (!value) {
    return "";
  }

  const quotePairs = [
    ["'", "'"],
    ['"', '"'],
    ["\u2018", "\u2019"],
    ["\u201C", "\u201D"]
  ];

  for (const [open, close] of quotePairs) {
    if (value.startsWith(open) && value.endsWith(close)) {
      value = value.slice(open.length, value.length - close.length).trim();
      break;
    }
  }

  return value
    .replace(/['\u2018]([^'\u2019]+)['\u2019]/g, "$1")
    .replace(/"([^"]+)"/g, "$1")
    .trim();
}

export function formatUsInvitationTime(raw) {
  let value = String(raw || "").trim();
  if (!value) {
    return "";
  }

  value = value.replace(/^at\s+/i, "");
  value = value.replace(/\b0(\d)(:\d{2}\s*(?:AM|PM))\b/gi, (_, hour, rest) => `${hour}${rest}`);
  value = value.replace(/\b(\d{1,2}:\d{2})\s*(AM|PM)\b/gi, (_, clock, meridiem) => `${clock} ${meridiem.toUpperCase()}`);

  return `at ${value}`;
}

export function formatUsTimelineTime(raw) {
  const formatted = formatUsInvitationTime(raw);
  return formatted.replace(/^at\s+/i, "").trim();
}

export function sanitizeInvitationDetailText(text) {
  return stripDecorativeQuotes(stripFieldLabelPrefixes(text));
}
