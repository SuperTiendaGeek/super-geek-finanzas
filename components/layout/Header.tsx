import type { ReactNode } from "react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="flex flex-col gap-2 border-b border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {title ?? ""}
        </h1>
        {subtitle ? (
          <p className="text-sm text-slate-600">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
