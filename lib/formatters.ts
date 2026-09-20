/**
 * Currency and number formatting utilities for OddsMatrix
 * Formats all bankroll, stakes, and payouts into Indonesian Rupiah (IDR / Rp)
 */

export const formatIDR = (amount: number): string => {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rp 0';
  }
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

  // Ensure clean format: "Rp X.XXX.XXX"
  return formatted.replace(/\u00a0/g, ' ').trim();
};

export const roundToCleanIDR = (amount: number): number => {
  if (amount <= 10000) return Math.max(1000, Math.round(amount / 1000) * 1000);
  if (amount <= 100000) return Math.round(amount / 5000) * 5000;
  return Math.round(amount / 10000) * 10000;
};
