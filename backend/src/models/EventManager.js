import mongoose from "mongoose";

const eventManagerSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    /** Plaintext for admin support display (same pattern as couple loginPassword). */
    loginPassword: { type: String, default: "", trim: true },
    displayName: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

eventManagerSchema.index({ username: 1 });

export default mongoose.model("EventManager", eventManagerSchema);
