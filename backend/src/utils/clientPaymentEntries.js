const DEAL_PAYMENT_METHODS = new Set(["bit", "paybox", "bank_transfer", "cash", "other"]);

const PAYMENT_METHOD_LABELS = {
  bit: "ביט",
  paybox: "פייבוקס",
  bank_transfer: "העברה בנקאית",
  cash: "מזומן",
  other: "אחר"
};

export function serializePaymentEntry(entry) {
  if (!entry) return null;
  const raw = typeof entry.toObject === "function" ? entry.toObject() : entry;
  const method = DEAL_PAYMENT_METHODS.has(String(raw.paymentMethod || "").trim())
    ? String(raw.paymentMethod).trim()
    : "other";
  return {
    id: raw._id ? String(raw._id) : "",
    quoteText: String(raw.quoteText || "").trim(),
    amount: Math.max(0, Number(raw.amount) || 0),
    isPaid: raw.isPaid === true,
    paymentMethod: method,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[method] || method,
    paidAt: raw.paidAt || null,
    createdAt: raw.createdAt || null
  };
}

export function normalizePaymentEntryInput(raw = {}, existing = null) {
  const base = existing ? serializePaymentEntry(existing) : null;
  const amountRaw = raw.amount !== undefined ? raw.amount : base?.amount;
  const amount = Math.max(0, Number(amountRaw) || 0);
  const isPaid =
    raw.isPaid !== undefined ? raw.isPaid === true : base ? base.isPaid === true : false;
  const methodRaw = String(
    raw.paymentMethod !== undefined ? raw.paymentMethod : base?.paymentMethod || "other"
  ).trim();
  const paymentMethod = DEAL_PAYMENT_METHODS.has(methodRaw) ? methodRaw : "other";

  let paidAt = null;
  if (isPaid) {
    const incoming = raw.paidAt !== undefined ? raw.paidAt : base?.paidAt;
    if (incoming) {
      const parsed = new Date(incoming);
      paidAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      paidAt = new Date();
    }
  }

  return {
    quoteText: String(
      raw.quoteText !== undefined ? raw.quoteText : base?.quoteText || ""
    ).trim(),
    amount,
    isPaid,
    paymentMethod,
    paidAt,
    createdAt: base?.createdAt ? new Date(base.createdAt) : new Date()
  };
}

export function listPaymentEntries(deal) {
  const entries = Array.isArray(deal?.paymentEntries) ? deal.paymentEntries : [];
  return entries.map(serializePaymentEntry).filter(Boolean);
}

export function sumPaidPaymentEntries(deal) {
  return listPaymentEntries(deal)
    .filter((entry) => entry.isPaid)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
}

/**
 * Revenue for a client: paid installments if any entries exist, else legacy fields.
 */
export function resolveClientRevenue(userOrDeal, payment = null) {
  const deal = userOrDeal?.deal ? userOrDeal.deal : userOrDeal || {};
  const pay = payment || userOrDeal?.payment || {};
  const entries = listPaymentEntries(deal);
  if (entries.length) {
    return sumPaidPaymentEntries(deal);
  }
  const fromPackage = Number(deal.packagePrice);
  const fromDeal = Number(deal.paymentAmount);
  const fromPayment = Number(pay.amountPaid) || 0;
  if (Number.isFinite(fromPackage) && fromPackage > 0) return fromPackage;
  if (Number.isFinite(fromDeal) && fromDeal > 0) return fromDeal;
  return fromPayment;
}

export function syncDealPaymentTotalsFromEntries(user) {
  if (!user) return 0;
  const deal = user.deal || {};
  const entries = Array.isArray(deal.paymentEntries) ? deal.paymentEntries : [];
  if (!entries.length) return Number(deal.paymentAmount) || 0;

  const paidTotal = entries
    .filter((entry) => entry.isPaid === true)
    .reduce((sum, entry) => sum + (Math.max(0, Number(entry.amount) || 0)), 0);

  const paidMethods = entries
    .filter((entry) => entry.isPaid === true)
    .map((entry) => String(entry.paymentMethod || "other"));
  const lastMethod = paidMethods.length ? paidMethods[paidMethods.length - 1] : "other";

  user.deal = {
    ...(typeof deal.toObject === "function" ? deal.toObject() : { ...deal }),
    paymentAmount: paidTotal,
    paymentMethod: DEAL_PAYMENT_METHODS.has(lastMethod) ? lastMethod : "other",
    paymentEntries: entries
  };
  user.markModified?.("deal");
  user.payment = {
    amountPaid: paidTotal,
    paymentMethod: PAYMENT_METHOD_LABELS[lastMethod] || lastMethod
  };
  return paidTotal;
}

export function monthKeyFromDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthLabelHe(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || "";
  const [y, m] = monthKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}
