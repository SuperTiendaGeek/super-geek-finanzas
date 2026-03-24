import { Transaccion } from "@/types/transaccion";

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

function esValida(tx: Transaccion): boolean {
  const estado = normalize(tx.estado);
  if (!estado) return true;
  if (estado.includes("anul") || estado.includes("cancel")) return false;
  if (estado.includes("pend")) return false;
  return true;
}

function esIngreso(tx: Transaccion): boolean {
  return normalize(tx.tipoTransaccion).includes("ingreso");
}

function sumDistribuido(transacciones: Transaccion[], componente: string) {
  const key = normalize(componente);
  return transacciones
    .filter((t) => t.esDistribucionContable)
    .filter((t) => normalize(t.componenteDistribuido) === key)
    .reduce((acc, t) => acc + (t.montoDistribuido ?? 0), 0);
}

export function calcularDistribucionContable(transacciones: Transaccion[]): DistribucionContable {
  const validas = transacciones.filter(esValida);
  const ingresos = validas.filter(esIngreso);
  const distribuciones = validas.filter((t) => t.esDistribucionContable);

  const capitalGenerado = ingresos.reduce((acc, t) => acc + (t.capital ?? 0), 0);
  const utilidadGenerada = ingresos.reduce((acc, t) => acc + (t.utilidad ?? 0), 0);
  const ivaGenerado = ingresos.reduce((acc, t) => acc + (t.iva ?? 0), 0);

  const capitalDistribuido = sumDistribuido(distribuciones, "capital");
  const utilidadDistribuida = sumDistribuido(distribuciones, "utilidad");
  const ivaDistribuido = sumDistribuido(distribuciones, "iva");

  return {
    capital: {
      generado: capitalGenerado,
      distribuido: capitalDistribuido,
      pendiente: capitalGenerado - capitalDistribuido,
    },
    utilidad: {
      generado: utilidadGenerada,
      distribuido: utilidadDistribuida,
      pendiente: utilidadGenerada - utilidadDistribuida,
    },
    iva: {
      generado: ivaGenerado,
      distribuido: ivaDistribuido,
      pendiente: ivaGenerado - ivaDistribuido,
    },
  };
}
