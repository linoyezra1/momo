import mongoose from "mongoose";

const timelineItemSchema = new mongoose.Schema(
  {
    time: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const usEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, default: "wedding", trim: true },
    hostNames: { type: String, required: true, trim: true },
    introText: { type: String, trim: true, default: "" },
    celebrationText: { type: String, trim: true, default: "" },
    eventDateFormatted: { type: String, required: true, trim: true },
    eventTime: { type: String, required: true, trim: true },
    countdownTargetDate: { type: String, required: true, trim: true },
    images: {
      heroBg: { type: String, default: "/images/floral-bg.png" },
      countdownBg: { type: String, default: "/images/coral-floral-bg.png" },
      rsvpBg: { type: String, default: "/images/pink-sprig-bg.png" },
      timelineBanner: { type: String, default: "" },
      venueBanner: { type: String, default: "" },
      accommodationBanner: { type: String, default: "" }
    },
    timeline: { type: [timelineItemSchema], default: [] },
    venue: {
      name: { type: String, required: true, trim: true },
      description: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
      mapsLink: { type: String, trim: true, default: "" }
    },
    details: {
      dressCode: { type: String, trim: true, default: "" },
      transportation: { type: String, trim: true, default: "" },
      accommodationTitle: { type: String, trim: true, default: "" },
      accommodationSubtitle: { type: String, trim: true, default: "" },
      accommodationBody: { type: String, trim: true, default: "" }
    },
    rsvpSettings: {
      deadlineText: { type: String, trim: true, default: "" },
      registryLink: { type: String, trim: true, default: "" }
    },
    features: {
      includeTimeline: { type: Boolean, default: false },
      includeTransportation: { type: Boolean, default: false },
      includeAccommodation: { type: Boolean, default: false }
    }
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
    etsyOrderId: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    market: { type: String, enum: ["us"], default: "us" },
    event: { type: usEventSchema, required: true },
    payment: { type: paymentSchema, default: () => ({ amountPaid: 0, paymentMethod: "" }) }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
