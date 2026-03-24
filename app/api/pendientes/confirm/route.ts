import { NextResponse } from "next/server";
import { createAirtableRecords, fetchAirtableRecords, updateAirtableRecord } from "@/lib/airtable";
import { safeNumber } from "@/lib/helpers";

const TIPO_TRANSACCION_VALOR = "Ingreso";

function pickLinkedId(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as string | undefined) ?? null;
  return (value as string | undefined) ?? null;
}

function pickString(value: unknown): string {
  return value == null ? "" : String(value);
}

function normalizeDate(value?: string) {
  return value && value.length ? value : new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      fechaRealAcreditacion?: string;
      comisionReal?: number;
      montoRealAcreditado?: number;
      observaciones?: string;
    };

    const tablePendientes = process.env.AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES;
    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
    if (!tablePendientes) throw new Error("Variable faltante: AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES");
    if (!tableTx) throw new Error("Variable faltante: AIRTABLE_TABLE_TRANSACCIONES");
    if (!tableCuentas) throw new Error("Variable faltante: AIRTABLE_TABLE_CUENTAS");

    const id = body.id ?? "";
    if (!id) {
      return NextResponse.json({ success: false, error: "ID de movimiento requerido" }, { status: 400 });
    }

    const fechaReal = normalizeDate(body.fechaRealAcreditacion);
    const comisionReal = safeNumber(body.comisionReal, 0);
    const montoIngresado = safeNumber(body.montoRealAcreditado, NaN);
    const obs = body.observaciones ?? "";

    // obtener movimiento
    const records = await fetchAirtableRecords<Record<string, unknown>>(tablePendientes);
    const record = records.find((r) => r.id === id);
    if (!record) {
      return NextResponse.json({ success: false, error: "Movimiento no encontrado" }, { status: 404 });
    }

    const f = record.fields ?? {};
    const medio = pickString(f["Medio"] ?? f["M\u00e9todo de Pago"] ?? "");
    const cuentaDestinoId = pickLinkedId(f["Cuenta Destino Final"]);
    const transRelacionada = pickLinkedId(f["Transacci\u00f3n Relacionada"]);
    const montoEsperado = safeNumber(f["Monto Esperado"], 0);

    if (!cuentaDestinoId) {
      return NextResponse.json(
        { success: false, error: "El movimiento no tiene Cuenta Destino Final definida" },
        { status: 400 }
      );
    }

    const montoCalculado = Number.isFinite(montoIngresado) && montoIngresado > 0
      ? montoIngresado
      : Math.max(montoEsperado - comisionReal, 0);

    if (montoCalculado <= 0) {
      return NextResponse.json(
        { success: false, error: "Monto real acreditado debe ser mayor a 0" },
        { status: 400 }
      );
    }

    // actualizar movimiento pendiente
    await updateAirtableRecord(tablePendientes, id, {
      Estado: "Acreditado",
      "Fecha Real de Acreditaci\u00f3n": fechaReal,
      "Comisi\u00f3n Real": comisionReal,
      "Monto Real Acreditado": montoCalculado,
      Observaciones: obs,
    });

    // mapear cuentas
    const cuentas = await fetchAirtableRecords<Record<string, unknown>>(tableCuentas);
    const cuentaExiste = cuentas.some((c) => c.id === cuentaDestinoId);
    const cuentaLink = cuentaExiste ? [cuentaDestinoId] : undefined;

    const txFields: Record<string, unknown> = {
      Fecha: fechaReal,
      "Tipo de Transacci\u00f3n": TIPO_TRANSACCION_VALOR,
      Concepto: `Acreditaci\u00f3n ${medio}`,
      Estado: "Procesada",
      "Cuenta Destino": cuentaLink,
      "M\u00e9todo de Pago": medio,
      "Monto Total": montoCalculado,
      Capital: montoCalculado,
      Utilidad: 0,
      IVA: 0,
      "Repuesto Proveedor Externo": 0,
      "Lleva Factura": false,
      "Referencia Externa": transRelacionada ?? id,
      "Descripci\u00f3n / Observaciones": obs,
    };

    const [txRecord] = await createAirtableRecords(tableTx, [txFields]);

    return NextResponse.json({ success: true, data: { transaccionId: txRecord?.id ?? null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
