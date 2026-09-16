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
  }
];

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
  const isCard =
    id === "card_direct_rsvp_buttons" ||
    id === "card_buttons" ||
    id === "card_view_invite_button";
  return {
    whatsappInviteTemplate: id,
    isPremiumWhatsappButtonsEnabled: id === "buttons_qr" || isCard,
    isPremiumWhatsappCardEnabled: isCard
  };
}
