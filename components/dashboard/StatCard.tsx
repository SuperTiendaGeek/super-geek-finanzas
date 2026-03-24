import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/helpers";

const toneStyles: Record<string, string> = {
  neutral: "bg-white border-slate-200",
  green: "bg-emerald-50 border-emerald-100",
  red: "bg-rose-50 border-rose-100",
  amber: "bg-amber-50 border-amber-100",
  blue: "bg-sky-50 border-sky-100",
  violet: "bg-violet-50 border-violet-100",
};

interface StatCardProps {
  label: string;
  value: number;
  currency?: string;
  hint?: string;
  tone?: "neutral" | "green" | "red" | "amber" | "blue" | "violet";
  icon?: ReactNode;
}

export function StatCard({ label, value, currency = "USD", hint, tone = "neutral", icon }: StatCardProps) {
  const toneClass = toneStyles[tone] ?? toneStyles.neutral;
  const hasCurrency = Boolean(currency && currency.trim());
  const displayValue = hasCurrency
    ? formatCurrency(value, currency)
    : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-900">{displayValue}</p>
          {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
        {icon ? <div className="text-slate-600">{icon}</div> : null}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
