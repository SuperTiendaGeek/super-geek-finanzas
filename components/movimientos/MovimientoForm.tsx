"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatCurrency, safeNumber } from "@/lib/helpers";
import { Cuenta } from "@/types/cuenta";
import { Transaccion } from "@/types/transaccion";
import { calcularSaldosPorCuenta } from "@/lib/calculations";

interface Props {
  cuentas: Cuenta[];
}

type Status = { type: "idle" | "success" | "error"; message?: string };

const DEFAULT_CONCEPTO = "Transferencia entre Cuentas";
const inputClass = "rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none bg-white";

export default function MovimientoForm({ cuentas }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = useState(today);
  const [concepto, setConcepto] = useState(DEFAULT_CONCEPTO);
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>(cuentas[0]?.id ?? "");
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>(cuentas[1]?.id ?? "");
  const [monto, setMonto] = useState<string>("");
  const [observaciones, setObservaciones] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [showConceptError, setShowConceptError] = useState(false);

  const montoNumero = safeNumber(monto, 0);
  const conceptoValido = concepto.trim().length > 0;
  const puedeGuardar = Boolean(cuentaOrigenId) && Boolean(cuentaDestinoId) && montoNumero > 0;

  const cuentasFiltradas = useMemo(() => cuentas.filter((c) => c.activa && c.permiteTransferencias), [cuentas]);

  const cuentaOrigen = useMemo(() => cuentasFiltradas.find((c) => c.id === cuentaOrigenId), [cuentasFiltradas, cuentaOrigenId]);
  const cuentaDestino = useMemo(() => cuentasFiltradas.find((c) => c.id === cuentaDestinoId), [cuentasFiltradas, cuentaDestinoId]);

  useEffect(() => {
    console.log("[MovimientoForm] cuentas filtradas", cuentasFiltradas.map((c) => c.nombre));
  }, [cuentasFiltradas]);

  useEffect(() => {
    if (!cuentasFiltradas.length) return;
    if (!cuentasFiltradas.some((c) => c.id === cuentaOrigenId)) {
      setCuentaOrigenId(cuentasFiltradas[0].id);
    }
    if (!cuentasFiltradas.some((c) => c.id === cuentaDestinoId)) {
      const fallback = cuentasFiltradas[1] ?? cuentasFiltradas[0];
      setCuentaDestinoId(fallback.id);
    }
  }, [cuentasFiltradas, cuentaOrigenId, cuentaDestinoId]);

  useEffect(() => {
    const loadTransacciones = async () => {
      try {
        setLoadingSaldos(true);
        const res = await fetch("/api/transacciones", { cache: "no-store" });
        const payload = (await res.json()) as { success?: boolean; data?: Transaccion[] };
        if (!res.ok || !payload?.success || !Array.isArray(payload.data)) {
          throw new Error("No se pudieron cargar las transacciones");
        }
        setTransacciones(payload.data);
      } catch (error) {
        console.error("No se pudieron cargar transacciones para saldos", error);
      } finally {
        setLoadingSaldos(false);
      }
    };
    loadTransacciones();
  }, []);

  const saldos = useMemo(() => calcularSaldosPorCuenta(cuentasFiltradas, transacciones), [cuentasFiltradas, transacciones]);
  const saldoDisponible = saldos[cuentaOrigenId] ?? 0;
  const saldoSuficiente = montoNumero <= saldoDisponible || !monto;
  const saldoTone = loadingSaldos
    ? "bg-slate-100 text-slate-600 border-slate-200"
    : saldoSuficiente
      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : "bg-amber-50 text-amber-800 border-amber-200";

  const esDistribucionDesdeIngresos = useMemo(() => {
    const origen = cuentaOrigen?.nombre;
    const destino = cuentaDestino?.nombre;
    return origen === "SGINGRESOS" && (destino === "SGCAPITAL" || destino === "SGUTILIDAD" || destino === "SGIVA");
  }, [cuentaOrigen, cuentaDestino]);

  const handleSubmit = async () => {
    if (!conceptoValido) {
      setShowConceptError(true);
      setStatus({ type: "error", message: "El campo Concepto es obligatorio." });
      return;
    }

    if (!puedeGuardar) {
      setStatus({ type: "error", message: "Completa cuenta origen, destino y un monto mayor a 0." });
      return;
    }

    if (cuentaOrigenId === cuentaDestinoId) {
      setStatus({ type: "error", message: "La cuenta origen y destino deben ser distintas." });
      return;
    }

    if (!cuentaOrigen?.permiteTransferencias || !cuentaDestino?.permiteTransferencias) {
      setStatus({ type: "error", message: "Selecciona cuentas que permitan transferencias." });
      return;
    }

    if (!cuentaOrigen?.activa || !cuentaDestino?.activa) {
      setStatus({ type: "error", message: "Ambas cuentas deben estar activas." });
      return;
    }

    if (montoNumero > saldoDisponible) {
      setStatus({ type: "error", message: "Saldo insuficiente en la cuenta origen." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "idle" });

      const res = await fetch("/api/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, concepto, cuentaOrigenId, cuentaDestinoId, monto: montoNumero, observaciones }),
      });

      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudo guardar el movimiento");
      }

      setStatus({ type: "success", message: "Movimiento registrado correctamente." });
      setMonto("");
      setObservaciones("");
      setShowConceptError(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setStatus({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (conceptoValido && showConceptError) {
      setShowConceptError(false);
    }
  }, [conceptoValido, showConceptError]);

  if (!cuentasFiltradas.length) {
    return (
      <Card title="Datos del movimiento" description="Completa los datos para crear el movimiento">
        <p className="text-sm text-amber-700">No hay cuentas activas que permitan transferencias.</p>
      </Card>
    );
  }

  return (
    <Card title="Movimiento interno" description="Traslado entre cuentas">
      <div className="space-y-5">
        {/* Cabecera */}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            Concepto
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className={inputClass}
              placeholder={DEFAULT_CONCEPTO}
            />
            {showConceptError ? <span className="text-xs text-amber-700">El concepto es obligatorio.</span> : null}
          </label>
        </div>

        {/* Flujo origen -> destino */}
        <div className="grid gap-3 lg:grid-cols-3 items-stretch">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cuenta origen</p>
            <select value={cuentaOrigenId} onChange={(e) => setCuentaOrigenId(e.target.value)} className={`${inputClass} mt-2`}>
              {cuentasFiltradas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre}
                </option>
              ))}
            </select>
            <div className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${saldoTone}`}>
              <span>Saldo disponible</span>
              <span className="text-sm">
                {loadingSaldos ? "Calculando..." : formatCurrency(saldoDisponible)}
              </span>
              {!saldoSuficiente && monto ? <span className="text-amber-700 font-medium">Insuficiente</span> : null}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-slate-600">
              <span className="text-sm font-semibold">Origen</span>
              <span className="text-lg">→</span>
              <span className="text-sm font-semibold">Destino</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cuenta destino</p>
            <select value={cuentaDestinoId} onChange={(e) => setCuentaDestinoId(e.target.value)} className={`${inputClass} mt-2`}>
              {cuentasFiltradas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre}
                </option>
              ))}
            </select>
            {cuentaOrigenId === cuentaDestinoId ? (
              <p className="mt-2 text-xs text-amber-700">Origen y destino deben ser distintos.</p>
            ) : null}
          </div>
        </div>

        {/* Monto y observaciones */}
        <div className="grid gap-3 lg:grid-cols-3 items-start">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 lg:col-span-2">
            Monto a transferir
            <input
              type="number"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={`${inputClass} text-lg font-semibold`}
              placeholder="0.00"
            />
            <span className="text-xs text-slate-500">Debe ser mayor a 0</span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Observaciones
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className={inputClass}
              placeholder="Opcional"
            />
          </label>
        </div>

        {/* Resumen visual */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Resumen del movimiento</p>
              <div className="flex justify-between">
                <span>Cuenta origen</span>
                <span className="font-semibold">{cuentaOrigen?.nombre ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Saldo origen</span>
                <span className={`font-semibold ${saldoSuficiente ? "text-slate-900" : "text-amber-700"}`}>
                  {formatCurrency(saldoDisponible)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Monto</span>
                <span className="font-semibold text-slate-900">{formatCurrency(montoNumero)}</span>
              </div>
              <div className="flex justify-between">
                <span>Saldo estimado</span>
                <span className="font-semibold text-slate-900">{formatCurrency(saldoDisponible - montoNumero)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Destino y estado</p>
              <div className="flex justify-between">
                <span>Cuenta destino</span>
                <span className="font-semibold">{cuentaDestino?.nombre ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Estado esperado</span>
                <Badge className="bg-slate-100 text-slate-700">Procesada</Badge>
              </div>
              {esDistribucionDesdeIngresos ? (
                <p className="text-xs text-slate-600">Distribución desde SGINGRESOS hacia capital/utilidad/IVA.</p>
              ) : null}
            </div>
          </Card>
        </div>

        {status.type !== "idle" && status.message ? (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
          >
            {status.message}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setMonto("")} className="px-4 py-2 text-sm">
            Limpiar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !puedeGuardar} className="px-5 py-2 text-sm">
            {isSubmitting ? "Guardando..." : "Registrar movimiento"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
