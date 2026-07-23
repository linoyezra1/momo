import mongoose from "mongoose";

/**
 * System-level audit (not guest RSVP). Used for WhatsApp Quick Reply credential flows etc.
 */
const systemAuditLogSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: "WHATSAPP_QUICK_REPLY"
    },
    action: { type: String, required: true, trim: true, index: true },
    status: { type: String, required: true, trim: true, default: "ok" },
    phone: { type: String, trim: true, default: "", index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    description: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

systemAuditLogSchema.index({ createdAt: -1 });
systemAuditLogSchema.index({ source: 1, createdAt: -1 });

export default mongoose.model("SystemAuditLog", systemAuditLogSchema);
