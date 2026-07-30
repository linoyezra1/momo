/**
 * Provider-neutral event cover storage.
 * First adapter: Cloudinary. Keep credentials server-side only.
 */
import { v2 as cloudinary } from "cloudinary";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let configured = false;

function ensureCloudinaryConfigured() {
  if (configured) return true;
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  configured = true;
  return true;
}

export function isCoverStorageConfigured() {
  return ensureCloudinaryConfigured();
}

function assertConfigured() {
  if (!ensureCloudinaryConfigured()) {
    const error = new Error(
      "אחסון תמונות לא מוגדר. יש להגדיר CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ו-CLOUDINARY_API_SECRET"
    );
    error.status = 503;
    throw error;
  }
}

export function buildResponsiveCover(publicId, { version } = {}) {
  if (!publicId) return null;
  assertConfigured();
  const versionOpt = version ? { version } : {};
  const widths = [480, 720, 960];
  const variants = {};
  widths.forEach((width) => {
    variants[String(width)] = cloudinary.url(publicId, {
      ...versionOpt,
      secure: true,
      transformation: [
        {
          width,
          crop: "limit",
          fetch_format: "auto",
          quality: "auto"
        }
      ]
    });
  });
  const url = variants["720"] || variants["480"] || variants["960"];
  return { url, variants };
}

function normalizeUploadResult(result) {
  const publicId = String(result?.public_id || "").trim();
  const version = result?.version != null ? Number(result.version) : null;
  const width = Number(result?.width) || 0;
  const height = Number(result?.height) || 0;
  const responsive = buildResponsiveCover(publicId, { version });
  return {
    provider: "cloudinary",
    publicId,
    version,
    width,
    height,
    url: responsive?.url || String(result?.secure_url || result?.url || "").trim(),
    variants: responsive?.variants || {},
    format: String(result?.format || "").trim(),
    bytes: Number(result?.bytes) || 0
  };
}

export async function uploadCoverBuffer(buffer, { mimeType, folder = "momo/event-covers", publicId } = {}) {
  assertConfigured();
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("קובץ תמונה ריק");
    error.status = 400;
    throw error;
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    const error = new Error("התמונה גדולה מדי. העלו תמונה עד 8MB");
    error.status = 413;
    throw error;
  }
  if (mimeType && !ALLOWED_MIME.has(String(mimeType).toLowerCase())) {
    const error = new Error("יש להעלות קובץ תמונה בלבד (JPEG / PNG / WebP)");
    error.status = 400;
    throw error;
  }

  const options = {
    folder,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
    transformation: [{ width: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }]
  };
  if (publicId) options.public_id = publicId;

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, uploaded) => {
      if (err) reject(err);
      else resolve(uploaded);
    });
    stream.end(buffer);
  });

  return normalizeUploadResult(result);
}

export async function uploadCoverDataUrl(dataUrl, options = {}) {
  const raw = String(dataUrl || "").trim();
  if (!raw.startsWith("data:image/")) {
    const error = new Error("פורמט תמונה לא תקין");
    error.status = 400;
    throw error;
  }
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    const error = new Error("פורמט תמונה לא תקין");
    error.status = 400;
    throw error;
  }
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return uploadCoverBuffer(buffer, { ...options, mimeType });
}

export async function deleteCover(publicId) {
  if (!publicId) return { result: "skipped" };
  assertConfigured();
  return cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

export function toEventCoverFields(cover) {
  if (!cover?.publicId && !cover?.url) {
    return {
      cover: null,
      imageDataUrl: ""
    };
  }
  return {
    cover: {
      provider: cover.provider || "cloudinary",
      publicId: cover.publicId || "",
      version: cover.version ?? null,
      width: cover.width || 0,
      height: cover.height || 0,
      url: cover.url || "",
      variants: cover.variants || {}
    },
    imageDataUrl: ""
  };
}

export function resolvePublicCover(event = {}) {
  const cover = event?.cover;
  if (cover?.url || cover?.variants?.["720"] || cover?.variants?.["480"]) {
    const variants = cover.variants || {};
    return {
      url: cover.url || variants["720"] || variants["480"] || variants["960"] || "",
      width: Number(cover.width) || 0,
      height: Number(cover.height) || 0,
      variants,
      legacyDataUrl: ""
    };
  }
  const legacy = String(event?.imageDataUrl || "").trim();
  if (legacy.startsWith("data:image/")) {
    return {
      url: legacy,
      width: 0,
      height: 0,
      variants: {},
      legacyDataUrl: legacy
    };
  }
  return null;
}

export function serializePublicEvent(eventDoc) {
  if (!eventDoc) return null;
  const event = typeof eventDoc.toObject === "function" ? eventDoc.toObject() : { ...eventDoc };
  const cover = resolvePublicCover(event);
  const {
    imageDataUrl: _omit,
    cover: _rawCover,
    ...rest
  } = event;
  const hasExternalCover = Boolean(cover?.url) && !cover.legacyDataUrl;
  return {
    ...rest,
    cover: hasExternalCover
      ? {
          url: cover.url,
          width: cover.width,
          height: cover.height,
          variants: cover.variants || {}
        }
      : null,
    // Temporary migration fallback only — never preferred when Cloudinary cover exists.
    imageDataUrl: hasExternalCover ? "" : cover?.legacyDataUrl || ""
  };
}
