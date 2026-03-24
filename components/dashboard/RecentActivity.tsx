import type { Transaccion } from "@/types/transaccion";
import { formatCurrency, formatDate } from "@/lib/helpers";

interface Props {
  transacciones: Transaccion[];
  currency?: string;
  limit?: number;
}

function stateTone(estado: string) {
  const e = (estado || "").toLowerCase();
  if (e.includes("anul") || e.includes("cancel")) return "bg-rose-100 text-rose-800";
  if (e.includes("pend")) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

export default function RecentActivity({ transacciones, currency = "USD", limit = 8 }: Props) {
  const items = transacciones.slice(0, limit);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Actividad reciente</p>
          <p className="text-xs text-slate-500">Últimas transacciones registradas</p>
        </div>
        <span className="text-xs text-slate-500">{items.length} ítems</span>
      </div>
      {!items.length ? (
        <p className="text-sm text-slate-500">Aún no hay transacciones.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-500">{formatDate(tx.fecha)}</p>
                <p className="text-sm font-medium text-slate-900">{tx.concepto || tx.tipoTransaccion}</p>
                <p className="text-xs text-slate-500">{tx.tipoTransaccion}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(tx.montoTotal || 0, currency)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateTone(tx.estado)}`}>
                  {tx.estado || "-"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
