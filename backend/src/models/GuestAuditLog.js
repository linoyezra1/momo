import mongoose from "mongoose";

const guestAuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      required: true,
      index: true
    },
    guestName: { type: String, trim: true, default: "" },
    guestPhone: { type: String, trim: true, default: "" },
    actor: {
      type: String,
      enum: ["agent", "guest", "client", "system", "hostess"],
      required: true
    },
    channel: {
      type: String,
      enum: ["phone", "whatsapp", "web", "dashboard", "import", "hostess"],
      required: true
    },
    action: {
      type: String,
      enum: [
        "status_change",
        "attendees_change",
        "phone_attempt",
        "rsvp_update",
        "guest_created",
        "guest_updated"
      ],
      required: true
    },
    description: { type: String, required: true, trim: true },
    performerLabel: { type: String, required: true, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

guestAuditLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("GuestAuditLog", guestAuditLogSchema);
