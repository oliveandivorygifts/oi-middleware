/**
 * AUD currency formatting helper.
 * Keeps money display consistent across storefront and admin.
 *
 * @module
 */

const audCurrencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats an integer amount of cents into an Australian Dollar (AUD) string. */
export function formatCurrency(cents: number | null | undefined): string {
  return audCurrencyFormatter.format((cents || 0) / 100);
}
