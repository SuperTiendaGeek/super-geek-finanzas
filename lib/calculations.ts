import { Cuenta } from "@/types/cuenta";
import { Transaccion } from "@/types/transaccion";
import { safeNumber } from "@/lib/helpers";

// Normaliza cualquier valor numérico; fallback en 0.
export function normalizeAmount(value: unknown): number {
  return safeNumber(value, 0);
}

// Devuelve el impacto de una transaccion sobre una cuenta concreta.
// Usa IDs de cuenta si existen; cae a nombres si es lo unico disponible.
export function transactionImpactForAccount(
  transaccion: Transaccion,
  cuentaId: string
): number {
  const amount = normalizeAmount(transaccion.montoTotal);
  if (!amount) return 0;

  const destino = transaccion.cuentaDestinoId ?? transaccion.cuentaDestino;
  const origen = transaccion.cuentaOrigenId ?? transaccion.cuentaOrigen;

  if (destino === cuentaId) return amount;
  if (origen === cuentaId) return -amount;
  return 0;
}

// Calcula saldo dinamico por cuenta a partir de las transacciones.
export function calcularSaldosPorCuenta(
  cuentas: Cuenta[],
  transacciones: Transaccion[]
): Record<string, number> {
  const saldos: Record<string, number> = {};

  for (const cuenta of cuentas) {
    saldos[cuenta.id] = 0;
  }

  for (const txn of transacciones) {
    if ((txn.estado ?? "").toLowerCase() === "pendiente") continue;
    const monto = normalizeAmount(txn.montoTotal);
    if (!monto) continue;

    const destino = txn.cuentaDestinoId ?? txn.cuentaDestino;
    const origen = txn.cuentaOrigenId ?? txn.cuentaOrigen;

    if (destino && saldos.hasOwnProperty(destino)) {
      saldos[destino] += monto;
    }

    if (origen && saldos.hasOwnProperty(origen)) {
      saldos[origen] -= monto;
    }
  }

  return saldos;
}

// Obtiene el saldo dinamico de una cuenta especifica.
export function calcularSaldoCuenta(
  cuentaId: string,
  transacciones: Transaccion[]
): number {
  return transacciones.reduce((acc, txn) => {
    if ((txn.estado ?? "").toLowerCase() === "pendiente") return acc;
    return acc + transactionImpactForAccount(txn, cuentaId);
  }, 0);
}

// Suma de saldos (por ejemplo, para total general).
export function calcularSaldoTotal(saldos: Record<string, number>): number {
  return Object.values(saldos).reduce((acc, value) => acc + normalizeAmount(value), 0);
}
