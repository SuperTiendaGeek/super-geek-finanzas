import { DATE_LOCALE, DEFAULT_CURRENCY } from "@/lib/constants";

export function formatCurrency(value: number, currency: string = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(DATE_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDate(input?: string | number | Date) {
  if (!input) return "--";
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
