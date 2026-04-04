import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, description, children, className = "" }: CardProps) {
  return (
    <div className={`rounded-xl border border-[color:var(--border)] bg-[var(--card-bg)] p-5 shadow-sm text-[var(--text-primary)] ${className}`.trim()}>
      {(title || description) && (
        <div className="mb-4">
          {title ? <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3> : null}
          {description ? <p className="text-sm text-[var(--text-secondary)]">{description}</p> : null}
        </div>
      )}
      {children}
    </div>
  );
}

