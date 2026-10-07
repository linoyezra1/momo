import mongoose from "mongoose";

/**
 * Hall / venue catalog for autocomplete (name → city + street).
 */
const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    nameNormalized: { type: String, required: true, trim: true, unique: true, index: true },
    city: { type: String, trim: true, default: "" },
    streetAndNumber: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    usageCount: { type: Number, default: 1, min: 0 }
  },
  { timestamps: true }
);

export function normalizeVenueName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export default mongoose.model("Venue", venueSchema);
