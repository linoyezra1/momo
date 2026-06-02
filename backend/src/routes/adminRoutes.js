import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

router.post("/create-client", async (req, res) => {
  try {
    const { username, password, event } = req.body;

    if (!username || !password || !event) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: username.trim(),
      passwordHash,
      event
    });

    const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";

    return res.status(201).json({
      userId: user._id,
      clientDashboardLink: `${baseUrl}/client/login`,
      publicEventLink: `${baseUrl}/event/${user._id}`,
      credentials: { username, password }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create client", error: error.message });
  }
});

export default router;
