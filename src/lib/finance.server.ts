import "server-only";

import { VAT_RATE } from "@/constants/finance";

/** Net profit = (ablFee / (1 + VAT)) - adverts - govFee */
export function calcNetProfit(
  ablFee: number | null,
  govFee: number | null,
  adverts: number | null
): number {
  const net = (ablFee ?? 0) / (1 + VAT_RATE);
  return Math.round((net - (adverts ?? 0) - (govFee ?? 0)) * 100) / 100;
}

/** VAT liability = ablFee - (ablFee / 1.23) */
export function calcVatLiability(ablFee: number | null): number {
  const fee = ablFee ?? 0;
  return Math.round((fee - fee / (1 + VAT_RATE)) * 100) / 100;
}

/** Profit margin % = (netProfit / totalRevenue) × 100 */
export function calcProfitMargin(
  netProfit: number,
  totalRevenue: number
): number {
  if (totalRevenue === 0) return 0;
  return Math.round((netProfit / totalRevenue) * 1000) / 10;
}
