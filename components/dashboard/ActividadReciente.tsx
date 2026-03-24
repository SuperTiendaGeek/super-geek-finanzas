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
        {lista.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between rounded-md border border-slate-100 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">
                {item.descripcion || "Movimiento"}
              </p>
              <p className="text-xs text-slate-500">{formatDate(item.fecha)}</p>
            </div>
            <p
              className={`text-sm font-semibold ${
                item.tipo === "ingreso" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {item.tipo === "egreso" ? "-" : "+"}
              {formatCurrency(item.monto)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function getPlaceholder(): Transaccion[] {
  return [
    {
      id: "tx-placeholder-1",
      cuentaId: "cta-001",
      tipo: "ingreso",
      monto: 0,
      descripcion: "Sin datos aun",
      fecha: new Date().toISOString(),
    },
  ];
}