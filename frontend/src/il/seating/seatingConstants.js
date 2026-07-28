export const TABLE_SHAPES = [
  { value: "round", label: "עגול" },
  { value: "rect", label: "מרובע" },
  { value: "head", label: "אבירים" }
];

/** Structural venue elements available to add on the seating canvas. */
export const VENUE_ELEMENT_TYPES = [
  { value: "dance", label: "רחבת ריקודים", defaultWidth: 160, defaultHeight: 110 },
  { value: "dj", label: "עמדת תאורה / הגברה", defaultWidth: 120, defaultHeight: 80 },
  { value: "chuppah", label: "חופה", defaultWidth: 130, defaultHeight: 100 },
  { value: "stage_bar", label: "במה / בר", defaultWidth: 150, defaultHeight: 70 }
];

export const VENUE_ELEMENT_LABELS = {
  dance: "רחבת ריקודים",
  dj: "עמדת DJ",
  chuppah: "חופה",
  stage_bar: "במה / בר",
  // legacy saved layouts
  stage: "במה",
  bar: "בר",
  pillar: "עמוד"
};

export function getVenueElementDefaults(type) {
  const preset = VENUE_ELEMENT_TYPES.find((item) => item.value === type);
  return {
    label: preset?.label || VENUE_ELEMENT_LABELS[type] || type,
    width: preset?.defaultWidth || 120,
    height: preset?.defaultHeight || 80
  };
}
