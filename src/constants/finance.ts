export const VAT_RATE = 0.23;

/** Extract VAT from ABL fee (VAT is included in the fee). ablFee / 1.23 × 0.23 */
export function calcVat(ablFee: number | null): number {
  const fee = ablFee ?? 0;
  return Math.round((fee - fee / (1 + VAT_RATE)) * 100) / 100;
}

/** ABL fee (VAT-inclusive) + Gov Fee + Adverts. VAT is NOT added on top. */
export function calcTotal(
  ablFee: number | null,
  govFee: number | null,
  adverts: number | null
): number {
  return Math.round(((ablFee ?? 0) + (govFee ?? 0) + (adverts ?? 0)) * 100) / 100;
}

export function calcDue(total: number, paidAmount: number): number {
  return Math.round((total - paidAmount) * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}
