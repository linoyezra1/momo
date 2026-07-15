import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    eventDate: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    source: { type: String, trim: true, default: "landing" },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new"
    }
  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Lead", leadSchema);
