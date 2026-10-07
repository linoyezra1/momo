import Guest from "../models/Guest.js";
import ScheduledBroadcast from "../models/ScheduledBroadcast.js";
import User from "../models/User.js";
import { getClientBaseUrl } from "../utils/clientUrl.js";
import { resolveWhatsAppInviteParagraphs } from "../utils/whatsappInviteCopy.js";
import { mergeEventWhatsAppInviteSettings } from "../utils/whatsappInviteTemplates.js";
import { sendBulkWhatsApp } from "./bulkWhatsAppService.js";

export function serializeScheduledBroadcast(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(raw._id),
    eventId: String(raw.eventId),
    templateId: raw.templateId || "standard",
    messagePayload: {
      welcomeParagraph: raw.messagePayload?.welcomeParagraph || "",
      eventDetailsParagraph: raw.messagePayload?.eventDetailsParagraph || "",
      closingParagraph: raw.messagePayload?.closingParagraph || "",
      paymentCode: raw.messagePayload?.paymentCode || ""
    },
    recipientList: (raw.recipientList || []).map((id) => String(id)),
    recipientCount: Number(raw.recipientCount || raw.recipientList?.length || 0),
    scheduledAt: raw.scheduledAt ? new Date(raw.scheduledAt).toISOString() : null,
    status: raw.status || "PENDING",
    createdByAdminId: raw.createdByAdminId || "admin",
    sentCount: Number(raw.sentCount || 0),
    lastError: raw.lastError || "",
    resultMessage: raw.resultMessage || "",
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null
  };
}

function previewMessageText(messagePayload = {}, templateId = "") {
  const parts = [
    String(messagePayload.welcomeParagraph || "").trim(),
    String(messagePayload.eventDetailsParagraph || "").trim(),
    String(messagePayload.closingParagraph || "").trim()
  ].filter(Boolean);
  const body = parts.join(" · ");
  const label = templateId ? `[${templateId}] ` : "";
  if (!body) return `${label}הודעת הזמנה`.trim();
  return `${label}${body}`.trim().slice(0, 180);
}

export function serializeScheduledBroadcastForUi(doc) {
  const base = serializeScheduledBroadcast(doc);
  if (!base) return null;
  return {
    ...base,
    messagePreview: previewMessageText(base.messagePayload, base.templateId)
  };
}

/**
 * Create a PENDING scheduled bulk WhatsApp send (admin / impersonation only).
 */
export async function createScheduledBroadcast({
  eventId,
  guestIds,
  paymentCode,
  scheduledAt,
  createdByAdminId = "admin"
}) {
  const userId = String(eventId || "").trim();
  if (!/^[a-f\d]{24}$/i.test(userId)) {
    const err = new Error("eventId לא תקין");
    err.status = 400;
    throw err;
  }

  const when = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (!when || Number.isNaN(when.getTime())) {
    const err = new Error("תאריך ושעת התזמון אינם תקינים");
    err.status = 400;
    throw err;
  }
  if (when.getTime() <= Date.now() + 30_000) {
    const err = new Error("יש לבחור מועד שליחה לפחות 30 שניות מהרגע");
    err.status = 400;
    throw err;
  }

  const code = String(paymentCode || "").trim();
  if (!code) {
    const err = new Error("יש להזין קוד רכישה");
    err.status = 400;
    throw err;
  }

  const ids = Array.isArray(guestIds) ? guestIds.map((id) => String(id).trim()).filter(Boolean) : [];
  if (!ids.length) {
    const err = new Error("יש לבחור לפחות מוזמן אחד לתזמון");
    err.status = 400;
    throw err;
  }

  const user = await User.findById(userId).select("event deal");
  if (!user) {
    const err = new Error("הלקוח / האירוע לא נמצא");
    err.status = 404;
    throw err;
  }

  const guests = await Guest.find({ userId, _id: { $in: ids } }).select("_id");
  if (guests.length !== ids.length) {
    const err = new Error("חלק מהמוזמנים שנבחרו לא נמצאו ברשימה");
    err.status = 400;
    throw err;
  }

  const event = mergeEventWhatsAppInviteSettings(
    user.event?.toObject ? user.event.toObject() : { ...(user.event || {}) },
    user.deal
  );
  const paragraphs = resolveWhatsAppInviteParagraphs(event);

  const doc = await ScheduledBroadcast.create({
    eventId: user._id,
    templateId: event.whatsappInviteTemplate || "standard",
    messagePayload: {
      welcomeParagraph: paragraphs.welcomeParagraph || "",
      eventDetailsParagraph: paragraphs.eventDetailsParagraph || "",
      closingParagraph: paragraphs.closingParagraph || "",
      paymentCode: code
    },
    recipientList: guests.map((g) => g._id),
    recipientCount: guests.length,
    scheduledAt: when,
    status: "PENDING",
    createdByAdminId: String(createdByAdminId || "admin").trim() || "admin"
  });

  return serializeScheduledBroadcastForUi(doc);
}

export async function listScheduledBroadcastsForEvent(eventId, { includeTerminal = true } = {}) {
  const userId = String(eventId || "").trim();
  if (!/^[a-f\d]{24}$/i.test(userId)) {
    const err = new Error("eventId לא תקין");
    err.status = 400;
    throw err;
  }

  const statusFilter = includeTerminal
    ? { $in: ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"] }
    : { $in: ["PENDING", "PROCESSING"] };

  const rows = await ScheduledBroadcast.find({
    eventId: userId,
    status: statusFilter
  })
    .sort({ scheduledAt: 1 })
    .limit(50)
    .lean()
    .exec();

  return rows.map(serializeScheduledBroadcastForUi);
}

export async function cancelScheduledBroadcast({ scheduleId, impersonationUserId = null }) {
  const id = String(scheduleId || "").trim();
  if (!/^[a-f\d]{24}$/i.test(id)) {
    const err = new Error("מזהה תזמון לא תקין");
    err.status = 400;
    throw err;
  }

  const doc = await ScheduledBroadcast.findById(id);
  if (!doc) {
    const err = new Error("התזמון לא נמצא");
    err.status = 404;
    throw err;
  }

  if (impersonationUserId && String(doc.eventId) !== String(impersonationUserId)) {
    const err = new Error("אין הרשאה לבטל תזמון של אירוע אחר");
    err.status = 403;
    throw err;
  }

  if (doc.status !== "PENDING") {
    const err = new Error("ניתן לבטל רק תזמון בסטטוס ממתין (PENDING)");
    err.status = 400;
    throw err;
  }

  doc.status = "CANCELLED";
  await doc.save();
  return serializeScheduledBroadcastForUi(doc);
}

/**
 * Claim due PENDING jobs → PROCESSING, run sendBulkWhatsApp, finalize status.
 */
export async function processDueScheduledBroadcasts({ origin } = {}) {
  const now = new Date();
  const due = await ScheduledBroadcast.find({
    status: "PENDING",
    scheduledAt: { $lte: now }
  })
    .sort({ scheduledAt: 1 })
    .limit(20)
    .exec();

  const results = [];
  const baseOrigin = origin || getClientBaseUrl() || "https://momoevent.up.railway.app";

  for (const job of due) {
    const claimed = await ScheduledBroadcast.findOneAndUpdate(
      { _id: job._id, status: "PENDING" },
      { $set: { status: "PROCESSING" } },
      { new: true }
    );
    if (!claimed) continue;

    try {
      const user = await User.findById(claimed.eventId).select(
        "event deal.includedFeatures.isPremiumWhatsappButtonsEnabled deal.includedFeatures.isPremiumWhatsappCardEnabled deal.includedFeatures.whatsappInviteTemplate"
      );
      if (!user) {
        claimed.status = "FAILED";
        claimed.lastError = "הלקוח / האירוע לא נמצא";
        await claimed.save();
        results.push({ id: String(claimed._id), ok: false, reason: "user_not_found" });
        continue;
      }

      const guestIds = (claimed.recipientList || []).map((id) => String(id));
      const guests = await Guest.find({
        userId: claimed.eventId,
        _id: { $in: guestIds }
      });

      if (!guests.length) {
        claimed.status = "FAILED";
        claimed.lastError = "לא נמצאו מוזמנים לשליחה";
        await claimed.save();
        results.push({ id: String(claimed._id), ok: false, reason: "no_guests" });
        continue;
      }

      const event = mergeEventWhatsAppInviteSettings(
        user.event?.toObject ? user.event.toObject() : { ...(user.event || {}) },
        user.deal
      );

      const result = await sendBulkWhatsApp({
        paymentCode: claimed.messagePayload?.paymentCode || "",
        guests,
        event,
        userId: claimed.eventId,
        origin: baseOrigin
      });

      const body = result?.body || {};
      const ok = result?.status < 400 && body.success !== false;
      claimed.status = ok ? "COMPLETED" : "FAILED";
      claimed.sentCount = Number(body.sentCount || 0);
      claimed.resultMessage = String(body.message || "").trim();
      claimed.lastError = ok ? "" : String(body.message || "שליחה נכשלה").trim();
      await claimed.save();

      results.push({
        id: String(claimed._id),
        ok,
        sentCount: claimed.sentCount,
        status: claimed.status
      });
      console.log(
        `[scheduledBroadcast] id=${claimed._id} event=${claimed.eventId} ` +
          `ok=${ok} sent=${claimed.sentCount} status=${claimed.status}`
      );
    } catch (error) {
      claimed.status = "FAILED";
      claimed.lastError = error?.message || "שגיאה בעיבוד תזמון";
      await claimed.save().catch(() => {});
      results.push({ id: String(claimed._id), ok: false, reason: "exception" });
      console.error(
        `[scheduledBroadcast] id=${claimed._id} failed:`,
        error?.message || error
      );
    }
  }

  return results;
}

export function startScheduledBroadcastScheduler(intervalMs = 60_000) {
  const tick = () => {
    processDueScheduledBroadcasts().catch((error) => {
      console.error("[scheduledBroadcast] sweep failed:", error?.message || error);
    });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  console.log(`[scheduledBroadcast] scheduler started (every ${intervalMs}ms)`);
  return timer;
}
