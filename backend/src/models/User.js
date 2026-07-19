import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["חתונה", "ברית", "בת מצווה", "אחר"],
      required: true
    },
    groomName: { type: String, trim: true, default: "" },
    brideName: { type: String, trim: true, default: "" },
    batMitzvahName: { type: String, trim: true, default: "" },
    parentName1: { type: String, trim: true, default: "" },
    parentName2: { type: String, trim: true, default: "" },
    eventNames: { type: String, trim: true, default: "" },
    venueName: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    streetAndNumber: { type: String, trim: true, default: "" },
    eventDate: { type: String, trim: true, default: "" },
    eventDateHebrew: { type: String, trim: true, default: "" },
    eventTime: { type: String, trim: true, default: "" },
    receptionTime: { type: String, trim: true, default: "" },
    maxPhoneRounds: { type: Number, min: 0, max: 4, default: 0 },
    isPremiumWhatsappButtonsEnabled: { type: Boolean, default: false },
    welcomeText: { type: String, trim: true, default: "" },
    imageDataUrl: { type: String, default: "" },
    /** WhatsApp approved-template editable segments ({{2}}, {{3}}, {{5}}) */
    welcomeParagraph: { type: String, trim: true, default: "" },
    eventDetailsParagraph: { type: String, trim: true, default: "" },
    closingParagraph: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const includedFeaturesSchema = new mongoose.Schema(
  {
    whatsappRound1: { type: Boolean, default: true },
    whatsappRound2: { type: Boolean, default: false },
    isPremiumWhatsappButtonsEnabled: { type: Boolean, default: false },
    phoneCallsRound1: { type: Boolean, default: false },
    phoneCallsRound2: { type: Boolean, default: false },
    phoneCallsRound3: { type: Boolean, default: false },
    phoneCallsRound4: { type: Boolean, default: false },
    eventDayReminder: { type: Boolean, default: true },
    eventDayTableNumber: { type: Boolean, default: true },
    thankYouMessage: { type: Boolean, default: true }
  },
  { _id: false }
);

const dealSchema = new mongoose.Schema(
  {
    packageType: {
      type: String,
      enum: ["custom", "digital", "vip_2_rounds", "vip_4_rounds"],
      default: "custom"
    },
    includedFeatures: {
      type: includedFeaturesSchema,
      default: () => ({})
    },
    marketingSource: { type: String, trim: true, default: "" },
    paymentAmount: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["bit", "paybox", "bank_transfer", "cash", "other"],
      default: "other"
    },
    adminNotes: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    loginPassword: { type: String, default: "", trim: true },
    contactPhone: { type: String, trim: true, default: "" },
    event: { type: eventSchema, required: true },
    payment: { type: paymentSchema, default: () => ({ amountPaid: 0, paymentMethod: "" }) },
    deal: { type: dealSchema, default: () => ({}) },
    managedBy: {
      type: String,
      enum: ["admin", "eventManager"],
      default: "admin",
      index: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
