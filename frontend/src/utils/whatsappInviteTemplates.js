/** WhatsApp invite template options for Admin / Agent UI (mirrors backend registry). */

export const WHATSAPP_INVITE_TEMPLATE_OPTIONS = [
  {
    id: "standard",
    label: "מלל + קישור הזמנה",
    badge: "מלל + קישור",
    adminHint: "תבנית טקסט מאושרת עם קישור להזמנה הדיגיטלית."
  },
  {
    id: "buttons_qr",
    label: "מלל + 3 כפתורים",
    badge: "מלל + 3 כפתורים",
    adminHint: "תבנית מלל + כפתורי RSVP (ללא תמונת כיסוי)."
  },
  {
    id: "card_direct_rsvp_buttons",
    label: "תמונה + מלל + קישור + 3 כפתורים",
    badge: "תמונה + קישור + 3 כפתורים",
    adminHint: "תמונה + מלל עם קישור להזמנה דיגיטלית + 3 כפתורי RSVP. דורשת תמונת כיסוי."
  },
  {
    id: "card_buttons",
    label: "תמונה + מלל + 3 כפתורים",
    badge: "תמונה + 3 כפתורים",
    adminHint: "תמונה + מלל קצר ללא קישור חיצוני + 3 כפתורי RSVP. דורשת תמונת כיסוי."
  },
  {
    id: "card_view_invite_button",
    label: "תמונה + מלל + כפתור אישור הזמנה (חבילה בסיסית 1.5 ש״ח)",
    badge: "חבילה בסיסית 1.5₪",
    adminHint: "תמונה + מלל + כפתור URL יחיד לעמוד ההזמנה. דורשת תמונת כיסוי."
  },
  {
    id: "card_buttons_special_requests",
    label: "תמונה + מלל + קישור + 3 כפתורים - הסבר אלרגיות/הסעות",
    badge: "אלרגיות/הסעות",
    adminHint:
      "כרטיס עם תמונה, 3 כפתורי RSVP, וקישור להזמנה הדיגיטלית (אלרגיות/הסעות). בלי Waze. דורשת תמונת כיסוי."
  },
  {
    id: "michl_card_buttons",
    label: "תמונה + מלל + 2 כפתורים",
    badge: "תמונה + 2 כפתורים",
    adminHint:
      "תבנית מותאמת למיכל — כרטיס, כפתורי RSVP (כן/לא) וכפתור ניווט Waze. דורשת תמונת כיסוי וכתובת/מתחם."
  },
  {
    id: "michl_quick_reply_waze",
    label: "תמונה + מלל + 2 כפתורים + כפתור WAZE מנווט",
    badge: "2 כפתורים + WAZE מנווט",
    adminHint:
      "תמונה + מלל + 3 כפתורי מענה (כן אני אגיע / לא אוכל להגיע / ניווט לאירוע ב-Waze). בלי כפתור URL. דורשת תמונת כיסוי."
  },
  {
    id: "remmber_day_and_waze",
    label: "תזכורת יום האירוע + Waze",
    badge: "כרטיס + כפתור Waze בלבד",
    adminHint:
      "תמונה + מלל + כפתור מענה יחיד «ניווט לאירוע ב-Waze» (WAZE_REQUEST). בלי כפתורי RSVP ובלי קישור להזמנה. דורשת תמונת כיסוי."
  },
  {
    id: "2_card_buttons",
    label: "תמונה + מלל + 2 כפתורים + כפתור WAZE הודעה לבוט",
    badge: "2 כפתורים + WAZE לבוט",
    adminHint:
      "תמונה + מלל, קישור Waze בגוף ההודעה (לא ככפתור URL), ו-2 כפתורי RSVP (אגיע / לא אגיע). דורשת תמונת כיסוי וכתובת/מתחם."
  },
  {
    id: "thank_you_after_event",
    label: "תודה שהגעתם",
    badge: "הודעת תודה",
    adminHint:
      "תבנית מלל בלבד אחרי האירוע — תודה קבועה + משתנה אחד לחתימה/שמות ({{1}}). בלי תמונה ובלי כפתורים."
  }
];

const CARD_TEMPLATE_IDS = new Set([
  "card_direct_rsvp_buttons",
  "card_buttons",
  "card_view_invite_button",
  "card_buttons_special_requests",
  "michl_card_buttons",
  "michl_quick_reply_waze",
  "remmber_day_and_waze",
  "2_card_buttons"
]);

export function resolveWhatsAppInviteTemplateFromFlags({
  whatsappInviteTemplate,
  dealWhatsappInviteTemplate,
  isPremiumWhatsappCardEnabled,
  isPremiumWhatsappButtonsEnabled
} = {}) {
  const candidates = [
    String(whatsappInviteTemplate || "").trim(),
    String(dealWhatsappInviteTemplate || "").trim()
  ];
  for (const candidate of candidates) {
    if (
      WHATSAPP_INVITE_TEMPLATE_OPTIONS.some((option) => option.id === candidate) &&
      candidate !== "standard"
    ) {
      return candidate;
    }
  }
  if (isPremiumWhatsappCardEnabled) return "card_direct_rsvp_buttons";
  if (isPremiumWhatsappButtonsEnabled) return "buttons_qr";
  return "standard";
}

export function deriveWhatsAppFlagsFromTemplate(templateId) {
  const id = WHATSAPP_INVITE_TEMPLATE_OPTIONS.some((option) => option.id === templateId)
    ? templateId
    : "standard";
  const isCard = CARD_TEMPLATE_IDS.has(id);
  return {
    whatsappInviteTemplate: id,
    isPremiumWhatsappButtonsEnabled: id === "buttons_qr" || isCard,
    isPremiumWhatsappCardEnabled: isCard
  };
}

/** Mirrors backend TEMPLATE_FIELD_KEYS — which body variables each Twilio template uses. */
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
  card_direct_rsvp_buttons: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    rsvpLink: "4",
    closingSignOff: "5",
    mediaPath: "6"
  },
  card_buttons: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    closingSignOff: "4",
    mediaPath: "5"
  },
  card_view_invite_button: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    closingSignOff: "4",
    mediaPath: "5",
    inviteButtonPath: "6"
  },
  card_buttons_special_requests: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    rsvpLink: "4",
    closingSignOff: "5",
    mediaPath: "6"
  },
  michl_card_buttons: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    closingSignOff: "4",
    mediaPath: "5",
    wazeQuery: "6"
  },
  michl_quick_reply_waze: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    closingSignOff: "4",
    mediaPath: "5"
  },
  remmber_day_and_waze: {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    closingSignOff: "4",
    mediaPath: "5"
  },
  "2_card_buttons": {
    guestName: "1",
    customOpeningText: "2",
    eventDateTimeLocation: "3",
    wazeInviteLine: "4",
    closingSignOff: "5",
    mediaPath: "6"
  },
  thank_you_after_event: {
    closingSignOff: "1"
  }
};

const TEMPLATE_PREVIEW_BUTTONS = {
  standard: [],
  buttons_qr: ["כן אני אגיע", "לצערי לא אוכל", "עדיין לא יודע"],
  card_direct_rsvp_buttons: ["כן אני אגיע", "לצערי לא אוכל", "עדיין לא יודע"],
  card_buttons: ["כן אני אגיע", "לצערי לא אוכל", "עדיין לא יודע"],
  card_view_invite_button: ["לאישור הגעה"],
  card_buttons_special_requests: ["כן אני אגיע", "לצערי לא אוכל", "עדיין לא יודע"],
  michl_card_buttons: ["כן, אני אגיע!", "לא אוכל להגיע", "ניווט ב-Waze"],
  michl_quick_reply_waze: ["כן, אני אגיע!", "לא אוכל להגיע", "ניווט לאירוע ב-Waze"],
  remmber_day_and_waze: ["ניווט לאירוע ב-Waze"],
  "2_card_buttons": ["כן, אני אגיע!", "לא אוכל להגיע"],
  thank_you_after_event: []
};

export function getTemplateFieldKeyMap(templateId) {
  return TEMPLATE_FIELD_KEYS[templateId] || TEMPLATE_FIELD_KEYS.standard;
}

export function templateIncludesRsvpLink(templateId) {
  const map = getTemplateFieldKeyMap(templateId);
  return Boolean(map.rsvpLink);
}

/**
 * Shape used by the WhatsApp bubble preview — mirrors what the recipient sees.
 */
export function getWhatsAppInvitePreviewShape(templateId) {
  const id = WHATSAPP_INVITE_TEMPLATE_OPTIONS.some((option) => option.id === templateId)
    ? templateId
    : "standard";
  const map = getTemplateFieldKeyMap(id);
  return {
    templateId: id,
    showOpening: Boolean(map.customOpeningText),
    showEventDetails: Boolean(map.eventDateTimeLocation),
    showClosing: Boolean(map.closingSignOff),
    showRsvpLink: Boolean(map.rsvpLink),
    showInviteUrlButton: Boolean(map.inviteButtonPath),
    showWazeInviteLine: Boolean(map.wazeInviteLine),
    showMedia: Boolean(map.mediaPath),
    showGuestGreeting: Boolean(map.guestName),
    showThankYouBody: id === "thank_you_after_event",
    buttons: TEMPLATE_PREVIEW_BUTTONS[id] || []
  };
}

export function resolveEventWhatsAppInviteTemplateId(event = {}) {
  return resolveWhatsAppInviteTemplateFromFlags({
    whatsappInviteTemplate: event?.whatsappInviteTemplate,
    dealWhatsappInviteTemplate: event?.includedFeatures?.whatsappInviteTemplate,
    isPremiumWhatsappCardEnabled:
      event?.isPremiumWhatsappCardEnabled === true ||
      event?.includedFeatures?.isPremiumWhatsappCardEnabled === true,
    isPremiumWhatsappButtonsEnabled:
      event?.isPremiumWhatsappButtonsEnabled === true ||
      event?.includedFeatures?.isPremiumWhatsappButtonsEnabled === true
  });
}
