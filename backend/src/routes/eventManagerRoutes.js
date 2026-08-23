import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import EventVendor from "../models/EventVendor.js";
import { buildClientUrl } from "../utils/clientUrl.js";
import { normalizeEventPayload, normalizePaymentPayload, validateEvent } from "../utils/eventPayload.js";
import { isConferenceEventType } from "../utils/eventTypeWording.js";
import { applyCoverToEventPayload, clearEventCover, uploadAndAttachCover } from "../utils/eventCover.js";
import { coverUpload } from "../middleware/coverUpload.js";
import { isCoverStorageConfigured } from "../services/coverStorage.js";
import { normalizePhone } from "../utils/guestPhone.js";
import {
  applyCouplePassword,
  buildCouplePasswordFields,
  normalizeLoginPassword,
  normalizeLoginUsername
} from "../utils/loginCredentials.js";
import { sendEventManagerWelcomeWhatsApp } from "../services/eventManagerWelcomeWhatsApp.js";
import {
  requireEventManager,
  signEventManagerToken,
  validateEventManagerCredentials,
  verifyEventManagerToken
} from "../middleware/eventManagerAuth.js";

const router = express.Router();

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  const validation = validateEventManagerCredentials(username, password);
  if (validation.reason === "not_configured") {
    return res.status(503).json({ message: "התחברות מנהל אירועים לא מוגדרת בשרת" });
  }
  if (!validation.ok) {
    return res.status(401).json({ message: "שם משתמש או סיסמה שגויים" });
  }

  try {
    const token = signEventManagerToken();
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create event manager session" });
  }
});

router.get("/session", (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!verifyEventManagerToken(token)) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true, role: "eventManager" });
});

router.use(requireEventManager);

function buildClientLinks(userId, req) {
  return {
    clientDashboardLink: buildClientUrl("/client/login", req),
    publicEventLink: buildClientUrl(`/event/${userId}`, req)
  };
}

router.get("/clients", async (req, res) => {
  try {
    const users = await User.find(
      { managedBy: "eventManager" },
      "username event createdAt payment loginPassword managedBy contactPhone"
    ).sort({
      createdAt: -1
    });

    const userIds = users.map((user) => user._id);

    const [guestAgg, vendorAgg] = await Promise.all([
      userIds.length
        ? Guest.aggregate([
            { $match: { userId: { $in: userIds } } },
            {
              $group: {
                _id: "$userId",
                totalInvited: { $sum: { $max: ["$attendeesCount", 0] } },
                totalComing: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["מגיע", "הגיע לאירוע"]] },
                      { $max: ["$attendeesCount", 0] },
                      0
                    ]
                  }
                },
                guestCount: { $sum: 1 }
              }
            }
          ])
        : [],
      userIds.length
        ? EventVendor.aggregate([
            { $match: { eventId: { $in: userIds } } },
            {
              $group: {
                _id: "$eventId",
                vendorCount: { $sum: 1 },
                bookedCount: {
                  $sum: { $cond: [{ $eq: ["$status", "BOOKED"] }, 1, 0] }
                },
                totalQuote: {
                  $sum: {
                    $max: [{ $ifNull: ["$vendorQuoteAmount", "$quoteAmount"] }, 0]
                  }
                }
              }
            }
          ])
        : []
    ]);

    const guestByUser = new Map(guestAgg.map((row) => [String(row._id), row]));
    const vendorByUser = new Map(vendorAgg.map((row) => [String(row._id), row]));

    const clients = users.map((user) => {
      const links = buildClientLinks(user._id, req);
      const payment = normalizePaymentPayload(user.payment || {});
      const guestStats = guestByUser.get(String(user._id));
      const vendorStats = vendorByUser.get(String(user._id));
      return {
        userId: user._id,
        username: user.username,
        loginPassword: user.loginPassword || "",
        contactPhone: user.contactPhone || "",
        event: user.event,
        payment,
        managedBy: user.managedBy,
        createdAt: user.createdAt,
        stats: {
          totalInvited: Number(guestStats?.totalInvited) || 0,
          totalComing: Number(guestStats?.totalComing) || 0,
          guestCount: Number(guestStats?.guestCount) || 0,
          vendorCount: Number(vendorStats?.vendorCount) || 0,
          bookedVendors: Number(vendorStats?.bookedCount) || 0,
          totalVendorQuote: Number(vendorStats?.totalQuote) || 0
        },
        ...links
      };
    });
    return res.json({ clients });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load clients", error: error.message });
  }
});

router.post("/create-client", async (req, res) => {
  try {
    if (req.body?.deal != null || req.body?.includedFeatures != null) {
      return res.status(403).json({
        message: "הפעלת פיצ׳רים וקופונים זמינה למנהל המערכת בלבד"
      });
    }
    const { username, password, event, contactPhone } = req.body;

    const normalizedUsername = normalizeLoginUsername(username);
    if (!normalizedUsername || !normalizeLoginPassword(password) || !event) {
      return res.status(400).json({ message: "יש למלא שם משתמש וסיסמה" });
    }
    const { plainPassword, passwordHash } = await buildCouplePasswordFields(password, bcrypt);
    const normalizedEvent = await applyCoverToEventPayload(normalizeEventPayload(event), {});
    const eventValidationError = validateEvent(normalizedEvent);
    if (eventValidationError) {
      return res.status(400).json({ message: eventValidationError });
    }

    const rawPhone = String(contactPhone || req.body?.bridePhone || "").trim();
    const phone = normalizePhone(rawPhone) || rawPhone;
    if (!phone) {
      return res.status(400).json({ message: "יש להזין מספר טלפון של הכלה (איש קשר)" });
    }

    const existing = await User.findOne({ username: normalizedUsername });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const user = await User.create({
      username: normalizedUsername,
      passwordHash,
      loginPassword: plainPassword,
      contactPhone: phone,
      event: normalizedEvent,
      managedBy: "eventManager"
    });

    const links = buildClientLinks(user._id, req);

    let welcomeWhatsApp = { sent: false, reason: "skipped_conference" };
    if (!isConferenceEventType(normalizedEvent.eventType)) {
      welcomeWhatsApp = await sendEventManagerWelcomeWhatsApp({
        contactPhone: phone,
        brideName: normalizedEvent.brideName || normalizedEvent.eventNames,
        username: user.username,
        password: plainPassword,
        dashboardUrl: links.clientDashboardLink,
        invitationUrl: links.publicEventLink,
        userId: user._id,
        senderLabel: user.username
      });
    }

    return res.status(201).json({
      userId: user._id,
      ...links,
      credentials: { username: user.username, password: plainPassword },
      welcomeWhatsApp: {
        sent: Boolean(welcomeWhatsApp.sent),
        reason: welcomeWhatsApp.reason || null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create client", error: error.message });
  }
});

router.patch("/clients/:userId", async (req, res) => {
  try {
    if (req.body?.deal != null || req.body?.includedFeatures != null) {
      return res.status(403).json({
        message: "הפעלת פיצ׳רים וקופונים זמינה למנהל המערכת בלבד"
      });
    }
    const { userId } = req.params;
    const { username, password, event, contactPhone } = req.body;

    const user = await User.findOne({ _id: userId, managedBy: "eventManager" });
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (username) {
      const nextUsername = normalizeLoginUsername(username);
      if (nextUsername && nextUsername !== user.username) {
        const existing = await User.findOne({ username: nextUsername }).select("_id");
        if (existing) {
          return res.status(409).json({ message: "Username already exists" });
        }
        user.username = nextUsername;
      }
    }

    if (password) {
      try {
        await applyCouplePassword(user, password, bcrypt);
      } catch {
        return res.status(400).json({ message: "סיסמה אינה תקינה" });
      }
    }

    if (contactPhone != null || req.body?.bridePhone != null) {
      const rawPhone = String(contactPhone || req.body?.bridePhone || "").trim();
      user.contactPhone = normalizePhone(rawPhone) || rawPhone;
    }

    if (event) {
      const previousEvent = user.event?.toObject
        ? user.event.toObject()
        : { ...(user.event || {}) };
      const normalizedEvent = await applyCoverToEventPayload(
        normalizeEventPayload(event),
        previousEvent,
        { clearCover: event?.clearCover === true }
      );
      const eventValidationError = validateEvent(normalizedEvent);
      if (eventValidationError) {
        return res.status(400).json({ message: eventValidationError });
      }
      user.event = {
        ...normalizedEvent,
        maxPhoneRounds: Number(previousEvent.maxPhoneRounds) || 0,
        isPremiumWhatsappButtonsEnabled: Boolean(previousEvent.isPremiumWhatsappButtonsEnabled),
        welcomeParagraph: previousEvent.welcomeParagraph || "",
        eventDetailsParagraph: previousEvent.eventDetailsParagraph || "",
        closingParagraph: previousEvent.closingParagraph || ""
      };
    }

    await user.save();
    const links = buildClientLinks(user._id, req);
    return res.json({
      message: "Client updated",
      userId: user._id,
      username: user.username,
      loginPassword: user.loginPassword || "",
      contactPhone: user.contactPhone || "",
      ...links
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update client", error: error.message });
  }
});

router.delete("/clients/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOneAndDelete({ _id: userId, managedBy: "eventManager" });
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    return res.json({ message: "Client deleted", userId });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete client", error: error.message });
  }
});

router.post("/clients/:userId/event/cover", coverUpload.single("cover"), async (req, res) => {
  try {
    if (!isCoverStorageConfigured()) {
      return res.status(503).json({
        message:
          "אחסון תמונות לא מוגדר. יש להגדיר CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ו-CLOUDINARY_API_SECRET"
      });
    }
    const user = await User.findOne({ _id: req.params.userId, managedBy: "eventManager" });
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const cover = await uploadAndAttachCover(user, req.file);
    return res.json({ message: "תמונת הקאבר הועלתה בהצלחה", cover, event: user.event });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "העלאת התמונה נכשלה" });
  }
});

router.delete("/clients/:userId/event/cover", async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, managedBy: "eventManager" });
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    await clearEventCover(user);
    return res.json({ message: "תמונת הקאבר הוסרה", event: user.event });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "מחיקת התמונה נכשלה" });
  }
});

export default router;
