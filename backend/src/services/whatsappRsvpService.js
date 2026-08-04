import Guest from "../models/Guest.js";
import User from "../models/User.js";
import { publishDashboardEvent } from "./dashboardEvents.js";
import { recordGuestSelfUpdate } from "./guestAuditService.js";
import { normalizePhone, resolveSourceAfterSelfRsvp } from "../utils/guestPhone.js";
import {
  buildTwilioContentVariables,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import {
  buildPublicEventLink,
  buildWhatsAppTemplateDefaults
} from "../utils/whatsappMessage.js";
import { resolveWhatsAppInviteParagraphs } from "../utils/whatsappInviteCopy.js";
import {
  STATUS_HISTORY_LABELS,
  STATUS_HISTORY_SOURCES,
  pushStatusHistoryOnGuest
} from "../utils/guestStatusHistory.js";

const RSVP_YES_TEXT = "כן אני אגיע";
const RSVP_NO_TEXT = "לצערי לא אוכל";
const RSVP_MAYBE_TEXT = "עדיין לא יודע";
const CONTENT_SID_DEFAULTS = {
  TWILIO_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID: "HX0ed4e1d2438f2e69bfd54610a127984d",
  TWILIO_RSVP_YES_FOLLOWUP_CONTENT_SID: "HX206e8cf197078c26f5258f7799471d9a",
  TWILIO_RSVP_DECLINED_FOLLOWUP_CONTENT_SID: "HX3da07cfd53de307aac93c12cd440e61a",
  TWILIO_RSVP_MAYBE_FOLLOWUP_CONTENT_SID: "HXc9ad6f35c5a025091c86fb9c699aa2a4"
};
const ASK_GUEST_COUNT_TEXT =
  "איזה כיף! כמה תהיו בבקשה? (נא להשיב במספר בלבד, לדוגמה: 2)";

function requireContentSid(envName) {
  const sid = String(process.env[envName] || CONTENT_SID_DEFAULTS[envName] || "").trim();
  if (!sid.startsWith("HX")) {
    throw new Error(`${envName} must be configured with a Twilio Content SID starting with HX`);
  }
  return sid;
}

function normalizedInteractionValue(value) {
  return String(value || "").trim();
}

function interactionMatches({ payload, text, expectedPayload, expectedText }) {
  return payload === expectedPayload || text === expectedPayload || text === expectedText;
}

async function findConversationGuest(from) {
  const phone = normalizePhone(String(from || "").replace(/^whatsapp:/i, ""));
  if (!phone) return null;

  return Guest.findOne({ phone })
    .sort({ lastWhatsAppSentAt: -1, updatedAt: -1 })
    .exec();
}

async function loadGuestEvent(guest) {
  if (!guest) return null;
  const user = await User.findById(guest.userId).select("event");
  if (!user) return null;
  return { event: user.event, user };
}

function buildPremiumInviteVariables({ guest, event, userId, origin }) {
  const defaults = buildWhatsAppTemplateDefaults({ event, eventId: userId, origin });
  const paragraphs = resolveWhatsAppInviteParagraphs(event);

  return buildTwilioContentVariables(
    {
      guestName: guest.fullName || "אורח/ת יקר/ה",
      customOpeningText: paragraphs.welcomeParagraph || defaults.intro,
      eventDateTimeLocation: paragraphs.eventDetailsParagraph || defaults.eventDetails,
      rsvpLink: buildPublicEventLink({ eventId: userId, origin }) || defaults.rsvpLink,
      closingSignOff: paragraphs.closingParagraph || defaults.signature
    },
    ["1", "2", "3", "4", "5"]
  );
}

async function sendSessionText({ guest, body }) {
  return sendTwilioWhatsAppMessage({
    to: toTwilioWhatsAppAddress(guest.phone),
    body,
    userId: guest.userId,
    recipientPhone: guest.phone
  });
}

async function sendContentTemplate({ guest, contentSid }) {
  return sendTwilioWhatsAppMessage({
    to: toTwilioWhatsAppAddress(guest.phone),
    contentSid,
    userId: guest.userId,
    recipientPhone: guest.phone
  });
}

async function sendPremiumMainTemplate({ guest, event, origin }) {
  return sendTwilioWhatsAppMessage({
    to: toTwilioWhatsAppAddress(guest.phone),
    contentSid: requireContentSid("TWILIO_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID"),
    contentVariables: buildPremiumInviteVariables({
      guest,
      event,
      userId: guest.userId,
      origin
    }),
    userId: guest.userId,
    recipientPhone: guest.phone
  });
}

async function publishRsvpUpdate(guest) {
  publishDashboardEvent(guest.userId, {
    type: "guest-whatsapp-rsvp-updated",
    guestId: String(guest._id)
  });
}

async function saveRsvp(guest, { status, attendeesCount }) {
  const before = {
    status: guest.status,
    attendeesCount: guest.attendeesCount
  };

  pushStatusHistoryOnGuest(guest, {
    previousStatus: before.status,
    status,
    updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.WHATSAPP],
    source: STATUS_HISTORY_SOURCES.WHATSAPP
  });
  guest.status = status;
  if (attendeesCount !== undefined) {
    guest.attendeesCount = attendeesCount;
  }
  if (status === "לא מגיע" && guest.seatingTableId) {
    guest.declinedWhileSeatedAt = new Date();
  } else if (status !== "לא מגיע") {
    guest.declinedWhileSeatedAt = undefined;
  }
  guest.confirmationMethod = "whatsapp";
  guest.source = resolveSourceAfterSelfRsvp(guest);
  guest.whatsappConversationState = "idle";
  await guest.save();
  await recordGuestSelfUpdate({ guest, before, channel: "whatsapp" });
  await publishRsvpUpdate(guest);
}

export async function handleIncomingWhatsAppRsvp({
  from,
  body,
  buttonPayload,
  buttonText,
  origin
}) {
  const guest = await findConversationGuest(from);
  if (!guest) {
    console.warn(`[Twilio RSVP] No guest found for inbound sender ${from || "unknown"}`);
    return { handled: false, reason: "guest_not_found" };
  }

  const context = await loadGuestEvent(guest);
  if (!context) return { handled: false, reason: "event_not_found" };

  const payload = normalizedInteractionValue(buttonPayload);
  const text = normalizedInteractionValue(buttonText || body);

  const resetRequested =
    payload === "trigger_rsvp_reset" ||
    text === "trigger_rsvp_reset" ||
    text === "עדכון" ||
    text === "עדכון תשובה";
  if (resetRequested) {
    guest.whatsappConversationState = "idle";
    guest.lastWhatsAppSentAt = new Date();
    await guest.save();
    await sendPremiumMainTemplate({ guest, event: context.event, origin });
    return { handled: true, action: "reset" };
  }

  if (
    interactionMatches({
      payload,
      text,
      expectedPayload: "rsvp_yes",
      expectedText: RSVP_YES_TEXT
    })
  ) {
    guest.whatsappConversationState = "awaiting_guest_count";
    await guest.save();
    await sendSessionText({ guest, body: ASK_GUEST_COUNT_TEXT });
    return { handled: true, action: "awaiting_guest_count" };
  }

  if (
    interactionMatches({
      payload,
      text,
      expectedPayload: "rsvp_no",
      expectedText: RSVP_NO_TEXT
    })
  ) {
    await saveRsvp(guest, { status: "לא מגיע" });
    await sendContentTemplate({
      guest,
      contentSid: requireContentSid("TWILIO_RSVP_DECLINED_FOLLOWUP_CONTENT_SID")
    });
    return { handled: true, action: "declined" };
  }

  if (
    interactionMatches({
      payload,
      text,
      expectedPayload: "rsvp_maybe",
      expectedText: RSVP_MAYBE_TEXT
    })
  ) {
    await saveRsvp(guest, { status: "אולי" });
    await sendContentTemplate({
      guest,
      contentSid: requireContentSid("TWILIO_RSVP_MAYBE_FOLLOWUP_CONTENT_SID")
    });
    return { handled: true, action: "maybe" };
  }

  if (guest.whatsappConversationState === "awaiting_guest_count") {
    if (!/^\d+$/.test(text) || Number(text) < 1) {
      await sendSessionText({ guest, body: ASK_GUEST_COUNT_TEXT });
      return { handled: true, action: "invalid_guest_count" };
    }

    await saveRsvp(guest, { status: "מגיע", attendeesCount: Number(text) });
    await sendContentTemplate({
      guest,
      contentSid: requireContentSid("TWILIO_RSVP_YES_FOLLOWUP_CONTENT_SID")
    });
    return { handled: true, action: "confirmed" };
  }

  return { handled: false, reason: "unsupported_interaction" };
}
