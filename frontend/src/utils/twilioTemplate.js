import { buildWhatsAppTemplateDefaults } from "./whatsapp.js";

/** Twilio/WhatsApp: no newlines, tabs, emojis, or 5+ consecutive spaces in variable values. */
export function sanitizeTemplateVariable(value, fallback = "") {
  let text = String(value ?? "")
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/ {2,}/g, " ")
    .trim();

  if (!text) {
    return String(fallback || "").trim();
  }
  return text;
}

export function toSingleLineTemplateValue(value) {
  return sanitizeTemplateVariable(String(value ?? "").replace(/\n/g, ", "));
}

export function buildDefaultTemplateVars(event, eventId, origin) {
  const defaults = buildWhatsAppTemplateDefaults({ event, eventId, origin });
  return {
    "2": toSingleLineTemplateValue(defaults.intro),
    "3": toSingleLineTemplateValue(defaults.eventDetails),
    "4": defaults.rsvpLink,
    "5": toSingleLineTemplateValue(defaults.signature)
  };
}

export function renderWhatsAppTemplatePreview({ guestName, vars }) {
  const name = sanitizeTemplateVariable(guestName, "אורח/ת יקר/ה");
  const opening = vars["2"] || "";
  const eventDetails = vars["3"] || "";
  const rsvpLink = vars["4"] || "";
  const signature = vars["5"] || "";

  const lines = [
    "✨ 🥂 ✨",
    `שלום ${name},`,
    "",
    opening,
    "",
    `האירוע יתקיים ב${eventDetails}`,
    "",
    "נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:",
    rsvpLink
  ];

  if (signature) {
    lines.push("", signature);
  }

  lines.push("", "✨ 🎉 ✨");
  return lines.join("\n");
}

export function validateTemplateVars(vars) {
  const errors = {};
  if (!sanitizeTemplateVariable(vars["2"])) {
    errors["2"] = "יש למלא פתיחת הודעה";
  }
  if (!sanitizeTemplateVariable(vars["3"])) {
    errors["3"] = "יש למלא פרטי אירוע";
  }
  if (!vars["4"]?.trim()) {
    errors["4"] = "קישור RSVP חסר";
  }
  return errors;
}

export const TEMPLATE_FIELD_META = [
  {
    key: "2",
    label: "משתנה {{2}} — פתיחת ההודעה",
    placeholder: "משפחה וחברים יקרים, הנכם מוזמנים לחתונה שלנו",
    required: true,
    hint: "שורה אחת בלבד, ללא אימוג'ים"
  },
  {
    key: "3",
    label: "משתנה {{3}} — פרטי האירוע (תאריך ומיקום)",
    placeholder: "יום חמישי 18.06.2026, בעדיה אירועים יבנה",
    required: true,
    hint: "שורה אחת בלבד, ללא אימוג'ים"
  },
  {
    key: "4",
    label: "משתנה {{4}} — קישור RSVP",
    placeholder: "",
    required: true,
    readOnly: true,
    hint: "נוצר אוטומטית מהמערכת"
  },
  {
    key: "5",
    label: "משתנה {{5}} — חתימה (אופציונלי)",
    placeholder: "אוהבים, יצחק ולינוי",
    required: false,
    hint: "אופציונלי — שורה אחת בלבד"
  }
];
