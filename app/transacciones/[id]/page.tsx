import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import { getTransaccionDetalle } from "@/services/transacciones";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { DEFAULT_CURRENCY } from "@/lib/constants";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "--" : value;
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="col-span-2 font-medium text-slate-900">{display}</span>
    </div>
  );
}

export default async function TransaccionDetallePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const detalle = await getTransaccionDetalle(id);

  if (!detalle?.transaccion) {
    return (
      <PageContainer title="Transacción" subtitle="Detalle de transacción">
        <Card>
          <p className="text-sm text-slate-600">No se encontró la transacción solicitada.</p>
        </Card>
      </PageContainer>
    );
  }

  const tx = detalle.transaccion;
  const currency = DEFAULT_CURRENCY;

  return (
    <PageContainer title="Transacción" subtitle={tx.idTransaccion ?? tx.id}>
      <Card>
        <div className="space-y-3">
          <Field label="Fecha" value={formatDate(tx.fecha)} />
          <Field label="Tipo" value={tx.tipoTransaccion} />
          <Field label="Concepto" value={tx.concepto} />
          <Field label="Cuenta origen" value={tx.cuentaOrigen} />
          <Field label="Cuenta destino" value={tx.cuentaDestino} />
          <Field label="Método de pago" value={tx.metodoPago} />
          <Field label="Monto total" value={formatCurrency(tx.montoTotal || 0, currency)} />
          <Field label="Estado" value={tx.estado} />
          <Field label="Referencia externa" value={tx.referenciaExterna} />
          <Field label="Observaciones" value={tx.descripcionObservaciones} />
          <Field label="Capital" value={formatCurrency(tx.capital || 0, currency)} />
          <Field label="Utilidad" value={formatCurrency(tx.utilidad || 0, currency)} />
          <Field label="IVA" value={formatCurrency(tx.iva || 0, currency)} />
        </div>
      </Card>
    </PageContainer>
  );
}
