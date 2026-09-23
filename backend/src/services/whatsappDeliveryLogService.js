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
  from,
  userId: hintedUserId = null,
  guestId = null,
  guestName = "",
  sentAt = null,
  failedAt = null
} = {}) {
  const sid = String(messageSid || "").trim();
  const status = String(messageStatus || "").trim().toLowerCase();
  if (!sid || (status !== "undelivered" && status !== "failed")) return null;

  const translated = translateWhatsAppError({ errorCode, errorMessage });
  const failedStamp = failedAt ? new Date(failedAt) : new Date();
  const sentStamp = sentAt ? new Date(sentAt) : failedStamp;
  const existing = await WhatsAppDeliveryLog.findOne({ messageSid: sid });

  let guest = guestId ? await Guest.findById(guestId) : null;
  if (!guest && existing?.guestId) {
    guest = await Guest.findById(existing.guestId);
  }
  if (!guest) {
    guest = await findGuestForDelivery({
      userId: hintedUserId || existing?.userId,
      phone: to || existing?.guestPhone
    });
  }

  const userId = hintedUserId || existing?.userId || guest?.userId;
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
        messageSid: sid,
        userId,
        guestId: guest?._id || guestId || existing?.guestId || null,
        guestName: String(guest?.fullName || guestName || existing?.guestName || "").trim(),
        guestPhone:
          normalizePhone(guest?.phone || existing?.guestPhone || to) || cleanPhone(to),
        status,
        errorCode: translated.errorCode,
        errorMessage: translated.errorMessage,
        errorMessageHe: translated.errorMessageHe,
        failedAt: Number.isNaN(failedStamp.getTime()) ? new Date() : failedStamp,
        sentAt: Number.isNaN(sentStamp.getTime()) ? failedStamp : sentStamp
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (guest) {
    guest.whatsappDeliveryStatus = "failed";
    guest.whatsappErrorCode = translated.errorCode;
    guest.lastWhatsAppMessageSid = sid;
    await guest.save();
  }

  return log;
}

const DELIVERY_PROGRESS_RANK = {
  queued: 1,
  sent: 2,
  delivered: 3,
  read: 4
};

/** Advance an existing outbound log to sent / delivered / read. Failures are never overwritten. */
export async function recordWhatsAppDeliveryProgress({ messageSid, messageStatus } = {}) {
  const sid = String(messageSid || "").trim();
  const status = String(messageStatus || "").trim().toLowerCase();
  const nextRank = DELIVERY_PROGRESS_RANK[status];
  if (!sid || !nextRank) return null;

  const existing = await WhatsAppDeliveryLog.findOne({ messageSid: sid });
  if (!existing) return null;
  if (existing.status === "failed" || existing.status === "undelivered") return existing;

  const currentRank = DELIVERY_PROGRESS_RANK[existing.status] || 0;
  if (currentRank >= nextRank) return existing;

  existing.status = status;
  await existing.save();
  return existing;
}

const syncCooldownUntil = new Map();

export async function syncWhatsAppFailuresFromTwilio({ userId, force = false } = {}) {
  const key = String(userId || "");
  if (!key) return { imported: 0, scanned: 0, skipped: true };

  const now = Date.now();
  if (!force && (syncCooldownUntil.get(key) || 0) > now) {
    return { imported: 0, scanned: 0, skipped: true, reason: "cooldown" };
  }

  const { getTwilioClient, isTwilioConfigured, toTwilioWhatsAppAddress } = await import(
    "../utils/twilioWhatsApp.js"
  );
  if (!isTwilioConfigured()) {
    return { imported: 0, scanned: 0, skipped: true, reason: "twilio_not_configured" };
  }

  const guests = await Guest.find({
    userId,
    phone: { $ne: "" }
  }).select("fullName phone lastWhatsAppSentAt whatsappRoundsSentCount reminderRound");

  const guestsByPhone = new Map();
  for (const guest of guests) {
    const address = toTwilioWhatsAppAddress(guest.phone);
    if (!address) continue;
    const current = guestsByPhone.get(address);
    const guestStamp = new Date(guest.lastWhatsAppSentAt || 0).getTime();
    const currentStamp = new Date(current?.lastWhatsAppSentAt || 0).getTime();
    if (!current || guestStamp >= currentStamp) guestsByPhone.set(address, guest);
  }

  if (!guestsByPhone.size) {
    syncCooldownUntil.set(key, now + 2 * 60 * 1000);
    return { imported: 0, scanned: 0, skipped: false };
  }

  const client = getTwilioClient();
  const dateSentAfter = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const messages = await client.messages.list({
    dateSentAfter,
    pageSize: 100,
    limit: 1500
  });

  const failed = messages
    .filter((message) => {
      const status = String(message.status || "").toLowerCase();
      if (status !== "failed" && status !== "undelivered") return false;
      if (!String(message.from || "").toLowerCase().startsWith("whatsapp:")) return false;
      return guestsByPhone.has(String(message.to || ""));
    })
    .sort((a, b) => new Date(a.dateSent || 0) - new Date(b.dateSent || 0));

  let imported = 0;
  for (const message of failed) {
    const guest = guestsByPhone.get(String(message.to || ""));
    const saved = await recordWhatsAppDeliveryFailure({
      messageSid: message.sid,
      messageStatus: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      to: message.to,
      from: message.from,
      userId,
      guestId: guest?._id,
      guestName: guest?.fullName,
      sentAt: message.dateSent || message.dateCreated,
      failedAt: message.dateUpdated || message.dateSent || message.dateCreated
    });
    if (saved) imported += 1;
  }

  syncCooldownUntil.set(key, Date.now() + 2 * 60 * 1000);
  return { imported, scanned: messages.length, matched: failed.length, skipped: false };
}
