export const FEATURE_CHECKBOXES = [
  { key: "whatsappRound1", label: "וואטסאפ — סבב 1" },
  { key: "whatsappRound2", label: "וואטסאפ — סבב 2" },
  { key: "isPremiumWhatsappButtonsEnabled", label: "ווצאפ כפתורים מהירים (Premium)" },
  { key: "phoneCallsRound1", label: "שיחות טלפון — סבב 1" },
  { key: "phoneCallsRound2", label: "שיחות טלפון — סבב 2" },
  { key: "phoneCallsRound3", label: "שיחות טלפון — סבב 3" },
  { key: "phoneCallsRound4", label: "שיחות טלפון — סבב 4" },
  { key: "eventDayReminder", label: "תזכורת ביום האירוע" },
  { key: "eventDayTableNumber", label: "שליחת מספר שולחן ביום האירוע" },
  { key: "thankYouMessage", label: "הודעת תודה" }
];

export function emptyFeatures() {
  return {
    whatsappRound1: false,
    whatsappRound2: false,
    isPremiumWhatsappButtonsEnabled: false,
    phoneCallsRound1: false,
    phoneCallsRound2: false,
    phoneCallsRound3: false,
    phoneCallsRound4: false,
    eventDayReminder: false,
    eventDayTableNumber: false,
    canSendTableWhatsApp: false,
    thankYouMessage: false
  };
}
