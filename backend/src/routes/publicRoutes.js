import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import Lead from "../models/Lead.js";
import { normalizePhone, resolveSourceAfterSelfRsvp } from "../utils/guestPhone.js";
import { recordGuestSelfUpdate } from "../services/guestAuditService.js";
import {
  STATUS_HISTORY_LABELS,
  STATUS_HISTORY_SOURCES,
  initialStatusHistoryEntry,
  statusHistoryPushEntry
} from "../utils/guestStatusHistory.js";
import { serializePublicEvent } from "../services/coverStorage.js";
import { logPerf, nowMs, setServerTiming } from "../utils/requestTiming.js";

const router = express.Router();

const PUBLIC_EVENT_SELECT =
  "event.eventType event.groomName event.brideName event.batMitzvahName event.parentName1 event.parentName2 event.eventNames event.organizerName event.conferenceBrandName event.socialHandle event.locationAddress event.parkingDetails event.websiteUrl event.venueName event.city event.streetAndNumber event.eventDate event.eventDateHebrew event.eventTime event.receptionTime event.welcomeText event.transportationEnabled event.transportationWhatsAppLink event.foodSensitivitiesEnabled event.cover event.imageDataUrl";

router.get("/event/:eventId", async (req, res) => {
  const started = nowMs();
  let mongoMs = 0;
  let serializeMs = 0;
  try {
    const { eventId } = req.params;
    const mongoStarted = nowMs();
    const user = await User.findById(eventId).select(PUBLIC_EVENT_SELECT).lean();
    mongoMs = nowMs() - mongoStarted;

    if (!user) {
      setServerTiming(res, { mongo: mongoMs, total: nowMs() - started });
      return res.status(404).json({ message: "Event not found" });
    }

    const serializeStarted = nowMs();
    const event = serializePublicEvent(user.event);
    serializeMs = nowMs() - serializeStarted;
    const payload = { eventId, event };
    const body = JSON.stringify(payload);
    const totalMs = nowMs() - started;

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.setHeader("Vary", "Accept-Encoding");
    setServerTiming(res, {
      mongo: mongoMs,
      serialize: serializeMs,
      total: totalMs
    });
    logPerf("public_event_get", {
      eventId,
      mongoMs,
      serializeMs,
      totalMs,
      bytes: Buffer.byteLength(body),
      hasCoverUrl: Boolean(event?.cover?.url),
      hasLegacyImage: Boolean(event?.imageDataUrl)
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(body);
  } catch (error) {
    setServerTiming(res, {
      mongo: mongoMs,
      serialize: serializeMs,
      total: nowMs() - started
    });
    return res.status(500).json({ message: "Failed to fetch event", error: error.message });
  }
});

router.post("/perf", express.json({ limit: "16kb" }), (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    logPerf("public_client_rum", {
      metric: body.metric || "unknown",
      eventId: body.eventId || "",
      valueMs: body.valueMs ?? null,
      ttfbMs: body.ttfbMs ?? null,
      apiMs: body.apiMs ?? null,
      coverMs: body.coverMs ?? null,
      path: body.path || "",
      size: body.size ?? null,
      loadEventMs: body.loadEventMs ?? null,
      domContentLoadedMs: body.domContentLoadedMs ?? null
    });
  } catch {
    /* ignore malformed telemetry */
  }
  return res.status(204).end();
});

router.post("/leads", async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const phoneRaw = String(req.body?.phone || "").trim();
    const eventDate = String(req.body?.eventDate || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!fullName) {
      return res.status(400).json({ message: "שם מלא הוא שדה חובה" });
    }
    if (!phoneRaw) {
      return res.status(400).json({ message: "מספר טלפון הוא שדה חובה" });
    }

    const normalizedPhone = normalizePhone(phoneRaw) || phoneRaw.replace(/\s+/g, "");
    if (normalizedPhone.length < 9) {
      return res.status(400).json({ message: "מספר טלפון לא תקין" });
    }

    const lead = await Lead.create({
      fullName,
      phone: normalizedPhone,
      eventDate,
      message,
      source: "landing"
    });

    return res.status(201).json({
      message: "הודעתכם התקבלה בהצלחה",
      leadId: lead._id
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "שמירת הפנייה נכשלה" });
  }
});

router.post("/event/:eventId/rsvp", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fullName, phone, attendeesCount, status, needsTransportation, foodSensitivities } = req.body;

    if (!fullName || !phone || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findById(eventId).select("event.transportationEnabled event.foodSensitivitiesEnabled");
    if (!user) {
      return res.status(404).json({ message: "Event not found" });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const transportEnabled = user.event?.transportationEnabled === true;
    const foodEnabled = user.event?.foodSensitivitiesEnabled === true;
    const guestTransport = transportEnabled ? needsTransportation === true : false;
    const guestFoodSensitivities =
      foodEnabled && typeof foodSensitivities === "string" ? foodSensitivities.trim() : "";

    const existing = await Guest.findOne({ userId: eventId, phone: normalizedPhone });

    if (existing) {
      const before = {
        status: existing.status,
        attendeesCount: existing.attendeesCount
      };
      const updateOps = {
        $set: {
          fullName: fullName.trim(),
          phone: normalizedPhone,
          attendeesCount: Math.max(0, Number(attendeesCount || 1)),
          status,
          confirmationMethod: "web",
          source: resolveSourceAfterSelfRsvp(existing),
          needsTransportation: guestTransport,
          foodSensitivities: guestFoodSensitivities
        }
      };
      const historyEntry = statusHistoryPushEntry({
        previousStatus: existing.status,
        nextStatus: status,
        updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.PUBLIC_LINK],
        source: STATUS_HISTORY_SOURCES.PUBLIC_LINK
      });
      if (historyEntry) {
        updateOps.$push = { statusHistory: historyEntry };
      }
      const updated = await Guest.findByIdAndUpdate(existing._id, updateOps, {
        new: true,
        runValidators: true
      });
      await recordGuestSelfUpdate({
        guest: updated,
        before,
        channel: "web"
      });
      return res.json({ message: "RSVP updated", guestId: updated._id, updated: true });
    }

    const guest = await Guest.create({
      userId: eventId,
      fullName: fullName.trim(),
      phone: normalizedPhone,
      attendeesCount: Math.max(0, Number(attendeesCount || 1)),
      status,
      confirmationMethod: "web",
      source: "form",
      needsTransportation: guestTransport,
      foodSensitivities: guestFoodSensitivities,
      statusHistory: [
        initialStatusHistoryEntry({
          status,
          updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.PUBLIC_LINK],
          source: STATUS_HISTORY_SOURCES.PUBLIC_LINK
        })
      ]
    });

    return res.status(201).json({ message: "RSVP saved", guestId: guest._id, updated: false });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save RSVP" });
  }
});

export default router;
