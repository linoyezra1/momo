import { normalizeIsraeliPhone } from "./phoneNormalize.js";
import { extractCategoryFromRow } from "./guestCategories.js";

function parseAttendeesCount(raw) {
  if (raw == null || raw === "") return 1;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) : 1;
}

export function isValidIsraeliMobilePhone(phone) {
  const normalized = normalizeIsraeliPhone(phone);
  return /^05\d{8}$/.test(normalized);
}

export function hasUsablePhoneDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 7;
}

export const NON_ISRAELI_PHONE_WARNING =
  "מספר הטלפון אינו ישראלי — עלה למערכת, אנא ודאו שאין טעות ושהמספר תקין";

export function makeFailedRow(rowNumber, name, reason) {
  return {
    rowNumber: Number(rowNumber) || null,
    name: String(name || "").trim(),
    reason: String(reason || "שגיאה לא ידועה")
  };
}

/**
 * Parse sheet rows into valid guests + failedRows + warningRows.
 * Missing phone is allowed. Non-Israeli phones are imported with a warning (not rejected).
 */
export function parseExcelGuestRows(rows) {
  const failedRows = [];
  const warningRows = [];
  const validGuests = [];
  const seenPhones = new Map();
  let totalCount = 0;

  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const rowNumber = index + 2;
    const fullName = String(row["שם מלא"] ?? row.fullName ?? row.name ?? "").trim();
    const rawPhoneValue = row["טלפון"] ?? row.phone ?? "";
    const rawPhone = String(rawPhoneValue ?? "").trim();
    const phone = normalizeIsraeliPhone(rawPhoneValue);
    const guestGroup = extractCategoryFromRow(row);
    const amountRaw =
      row["כמות"] ??
      row["כמות מגיעים"] ??
      row["כמות אנשים"] ??
      row["מוזמנים"] ??
      row.amount ??
      row.count ??
      row.attendeesCount;
    const hasAmount = String(amountRaw ?? "").trim() !== "";
    const hasAnyContent = Boolean(fullName || rawPhone || hasAmount);

    if (!hasAnyContent) return;

    totalCount += 1;

    if (!fullName) {
      failedRows.push(makeFailedRow(rowNumber, "", "שם חסר בקובץ"));
      return;
    }

    if (!rawPhone) {
      validGuests.push({
        fullName,
        phone: "",
        guestGroup,
        attendeesCount: Math.max(1, parseAttendeesCount(amountRaw)),
        status: "לא ידוע",
        rowNumber
      });
      return;
    }

    if (!hasUsablePhoneDigits(rawPhone)) {
      failedRows.push(makeFailedRow(rowNumber, fullName, "מספר טלפון לא ניתן לזיהוי"));
      return;
    }

    const storedPhone = phone || rawPhone.replace(/\D/g, "");

    if (seenPhones.has(storedPhone)) {
      failedRows.push(
        makeFailedRow(
          rowNumber,
          fullName,
          `מספר טלפון כבר מופיע בקובץ (כפילות עם שורה ${seenPhones.get(storedPhone)})`
        )
      );
      return;
    }

    if (!isValidIsraeliMobilePhone(storedPhone)) {
      warningRows.push(makeFailedRow(rowNumber, fullName, NON_ISRAELI_PHONE_WARNING));
    }

    seenPhones.set(storedPhone, rowNumber);
    validGuests.push({
      fullName,
      phone: storedPhone,
      guestGroup,
      attendeesCount: Math.max(1, parseAttendeesCount(amountRaw)),
      status: "לא ידוע",
      rowNumber
    });
  });

  failedRows.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));
  warningRows.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));
  return { totalCount, validGuests, failedRows, warningRows };
}

export function mergeFailedRows(...lists) {
  const merged = [];
  const seen = new Set();
  for (const list of lists) {
    for (const item of list || []) {
      const key = `${item.rowNumber}|${item.name}|${item.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(makeFailedRow(item.rowNumber, item.name, item.reason));
    }
  }
  merged.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));
  return merged;
}

export function formatFailedRowLabel(item) {
  const rowPart = item.rowNumber ? `שורה ${item.rowNumber}` : "שורה לא ידועה";
  const namePart = item.name ? ` (${item.name})` : "";
  return `${rowPart}${namePart}: ${item.reason}`;
}
