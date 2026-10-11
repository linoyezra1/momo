const { createCharacterImage } = require("./fal");
const { enhanceStoryPrompts } = require("./promptEnhancer");
const { buildClipPlans } = require("./prompts");
const { createClipTask, waitForTask } = require("./runway");

const HEBREW = /[\u0590-\u05FF]/;

function cleanPrompts(prompts) {
  const list = Array.isArray(prompts) ? prompts.map((item) => String(item || "").trim()) : [];
  if (list.length === 4 && list.every((item) => item && !HEBREW.test(item) && /sound\s*:/i.test(item))) {
    return list;
  }
  return null;
}

/**
 * Story text stays in Hebrew on the job. Runway only receives the English prompts.
 */
async function ensureEnglishPrompts(job) {
  const existing = cleanPrompts(job.prompts);
  if (existing) return existing;

  const prompts = await enhanceStoryPrompts(job.story || {});
  job.prompts = prompts;
  job.markModified("prompts");
  if (Array.isArray(job.runwayTaskIds)) {
    job.runwayTaskIds = job.runwayTaskIds.map((id, index) => (job.clipUrls?.[index] ? id : ""));
    job.markModified("runwayTaskIds");
  }
  await job.save();
  console.log(`[video] job ${job._id} english prompts ready`);
  return prompts;
}

/**
 * Build the 3D character still once, then keep that URL for every Runway clip.
 */
async function ensureAnchor(job) {
  if (String(job.anchorImageUrl || "").startsWith("http")) return job.anchorImageUrl;

  job.status = "generating_anchor";
  await job.save();
  const anchorUrl = await createCharacterImage(job.selfieUrl, {
    requestId: job.falRequestId,
    onSubmitted: async (requestId) => {
      job.falRequestId = requestId;
      await job.save();
      console.log(`[video] job ${job._id} fal character ${requestId}`);
    }
  });
  job.anchorImageUrl = anchorUrl;
  await job.save();
  console.log(`[video] job ${job._id} 3D character ready`);
  return anchorUrl;
}

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

  await ensureAnchor(job);
  const prompts = await ensureEnglishPrompts(job);
  const plans = buildClipPlans(job).map((plan, index) => ({
    ...plan,
    promptText: prompts[index]
  }));
  job.prompts = prompts;
  job.markModified("prompts");
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
