import { buildShaloshLayout, SHALOSH_HALL } from "./shalosh.js";

/**
 * Hall simulations in inventory.
 * Matched when event.venueName equals the preset name (after normalization).
 */
const HALL_PRESETS = [
  {
    ...SHALOSH_HALL,
    /** Accepted venueName values after normalizeVenueName */
    matchNames: ["שלוש", "אולם שלוש"],
    buildLayout: buildShaloshLayout
  }
];

export function normalizeVenueName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^אולם\s+/, "");
}

export function resolveHallPresetByVenueName(venueName) {
  const raw = String(venueName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const normalized = normalizeVenueName(venueName);
  if (!raw && !normalized) return null;

  return (
    HALL_PRESETS.find((preset) => {
      const candidates = [
        preset.name,
        ...(Array.isArray(preset.matchNames) ? preset.matchNames : [])
      ].map((name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " "));
      const strippedCandidates = candidates.map((name) => name.replace(/^אולם\s+/, ""));
      return (
        candidates.includes(raw) ||
        strippedCandidates.includes(normalized) ||
        strippedCandidates.includes(raw)
      );
    }) || null
  );
}

export { SHALOSH_HALL, buildShaloshLayout };
