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

/**
 * Redondea montos monetarios a 2 decimales de forma consistente, eliminando residuos flotantes.
 * Ej: 0.0099999999 -> 0.01, 0.0000001 -> 0.00
 */
export function roundMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  const num = Number(value) || 0;
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor;
  return Math.abs(rounded) < 1 / (factor * 10) ? 0 : rounded;
}
