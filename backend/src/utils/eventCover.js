import {
  deleteCover,
  isCoverStorageConfigured,
  toEventCoverFields,
  uploadCoverBuffer,
  uploadCoverDataUrl
} from "../services/coverStorage.js";

export function normalizeCoverFields(rawCover) {
  if (!rawCover || typeof rawCover !== "object") return null;
  const publicId = String(rawCover.publicId || "").trim();
  const url = String(rawCover.url || "").trim();
  if (!publicId && !url) return null;
  return {
    provider: String(rawCover.provider || "cloudinary").trim() || "cloudinary",
    publicId,
    version: rawCover.version != null ? Number(rawCover.version) : null,
    width: Number(rawCover.width) || 0,
    height: Number(rawCover.height) || 0,
    url,
    variants:
      rawCover.variants && typeof rawCover.variants === "object" ? rawCover.variants : {}
  };
}

/**
 * Apply cover-related fields onto a normalized event payload.
 * Prefer structured cover metadata; migrate legacy data URLs when storage is configured.
 */
export async function applyCoverToEventPayload(normalizedEvent, previousEvent = {}, options = {}) {
  const next = { ...normalizedEvent };
  const previousCover = normalizeCoverFields(previousEvent?.cover);
  const clearCover = options.clearCover === true || next.clearCover === true;
  delete next.clearCover;

  if (clearCover) {
    if (previousCover?.publicId && isCoverStorageConfigured()) {
      try {
        await deleteCover(previousCover.publicId);
      } catch (error) {
        console.warn("Failed to delete previous cover:", error?.message || error);
      }
    }
    Object.assign(next, toEventCoverFields(null));
    return next;
  }

  const incomingCover = normalizeCoverFields(next.cover);
  if (incomingCover) {
    if (
      previousCover?.publicId &&
      previousCover.publicId !== incomingCover.publicId &&
      isCoverStorageConfigured()
    ) {
      try {
        await deleteCover(previousCover.publicId);
      } catch (error) {
        console.warn("Failed to delete previous cover:", error?.message || error);
      }
    }
    Object.assign(next, toEventCoverFields(incomingCover));
    return next;
  }

  const imageDataUrl = String(next.imageDataUrl || "").trim();
  if (imageDataUrl.startsWith("data:image/") && isCoverStorageConfigured()) {
    const uploaded = await uploadCoverDataUrl(imageDataUrl, {
      folder: "momo/event-covers",
      publicId: previousCover?.publicId || undefined
    });
    Object.assign(next, toEventCoverFields(uploaded));
    return next;
  }

  if (imageDataUrl.startsWith("data:image/")) {
    // Storage not configured yet — keep legacy base64 temporarily.
    next.cover = previousCover;
    return next;
  }

  // Preserve existing cover when clients omit cover fields (text-only edits).
  if (previousCover) {
    next.cover = previousCover;
    next.imageDataUrl = String(previousEvent?.imageDataUrl || "").trim();
    return next;
  }

  next.cover = null;
  next.imageDataUrl = "";
  return next;
}

export async function uploadAndAttachCover(user, file) {
  if (!file?.buffer) {
    const error = new Error("לא התקבל קובץ תמונה");
    error.status = 400;
    throw error;
  }
  const previous = user.event?.toObject ? user.event.toObject() : { ...(user.event || {}) };
  const previousCover = normalizeCoverFields(previous.cover);
  const uploaded = await uploadCoverBuffer(file.buffer, {
    mimeType: file.mimetype,
    folder: "momo/event-covers",
    publicId: previousCover?.publicId || undefined
  });
  const fields = toEventCoverFields(uploaded);
  user.event.cover = fields.cover;
  user.event.imageDataUrl = "";
  await user.save();
  return fields.cover;
}

export async function clearEventCover(user) {
  const previous = user.event?.toObject ? user.event.toObject() : { ...(user.event || {}) };
  const previousCover = normalizeCoverFields(previous.cover);
  if (previousCover?.publicId && isCoverStorageConfigured()) {
    try {
      await deleteCover(previousCover.publicId);
    } catch (error) {
      console.warn("Failed to delete cover:", error?.message || error);
    }
  }
  user.event.cover = null;
  user.event.imageDataUrl = "";
  await user.save();
}
