/**
 * Currency and number formatting utilities for OddsMatrix
 * Formats all bankroll, stakes, and payouts into Indonesian Rupiah (IDR / Rp)
 */

export const formatIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
};
