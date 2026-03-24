import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { getCuentaDetalle } from "@/services/cuentas";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col text-sm">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className="text-slate-800">{value ?? "--"}</span>
    </div>
  );
}

function BooleanText({ value }: { value: boolean }) {
  return <span className="text-slate-800">{value ? "Si" : "No"}</span>;
}

export default async function CuentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await getCuentaDetalle(id);

  if (!detalle) {
    return (
      <PageContainer title="Cuenta" subtitle="Detalle de cuenta">
        <Card>
          <p className="text-sm text-amber-700">No se encontro la cuenta solicitada.</p>
          <Link href="/cuentas" className="text-blue-600 hover:underline text-sm">
            Volver a cuentas
          </Link>
        </Card>
      </PageContainer>
    );
  }

  const { cuenta, saldoActual, totalRecibido, totalEnviado, totalEgresado, cantidadTransacciones, transacciones } = detalle;

  return (
    <PageContainer
      title={`Cuenta: ${cuenta.nombre}`}
      subtitle="Detalle e historial de la cuenta"
      actions={
        <Link href="/cuentas" className="text-sm text-blue-600 hover:underline">
          Volver a cuentas
        </Link>
      }
    >
      <div className="space-y-4">
        <Card title="Información general" description="Configuración de la cuenta">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nombre" value={cuenta.nombre} />
            <Field label="Tipo de Cuenta" value={cuenta.tipoCuenta} />
            <Field label="Permite Ingresos" value={<BooleanText value={cuenta.permiteIngresos} />} />
            <Field label="Permite Egresos" value={<BooleanText value={cuenta.permiteEgresos} />} />
            <Field label="Permite Transferencias" value={<BooleanText value={cuenta.permiteTransferencias} />} />
            <Field label="Activa" value={<BooleanText value={cuenta.activa} />} />
          </div>
        </Card>

        <Card title="Resumen contable" description="Saldos y totales">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Saldo actual" value={formatCurrency(saldoActual)} />
            <Field label="Total recibido" value={formatCurrency(totalRecibido)} />
            <Field label="Total enviado" value={formatCurrency(totalEnviado)} />
            <Field label="Total egresado" value={formatCurrency(totalEgresado)} />
            <Field label="Transacciones relacionadas" value={cantidadTransacciones} />
          </div>
        </Card>

        <Card title="Historial de transacciones" description="Participación de la cuenta">
          {transacciones.length === 0 ? (
            <p className="text-sm text-slate-600">No hay transacciones relacionadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">ID Transaccion</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2">Contraparte</th>
                    <th className="px-3 py-2">Metodo de Pago</th>
                    <th className="px-3 py-2">Monto Total</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transacciones.map((tx) => {
                    const esOrigen = tx.cuentaOrigenId === cuenta.id;
                    const rol = esOrigen ? "Origen" : "Destino";
                    const contraparte = esOrigen ? tx.cuentaDestino : tx.cuentaOrigen;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 whitespace-nowrap">{tx.fecha ? formatDate(tx.fecha) : "--"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{tx.idTransaccion ?? tx.id}</td>
                        <td className="px-3 py-2 capitalize">{tx.tipoTransaccion || "-"}</td>
                        <td className="px-3 py-2">{tx.concepto || "-"}</td>
                        <td className="px-3 py-2">{rol}</td>
                        <td className="px-3 py-2">{contraparte ?? "--"}</td>
                        <td className="px-3 py-2">{tx.metodoPago ?? "--"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-900">{formatCurrency(tx.montoTotal)}</td>
                        <td className="px-3 py-2">{tx.estado || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}