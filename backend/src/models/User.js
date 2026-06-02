import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["חתונה", "ברית", "אחר"],
      required: true
    },
    groomName: { type: String, trim: true, default: "" },
    brideName: { type: String, trim: true, default: "" },
    parentName1: { type: String, trim: true, default: "" },
    parentName2: { type: String, trim: true, default: "" },
    familyName: { type: String, trim: true, default: "" },
    eventNames: { type: String, trim: true, default: "" },
    venueName: { type: String, required: true },
    city: { type: String, required: true },
    streetAndNumber: { type: String, required: true },
    eventDate: { type: String, required: true },
    eventTime: { type: String, required: true },
    imageDataUrl: { type: String, default: "" }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    event: { type: eventSchema, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
