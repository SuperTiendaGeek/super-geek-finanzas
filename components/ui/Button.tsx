import type { ButtonHTMLAttributes } from "react";

const variantStyles: Record<string, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 focus:ring-2 focus:ring-slate-400",
  secondary:
    "bg-white text-slate-900 border border-slate-200 hover:border-slate-300",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export default function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none";
  const variantClass = variantStyles[variant] ?? variantStyles.primary;

  return (
    <button
      type={type}
      className={`${baseStyles} ${variantClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
