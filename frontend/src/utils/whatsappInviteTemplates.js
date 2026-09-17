/** WhatsApp invite template options for Admin / Agent UI (mirrors backend registry). */

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
    adminHint: "תמונה + מלל עם קישור להזמנה דיגיטלית + 3 כפתורי RSVP. דורשת תמונת כיסוי."
  },
  {
    id: "card_buttons",
    label: "כרטיס מהיר",
    badge: "כרטיס מהיר (3 כפתורים בלבד)",
    adminHint: "תמונה + מלל קצר ללא קישור חיצוני + 3 כפתורי RSVP. דורשת תמונת כיסוי."
  },
  {
    id: "card_view_invite_button",
    label: "כרטיס הפניה",
    badge: "כרטיס הפניה (כפתור קישור יחיד)",
    adminHint: "תמונה + מלל + כפתור URL יחיד לעמוד ההזמנה. דורשת תמונת כיסוי."
  },
  {
    id: "card_buttons_special_requests",
    label: "תבנית תמונה ומלל + כפתורים + קישור לאלרגיות והסעות",
    badge: "כרטיס + קישור אלרגיות/הסעות",
    adminHint:
      "כרטיס עם תמונה, 3 כפתורי RSVP, וקישור להזמנה הדיגיטלית (אלרגיות/הסעות). בלי Waze. דורשת תמונת כיסוי."
  },
  {
    id: "michl_card_buttons",
    label: "מיכל - תבנית ספיישל עם כפתורים",
    badge: "כרטיס מיכל + Waze",
    adminHint:
      "תבנית מותאמת למיכל — כרטיס, כפתורי RSVP (כן/לא) וכפתור ניווט Waze. דורשת תמונת כיסוי וכתובת/מתחם."
  }
];

const CARD_TEMPLATE_IDS = new Set([
  "card_direct_rsvp_buttons",
  "card_buttons",
  "card_view_invite_button",
  "card_buttons_special_requests",
  "michl_card_buttons"
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
