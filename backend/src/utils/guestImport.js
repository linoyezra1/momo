import { normalizePhone } from "./guestPhone.js";

export function parseAttendeesCount(raw) {
  if (raw == null || raw === "") return 1;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
  const match = String(raw).match(/\d+/);
  return match ? Number(match[0]) : 1;
}

/** Israeli mobile after normalize: 05XXXXXXXX */
export function isValidIsraeliMobilePhone(phone) {
  const normalized = normalizePhone(phone);
  return /^05\d{8}$/.test(normalized);
}

export function extractGuestFieldsFromRow(row = {}) {
  const fullName = String(row["שם מלא"] ?? row.fullName ?? row.name ?? "").trim();
  const rawPhone = String(row["טלפון"] ?? row.phone ?? "").trim();
  const phone = normalizePhone(row["טלפון"] ?? row.phone ?? "");
  const amountRaw =
    row["כמות"] ??
    row["כמות מגיעים"] ??
    row["כמות אנשים"] ??
    row["מוזמנים"] ??
    row.amount ??
    row.count ??
    row.attendeesCount;
  const attendeesCount = Math.max(1, parseAttendeesCount(amountRaw));
  const statusRaw = String(row["סטטוס"] ?? row.status ?? row["סטטוס הגעה"] ?? "").trim();
  let status = "לא ידוע";
  if (statusRaw === "מגיע" || statusRaw === "לא מגיע" || statusRaw === "אולי") {
    status = statusRaw;
  }
  return { fullName, rawPhone, phone, attendeesCount, status, giftAmount: 0 };
}

export function makeFailedRow(rowNumber, name, reason) {
  return {
    rowNumber: Number(rowNumber) || null,
    name: String(name || "").trim(),
    reason: String(reason || "שגיאה לא ידועה")
  };
}

/**
 * Validate one Excel/API guest row. Returns { empty }, { fail }, or { guest }.
 * `rowNumber` should be the Excel sheet row (usually index+2 with header).
 */
export function validateImportGuestRow(row, rowNumber) {
  const fields = extractGuestFieldsFromRow(row);
  const hasAnyContent = Boolean(
    fields.fullName ||
      fields.rawPhone ||
      String(row["כמות"] ?? row["כמות מגיעים"] ?? row["כמות אנשים"] ?? row.attendeesCount ?? "").trim()
  );

  if (!hasAnyContent) {
    return { empty: true };
  }

  if (!fields.fullName) {
    return {
      fail: makeFailedRow(rowNumber, "", "שם חסר בקובץ")
    };
  }

  if (!fields.rawPhone && !fields.phone) {
    return {
      fail: makeFailedRow(rowNumber, fields.fullName, "מספר טלפון חסר בקובץ")
    };
  }

  if (!isValidIsraeliMobilePhone(fields.phone)) {
    return {
      fail: makeFailedRow(rowNumber, fields.fullName, "מספר טלפון לא תקין")
    };
  }

  return {
    guest: {
      fullName: fields.fullName,
      phone: fields.phone,
      attendeesCount: fields.attendeesCount,
      status: fields.status,
      giftAmount: 0,
      rowNumber: Number(rowNumber) || null
    }
  };
}

/**
 * Map incoming guest payloads (already mapped or raw Excel columns) and collect failures.
 * Detects duplicate phones within the same batch (first occurrence wins).
 */
export function processImportGuestBatch(rows) {
  const failedRows = [];
  const validGuests = [];
  const seenPhones = new Map();
  let totalCount = 0;

  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const rowNumber = Number(row?.rowNumber ?? row?.excelRowNumber ?? index + 1);
    const result = validateImportGuestRow(row, rowNumber);
    if (result.empty) return;

    totalCount += 1;

    if (result.fail) {
      failedRows.push(result.fail);
      return;
    }

    const guest = result.guest;
    if (seenPhones.has(guest.phone)) {
      failedRows.push(
        makeFailedRow(
          rowNumber,
          guest.fullName,
          `מספר טלפון כבר מופיע בקובץ (כפילות עם שורה ${seenPhones.get(guest.phone)})`
        )
      );
      return;
    }

    seenPhones.set(guest.phone, rowNumber);
    validGuests.push(guest);
  });

  return { totalCount, validGuests, failedRows };
}
