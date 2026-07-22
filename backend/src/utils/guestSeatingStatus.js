/**
 * Side-effects when a guest RSVP status changes while seated.
 */
export function applyDeclinedWhileSeatedSideEffect(guest, nextStatus) {
  if (!guest) return guest;
  if (nextStatus === "לא מגיע" && guest.seatingTableId) {
    guest.declinedWhileSeatedAt = new Date();
  } else if (nextStatus && nextStatus !== "לא מגיע") {
    guest.declinedWhileSeatedAt = undefined;
  }
  return guest;
}

export function declinedWhileSeatedUpdateFields(guest, nextStatus) {
  if (nextStatus === "לא מגיע" && guest?.seatingTableId) {
    return { declinedWhileSeatedAt: new Date() };
  }
  if (nextStatus && nextStatus !== "לא מגיע") {
    return { declinedWhileSeatedAt: null };
  }
  return {};
}
