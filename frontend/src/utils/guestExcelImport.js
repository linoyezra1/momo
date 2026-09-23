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

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function pickCell(row, match) {
  for (const [key, value] of Object.entries(row || {})) {
    if (String(key).startsWith("__")) continue;
    if (match(normalizeHeader(key))) return cellText(value);
  }
  return "";
}

/** מאורסים מאורסות: שם המוזמן + (מהצד של... או שיוך לקבוצה). */
export function isMeorasimHeaderList(headers) {
  const list = (headers || []).map(normalizeHeader).filter(Boolean);
  const hasName = list.some((header) => header === "שם המוזמן");
  const hasSide = list.some((header) => header.startsWith("מהצד של"));
  const hasGroup = list.some((header) => header === "שיוך לקבוצה");
  return hasName && (hasSide || hasGroup);
}

/**
 * Standard files use row 1 as headers.
 * מאורסים מאורסות puts a title on row 1 and headers on row 2.
 */
export function matrixToGuestRows(matrix) {
  const rows = (Array.isArray(matrix) ? matrix : []).map((row) => (Array.isArray(row) ? row : []));
  const headerAt = (index) => (rows[index] || []).map(normalizeHeader);
  let headerIndex = 0;
  if (!isMeorasimHeaderList(headerAt(0)) && isMeorasimHeaderList(headerAt(1))) {
    headerIndex = 1;
  }
  const headers = headerAt(headerIndex);
  const format = isMeorasimHeaderList(headers) ? "meorasim" : "standard";
  const data = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const source = rows[index] || [];
    if (source.every((cell) => !cellText(cell))) continue;
    const record = { __rowNumber: index + 1, __format: format };
    headers.forEach((header, column) => {
      if (!header) return;
      record[header] = cellText(source[column]);
    });
    data.push(record);
  }
  return { format, rows: data };
}

function mapArrivalStatus(raw) {
  const value = cellText(raw);
  if (value === "יגיע" || value === "מגיע") return "מגיע";
  if (value === "לא יגיע" || value === "לא מגיע") return "לא מגיע";
  if (value === "מתלבט" || value === "אולי") return "אולי";
  if (value === "הגיע לאירוע") return "הגיע לאירוע";
  return "לא ידוע";
}

function mapInvitationSent(raw) {
  const value = cellText(raw);
  if (value === "נשלחה") return "נשלחה";
  if (value === "לא נשלחה") return "לא נשלחה";
  return "";
}

function parseGiftAmount(raw) {
  const digits = cellText(raw).replace(/[^\d.]/g, "");
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function mapMeorasimRow(row) {
  const fullName = pickCell(row, (key) => key === "שם המוזמן" || key === "שם מלא");
  const phone = normalizeIsraeliPhone(pickCell(row, (key) => key === "נייד" || key === "טלפון"));
  const attendeesCount = Math.max(
    1,
    parseAttendeesCount(pickCell(row, (key) => key === "כמה יגיעו" || key === "כמות"))
  );
  const notes = pickCell(row, (key) => key.startsWith("הערות"));
  const enteredBy = pickCell(row, (key) => key.startsWith("מספר הטלפון של המשתמש"));
  return {
    fullName,
    phone,
    guestGroup: pickCell(row, (key) => key === "שיוך לקבוצה"),
    guestSide: pickCell(row, (key) => key.startsWith("מהצד של")),
    attendeesCount,
    status: mapArrivalStatus(pickCell(row, (key) => key === "סטטוס הגעה" || key === "סטטוס")),
    giftAmount: parseGiftAmount(pickCell(row, (key) => key === "סכום מתנה משוער")),
    invitationSent: mapInvitationSent(pickCell(row, (key) => key.startsWith("האם נשלחה הזמנה"))),
    email: pickCell(row, (key) => key.toLowerCase() === "mail" || key === "אימייל" || key === "מייל"),
    notes: [notes, enteredBy ? `הוזן ע״י: ${enteredBy}` : ""].filter(Boolean).join("\n")
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
  const list = Array.isArray(rows) ? rows : [];
  const format =
    list.some((row) => row?.__format === "meorasim") ||
    (list[0] && isMeorasimHeaderList(Object.keys(list[0])))
      ? "meorasim"
      : "standard";

  list.forEach((row, index) => {
    const rowNumber = Number(row?.__rowNumber) || index + 2;

    if (format === "meorasim") {
      const mapped = mapMeorasimRow(row);
      if (!mapped.fullName || !mapped.phone) return;

      totalCount += 1;
      if (!hasUsablePhoneDigits(mapped.phone)) {
        failedRows.push(makeFailedRow(rowNumber, mapped.fullName, "מספר טלפון לא ניתן לזיהוי"));
        return;
      }
      if (seenPhones.has(mapped.phone)) {
        failedRows.push(
          makeFailedRow(
            rowNumber,
            mapped.fullName,
            `מספר טלפון כבר מופיע בקובץ (כפילות עם שורה ${seenPhones.get(mapped.phone)})`
          )
        );
        return;
      }
      if (!isValidIsraeliMobilePhone(mapped.phone)) {
        warningRows.push(makeFailedRow(rowNumber, mapped.fullName, NON_ISRAELI_PHONE_WARNING));
      }
      seenPhones.set(mapped.phone, rowNumber);
      validGuests.push({ ...mapped, rowNumber });
      return;
    }

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
  return {
    format,
    totalCount,
    validGuests,
    failedRows,
    warningRows,
    previewRows: validGuests.slice(0, 3)
  };
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
