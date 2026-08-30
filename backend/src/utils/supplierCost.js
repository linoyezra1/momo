import ActivationCode from "../models/ActivationCode.js";
import User from "../models/User.js";

/** Standard agent / supplier share: ₪0.5 per WhatsApp message credit on a coupon. */
export const SUPPLIER_COST_PER_MESSAGE = 0.5;

/** Main agent (isMainAgent) supplier share per message credit. */
export const MAIN_AGENT_SUPPLIER_COST_PER_MESSAGE = 0.12;

export function resolveSupplierCostPerMessage(agent) {
  if (agent?.isMainAgent === true) {
    const fromEnv = Number(process.env.MAIN_AGENT_SUPPLIER_COST_PER_MESSAGE);
    if (Number.isFinite(fromEnv) && fromEnv >= 0) return fromEnv;
    return MAIN_AGENT_SUPPLIER_COST_PER_MESSAGE;
  }
  return SUPPLIER_COST_PER_MESSAGE;
}

export function supplierCostForCredits(totalCredits, costPerMessage = SUPPLIER_COST_PER_MESSAGE) {
  const credits = Math.max(0, Number(totalCredits) || 0);
  const rate = Math.max(0, Number(costPerMessage) || 0);
  return Math.round(credits * rate * 100) / 100;
}

export function mapCouponWithSupplierCost(item, costPerMessage = SUPPLIER_COST_PER_MESSAGE) {
  const totalCredits = Number(item?.total_credits) || 0;
  return {
    codeId: item._id,
    code: item.code,
    total_credits: totalCredits,
    remaining_credits: Number(item.remaining_credits) || 0,
    isActive: item.isActive !== false,
    note: item.note || "",
    createdAt: item.createdAt,
    supplierCost: supplierCostForCredits(totalCredits, costPerMessage)
  };
}

export async function listClientCouponsWithSupplierCost(userId, costPerMessage = SUPPLIER_COST_PER_MESSAGE) {
  const allCoupons = await ActivationCode.find({ redeemedByUserId: userId })
    .sort({ createdAt: -1 })
    .select("code total_credits remaining_credits isActive note createdAt");
  return allCoupons.map((item) => mapCouponWithSupplierCost(item, costPerMessage));
}

export function sumSupplierCostFromCoupons(coupons = []) {
  return Math.round(
    coupons.reduce((sum, coupon) => sum + (Number(coupon.supplierCost) || 0), 0) * 100
  ) / 100;
}

/** Persist deal.supplierCost = sum of (credits × 0.5) for all coupons on the client. */
export async function recalculateUserSupplierCost(userId) {
  if (!userId) return null;
  const coupons = await listClientCouponsWithSupplierCost(userId);
  const total = sumSupplierCostFromCoupons(coupons);
  const user = await User.findById(userId);
  if (!user) return null;
  if (!user.deal) user.deal = {};
  user.deal.supplierCost = total;
  user.markModified("deal");
  await user.save();
  return { total, coupons };
}
