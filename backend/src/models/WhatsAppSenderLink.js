import mongoose from "mongoose";

/**
 * Maps a WhatsApp sender phone to a couple account/event for contact imports.
 * In momoEVENT the User document owns the embedded event, so linkedUserId
 * and linkedEventId are typically the same User ObjectId.
 */
const whatsAppSenderLinkSchema = new mongoose.Schema(
  {
    senderPhone: { type: String, required: true, trim: true, index: true, unique: true },
    linkedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    linkedEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ["pending_auth", "active"],
      default: "pending_auth",
      index: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("WhatsAppSenderLink", whatsAppSenderLinkSchema);
