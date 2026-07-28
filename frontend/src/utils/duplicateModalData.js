import { formatGuestDuplicateStatus } from "./guestDuplicate.js";

export function buildManualDuplicateConflict({ phone, existing, incoming }) {
  const incomingCount = Math.max(1, Number(incoming?.attendeesCount) || 1);
  return {
    id: phone,
    phone,
    existing: {
      name: existing?.fullName || "—",
      lines: [`סטטוס: ${formatGuestDuplicateStatus(existing)}`]
    },
    incoming: {
      name: incoming?.fullName || "—",
      lines: [`${incomingCount} מגיעים`]
    }
  };
}

export function buildContactsDuplicateConflicts(conflicts = []) {
  return conflicts.map((item) => {
    const incomingCount = Math.max(1, Number(item.incoming?.attendeesCount) || 1);
    return {
      id: item.phone,
      phone: item.phone,
      existing: {
        name: item.existing?.fullName || "—",
        lines: [formatGuestDuplicateStatus(item.existing)]
      },
      incoming: {
        name: item.incoming?.fullName || "—",
        lines: [`${incomingCount} מגיעים`, "מקור: אנשי קשר"]
      }
    };
  });
}

export function buildExcelDuplicateConflicts(conflicts = [], sourceLabel) {
  return conflicts.map((item) => ({
    id: item.phone,
    phone: item.phone,
    rowLabel: item.rowNumber ? `שורה ${item.rowNumber}` : undefined,
    existing: {
      name: item.existing?.fullName || "—",
      lines: [
        `כמות ${item.existing?.attendeesCount ?? "—"}`,
        `מקור: ${sourceLabel(item.existing?.source)}`
      ]
    },
    incoming: {
      name: item.excel?.fullName || "—",
      lines: [`כמות ${item.excel?.attendeesCount ?? "—"}`]
    }
  }));
}
