const axios = require("axios");

const QUEUE = "https://queue.fal.run";
const DEFAULT_MODEL = "fal-ai/flux-pro/kontext";
const CHARACTER_PROMPT = [
  "Turn the people in this photo into glossy 3D animated feature-film characters.",
  "Keep every face recognizable, the same hairstyle, and the same person on the same side.",
  "Soft cinematic lighting, clean portrait, no written text."
].join(" ");

function modelId() {
  return String(process.env.FAL_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function falKey() {
  const key = String(process.env.FAL_KEY || "").trim();
  if (!key) throw new Error("FAL_KEY is not configured");
  return key;
}

function headers() {
  return {
    Authorization: `Key ${falKey()}`,
    "Content-Type": "application/json"
  };
}

function requestUrls(requestId) {
  const base = `${QUEUE}/${modelId()}/requests/${requestId}`;
  return {
    statusUrl: `${base}/status`,
    responseUrl: `${base}/response`
  };
}

function imageUrl(data) {
  const images = data?.images || data?.data?.images;
  const first = Array.isArray(images) ? images[0] : null;
  if (typeof first === "string") return first;
  return String(first?.url || data?.image?.url || "").trim();
}

function failDetail(error) {
  const body = error?.response?.data;
  const text = typeof body === "string" ? body : JSON.stringify(body || error?.message || error);
  return String(text || "fal_request_failed").slice(0, 500);
}

async function submitCharacter(selfieUrl) {
  const response = await axios.post(
    `${QUEUE}/${modelId()}`,
    {
      prompt: CHARACTER_PROMPT,
      image_url: selfieUrl,
      aspect_ratio: "9:16",
      output_format: "jpeg",
      num_images: 1
    },
    { headers: headers(), timeout: 30000 }
  );
  const requestId = String(response.data?.request_id || "").trim();
  if (!requestId) {
    const direct = imageUrl(response.data);
    if (direct.startsWith("http")) return { requestId: "", imageUrl: direct };
    throw new Error(`fal_missing_request_id ${JSON.stringify(response.data || {}).slice(0, 300)}`);
  }
  return {
    requestId,
    statusUrl: response.data.status_url || requestUrls(requestId).statusUrl,
    responseUrl: response.data.response_url || requestUrls(requestId).responseUrl
  };
}

async function readResult(responseUrl, requestId) {
  const fallback = requestUrls(requestId).responseUrl;
  const urls = responseUrl && responseUrl !== fallback ? [responseUrl, fallback] : [responseUrl || fallback];
  let lastError = null;
  for (const url of urls) {
    try {
      const result = await axios.get(url, { headers: headers(), timeout: 30000 });
      const picture = imageUrl(result.data);
      if (picture.startsWith("http")) return picture;
      lastError = new Error(`fal_missing_image_url ${JSON.stringify(result.data || {}).slice(0, 300)}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("fal_missing_image_url");
}

async function waitForCharacter({ requestId, statusUrl, responseUrl }) {
  const urls = requestUrls(requestId);
  const started = Date.now();
  const timeoutMs = 4 * 60 * 1000;
  while (Date.now() - started < timeoutMs) {
    const statusResponse = await axios.get(statusUrl || urls.statusUrl, {
      headers: headers(),
      timeout: 30000
    });
    const status = String(statusResponse.data?.status || "").toUpperCase();
    if (status === "COMPLETED") {
      if (statusResponse.data?.error) {
        throw new Error(`fal_completed_error ${statusResponse.data.error}`.slice(0, 500));
      }
      return readResult(responseUrl || statusResponse.data?.response_url || urls.responseUrl, requestId);
    }
    if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
      throw new Error(
        `fal_${status} ${statusResponse.data?.error || statusResponse.data?.error_type || ""}`.trim()
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`fal_request_${requestId}_timeout`);
}

/**
 * Turn the couple selfie into one 3D character still.
 * An existing request id is polled again instead of submitting a second image.
 */
async function createCharacterImage(selfieUrl, { requestId = "", onSubmitted } = {}) {
  if (!String(selfieUrl || "").startsWith("http")) {
    throw new Error("fal_selfie_url_missing");
  }
  try {
    let ticket = { requestId: String(requestId || "").trim() };
    if (!ticket.requestId) {
      ticket = await submitCharacter(selfieUrl);
      if (ticket.imageUrl) return ticket.imageUrl;
      if (onSubmitted) await onSubmitted(ticket.requestId);
    } else {
      const urls = requestUrls(ticket.requestId);
      ticket = { ...ticket, ...urls };
    }
    return await waitForCharacter(ticket);
  } catch (error) {
    if (error?.response) throw new Error(failDetail(error));
    throw error;
  }
}

module.exports = { createCharacterImage, modelId };
