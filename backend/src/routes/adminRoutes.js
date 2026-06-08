import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import ActivationCode from "../models/ActivationCode.js";
import { buildClientUrl } from "../utils/clientUrl.js";

const router = express.Router();

function normalizeEventPayload(rawEvent) {
  const eventType = String(rawEvent?.eventType || "").trim();
  const groomName = String(rawEvent?.groomName || "").trim();
  const brideName = String(rawEvent?.brideName || "").trim();
  const batMitzvahName = String(rawEvent?.batMitzvahName || "").trim();
  const parentName1 = String(rawEvent?.parentName1 || "").trim();
  const parentName2 = String(rawEvent?.parentName2 || "").trim();

  const baseEvent = {
    eventType,
    venueName: String(rawEvent?.venueName || "").trim(),
    city: String(rawEvent?.city || "").trim(),
    streetAndNumber: String(rawEvent?.streetAndNumber || "").trim(),
    eventDate: String(rawEvent?.eventDate || "").trim(),
    eventDateHebrew:
      eventType === "ברית" ? String(rawEvent?.eventDateHebrew || "").trim() : "",
    eventTime: String(rawEvent?.eventTime || "").trim(),
    imageDataUrl: String(rawEvent?.imageDataUrl || "").trim(),
    groomName,
    brideName,
    batMitzvahName,
    parentName1,
    parentName2
  };

  if (eventType === "חתונה") {
    return {
      ...baseEvent,
      eventNames: `${groomName} & ${brideName}`.trim()
    };
  }

  if (eventType === "ברית") {
    return {
      ...baseEvent,
      eventNames: `${parentName1} ו${parentName2}`.trim()
    };
  }

  if (eventType === "בת מצווה") {
    return {
      ...baseEvent,
      eventNames: batMitzvahName
    };
  }

  return {
    ...baseEvent,
    eventNames: String(rawEvent?.eventNames || "").trim()
  };
}

function validateEvent(normalizedEvent) {
  if (!normalizedEvent.eventType || !normalizedEvent.venueName || !normalizedEvent.city || !normalizedEvent.streetAndNumber || !normalizedEvent.eventDate || !normalizedEvent.eventTime) {
    return "Missing required event fields";
  }

  if (normalizedEvent.eventType === "חתונה") {
    if (!normalizedEvent.groomName || !normalizedEvent.brideName) {
      return "Missing required wedding names";
    }
  } else if (normalizedEvent.eventType === "ברית") {
    if (!normalizedEvent.parentName1 || !normalizedEvent.parentName2) {
      return "Missing required brit names";
    }
  } else if (normalizedEvent.eventType === "בת מצווה") {
    if (!normalizedEvent.batMitzvahName || !normalizedEvent.parentName1) {
      return "Missing required bat mitzvah names";
    }
  } else if (!normalizedEvent.eventNames) {
    return "Missing required event names";
  }

  return "";
}

function buildClientLinks(userId, req) {
  return {
    clientDashboardLink: buildClientUrl("/client/login", req),
    publicEventLink: buildClientUrl(`/event/${userId}`, req)
  };
}

function normalizePaymentPayload(rawPayment) {
  const amountRaw = rawPayment?.amountPaid;
  let amountPaid = 0;
  if (amountRaw !== "" && amountRaw != null && !Number.isNaN(Number(amountRaw))) {
    amountPaid = Math.max(0, Number(amountRaw));
  }
  const paymentMethod =
    rawPayment?.paymentMethod == null ? "" : String(rawPayment.paymentMethod).trim();
  return { amountPaid, paymentMethod };
}

router.get("/clients", async (req, res) => {
  try {
    const users = await User.find({}, "username event createdAt payment loginPassword").sort({
      createdAt: -1
    });
    const clients = users.map((user) => {
      const links = buildClientLinks(user._id, req);
      const payment = normalizePaymentPayload(user.payment || {});
      return {
        userId: user._id,
        username: user.username,
        loginPassword: user.loginPassword || "",
        event: user.event,
        payment,
        createdAt: user.createdAt,
        ...links
      };
    });
    const totalRevenue = clients.reduce((sum, client) => sum + (client.payment?.amountPaid || 0), 0);
    return res.json({ clients, totalRevenue });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load clients", error: error.message });
  }
});

router.post("/create-client", async (req, res) => {
  try {
    const { username, password, event } = req.body;

    if (!username || !password || !event) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const normalizedEvent = normalizeEventPayload(event);
    const eventValidationError = validateEvent(normalizedEvent);
    if (eventValidationError) {
      return res.status(400).json({ message: eventValidationError });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: username.trim(),
      passwordHash,
      loginPassword: String(password),
      event: normalizedEvent
    });

    const links = buildClientLinks(user._id, req);

    return res.status(201).json({
      userId: user._id,
      ...links,
      credentials: { username, password }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create client", error: error.message });
  }
});

router.patch("/clients/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, password, event } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (username && username.trim() !== user.username) {
      const existing = await User.findOne({ username: username.trim() }).select("_id");
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      user.username = username.trim();
    }

    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
      user.loginPassword = String(password);
    }

    if (event) {
      const normalizedEvent = normalizeEventPayload(event);
      const eventValidationError = validateEvent(normalizedEvent);
      if (eventValidationError) {
        return res.status(400).json({ message: eventValidationError });
      }
      user.event = normalizedEvent;
    }

    await user.save();
    const links = buildClientLinks(user._id, req);
    return res.json({
      message: "Client updated",
      userId: user._id,
      username: user.username,
      loginPassword: user.loginPassword || "",
      ...links
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update client", error: error.message });
  }
});

router.patch("/clients/:userId/payment", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    user.payment = normalizePaymentPayload(req.body);
    await user.save();

    return res.json({
      message: "Payment updated",
      userId: user._id,
      payment: user.payment
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update payment" });
  }
});

router.get("/activation-codes", async (req, res) => {
  try {
    const codes = await ActivationCode.find().sort({ createdAt: -1 });
    return res.json({ codes });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load activation codes", error: error.message });
  }
});

router.post("/activation-codes", async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const totalCredits = Math.max(1, Number(req.body?.total_credits || req.body?.totalCredits || 0));
    const note = String(req.body?.note || "").trim();
    const userId = req.body?.userId || req.body?.redeemedByUserId || null;

    if (!code) {
      return res.status(400).json({ message: "יש להזין קוד רכישה" });
    }

    const existing = await ActivationCode.findOne({ code });
    if (existing) {
      return res.status(409).json({ message: "קוד זה כבר קיים במערכת" });
    }

    const activationCode = await ActivationCode.create({
      code,
      total_credits: totalCredits,
      remaining_credits: totalCredits,
      note,
      redeemedByUserId: userId || null
    });

    return res.status(201).json({ message: "קוד רכישה נוצר בהצלחה", code: activationCode });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create activation code" });
  }
});

router.get("/clients/:userId/whatsapp-quota", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id username");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const codeRecord = await ActivationCode.findOne({
      redeemedByUserId: userId,
      isActive: true
    }).sort({ updatedAt: -1 });

    return res.json({
      quota: codeRecord
        ? {
            codeId: codeRecord._id,
            code: codeRecord.code,
            total_credits: codeRecord.total_credits,
            remaining_credits: codeRecord.remaining_credits,
            note: codeRecord.note || ""
          }
        : null
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load client quota" });
  }
});

router.post("/clients/:userId/whatsapp-quota", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id username");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const totalCredits = Math.max(1, Number(req.body?.total_credits || req.body?.totalCredits || 0));
    const requestedCode = String(req.body?.code || "").trim().toUpperCase();
    const note = String(req.body?.note || "").trim() || `לקוח: ${user.username}`;

    let codeRecord = await ActivationCode.findOne({
      redeemedByUserId: userId,
      isActive: true
    }).sort({ updatedAt: -1 });

    if (codeRecord) {
      codeRecord.total_credits = totalCredits;
      codeRecord.remaining_credits = totalCredits;
      if (note) codeRecord.note = note;
      await codeRecord.save();
      return res.json({
        message: `מכסת הוואטסאפ עודכנה ל-${totalCredits} הודעות`,
        quota: {
          codeId: codeRecord._id,
          code: codeRecord.code,
          total_credits: codeRecord.total_credits,
          remaining_credits: codeRecord.remaining_credits,
          note: codeRecord.note || ""
        }
      });
    }

    const code =
      requestedCode ||
      `MOMO-${String(user.username || "CLIENT")
        .replace(/[^A-Z0-9]/gi, "")
        .slice(0, 8)
        .toUpperCase()}-${totalCredits}`;

    const duplicate = await ActivationCode.findOne({ code });
    if (duplicate) {
      return res.status(409).json({ message: "קוד זה כבר קיים. הזינו קוד אחר." });
    }

    codeRecord = await ActivationCode.create({
      code,
      total_credits: totalCredits,
      remaining_credits: totalCredits,
      note,
      redeemedByUserId: userId
    });

    return res.status(201).json({
      message: `הוקצה קוד ${code} עם ${totalCredits} הודעות`,
      quota: {
        codeId: codeRecord._id,
        code: codeRecord.code,
        total_credits: codeRecord.total_credits,
        remaining_credits: codeRecord.remaining_credits,
        note: codeRecord.note || ""
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to assign client quota" });
  }
});

router.patch("/activation-codes/:codeId", async (req, res) => {
  try {
    const { codeId } = req.params;
    const codeRecord = await ActivationCode.findById(codeId);
    if (!codeRecord) {
      return res.status(404).json({ message: "קוד לא נמצא" });
    }

    if (typeof req.body?.isActive === "boolean") {
      codeRecord.isActive = req.body.isActive;
    }
    if (req.body?.remaining_credits != null && !Number.isNaN(Number(req.body.remaining_credits))) {
      const nextRemaining = Math.max(0, Number(req.body.remaining_credits));
      codeRecord.remaining_credits = nextRemaining;
      if (nextRemaining > codeRecord.total_credits) {
        codeRecord.total_credits = nextRemaining;
      }
    }
    if (req.body?.note != null) {
      codeRecord.note = String(req.body.note).trim();
    }

    await codeRecord.save();
    return res.json({ message: "קוד עודכן", code: codeRecord });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update activation code" });
  }
});

router.delete("/clients/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    await Guest.deleteMany({ userId });
    return res.json({ message: "Client deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete client" });
  }
});

export default router;
