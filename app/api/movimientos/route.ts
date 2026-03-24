import { NextResponse } from "next/server";
import { createAirtableRecords, fetchAirtableRecords } from "@/lib/airtable";
import { safeNumber } from "@/lib/helpers";
import { calcularSaldoCuenta } from "@/lib/calculations";
import { Transaccion } from "@/types/transaccion";

const TIPO_TRANSACCION = "Movimiento";
const TIPO_FLUJO = "Transferencia interna";
const CONCEPTO = "Transferencia entre Cuentas";
const FIELD_TIPO_TRANSACCION = "Tipo de Transacción";
const FIELD_TIPO_FLUJO = "Tipo de Flujo";
const FIELD_CUENTA_ORIGEN = "Cuenta Origen";
const FIELD_CUENTA_DESTINO = "Cuenta Destino";
const FIELD_METODO_PAGO = "Método de Pago";
const FIELD_MONTO_TOTAL = "Monto Total";
const FIELD_CONCEPTO = "Concepto";
const FIELD_DESCRIPCION = "Descripción / Observaciones";
const FIELD_ESTADO = "Estado";
const FIELD_FECHA = "Fecha";
const FIELD_REFERENCIA = "Referencia Externa";

function pickLinkedId(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as string | undefined) ?? null;
  if (typeof value === "string" && value.trim().length) return value;
  return null;
}

function pickNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function mapRecordToTransaccion(record: { id?: string | null; fields?: Record<string, unknown> }): Transaccion | null {
  if (!record?.id) return null;
  const fields = (record.fields as Record<string, unknown>) ?? {};

  return {
    id: String(record.id),
    fecha: String(fields["Fecha"] ?? ""),
    tipoTransaccion: String(fields[FIELD_TIPO_TRANSACCION] ?? ""),
    concepto: String(fields[FIELD_CONCEPTO] ?? ""),
    estado: String(fields[FIELD_ESTADO] ?? ""),
    cuentaOrigenId: pickLinkedId(fields[FIELD_CUENTA_ORIGEN]),
    cuentaDestinoId: pickLinkedId(fields[FIELD_CUENTA_DESTINO]),
    cuentaOrigen: null,
    cuentaDestino: null,
    metodoPago: (fields[FIELD_METODO_PAGO] as string | undefined) ?? undefined,
    montoTotal: pickNumber(fields[FIELD_MONTO_TOTAL], 0),
    capital: pickNumber(fields["Capital"], 0),
    utilidad: pickNumber(fields["Utilidad"], 0),
    iva: pickNumber(fields["IVA"], 0),
    repuestoProveedorExterno: pickNumber(fields["Repuesto Proveedor Externo"], 0),
    llevaFactura: Boolean(fields["Lleva Factura"]),
    descripcionObservaciones: (fields[FIELD_DESCRIPCION] as string | undefined) ?? undefined,
    referenciaExterna: (fields[FIELD_REFERENCIA] as string | undefined) ?? undefined,
  };
}

function normalizeDate(value?: string) {
  return value && value.length ? value : new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      fecha?: string;
      concepto?: string;
      cuentaOrigenId?: string;
      cuentaDestinoId?: string;
      monto?: number;
      observaciones?: string;
    };

    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
    if (!tableTx) throw new Error("Variable faltante: AIRTABLE_TABLE_TRANSACCIONES");
    if (!tableCuentas) throw new Error("Variable faltante: AIRTABLE_TABLE_CUENTAS");

    const fecha = normalizeDate(payload.fecha);
    const concepto = payload.concepto?.trim() || CONCEPTO;
    const cuentaOrigenId = payload.cuentaOrigenId ?? "";
    const cuentaDestinoId = payload.cuentaDestinoId ?? "";
    const monto = safeNumber(payload.monto, 0);
    const observaciones = payload.observaciones ?? "";

    if (!cuentaOrigenId || !cuentaDestinoId) {
      return NextResponse.json({ success: false, error: "Cuenta origen y destino son obligatorias" }, { status: 400 });
    }

    if (cuentaOrigenId === cuentaDestinoId) {
      return NextResponse.json({ success: false, error: "La cuenta origen y destino deben ser distintas" }, { status: 400 });
    }

    if (monto <= 0) {
      return NextResponse.json({ success: false, error: "El monto debe ser mayor a 0" }, { status: 400 });
    }

    const cuentas = await fetchAirtableRecords<Record<string, unknown>>(tableCuentas);
    const cuentaOrigen = cuentas.find((c) => c.id === cuentaOrigenId);
    const cuentaDestino = cuentas.find((c) => c.id === cuentaDestinoId);
    const nombreOrigen = (cuentaOrigen?.fields as Record<string, unknown> | undefined)?.["Nombre"] as string | undefined;
    const nombreDestino = (cuentaDestino?.fields as Record<string, unknown> | undefined)?.["Nombre"] as string | undefined;

    if (!cuentaOrigen || !cuentaDestino || !nombreOrigen || !nombreDestino) {
      return NextResponse.json({ success: false, error: "Cuenta origen o destino no encontrada" }, { status: 404 });
    }

    const origenActiva = Boolean((cuentaOrigen.fields as Record<string, unknown> | undefined)?.["Activa"]);
    const destinoActiva = Boolean((cuentaDestino.fields as Record<string, unknown> | undefined)?.["Activa"]);
    const origenPermite = Boolean((cuentaOrigen.fields as Record<string, unknown> | undefined)?.["Permite Transferencias"]);
    const destinoPermite = Boolean((cuentaDestino.fields as Record<string, unknown> | undefined)?.["Permite Transferencias"]);

    if (!origenActiva || !destinoActiva) {
      return NextResponse.json({ success: false, error: "Ambas cuentas deben estar activas" }, { status: 400 });
    }

    if (!origenPermite || !destinoPermite) {
      return NextResponse.json({ success: false, error: "Las cuentas seleccionadas no permiten transferencias" }, { status: 400 });
    }

    const transaccionesRecords = await fetchAirtableRecords<Record<string, unknown>>(tableTx);
    const transacciones = transaccionesRecords
      .map((record) => mapRecordToTransaccion(record))
      .filter((tx): tx is Transaccion => Boolean(tx?.id));

    const saldoDisponible = calcularSaldoCuenta(cuentaOrigenId, transacciones);
    if (monto > saldoDisponible) {
      return NextResponse.json(
        { success: false, error: "Saldo insuficiente en la cuenta origen", saldoDisponible },
        { status: 400 }
      );
    }

    const txFields: Record<string, unknown> = {
      [FIELD_FECHA]: fecha,
      [FIELD_TIPO_TRANSACCION]: TIPO_TRANSACCION,
      [FIELD_TIPO_FLUJO]: TIPO_FLUJO,
      [FIELD_CUENTA_ORIGEN]: [cuentaOrigenId],
      [FIELD_CUENTA_DESTINO]: [cuentaDestinoId],
      [FIELD_MONTO_TOTAL]: monto,
      [FIELD_CONCEPTO]: concepto || CONCEPTO,
      [FIELD_ESTADO]: "Confirmado",
    };

    if (observaciones) {
      txFields[FIELD_DESCRIPCION] = observaciones;
    }

    const [txRecord] = await createAirtableRecords(tableTx, [txFields]);

    return NextResponse.json({ success: true, data: { transaccionId: txRecord?.id ?? null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
