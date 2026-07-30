export function getEventCoverSrc(event) {
  if (!event) return "";
  const variants = event.cover?.variants || {};
  return (
    event.cover?.url ||
    variants["720"] ||
    variants["480"] ||
    variants["960"] ||
    event.imageDataUrl ||
    ""
  );
}

export function getEventCoverSrcSet(event) {
  const variants = event?.cover?.variants || {};
  const parts = [];
  if (variants["480"]) parts.push(`${variants["480"]} 480w`);
  if (variants["720"]) parts.push(`${variants["720"]} 720w`);
  if (variants["960"]) parts.push(`${variants["960"]} 960w`);
  return parts.join(", ");
}

export function resolveCoverPreview(form) {
  if (form?.coverPreviewUrl) return form.coverPreviewUrl;
  if (form?.cover?.url) return form.cover.url;
  if (form?.imageDataUrl) return form.imageDataUrl;
  return "";
}

export async function uploadEventCover({ api, endpoint, file, onProgress }) {
  const body = new FormData();
  body.append("cover", file);
  const response = await api.post(endpoint, body, {
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    }
  });
  return response.data;
}
