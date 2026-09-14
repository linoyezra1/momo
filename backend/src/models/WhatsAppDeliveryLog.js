import mongoose from "mongoose";

const whatsAppDeliveryLogSchema = new mongoose.Schema(
  {
    messageSid: { type: String, trim: true, required: true, unique: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      default: null,
      index: true
    },
    guestName: { type: String, trim: true, default: "" },
    guestPhone: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "read", "undelivered", "failed", "unknown"],
      default: "queued",
      index: true
    },
    errorCode: { type: String, trim: true, default: "" },
    errorMessage: { type: String, trim: true, default: "" },
    errorMessageHe: { type: String, trim: true, default: "" },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

whatsAppDeliveryLogSchema.index({ userId: 1, status: 1, failedAt: -1 });

export default mongoose.model("WhatsAppDeliveryLog", whatsAppDeliveryLogSchema);
