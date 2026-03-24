"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, safeNumber } from "@/lib/helpers";

type Concepto = "venta" | "orden_reparacion" | "reserva" | "otro";
type MetodoPago = "efectivo" | "transferencia" | "datafast" | "payphone" | "paypal" | "mixto";
type MetodoPagoMixto = Exclude<MetodoPago, "mixto">;

type PagoMixto = {
  id: string;
  metodo: MetodoPagoMixto;
  monto: string;
};

const conceptoOptions: { label: string; value: Concepto }[] = [
  { label: "Venta", value: "venta" },
  { label: "Orden de reparacion", value: "orden_reparacion" },
  { label: "Reserva", value: "reserva" },
  { label: "Otro ingreso", value: "otro" },
];

const metodoPagoOptions: { label: string; value: MetodoPago }[] = [
  { label: "Efectivo", value: "efectivo" },
  { label: "Transferencia bancaria", value: "transferencia" },
  { label: "DataFast", value: "datafast" },
  { label: "PayPhone", value: "payphone" },
  { label: "PayPal", value: "paypal" },
  { label: "Mixto", value: "mixto" },
];

const metodoMixtoOptions: { label: string; value: MetodoPagoMixto }[] = [
  { label: "Efectivo", value: "efectivo" },
  { label: "Transferencia bancaria", value: "transferencia" },
  { label: "DataFast", value: "datafast" },
  { label: "PayPhone", value: "payphone" },
  { label: "PayPal", value: "paypal" },
];

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none bg-white";

const readOnlyClass = "bg-slate-50 border-dashed text-slate-700";

const round2 = (value: number) => Math.round(value * 100) / 100;

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card title={title} description={description}>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {hint ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function cuentaYEstadoPorMetodo(metodo: MetodoPagoMixto) {
  switch (metodo) {
    case "efectivo":
      return { cuenta: "Caja Registradora", estado: "Procesada" };
    case "transferencia":
      return { cuenta: "SGINGRESOS", estado: "Procesada" };
    case "payphone":
      return { cuenta: "PayPhone", estado: "Pendiente" };
    case "paypal":
      return { cuenta: "PayPal", estado: "Pendiente" };
    case "datafast":
      return { cuenta: "(Definir routing DataFast)", estado: "Pendiente" };
    default:
      return { cuenta: "Por definir", estado: "Pendiente" };
  }
}

export default function IngresoForm() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [fecha, setFecha] = useState<string>(today);
  const [concepto, setConcepto] = useState<Concepto>("venta");
  const [llevaFactura, setLlevaFactura] = useState<boolean>(true);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [referencia, setReferencia] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");

  const [montosVenta, setMontosVenta] = useState({ montoTotal: "", capital: "", utilidad: "", iva: "" });

  const [montosReparacion, setMontosReparacion] = useState({
    manoObra: "",
    repuestoSG: "",
    repuestoProveedorExterno: "",
    iva: "",
    totalReparacion: "",
  });

  const [pagosMixtos, setPagosMixtos] = useState<PagoMixto[]>([{ id: "pago-1", metodo: "efectivo", monto: "" }]);

  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message?: string }>({ type: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (concepto !== "venta") return;
    const total = safeNumber(montosVenta.montoTotal, 0);
    const capitalNum = safeNumber(montosVenta.capital, 0);
    const esFactura = Boolean(llevaFactura);

    let base = total;
    let ivaCalc = 0;
    let utilidadCalc = total - capitalNum;

    if (esFactura) {
      base = round2(total / 1.15);
      ivaCalc = round2(total - base);
      utilidadCalc = round2(base - capitalNum);
    } else {
      utilidadCalc = round2(total - capitalNum);
      ivaCalc = 0;
    }

    setMontosVenta((prev) => ({ ...prev, utilidad: Number.isFinite(utilidadCalc) ? utilidadCalc.toFixed(2) : prev.utilidad, iva: Number.isFinite(ivaCalc) ? ivaCalc.toFixed(2) : prev.iva }));
  }, [concepto, montosVenta.montoTotal, montosVenta.capital, llevaFactura]);

  useEffect(() => {
    if (concepto !== "orden_reparacion") return;
    const manoObra = safeNumber(montosReparacion.manoObra, 0);
    const repuestoSG = safeNumber(montosReparacion.repuestoSG, 0);
    const repProveedor = safeNumber(montosReparacion.repuestoProveedorExterno, 0);
    const ivaCalc = llevaFactura ? safeNumber(montosReparacion.iva, 0) : 0;
    const totalCalc = manoObra + repuestoSG + repProveedor + ivaCalc;
    const rounded = round2(totalCalc).toFixed(2);
    setMontosReparacion((prev) => ({ ...prev, totalReparacion: rounded }));
  }, [concepto, montosReparacion.manoObra, montosReparacion.repuestoSG, montosReparacion.repuestoProveedorExterno, montosReparacion.iva, llevaFactura]);

  const cuentaInicial = useMemo(() => {
    switch (metodoPago) {
      case "efectivo":
        return "Caja Registradora";
      case "transferencia":
        return "SGINGRESOS";
      case "payphone":
        return "PayPhone";
      case "paypal":
        return "PayPal";
      case "datafast":
        return "SGINGRESOS";
      case "mixto":
        return "Mixto (definir)";
      default:
        return "Por definir";
    }
  }, [metodoPago]);

  const estadoInicial = useMemo(() => {
    switch (metodoPago) {
      case "payphone":
      case "paypal":
      case "datafast":
        return "Pendiente";
      default:
        return "Procesada";
    }
  }, [metodoPago]);

  const ventaNumeros = {
    montoTotal: safeNumber(montosVenta.montoTotal, 0),
    capital: safeNumber(montosVenta.capital, 0),
    utilidad: safeNumber(montosVenta.utilidad, 0),
    iva: llevaFactura ? safeNumber(montosVenta.iva, 0) : 0,
  };

  const reparacionNumeros = {
    manoObra: safeNumber(montosReparacion.manoObra, 0),
    repuestoSG: safeNumber(montosReparacion.repuestoSG, 0),
    repuestoProveedorExterno: safeNumber(montosReparacion.repuestoProveedorExterno, 0),
    iva: llevaFactura ? safeNumber(montosReparacion.iva, 0) : 0,
    totalReparacion: safeNumber(montosReparacion.totalReparacion, 0),
  };

  const ventaDiff = concepto === "venta" ? ventaNumeros.montoTotal - (ventaNumeros.capital + ventaNumeros.utilidad + ventaNumeros.iva) : 0;
  const reparacionEsperado = concepto === "orden_reparacion" ? reparacionNumeros.manoObra + reparacionNumeros.repuestoSG + reparacionNumeros.repuestoProveedorExterno + reparacionNumeros.iva : 0;
  const reparacionDiff = concepto === "orden_reparacion" ? reparacionNumeros.totalReparacion - reparacionEsperado : 0;

  const distribucion = useMemo(() => {
    if (concepto === "venta") {
      return { capital: ventaNumeros.capital, utilidad: ventaNumeros.utilidad, iva: ventaNumeros.iva, repuestoExterno: 0, total: ventaNumeros.montoTotal };
    }
    if (concepto === "orden_reparacion") {
      return {
        capital: reparacionNumeros.repuestoSG,
        utilidad: reparacionNumeros.manoObra,
        iva: reparacionNumeros.iva,
        repuestoExterno: reparacionNumeros.repuestoProveedorExterno,
        total: reparacionNumeros.totalReparacion,
      };
    }
    const monto = safeNumber(montosVenta.montoTotal || montosReparacion.totalReparacion, 0);
    return { capital: monto, utilidad: 0, iva: 0, repuestoExterno: 0, total: monto };
  }, [concepto, montosVenta, montosReparacion, ventaNumeros, reparacionNumeros]);

  const totalIngreso = useMemo(() => {
    switch (concepto) {
      case "venta":
        return ventaNumeros.montoTotal;
      case "orden_reparacion":
        return reparacionNumeros.totalReparacion;
      default:
        return safeNumber(montosVenta.montoTotal, 0);
    }
  }, [concepto, ventaNumeros, reparacionNumeros, montosVenta]);

  const totalMixto = pagosMixtos.reduce((acc, pago) => acc + safeNumber(pago.monto, 0), 0);
  const diffMixto = metodoPago === "mixto" ? totalIngreso - totalMixto : 0;
  const diffColor = Math.abs(diffMixto) > 0.009 ? "text-amber-700" : "text-emerald-700";

  const handlePagoChange = (id: string, updates: Partial<PagoMixto>) => {
    setPagosMixtos((prev) => prev.map((pago) => (pago.id === id ? { ...pago, ...updates } : pago)));
  };

  const handleAgregarPago = () => {
    const nextId = `pago-${pagosMixtos.length + 1}`;
    setPagosMixtos((prev) => [...prev, { id: nextId, metodo: "efectivo", monto: "" }]);
  };

  const handleEliminarPago = (id: string) => {
    setPagosMixtos((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  };

  const validationColor = (value: number) => (Math.abs(value) > 0.009 ? "text-amber-600" : "text-emerald-700");

  const handleFacturaToggle = (value: boolean) => {
    setLlevaFactura(value);
    if (!value) {
      setMontosVenta((prev) => ({ ...prev, iva: "0" }));
      setMontosReparacion((prev) => ({ ...prev, iva: "0" }));
    }
  };

  const handleSubmit = async () => {
    if (concepto === "venta" && Math.abs(ventaDiff) > 0.009) {
      setStatus({ type: "error", message: "El total de la venta no cuadra con capital + utilidad + IVA." });
      return;
    }
    if (concepto === "orden_reparacion" && Math.abs(reparacionDiff) > 0.009) {
      setStatus({ type: "error", message: "La reparacion no cuadra con sus componentes." });
      return;
    }
    if (metodoPago === "mixto" && Math.abs(diffMixto) > 0.009) {
      setStatus({ type: "error", message: "El pago mixto no cuadra con el total del ingreso." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "idle" });

      const response = await fetch("/api/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concepto, fecha, metodoPago, referencia, observaciones, llevaFactura, montosVenta, montosReparacion, pagosMixtos, totalIngreso }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string; data?: Record<string, unknown> };

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudo guardar el ingreso.");
      }

      const txId = payload.data?.transaccionId as string | undefined;
      setStatus({ type: "success", message: txId ? `Ingreso guardado (ID ${txId}).` : "Ingreso guardado." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido al guardar.";
      setStatus({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pillBase = "rounded-full border px-3 py-1.5 text-sm font-medium transition";
  const pillActive = "border-slate-900 bg-slate-900 text-white shadow-sm";
  const pillInactive = "border-slate-200 bg-white text-slate-700 hover:border-slate-300";

  return (
    <div className="space-y-5">
      <Section title="Tipo de ingreso y metodo">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Concepto</p>
            <div className="flex flex-wrap gap-2">
              {conceptoOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setConcepto(option.value)}
                  className={`${pillBase} ${concepto === option.value ? pillActive : pillInactive}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Metodo de pago</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {metodoPagoOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMetodoPago(option.value)}
                  className={`${pillBase} ${metodoPago === option.value ? pillActive : pillInactive}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Datos generales">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Lleva factura">
            <div className="flex gap-2">
              <button type="button" onClick={() => handleFacturaToggle(true)} className={`${pillBase} ${llevaFactura ? pillActive : pillInactive}`}>
                Sí
              </button>
              <button type="button" onClick={() => handleFacturaToggle(false)} className={`${pillBase} ${!llevaFactura ? pillActive : pillInactive}`}>
                No
              </button>
            </div>
          </Field>

          <Field label="Referencia externa">
            <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="OPC-123, factura, etc." className={inputClass} />
          </Field>

          <Field label="Observaciones">
            <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas internas" className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title="Metodo de pago mixto" description={metodoPago === "mixto" ? "Distribuye el cobro" : ""}>
        {metodoPago !== "mixto" ? (
          <p className="text-sm text-slate-600">Selecciona "Mixto" para dividir entre varios metodos.</p>
        ) : (
          <div className="space-y-3">
            {pagosMixtos.map((pago) => {
              const meta = cuentaYEstadoPorMetodo(pago.metodo);
              return (
                <div key={pago.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-5">
                  <Field label="Metodo">
                    <select className={inputClass} value={pago.metodo} onChange={(e) => handlePagoChange(pago.id, { metodo: e.target.value as MetodoPagoMixto })}>
                      {metodoMixtoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Monto">
                    <input type="number" min="0" value={pago.monto} onChange={(e) => handlePagoChange(pago.id, { monto: e.target.value })} className={inputClass} placeholder="0.00" />
                  </Field>

                  <Field label="Cuenta inicial">
                    <div className={`${inputClass} ${readOnlyClass} bg-slate-50`}>{meta.cuenta}</div>
                  </Field>

                  <Field label="Estado esperado">
                    <Badge className={meta.estado === "Pendiente" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>{meta.estado}</Badge>
                  </Field>

                  <div className="flex items-end justify-end">
                    <Button type="button" variant="ghost" className="text-sm text-slate-600 hover:bg-slate-100" onClick={() => handleEliminarPago(pago.id)} disabled={pagosMixtos.length <= 1}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="secondary" onClick={handleAgregarPago}>
                Agregar metodo
              </Button>
              <div className="text-sm text-slate-600">Filas activas: {pagosMixtos.length}</div>
              <div className="text-sm text-slate-600">
                Diferencia: <span className={`${diffColor} font-semibold`}>{formatCurrency(diffMixto)}</span>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Montos" description="Captura y revisa que los totales cuadren">
        {concepto === "venta" && (
          <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Monto total" hint="Editable">
              <input type="number" min="0" value={montosVenta.montoTotal} onChange={(e) => setMontosVenta((prev) => ({ ...prev, montoTotal: e.target.value }))} className={`${inputClass} w-full max-w-xs`} placeholder="0.00" />
            </Field>
            <Field label="Capital" hint="Editable">
              <input type="number" min="0" value={montosVenta.capital} onChange={(e) => setMontosVenta((prev) => ({ ...prev, capital: e.target.value }))} className={`${inputClass} w-full max-w-xs`} placeholder="0.00" />
            </Field>
            <Field label="Utilidad" hint={concepto === "venta" ? "Auto" : "Editable"}>
              <input type="number" min="0" value={montosVenta.utilidad} readOnly={concepto === "venta"} onChange={(e) => setMontosVenta((prev) => ({ ...prev, utilidad: e.target.value }))} className={`${inputClass} w-full max-w-xs ${concepto === "venta" ? readOnlyClass : ""}`} placeholder="0.00" />
            </Field>
            <Field label={`IVA ${llevaFactura ? "" : "(desactivado)"}`} hint={concepto === "venta" ? "Auto" : "Editable"}>
              <input type="number" min="0" value={llevaFactura ? montosVenta.iva : "0"} readOnly={concepto === "venta"} onChange={(e) => setMontosVenta((prev) => ({ ...prev, iva: e.target.value }))} className={`${inputClass} w-full max-w-xs ${(concepto === "venta" || !llevaFactura) ? readOnlyClass : ""}`} placeholder="0.00" disabled={!llevaFactura || concepto === "venta"} />
            </Field>
            <div className="md:col-span-2 lg:col-span-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium">Diferencia total:</span>
              <span className={`${validationColor(ventaDiff)} font-semibold`}>{formatCurrency(ventaDiff)}</span>
              <span className="text-xs text-slate-500">Debe igualar capital + utilidad + IVA.</span>
            </div>
          </div>
        )}

        {concepto === "orden_reparacion" && (
          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="Mano de obra (Utilidad)" hint="Editable">
              <input type="number" min="0" value={montosReparacion.manoObra} onChange={(e) => setMontosReparacion((prev) => ({ ...prev, manoObra: e.target.value }))} className={inputClass} placeholder="0.00" />
            </Field>
            <Field label="Repuesto proporcionado por SG (Capital)" hint="Editable">
              <input type="number" min="0" value={montosReparacion.repuestoSG} onChange={(e) => setMontosReparacion((prev) => ({ ...prev, repuestoSG: e.target.value }))} className={inputClass} placeholder="0.00" />
            </Field>
            <Field label="Repuesto proveedor externo" hint="Editable">
              <input type="number" min="0" value={montosReparacion.repuestoProveedorExterno} onChange={(e) => setMontosReparacion((prev) => ({ ...prev, repuestoProveedorExterno: e.target.value }))} className={inputClass} placeholder="0.00" />
            </Field>
            <Field label={`IVA ${llevaFactura ? "" : "(desactivado)"}`} hint={!llevaFactura ? "Auto" : "Editable"}>
              <input type="number" min="0" value={llevaFactura ? montosReparacion.iva : "0"} onChange={(e) => setMontosReparacion((prev) => ({ ...prev, iva: e.target.value }))} className={`${inputClass} ${!llevaFactura ? readOnlyClass : ""}`} placeholder="0.00" disabled={!llevaFactura} />
            </Field>
            <Field label="Total reparacion" hint="Auto">
              <input type="number" min="0" value={montosReparacion.totalReparacion} readOnly disabled className={`${inputClass} ${readOnlyClass}`} placeholder="0.00" />
            </Field>
            <div className="lg:col-span-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium">Diferencia total:</span>
              <span className={`${validationColor(reparacionDiff)} font-semibold`}>{formatCurrency(reparacionDiff)}</span>
              <span className="text-xs text-slate-500">Debe igualar mano de obra + repuestos + IVA.</span>
            </div>
          </div>
        )}

        {(concepto === "reserva" || concepto === "otro") && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Monto total" hint="Editable">
              <input type="number" min="0" value={montosVenta.montoTotal} onChange={(e) => setMontosVenta((prev) => ({ ...prev, montoTotal: e.target.value }))} className={inputClass} placeholder="0.00" />
            </Field>
            <div className="flex items-center rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Para reservas u otros ingresos solo se captura el monto global.</div>
          </div>
        )}
      </Section>

      <Section title="Resultado automatico">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Cuenta de entrada inicial</p>
              <p className="text-lg font-semibold text-slate-900">{cuentaInicial}</p>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estado inicial</p>
              <Badge className={estadoInicial === "Pendiente" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>{estadoInicial}</Badge>
            </div>
            <div className="mt-4 text-xs text-slate-500">Metodo: {metodoPago}</div>
            <div className="text-xs text-slate-500">Concepto: {concepto}</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Distribucion contable esperada</p>
              <Badge className="bg-slate-100 text-slate-700">Preview</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <dt>Capital</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(distribucion.capital)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <dt>Utilidad</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(distribucion.utilidad)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <dt>IVA</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(distribucion.iva)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <dt>Repuesto externo</dt>
                <dd className="font-semibold text-slate-900">{formatCurrency(distribucion.repuestoExterno)}</dd>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                <dt>Total</dt>
                <dd>{formatCurrency(distribucion.total)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </Section>

      {status.type !== "idle" && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${status.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {status.message}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2 text-sm">
          {isSubmitting ? "Guardando..." : "Guardar ingreso"}
        </Button>
      </div>
    </div>
  );
}
