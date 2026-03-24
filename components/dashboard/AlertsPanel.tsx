import type { ReactNode } from "react";

interface AlertProps {
  title: string;
  items: ReactNode[];
}

export default function AlertsPanel({ title, items }: AlertProps) {
  const hasItems = items.length > 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">Revisa pendientes y observaciones</p>
        </div>
        <span className="text-xs text-slate-500">{items.length}</span>
      </div>
      {hasItems ? (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
          No hay alertas en este momento.
        </div>
      )}
    </div>
  );
}
