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

const BANK_ACCOUNTS = new Set(["SGINGRESOS", "SGCAPITAL", "SGUTILIDAD", "SGIVA"]);
const metodoPagoDefaults = ["Efectivo", "Transferencia", "Debito", "Cajero / Ventanilla", "Otro"];

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none bg-white";
const pillBase = "rounded-full border px-3 py-1.5 text-sm font-medium transition";
const pillActive = "border-slate-900 bg-slate-900 text-white shadow-sm";
const pillInactive = "border-slate-200 bg-white text-slate-700 hover:border-slate-300";

export default function EgresoForm({ cuentas }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fecha, setFecha] = useState(today);
  const [concepto, setConcepto] = useState("");
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>(cuentas[0]?.id ?? "");
  const [metodoPago, setMetodoPago] = useState<string>(metodoPagoDefaults[0]);
  const [monto, setMonto] = useState<string>("");
  const [observaciones, setObservaciones] = useState("");
  const [referenciaExterna, setReferenciaExterna] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [showConceptError, setShowConceptError] = useState(false);

  const montoNumero = safeNumber(monto, 0);
  const conceptoValido = concepto.trim().length > 0;
  const puedeGuardar = Boolean(cuentaOrigenId) && montoNumero > 0; // validamos concepto adentro para mensaje

  const cuentaSeleccionada = useMemo(() => cuentas.find((c) => c.id === cuentaOrigenId), [cuentas, cuentaOrigenId]);

  const metodoPagoOptions = useMemo(() => {
    const nombre = cuentaSeleccionada?.nombre ?? "";
    if (nombre === "Caja Registradora") return ["Efectivo"];
    if (BANK_ACCOUNTS.has(nombre)) return ["Transferencia", "Debito", "Cajero / Ventanilla"];
    return metodoPagoDefaults;
  }, [cuentaSeleccionada]);

  useEffect(() => {
    if (!metodoPagoOptions.includes(metodoPago)) {
      setMetodoPago(metodoPagoOptions[0]);
    }
  }, [metodoPagoOptions, metodoPago]);

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

  const saldos = useMemo(() => calcularSaldosPorCuenta(cuentas, transacciones), [cuentas, transacciones]);
  const saldoDisponible = saldos[cuentaOrigenId] ?? 0;
  const saldoSuficiente = montoNumero <= saldoDisponible || !monto;
  const saldoTone = loadingSaldos
    ? "bg-slate-100 text-slate-600"
    : saldoSuficiente
      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : "bg-amber-50 text-amber-800 border-amber-200";

  const handleSubmit = async () => {
    if (!conceptoValido) {
      setShowConceptError(true);
      setStatus({ type: "error", message: "El campo Concepto es obligatorio." });
      return;
    }

    if (!puedeGuardar) {
      setStatus({ type: "error", message: "Selecciona cuenta y un monto mayor a 0." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "idle" });

      const res = await fetch("/api/egresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          concepto,
          cuentaOrigenId,
          metodoPago,
          monto: montoNumero,
          observaciones,
          referenciaExterna,
        }),
      });

      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudo guardar el egreso");
      }

      setStatus({ type: "success", message: "Egreso registrado correctamente." });
      setMonto("");
      setReferenciaExterna("");
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

  if (!cuentas.length) {
    return (
      <Card title="Datos del egreso" description="Define la informacion del egreso">
        <p className="text-sm text-amber-700">
          No hay cuentas habilitadas para egresos. Activa al menos una cuenta con "Permite Egresos = Si".
        </p>
      </Card>
    );
  }

  return (
    <Card title="Registrar egreso" description="Registra una salida desde una cuenta autorizada">
      <div className="space-y-5">
        {/* Cabecera compacta */}
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 lg:col-span-2">
            Concepto
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              onBlur={() => setShowConceptError(!conceptoValido)}
              className={inputClass}
              placeholder="Ej. Pago proveedor, transporte, retiro, mantenimiento"
              required
            />
            {showConceptError && concepto.trim().length === 0 ? (
              <span className="text-xs text-amber-700">El campo Concepto es obligatorio.</span>
            ) : null}
          </label>
        </div>

        {/* Cuenta y saldo */}
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 lg:col-span-2">
            Cuenta origen
            <select value={cuentaOrigenId} onChange={(e) => setCuentaOrigenId(e.target.value)} className={inputClass}>
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre}
                </option>
              ))}
            </select>
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${saldoTone}`}>
              <span>Saldo disponible</span>
              <span className="text-sm">
                {loadingSaldos
                  ? "Calculando..."
                  : formatCurrency(saldoDisponible, cuentaSeleccionada?.moneda)}
              </span>
              {!saldoSuficiente && monto ? (
                <span className="text-amber-700 font-medium">Saldo insuficiente para este egreso</span>
              ) : null}
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Método de pago
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={inputClass}>
              {metodoPagoOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Monto principal */}
        <div className="grid gap-3 lg:grid-cols-3 items-start">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 lg:col-span-2">
            Monto del egreso
            <input
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={`${inputClass} text-lg font-semibold`}
              placeholder="0.00"
            />
            <span className="text-xs text-slate-500">Debe ser mayor a 0</span>
          </label>

          <Card>
            <div className="space-y-1 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Resumen</p>
              <div className="flex justify-between">
                <span>Cuenta</span>
                <span className="font-semibold">{cuentaSeleccionada?.nombre ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Monto</span>
                <span className="font-semibold">{formatCurrency(montoNumero || 0, cuentaSeleccionada?.moneda)}</span>
              </div>
              <div className="flex justify-between">
                <span>Metodo</span>
                <span className="font-semibold">{metodoPago}</span>
              </div>
              <div className="flex justify-between">
                <span>Estado esperado</span>
                <Badge className="bg-slate-100 text-slate-700">Procesada</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Detalles secundarios */}
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 lg:col-span-2">
            Referencia externa
            <input
              type="text"
              value={referenciaExterna}
              onChange={(e) => setReferenciaExterna(e.target.value)}
              className={inputClass}
              placeholder="OC, factura, comprobante"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 lg:col-span-1">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className={`${inputClass} min-h-[80px]`}
              placeholder="Notas internas"
            />
          </label>
        </div>

        {status.type !== "idle" && status.message ? (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              status.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {status.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!puedeGuardar || isSubmitting}
            className="px-5 py-2 text-sm"
          >
            {isSubmitting ? "Guardando..." : "Guardar egreso"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
