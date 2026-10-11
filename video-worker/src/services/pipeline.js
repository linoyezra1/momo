const { buildClipPlans } = require("./prompts");
const { createClipTask, waitForTask } = require("./runway");

/**
 * Render the four Runway clips when they are not stored yet.
 * Assembly, upload, and WhatsApp happen in the worker loop.
 */
async function ensureClips(job) {
  if (!job.selfieUrl || !job.invitationUrl) {
    throw new Error("missing_selfie_or_invitation");
  }
  if (!job.story?.meeting || !job.story?.hobby1 || !job.story?.hobby2 || !job.story?.proposal) {
    throw new Error("missing_story");
  }
  if ((job.clipUrls || []).filter(Boolean).length >= 4) return job;

  const plans = buildClipPlans(job);
  job.prompts = plans.map((plan) => plan.promptText);
  job.status = "rendering_clips";
  if (!Array.isArray(job.runwayTaskIds)) job.runwayTaskIds = [];
  if (!Array.isArray(job.clipUrls)) job.clipUrls = [];
  await job.save();

  for (let index = 0; index < plans.length; index += 1) {
    if (!job.runwayTaskIds[index]) {
      job.runwayTaskIds[index] = await createClipTask(plans[index]);
      job.markModified("runwayTaskIds");
      await job.save();
      console.log(`[video] job ${job._id} clip ${index + 1} task ${job.runwayTaskIds[index]}`);
    }
    if (!job.clipUrls[index]) {
      job.clipUrls[index] = await waitForTask(job.runwayTaskIds[index]);
      job.markModified("clipUrls");
      await job.save();
    }
  }
  return job;
}

module.exports = { ensureClips };
