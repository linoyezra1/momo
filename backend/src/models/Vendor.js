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

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: VENDOR_CATEGORIES,
      default: "אחר",
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
