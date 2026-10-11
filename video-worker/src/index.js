require("dotenv").config();
const mongoose = require("mongoose");
const VideoJob = require("./models/VideoJob");
const { ensureClips } = require("./services/pipeline");
const { createFinalVideo } = require("./services/videoEditor");
const { uploadFinalVideo } = require("./services/uploader");
const { notifyCouple } = require("./services/notifier");
const { resolveModel, resolveRatio } = require("./services/runway");

async function connectDB() {
  const uri = String(process.env.MONGO_URI || "").trim();
  if (!uri) {
    console.error("MONGO_URI is missing");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const { host, name } = mongoose.connection;
  console.log(`MongoDB connected successfully (video-worker) db=${name} host=${host}`);
}

async function claimNextJob() {
  const active = await VideoJob.findOne({
    status: { $in: ["generating_anchor", "rendering_clips", "assembling"] }
  }).sort({ updatedAt: 1 });
  if (active) return active;

  return VideoJob.findOneAndUpdate(
    { status: "pending" },
    { status: "generating_anchor" },
    { returnDocument: "after", sort: { createdAt: 1 } }
  );
}

async function logQueueSnapshot() {
  const rows = await VideoJob.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const summary = rows.map((row) => `${row._id || "unknown"}:${row.count}`).join(", ") || "none";
  console.log(`[Queue] no pending video job in this database. statuses: ${summary}`);
}

async function markFailed(job, error) {
  job.status = "failed";
  job.errorMessage = String(error?.message || error || "unknown").slice(0, 800);
  await job.save();
  console.error(`[video] job ${job._id} failed: ${job.errorMessage}`);
}

/**
 * Clips → ffmpeg final_video.mp4 → Cloudinary → WhatsApp → completed.
 * A finished upload is not rendered again if only the WhatsApp send failed.
 */
async function deliverJob(job) {
  try {
    await ensureClips(job);
    if ((job.clipUrls || []).filter(Boolean).length < 4) {
      throw new Error("clips_incomplete");
    }

    if (!job.finalVideoUrl) {
      job.status = "assembling";
      await job.save();
      const edited = await createFinalVideo({
        clipUrls: job.clipUrls.slice(0, 4),
        invitationUrl: job.invitationUrl
      });
      try {
        job.finalVideoUrl = await uploadFinalVideo(edited.finalPath, job);
      } finally {
        edited.cleanup();
      }
      await job.save();
    }

    await notifyCouple(job);
    job.status = "completed";
    job.notifiedAt = new Date();
    job.errorMessage = "";
    await job.save();
    console.log(`[video] job ${job._id} completed ${job.finalVideoUrl}`);
  } catch (error) {
    if (job.finalVideoUrl && job.status !== "completed") {
      job.errorMessage = String(error?.message || error || "notify_failed").slice(0, 800);
      await job.save();
      console.error(`[video] job ${job._id} uploaded, notify retry later: ${job.errorMessage}`);
      return;
    }
    await markFailed(job, error);
  }
}

let emptyPolls = 0;

async function processQueue() {
  try {
    const job = await claimNextJob();
    if (job) {
      emptyPolls = 0;
      console.log(`[Queue] Processing job for: ${job.groomName} & ${job.brideName} (${job.status})`);
      await deliverJob(job);
    } else if (emptyPolls % 12 === 0) {
      await logQueueSnapshot();
      emptyPolls += 1;
    } else {
      emptyPolls += 1;
    }
  } catch (error) {
    console.error("[Queue Error]:", error?.message || error);
  } finally {
    setTimeout(processQueue, 5000);
  }
}

connectDB()
  .then(() => {
    const model = resolveModel();
    const ratio = model === "hailuo3" ? "768P" : resolveRatio(model);
    console.log(`Video Worker listening. model=${model} ratio=${ratio}`);
    processQueue();
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error?.message || error);
    process.exit(1);
  });
