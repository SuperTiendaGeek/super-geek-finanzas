import { calcularBalance, calcularFlujo } from "@/lib/calculations";
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
  const totalBalance = calcularBalance(cuentas);
  const { ingresos, egresos } = calcularFlujo(transacciones);
  return { totalBalance, ingresos, egresos };
}
