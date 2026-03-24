import Card from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { Transaccion } from "@/types/transaccion";

interface ActividadRecienteProps {
  items?: Transaccion[];
}

export default function ActividadReciente({ items = [] }: ActividadRecienteProps) {
  const lista = items.length ? items : getPlaceholder();

  return (
    <Card title="Actividad reciente" description="Ultimos movimientos registrados">
      <ul className="space-y-3">
        {lista.map((item) => {
          const tipo = (item.tipoTransaccion || "").toLowerCase();
          const esEgreso = tipo === "egreso";
          const monto = item.montoTotal ?? 0;
          const descripcion = item.descripcion ?? item.concepto ?? "Movimiento";

          return (
            <li key={item.id} className="flex items-start justify-between rounded-md border border-slate-100 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{descripcion}</p>
                <p className="text-xs text-slate-500">{formatDate(item.fecha)}</p>
              </div>
              <p className={`text-sm font-semibold ${esEgreso ? "text-rose-600" : "text-emerald-600"}`}>
                {esEgreso ? "-" : "+"}
                {formatCurrency(monto)}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function getPlaceholder(): Transaccion[] {
  return [
    {
      id: "tx-placeholder-1",
      fecha: new Date().toISOString(),
      tipoTransaccion: "ingreso",
      concepto: "Sin datos aun",
      estado: "pendiente",
      montoTotal: 0,
    },
  ];
}

