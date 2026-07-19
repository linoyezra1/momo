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
    giftAmount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["מגיע", "לא מגיע", "אולי", "לא ידוע"],
      required: true
    },
    source: {
      type: String,
      enum: ["excel", "form", "manual", "excel_and_form"],
      default: "manual"
    },
    guestSide: {
      type: String,
      enum: ["חתן", "כלה", "משותף", ""],
      default: ""
    },
    guestGroup: { type: String, trim: true, default: "" },
    seatingTableId: { type: String, trim: true, default: "" },
    reminderRound: { type: Number, min: 0, default: 0 },
    confirmationMethod: {
      type: String,
      enum: ["whatsapp", "phone", "web"],
      default: "web"
    },
    currentCallRound: { type: Number, enum: [1, 2], default: null },
    callStatus: {
      type: String,
      enum: ["answered", "no_answer", "disconnected"],
      default: null
    },
    phoneAttemptsCount: { type: Number, min: 0, default: 0 },
    agentNotes: { type: String, trim: true, default: "" },
    callTimestamp: { type: Date, default: null }
  },
  { timestamps: true }
);

guestSchema.index({ userId: 1, phone: 1 });

export default mongoose.model("Guest", guestSchema);
