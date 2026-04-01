import { Transaccion } from "@/types/transaccion";
import { roundMoney } from "@/lib/helpers";

export type ResumenComponente = {
  generado: number;
  distribuido: number;
  pendiente: number;
};

export type DistribucionContable = {
  capital: ResumenComponente;
  utilidad: ResumenComponente;
  iva: ResumenComponente;
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

const PENDING_METHODS = new Set(["datafast", "payphone", "paypal", "mixto"]);

function esValida(tx: Transaccion): boolean {
  const estado = normalize(tx.estado);
  const metodo = normalize(tx.metodoPago);
  const tipoFlujo = normalize(tx.tipoFlujo);

  if (!estado) return true;
  if (estado.includes("anul") || estado.includes("cancel")) return false;
  if (estado.includes("pend")) return false; // excluye pendientes

  // No contamos el resumen mixto ni medios pendientes hasta acreditaci?n
  if (metodo === "mixto") return false;
  if (PENDING_METHODS.has(metodo) && !tipoFlujo.includes("acredit")) return false;

  return true;
}

function esIngreso(tx: Transaccion): boolean {
  return normalize(tx.tipoTransaccion).includes("ingreso");
}

function esDistribucion(tx: Transaccion): boolean {
  return Boolean(tx.esDistribucionContable);
}

function sumDistribuido(transacciones: Transaccion[], componente: string) {
  const key = normalize(componente);
  const total = transacciones
    .filter(esDistribucion)
    .filter((t) => normalize(t.componenteDistribuido) === key)
    .reduce((acc, t) => acc + (t.montoDistribuido ?? 0), 0);
  return roundMoney(total);
}

export function calcularDistribucionContable(transacciones: Transaccion[]): DistribucionContable {
  const validas = transacciones.filter(esValida);
  const ingresos = validas.filter((t) => esIngreso(t) && !esDistribucion(t));
  const distribuciones = validas.filter(esDistribucion);

  const capitalGenerado = roundMoney(ingresos.reduce((acc, t) => acc + (t.capital ?? 0), 0));
  const utilidadGenerada = roundMoney(ingresos.reduce((acc, t) => acc + (t.utilidad ?? 0), 0));
  const ivaGenerado = roundMoney(ingresos.reduce((acc, t) => acc + (t.iva ?? 0), 0));

  const capitalDistribuido = sumDistribuido(distribuciones, "capital");
  const utilidadDistribuida = sumDistribuido(distribuciones, "utilidad");
  const ivaDistribuido = sumDistribuido(distribuciones, "iva");

  return {
    capital: {
      generado: capitalGenerado,
      distribuido: capitalDistribuido,
      pendiente: roundMoney(capitalGenerado - capitalDistribuido),
    },
    utilidad: {
      generado: utilidadGenerada,
      distribuido: utilidadDistribuida,
      pendiente: roundMoney(utilidadGenerada - utilidadDistribuida),
    },
    iva: {
      generado: ivaGenerado,
      distribuido: ivaDistribuido,
      pendiente: roundMoney(ivaGenerado - ivaDistribuido),
    },
  };
}
