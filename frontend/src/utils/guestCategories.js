/** Shared guest-category helpers (UI + import). Stored on Guest.guestGroup. */

export const CATEGORY_OTHER_VALUE = "__other__";
export const CATEGORY_NONE_FILTER = "__none__";
export const CATEGORY_ALL_FILTER = "all";

export function getGuestCategory(guestOrValue) {
  if (guestOrValue && typeof guestOrValue === "object") {
    return String(guestOrValue.guestGroup || "").trim();
  }
  return String(guestOrValue || "").trim();
}

export function extractCategoryFromRow(row = {}) {
  return String(
    row["קטגוריה"] ??
      row["צד"] ??
      row.Category ??
      row.category ??
      row.guestGroup ??
      row.guestCategory ??
      ""
  ).trim();
}

export function mergeCategoryLists(...lists) {
  const seen = new Set();
  const merged = [];
  lists.flat().forEach((item) => {
    const value = String(item || "").trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(value);
  });
  return merged.sort((a, b) => a.localeCompare(b, "he"));
}

export function collectCategoriesFromGuests(guests = []) {
  return mergeCategoryLists((guests || []).map((guest) => getGuestCategory(guest)));
}

export function buildEventCategoryOptions(eventCategories = [], guests = []) {
  return mergeCategoryLists(eventCategories, collectCategoriesFromGuests(guests));
}

export function summarizeGuestsByStatus(guests = []) {
  return (guests || []).reduce(
    (acc, guest) => {
      const count = Math.max(0, Number(guest.attendeesCount || 0));
      acc.totalInvited += count;
      if (guest.status === "מגיע" || guest.status === "הגיע לאירוע") {
        acc.totalComing += count;
      } else if (guest.status === "לא מגיע") {
        acc.totalNotComing += count;
      } else if (guest.status === "אולי") {
        acc.totalMaybe += count;
      } else {
        acc.totalUnknown += count;
      }
      return acc;
    },
    {
      totalInvited: 0,
      totalComing: 0,
      totalNotComing: 0,
      totalMaybe: 0,
      totalUnknown: 0
    }
  );
}
