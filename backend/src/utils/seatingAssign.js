const ATTENDING_STATUSES = new Set(["מגיע", "אולי"]);

export function isGuestEligibleForSeating(guest) {
  return ATTENDING_STATUSES.has(guest?.status);
}

export function countSeatsForGuest(guest) {
  return Math.max(1, Number(guest?.attendeesCount || 1));
}

export function buildTableOccupancy(guests, tables) {
  const byTable = new Map(tables.map((table) => [table.tableId, { table, seats: 0, guestIds: [] }]));
  for (const guest of guests) {
    if (!guest.seatingTableId || !byTable.has(guest.seatingTableId)) continue;
    const bucket = byTable.get(guest.seatingTableId);
    bucket.seats += countSeatsForGuest(guest);
    bucket.guestIds.push(String(guest._id));
  }
  return byTable;
}

export function buildSeatingWarnings(guests, tables) {
  const occupancy = buildTableOccupancy(guests, tables);
  const warnings = [];

  for (const { table, seats } of occupancy.values()) {
    if (seats > table.capacity) {
      warnings.push({
        type: "overfill",
        tableId: table.tableId,
        label: table.label,
        seats,
        capacity: table.capacity,
        message: `בשולחן ${table.label} יש ${seats} אורחים מתוך ${table.capacity} — חריגה ממכסה`
      });
    } else if (seats > 0 && seats < table.capacity * 0.6) {
      warnings.push({
        type: "underfill",
        tableId: table.tableId,
        label: table.label,
        seats,
        capacity: table.capacity,
        message: `בשולחן ${table.label} יש רק ${seats} אורחים מתוך ${table.capacity}`
      });
    }
  }

  return warnings;
}

export function buildSeatingAnalytics(guests, tables) {
  const eligible = guests.filter(isGuestEligibleForSeating);
  const totalInvitedSeats = eligible.reduce((sum, guest) => sum + countSeatsForGuest(guest), 0);
  const seatedGuests = eligible.filter((guest) => guest.seatingTableId);
  const seatedSeats = seatedGuests.reduce((sum, guest) => sum + countSeatsForGuest(guest), 0);
  const totalCapacity = tables.reduce((sum, table) => sum + Number(table.capacity || 0), 0);
  const floatingSeats = Math.max(0, totalInvitedSeats - seatedSeats);

  return {
    tableCount: tables.length,
    totalCapacity,
    totalInvitedSeats,
    seatedSeats,
    floatingSeats,
    seatedGuestCount: seatedGuests.length,
    floatingGuestCount: eligible.length - seatedGuests.length,
    utilizationPercent: totalCapacity ? Math.round((seatedSeats / totalCapacity) * 100) : 0
  };
}
