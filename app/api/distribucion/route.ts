import { NextResponse } from "next/server";
import { createAirtableRecords } from "@/lib/airtable";
import { roundMoney } from "@/lib/helpers";
import { calcularSaldoCuenta } from "@/lib/calculations";
import { getCuentas } from "@/services/cuentas";
import { getTransacciones } from "@/services/transacciones";
import { calcularDistribucionContable } from "@/services/distribucion";

const FIELD_TIPO_TRANSACCION = "Tipo de Transacción";
const FIELD_TIPO_FLUJO = "Tipo de Flujo";
const FIELD_CUENTA_ORIGEN = "Cuenta Origen";
const FIELD_CUENTA_DESTINO = "Cuenta Destino";
const FIELD_MONTO_TOTAL = "Monto Total";
const FIELD_CONCEPTO = "Concepto";
const FIELD_ESTADO = "Estado";
const FIELD_FECHA = "Fecha";
const FIELD_ES_DISTRIBUCION = "Es Distribución Contable";
const FIELD_COMPONENTE = "Componente Distribuido";
const FIELD_MONTO_DISTRIBUIDO = "Monto Distribuido";

const COMPONENTES: Record<string, { destino: string; label: string }> = {
  capital: { destino: "SGCAPITAL", label: "Capital" },
  utilidad: { destino: "SGUTILIDAD", label: "Utilidad" },
  iva: { destino: "SGIVA", label: "IVA" },
};

const ORIGEN_NOMBRE = "SGINGRESOS";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { componente?: string; monto?: number };
    const key = String(body.componente ?? "").toLowerCase();
    const config = COMPONENTES[key];
    const monto = roundMoney(Number(body.monto ?? 0));

    if (!config) {
      return NextResponse.json({ success: false, error: "Componente inválido" }, { status: 400 });
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ success: false, error: "Monto inválido" }, { status: 400 });
    }

    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    if (!tableTx) throw new Error("Variable faltante: AIRTABLE_TABLE_TRANSACCIONES");

    const cuentas = await getCuentas();
    const cuentaOrigen = cuentas.find((c) => c.nombre.toUpperCase() === ORIGEN_NOMBRE);
    const cuentaDestino = cuentas.find((c) => c.nombre.toUpperCase() === config.destino);

    if (!cuentaOrigen || !cuentaDestino) {
      return NextResponse.json({ success: false, error: "No se encontraron las cuentas de distribución" }, { status: 400 });
    }

    const transacciones = await getTransacciones();
    const distribucion = calcularDistribucionContable(transacciones);
    const pendiente = roundMoney(distribucion[key as "capital" | "utilidad" | "iva"].pendiente);

    if (roundMoney(monto - pendiente) > 0) {
      return NextResponse.json({ success: false, error: "No puedes distribuir más de lo pendiente" }, { status: 400 });
    }

    const saldoIngresos = roundMoney(calcularSaldoCuenta(cuentaOrigen.id, transacciones));
    if (roundMoney(monto - saldoIngresos) > 0) {
      return NextResponse.json(
        { success: false, error: "Saldo insuficiente en SGINGRESOS", saldoIngresos },
        { status: 400 }
      );
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const concepto = `Distribución contable de ${config.label}`;

    const txFields: Record<string, unknown> = {
      [FIELD_FECHA]: hoy,
      [FIELD_TIPO_TRANSACCION]: "Movimiento",
      [FIELD_TIPO_FLUJO]: "Transferencia interna",
      [FIELD_CUENTA_ORIGEN]: [cuentaOrigen.id],
      [FIELD_CUENTA_DESTINO]: [cuentaDestino.id],
      [FIELD_MONTO_TOTAL]: monto,
      [FIELD_CONCEPTO]: concepto,
      [FIELD_ESTADO]: "Confirmado",
      [FIELD_ES_DISTRIBUCION]: true,
      [FIELD_COMPONENTE]: config.label,
      [FIELD_MONTO_DISTRIBUIDO]: monto,
    };

    const [record] = await createAirtableRecords(tableTx, [txFields]);

    return NextResponse.json({ success: true, data: { id: record?.id ?? null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
