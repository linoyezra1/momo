const mongoose = require("mongoose");

/**
 * Shared with backend/src/models/VideoJob.js (ESM). Keep fields in sync.
 * Collection: videojobs
 */
const videoJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, index: true },
    phone: { type: String, required: true, index: true },
    groomName: { type: String, default: "" },
    brideName: { type: String, default: "" },
    weddingDate: { type: String, default: "" },
    venueName: { type: String, default: "" },
    selfieUrl: { type: String, default: "" },
    anchorImageUrl: { type: String, default: "" },
    falRequestId: { type: String, default: "" },
    invitationUrl: { type: String, default: "" },
    story: {
      meeting: { type: String, default: "" },
      hobby1: { type: String, default: "" },
      hobby2: { type: String, default: "" },
      proposal: { type: String, default: "" }
    },
    step: {
      type: String,
      enum: ["meeting", "hobby", "hobby2", "proposal", "selfie", "invitation", "done"],
      default: "meeting"
    },
    status: {
      type: String,
      enum: [
        "collecting",
        "pending",
        "generating_anchor",
        "rendering_clips",
        "assembling",
        "completed",
        "failed"
      ],
      default: "collecting",
      index: true
    },
    prompts: { type: [String], default: [] },
    runwayTaskIds: { type: [String], default: [] },
    clipUrls: { type: [String], default: [] },
    finalVideoUrl: { type: String, default: "" },
    errorMessage: { type: String, default: "" },
    lockedAt: { type: Date, default: null },
    notifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

videoJobSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.models.VideoJob || mongoose.model("VideoJob", videoJobSchema);
