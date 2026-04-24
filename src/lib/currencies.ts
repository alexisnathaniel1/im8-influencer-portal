// Supported currencies for deal amounts. Keep in sync with whatever your
// finance team needs. Symbol is used for inline display; code is what's
// stored in deals.currency_code.
export const CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

export function currencySymbol(code: string | null | undefined): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? "$";
}

export function formatMoney(cents: number | null | undefined, code: string | null | undefined): string {
  if (cents == null) return "—";
  const sym = currencySymbol(code);
  return `${sym}${(cents / 100).toLocaleString()}`;
}
