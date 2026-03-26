"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { Pendiente } from "@/types/pendiente";

interface Props {
  pendientes: Pendiente[];
}

type FormState = {
  fechaReal: string;
  comisionReal: string;
  observaciones: string;
};

export default function PendientesTable({ pendientes: initial }: Props) {
  const [pendientes, setPendientes] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    fechaReal: new Date().toISOString().slice(0, 10),
    comisionReal: "0",
    observaciones: "",
  }));
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const totals = useMemo(() => {
    const total = pendientes.length;
    const monto = pendientes.reduce((acc, p) => acc + (p.montoEsperado ?? 0), 0);
    const todayIso = new Date().toISOString().slice(0, 10);
    const hoy = pendientes.filter((p) => p.fecha?.startsWith(todayIso)).length;
    const medioCounts: Record<string, number> = {};
    pendientes.forEach((p) => {
      const key = p.medio || "Otro";
      medioCounts[key] = (medioCounts[key] ?? 0) + (p.montoEsperado ?? 0);
    });
    return { total, monto, hoy, medioCounts };
  }, [pendientes]);

  const selected = useMemo(() => pendientes.find((p) => p.id === selectedId) || null, [pendientes, selectedId]);
  const montoEsperado = selected?.montoEsperado ?? 0;
  const capitalOriginal = selected?.capital ?? 0;
  const utilidadOriginal = selected?.utilidad ?? 0;
  const ivaOriginal = selected?.iva ?? 0;
  const comisionIngresada = Number(form.comisionReal || 0);
  const utilidadNeta = Math.max(utilidadOriginal - comisionIngresada, 0);
  const montoAcreditado = capitalOriginal + utilidadNeta + ivaOriginal;
  const comisionExcede = comisionIngresada > utilidadOriginal;

  const onConfirm = async (id: string) => {
    if (!selected || !id) return;
    if (comisionExcede) {
      setMessage("La comisión no puede ser mayor a la utilidad original.");
      return;
    }

    setLoadingId(id);
    setMessage("");
    try {
      const res = await fetch("/api/pendientes/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          fechaRealAcreditacion: form.fechaReal,
          comisionReal: comisionIngresada,
          montoRealAcreditado: montoAcreditado,
          observaciones: form.observaciones,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo confirmar");
      }
      setPendientes((prev) => prev.filter((p) => p.id !== id));
      setSelectedId(null);
      setMessage("Movimiento acreditado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoadingId(null);
    }
  };

  const openForm = (p: Pendiente) => {
    setSelectedId(p.id);
    const baseComision = Number(p.comisionReal ?? p.comisionEstimada ?? 0) || 0;
    setForm({
      fechaReal: new Date().toISOString().slice(0, 10),
      comisionReal: String(baseComision),
      observaciones: p.observaciones ?? "",
    });
    setMessage("");
  };

  if (!pendientes.length) {
    return (
      <Card title="Movimientos Pendientes" description="Pagos en espera de acreditación">
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          No hay pendientes en este momento. ¡Todo al día!
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* Resumen superior */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total pendientes" value={totals.total} currency="" tone="amber" />
        <StatCard label="Monto pendiente" value={totals.monto} currency="USD" tone="amber" />
        <StatCard label="Pendientes hoy" value={totals.hoy} currency="" tone="blue" />
        <StatCard label="PayPhone / PayPal / DataFast" value={0} currency="" tone="neutral" hint="Ver tabla" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Medio</th>
              <th className="px-3 py-2 text-right">Monto esperado</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Cuenta destino</th>
              <th className="px-3 py-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendientes.map((p) => (
              <tr key={p.id} className="align-middle hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.fecha)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge className="bg-slate-100 text-slate-700">{p.medio || "-"}</Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-slate-900">
                  {formatCurrency(p.montoEsperado)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge className="bg-amber-100 text-amber-800">{p.estado}</Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{p.cuentaDestinoFinalNombre ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openForm(p)}
                    disabled={loadingId === p.id}
                    className="px-3 py-1.5 text-sm"
                  >
                    Confirmar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && selected ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">Confirmar acreditación</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Fecha real de acreditación
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={form.fechaReal}
                  onChange={(e) => setForm((prev) => ({ ...prev, fechaReal: e.target.value }))}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Comisión real
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={form.comisionReal}
                  onChange={(e) => setForm((prev) => ({ ...prev, comisionReal: e.target.value }))}
                />
                {comisionExcede ? (
                  <p className="text-xs text-red-600">No puede superar la utilidad original.</p>
                ) : (
                  <p className="text-xs text-slate-500">Solo descuenta de la utilidad.</p>
                )}
              </label>
            </div>

            <label className="mt-3 block text-sm font-medium text-slate-700">
              Observaciones
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                value={form.observaciones}
                onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
              />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Capital original</p>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(capitalOriginal)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Utilidad original</p>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(utilidadOriginal)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">IVA original</p>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(ivaOriginal)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Utilidad neta resultante</p>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(utilidadNeta)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">Monto a acreditar</p>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(montoAcreditado)}</p>
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedId(null)} disabled={loadingId !== null} className="px-4 py-2 text-sm">
                Cancelar
              </Button>
              <Button onClick={() => onConfirm(selectedId)} disabled={loadingId !== null} className="px-5 py-2 text-sm">
                {loadingId ? "Guardando..." : "Confirmar acreditación"}
              </Button>
            </div>
            {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
          </Card>

          <Card>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Resumen rápido</p>
              <div className="flex justify-between">
                <span>Medio</span>
                <Badge className="bg-slate-100 text-slate-700">{selected.medio}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Monto esperado</span>
                <span className="font-semibold text-slate-900">{formatCurrency(montoEsperado)}</span>
              </div>
              <div className="flex justify-between">
                <span>Capital original</span>
                <span className="font-semibold text-slate-900">{formatCurrency(capitalOriginal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Utilidad original</span>
                <span className="font-semibold text-slate-900">{formatCurrency(utilidadOriginal)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA original</span>
                <span className="font-semibold text-slate-900">{formatCurrency(ivaOriginal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Comisión real</span>
                <span className="font-semibold text-slate-900">{formatCurrency(comisionIngresada)}</span>
              </div>
              <div className="flex justify-between">
                <span>Utilidad neta</span>
                <span className="font-semibold text-slate-900">{formatCurrency(utilidadNeta)}</span>
              </div>
              <div className="flex justify-between">
                <span>Monto a acreditar</span>
                <span className="font-semibold text-slate-900">{formatCurrency(montoAcreditado)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cuenta destino</span>
                <span className="font-semibold text-slate-900">{selected.cuentaDestinoFinalNombre ?? "-"}</span>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </Card>
  );
}

