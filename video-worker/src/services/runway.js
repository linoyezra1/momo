const axios = require("axios");

const API_BASE = String(process.env.RUNWAY_API_BASE || "https://api.dev.runwayml.com/v1").replace(/\/+$/, "");
const DEFAULT_MODEL = "seedance2_mini";
const ALLOWED_MODELS = new Set(["seedance2_mini", "hailuo3"]);

function apiSecret() {
  return String(process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY || "").trim();
}

function resolveModel() {
  const requested = String(process.env.VIDEO_MODEL || DEFAULT_MODEL).trim();
  if (!ALLOWED_MODELS.has(requested)) {
    console.warn(`[video] VIDEO_MODEL=${requested} is not allowed; using ${DEFAULT_MODEL}`);
    return DEFAULT_MODEL;
  }
  return requested;
}

/** 720p vertical by default. 480p only when explicitly asked. 1080p is never sent. */
function resolveRatio(model) {
  if (model === "hailuo3") return "";
  const requested = String(process.env.VIDEO_RATIO || "720:1280").trim();
  if (requested === "480:854" || requested === "854:480") return "480:854";
  if (/1080|1920|2160|4k/i.test(requested)) {
    console.warn(`[video] refusing ratio ${requested}; using 720:1280`);
  }
  return "720:1280";
}

function headers() {
  const secret = apiSecret();
  if (!secret) {
    throw new Error("RUNWAYML_API_SECRET is not configured");
  }
  return {
    Authorization: `Bearer ${secret}`,
    "X-Runway-Version": "2024-11-06",
    "Content-Type": "application/json"
  };
}

function buildBody({ model, promptText, duration, referenceUrls }) {
  const selfie = referenceUrls[0];
  const references = referenceUrls.filter(Boolean).map((uri, index) => ({
    uri,
    tag: index === 0 ? "couple" : "invitation"
  }));
  const body = {
    model,
    promptText,
    duration,
    audio: true,
    promptImage: selfie,
    referenceImages: references
  };
  if (model === "hailuo3") {
    body.resolution = "768P";
    if (body.duration < 5) body.duration = 5;
  } else {
    body.ratio = resolveRatio(model);
  }
  return body;
}

async function postTask(body) {
  const response = await axios.post(`${API_BASE}/image_to_video`, body, {
    headers: headers(),
    timeout: 30000
  });
  const id = response.data?.id || response.data?.task?.id;
  if (!id) {
    throw new Error(`runway_missing_task_id ${JSON.stringify(response.data || {}).slice(0, 300)}`);
  }
  return String(id);
}

async function createClipTask(spec) {
  const model = resolveModel();
  const body = buildBody({
    model,
    promptText: spec.promptText,
    duration: spec.duration,
    referenceUrls: spec.referenceUrls
  });
  try {
    return await postTask(body);
  } catch (error) {
    const status = error.response?.status;
    const detail = JSON.stringify(error.response?.data || error.message || "");
    if (status === 400 && body.audio && /audio/i.test(detail)) {
      const retry = { ...body };
      delete retry.audio;
      return postTask(retry);
    }
    if (status === 400 && body.referenceImages && /reference/i.test(detail)) {
      const retry = { ...body };
      delete retry.referenceImages;
      return postTask(retry);
    }
    throw new Error(detail.slice(0, 500));
  }
}

function outputUrl(task) {
  const output = task?.output;
  if (Array.isArray(output) && output.length) {
    const first = output[0];
    if (typeof first === "string") return first;
    return first?.url || first?.uri || "";
  }
  return task?.outputUrl || "";
}

async function waitForTask(taskId) {
  const started = Date.now();
  const timeoutMs = 12 * 60 * 1000;
  while (Date.now() - started < timeoutMs) {
    const response = await axios.get(`${API_BASE}/tasks/${taskId}`, {
      headers: headers(),
      timeout: 30000
    });
    const task = response.data || {};
    const status = String(task.status || "").toUpperCase();
    if (status === "SUCCEEDED") {
      const url = outputUrl(task);
      if (!url) throw new Error(`runway_task_${taskId}_missing_output`);
      return url;
    }
    if (status === "FAILED" || status === "CANCELLED" || status === "CANCELED") {
      throw new Error(
        `runway_task_${taskId}_${status} ${task.failure || task.failureCode || ""}`.trim()
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 8000));
  }
  throw new Error(`runway_task_${taskId}_timeout`);
}

module.exports = { createClipTask, waitForTask, resolveModel, resolveRatio };
