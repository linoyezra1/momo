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

export function autoAssignGuestsToTables(guests, tables) {
  const eligible = guests.filter((guest) => isGuestEligibleForSeating(guest) && !guest.seatingTableId);
  const sortedTables = [...tables].sort((a, b) => String(a.label).localeCompare(String(b.label), "he"));
  const occupancy = buildTableOccupancy(guests, tables);
  const assignments = [];

  const guestsByGroup = new Map();
  for (const guest of eligible) {
    const key = String(guest.guestGroup || "ללא קבוצה").trim() || "ללא קבוצה";
    if (!guestsByGroup.has(key)) guestsByGroup.set(key, []);
    guestsByGroup.get(key).push(guest);
  }

  for (const groupGuests of guestsByGroup.values()) {
    for (const guest of groupGuests) {
      const seatsNeeded = countSeatsForGuest(guest);
      const targetTable = sortedTables.find((table) => {
        const bucket = occupancy.get(table.tableId);
        return bucket.seats + seatsNeeded <= table.capacity;
      });
      if (!targetTable) continue;
      assignments.push({ guestId: String(guest._id), tableId: targetTable.tableId });
      occupancy.get(targetTable.tableId).seats += seatsNeeded;
    }
  }

  return assignments;
}
