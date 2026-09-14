import Guest from "../models/Guest.js";
import WhatsAppDeliveryLog from "../models/WhatsAppDeliveryLog.js";
import { normalizePhone, phoneLookupVariants } from "../utils/guestPhone.js";
import { translateWhatsAppError } from "../utils/whatsappDeliveryErrors.js";

function cleanPhone(phone) {
  return String(phone || "")
    .replace(/^whatsapp:/i, "")
    .trim();
}

async function findGuestForDelivery({ guestId, userId, phone }) {
  if (guestId) {
    const byId = await Guest.findById(guestId);
    if (byId) return byId;
  }

  const variants = phoneLookupVariants(cleanPhone(phone));
  if (!variants.length) return null;

  const query = { phone: { $in: variants } };
  if (userId) query.userId = userId;

  return Guest.findOne(query).sort({ lastWhatsAppSentAt: -1, updatedAt: -1 });
}

export async function recordWhatsAppOutbound({
  messageSid,
  userId,
  guestId = null,
  guestName = "",
  guestPhone = ""
} = {}) {
  const sid = String(messageSid || "").trim();
  if (!sid || !userId) return null;

  const guest = await findGuestForDelivery({ guestId, userId, phone: guestPhone });
  const sentAt = new Date();

  const log = await WhatsAppDeliveryLog.findOneAndUpdate(
    { messageSid: sid },
    {
      $setOnInsert: {
        messageSid: sid,
        userId,
        guestId: guest?._id || guestId || null,
        guestName: String(guest?.fullName || guestName || "").trim(),
        guestPhone: normalizePhone(guest?.phone || guestPhone) || cleanPhone(guestPhone),
        status: "queued",
        sentAt
      }
    },
    { upsert: true, new: true }
  );

  if (guest) {
    guest.lastWhatsAppMessageSid = sid;
    if (!guest.whatsappDeliveryStatus) {
      guest.whatsappDeliveryStatus = "sent";
    }
    await guest.save();
  }

  return log;
}

export async function recordWhatsAppDeliveryFailure({
  messageSid,
  messageStatus,
  errorCode,
  errorMessage,
  to,
  from
} = {}) {
  const sid = String(messageSid || "").trim();
  const status = String(messageStatus || "").trim().toLowerCase();
  if (!sid || (status !== "undelivered" && status !== "failed")) return null;

  const translated = translateWhatsAppError({ errorCode, errorMessage });
  const failedAt = new Date();
  const existing = await WhatsAppDeliveryLog.findOne({ messageSid: sid });

  let guest = existing?.guestId
    ? await Guest.findById(existing.guestId)
    : null;
  if (!guest) {
    guest = await findGuestForDelivery({
      userId: existing?.userId,
      phone: to || existing?.guestPhone
    });
  }

  const userId = existing?.userId || guest?.userId;
  if (!userId) {
    console.warn(
      `[Twilio status] ${status} for ${sid} but no event match (to=${to || "?"} from=${from || "?"})`
    );
    return null;
  }

  const log = await WhatsAppDeliveryLog.findOneAndUpdate(
    { messageSid: sid },
    {
      $set: {
        userId,
        guestId: guest?._id || existing?.guestId || null,
        guestName: String(guest?.fullName || existing?.guestName || "").trim(),
        guestPhone:
          normalizePhone(guest?.phone || existing?.guestPhone || to) || cleanPhone(to),
        status,
        errorCode: translated.errorCode,
        errorMessage: translated.errorMessage,
        errorMessageHe: translated.errorMessageHe,
        failedAt
      },
      $setOnInsert: {
        messageSid: sid,
        sentAt: failedAt
      }
    },
    { upsert: true, new: true }
  );

  if (guest) {
    guest.whatsappDeliveryStatus = "failed";
    guest.whatsappErrorCode = translated.errorCode;
    guest.lastWhatsAppMessageSid = sid;
    await guest.save();
  }

  return log;
}
