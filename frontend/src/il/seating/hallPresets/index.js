import { buildEverestLayout, EVEREST_HALL } from "./everest.js";

/**
 * Hall simulations in inventory.
 * Matched only when event.venueName equals the preset name exactly.
 */
const HALL_PRESETS = [
  {
    ...EVEREST_HALL,
    buildLayout: buildEverestLayout
  }
];

export function normalizeVenueName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveHallPresetByVenueName(venueName) {
  const normalized = normalizeVenueName(venueName);
  if (!normalized) return null;
  return HALL_PRESETS.find((preset) => normalizeVenueName(preset.name) === normalized) || null;
}

export { EVEREST_HALL, buildEverestLayout };
