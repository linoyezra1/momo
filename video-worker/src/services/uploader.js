const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

function sign(params, apiSecret) {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(serialized + apiSecret).digest("hex");
}

/**
 * Upload final_video.mp4 and return a public HTTPS URL.
 */
async function uploadFinalVideo(filePath, job = {}) {
  const cloud = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloud || !apiKey || !apiSecret) {
    throw new Error("cloudinary_not_configured");
  }
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("final_video_missing");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "momo/intro-animations";
  const publicId = `${job.userId || "intro"}-final`;
  const signature = sign({ folder, public_id: publicId, timestamp }, apiSecret);
  const form = new FormData();
  const bytes = fs.readFileSync(filePath);
  form.append("file", new Blob([bytes], { type: "video/mp4" }), path.basename(filePath) || "final_video.mp4");
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", apiKey);
  form.append("signature", signature);

  const response = await axios.post(`https://api.cloudinary.com/v1_1/${cloud}/video/upload`, form, {
    timeout: 180000,
    maxBodyLength: Infinity
  });
  const url = String(response.data?.secure_url || response.data?.url || "").trim();
  if (!url.startsWith("http")) throw new Error("cloudinary_missing_video_url");
  return url;
}

module.exports = { uploadFinalVideo };
