import ActivationCode from "../models/ActivationCode.js";
import Guest from "../models/Guest.js";
import {
  buildConferenceContentVariables,
  buildTwilioContentVariables,
  fetchTwilioContentTemplate,
  isTwilioConfigured,
  resolveConferenceContentSid,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import {
  buildPublicEventLink,
  buildWhatsAppTemplateDefaults
} from "../utils/whatsappMessage.js";
import {
  resolveWhatsAppInviteParagraphs,
  toTemplateEventDetailsVariable
} from "../utils/whatsappInviteCopy.js";
import { getDefaultWelcomeParagraph, isConferenceEventType } from "../utils/eventTypeWording.js";
import { recalculateUserSupplierCost } from "../utils/supplierCost.js";

// copy_copy_event_invite_structured (Text)
const STANDARD_INVITE_CONTENT_SID =
  process.env.TWILIO_STANDARD_INVITE_CONTENT_SID ||
  process.env.TWILIO_CONTENT_SID ||
  "HXbdfde344006c1b595fe91e738f9972c5";
// copy_copy_wedding_rsvp_buttons (Quick Reply)
const PREMIUM_WEDDING_RSVP_CONTENT_SID =
  process.env.TWILIO_COPY_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID ||
  process.env.TWILIO_COPY_WEDDING_RSVP_BUTTONS_CONTENT_SID ||
  "HX0ed4e1d2438f2e69bfd54610a127984d";

function getTwilioContentSid(event) {
  if (isConferenceEventType(event?.eventType)) {
    return resolveConferenceContentSid();
  }
  const premiumEnabled = event?.isPremiumWhatsappButtonsEnabled === true;
  return premiumEnabled ? PREMIUM_WEDDING_RSVP_CONTENT_SID : STANDARD_INVITE_CONTENT_SID;
}

function getTemplateVariableKeys(event) {
  if (isConferenceEventType(event?.eventType)) {
    return ["1"];
  }
  return ["1", "2", "3", "4", "5"];
}

function normalizePaymentCode(rawCode) {
  return String(rawCode || "").trim().toUpperCase();
}

function buildInsufficientCreditsMessage(codeRecord) {
  return `קנית מכסה בסך של ${codeRecord.total_credits} הודעות. נשארו לך ${codeRecord.remaining_credits} הודעות לניצול. מצטערים, נא לנסות שוב עם בחירה של עד ${codeRecord.remaining_credits} מוזמנים.`;
}

function isTwilioFromAddressError(error) {
  const code = Number(error?.code);
  const message = String(error?.message || "");
  return code === 63007 || message.includes("Channel with the specified From");
}

export function mapTwilioErrorMessage(error) {
  if (isTwilioFromAddressError(error)) {
    return "שליחת ההודעה נכשלה, נא לוודא שמספר המערכת מוגדר כראוי";
  }
  if (Number(error?.code) === 21656 || Number(error?.code) === 63028) {
    return "שליחת ההודעה נכשלה: מספר משתני התבנית אינו תואם. לתבנית כנס יש לשלוח רק {{1}} (שם המשתתף).";
  }
  return error?.message || "שליחת ההודעה נכשלה, אנא נסה שוב מאוחר יותר";
}

export async function findValidActivationCode(paymentCode) {
  const code = String(paymentCode || "").trim().toUpperCase();
  if (!code) return { error: "missing_code" };

  const codeRecord = await ActivationCode.findOne({ code, isActive: true });
  if (!codeRecord) {
    return { error: "invalid_code" };
  }

  if (codeRecord.expiresAt && codeRecord.expiresAt.getTime() < Date.now()) {
    return { error: "expired_code", codeRecord };
  }

  return { codeRecord };
}

export async function reserveActivationCredits(codeRecord, requestedCount) {
  const reserved = await ActivationCode.findOneAndUpdate(
    {
      _id: codeRecord._id,
      isActive: true,
      remaining_credits: { $gte: requestedCount }
    },
    { $inc: { remaining_credits: -requestedCount } },
    { new: true }
  );

  if (!reserved) {
    const fresh = await ActivationCode.findById(codeRecord._id);
    return {
      ok: false,
      message: `קנית מכסה בסך של ${(fresh || codeRecord).total_credits} הודעות. נשארו לך ${(fresh || codeRecord).remaining_credits} הודעות לניצול.`
    };
  }

  return { ok: true, codeRecord: reserved };
}

export async function releaseActivationCredits(codeId, count) {
  if (!codeId || !count) return;
  try {
    await ActivationCode.findByIdAndUpdate(codeId, { $inc: { remaining_credits: count } });
  } catch (releaseError) {
    console.error("[Twilio] Failed to release credits:", releaseError?.message || releaseError);
  }
}

async function findValidCodeRecord(paymentCode) {
  return findValidActivationCode(paymentCode);
}

async function reserveCredits(codeRecord, requestedCount) {
  return reserveActivationCredits(codeRecord, requestedCount);
}

async function releaseCredits(codeId, count) {
  return releaseActivationCredits(codeId, count);
}

function resolveInviteeTemplateFields({ invitee, defaults, eventId, origin, paragraphs }) {
  const rsvpLink = buildPublicEventLink({ eventId, origin }) || String(defaults?.rsvpLink || "").trim();
  const guestName = String(invitee.name || "אורח/ת יקר/ה").trim();

  const customOpeningText =
    String(paragraphs?.welcomeParagraph || "").trim() ||
    String(defaults?.intro || "").trim() ||
    getDefaultWelcomeParagraph();

  const eventDateTimeLocation = toTemplateEventDetailsVariable(
    String(paragraphs?.eventDetailsParagraph || "").trim() ||
      String(defaults?.eventDetails || "").trim() ||
      "פרטי האירוע יתעדכנו בקרוב"
  );

  const closingSignOff =
    String(paragraphs?.closingParagraph || "").trim() ||
    String(defaults?.signature || "").trim() ||
    "נתראה בשמחה";

  return {
    guestName,
    customOpeningText,
    eventDateTimeLocation,
    rsvpLink,
    closingSignOff
  };
}

async function sendToInvitee({
  invitee,
  eventId,
  origin,
  contentSid,
  defaults,
  templateKeys,
  userId,
  paragraphs,
  conferenceMode = false
}) {
  const to = toTwilioWhatsAppAddress(invitee.phone);
  if (!to) {
    console.error(
      `ERROR: שליחת וואטסאפ נכשלה למספר ${invitee.phone || "לא ידוע"} מאת משתמש ${userId || "לא ידוע"}. סיבה: מספר טלפון לא תקין`
    );
    return {
      ok: false,
      invitee,
      error: { message: `מספר טלפון לא תקין עבור ${invitee.name}` }
    };
  }

  try {
    let contentVariables;
    if (conferenceMode) {
      // Card template embeds media + body; only {{1}} is dynamic.
      contentVariables = buildConferenceContentVariables(
        invitee.name || invitee.fullName || "משקיע/ה יקר/ה"
      );
      console.log(
        `[Twilio] Conference send SID=${contentSid} contentVariables=${contentVariables}`
      );
    } else {
      const fields = resolveInviteeTemplateFields({
        invitee,
        defaults,
        eventId,
        origin,
        paragraphs
      });

      if (!fields.rsvpLink) {
        throw new Error("RSVP link is missing");
      }

      contentVariables = buildTwilioContentVariables(
        {
          guestName: fields.guestName,
          customOpeningText: fields.customOpeningText,
          eventDateTimeLocation: fields.eventDateTimeLocation,
          rsvpLink: fields.rsvpLink,
          closingSignOff: fields.closingSignOff
        },
        templateKeys
      );
    }

    await sendTwilioWhatsAppMessage({
      to,
      contentSid,
      contentVariables,
      userId: userId || eventId,
      recipientPhone: invitee.phone
    });
    return { ok: true, invitee };
  } catch (error) {
    try {
      console.error("[Twilio] template keys:", templateKeys?.join(", ") || "unknown");
      console.error("[Twilio] contentSid:", contentSid);
      console.error("[Twilio] conferenceMode:", conferenceMode);
      if (conferenceMode) {
        console.error(
          "[Twilio] contentVariables payload:",
          buildConferenceContentVariables(invitee.name || invitee.fullName || "משקיע/ה יקר/ה")
        );
      } else {
        const debugFields = resolveInviteeTemplateFields({
          invitee,
          defaults,
          eventId,
          origin,
          paragraphs
        });
        console.error(
          "[Twilio] contentVariables payload:",
          buildTwilioContentVariables(
            {
              guestName: debugFields.guestName,
              customOpeningText: debugFields.customOpeningText,
              eventDateTimeLocation: debugFields.eventDateTimeLocation,
              rsvpLink: debugFields.rsvpLink,
              closingSignOff: debugFields.closingSignOff
            },
            templateKeys
          )
        );
      }
    } catch {
      /* ignore debug logging errors */
    }
    return { ok: false, invitee, error };
  }
}

export async function sendBulkWhatsApp({
  paymentCode,
  guests,
  event,
  userId,
  origin
}) {
  try {
    if (!isTwilioConfigured()) {
      return {
        status: 503,
        body: {
          success: false,
          message: "שירות שליחת וואטסאפ לא מוגדר בשרת. פנו למנהל המערכת."
        }
      };
    }

    if (!Array.isArray(guests) || guests.length === 0) {
      return { status: 400, body: { success: false, message: "יש לבחור לפחות מוזמן אחד לשליחה" } };
    }

    const { codeRecord, error: codeError } = await findValidCodeRecord(paymentCode);
    if (codeError === "missing_code") {
      return { status: 400, body: { success: false, message: "יש להזין קוד רכישה" } };
    }
    if (codeError === "invalid_code") {
      return { status: 404, body: { success: false, message: "קוד לא תקין, אנא בדוק שוב." } };
    }
    if (codeError === "expired_code") {
      return { status: 400, body: { success: false, message: "קוד הרכישה פג תוקף. פנו למנהל המערכת." } };
    }

    const namedGuests = guests
      .map((guest) => ({
        guestId: guest._id,
        name: String(guest.fullName || "").trim(),
        phone: String(guest.phone || "").trim()
      }))
      .filter((guest) => guest.name);

    const skippedNoPhone = namedGuests
      .filter((guest) => !guest.phone)
      .map((guest) => ({ guestId: guest.guestId, name: guest.name }));

    const invitees = namedGuests.filter((guest) => guest.phone);

    if (!invitees.length) {
      return {
        status: 400,
        body: {
          success: false,
          message:
            skippedNoPhone.length > 0
              ? "לא נשלחו הודעות — לכל המוזמנים שנבחרו חסר מספר טלפון"
              : "לא נמצאו מוזמנים תקינים לשליחה",
          sentCount: 0,
          failedCount: 0,
          skippedNoPhoneCount: skippedNoPhone.length,
          skippedNoPhone
        }
      };
    }

    const requestedCount = invitees.length;
    const reservation = await reserveCredits(codeRecord, requestedCount);
    if (!reservation.ok) {
      return { status: 400, body: { success: false, message: reservation.message } };
    }

    const reservedRecord = reservation.codeRecord;
    const defaults = buildWhatsAppTemplateDefaults({
      event,
      eventId: userId,
      origin
    });
    const paragraphs = resolveWhatsAppInviteParagraphs(event);
    const conferenceMode = isConferenceEventType(event?.eventType);
    const contentSid = getTwilioContentSid(event);
    const templateKeys = getTemplateVariableKeys(event);
    console.log(
      `[Twilio] eventType=${event?.eventType || "?"} conference=${conferenceMode}; ` +
        `premium buttons ${event?.isPremiumWhatsappButtonsEnabled === true ? "enabled" : "disabled"}; ` +
        `selected template SID: ${contentSid}; variables: ${templateKeys.join(", ")}`
    );

    if (conferenceMode) {
      console.log(
        `[Twilio] Conference Card template locked to SID=${contentSid} variables=1 only (no body/media overrides)`
      );
    } else {
      try {
        const templateMeta = await fetchTwilioContentTemplate(contentSid);
        if (templateMeta.variableKeys.join(",") !== templateKeys.join(",")) {
          throw new Error(
            `Template ${contentSid} must define variables ${templateKeys.join(", ")} (found: ${templateMeta.variableKeys.join(", ")})`
          );
        }
        console.log(
          `[Twilio] Using template "${templateMeta.friendlyName}" (${contentSid}) variables: ${templateKeys.join(", ")}`
        );
      } catch (templateError) {
        console.warn(
          `[Twilio] Could not fetch content template metadata, using default keys ${templateKeys.join(", ")}:`,
          templateError?.message || templateError
        );
      }
    }

    const results = await Promise.all(
      invitees.map((invitee) =>
        sendToInvitee({
          invitee,
          eventId: userId,
          origin,
          contentSid,
          defaults,
          templateKeys,
          userId,
          paragraphs,
          conferenceMode
        })
      )
    );
    const sentResults = results.filter((result) => result.ok);
    const failedResults = results.filter((result) => !result.ok);
    const sentCount = sentResults.length;
    const failedCount = failedResults.length;

    if (failedCount > 0) {
      await releaseCredits(reservedRecord._id, failedCount);
    }

    if (sentCount > 0) {
      const sentGuestIds = sentResults
        .map((result) => result.invitee?.guestId)
        .filter(Boolean);
      if (sentGuestIds.length) {
        try {
          await Guest.updateMany(
            { _id: { $in: sentGuestIds } },
            {
              $inc: {
                reminderRound: 1,
                whatsappRoundsSentCount: 1
              },
              $set: {
                whatsappConversationState: "idle",
                lastWhatsAppSentAt: new Date()
              }
            }
          );
        } catch (roundError) {
          console.error("[Twilio] Failed to increment reminderRound:", roundError?.message || roundError);
        }
      }
    }

    if (sentCount === 0) {
      const primaryError = failedResults.find((result) => result.error)?.error;
      const status = isTwilioFromAddressError(primaryError) ? 400 : 500;
      return {
        status,
        body: {
          success: false,
          message: mapTwilioErrorMessage(primaryError),
          sentCount: 0,
          failedCount,
          skippedNoPhoneCount: skippedNoPhone.length,
          skippedNoPhone,
          twilioCode: primaryError?.code || null
        }
      };
    }

    if (!reservedRecord.redeemedByUserId) {
      try {
        reservedRecord.redeemedByUserId = userId;
        await reservedRecord.save();
        await recalculateUserSupplierCost(userId);
      } catch (saveError) {
        console.error("[Twilio] Failed to mark code as redeemed:", saveError?.message || saveError);
      }
    }

    const freshRecord = await ActivationCode.findById(reservedRecord._id);
    const remaining = freshRecord?.remaining_credits ?? reservedRecord.remaining_credits;
    const skippedSuffix =
      skippedNoPhone.length > 0
        ? ` ${skippedNoPhone.length} מוזמנים דולגו כי חסר מספר טלפון.`
        : "";

    if (failedCount > 0) {
      return {
        status: 207,
        body: {
          success: true,
          partial: true,
          message: `נשלחו ${sentCount} הודעות. ${failedCount} נכשלו. נשארו ${remaining} הודעות במכסה.${skippedSuffix}`,
          sentCount,
          failedCount,
          remaining,
          skippedNoPhoneCount: skippedNoPhone.length,
          skippedNoPhone
        }
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        message: `מצויין! נשלחו ${sentCount} הודעות. נשאר לך עוד ${remaining} הודעות במכסה.${skippedSuffix}`,
        sentCount,
        remaining,
        skippedNoPhoneCount: skippedNoPhone.length,
        skippedNoPhone
      }
    };
  } catch (unexpectedError) {
    console.error("[Twilio] Unexpected bulk send error:", unexpectedError?.message || unexpectedError);
    return {
      status: 500,
      body: {
        success: false,
        message: "שגיאה פנימית בשליחת ההודעות, אנא נסה שוב מאוחר יותר."
      }
    };
  }
}
