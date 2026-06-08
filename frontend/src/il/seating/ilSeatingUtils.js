export function makeSeatingId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function countGuestSeats(guest) {
  return Math.max(1, Number(guest?.attendeesCount || 1));
}

export function getTableOccupancy(guests, tableId) {
  return guests
    .filter((guest) => guest.seatingTableId === tableId)
    .reduce((sum, guest) => sum + countGuestSeats(guest), 0);
}

export function filterSeatingGuests(guests, { side, group, seated, query }) {
  return guests.filter((guest) => {
    if (!guest.isEligible) return false;
    if (side && guest.guestSide !== side) return false;
    if (group && guest.guestGroup !== group) return false;
    if (seated === "seated" && !guest.isSeated) return false;
    if (seated === "floating" && guest.isSeated) return false;
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    return (
      String(guest.fullName || "").toLowerCase().includes(q) ||
      String(guest.phone || "").includes(q) ||
      String(guest.guestGroup || "").toLowerCase().includes(q)
    );
  });
}

export function buildSeatingExportRows(guests, tables) {
  const tableMap = new Map(tables.map((table) => [table.tableId, table]));
  const perTable = tables.map((table) => {
    const seated = guests.filter((guest) => guest.seatingTableId === table.tableId && guest.isEligible);
    const seats = seated.reduce((sum, guest) => sum + countGuestSeats(guest), 0);
    return {
      שולחן: table.label,
      קיבולת: table.capacity,
      מושבים: seats,
      פנוי: Math.max(0, table.capacity - seats),
      אורחים: seated.map((guest) => guest.fullName).join(", ")
    };
  });

  const alphabetical = [...guests]
    .filter((guest) => guest.isEligible)
    .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), "he"))
    .map((guest) => {
      const table = tableMap.get(guest.seatingTableId);
      return {
        "שם מלא": guest.fullName,
        טלפון: guest.phone,
        כמות: countGuestSeats(guest),
        צד: guest.guestSide || "—",
        קבוצה: guest.guestGroup || "—",
        שולחן: table?.label || "צף",
        סטטוס: guest.isSeated ? "הושב" : "ממתין לשיבוץ"
      };
    });

  return { perTable, alphabetical };
}
