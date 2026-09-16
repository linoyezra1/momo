/**
 * WhatsApp invite template registry (Twilio Content SIDs + variable maps).
 * Admin selects one mode per event/package via `whatsappInviteTemplate`.
 */

export const WHATSAPP_INVITE_TEMPLATE_IDS = [
  "standard",
  "buttons_qr",
  "card_direct_rsvp_buttons",
  "card_buttons",
  "card_view_invite_button"
];

/** @typedef {"standard"|"buttons_qr"|"card_direct_rsvp_buttons"|"card_buttons"|"card_view_invite_button"} WhatsAppInviteTemplateId */

export const WHATSAPP_INVITE_TEMPLATE_OPTIONS = [
  {
    id: "standard",
    label: "מלל רגיל (ללא כרטיס)",
    badge: null,
    adminHint: "תבנית טקסט מאושרת עם קישור להזמנה הדיגיטלית."
  },
  {
    id: "buttons_qr",
    label: "כפתורים מהירים (ללא תמונה)",
    badge: "מלל + 3 כפתורים",
    adminHint: "תבנית מלל + כפתורי RSVP (ללא תמונת כיסוי)."
  },
  {
    id: "card_direct_rsvp_buttons",
    label: "כרטיס מלא",
    badge: "כרטיס מלא (קישור + 3 כפתורים)",
    adminHint: "תמונה + מלל עם קישור להזמנה דיגיטלית + 3 כפתורי RSVP."
  },
  {
    id: "card_buttons",
    label: "כרטיס מהיר",
    badge: "כרטיס מהיר (3 כפתורים בלבד)",
    adminHint: "תמונה + מלל קצר ללא קישור חיצוני + 3 כפתורי RSVP ישירים."
  },
  {
    id: "card_view_invite_button",
    label: "כרטיס הפניה",
    badge: "כרטיס הפניה (כפתור קישור יחיד)",
    adminHint: "תמונה + מלל + כפתור URL יחיד לעמוד ההזמנה הדיגיטלית."
  }
];

const STANDARD_INVITE_CONTENT_SID_DEFAULT = "HXbdfde344006c1b595fe91e738f9972c5";
const BUTTONS_QR_CONTENT_SID_DEFAULT = "HX0ed4e1d2438f2e69bfd54610a127984d";

/** Full card with link + 3 QR: card_direct_rsvp_buttons */
export const CARD_DIRECT_RSVP_BUTTONS_CONTENT_SID_DEFAULT =
  "HX1805fa82d187715cf26afe9e6f18c9e9";
/** Card image + 3 QR only (no external link): card_buttons */
export const CARD_BUTTONS_CONTENT_SID_DEFAULT = "HX2bc50f016c421b1ad7f331307cf19c5d";
/** Card image + single URL CTA: card_view_invite_button */
export const CARD_VIEW_INVITE_BUTTON_CONTENT_SID_DEFAULT =
  "HX7b6233fe6eeb1da0abb624d7a7a6d05c";

/**
 * Semantic fields → Twilio Content variable keys per template.
 * mediaPath is always the Cloudinary path after the cloud name (for Media headers).
 */
const TEMPLATE_FIELD_KEYS = {
  standard: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    rsvpLink: "4",
    closingSignOff: "5"
  },
  buttons_qr: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    rsvpLink: "4",
    closingSignOff: "5"
  },
  /** Same shape as approved full card: body {{1}}–{{5}}, media {{6}} */
  card_direct_rsvp_buttons: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    rsvpLink: "4",
    closingSignOff: "5",
    mediaPath: "6"
  },
  /**
   * No external link in body — do not send rsvpLink.
   * Keys: {{1}} name · {{2}} opening · {{3}} details · {{4}} closing · {{5}} media
   */
  card_buttons: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    closingSignOff: "4",
    mediaPath: "5"
  },
  /**
   * Single URL button uses {{4}} as the invite link; media {{6}}.
   */
  card_view_invite_button: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    rsvpLink: "4",
    closingSignOff: "5",
    mediaPath: "6"
  }
};

function readEnvSid(...names) {
  for (const name of names) {
    const raw = String(process.env[name] || "").trim();
    if (raw.startsWith("HX")) return { contentSid: raw, sidSource: `env:${name}` };
  }
  return null;
}

export function isWhatsAppInviteTemplateId(value) {
  return WHATSAPP_INVITE_TEMPLATE_IDS.includes(String(value || "").trim());
}

/**
 * Resolve template id from event (+ legacy booleans for migration).
 * Priority: explicit enum → card flag → buttons flag → standard.
 */
export function resolveWhatsAppInviteTemplateId(event = {}) {
  const explicit = String(event?.whatsappInviteTemplate || "").trim();
  if (isWhatsAppInviteTemplateId(explicit) && explicit !== "standard") {
    return /** @type {WhatsAppInviteTemplateId} */ (explicit);
  }
  if (explicit === "standard") return "standard";

  if (event?.isPremiumWhatsappCardEnabled === true) {
    return "card_direct_rsvp_buttons";
  }
  if (event?.isPremiumWhatsappButtonsEnabled === true) {
    return "buttons_qr";
  }
  return "standard";
}

export function isCardInviteTemplate(templateId) {
  return (
    templateId === "card_direct_rsvp_buttons" ||
    templateId === "card_buttons" ||
    templateId === "card_view_invite_button"
  );
}

export function isInteractiveInviteTemplate(templateId) {
  return templateId === "buttons_qr" || isCardInviteTemplate(templateId);
}

export function getTemplateFieldKeyMap(templateId) {
  return TEMPLATE_FIELD_KEYS[templateId] || TEMPLATE_FIELD_KEYS.standard;
}

export function getTemplateVariableKeys(templateId) {
  const map = getTemplateFieldKeyMap(templateId);
  return [...new Set(Object.values(map))].sort((a, b) => Number(a) - Number(b));
}

export function templateRequiresCoverMedia(templateId) {
  return isCardInviteTemplate(templateId);
}

export function templateIncludesRsvpLink(templateId) {
  const map = getTemplateFieldKeyMap(templateId);
  return Boolean(map.rsvpLink);
}

/**
 * Resolve Content SID + metadata for bulk/RSVP send (non-conference).
 */
export function resolveInviteTemplateRouting(event = {}) {
  const templateId = resolveWhatsAppInviteTemplateId(event);
  const templateKeys = getTemplateVariableKeys(templateId);
  const requiresCoverMedia = templateRequiresCoverMedia(templateId);
  const includesRsvpLink = templateIncludesRsvpLink(templateId);

  if (templateId === "buttons_qr") {
    const fromEnv = readEnvSid(
      "TWILIO_COPY_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID",
      "TWILIO_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID"
    );
    return {
      templateId,
      contentSid: fromEnv?.contentSid || BUTTONS_QR_CONTENT_SID_DEFAULT,
      sidSource: fromEnv?.sidSource || "default:BUTTONS_QR_CONTENT_SID_DEFAULT",
      templateKeys,
      requiresCoverMedia,
      includesRsvpLink,
      premiumButtonsEnabled: true,
      premiumCardEnabled: false
    };
  }

  if (templateId === "card_direct_rsvp_buttons") {
    const fromEnv = readEnvSid(
      "TWILIO_CARD_DIRECT_RSVP_BUTTONS_CONTENT_SID",
      "TWILIO_COPY_WEDDING_RSVP_CARD_CONTENT_SID"
    );
    return {
      templateId,
      contentSid: fromEnv?.contentSid || CARD_DIRECT_RSVP_BUTTONS_CONTENT_SID_DEFAULT,
      sidSource: fromEnv?.sidSource || "default:CARD_DIRECT_RSVP_BUTTONS_CONTENT_SID_DEFAULT",
      templateKeys,
      requiresCoverMedia,
      includesRsvpLink,
      premiumButtonsEnabled: true,
      premiumCardEnabled: true
    };
  }

  if (templateId === "card_buttons") {
    const fromEnv = readEnvSid("TWILIO_CARD_BUTTONS_CONTENT_SID");
    return {
      templateId,
      contentSid: fromEnv?.contentSid || CARD_BUTTONS_CONTENT_SID_DEFAULT,
      sidSource: fromEnv?.sidSource || "default:CARD_BUTTONS_CONTENT_SID_DEFAULT",
      templateKeys,
      requiresCoverMedia,
      includesRsvpLink,
      premiumButtonsEnabled: true,
      premiumCardEnabled: true
    };
  }

  if (templateId === "card_view_invite_button") {
    const fromEnv = readEnvSid("TWILIO_CARD_VIEW_INVITE_BUTTON_CONTENT_SID");
    return {
      templateId,
      contentSid: fromEnv?.contentSid || CARD_VIEW_INVITE_BUTTON_CONTENT_SID_DEFAULT,
      sidSource: fromEnv?.sidSource || "default:CARD_VIEW_INVITE_BUTTON_CONTENT_SID_DEFAULT",
      templateKeys,
      requiresCoverMedia,
      includesRsvpLink,
      premiumButtonsEnabled: false,
      premiumCardEnabled: true
    };
  }

  const fromEnv = readEnvSid("TWILIO_STANDARD_INVITE_CONTENT_SID", "TWILIO_CONTENT_SID");
  return {
    templateId: "standard",
    contentSid: fromEnv?.contentSid || STANDARD_INVITE_CONTENT_SID_DEFAULT,
    sidSource: fromEnv?.sidSource || "default:STANDARD_INVITE_CONTENT_SID_DEFAULT",
    templateKeys,
    requiresCoverMedia: false,
    includesRsvpLink: true,
    premiumButtonsEnabled: false,
    premiumCardEnabled: false
  };
}

/**
 * Keep legacy booleans in sync with the selected template (for older UI/API consumers).
 */
export function deriveLegacyWhatsAppFlags(templateId) {
  const id = isWhatsAppInviteTemplateId(templateId) ? templateId : "standard";
  return {
    whatsappInviteTemplate: id,
    isPremiumWhatsappButtonsEnabled: id === "buttons_qr" || isCardInviteTemplate(id),
    isPremiumWhatsappCardEnabled: isCardInviteTemplate(id)
  };
}

export function normalizeWhatsAppInviteTemplate(raw, { cardEnabled, buttonsEnabled } = {}) {
  const explicit = String(raw || "").trim();
  if (isWhatsAppInviteTemplateId(explicit)) return explicit;
  if (cardEnabled === true) return "card_direct_rsvp_buttons";
  if (buttonsEnabled === true) return "buttons_qr";
  return "standard";
}
