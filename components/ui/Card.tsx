import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export default function Card({ title, description, children }: CardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {(title || description) && (
        <div className="mb-4">
          {title ? <h3 className="text-base font-semibold text-slate-900">{title}</h3> : null}
          {description ? (
            <p className="text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
