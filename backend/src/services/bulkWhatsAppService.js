import ActivationCode from "../models/ActivationCode.js";
import {
  isTwilioConfigured,
  sendTwilioWhatsAppMessage,
  toTwilioWhatsAppAddress
} from "../utils/twilioWhatsApp.js";
import { buildGuestWhatsAppMessage, personalizeWhatsAppMessage } from "../utils/whatsappMessage.js";

function normalizePaymentCode(rawCode) {
  return String(rawCode || "").trim().toUpperCase();
}

function buildInsufficientCreditsMessage(codeRecord) {
  return `קנית מכסה בסך של ${codeRecord.total_credits} הודעות. נשארו לך ${codeRecord.remaining_credits} הודעות לניצול. מצטערים, נא לנסות שוב עם בחירה של עד ${codeRecord.remaining_credits} מוזמנים.`;
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
  await ActivationCode.findByIdAndUpdate(codeId, { $inc: { remaining_credits: count } });
}

export async function sendBulkWhatsApp({
  paymentCode,
  guests,
  customMessage,
  event,
  userId,
  origin
}) {
  if (!isTwilioConfigured()) {
    return {
      status: 503,
      body: { message: "שירות שליחת וואטסאפ לא מוגדר בשרת. פנו למנהל המערכת." }
    };
  }

  if (!Array.isArray(guests) || guests.length === 0) {
    return { status: 400, body: { message: "יש לבחור לפחות מוזמן אחד לשליחה" } };
  }

  const { codeRecord, error: codeError } = await findValidCodeRecord(paymentCode);
  if (codeError === "missing_code") {
    return { status: 400, body: { message: "יש להזין קוד רכישה" } };
  }
  if (codeError === "invalid_code") {
    return { status: 404, body: { message: "קוד לא תקין, אנא בדוק שוב." } };
  }
  if (codeError === "expired_code") {
    return { status: 400, body: { message: "קוד הרכישה פג תוקף. פנו למנהל המערכת." } };
  }

  const invitees = guests
    .map((guest) => ({
      guestId: guest._id,
      name: String(guest.fullName || "").trim(),
      phone: guest.phone
    }))
    .filter((guest) => guest.name && guest.phone);

  if (!invitees.length) {
    return { status: 400, body: { message: "לא נמצאו מוזמנים תקינים לשליחה" } };
  }

  const requestedCount = invitees.length;
  const reservation = await reserveCredits(codeRecord, requestedCount);
  if (!reservation.ok) {
    return { status: 400, body: { message: reservation.message } };
  }

  const reservedRecord = reservation.codeRecord;
  const defaultMessage = buildGuestWhatsAppMessage({
    event,
    eventId: userId,
    origin
  });
  const messageTemplate = String(customMessage || "").trim() || `שלום [שם],\n\n${defaultMessage}`;

  try {
    const sendPromises = invitees.map((invitee) => {
      const to = toTwilioWhatsAppAddress(invitee.phone);
      if (!to) {
        throw new Error(`מספר טלפון לא תקין עבור ${invitee.name}`);
      }
      const body = personalizeWhatsAppMessage(messageTemplate, invitee.name);
      return sendTwilioWhatsAppMessage({ to, body });
    });

    await Promise.all(sendPromises);

    if (!reservedRecord.redeemedByUserId) {
      reservedRecord.redeemedByUserId = userId;
      await reservedRecord.save();
    }

    return {
      status: 200,
      body: {
        message: `מצויין! נשלחו ${requestedCount} הודעות. נשאר לך עוד ${reservedRecord.remaining_credits} הודעות במכסה.`,
        sentCount: requestedCount,
        remaining: reservedRecord.remaining_credits
      }
    };
  } catch (sendError) {
    await releaseCredits(reservedRecord._id, requestedCount);
    console.error("Twilio bulk send error:", sendError);
    return {
      status: 500,
      body: {
        message: "שגיאה פנימית בשליחת ההודעות, אנא נסה שוב מאוחר יותר.",
        detail: sendError?.message || "Unknown Twilio error"
      }
    };
  }
}
