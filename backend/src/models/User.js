import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["חתונה", "ברית", "אחר"],
      required: true
    },
    eventNames: { type: String, required: true },
    venueName: { type: String, required: true },
    city: { type: String, required: true },
    streetAndNumber: { type: String, required: true },
    eventDate: { type: String, required: true },
    eventTime: { type: String, required: true }
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
