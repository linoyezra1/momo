import mongoose from "mongoose";

export const EVENT_VENDOR_STATUSES = ["OFFER_SENT", "NEGOTIATING", "BOOKED", "REJECTED"];

const eventVendorSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true
    },
    quoteAmount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: EVENT_VENDOR_STATUSES,
      default: "OFFER_SENT",
      index: true
    },
    eventNotes: { type: String, trim: true, default: "" },
    attachmentUrl: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

eventVendorSchema.index({ eventId: 1, vendorId: 1 }, { unique: true });
eventVendorSchema.index({ vendorId: 1, createdAt: -1 });

export default mongoose.model("EventVendor", eventVendorSchema);
