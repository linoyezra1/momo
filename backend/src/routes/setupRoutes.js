import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { normalizeSetupPayload, validateSetupPayload } from "../utils/usEvent.js";
import { buildClientUrl } from "../utils/clientUrl.js";

const router = express.Router();

router.post("/setup", async (req, res) => {
  try {
    const payload = normalizeSetupPayload(req.body);
    const validationError = validateSetupPayload(payload);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingOrder = await User.findOne({ etsyOrderId: payload.etsyOrderId }).select("_id");
    if (existingOrder) {
      return res.status(409).json({ message: "This Etsy order ID has already been used" });
    }

    let slug = payload.slug;
    let slugAttempt = 0;
    while (await User.findOne({ slug }).select("_id")) {
      slugAttempt += 1;
      const suffix = `-${slugAttempt}`;
      const base = payload.slug.slice(0, Math.max(3, 60 - suffix.length));
      slug = `${base}${suffix}`;
    }
    payload.slug = slug;

    const existingEmail = await User.findOne({ contactEmail: payload.contactEmail }).select("_id");
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const username = payload.contactEmail;
    const password = payload.contactEmail;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      passwordHash,
      loginPassword: password,
      etsyOrderId: payload.etsyOrderId,
      slug: payload.slug,
      contactEmail: payload.contactEmail,
      market: "us",
      event: payload.event
    });

    const eventUrl = buildClientUrl(`/e/${user.slug}`, req);
    const clientDashboardUrl = buildClientUrl("/client/login", req);

    return res.status(201).json({
      message: "Your wedding invitation is ready",
      eventId: user._id,
      slug: user.slug,
      eventUrl,
      credentials: {
        username,
        password
      },
      clientDashboardUrl
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This email, slug, or Etsy order ID is already in use" });
    }
    return res.status(500).json({ message: error.message || "Failed to complete setup" });
  }
});

export default router;
