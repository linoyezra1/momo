import ActivationCode from "../models/ActivationCode.js";
import User from "../models/User.js";

/** Agent / supplier share: ₪0.5 per WhatsApp message credit on a coupon. */
export const SUPPLIER_COST_PER_MESSAGE = 0.5;

export function supplierCostForCredits(totalCredits) {
  const credits = Math.max(0, Number(totalCredits) || 0);
  return Math.round(credits * SUPPLIER_COST_PER_MESSAGE * 100) / 100;
}

export function mapCouponWithSupplierCost(item) {
  const totalCredits = Number(item?.total_credits) || 0;
  return {
    codeId: item._id,
    code: item.code,
    total_credits: totalCredits,
    remaining_credits: Number(item.remaining_credits) || 0,
    isActive: item.isActive !== false,
    note: item.note || "",
    createdAt: item.createdAt,
    supplierCost: supplierCostForCredits(totalCredits)
  };
}

export async function listClientCouponsWithSupplierCost(userId) {
  const allCoupons = await ActivationCode.find({ redeemedByUserId: userId })
    .sort({ createdAt: -1 })
    .select("code total_credits remaining_credits isActive note createdAt");
  return allCoupons.map(mapCouponWithSupplierCost);
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
