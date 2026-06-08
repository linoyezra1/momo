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
    welcomeText: { type: String, trim: true, default: "" },
    imageDataUrl: { type: String, default: "" }
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

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    loginPassword: { type: String, default: "", trim: true },
    event: { type: eventSchema, required: true },
    payment: { type: paymentSchema, default: () => ({ amountPaid: 0, paymentMethod: "" }) }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
