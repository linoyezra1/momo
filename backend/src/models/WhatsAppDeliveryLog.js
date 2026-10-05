import mongoose from "mongoose";

const whatsAppDeliveryLogSchema = new mongoose.Schema(
  {
    messageSid: { type: String, trim: true, required: true, unique: true, index: true },
    /** Couple / event owner (in momoEVENT the User doc owns the event). */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    /** Same as userId — explicit event/client link for billing queries. */
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      default: "outbound",
      index: true
    },
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "read", "undelivered", "failed", "unknown"],
      default: "queued",
      index: true
    },
    /**
     * Actual USD amount Twilio charged (abs(Price)), e.g. 0.0353.
     * Mirrored on `cost` / `costUsd` for older readers.
     */
    actualCost: { type: Number, min: 0, default: 0 },
    cost: { type: Number, min: 0, default: 0 },
    costUsd: { type: Number, min: 0, default: 0 },
    priceUnit: { type: String, trim: true, default: "USD" },
    /** True when status is sent/delivered/read (or inbound) — Twilio bills these. */
    isBilled: { type: Boolean, default: false, index: true },
    errorCode: { type: String, trim: true, default: "" },
    errorMessage: { type: String, trim: true, default: "" },
    errorMessageHe: { type: String, trim: true, default: "" },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

whatsAppDeliveryLogSchema.index({ userId: 1, status: 1, failedAt: -1 });
whatsAppDeliveryLogSchema.index({ userId: 1, isBilled: 1 });
whatsAppDeliveryLogSchema.index({ eventId: 1, isBilled: 1 });

export default mongoose.model("WhatsAppDeliveryLog", whatsAppDeliveryLogSchema);
