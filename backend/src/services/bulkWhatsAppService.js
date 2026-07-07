import ActivationCode from "../models/ActivationCode.js";
import {
  buildTwilioContentVariables,
  isTwilioConfigured,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import {
  buildPublicEventLink,
  buildWhatsAppEditableTemplate,
  buildWhatsAppTemplateDefaults
} from "../utils/whatsappMessage.js";

function getTwilioContentSid() {
  const contentSid = String(process.env.TWILIO_CONTENT_SID || "").trim();
  if (!contentSid) {
    throw new Error("TWILIO_CONTENT_SID is not configured on the server");
  }
  return contentSid;
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

function resolveInviteeTemplateFields({ invitee, defaults, eventId, origin, templateBodyText }) {
  const rsvpLink = buildPublicEventLink({ eventId, origin }) || String(defaults?.rsvpLink || "").trim();
  const guestName = String(invitee.name || "אורח/ת יקר/ה").trim();

  let customOpeningText = String(
    defaults?.intro || "משפחה וחברים יקרים,\nהנכם מוזמנים לחתונה שלנו! 💍"
  ).trim();
  let eventDateTimeLocation = String(defaults?.eventDetails || "פרטי האירוע יתעדכנו בקרוב").trim();
  let closingSignOff = String(defaults?.signature ?? "").trim();

  const customText = String(templateBodyText || "")
    .replace(/\r\n/g, "\n")
    .replace(/^\s*שלום\s+(\[שם\]|[^\n,]+)\s*,?\s*\n?/u, "")
    .trim();

  if (customText) {
    const eventMarker = "האירוע יתקיים ב";
    const eventIndex = customText.indexOf(eventMarker);
    if (eventIndex >= 0) {
      const introFromCustom = customText.slice(0, eventIndex).trim();
      if (introFromCustom) customOpeningText = introFromCustom;

      let afterEvent = customText.slice(eventIndex + eventMarker.length).trim();
      const rsvpPrompt = "נשמח אם תוכלו לאשר הגעתכם בקישור המצורף:";
      const rsvpIndex = afterEvent.indexOf(rsvpPrompt);
      if (rsvpIndex >= 0) {
        const detailsFromCustom = afterEvent.slice(0, rsvpIndex).trim();
        if (detailsFromCustom) eventDateTimeLocation = detailsFromCustom;
        afterEvent = afterEvent.slice(rsvpIndex + rsvpPrompt.length).trim();
      }

      const linkLines = afterEvent
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const linkIndex = linkLines.findIndex(
        (line) => line === rsvpLink || /^https?:\/\//i.test(line) || line.includes("/event/")
      );
      if (linkIndex >= 0) {
        const signatureFromCustom = linkLines.slice(linkIndex + 1).join("\n").trim();
        if (signatureFromCustom) closingSignOff = signatureFromCustom;
      }
    }
  }

  return {
    guestName,
    customOpeningText,
    eventDateTimeLocation,
    rsvpLink,
    closingSignOff: closingSignOff || " "
  };
}

async function sendToInvitee({ invitee, templateBodyText, eventId, origin, contentSid, defaults }) {
  const to = toTwilioWhatsAppAddress(invitee.phone);
  if (!to) {
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
      templateBodyText
    });

    if (!fields.rsvpLink) {
      throw new Error("RSVP link is missing");
    }

    const contentVariables = buildTwilioContentVariables({
      guestName: fields.guestName,
      customOpeningText: fields.customOpeningText,
      eventDateTimeLocation: fields.eventDateTimeLocation,
      rsvpLink: fields.rsvpLink,
      closingSignOff: fields.closingSignOff
    });

    await sendTwilioWhatsAppMessage({
      to,
      contentSid,
      contentVariables
    });
    return { ok: true, invitee };
  } catch (error) {
    console.error(
      `[Twilio] Send failed for ${invitee.name} (${invitee.phone}):`,
      error?.code || "",
      error?.message || error
    );
    return { ok: false, invitee, error };
  }
}

export async function sendBulkWhatsApp({
  paymentCode,
  guests,
  customMessage,
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
    const defaultMessage = buildWhatsAppEditableTemplate({
      event,
      eventId: userId,
      origin
    });
    const templateBodyText = String(customMessage || "").trim() || defaultMessage;
    const contentSid = getTwilioContentSid();

    const results = await Promise.all(
      invitees.map((invitee) =>
        sendToInvitee({
          invitee,
          templateBodyText,
          eventId: userId,
          origin,
          contentSid,
          defaults
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
