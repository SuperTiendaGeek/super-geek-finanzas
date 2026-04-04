import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import { getTransaccionDetalle } from "@/services/transacciones";
import { getTransacciones } from "@/services/transacciones";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import TransaccionActions from "@/components/transacciones/TransaccionActions";

export const dynamic = "force-dynamic";

type FieldValue = string | number | null | undefined | boolean;

function Field({ label, value }: { label: string; value: FieldValue }) {
  let display: string | number = "--";
  if (typeof value === "boolean") display = value ? "Sí" : "No";
  else if (value !== null && value !== undefined && value !== "") display = value;

  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="col-span-2 font-medium text-slate-900 break-words">{display}</span>
    </div>
  );
}

type BadgeTone = "green" | "red" | "amber" | "blue" | "slate";

function badgeClasses(tone: BadgeTone) {
  if (tone === "green") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (tone === "red") return "bg-rose-50 text-rose-700 border border-rose-100";
  if (tone === "amber") return "bg-amber-50 text-amber-700 border border-amber-100";
  if (tone === "blue") return "bg-blue-50 text-blue-700 border border-blue-100";
  return "bg-slate-50 text-slate-700 border border-slate-200";
}

function StatusBadge({ estado }: { estado?: string }) {
  if (!estado) return null;
  const e = estado.toLowerCase();
  const tone: BadgeTone =
    e.includes("anul") || e.includes("cancel") ? "red" : e.includes("pend") ? "amber" : "green";
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${badgeClasses(tone)}`}>{estado}</span>;
}

function TypeBadge({ tipo }: { tipo?: string }) {
  if (!tipo) return null;
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${badgeClasses("blue")}`}>{tipo}</span>;
}

function MetodoBadge({ metodo }: { metodo?: string }) {
  if (!metodo) return null;
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${badgeClasses("slate")}`}>{metodo}</span>;
}

function maybeField(label: string, value: FieldValue, opts: { currency?: string; hideIfEmpty?: boolean } = {}) {
  const { currency, hideIfEmpty = true } = opts;
  if (hideIfEmpty && (value === null || value === undefined || value === "")) return null;
  const render =
    typeof value === "number" && currency
      ? formatCurrency(value, currency)
      : typeof value === "boolean"
        ? value
          ? "Sí"
          : "No"
        : value ?? "No aplica";
  return <Field key={label} label={label} value={render} />;
}

function isIngresoLike(tipo?: string) {
  if (!tipo) return false;
  const t = tipo.toLowerCase();
  return t.includes("ingreso") || t.includes("acredit") || t.includes("venta");
}

export default async function TransaccionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  console.log("[transacciones/[id]] params:", resolvedParams);
  console.log("[transacciones/[id]] id extraído:", id);
  const detalle = await getTransaccionDetalle(id);
  console.log("[transacciones/[id]] detalle result foundBy:", detalle?.foundBy, "error:", detalle?.error);

  if (!detalle?.transaccion) {
    const error = detalle?.error || "No se encontró la transacción solicitada.";
    const requested = id || "(sin valor)";
    return (
      <PageContainer title="Transacción" subtitle="Detalle de transacción">
        <Card>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-rose-700">No se encontró la transacción.</p>
            <p className="text-sm text-slate-700">{error}</p>
            <p className="text-xs text-slate-500">ID solicitado: {requested}</p>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const tx = detalle.transaccion;
  const currency = DEFAULT_CURRENCY;

  // Obtener vecinos según el mismo orden del listado (más recientes primero).
  const transaccionesOrdenadas = await getTransacciones();
  const idx = transaccionesOrdenadas.findIndex((t) => t.recordId === tx.recordId);
  const prevId = idx >= 0 && idx < transaccionesOrdenadas.length - 1 ? transaccionesOrdenadas[idx + 1].recordId : null;
  const nextId = idx > 0 ? transaccionesOrdenadas[idx - 1].recordId : null;

  const showMontoNeto = isIngresoLike(tx.tipoTransaccion) && Boolean(tx.montoNetoRecibido);
  const highlightMontoTotal = formatCurrency(tx.montoTotal || 0, currency);

  return (
    <PageContainer
      title={`Transacción ${tx.idTransaccion ? `#${tx.idTransaccion}` : `#${tx.recordId}`}`}
      subtitle="Detalle de transacción"
      actions={
        <TransaccionActions currentId={tx.recordId} estado={tx.estado} prevId={prevId} nextId={nextId} />
      }
    >
      <div className="space-y-5">
        <Card>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-900">
                {tx.tipoTransaccion || "Transacción"}
              </p>
              <p className="text-sm text-slate-600 flex flex-wrap gap-2 items-center">
                {tx.tipoTransaccion ? <span>{tx.tipoTransaccion}</span> : null}
                {tx.estado ? <span>· {tx.estado}</span> : null}
                {tx.fecha ? <span>· {formatDate(tx.fecha)}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge estado={tx.estado} />
              <TypeBadge tipo={tx.tipoTransaccion} />
              <MetodoBadge metodo={tx.metodoPago} />
            </div>
          </div>
        </Card>

        <Card title="Información principal">
          <div className="space-y-3">
            <Field label="ID Transacción" value={tx.idTransaccion ?? tx.recordId} />
            <Field label="Fecha" value={formatDate(tx.fecha)} />
            {maybeField("Tipo de Transacción", tx.tipoTransaccion, { hideIfEmpty: true })}
            {maybeField("Concepto", tx.concepto, { hideIfEmpty: true })}
            {maybeField("Estado", tx.estado, { hideIfEmpty: true })}
            {maybeField("Cuenta origen", tx.cuentaOrigen, { hideIfEmpty: true })}
            {maybeField("Cuenta destino", tx.cuentaDestino, { hideIfEmpty: true })}
            {maybeField("Método de pago", tx.metodoPago, { hideIfEmpty: true })}
            <Field label="Monto total" value={highlightMontoTotal} />
          </div>
        </Card>

        <Card title="Montos">
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Monto total</p>
              <p className="text-2xl font-semibold text-slate-900">{highlightMontoTotal}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {maybeField("Capital", tx.capital, { currency, hideIfEmpty: false })}
              {maybeField("Utilidad", tx.utilidad, { currency, hideIfEmpty: false })}
              {maybeField("IVA", tx.iva, { currency, hideIfEmpty: false })}
              {maybeField("Repuesto Proveedor Externo", tx.repuestoProveedorExterno, { currency, hideIfEmpty: false })}
              {maybeField("Comisión", tx.comision, { currency, hideIfEmpty: false })}
              {showMontoNeto ? maybeField("Monto Neto Recibido", tx.montoNetoRecibido, { currency }) : null}
              {tx.esDistribucionContable ? (
                <>
                  <Field label="Es distribución contable" value={tx.esDistribucionContable} />
                  {maybeField("Componente distribuido", tx.componenteDistribuido, { hideIfEmpty: true })}
                  {maybeField("Monto distribuido", tx.montoDistribuido, { currency, hideIfEmpty: false })}
                </>
              ) : null}
            </div>
          </div>
        </Card>

        <Card title="Control y auditoría">
          <div className="space-y-3">
            {maybeField("Record ID", tx.recordId, { hideIfEmpty: false })}
            {maybeField("Tipo de Flujo", tx.tipoFlujo, { hideIfEmpty: true })}
            {maybeField("Referencia externa", tx.referenciaExterna, { hideIfEmpty: true })}
            {maybeField("Descripción / Observaciones", tx.descripcionObservaciones, { hideIfEmpty: true })}
            {maybeField("Lleva factura", tx.llevaFactura, { hideIfEmpty: true })}
            {maybeField("Estado previo", tx.estadoPrevio, { hideIfEmpty: true })}
            {maybeField("Motivo anulación", tx.motivoAnulacion, { hideIfEmpty: true })}
            {maybeField("Fecha anulación", tx.fechaAnulacion, { hideIfEmpty: true })}
            {maybeField("Anulada por", tx.anuladaPor, { hideIfEmpty: true })}
            {maybeField("Fecha rehabilitación", tx.fechaRehabilitacion, { hideIfEmpty: true })}
            {maybeField("Rehabilitada por", tx.rehabilitadaPor, { hideIfEmpty: true })}
          </div>
        </Card>

        <Card title="Vinculados">
          {detalle.detalleReparacion || (detalle.pendientes && detalle.pendientes.length) ? (
            <div className="space-y-3">
              {detalle.detalleReparacion ? (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Detalle de reparación</p>
                  <p className="text-sm text-slate-600">{JSON.stringify(detalle.detalleReparacion)}</p>
                </div>
              ) : null}
              {detalle.pendientes && detalle.pendientes.length ? (
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <p className="text-sm font-semibold text-slate-800">Pendientes relacionados</p>
                  <ul className="text-sm text-slate-600 list-disc pl-4">
                    {detalle.pendientes.map((p, idx) => (
                      <li key={idx}>{JSON.stringify(p)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No hay información vinculada disponible para esta transacción.</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
