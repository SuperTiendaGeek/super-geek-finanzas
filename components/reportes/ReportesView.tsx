"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DistribucionPanel from "@/components/distribucion/DistribucionPanel";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrency, formatDate, safeNumber } from "@/lib/helpers";
import { Cuenta } from "@/types/cuenta";
import { Pendiente } from "@/types/pendiente";
import type { DistribucionContable } from "@/services/distribucion";
import { Transaccion } from "@/types/transaccion";

type Filters = {
  dateFrom: string;
  dateTo: string;
  cuenta: string;
  tipo: string;
  concepto: string;
  estado: string;
};

type Props = {
  cuentas: Cuenta[];
  transacciones: Transaccion[];
  pendientes: Pendiente[];
  distribucion: DistribucionContable;
  saldoIngresos: number;
  currency?: string;
};

const ESTADOS_CONFIRMADOS = new Set([
  "confirmado",
  "confirmada",
  "procesado",
  "procesada",
  "acreditado",
  "acreditada",
  "completado",
  "completada",
  "pagado",
  "pagada",
  "aprobado",
  "aprobada",
]);

const ESTADO_PENDIENTE = "pendiente";

const INITIAL_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  cuenta: "",
  tipo: "",
  concepto: "",
  estado: "",
};

const TODAY = new Date().toISOString().slice(0, 10);

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function parseDate(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function esAnulada(tx: Transaccion): boolean {
  const estado = normalize(tx.estado);
  return estado.includes("anula") || estado.includes("cancel");
}

function esPendiente(tx: Transaccion): boolean {
  const estado = normalize(tx.estado);
  return estado.startsWith(ESTADO_PENDIENTE);
}

function esConfirmada(tx: Transaccion): boolean {
  const estado = normalize(tx.estado);
  if (!estado) return true;
  if (esAnulada(tx)) return false;
  if (esPendiente(tx)) return false;
  return ESTADOS_CONFIRMADOS.has(estado);
}

function esIngreso(tx: Transaccion): boolean {
  return normalize(tx.tipoTransaccion).includes("ingreso");
}

function esEgreso(tx: Transaccion): boolean {
  return normalize(tx.tipoTransaccion).includes("egreso");
}

function esMovimiento(tx: Transaccion): boolean {
  const tipo = normalize(tx.tipoTransaccion);
  return tipo.includes("movimiento") || tipo.includes("transfer");
}

function matchDateRange(dateValue: string | undefined, filters: Filters) {
  if (!filters.dateFrom && !filters.dateTo) return true;
  const parsed = parseDate(dateValue ?? "");
  if (parsed === null) return false;
  if (filters.dateFrom) {
    const from = parseDate(filters.dateFrom);
    if (from !== null && parsed < from) return false;
  }
  if (filters.dateTo) {
    const to = parseDate(filters.dateTo);
    if (to !== null && parsed > to) return false;
  }
  return true;
}

function resolveCuentaKey(
  raw: string | null | undefined,
  ids: Set<string>,
  nombres: Record<string, string>
): string | null {
  if (!raw) return null;
  const asId = String(raw);
  if (ids.has(asId)) return asId;
  const byName = nombres[normalizeKey(asId)];
  return byName ?? null;
}

function calcularSaldosConRegla(
  cuentas: Cuenta[],
  transacciones: Transaccion[]
): Record<string, number> {
  const ids = new Set(cuentas.map((c) => c.id));
  const nombres = cuentas.reduce((acc, c) => {
    acc[normalizeKey(c.nombre)] = c.id;
    return acc;
  }, {} as Record<string, string>);

  const saldos: Record<string, number> = {};
  cuentas.forEach((c) => {
    saldos[c.id] = 0;
  });

  transacciones.forEach((tx) => {
    if (!esConfirmada(tx) || esAnulada(tx)) return;
    const monto = safeNumber(tx.montoTotal, 0);
    if (!monto) return;

    const origenKey = resolveCuentaKey(tx.cuentaOrigenId ?? tx.cuentaOrigen, ids, nombres);
    const destinoKey = resolveCuentaKey(tx.cuentaDestinoId ?? tx.cuentaDestino, ids, nombres);

    if (esIngreso(tx)) {
      if (destinoKey) saldos[destinoKey] = safeNumber(saldos[destinoKey], 0) + monto;
      return;
    }

    if (esEgreso(tx)) {
      if (origenKey) saldos[origenKey] = safeNumber(saldos[origenKey], 0) - monto;
      return;
    }

    if (esMovimiento(tx)) {
      if (origenKey) saldos[origenKey] = safeNumber(saldos[origenKey], 0) - monto;
      if (destinoKey) saldos[destinoKey] = safeNumber(saldos[destinoKey], 0) + monto;
      return;
    }

    if (origenKey) saldos[origenKey] = safeNumber(saldos[origenKey], 0) - monto;
    if (destinoKey) saldos[destinoKey] = safeNumber(saldos[destinoKey], 0) + monto;
  });

  return saldos;
}

function buildCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r
        .map((value) => {
          const v = value ?? "";
          if (v.includes(",") || v.includes("\"") || v.includes("\n")) {
            return `"${v.replace(/\"/g, '""')}"`;
          }
          return v;
        })
        .join(",")
    )
    .join("\n");
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportesView({ cuentas, transacciones, pendientes, distribucion, saldoIngresos, currency = DEFAULT_CURRENCY }: Props) {
  const [draftFilters, setDraftFilters] = useState<Filters>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const transaccionesVigentes = useMemo(() => transacciones.filter((tx) => !esAnulada(tx)), [transacciones]);

  const transaccionesFiltradas = useMemo(() => {
    return transaccionesVigentes.filter((tx) => {
      if (!matchDateRange(tx.fecha, filters)) return false;
      if (filters.tipo && normalize(tx.tipoTransaccion) !== normalize(filters.tipo)) return false;
      if (filters.concepto && normalize(tx.concepto) !== normalize(filters.concepto)) return false;
      if (filters.estado && normalize(tx.estado) !== normalize(filters.estado)) return false;
      if (filters.cuenta) {
        const target = normalizeKey(filters.cuenta);
        const origen = normalizeKey(tx.cuentaOrigen ?? tx.cuentaOrigenId ?? "");
        const destino = normalizeKey(tx.cuentaDestino ?? tx.cuentaDestinoId ?? "");
        if (origen !== target && destino !== target) return false;
      }
      return true;
    });
  }, [transaccionesVigentes, filters]);

  const transaccionesConfirmadas = useMemo(
    () => transaccionesFiltradas.filter((tx) => esConfirmada(tx)),
    [transaccionesFiltradas]
  );

  const movimientosConfirmados = useMemo(
    () => transaccionesConfirmadas.filter((tx) => esMovimiento(tx)),
    [transaccionesConfirmadas]
  );

  const movimientosPendientes = useMemo(
    () => transaccionesFiltradas.filter((tx) => esMovimiento(tx) && esPendiente(tx)),
    [transaccionesFiltradas]
  );

  const ingresosPeriodo = useMemo(
    () =>
      transaccionesConfirmadas
        .filter((tx) => esIngreso(tx))
        .reduce((acc, tx) => acc + safeNumber(tx.montoTotal, 0), 0),
    [transaccionesConfirmadas]
  );

  const egresosPeriodo = useMemo(
    () =>
      transaccionesConfirmadas
        .filter((tx) => esEgreso(tx))
        .reduce((acc, tx) => acc + safeNumber(tx.montoTotal, 0), 0),
    [transaccionesConfirmadas]
  );

  const pendientePorAcreditar = useMemo(() => {
    return pendientes
      .filter((p) => normalize(p.estado).startsWith(ESTADO_PENDIENTE))
      .filter((p) => matchDateRange(p.fecha, filters))
      .filter((p) => {
        if (!filters.cuenta) return true;
        const cuenta = normalizeKey(filters.cuenta);
        const destino = normalizeKey(p.cuentaDestinoFinalNombre ?? "");
        return destino === cuenta;
      })
      .reduce((acc, p) => acc + safeNumber(p.montoEsperado, 0), 0);
  }, [pendientes, filters]);

  const buildDistribuido = (lista: Transaccion[], destinoEsperado: string) =>
    lista
      .filter((tx) => {
        const origen = normalizeKey(tx.cuentaOrigen ?? tx.cuentaOrigenId ?? "");
        const destino = normalizeKey(tx.cuentaDestino ?? tx.cuentaDestinoId ?? "");
        return origen === "SGINGRESOS" && destino === destinoEsperado;
      })
      .reduce((acc, tx) => acc + safeNumber(tx.montoTotal, 0), 0);

  const capitalDistribuido = useMemo(() => buildDistribuido(movimientosConfirmados, "SGCAPITAL"), [movimientosConfirmados]);
  const utilidadDistribuida = useMemo(() => buildDistribuido(movimientosConfirmados, "SGUTILIDAD"), [movimientosConfirmados]);
  const ivaDistribuido = useMemo(() => buildDistribuido(movimientosConfirmados, "SGIVA"), [movimientosConfirmados]);

  const capitalPendiente = useMemo(() => buildDistribuido(movimientosPendientes, "SGCAPITAL"), [movimientosPendientes]);
  const utilidadPendiente = useMemo(() => buildDistribuido(movimientosPendientes, "SGUTILIDAD"), [movimientosPendientes]);
  const ivaPendiente = useMemo(() => buildDistribuido(movimientosPendientes, "SGIVA"), [movimientosPendientes]);

  const saldosCalculados = useMemo(() => calcularSaldosConRegla(cuentas, transacciones), [cuentas, transacciones]);

  const saldosFinales = useMemo(() => {
    const result: Record<string, number> = {};
    cuentas.forEach((c) => {
      if (typeof c.saldo === "number") {
        result[c.id] = c.saldo;
      } else {
        result[c.id] = saldosCalculados[c.id] ?? 0;
      }
    });
    return result;
  }, [cuentas, saldosCalculados]);

  const saldoTotalCuentas = useMemo(
    () =>
      cuentas
        .filter((c) => c.activa)
        .reduce((acc, c) => acc + safeNumber(saldosFinales[c.id], 0), 0),
    [cuentas, saldosFinales]
  );

  const pendientesFiltrados = useMemo(() => {
    return pendientes
      .filter((p) => normalize(p.estado).startsWith(ESTADO_PENDIENTE))
      .filter((p) => matchDateRange(p.fecha, filters))
      .filter((p) => {
        if (!filters.cuenta) return true;
        const target = normalizeKey(filters.cuenta);
        const destino = normalizeKey(p.cuentaDestinoFinalNombre ?? "");
        return destino === target;
      });
  }, [pendientes, filters]);

  const resumenCards = [
    { label: "Ingresos del periodo", value: ingresosPeriodo },
    { label: "Egresos del periodo", value: egresosPeriodo },
    { label: "Pendiente por acreditar", value: pendientePorAcreditar },
    { label: "Saldo total de cuentas", value: saldoTotalCuentas, hint: "Solo cuentas activas" },
    { label: "Capital distribuido", value: capitalDistribuido, pendiente: capitalPendiente },
    { label: "Utilidad distribuida", value: utilidadDistribuida, pendiente: utilidadPendiente },
    { label: "IVA distribuido", value: ivaDistribuido, pendiente: ivaPendiente },
  ];

  const opcionesCuenta = useMemo(() => {
    const set = new Set<string>();
    cuentas.forEach((c) => set.add(c.nombre));
    transacciones.forEach((t) => {
      if (t.cuentaOrigen) set.add(t.cuentaOrigen);
      if (t.cuentaDestino) set.add(t.cuentaDestino);
    });
    pendientes.forEach((p) => {
      if (p.cuentaDestinoFinalNombre) set.add(p.cuentaDestinoFinalNombre);
    });
    return Array.from(set).sort();
  }, [cuentas, transacciones, pendientes]);

  const opcionesTipo = useMemo(() => {
    const set = new Set<string>();
    transacciones.forEach((t) => {
      if (t.tipoTransaccion) set.add(t.tipoTransaccion);
    });
    return Array.from(set).sort();
  }, [transacciones]);

  const opcionesConcepto = useMemo(() => {
    const set = new Set<string>();
    transacciones.forEach((t) => {
      if (t.concepto) set.add(t.concepto);
    });
    return Array.from(set).sort();
  }, [transacciones]);

  const opcionesEstado = useMemo(() => {
    const set = new Set<string>();
    transacciones.forEach((t) => {
      if (t.estado) set.add(t.estado);
    });
    return Array.from(set).sort();
  }, [transacciones]);

  const filtrosActivos = useMemo(() => {
    const chips: string[] = [];
    if (filters.dateFrom) chips.push(`Desde ${filters.dateFrom}`);
    if (filters.dateTo) chips.push(`Hasta ${filters.dateTo}`);
    if (filters.cuenta) chips.push(`Cuenta: ${filters.cuenta}`);
    if (filters.tipo) chips.push(`Tipo: ${filters.tipo}`);
    if (filters.concepto) chips.push(`Concepto: ${filters.concepto}`);
    if (filters.estado) chips.push(`Estado: ${filters.estado}`);
    return chips;
  }, [filters]);

  const applyFilters = () => setFilters(draftFilters);
  const clearFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
  };

  const transaccionesTabla = transaccionesFiltradas;

  const saldosPorCuenta = cuentas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipoCuenta,
    activa: c.activa,
    saldo: saldosFinales[c.id] ?? 0,
  }));

  const exportTransacciones = () => {
    if (!transaccionesTabla.length) return;
    const header = [
      "Fecha",
      "ID",
      "Tipo",
      "Concepto",
      "Origen",
      "Destino",
      "Método de pago",
      "Monto total",
      "Estado",
      "Comisión",
    ];
    const rows = transaccionesTabla.map((tx) => [
      formatDate(tx.fecha),
      tx.idTransaccion ?? tx.id,
      tx.tipoTransaccion || "",
      tx.concepto || "",
      tx.cuentaOrigen ?? "",
      tx.cuentaDestino ?? "",
      tx.metodoPago ?? "",
      String(tx.montoTotal ?? ""),
      tx.estado ?? "",
      String(tx.comision ?? 0),
    ]);
    const csv = buildCsv([header, ...rows]);
    triggerDownload(`reporte_transacciones_${TODAY}.csv`, csv);
  };

  const exportSaldos = () => {
    if (!saldosPorCuenta.length) return;
    const header = ["Cuenta", "Tipo", "Saldo actual", "Estado"];
    const rows = saldosPorCuenta.map((c) => [
      c.nombre,
      c.tipo,
      String(c.saldo ?? 0),
      c.activa ? "Activa" : "Inactiva",
    ]);
    const csv = buildCsv([header, ...rows]);
    triggerDownload(`reporte_saldos_${TODAY}.csv`, csv);
  };

  const exportPendientes = () => {
    if (!pendientesFiltrados.length) return;
    const header = [
      "Fecha",
      "Transacción",
      "Medio",
      "Monto esperado",
      "Comisión estimada",
      "Estado",
      "Fecha estimada",
    ];
    const rows = pendientesFiltrados.map((p) => [
      formatDate(p.fecha),
      p.transaccionRelacionadaId ?? "",
      p.medio,
      String(p.montoEsperado ?? 0),
      String(p.comisionEstimada ?? 0),
      p.estado,
      formatDate(p.fechaEstimada ?? ""),
    ]);
    const csv = buildCsv([header, ...rows]);
    triggerDownload(`reporte_pendientes_${TODAY}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <DistribucionPanel distribucion={distribucion} saldoIngresos={saldoIngresos} currency={currency} />
      <Card title="Filtros" description="Acota el periodo y los criterios que quieres analizar">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Fecha desde
            <input
              type="date"
              value={draftFilters.dateFrom}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Fecha hasta
            <input
              type="date"
              value={draftFilters.dateTo}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Cuenta
            <select
              value={draftFilters.cuenta}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, cuenta: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {opcionesCuenta.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tipo de transacción
            <select
              value={draftFilters.tipo}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, tipo: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {opcionesTipo.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Concepto
            <select
              value={draftFilters.concepto}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, concepto: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {opcionesConcepto.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Estado
            <select
              value={draftFilters.estado}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, estado: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {opcionesEstado.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filtrosActivos.length === 0 ? (
              <span className="text-xs text-slate-500">Sin filtros activos</span>
            ) : (
              filtrosActivos.map((chip) => (
                <Badge key={chip} className="bg-slate-900 text-white">
                  {chip}
                </Badge>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilters}>Aplicar filtros</Button>
            <Button variant="secondary" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Resumen rápido</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {resumenCards.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[color:var(--tone-blue-border)] bg-[var(--tone-blue-bg)] px-4 py-3 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{item.label}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                {formatCurrency(item.value, currency)}
              </p>
              {item.hint ? <p className="text-xs text-[var(--text-secondary)]">{item.hint}</p> : null}
              {item.pendiente ? (
                <p className="text-xs text-[var(--text-secondary)]">Pendiente: {formatCurrency(item.pendiente, currency)}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Saldos por cuenta"
            description="Usa Saldo Actual de Airtable; si falta, se calcula con transacciones confirmadas"
          >
            <div className="mb-3 flex items-center justify-end">
              <Button variant="secondary" onClick={exportSaldos} disabled={!saldosPorCuenta.length}>
                Exportar CSV
              </Button>
            </div>
            {!saldosPorCuenta.length ? (
              <p className="text-sm text-slate-600">No hay cuentas disponibles.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Cuenta</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Saldo actual</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {saldosPorCuenta.map((c) => (
                      <tr key={c.id} className="row hoverable">
                        <td className="px-3 py-2 font-medium text-slate-900">{c.nombre}</td>
                        <td className="px-3 py-2 text-slate-700">{c.tipo}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-900">
                          {formatCurrency(c.saldo, currency)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={c.activa ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>
                            {c.activa ? "Activa" : "Inactiva"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Pagos pendientes por acreditar"
            description="Solo se consideran los movimientos en estado Pendiente"
          >
            <div className="mb-3 flex items-center justify-end">
              <Button variant="secondary" onClick={exportPendientes} disabled={!pendientesFiltrados.length}>
                Exportar CSV
              </Button>
            </div>
            {!pendientesFiltrados.length ? (
              <p className="text-sm text-slate-600">No hay pagos pendientes en el rango seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Transacción</th>
                      <th className="px-3 py-2">Medio</th>
                      <th className="px-3 py-2">Monto esperado</th>
                      <th className="px-3 py-2">Comisión estimada</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Fecha estimada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendientesFiltrados.map((p) => (
                      <tr key={p.id} className="row hoverable">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.fecha)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.transaccionRelacionadaId ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.medio}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-900">
                          {formatCurrency(p.montoEsperado, currency)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          {formatCurrency(p.comisionEstimada ?? 0, currency)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge className="bg-amber-100 text-amber-800">{p.estado}</Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.fechaEstimada ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Transacciones del periodo" description="Excluye anuladas; los importes pendientes no impactan saldos">
          <div className="mb-3 flex items-center justify-end">
            <Button variant="secondary" onClick={exportTransacciones} disabled={!transaccionesTabla.length}>
              Exportar CSV
            </Button>
          </div>
          {!transaccionesTabla.length ? (
            <p className="text-sm text-slate-600">No se encontraron transacciones con los filtros actuales.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2">Destino</th>
                    <th className="px-3 py-2">Método de pago</th>
                    <th className="px-3 py-2">Monto total</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transaccionesTabla.map((tx) => (
                    <tr key={tx.id} className="row hoverable">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(tx.fecha)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{tx.idTransaccion ?? tx.id}</td>
                      <td className="px-3 py-2 capitalize">{tx.tipoTransaccion || "-"}</td>
                      <td className="px-3 py-2">{tx.concepto || "-"}</td>
                      <td className="px-3 py-2">{tx.cuentaOrigen ?? "-"}</td>
                      <td className="px-3 py-2">{tx.cuentaDestino ?? "-"}</td>
                      <td className="px-3 py-2">{tx.metodoPago ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-900">
                        {formatCurrency(tx.montoTotal, currency)}
                        {safeNumber(tx.comision, 0) > 0 ? (
                          <span className="ml-2 text-xs text-slate-500">Comisión: {formatCurrency(tx.comision ?? 0, currency)}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={esConfirmada(tx) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>
                          {tx.estado || "-"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}









