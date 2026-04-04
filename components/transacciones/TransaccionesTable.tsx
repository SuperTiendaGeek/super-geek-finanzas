"use client";

import { useEffect, useMemo, useState } from "react";
import { Transaccion } from "@/types/transaccion";
import { StatCard } from "@/components/dashboard/StatCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/helpers";

interface Props {
  transacciones: Transaccion[];
  currency?: string;
  pendientesTotal?: number;
}

type QuickRange = "custom" | "today" | "week" | "month";
type QuickFilter = "todas" | "reales" | "internos" | "ventas" | "acreditaciones" | "distribuciones";

const PENDING_METHODS = ["datafast", "payphone", "paypal", "mixto"];

function quickRangeDates(range: QuickRange) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (range === "today") return { from: iso(now), to: iso(now) };
  if (range === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
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

const normalize = (v?: string | null) => (v ?? "").toLowerCase();

function isPending(tx: Transaccion) {
  return normalize(tx.estado).includes("pend");
}
function isCanceled(tx: Transaccion) {
  const e = normalize(tx.estado);
  return e.includes("anul") || e.includes("cancel");
}
function isConfirmed(tx: Transaccion) {
  const e = normalize(tx.estado);
  if (!e) return true;
  return !isPending(tx) && !isCanceled(tx);
}
function isIngreso(tx: Transaccion) {
  return normalize(tx.tipoTransaccion).includes("ingreso");
}
function isEgreso(tx: Transaccion) {
  return normalize(tx.tipoTransaccion).includes("egreso");
}
function isAcreditacion(tx: Transaccion) {
  return normalize(tx.tipoFlujo).includes("acredit");
}
function isDistribucion(tx: Transaccion) {
  return Boolean(tx.esDistribucionContable);
}
function isTransferenciaInterna(tx: Transaccion) {
  return normalize(tx.tipoFlujo).includes("transferencia interna");
}
function isInterno(tx: Transaccion) {
  return isDistribucion(tx) || isTransferenciaInterna(tx);
}
function isVenta(tx: Transaccion) {
  return isIngreso(tx) && !isAcreditacion(tx) && !isInterno(tx);
}
function isIngresoDirectoDisponible(tx: Transaccion) {
  const metodo = normalize(tx.metodoPago);
  const esPendienteMedio = PENDING_METHODS.includes(metodo);
  return isVenta(tx) && !esPendienteMedio && isConfirmed(tx);
}

function classify(tx: Transaccion): string {
  if (isAcreditacion(tx)) return "Acreditación";
  if (isDistribucion(tx)) return "Distribución interna";
  if (isTransferenciaInterna(tx)) return "Transferencia interna";
  if (isEgreso(tx)) return "Egreso";
  if (isVenta(tx)) return "Venta";
  return "Otro";
}

export default function TransaccionesTable({ transacciones, currency = "USD", pendientesTotal = 0 }: Props) {
  const [rows, setRows] = useState<Transaccion[]>(transacciones);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchRef, setSearchRef] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [conceptoFilter, setConceptoFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [metodoFilter, setMetodoFilter] = useState("");
  const [cuentaFilter, setCuentaFilter] = useState("");
  const [quickRange, setQuickRange] = useState<QuickRange>("custom");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todas");
  const [modalAnular, setModalAnular] = useState<{
    open: boolean;
    tx: Transaccion | null;
    motivo: string;
    error: string | null;
    loading: boolean;
  }>({ open: false, tx: null, motivo: "", error: null, loading: false });

  useEffect(() => {
    setRows(transacciones);
  }, [transacciones]);

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const recordKey = (tx: Transaccion) => (tx.recordId ?? tx.id ?? "").trim();

  const updateRow = (id: string, updates: Partial<Transaccion>) => {
    setRows((prev) => prev.map((t) => (recordKey(t) === id ? { ...t, ...updates } : t)));
  };

  const tipos = useMemo(() => Array.from(new Set(rows.map((t) => t.tipoTransaccion || ""))).filter(Boolean), [rows]);
  const conceptos = useMemo(() => Array.from(new Set(rows.map((t) => t.concepto || ""))).filter(Boolean), [rows]);
  const estados = useMemo(() => Array.from(new Set(rows.map((t) => t.estado || ""))).filter(Boolean), [rows]);
  const metodos = useMemo(() => Array.from(new Set(rows.map((t) => t.metodoPago || ""))).filter(Boolean), [rows]);
  const cuentas = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((t) => {
      if (t.cuentaOrigen) set.add(t.cuentaOrigen);
      if (t.cuentaDestino) set.add(t.cuentaDestino);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((tx) => {
      if (quickFilter === "reales" && isInterno(tx)) return false;
      if (quickFilter === "internos" && !isInterno(tx)) return false;
      if (quickFilter === "ventas" && classify(tx) !== "Venta") return false;
      if (quickFilter === "acreditaciones" && classify(tx) !== "Acreditación") return false;
      if (quickFilter === "distribuciones" && classify(tx) !== "Distribución interna") return false;

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
  }, [rows, searchRef, tipoFilter, conceptoFilter, estadoFilter, metodoFilter, cuentaFilter, dateFrom, dateTo, quickFilter]);

  const filteredActivas = useMemo(() => filtered.filter((tx) => !isCanceled(tx)), [filtered]);

  // Tarjetas (sobre el subconjunto filtrado, excepto Pendiente por acreditar que usa fuente de pendientes)
  const ventasBrutas = filteredActivas.filter(isVenta).reduce((acc, t) => acc + (t.montoTotal || 0), 0);
  const ingresosReales = filteredActivas
    .filter((t) => isAcreditacion(t) || isIngresoDirectoDisponible(t))
    .reduce((acc, t) => acc + (t.montoTotal || 0), 0);
  const comisiones = filteredActivas.filter(isAcreditacion).reduce((acc, t) => acc + (t.comision || 0), 0);
  const movimientosInternos = filteredActivas.filter(isInterno).length;

  const totalPendientes = pendientesTotal; // ya viene desde la tabla de pendientes

  const tipoBadge = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t === "venta") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
    if (t === "acreditación") return "bg-blue-50 text-blue-700 border border-blue-100";
    if (t === "distribución interna") return "bg-indigo-50 text-indigo-700 border border-indigo-100";
    if (t === "transferencia interna") return "bg-slate-50 text-slate-700 border border-slate-200";
    if (t === "egreso") return "bg-rose-50 text-rose-700 border border-rose-100";
    return "bg-slate-50 text-slate-700 border border-slate-200";
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
    setQuickFilter("todas");
  };

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    const { from, to } = quickRangeDates(range);
    setDateFrom(from);
    setDateTo(to);
  };

  const openAnular = (tx: Transaccion) => {
    if (actionLoading) return;
    setModalAnular({ open: true, tx, motivo: "", error: null, loading: false });
  };

  const handleConfirmAnular = async () => {
    const { tx, motivo } = modalAnular;
    if (!tx) return;
    const trimmed = motivo.trim();
    if (!trimmed) {
      setModalAnular((prev) => ({ ...prev, error: "El motivo de anulación es obligatorio" }));
      return;
    }
    const id = recordKey(tx);
    if (!id) {
      setModalAnular((prev) => ({ ...prev, error: "No se encontró el identificador de la transacción." }));
      return;
    }
    const url = `/api/transacciones/${encodeURIComponent(id)}/anular`;
    setModalAnular((prev) => ({ ...prev, loading: true, error: null }));
    setActionLoading(id);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: trimmed }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "No se pudo anular la transacción");
      }
      updateRow(id, {
        estadoPrevio: tx.estado || tx.estadoPrevio,
        estado: "Anulado",
        motivoAnulacion: trimmed,
        fechaAnulacion: todayIso(),
      });
      setModalAnular({ open: false, tx: null, motivo: "", error: null, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo anular la transacción";
      setModalAnular((prev) => ({ ...prev, error: message, loading: false }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRehabilitar = async (tx: Transaccion) => {
    // Migrado a modal reutilizable: se maneja en openRehabilitar / handleConfirmRehabilitar
  };

  const [modalRehab, setModalRehab] = useState<{
    open: boolean;
    tx: Transaccion | null;
    error: string | null;
    loading: boolean;
  }>({ open: false, tx: null, error: null, loading: false });

  const openRehabilitar = (tx: Transaccion) => {
    if (actionLoading) return;
    setModalRehab({ open: true, tx, error: null, loading: false });
  };

  const handleConfirmRehabilitar = async () => {
    const { tx } = modalRehab;
    if (!tx) return;
    const id = recordKey(tx);
    if (!id) {
      setModalRehab((prev) => ({ ...prev, error: "No se encontró el identificador de la transacción." }));
      return;
    }
    const url = `/api/transacciones/${encodeURIComponent(id)}/rehabilitar`;
    setModalRehab((prev) => ({ ...prev, loading: true, error: null }));
    setActionLoading(id);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = (await res.json()) as { success?: boolean; error?: string; data?: { estado?: string } };
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "No se pudo rehabilitar la transacción");
      }
      const restored = tx.estadoPrevio || json.data?.estado || "Confirmado";
      updateRow(id, {
        estado: restored,
        fechaRehabilitacion: todayIso(),
      });
      setModalRehab({ open: false, tx: null, error: null, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo rehabilitar la transacción";
      setModalRehab((prev) => ({ ...prev, error: message, loading: false }));
    } finally {
      setActionLoading(null);
    }
  };

  const irADetalle = (tx: Transaccion) => {
    window.location.assign(`/transacciones/${recordKey(tx)}`);
  };

  const handleExport = () => {
    const headersCsv = [
      "Fecha",
      "ID",
      "Clasificación",
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
      classify(tx),
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
        <StatCard label="Ventas brutas" value={ventasBrutas} currency={currency} tone="green" />
        <StatCard label="Ingresos reales acreditados" value={ingresosReales} currency={currency} tone="emerald" />
        <StatCard label="Comisiones del período" value={comisiones} currency={currency} tone="amber" />
        <StatCard label="Pendiente por acreditar" value={totalPendientes} currency={currency} tone="orange" />
        <StatCard label="Movimientos internos" value={movimientosInternos} currency="" tone="indigo" />
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

          <div className="flex flex-wrap gap-2">
            {(["todas","reales","internos","ventas","acreditaciones","distribuciones"] as QuickFilter[]).map((q) => (
              <Button
                key={q}
                size="sm"
                variant={quickFilter === q ? "primary" : "ghost"}
                onClick={() => setQuickFilter(q)}
              >
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </Button>
            ))}
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
            {quickFilter !== "todas" ? <span className="chip">Filtro: {quickFilter}</span> : null}
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
                <th className="px-3 py-2 text-left">Clasificación</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Concepto</th>
                <th className="px-3 py-2 text-left">Origen</th>
                <th className="px-3 py-2 text-left">Destino</th>
                <th className="px-3 py-2 text-left">Método</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((txn) => {
                const clasif = classify(txn);
                const canceled = isCanceled(txn);
                const rowClass = canceled ? "bg-slate-50 text-slate-500 opacity-70" : "";
                const key = recordKey(txn) || txn.idTransaccion || txn.id;
                return (
                  <tr key={key} className={`row hoverable ${rowClass}`}>
                    <td className="px-3 py-2 whitespace-nowrap text-left">{formatDate(txn.fecha)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-left">{txn.idTransaccion ?? recordKey(txn)}</td>
                    <td className="px-3 py-2 text-left">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tipoBadge(clasif)}`}>
                        {clasif}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-left">{txn.tipoTransaccion || "-"}</td>
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
                    <td className="px-3 py-2 text-left">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="ghost" onClick={() => irADetalle(txn)}>
                          Ver
                        </Button>
                        {!canceled ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actionLoading === recordKey(txn)}
                            onClick={() => openAnular(txn)}
                          >
                            Anular
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={actionLoading === recordKey(txn)}
                            onClick={() => openRehabilitar(txn)}
                          >
                            Rehabilitar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {!filtered.length ? (
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">No se encontraron transacciones con los filtros actuales.</div>
      ) : null}

      <Modal
        open={modalAnular.open}
        title="¿Estás seguro de anular esta transacción?"
        description="Esta acción marcará la transacción como anulada y dejará de afectar los cálculos contables."
        confirmLabel={modalAnular.loading ? "Anulando..." : "Confirmar anulación"}
        cancelLabel="Cancelar"
        loading={modalAnular.loading}
        error={modalAnular.error}
        onClose={() => setModalAnular({ open: false, tx: null, motivo: "", error: null, loading: false })}
        onConfirm={handleConfirmAnular}
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Motivo de anulación
            <textarea
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              rows={3}
              value={modalAnular.motivo}
              onChange={(e) => setModalAnular((prev) => ({ ...prev, motivo: e.target.value }))}
              disabled={modalAnular.loading}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={modalRehab.open}
        title="¿Estás seguro de rehabilitar esta transacción?"
        description="Esta acción volverá a activar la transacción y hará que vuelva a afectar los cálculos contables del sistema."
        confirmLabel={modalRehab.loading ? "Rehabilitando..." : "Confirmar rehabilitación"}
        cancelLabel="Cancelar"
        loading={modalRehab.loading}
        error={modalRehab.error}
        onClose={() => setModalRehab({ open: false, tx: null, error: null, loading: false })}
        onConfirm={handleConfirmRehabilitar}
      />
    </div>
  );
}
