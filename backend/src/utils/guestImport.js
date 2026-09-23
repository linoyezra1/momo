import User from "../models/User.js";
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

/** Any usable phone for import — keep international numbers too. */
export function hasUsablePhoneDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 7;
}

export const NON_ISRAELI_PHONE_WARNING =
  "מספר הטלפון אינו ישראלי — עלה למערכת, אנא ודאו שאין טעות ושהמספר תקין";

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function headerValue(row, match) {
  for (const [key, value] of Object.entries(row || {})) {
    if (String(key).startsWith("__")) continue;
    const header = cleanText(key).replace(/\s+/g, " ");
    if (match(header)) return value;
  }
  return undefined;
}

function mapArrivalStatus(statusRaw) {
  if (statusRaw === "יגיע" || statusRaw === "מגיע") return "מגיע";
  if (statusRaw === "לא יגיע" || statusRaw === "לא מגיע") return "לא מגיע";
  if (statusRaw === "מתלבט" || statusRaw === "אולי") return "אולי";
  if (statusRaw === "הגיע לאירוע") return "הגיע לאירוע";
  return "לא ידוע";
}

function mapInvitationSent(raw) {
  const value = cleanText(raw);
  if (value === "נשלחה") return "נשלחה";
  if (value === "לא נשלחה") return "לא נשלחה";
  return "";
}

function parseGiftAmount(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  const digits = cleanText(raw).replace(/[^\d.]/g, "");
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function extractGuestFieldsFromRow(row = {}) {
  const fullName = cleanText(
    headerValue(row, (key) => key === "שם המוזמן") ??
      row["שם מלא"] ??
      row.fullName ??
      row.name ??
      ""
  );
  const rawPhone = cleanText(
    headerValue(row, (key) => key === "נייד") ?? row["טלפון"] ?? row.phone ?? ""
  );
  const phone = normalizePhone(rawPhone);
  const sideValue = cleanText(
    row.guestSide ?? headerValue(row, (key) => key.startsWith("מהצד של")) ?? ""
  );
  const guestGroup = cleanText(
    headerValue(row, (key) => key === "שיוך לקבוצה") ??
      row["קטגוריה"] ??
      row.Category ??
      row.category ??
      row.guestGroup ??
      row.guestCategory ??
      (sideValue ? "" : row["צד"]) ??
      ""
  );
  const amountRaw =
    headerValue(row, (key) => key === "כמה יגיעו") ??
    row["כמות"] ??
    row["כמות מגיעים"] ??
    row["כמות אנשים"] ??
    row["מוזמנים"] ??
    row.amount ??
    row.count ??
    row.attendeesCount;
  const attendeesCount = Math.max(1, parseAttendeesCount(amountRaw));
  const statusRaw = cleanText(
    headerValue(row, (key) => key === "סטטוס הגעה") ?? row["סטטוס"] ?? row.status ?? ""
  );
  const status = mapArrivalStatus(statusRaw);
  const giftAmount = parseGiftAmount(
    row.giftAmount ?? headerValue(row, (key) => key === "סכום מתנה משוער") ?? row["סכום מתנה"] ?? 0
  );
  const email = cleanText(
    row.email ?? headerValue(row, (key) => key.toLowerCase() === "mail" || key === "אימייל" || key === "מייל") ?? ""
  );
  const notes = cleanText(row.notes ?? headerValue(row, (key) => key.startsWith("הערות")) ?? "");
  const enteredBy = cleanText(headerValue(row, (key) => key.startsWith("מספר הטלפון של המשתמש")) ?? "");
  const invitationSent = mapInvitationSent(
    row.invitationSent ?? headerValue(row, (key) => key.startsWith("האם נשלחה הזמנה")) ?? ""
  );
  return {
    fullName,
    rawPhone,
    phone,
    guestGroup,
    guestSide: sideValue,
    attendeesCount,
    status,
    giftAmount,
    email,
    notes: [notes, enteredBy && !notes.includes(enteredBy) ? `הוזן ע״י: ${enteredBy}` : ""].filter(Boolean).join("\n"),
    invitationSent
  };
}

export function makeFailedRow(rowNumber, name, reason) {
  return {
    rowNumber: Number(rowNumber) || null,
    name: String(name || "").trim(),
    reason: String(reason || "שגיאה לא ידועה")
  };
}

export function makeWarningRow(rowNumber, name, reason) {
  return makeFailedRow(rowNumber, name, reason);
}

/**
 * Validate one Excel/API guest row. Returns { empty }, { fail }, or { guest, warning? }.
 * Missing phone is allowed (imported as empty). Non-Israeli phones are ACCEPTED with a warning.
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

  const rawPhone = fields.rawPhone || "";
  const hasPhone = Boolean(rawPhone || fields.phone);

  // Allow guests without a phone number
  if (!hasPhone) {
    return {
      guest: {
        fullName: fields.fullName,
        phone: "",
        guestGroup: fields.guestGroup || "",
        guestSide: fields.guestSide || "",
        attendeesCount: fields.attendeesCount,
        status: fields.status,
        giftAmount: fields.giftAmount || 0,
        email: fields.email || "",
        notes: fields.notes || "",
        invitationSent: fields.invitationSent || "",
        rowNumber: Number(rowNumber) || null
      }
    };
  }

  if (!hasUsablePhoneDigits(rawPhone || fields.phone)) {
    return {
      fail: makeFailedRow(rowNumber, fields.fullName, "מספר טלפון לא ניתן לזיהוי")
    };
  }

  const guest = {
    fullName: fields.fullName,
    phone: fields.phone || String(rawPhone).replace(/\D/g, ""),
    guestGroup: fields.guestGroup || "",
    guestSide: fields.guestSide || "",
    attendeesCount: fields.attendeesCount,
    status: fields.status,
    giftAmount: fields.giftAmount || 0,
    email: fields.email || "",
    notes: fields.notes || "",
    invitationSent: fields.invitationSent || "",
    rowNumber: Number(rowNumber) || null
  };

  if (!isValidIsraeliMobilePhone(guest.phone)) {
    return {
      guest,
      warning: makeWarningRow(rowNumber, fields.fullName, NON_ISRAELI_PHONE_WARNING)
    };
  }

  return { guest };
}

/**
 * Map incoming guest payloads and collect failures + soft warnings.
 * Missing phones and non-Israeli numbers are imported (latter with a warning).
 */
export function processImportGuestBatch(rows) {
  const failedRows = [];
  const warningRows = [];
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
    const phoneKey = String(guest.phone || "").trim();
    if (phoneKey) {
      if (seenPhones.has(phoneKey)) {
        failedRows.push(
          makeFailedRow(
            rowNumber,
            guest.fullName,
            `מספר טלפון כבר מופיע בקובץ (כפילות עם שורה ${seenPhones.get(phoneKey)})`
          )
        );
        return;
      }
      seenPhones.set(phoneKey, rowNumber);
    }

    if (result.warning) warningRows.push(result.warning);
    validGuests.push(guest);
  });

  return { totalCount, validGuests, failedRows, warningRows };
}

/** Merge new category labels into event.guestCategories (case-insensitive unique). */
export async function registerEventGuestCategories(userId, categories = []) {
  const incoming = [...new Set((categories || []).map((item) => String(item || "").trim()).filter(Boolean))];
  if (!incoming.length) return [];

  const user = await User.findById(userId).select("event");
  if (!user) return incoming;

  if (!user.event) user.event = {};
  const existing = Array.isArray(user.event.guestCategories) ? user.event.guestCategories : [];
  const byKey = new Map(existing.map((item) => [String(item).trim().toLowerCase(), String(item).trim()]));
  let changed = false;
  incoming.forEach((item) => {
    const key = item.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, item);
      changed = true;
    }
  });
  if (!changed) return existing.map((item) => String(item).trim()).filter(Boolean);

  user.event.guestCategories = [...byKey.values()].sort((a, b) => a.localeCompare(b, "he"));
  user.markModified("event");
  await user.save();
  return user.event.guestCategories;
}
