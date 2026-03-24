import { calcularSaldoTotal, calcularSaldosPorCuenta } from "@/lib/calculations";
import { Cuenta } from "@/types/cuenta";
import { Transaccion } from "@/types/transaccion";

export interface DashboardSnapshot {
  totalBalance: number;
  ingresos: number;
  egresos: number;
}

export function buildDashboardSnapshot(
  cuentas: Cuenta[] = [],
  transacciones: Transaccion[] = []
): DashboardSnapshot {
  const saldos = calcularSaldosPorCuenta(cuentas, transacciones);
  const totalBalance = calcularSaldoTotal(saldos);

  const ingresos = transacciones
    .filter((t) => (t.tipoTransaccion || "").toLowerCase() === "ingreso")
    .reduce((acc, t) => acc + (t.montoTotal || 0), 0);

  const egresos = transacciones
    .filter((t) => (t.tipoTransaccion || "").toLowerCase() === "egreso")
    .reduce((acc, t) => acc + (t.montoTotal || 0), 0);

  return { totalBalance, ingresos, egresos };
}

