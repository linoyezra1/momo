export function sanitizeEventVendorFinancePayload(body = {}) {
  const status = String(body.status || "OFFER_SENT").trim();
  const vendorQuoteAmount = Math.max(0, Number(body.vendorQuoteAmount ?? body.quoteAmount) || 0);
  const couplePrice = Math.max(0, Number(body.couplePrice) || 0);
  return {
    quoteAmount: vendorQuoteAmount,
    vendorQuoteAmount,
    couplePrice,
    status,
    eventNotes: String(body.eventNotes || "").trim(),
    attachmentUrl: String(body.attachmentUrl || "").trim()
  };
}

export function serializeEventVendorFinance(doc, serializeVendor) {
  const vendor = doc.vendorId && typeof doc.vendorId === "object" ? doc.vendorId : null;
  const vendorQuoteAmount = Math.max(0, Number(doc.vendorQuoteAmount ?? doc.quoteAmount) || 0);
  const couplePrice = Math.max(0, Number(doc.couplePrice) || 0);
  return {
    id: String(doc._id),
    eventId: String(doc.eventId?._id || doc.eventId),
    vendorId: String(vendor?._id || doc.vendorId),
    quoteAmount: vendorQuoteAmount,
    vendorQuoteAmount,
    couplePrice,
    profit: couplePrice - vendorQuoteAmount,
    status: doc.status,
    eventNotes: doc.eventNotes || "",
    attachmentUrl: doc.attachmentUrl || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    vendor: vendor && serializeVendor ? serializeVendor(vendor) : vendor
  };
}

export function buildVendorAmountSummary(entries) {
  return entries.reduce(
    (acc, item) => {
      const cost = Number(item.vendorQuoteAmount ?? item.quoteAmount ?? 0);
      const revenue = Number(item.couplePrice || 0);
      acc.totalProposed += cost;
      acc.totalCost += cost;
      acc.totalRevenue += revenue;
      acc.totalProfit += revenue - cost;
      if (item.status === "BOOKED") {
        acc.totalBooked += cost;
        acc.totalBookedRevenue += revenue;
      }
      return acc;
    },
    {
      totalProposed: 0,
      totalBooked: 0,
      totalCost: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalBookedRevenue: 0
    }
  );
}

export function serializeFinance(finance = {}) {
  return {
    targetCoupleBudget: Math.max(0, Number(finance.targetCoupleBudget) || 0),
    couplePaymentStatus: finance.couplePaymentStatus || "PENDING",
    couplePaymentNotes: finance.couplePaymentNotes || ""
  };
}

export function sanitizeFinancePayload(body = {}) {
  const status = String(body.couplePaymentStatus || "PENDING").trim();
  const allowed = ["PENDING", "PARTIAL", "PAID"];
  return {
    targetCoupleBudget: Math.max(0, Number(body.targetCoupleBudget) || 0),
    couplePaymentStatus: allowed.includes(status) ? status : "PENDING",
    couplePaymentNotes: String(body.couplePaymentNotes || "").trim()
  };
}

export function buildBudgetWarning({ totalRevenue, targetCoupleBudget }) {
  const target = Math.max(0, Number(targetCoupleBudget) || 0);
  const revenue = Math.max(0, Number(totalRevenue) || 0);
  if (target > 0 && revenue > target) {
    return {
      exceeded: true,
      message: "חריגה מתקציב היעד",
      overBy: revenue - target
    };
  }
  return { exceeded: false, message: "", overBy: 0 };
}
