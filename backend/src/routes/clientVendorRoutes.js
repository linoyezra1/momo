import express from "express";

const router = express.Router();

function coupleVendorsForbidden(_req, res) {
  return res.status(403).json({
    message: "ניהול ספקים ותקציב זמין למנהל האירוע בלבד"
  });
}

router.get("/:userId/event-vendors/catalog", coupleVendorsForbidden);
router.get("/:userId/event-vendors", coupleVendorsForbidden);
router.post("/:userId/event-vendors", coupleVendorsForbidden);
router.patch("/:userId/event-vendors/:eventVendorId", coupleVendorsForbidden);
router.delete("/:userId/event-vendors/:eventVendorId", coupleVendorsForbidden);

export default router;
