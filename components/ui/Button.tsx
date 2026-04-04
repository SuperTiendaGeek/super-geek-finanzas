import type { ButtonHTMLAttributes } from "react";

const variantStyles: Record<string, string> = {
  primary:
    "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-bg-hover)] focus:ring-2 focus:ring-[var(--btn-primary-ring)]",
  secondary:
    "bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border border-[color:var(--border)] hover:border-[color:var(--border-strong)]",
  ghost: "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-muted)]",
};

type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: ButtonSize;
}

export default function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition focus:outline-none";
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const variantClass = variantStyles[variant] ?? variantStyles.primary;

  return (
    <button
      type={type}
      className={`${baseStyles} ${sizeClass} ${variantClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

