import Guest from "../models/Guest.js";
import ScheduledBroadcast from "../models/ScheduledBroadcast.js";
import User from "../models/User.js";
import { getClientBaseUrl } from "../utils/clientUrl.js";
import { resolveWhatsAppInviteParagraphs } from "../utils/whatsappInviteCopy.js";
import { mergeEventWhatsAppInviteSettings } from "../utils/whatsappInviteTemplates.js";
import { sendBulkWhatsApp } from "./bulkWhatsAppService.js";

/**
 * Parse schedule input into a real UTC Date.
 * Prefer full ISO (…Z / ±offset). datetime-local without TZ is treated as Asia/Jerusalem wall-clock.
 */
export function parseScheduledAtToUtc(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  const raw = String(value || "").trim();
  if (!raw) return null;

  // Explicit UTC / offset ISO — trust native parser.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || 0);
    return israelWallClockToUtcDate(year, month, day, hour, minute, second);
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Convert Asia/Jerusalem wall-clock components → UTC Date (handles DST). */
function israelWallClockToUtcDate(year, month, day, hour, minute, second = 0) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const asIsrael = formatPartsInTimeZone(utcGuess, "Asia/Jerusalem");
  const wanted = { year, month, day, hour, minute, second };
  const deltaMinutes =
    (wanted.year - asIsrael.year) * 525600 +
    (wanted.month - asIsrael.month) * 43200 +
    (wanted.day - asIsrael.day) * 1440 +
    (wanted.hour - asIsrael.hour) * 60 +
    (wanted.minute - asIsrael.minute) +
    (wanted.second - asIsrael.second) / 60;
  const adjusted = utcGuess + deltaMinutes * 60_000;
  // One more pass in case DST boundary shifted the offset.
  const asIsrael2 = formatPartsInTimeZone(adjusted, "Asia/Jerusalem");
  const delta2 =
    (wanted.hour - asIsrael2.hour) * 60 +
    (wanted.minute - asIsrael2.minute) +
    (wanted.day - asIsrael2.day) * 1440;
  return new Date(adjusted + delta2 * 60_000);
}

function formatPartsInTimeZone(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

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

  const when = parseScheduledAtToUtc(scheduledAt);
  if (!when) {
    const err = new Error("תאריך ושעת התזמון אינם תקינים");
    err.status = 400;
    throw err;
  }
  const nowMs = Date.now();
  if (when.getTime() <= nowMs + 30_000) {
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

  console.log(
    `[scheduledBroadcast] created id=${doc._id} event=${user._id} ` +
      `status=PENDING scheduledAt=${when.toISOString()} now=${new Date(nowMs).toISOString()} ` +
      `inMs=${when.getTime() - nowMs} recipients=${guests.length} ` +
      `rawInput=${JSON.stringify(String(scheduledAt || ""))}`
  );

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
  const dueQuery = {
    status: "PENDING",
    scheduledAt: { $lte: now }
  };

  const [pendingCount, due, nextPending] = await Promise.all([
    ScheduledBroadcast.countDocuments({ status: "PENDING" }),
    ScheduledBroadcast.find(dueQuery).sort({ scheduledAt: 1 }).limit(20).exec(),
    ScheduledBroadcast.findOne({ status: "PENDING" })
      .sort({ scheduledAt: 1 })
      .select("_id scheduledAt status eventId")
      .lean()
      .exec()
  ]);

  const nextAt = nextPending?.scheduledAt
    ? new Date(nextPending.scheduledAt).toISOString()
    : "-";
  const nextInMs = nextPending?.scheduledAt
    ? new Date(nextPending.scheduledAt).getTime() - now.getTime()
    : null;

  console.log(
    `[scheduledBroadcast] tick now=${now.toISOString()} ` +
      `pending=${pendingCount} due=${due.length} ` +
      `nextAt=${nextAt} nextInMs=${nextInMs ?? "-"} ` +
      `query=${JSON.stringify({ status: "PENDING", scheduledAt: { $lte: now.toISOString() } })}`
  );

  if (due.length) {
    console.log(
      `[scheduledBroadcast] Processing ${due.length} pending task${due.length === 1 ? "" : "s"}…`
    );
  }

  const results = [];
  const baseOrigin = origin || getClientBaseUrl() || "https://momoevent.up.railway.app";

  for (const job of due) {
    console.log(
      `[scheduledBroadcast] claiming id=${job._id} event=${job.eventId} ` +
        `scheduledAt=${job.scheduledAt ? new Date(job.scheduledAt).toISOString() : "-"}`
    );
    const claimed = await ScheduledBroadcast.findOneAndUpdate(
      { _id: job._id, status: "PENDING" },
      { $set: { status: "PROCESSING" } },
      { new: true }
    );
    if (!claimed) {
      console.warn(`[scheduledBroadcast] skip id=${job._id} — already claimed/cancelled`);
      continue;
    }

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
