import ActivationCode from "../models/ActivationCode.js";
import Guest from "../models/Guest.js";
import {
  buildTwilioContentVariables,
  fetchTwilioContentTemplate,
  isTwilioConfigured,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import {
  buildPublicEventLink,
  buildWhatsAppTemplateDefaults
} from "../utils/whatsappMessage.js";
import { resolveWhatsAppInviteParagraphs } from "../utils/whatsappInviteCopy.js";

const STANDARD_INVITE_CONTENT_SID = "HXa32f37f28c9aeea9d824b1b53919c326";
const PREMIUM_WEDDING_RSVP_CONTENT_SID = "HX9eb2ac4178732bcfd5eb3e9609f9f626";

function getTwilioContentSid(event) {
  const premiumEnabled = event?.isPremiumWhatsappButtonsEnabled === true;
  return premiumEnabled ? PREMIUM_WEDDING_RSVP_CONTENT_SID : STANDARD_INVITE_CONTENT_SID;
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
  if (Number(error?.code) === 21656) {
    return "שליחת ההודעה נכשלה: משתני התבנית אינם תואמים ל-TWILIO_CONTENT_SID. ודאו שה-SID מתחיל ב-HX ושהתבנית כוללת את אותם משתנים (1-5).";
  }
  return error?.message || "שליחת ההודעה נכשלה, אנא נסה שוב מאוחר יותר";
}

async function findValidCodeRecord(paymentCode) {
  const code = normalizePaymentCode(paymentCode);
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

async function reserveCredits(codeRecord, requestedCount) {
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
      message: buildInsufficientCreditsMessage(fresh || codeRecord)
    };
  }

  return { ok: true, codeRecord: reserved };
}

async function releaseCredits(codeId, count) {
  if (!codeId || !count) return;
  try {
    await ActivationCode.findByIdAndUpdate(codeId, { $inc: { remaining_credits: count } });
  } catch (releaseError) {
    console.error("[Twilio] Failed to release credits:", releaseError?.message || releaseError);
  }
}

function resolveInviteeTemplateFields({ invitee, defaults, eventId, origin, paragraphs }) {
  const rsvpLink = buildPublicEventLink({ eventId, origin }) || String(defaults?.rsvpLink || "").trim();
  const guestName = String(invitee.name || "אורח/ת יקר/ה").trim();

  const customOpeningText =
    String(paragraphs?.welcomeParagraph || "").trim() ||
    String(defaults?.intro || "").trim() ||
    "משפחה וחברים יקרים, הנכם מוזמנים לחתונה שלנו!";

  const eventDateTimeLocation =
    String(paragraphs?.eventDetailsParagraph || "").trim() ||
    String(defaults?.eventDetails || "").trim() ||
    "פרטי האירוע יתעדכנו בקרוב";

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
  paragraphs
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

    const contentVariables = buildTwilioContentVariables(
      {
        guestName: fields.guestName,
        customOpeningText: fields.customOpeningText,
        eventDateTimeLocation: fields.eventDateTimeLocation,
        rsvpLink: fields.rsvpLink,
        closingSignOff: fields.closingSignOff
      },
      templateKeys
    );

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
      const debugFields = resolveInviteeTemplateFields({
        invitee,
        defaults,
        eventId,
        origin,
        paragraphs
      });
      console.error("[Twilio] template keys:", templateKeys?.join(", ") || "unknown");
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

    const invitees = guests
      .map((guest) => ({
        guestId: guest._id,
        name: String(guest.fullName || "").trim(),
        phone: guest.phone
      }))
      .filter((guest) => guest.name && guest.phone);

    if (!invitees.length) {
      return { status: 400, body: { success: false, message: "לא נמצאו מוזמנים תקינים לשליחה" } };
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
    const contentSid = getTwilioContentSid(event);
    console.log(
      `[Twilio] Premium buttons ${event?.isPremiumWhatsappButtonsEnabled === true ? "enabled" : "disabled"}; selected template SID: ${contentSid}`
    );
    let templateKeys = ["1", "2", "3", "4", "5"];
    try {
      const templateMeta = await fetchTwilioContentTemplate(contentSid);
      if (templateMeta.variableKeys.join(",") !== templateKeys.join(",")) {
        throw new Error(
          `Template ${contentSid} must define exactly variables 1-5 (found: ${templateMeta.variableKeys.join(", ")})`
        );
      }
      console.log(
        `[Twilio] Using template "${templateMeta.friendlyName}" (${contentSid}) variables: ${templateKeys.join(", ")}`
      );
    } catch (templateError) {
      console.warn(
        "[Twilio] Could not fetch content template metadata, using default keys 1-5:",
        templateError?.message || templateError
      );
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
          paragraphs
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
          twilioCode: primaryError?.code || null
        }
      };
    }

    if (!reservedRecord.redeemedByUserId) {
      try {
        reservedRecord.redeemedByUserId = userId;
        await reservedRecord.save();
      } catch (saveError) {
        console.error("[Twilio] Failed to mark code as redeemed:", saveError?.message || saveError);
      }
    }

    const freshRecord = await ActivationCode.findById(reservedRecord._id);
    const remaining = freshRecord?.remaining_credits ?? reservedRecord.remaining_credits;

    if (failedCount > 0) {
      return {
        status: 207,
        body: {
          success: true,
          partial: true,
          message: `נשלחו ${sentCount} הודעות. ${failedCount} נכשלו. נשארו ${remaining} הודעות במכסה.`,
          sentCount,
          failedCount,
          remaining
        }
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        message: `מצויין! נשלחו ${sentCount} הודעות. נשאר לך עוד ${remaining} הודעות במכסה.`,
        sentCount,
        remaining
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
