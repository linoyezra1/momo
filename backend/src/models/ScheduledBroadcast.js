import mongoose from "mongoose";

/**
 * Admin-only scheduled WhatsApp bulk invite (created while impersonating a couple).
 */
const scheduledBroadcastSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    templateId: { type: String, trim: true, default: "standard" },
    messagePayload: {
      welcomeParagraph: { type: String, trim: true, default: "" },
      eventDetailsParagraph: { type: String, trim: true, default: "" },
      closingParagraph: { type: String, trim: true, default: "" },
      paymentCode: { type: String, trim: true, default: "" }
    },
    recipientList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Guest"
      }
    ],
    recipientCount: { type: Number, default: 0 },
    scheduledAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"],
      default: "PENDING",
      index: true
    },
    createdByAdminId: { type: String, trim: true, default: "admin" },
    sentCount: { type: Number, default: 0 },
    lastError: { type: String, trim: true, default: "" },
    resultMessage: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

scheduledBroadcastSchema.index({ status: 1, scheduledAt: 1 });
scheduledBroadcastSchema.index({ eventId: 1, status: 1, scheduledAt: 1 });

export default mongoose.model("ScheduledBroadcast", scheduledBroadcastSchema);
