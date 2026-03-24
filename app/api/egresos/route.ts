import { NextResponse } from "next/server";
import { createAirtableRecords, fetchAirtableRecords } from "@/lib/airtable";
import { safeNumber } from "@/lib/helpers";
import { calcularSaldoCuenta } from "@/lib/calculations";
import { Transaccion } from "@/types/transaccion";

const TIPO_TRANSACCION_VALOR = "Egreso";

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
    tipoTransaccion: String(fields["Tipo de Transacci\u00f3n"] ?? ""),
    concepto: String(fields["Concepto"] ?? ""),
    estado: String(fields["Estado"] ?? ""),
    cuentaOrigenId: pickLinkedId(fields["Cuenta Origen"]),
    cuentaDestinoId: pickLinkedId(fields["Cuenta Destino"]),
    cuentaOrigen: null,
    cuentaDestino: null,
    metodoPago: (fields["M\u00e9todo de Pago"] as string | undefined) ?? undefined,
    montoTotal: pickNumber(fields["Monto Total"], 0),
    capital: pickNumber(fields["Capital"], 0),
    utilidad: pickNumber(fields["Utilidad"], 0),
    iva: pickNumber(fields["IVA"], 0),
    repuestoProveedorExterno: pickNumber(fields["Repuesto Proveedor Externo"], 0),
    llevaFactura: Boolean(fields["Lleva Factura"]),
    descripcionObservaciones: (fields["Descripci\u00f3n / Observaciones"] as string | undefined) ?? undefined,
    referenciaExterna: (fields["Referencia Externa"] as string | undefined) ?? undefined,
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
      metodoPago?: string;
      monto?: number;
      observaciones?: string;
      referenciaExterna?: string;
    };

    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
    if (!tableTx) throw new Error("Variable faltante: AIRTABLE_TABLE_TRANSACCIONES");
    if (!tableCuentas) throw new Error("Variable faltante: AIRTABLE_TABLE_CUENTAS");

    const fecha = normalizeDate(payload.fecha);
    const concepto = payload.concepto?.trim() || "Egreso";
    const cuentaOrigenId = payload.cuentaOrigenId ?? "";
    const metodoPago = payload.metodoPago?.trim() || "";
    const monto = safeNumber(payload.monto, 0);
    const observaciones = payload.observaciones ?? "";
    const referenciaExterna = payload.referenciaExterna ?? "";

    if (!cuentaOrigenId) {
      return NextResponse.json({ success: false, error: "Cuenta origen requerida" }, { status: 400 });
    }

    if (monto <= 0) {
      return NextResponse.json({ success: false, error: "El monto debe ser mayor a 0" }, { status: 400 });
    }

    const cuentas = await fetchAirtableRecords<Record<string, unknown>>(tableCuentas);
    const cuenta = cuentas.find((c) => c.id === cuentaOrigenId);
    if (!cuenta) {
      return NextResponse.json({ success: false, error: "Cuenta origen no encontrada" }, { status: 404 });
    }

    const permiteEgresos = Boolean((cuenta.fields as Record<string, unknown>)?.["Permite Egresos"]);
    if (!permiteEgresos) {
      return NextResponse.json(
        { success: false, error: "La cuenta seleccionada no permite egresos" },
        { status: 400 }
      );
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
      Fecha: fecha,
      "Tipo de Transacci\u00f3n": TIPO_TRANSACCION_VALOR,
      Concepto: concepto,
      Estado: "Procesada",
      "Cuenta Origen": [cuentaOrigenId],
      "M\u00e9todo de Pago": metodoPago,
      "Monto Total": monto,
      Capital: monto,
      Utilidad: 0,
      IVA: 0,
      "Repuesto Proveedor Externo": 0,
      "Lleva Factura": false,
      "Referencia Externa": referenciaExterna,
      "Descripci\u00f3n / Observaciones": observaciones,
    };

    const [txRecord] = await createAirtableRecords(tableTx, [txFields]);

    return NextResponse.json({ success: true, data: { transaccionId: txRecord?.id ?? null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
