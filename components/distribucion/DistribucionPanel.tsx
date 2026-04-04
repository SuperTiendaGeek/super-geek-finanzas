"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { formatCurrency, roundMoney } from "@/lib/helpers";
import type { DistribucionContable } from "@/services/distribucion";

type ComponenteKey = "capital" | "utilidad" | "iva";

type Props = {
  distribucion: DistribucionContable;
  saldoIngresos: number;
  currency?: string;
  saldosDestino?: Partial<Record<ComponenteKey, number>>;
  totalesUsados?: Partial<Record<ComponenteKey, number>>;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

const COMPONENTES: { key: ComponenteKey; label: string }[] = [
  { key: "capital", label: "Capital" },
  { key: "utilidad", label: "Utilidad" },
  { key: "iva", label: "IVA" },
];

const DISPONIBLE_LABEL: Record<ComponenteKey, string> = {
  capital: "Capital disponible",
  utilidad: "Utilidad disponible",
  iva: "IVA disponible",
};

export default function DistribucionPanel({
  distribucion,
  saldoIngresos,
  currency = DEFAULT_CURRENCY,
  saldosDestino,
  totalesUsados,
}: Props) {
  const router = useRouter();
  const [montos, setMontos] = useState<Record<ComponenteKey, string>>({ capital: "", utilidad: "", iva: "" });
  const [loading, setLoading] = useState<ComponenteKey | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje>(null);

  const pendientes = useMemo(
    () => ({
      capital: roundMoney(distribucion.capital.pendiente),
      utilidad: roundMoney(distribucion.utilidad.pendiente),
      iva: roundMoney(distribucion.iva.pendiente),
    }),
    [distribucion]
  );

  const disponibles = useMemo(
    () => ({
      capital: roundMoney(saldosDestino?.capital ?? 0),
      utilidad: roundMoney(saldosDestino?.utilidad ?? 0),
      iva: roundMoney(saldosDestino?.iva ?? 0),
    }),
    [saldosDestino]
  );

  const usados = useMemo(
    () => ({
      capital: roundMoney(totalesUsados?.capital ?? 0),
      utilidad: roundMoney(totalesUsados?.utilidad ?? 0),
      iva: roundMoney(totalesUsados?.iva ?? 0),
    }),
    [totalesUsados]
  );

  const saldo = roundMoney(saldoIngresos);

  const handleSubmit = async (key: ComponenteKey, montoSolicitado?: number) => {
    const parsed = montoSolicitado ?? Number(montos[key] || 0);
    const monto = roundMoney(parsed);
    const pendiente = pendientes[key];
    setMensaje(null);

    if (!Number.isFinite(monto) || monto <= 0) {
      setMensaje({ type: "error", text: "Ingresa un monto válido" });
      return;
    }

    if (roundMoney(monto - pendiente) > 0) {
      setMensaje({ type: "error", text: "No puedes distribuir más de lo pendiente" });
      return;
    }

    if (roundMoney(monto - saldo) > 0) {
      setMensaje({ type: "error", text: "Saldo insuficiente en SGINGRESOS" });
      return;
    }

    try {
      setLoading(key);
      const res = await fetch("/api/distribucion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componente: key, monto }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo registrar la distribución");
      }
      setMensaje({ type: "success", text: "Distribución registrada" });
      setMontos((prev) => ({ ...prev, [key]: "" }));
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setMensaje({ type: "error", text: message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {mensaje ? (
        <div
          className={`rounded-md px-3 py-2 text-sm ${mensaje.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
        >
          {mensaje.text}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {COMPONENTES.map(({ key, label }) => {
          const data = distribucion[key];
          const pendiente = pendientes[key];
          const disponible = disponibles[key];
          const usado = usados[key];
          const disabled = loading === key;

          return (
            <Card key={key}>
              <div className="flex h-full flex-col gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="text-xs text-slate-500">Pendiente a distribuir</p>
                  <p className="text-3xl font-semibold text-slate-900">{formatCurrency(pendiente, currency)}</p>
                </div>

                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-600">{DISPONIBLE_LABEL[key]}</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(disponible, currency)}</span>
                  </div>

                  <label className="block text-xs font-medium text-slate-600">
                    Monto a distribuir
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={montos[key]}
                      placeholder={pendiente.toFixed(2)}
                      onChange={(e) => setMontos((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSubmit(key, pendiente)}
                      disabled={pendiente <= 0 || disabled}
                    >
                      Distribuir pendiente
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSubmit(key)}
                      disabled={disabled}
                    >
                      Distribuir monto
                    </Button>
                  </div>
                </div>

                <div className="mt-auto space-y-1 border-t border-dashed border-slate-200 pt-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span>Generado total</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(roundMoney(data.generado), currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total usado</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(usado, currency)}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Saldo disponible en SGINGRESOS: {formatCurrency(saldo, currency)}</p>
    </div>
  );
}
