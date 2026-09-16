import {
  deriveWhatsAppFlagsFromTemplate,
  resolveWhatsAppInviteTemplateFromFlags,
  WHATSAPP_INVITE_TEMPLATE_OPTIONS
} from "./whatsappInviteTemplates.js";

export const FEATURE_CHECKBOXES = [
  { key: "whatsappRound1", label: "וואטסאפ — סבב 1" },
  { key: "whatsappRound2", label: "וואטסאפ — סבב 2" },
  { key: "phoneCallsRound1", label: "שיחות טלפון — סבב 1" },
  { key: "phoneCallsRound2", label: "שיחות טלפון — סבב 2" },
  { key: "phoneCallsRound3", label: "שיחות טלפון — סבב 3" },
  { key: "phoneCallsRound4", label: "שיחות טלפון — סבב 4" },
  { key: "eventDayReminder", label: "תזכורת ביום האירוע" },
  { key: "eventDayTableNumber", label: "שליחת מספר שולחן ביום האירוע" },
  { key: "thankYouMessage", label: "הודעת תודה" }
];

export { WHATSAPP_INVITE_TEMPLATE_OPTIONS, deriveWhatsAppFlagsFromTemplate, resolveWhatsAppInviteTemplateFromFlags };

export function emptyFeatures() {
  return {
    whatsappRound1: false,
    whatsappRound2: false,
    isPremiumWhatsappButtonsEnabled: false,
    isPremiumWhatsappCardEnabled: false,
    whatsappInviteTemplate: "standard",
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
