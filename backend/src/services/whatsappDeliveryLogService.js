import Guest from "../models/Guest.js";
import WhatsAppDeliveryLog from "../models/WhatsAppDeliveryLog.js";
import WhatsAppSenderLink from "../models/WhatsAppSenderLink.js";
import { normalizePhone, phoneLookupVariants } from "../utils/guestPhone.js";
import { translateWhatsAppError } from "../utils/whatsappDeliveryErrors.js";
import {
  DEFAULT_INBOUND_COST_USD,
  isBillableMessageStatus,
  isFailedMessageStatus,
  parseTwilioPrice,
  resolveActualCostUsd
} from "../utils/twilioMessageBilling.js";

function cleanPhone(phone) {
  return String(phone || "")
    .replace(/^whatsapp:/i, "")
    .trim();
}

function setCostFields(target, actualCostUsd, priceUnit = "USD") {
  const amount = Math.max(0, Number(actualCostUsd) || 0);
  target.actualCost = amount;
  target.cost = amount;
  target.costUsd = amount;
  target.priceUnit = String(priceUnit || "USD").trim().toUpperCase() || "USD";
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

async function resolveUserIdForPhone(phone) {
  const cleaned = cleanPhone(phone);
  const variants = phoneLookupVariants(cleaned);
  if (!variants.length) return null;

  const guest = await Guest.findOne({ phone: { $in: variants } })
    .sort({ lastWhatsAppSentAt: -1, updatedAt: -1 })
    .select("userId");
  if (guest?.userId) return guest.userId;

  const link = await WhatsAppSenderLink.findOne({
    senderPhone: { $in: variants },
    status: "active",
    linkedUserId: { $ne: null }
  }).select("linkedUserId");

  return link?.linkedUserId || null;
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
        eventId: userId,
        guestId: guest?._id || guestId || null,
        guestName: String(guest?.fullName || guestName || "").trim(),
        guestPhone: normalizePhone(guest?.phone || guestPhone) || cleanPhone(guestPhone),
        direction: "outbound",
        status: "queued",
        actualCost: 0,
        cost: 0,
        costUsd: 0,
        priceUnit: "USD",
        isBilled: false,
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

/**
 * Inbound WhatsApp is billed by Twilio. Attribute to guest event or active sender link.
 * Price is often absent on the inbound webhook — use DEFAULT_INBOUND_COST_USD until known.
 */
export async function recordWhatsAppInbound({
  messageSid,
  from,
  userId: hintedUserId = null,
  guestId = null,
  guestName = "",
  price = null,
  priceUnit = "USD"
} = {}) {
  const sid = String(messageSid || "").trim();
  if (!sid) return null;

  const phone = cleanPhone(from);
  const guest =
    (guestId ? await Guest.findById(guestId) : null) ||
    (await findGuestForDelivery({ userId: hintedUserId, phone }));

  const userId = hintedUserId || guest?.userId || (await resolveUserIdForPhone(phone));
  if (!userId) {
    console.warn(
      `[Twilio billing] inbound ${sid} skipped — no client match (from=${from || "?"})`
    );
    return null;
  }

  const actualCost =
    resolveActualCostUsd({ price, fallbackUsd: DEFAULT_INBOUND_COST_USD }) ??
    DEFAULT_INBOUND_COST_USD;

  const setFields = {
    userId,
    eventId: userId,
    guestId: guest?._id || guestId || null,
    guestName: String(guest?.fullName || guestName || "").trim(),
    guestPhone: normalizePhone(guest?.phone || phone) || phone,
    direction: "inbound",
    status: "delivered",
    isBilled: true,
    sentAt: new Date()
  };
  setCostFields(setFields, actualCost, priceUnit);

  return WhatsAppDeliveryLog.findOneAndUpdate(
    { messageSid: sid },
    {
      $setOnInsert: {
        messageSid: sid,
        ...setFields
      },
      ...(parseTwilioPrice(price) != null
        ? {
            $set: {
              actualCost: setFields.actualCost,
              cost: setFields.cost,
              costUsd: setFields.costUsd,
              priceUnit: setFields.priceUnit,
              isBilled: true
            }
          }
        : {})
    },
    { upsert: true, new: true }
  );
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
  if (!sid || !isFailedMessageStatus(status)) return null;

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

  const userId =
    hintedUserId || existing?.userId || guest?.userId || (await resolveUserIdForPhone(to || from));
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
        eventId: userId,
        guestId: guest?._id || guestId || existing?.guestId || null,
        guestName: String(guest?.fullName || guestName || existing?.guestName || "").trim(),
        guestPhone:
          normalizePhone(guest?.phone || existing?.guestPhone || to) || cleanPhone(to),
        direction: existing?.direction || "outbound",
        status,
        actualCost: 0,
        cost: 0,
        costUsd: 0,
        isBilled: false,
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

function applyBillingFields(log, { price, priceUnit } = {}) {
  if (!log) return log;
  if (isFailedMessageStatus(log.status)) {
    setCostFields(log, 0, priceUnit);
    log.isBilled = false;
    return log;
  }
  if (!isBillableMessageStatus(log.status)) {
    log.isBilled = false;
    return log;
  }

  log.isBilled = true;
  const twilioPrice = parseTwilioPrice(price);
  if (twilioPrice != null) {
    setCostFields(log, twilioPrice, priceUnit);
  }
  // If Price is missing, keep any previously stored actualCost (do not invent).
  return log;
}

/** Advance an existing outbound log to sent / delivered / read and apply Twilio Price. */
export async function recordWhatsAppDeliveryProgress({
  messageSid,
  messageStatus,
  price,
  priceUnit,
  to,
  from
} = {}) {
  const sid = String(messageSid || "").trim();
  const status = String(messageStatus || "").trim().toLowerCase();
  const nextRank = DELIVERY_PROGRESS_RANK[status];
  if (!sid || !nextRank) return null;

  let existing = await WhatsAppDeliveryLog.findOne({ messageSid: sid });

  // Late status callback before our outbound insert finished — try to attach to a client.
  if (!existing && isBillableMessageStatus(status)) {
    const userId = await resolveUserIdForPhone(to || from);
    if (userId) {
      existing = await WhatsAppDeliveryLog.findOneAndUpdate(
        { messageSid: sid },
        {
          $setOnInsert: {
            messageSid: sid,
            userId,
            eventId: userId,
            guestPhone: cleanPhone(to || from),
            direction: "outbound",
            status: "queued",
            actualCost: 0,
            cost: 0,
            costUsd: 0,
            priceUnit: "USD",
            isBilled: false,
            sentAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }
  }

  if (!existing) return null;
  if (isFailedMessageStatus(existing.status)) return existing;

  const currentRank = DELIVERY_PROGRESS_RANK[existing.status] || 0;
  if (currentRank < nextRank) {
    existing.status = status;
  }

  if (!existing.eventId && existing.userId) {
    existing.eventId = existing.userId;
  }

  applyBillingFields(existing, { price, priceUnit });
  await existing.save();
  return existing;
}

/**
 * Unified status-callback handler: failed → zero cost; sent/delivered/read → bill with Price.
 */
export async function applyWhatsAppMessageStatus({
  messageSid,
  messageStatus,
  price,
  priceUnit,
  errorCode,
  errorMessage,
  to,
  from
} = {}) {
  const status = String(messageStatus || "").trim().toLowerCase();

  if (isFailedMessageStatus(status)) {
    return recordWhatsAppDeliveryFailure({
      messageSid,
      messageStatus: status,
      errorCode,
      errorMessage,
      to,
      from
    });
  }

  if (DELIVERY_PROGRESS_RANK[status]) {
    return recordWhatsAppDeliveryProgress({
      messageSid,
      messageStatus: status,
      price,
      priceUnit,
      to,
      from
    });
  }

  return null;
}

const syncCooldownUntil = new Map();
const billingSyncCooldownUntil = new Map();

/**
 * Backfill / refresh WhatsAppDeliveryLog costs from Twilio Message history.
 * Matches by guest phone, couple contactPhone, or existing messageSid.
 * When userId is set — only that client; otherwise all clients.
 */
export async function syncWhatsAppBillingFromTwilio({
  userId = null,
  force = false,
  days = 120,
  limit = 3000
} = {}) {
  const scopeKey = userId ? `user:${userId}` : "all";
  const now = Date.now();
  if (!force && (billingSyncCooldownUntil.get(scopeKey) || 0) > now) {
    return {
      updated: 0,
      created: 0,
      scanned: 0,
      matched: 0,
      skipped: true,
      reason: "cooldown"
    };
  }

  const { getTwilioClient, isTwilioConfigured, toTwilioWhatsAppAddress } = await import(
    "../utils/twilioWhatsApp.js"
  );
  if (!isTwilioConfigured()) {
    return {
      updated: 0,
      created: 0,
      scanned: 0,
      matched: 0,
      skipped: true,
      reason: "twilio_not_configured"
    };
  }

  const guestQuery = { phone: { $ne: "" } };
  if (userId) guestQuery.userId = userId;
  const guests = await Guest.find(guestQuery).select("fullName phone userId lastWhatsAppSentAt");

  /** @type {Map<string, { userId: any, guest: any }>} */
  const byTwilioAddress = new Map();
  for (const guest of guests) {
    const address = toTwilioWhatsAppAddress(guest.phone);
    if (!address) continue;
    const current = byTwilioAddress.get(address);
    const guestStamp = new Date(guest.lastWhatsAppSentAt || 0).getTime();
    const currentStamp = new Date(current?.guest?.lastWhatsAppSentAt || 0).getTime();
    if (!current || guestStamp >= currentStamp) {
      byTwilioAddress.set(address, { userId: guest.userId, guest });
    }
  }

  const User = (await import("../models/User.js")).default;
  const userQuery = userId ? { _id: userId } : { contactPhone: { $ne: "" } };
  const users = await User.find(userQuery).select("_id contactPhone");
  for (const user of users) {
    const address = toTwilioWhatsAppAddress(user.contactPhone);
    if (!address || byTwilioAddress.has(address)) continue;
    byTwilioAddress.set(address, { userId: user._id, guest: null });
  }

  const client = getTwilioClient();
  const lookbackDays = Math.min(Math.max(Number(days) || 120, 1), 365);
  const dateSentAfter = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const fetchLimit = Math.min(Math.max(Number(limit) || 3000, 100), 5000);
  const messages = await client.messages.list({
    dateSentAfter,
    pageSize: 100,
    limit: fetchLimit
  });

  const whatsappMessages = messages.filter((message) => {
    const from = String(message.from || "").toLowerCase();
    const to = String(message.to || "").toLowerCase();
    return from.startsWith("whatsapp:") || to.startsWith("whatsapp:");
  });

  let updated = 0;
  let created = 0;
  let matched = 0;

  for (const message of whatsappMessages) {
    const sid = String(message.sid || "").trim();
    if (!sid) continue;

    const status = String(message.status || "").trim().toLowerCase();
    const toAddr = String(message.to || "");
    const fromAddr = String(message.from || "");
    const directionRaw = String(message.direction || "").toLowerCase();

    let resolved = byTwilioAddress.get(toAddr) || byTwilioAddress.get(fromAddr) || null;
    let existing = await WhatsAppDeliveryLog.findOne({ messageSid: sid });

    if (!resolved && existing?.userId) {
      if (userId && String(existing.userId) !== String(userId)) continue;
      resolved = { userId: existing.userId, guest: null };
    }

    if (!resolved?.userId) continue;
    if (userId && String(resolved.userId) !== String(userId)) continue;

    matched += 1;
    const guest = resolved.guest;
    const wasNew = !existing;

    if (isFailedMessageStatus(status)) {
      const saved = await recordWhatsAppDeliveryFailure({
        messageSid: sid,
        messageStatus: status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        to: toAddr,
        from: fromAddr,
        userId: resolved.userId,
        guestId: guest?._id || existing?.guestId,
        guestName: guest?.fullName || existing?.guestName,
        sentAt: message.dateSent || message.dateCreated,
        failedAt: message.dateUpdated || message.dateSent || message.dateCreated
      });
      if (saved) {
        if (wasNew) created += 1;
        else updated += 1;
      }
      continue;
    }

    const direction =
      directionRaw.includes("inbound")
        ? "inbound"
        : directionRaw.includes("outbound")
          ? "outbound"
          : byTwilioAddress.has(fromAddr)
            ? "inbound"
            : "outbound";

    const billable = isBillableMessageStatus(status) || status === "queued";
    const twilioPrice = parseTwilioPrice(message.price);
    const isBilled = isBillableMessageStatus(status);
    const actualCost = isBilled
      ? twilioPrice != null
        ? twilioPrice
        : direction === "inbound"
          ? DEFAULT_INBOUND_COST_USD
          : existing?.actualCost || existing?.costUsd || 0
      : 0;

    const guestPhone =
      normalizePhone(guest?.phone || existing?.guestPhone || (direction === "inbound" ? fromAddr : toAddr)) ||
      cleanPhone(direction === "inbound" ? fromAddr : toAddr);

    const setPayload = {
      messageSid: sid,
      userId: resolved.userId,
      eventId: resolved.userId,
      guestId: guest?._id || existing?.guestId || null,
      guestName: String(guest?.fullName || existing?.guestName || "").trim(),
      guestPhone,
      direction: existing?.direction || direction,
      status: billable || isFailedMessageStatus(status) ? status : existing?.status || status,
      isBilled,
      priceUnit: String(message.priceUnit || "USD").trim().toUpperCase() || "USD",
      sentAt: message.dateSent || message.dateCreated || existing?.sentAt || new Date()
    };

    if (isFailedMessageStatus(status)) {
      setPayload.actualCost = 0;
      setPayload.cost = 0;
      setPayload.costUsd = 0;
      setPayload.isBilled = false;
    } else if (isBilled) {
      setPayload.actualCost = actualCost;
      setPayload.cost = actualCost;
      setPayload.costUsd = actualCost;
    } else if (twilioPrice != null) {
      // Keep price if Twilio already priced a non-terminal status
      setPayload.actualCost = twilioPrice;
      setPayload.cost = twilioPrice;
      setPayload.costUsd = twilioPrice;
    }

    if (message.errorCode) {
      const translated = translateWhatsAppError({
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      });
      setPayload.errorCode = translated.errorCode;
      setPayload.errorMessage = translated.errorMessage;
      setPayload.errorMessageHe = translated.errorMessageHe;
    }

    const saved = await WhatsAppDeliveryLog.findOneAndUpdate(
      { messageSid: sid },
      { $set: setPayload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (saved) {
      if (wasNew) created += 1;
      else updated += 1;
    }
  }

  billingSyncCooldownUntil.set(scopeKey, Date.now() + 2 * 60 * 1000);
  return {
    updated,
    created,
    scanned: messages.length,
    whatsappScanned: whatsappMessages.length,
    matched,
    skipped: false,
    days: lookbackDays
  };
}

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
