import mongoose from "mongoose";

const callHistoryEntrySchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, min: 1, required: true },
    callRound: { type: Number, min: 1, max: 4, required: true },
    callStatus: {
      type: String,
      enum: ["answered", "no_answer", "disconnected"],
      required: true
    },
    rsvpStatus: {
      type: String,
      enum: ["מגיע", "לא מגיע", "אולי", "לא ידוע"],
      required: true
    },
    attendeesCount: { type: Number, min: 0, default: 0 },
    agentNotes: { type: String, trim: true, default: "" },
    calledAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

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
      enum: ["excel", "form", "manual", "excel_and_form", "CONTACTS_IMPORT"],
      default: "manual"
    },
    guestSide: {
      type: String,
      enum: ["חתן", "כלה", "משותף", ""],
      default: ""
    },
    guestGroup: { type: String, trim: true, default: "" },
    seatingTableId: { type: String, trim: true, default: "" },
    /** Set when a seated guest switches to לא מגיע */
    declinedWhileSeatedAt: { type: Date, default: null },
    /** Hostess marked guest as arrived on event day */
    hostessArrivedAt: { type: Date, default: null },
    reminderRound: { type: Number, min: 0, default: 0 },
    whatsappRoundsSentCount: { type: Number, min: 0, default: 0 },
    whatsappConversationState: {
      type: String,
      enum: ["idle", "awaiting_guest_count"],
      default: "idle"
    },
    lastWhatsAppSentAt: { type: Date, default: null },
    confirmationMethod: {
      type: String,
      enum: ["whatsapp", "phone", "web"],
      default: "web"
    },
    currentCallRound: { type: Number, enum: [1, 2, 3, 4], default: null },
    callStatus: {
      type: String,
      enum: ["answered", "no_answer", "disconnected"],
      default: null
    },
    phoneAttemptsCount: { type: Number, min: 0, default: 0 },
    agentNotes: { type: String, trim: true, default: "" },
    callTimestamp: { type: Date, default: null },
    callHistory: { type: [callHistoryEntrySchema], default: [] }
  },
  { timestamps: true }
);

guestSchema.index({ userId: 1, phone: 1 });
guestSchema.index({
  userId: 1,
  status: 1,
  whatsappRoundsSentCount: 1,
  phoneAttemptsCount: 1
});

export default mongoose.model("Guest", guestSchema);
