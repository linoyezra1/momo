/** Default IL event cover when none is uploaded (served from frontend public/). */
export const DEFAULT_EVENT_IMAGE_URL = "/images/default-event-cover.png";

export function withDefaultEventImage(imageDataUrl) {
  const value = String(imageDataUrl || "").trim();
  return value || DEFAULT_EVENT_IMAGE_URL;
}
