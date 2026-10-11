import mongoose from "mongoose";

/**
 * Shared with video-worker/src/models/VideoJob.js (CommonJS). Keep fields in sync.
 * The RSVP service only writes `collecting` and `pending`. The worker renders pending jobs.
 */
const videoJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    phone: { type: String, required: true, index: true },
    groomName: { type: String, default: "" },
    brideName: { type: String, default: "" },
    weddingDate: { type: String, default: "" },
    venueName: { type: String, default: "" },
    selfieUrl: { type: String, default: "" },
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

export default mongoose.models.VideoJob || mongoose.model("VideoJob", videoJobSchema);
