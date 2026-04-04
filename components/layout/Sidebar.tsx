"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme/ThemeProvider";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Cuentas", href: "/cuentas" },
  { label: "Transacciones", href: "/transacciones" },
  { label: "Ingresos", href: "/ingresos/nuevo" },
  { label: "Egresos", href: "/egresos/nuevo" },
  { label: "Movimientos", href: "/movimientos/nuevo" },
  { label: "Pendientes", href: "/pendientes" },
  { label: "Reportes", href: "/reportes" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside className="hidden min-h-screen w-64 flex-shrink-0 border-r border-[color:var(--border)] bg-[var(--sidebar-bg)] px-4 py-6 sm:flex text-[var(--text-primary)]">
      <div className="w-full space-y-6">
        <div className="text-lg font-semibold">Super Geek</div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="pt-4 border-t border-[color:var(--border)]">
          <button
            onClick={toggle}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            <span>Modo oscuro</span>
            <span
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                isDark ? "bg-slate-400" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  isDark ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
