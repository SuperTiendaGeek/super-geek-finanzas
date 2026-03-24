"use client";

import { useMemo, useState } from "react";
import { Transaccion } from "@/types/transaccion";
import { StatCard } from "@/components/dashboard/StatCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/helpers";

interface Props {
  transacciones: Transaccion[];
  currency?: string;
}

type QuickRange = "custom" | "today" | "week" | "month";

function quickRangeDates(range: QuickRange) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "today") {
    return { from: iso(now), to: iso(now) };
  }
  if (range === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    const start = new Date(now);
    start.setDate(now.getDate() - diff);
    return { from: iso(start), to: iso(now) };
  }
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(start), to: iso(now) };
  }
  return { from: "", to: "" };
}

export default function TransaccionesTable({ transacciones, currency = "USD" }: Props) {
  const [searchRef, setSearchRef] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [conceptoFilter, setConceptoFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [metodoFilter, setMetodoFilter] = useState("");
  const [cuentaFilter, setCuentaFilter] = useState("");
  const [quickRange, setQuickRange] = useState<QuickRange>("custom");

  const tipos = useMemo(() => Array.from(new Set(transacciones.map((t) => t.tipoTransaccion || ""))).filter(Boolean), [transacciones]);
  const conceptos = useMemo(() => Array.from(new Set(transacciones.map((t) => t.concepto || ""))).filter(Boolean), [transacciones]);
  const estados = useMemo(() => Array.from(new Set(transacciones.map((t) => t.estado || ""))).filter(Boolean), [transacciones]);
  const metodos = useMemo(() => Array.from(new Set(transacciones.map((t) => t.metodoPago || ""))).filter(Boolean), [transacciones]);
  const cuentas = useMemo(() => {
    const set = new Set<string>();
    transacciones.forEach((t) => {
      if (t.cuentaOrigen) set.add(t.cuentaOrigen);
      if (t.cuentaDestino) set.add(t.cuentaDestino);
    });
    return Array.from(set).sort();
  }, [transacciones]);

  const filtered = useMemo(() => {
    return transacciones.filter((tx) => {
      if (searchRef && !(tx.referenciaExterna ?? "").toLowerCase().includes(searchRef.toLowerCase())) return false;
      if (tipoFilter && tx.tipoTransaccion !== tipoFilter) return false;
      if (conceptoFilter && tx.concepto !== conceptoFilter) return false;
      if (estadoFilter && tx.estado !== estadoFilter) return false;
      if (metodoFilter && tx.metodoPago !== metodoFilter) return false;
      if (cuentaFilter && tx.cuentaOrigen !== cuentaFilter && tx.cuentaDestino !== cuentaFilter) return false;
      if (dateFrom && new Date(tx.fecha) < new Date(dateFrom)) return false;
      if (dateTo && new Date(tx.fecha) > new Date(dateTo)) return false;
      return true;
    });
  }, [transacciones, searchRef, tipoFilter, conceptoFilter, estadoFilter, metodoFilter, cuentaFilter, dateFrom, dateTo]);

  const totalMonto = filtered.reduce((acc, t) => acc + (t.montoTotal || 0), 0);
  const totalIngresos = filtered.filter((t) => t.tipoTransaccion === "Ingreso").reduce((acc, t) => acc + (t.montoTotal || 0), 0);
  const totalEgresos = filtered.filter((t) => t.tipoTransaccion === "Egreso").reduce((acc, t) => acc + (t.montoTotal || 0), 0);
  const totalPendientes = filtered.filter((t) => (t.estado ?? "").toLowerCase().includes("pendiente"));

  const tipoBadge = (tipo: string) => {
    if (tipo === "Ingreso") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    if (tipo === "Egreso") return "bg-rose-50 text-rose-700 border border-rose-100";
    return "bg-indigo-50 text-indigo-700 border border-indigo-100";
  };

  const estadoBadge = (estado: string) => {
    const e = (estado || "").toLowerCase();
    if (["procesada", "confirmado", "confirmada", "acreditado", "acreditada"].includes(e))
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    if (e.includes("pendiente")) return "bg-amber-50 text-amber-700 border border-amber-100";
    if (e.includes("anul")) return "bg-rose-50 text-rose-700 border border-rose-100";
    return "bg-slate-50 text-slate-700 border border-slate-200";
  };

  const resetFilters = () => {
    setSearchRef("");
    setDateFrom("");
    setDateTo("");
    setTipoFilter("");
    setConceptoFilter("");
    setEstadoFilter("");
    setMetodoFilter("");
    setCuentaFilter("");
    setQuickRange("custom");
  };

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    const { from, to } = quickRangeDates(range);
    setDateFrom(from);
    setDateTo(to);
  };

  const handleExport = () => {
    const headersCsv = [
      "Fecha",
      "ID",
      "Tipo",
      "Concepto",
      "Origen",
      "Destino",
      "Método de pago",
      "Monto total",
      "Estado",
    ];
    const rows = filtered.map((tx) => [
      formatDate(tx.fecha),
      tx.idTransaccion ?? tx.id,
      tx.tipoTransaccion || "",
      tx.concepto || "",
      tx.cuentaOrigen ?? "",
      tx.cuentaDestino ?? "",
      tx.metodoPago ?? "",
      tx.montoTotal || 0,
      tx.estado ?? "",
    ]);
    const csv = [headersCsv.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `reporte_transacciones_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total transacciones" value={filtered.length} currency="" tone="neutral" />
        <StatCard label="Total ingresos" value={totalIngresos} currency={currency} tone="green" />
        <StatCard label="Total egresos" value={totalEgresos} currency={currency} tone="red" />
        <StatCard label="Pendientes" value={totalPendientes.length} currency="" tone="amber" />
        <StatCard label="Monto total movido" value={totalMonto} currency={currency} tone="indigo" />
      </div>

      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="Buscar referencia externa"
              className="input"
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
            />
            <select className="input" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}>
              <option value="">Tipo</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select className="input" value={conceptoFilter} onChange={(e) => setConceptoFilter(e.target.value)}>
              <option value="">Concepto</option>
              {conceptos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select className="input" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
              <option value="">Estado</option>
              {estados.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select className="input" value={metodoFilter} onChange={(e) => setMetodoFilter(e.target.value)}>
              <option value="">Método</option>
              {metodos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select className="input" value={cuentaFilter} onChange={(e) => setCuentaFilter(e.target.value)}>
              <option value="">Cuenta</option>
              {cuentas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <div className="flex gap-1">
              <Button size="sm" variant={quickRange === "today" ? "primary" : "ghost"} onClick={() => applyQuickRange("today")}>
                Hoy
              </Button>
              <Button size="sm" variant={quickRange === "week" ? "primary" : "ghost"} onClick={() => applyQuickRange("week")}>
                Esta semana
              </Button>
              <Button size="sm" variant={quickRange === "month" ? "primary" : "ghost"} onClick={() => applyQuickRange("month")}>
                Este mes
              </Button>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Limpiar filtros
              </Button>
              <Button size="sm" onClick={handleExport}>
                Exportar CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {searchRef ? <span className="chip">Ref: {searchRef}</span> : null}
            {tipoFilter ? <span className="chip">Tipo: {tipoFilter}</span> : null}
            {conceptoFilter ? <span className="chip">Concepto: {conceptoFilter}</span> : null}
            {estadoFilter ? <span className="chip">Estado: {estadoFilter}</span> : null}
            {metodoFilter ? <span className="chip">Método: {metodoFilter}</span> : null}
            {cuentaFilter ? <span className="chip">Cuenta: {cuentaFilter}</span> : null}
            {dateFrom ? <span className="chip">Desde: {formatDate(dateFrom)}</span> : null}
            {dateTo ? <span className="chip">Hasta: {formatDate(dateTo)}</span> : null}
            {quickRange !== "custom" ? <span className="chip">Rango rápido: {quickRange}</span> : null}
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Concepto</th>
                <th className="px-3 py-2 text-left">Origen</th>
                <th className="px-3 py-2 text-left">Destino</th>
                <th className="px-3 py-2 text-left">Método</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-left">{formatDate(txn.fecha)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-left">{txn.idTransaccion ?? txn.id}</td>
                  <td className="px-3 py-2 text-left">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tipoBadge(txn.tipoTransaccion)}`}>
                      {txn.tipoTransaccion || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-left">{txn.concepto || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-left">{txn.cuentaOrigen || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-left">{txn.cuentaDestino || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-left">{txn.metodoPago || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-semibold">
                    {formatCurrency(txn.montoTotal || 0, currency)}
                  </td>
                  <td className="px-3 py-2 text-left">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${estadoBadge(txn.estado)}`}>
                      {txn.estado || "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!filtered.length ? (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">No se encontraron transacciones con los filtros actuales.</div>
      ) : null}
    </div>
  );
}
