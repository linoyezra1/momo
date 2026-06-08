import mongoose from "mongoose";

const activationCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    total_credits: { type: Number, required: true, min: 1 },
    remaining_credits: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    note: { type: String, trim: true, default: "" },
    redeemedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

activationCodeSchema.pre("validate", function normalizeCredits(next) {
  if (this.isNew && (this.remaining_credits == null || this.remaining_credits === undefined)) {
    this.remaining_credits = this.total_credits;
  }
  next();
});

export default mongoose.model("ActivationCode", activationCodeSchema);
