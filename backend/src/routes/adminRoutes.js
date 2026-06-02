import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";

const router = express.Router();

function normalizeEventPayload(rawEvent) {
  const eventType = String(rawEvent?.eventType || "").trim();
  const groomName = String(rawEvent?.groomName || "").trim();
  const brideName = String(rawEvent?.brideName || "").trim();
  const parentName1 = String(rawEvent?.parentName1 || "").trim();
  const parentName2 = String(rawEvent?.parentName2 || "").trim();

  const baseEvent = {
    eventType,
    venueName: String(rawEvent?.venueName || "").trim(),
    city: String(rawEvent?.city || "").trim(),
    streetAndNumber: String(rawEvent?.streetAndNumber || "").trim(),
    eventDate: String(rawEvent?.eventDate || "").trim(),
    eventTime: String(rawEvent?.eventTime || "").trim(),
    imageDataUrl: String(rawEvent?.imageDataUrl || "").trim(),
    groomName,
    brideName,
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
  } else if (!normalizedEvent.eventNames) {
    return "Missing required event names";
  }

  return "";
}

function buildClientLinks(userId) {
  const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return {
    clientDashboardLink: `${baseUrl}/client/login`,
    publicEventLink: `${baseUrl}/event/${userId}`
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

router.get("/clients", async (_req, res) => {
  try {
    const users = await User.find({}, "username event createdAt payment loginPassword").sort({
      createdAt: -1
    });
    const clients = users.map((user) => {
      const links = buildClientLinks(user._id);
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

    const links = buildClientLinks(user._id);

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
    const links = buildClientLinks(user._id);
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
