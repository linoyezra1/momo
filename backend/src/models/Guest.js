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
    phone: { type: String, required: true, trim: true },
    attendeesCount: { type: Number, required: true, min: 0, default: 1 },
    status: {
      type: String,
      enum: ["מגיע", "לא מגיע", "אולי", "לא ידוע"],
      required: true
    },
    source: {
      type: String,
      enum: ["excel", "form", "manual"],
      default: "manual"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Guest", guestSchema);
