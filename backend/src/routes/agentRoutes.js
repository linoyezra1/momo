import express from "express";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import {
  requireAgent,
  signAgentToken,
  validateAgentCredentials,
  verifyAgentToken
} from "../middleware/agentAuth.js";

const router = express.Router();

function buildEventLabel(event) {
  if (!event) return "אירוע ללא שם";
  if (event.eventType === "חתונה") {
    return `${event.groomName || ""} ו${event.brideName || ""}`.trim() || "חתונה";
  }
  if (event.eventType === "ברית") {
    return `${event.parentName1 || ""} ו${event.parentName2 || ""}`.trim() || "ברית";
  }
  if (event.eventType === "בת מצווה") {
    return event.batMitzvahName || event.parentName1 || "בת מצווה";
  }
  return event.eventNames || event.eventType || "אירוע";
}

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  const validation = validateAgentCredentials(username, password);
  if (validation.reason === "not_configured") {
    return res.status(503).json({ message: "התחברות נציג לא מוגדרת בשרת" });
  }
  if (!validation.ok) {
    return res.status(401).json({ message: "שם משתמש או סיסמה שגויים" });
  }

  try {
    const token = signAgentToken();
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create agent session" });
  }
});

router.get("/session", (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!verifyAgentToken(token)) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true });
});

router.use(requireAgent);

router.get("/clients", async (_req, res) => {
  try {
    const users = await User.find({}, "username event createdAt").sort({ createdAt: -1 });
    const clients = users.map((user) => ({
      userId: user._id,
      username: user.username,
      eventLabel: buildEventLabel(user.event),
      eventType: user.event?.eventType || "",
      eventDate: user.event?.eventDate || ""
    }));
    return res.json({ clients });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load clients", error: error.message });
  }
});

router.get("/:userId/guests", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event username");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const guests = await Guest.find({ userId }).sort({ fullName: 1 });
    return res.json({
      userId,
      username: user.username,
      event: user.event,
      eventLabel: buildEventLabel(user.event),
      guests
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load guests", error: error.message });
  }
});

router.patch("/:userId/guests/:guestId/phone-rsvp", async (req, res) => {
  try {
    const { userId, guestId } = req.params;
    const { currentCallRound, callStatus, agentNotes, status, attendeesCount } = req.body;

    const round = Number(currentCallRound);
    if (![1, 2].includes(round)) {
      return res.status(400).json({ message: "יש לבחור סבב שיחה (1 או 2)" });
    }

    if (!["answered", "no_answer"].includes(callStatus)) {
      return res.status(400).json({ message: "יש לבחור סטטוס שיחה (ענה / לא ענה)" });
    }

    const update = {
      currentCallRound: round,
      callStatus,
      agentNotes: String(agentNotes ?? "").trim(),
      callTimestamp: new Date()
    };

    const hasStatusUpdate =
      callStatus === "answered" &&
      typeof status !== "undefined" &&
      status !== null &&
      String(status).trim() !== "";

    if (hasStatusUpdate) {
      const nextStatus = String(status).trim();
      if (!["מגיע", "לא מגיע", "אולי"].includes(nextStatus)) {
        return res.status(400).json({ message: "סטטוס הגעה לא תקין" });
      }

      update.status = nextStatus;
      update.confirmationMethod = "phone";

      if (nextStatus === "מגיע") {
        const rawCount = attendeesCount;
        const parsed =
          rawCount === undefined || rawCount === null || rawCount === ""
            ? 1
            : Math.max(1, Number(rawCount));
        update.attendeesCount = Number.isNaN(parsed) ? 1 : parsed;
      } else if (nextStatus === "לא מגיע") {
        update.attendeesCount = 0;
      } else if (
        attendeesCount !== undefined &&
        attendeesCount !== null &&
        attendeesCount !== "" &&
        !Number.isNaN(Number(attendeesCount))
      ) {
        update.attendeesCount = Math.max(1, Number(attendeesCount));
      }
    }

    const guest = await Guest.findOneAndUpdate({ _id: guestId, userId }, update, {
      new: true,
      runValidators: true
    });

    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    return res.json({ message: "Phone RSVP saved", guest });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save phone RSVP" });
  }
});

export default router;
