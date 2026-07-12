import express from "express";
import SeatingTemplate from "../models/SeatingTemplate.js";
import { verifyAdminToken } from "../middleware/adminAuth.js";
import { verifyEventManagerToken } from "../middleware/eventManagerAuth.js";

const router = express.Router();

function resolveOwnerFromAuth(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (verifyAdminToken(token)) return "admin";
  if (verifyEventManagerToken(token)) return "eventManager";
  return null;
}

/** List templates for a role, or all if no filter. */
router.get("/", async (req, res) => {
  try {
    const ownerRole = String(req.query.ownerRole || "").trim();
    const filter = ownerRole === "admin" || ownerRole === "eventManager" ? { ownerRole } : {};
    const templates = await SeatingTemplate.find(filter)
      .select("name ownerRole tables venueElements createdAt updatedAt")
      .sort({ updatedAt: -1 });
    return res.json({
      templates: templates.map((item) => ({
        _id: item._id,
        name: item.name,
        ownerRole: item.ownerRole,
        tableCount: item.tables?.length || 0,
        tables: item.tables,
        venueElements: item.venueElements,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load templates" });
  }
});

router.get("/:templateId", async (req, res) => {
  try {
    const template = await SeatingTemplate.findById(req.params.templateId);
    if (!template) return res.status(404).json({ message: "Template not found" });
    return res.json({
      template: {
        _id: template._id,
        name: template.name,
        ownerRole: template.ownerRole,
        tables: template.tables,
        venueElements: template.venueElements
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load template" });
  }
});

router.post("/", async (req, res) => {
  try {
    const ownerFromAuth = resolveOwnerFromAuth(req);
    const requestedOwner = String(req.body?.ownerRole || "").trim();
    const ownerRole = ownerFromAuth || (requestedOwner === "eventManager" ? "eventManager" : "admin");

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "יש להזין שם לתבנית" });
    }

    const tables = Array.isArray(req.body?.tables) ? req.body.tables : [];
    const venueElements = Array.isArray(req.body?.venueElements) ? req.body.venueElements : [];

    const template = await SeatingTemplate.create({
      name,
      ownerRole,
      tables,
      venueElements
    });

    return res.status(201).json({
      message: "התבנית נשמרה",
      template: {
        _id: template._id,
        name: template.name,
        ownerRole: template.ownerRole,
        tables: template.tables,
        venueElements: template.venueElements
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to save template" });
  }
});

router.delete("/:templateId", async (req, res) => {
  try {
    const ownerFromAuth = resolveOwnerFromAuth(req);
    const template = await SeatingTemplate.findById(req.params.templateId);
    if (!template) return res.status(404).json({ message: "Template not found" });

    if (ownerFromAuth && template.ownerRole !== ownerFromAuth) {
      return res.status(403).json({ message: "אין הרשאה למחוק תבנית זו" });
    }

    await SeatingTemplate.findByIdAndDelete(req.params.templateId);
    return res.json({ message: "התבנית נמחקה" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete template" });
  }
});

export default router;
