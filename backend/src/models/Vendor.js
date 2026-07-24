import mongoose from "mongoose";

export const VENDOR_CATEGORIES = [
  "אולם / גן אירועים",
  "קייטרינג",
  "צלם",
  "וידאו",
  "דיג'יי / מוזיקה",
  "פרחים / עיצוב",
  "איפור ושיער",
  "שמלות / חליפות",
  "הפקה",
  "אחר"
];

const MAX_CATEGORY_LEN = 80;

/** Preset or free-text when "אחר" (+ optional customCategory). */
export function resolveVendorCategory(body = {}) {
  const preset = String(body.category || "אחר").trim() || "אחר";
  const custom = String(body.customCategory || "").trim();

  let category = preset;
  if (preset === "אחר" && custom) {
    category = custom;
  } else if (!VENDOR_CATEGORIES.includes(preset)) {
    // Already a free-text value stored on the vendor
    category = preset;
  }

  category = category.slice(0, MAX_CATEGORY_LEN).trim();
  return category || "אחר";
}

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      trim: true,
      default: "אחר",
      maxlength: MAX_CATEGORY_LEN,
      index: true
    },
    contactName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

vendorSchema.index({ name: 1 });
vendorSchema.index({ createdAt: -1 });

export default mongoose.model("Vendor", vendorSchema);
