"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/helpers";
import { Cuenta } from "@/types/cuenta";

interface Props {
  cuentas: Cuenta[];
  currencyFallback?: string;
}

type SortKey = "nombre" | "saldo" | "tipo" | "activa";

type QuickFilter =
  | "todas"
  | "activas"
  | "inactivas"
  | "bancarias"
  | "caja"
  | "temporal"
  | "con_saldo"
  | "sin_saldo";

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none";

function BooleanBadge({ value, label }: { value: boolean; label: string }) {
  return (
    <Badge className={value ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
      {label}
    </Badge>
  );
}

function tipoBadge(tipo: string) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("banca")) return "bg-sky-100 text-sky-700";
  if (t.includes("caja")) return "bg-emerald-100 text-emerald-700";
  if (t.includes("temp")) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

export default function CuentasTable({ cuentas, currencyFallback = "USD" }: Props) {
  const [search, setSearch] = useState("");
  const [tipoSearch, setTipoSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("todas");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const normalized = useMemo(() => {
    const term = search.toLowerCase();
    const termTipo = tipoSearch.toLowerCase();

    let list = cuentas;

    if (term) {
      list = list.filter((c) => c.nombre.toLowerCase().includes(term));
    }
    if (termTipo) {
      list = list.filter((c) => (c.tipoCuenta || "").toLowerCase().includes(termTipo));
    }

    switch (quick) {
      case "activas":
        list = list.filter((c) => c.activa);
        break;
      case "inactivas":
        list = list.filter((c) => !c.activa);
        break;
      case "bancarias":
        list = list.filter((c) => (c.tipoCuenta || "").toLowerCase().includes("banca"));
        break;
      case "caja":
        list = list.filter((c) => (c.tipoCuenta || "").toLowerCase().includes("caja"));
        break;
      case "temporal":
        list = list.filter((c) => (c.tipoCuenta || "").toLowerCase().includes("temp"));
        break;
      case "con_saldo":
        list = list.filter((c) => (c.saldo ?? 0) > 0);
        break;
      case "sin_saldo":
        list = list.filter((c) => (c.saldo ?? 0) === 0);
        break;
      default:
        break;
    }

    const sorted = [...list].sort((a, b) => {
      if (sortKey === "saldo") {
        const diff = (a.saldo ?? 0) - (b.saldo ?? 0);
        return sortDir === "asc" ? diff : -diff;
      }
      if (sortKey === "tipo") {
        return sortDir === "asc"
          ? (a.tipoCuenta || "").localeCompare(b.tipoCuenta || "")
          : (b.tipoCuenta || "").localeCompare(a.tipoCuenta || "");
      }
      if (sortKey === "activa") {
        const diff = Number(a.activa) - Number(b.activa);
        return sortDir === "asc" ? diff : -diff;
      }
      // nombre
      return sortDir === "asc"
        ? a.nombre.localeCompare(b.nombre)
        : b.nombre.localeCompare(a.nombre);
    });

    return sorted;
  }, [cuentas, search, tipoSearch, quick, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (!cuentas.length) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Aún no hay cuentas registradas.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre"
            className={inputClass}
          />
          <input
            type="text"
            value={tipoSearch}
            onChange={(e) => setTipoSearch(e.target.value)}
            placeholder="Filtrar por tipo de cuenta"
            className={inputClass}
          />
          <div className="flex gap-2">
            <select
              value={quick}
              onChange={(e) => setQuick(e.target.value as QuickFilter)}
              className={inputClass}
            >
              <option value="todas">Todas</option>
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
              <option value="bancarias">Bancarias</option>
              <option value="caja">Caja</option>
              <option value="temporal">Temporales</option>
              <option value="con_saldo">Con saldo</option>
              <option value="sin_saldo">Sin saldo</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={inputClass}
            >
              <option value="nombre">Nombre</option>
              <option value="saldo">Saldo</option>
              <option value="tipo">Tipo de cuenta</option>
              <option value="activa">Estado</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="rounded-md border border-[color:var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              {sortDir === "asc" ? "Asc" : "Desc"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium cursor-pointer" onClick={() => toggleSort("nombre")}>
                  Nombre
                </th>
                <th className="px-3 py-2 font-medium cursor-pointer" onClick={() => toggleSort("tipo")}>Tipo</th>
                <th className="px-3 py-2 font-medium">Permite</th>
                <th className="px-3 py-2 font-medium cursor-pointer" onClick={() => toggleSort("activa")}>
                  Estado
                </th>
                <th className="px-3 py-2 font-medium cursor-pointer" onClick={() => toggleSort("saldo")}>
                  Saldo actual
                </th>
                <th className="px-3 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {normalized.map((cuenta) => {
                const currency = cuenta.moneda ?? currencyFallback;
                const saldo = cuenta.saldo ?? 0;
                const tipoClass = tipoBadge(cuenta.tipoCuenta);

                return (
                  <tr key={cuenta.id} className="row hoverable">
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-900">{cuenta.nombre}</p>
                        <Badge className={tipoClass}>{cuenta.tipoCuenta || "--"}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{cuenta.tipoCuenta}</td>
                    <td className="px-3 py-2 space-x-1 whitespace-nowrap">
                      <BooleanBadge value={cuenta.permiteIngresos} label="Ing" />
                      <BooleanBadge value={cuenta.permiteEgresos} label="Egr" />
                      <BooleanBadge value={cuenta.permiteTransferencias} label="Trf" />
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={cuenta.activa ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                        {cuenta.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-900">
                      {formatCurrency(saldo, currency)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link
                        href={`/cuentas/${encodeURIComponent(cuenta.id)}`}
                        className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
