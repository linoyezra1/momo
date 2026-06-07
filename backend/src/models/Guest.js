import mongoose from "mongoose";

const guestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    attendeesCount: { type: Number, required: true, min: 0, default: 1 },
    giftAmount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["Joyfully Accepts", "Regretfully Declines"],
      required: true
    },
    dietaryRestrictions: {
      type: [String],
      enum: ["None", "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy"],
      default: []
    },
    dietaryNotes: { type: String, trim: true, default: "" },
    source: {
      type: String,
      enum: ["excel", "form", "manual", "excel_and_form"],
      default: "form"
    }
  },
  { timestamps: true }
);

guestSchema.index({ userId: 1, email: 1 });

export default mongoose.model("Guest", guestSchema);
