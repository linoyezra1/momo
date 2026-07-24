/**
 * Couple vendor access:
 * - managedBy === "eventManager" → vendors/budget handled by manager only (403)
 * - otherwise (admin-created / unmanaged) → couple may manage a simplified vendor view
 */

export function coupleHasEventManager(user) {
  return String(user?.managedBy || "") === "eventManager";
}

export function coupleCanManageVendors(user) {
  return Boolean(user) && !coupleHasEventManager(user);
}

/** Couple-safe EventVendor JSON — no vendor cost / profit margins. */
export function serializeCoupleEventVendor(doc, serializeVendor) {
  const vendor = doc.vendorId && typeof doc.vendorId === "object" ? doc.vendorId : null;
  const agreedPrice = Math.max(0, Number(doc.couplePrice) || 0);
  let status = doc.status || "NEGOTIATING";
  if (status === "OFFER_SENT") status = "NEGOTIATING";

  return {
    id: String(doc._id),
    eventId: String(doc.eventId?._id || doc.eventId),
    vendorId: String(vendor?._id || doc.vendorId),
    agreedPrice,
    status,
    eventNotes: doc.eventNotes || "",
    attachmentUrl: doc.attachmentUrl || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    vendor: vendor && serializeVendor ? serializeVendor(vendor) : vendor
  };
}

/** Accept only couple-facing fields; map agreedPrice → couplePrice, zero out cost. */
export function sanitizeCoupleEventVendorPayload(body = {}) {
  let status = String(body.status || "NEGOTIATING").trim();
  if (status === "OFFER_SENT") status = "NEGOTIATING";
  const allowed = ["NEGOTIATING", "BOOKED", "REJECTED"];
  if (!allowed.includes(status)) status = "NEGOTIATING";

  const agreedPrice = Math.max(
    0,
    Number(body.agreedPrice ?? body.couplePrice ?? body.quoteAmount) || 0
  );

  return {
    couplePrice: agreedPrice,
    vendorQuoteAmount: 0,
    quoteAmount: 0,
    status,
    eventNotes: String(body.eventNotes || "").trim(),
    attachmentUrl: String(body.attachmentUrl || "").trim()
  };
}
