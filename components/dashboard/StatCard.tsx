import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/helpers";

const toneStyles: Record<string, string> = {
  neutral: "bg-[var(--card-bg)] border-[color:var(--border)]",
  green: "bg-[var(--tone-green-bg)] border-[color:var(--tone-green-border)]",
  red: "bg-[var(--tone-red-bg)] border-[color:var(--tone-red-border)]",
  amber: "bg-[var(--tone-amber-bg)] border-[color:var(--tone-amber-border)]",
  blue: "bg-[var(--tone-blue-bg)] border-[color:var(--tone-blue-border)]",
  violet: "bg-[var(--tone-violet-bg)] border-[color:var(--tone-violet-border)]",
  indigo: "bg-[var(--tone-indigo-bg)] border-[color:var(--tone-indigo-border)]",
};

interface StatCardProps {
  label: string;
  value: number;
  currency?: string;
  hint?: string;
  tone?: "neutral" | "green" | "red" | "amber" | "blue" | "violet" | "indigo";
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
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{displayValue}</p>
          {hint ? <p className="text-xs text-[var(--text-secondary)]">{hint}</p> : null}
        </div>
        {icon ? <div className="text-[var(--text-secondary)]">{icon}</div> : null}
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
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="text-sm text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

