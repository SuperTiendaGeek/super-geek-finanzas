"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <aside className="hidden min-h-screen w-64 flex-shrink-0 border-r border-slate-200 bg-white px-4 py-6 sm:flex">
      <div className="w-full space-y-6">
        <div className="text-lg font-semibold text-slate-900">Super Geek</div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 ${
                  isActive ? "bg-slate-100 text-slate-900" : "text-slate-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
