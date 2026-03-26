import { NextResponse } from "next/server";
import {
  createAirtableRecords,
  fetchAirtableRecordById,
  fetchAirtableRecords,
  updateAirtableRecord,
} from "@/lib/airtable";
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

function round2(value: number) {
  return Math.round(value * 100) / 100;
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
    const comisionReal = Math.max(0, safeNumber(body.comisionReal, 0));
    const obs = body.observaciones ?? "";

    const pendientes = await fetchAirtableRecords<Record<string, unknown>>(tablePendientes);
    const record = pendientes.find((r) => r.id === id);
    if (!record) {
      return NextResponse.json({ success: false, error: "Movimiento no encontrado" }, { status: 404 });
    }

    const f = record.fields ?? {};
    const medio = pickString(f["Medio"] ?? f["Método de Pago"] ?? "");
    const cuentaDestinoId = pickLinkedId(f["Cuenta Destino Final"]);
    const transRelacionadaId = pickLinkedId(f["Transacción Relacionada"]);
    const montoEsperadoCampo = safeNumber(f["Monto Esperado"], 0);

    if (!cuentaDestinoId) {
      return NextResponse.json(
        { success: false, error: "El movimiento no tiene Cuenta Destino Final definida" },
        { status: 400 }
      );
    }

    const txRelacionada = transRelacionadaId
      ? await fetchAirtableRecordById<Record<string, unknown>>(tableTx, transRelacionadaId)
      : null;
    const txFields = txRelacionada?.fields ?? {};

    const capitalOriginal = round2(safeNumber(f["Capital"], safeNumber(txFields["Capital"], 0)));
    const utilidadOriginal = round2(safeNumber(f["Utilidad"], safeNumber(txFields["Utilidad"], 0)));
    const ivaOriginal = round2(safeNumber(f["IVA"], safeNumber(txFields["IVA"], 0)));
    const montoReferencia = safeNumber(txFields["Monto Total"], 0);
    const montoEsperado = round2(montoEsperadoCampo || montoReferencia || capitalOriginal + utilidadOriginal + ivaOriginal);

    if (comisionReal > utilidadOriginal) {
      return NextResponse.json(
        { success: false, error: "La comisión real no puede ser mayor a la utilidad original." },
        { status: 400 }
      );
    }

    const utilidadNeta = round2(utilidadOriginal - comisionReal);
    const montoAcreditadoFinal = round2(capitalOriginal + utilidadNeta + ivaOriginal);

    if (montoAcreditadoFinal <= 0 || !Number.isFinite(montoAcreditadoFinal)) {
      return NextResponse.json(
        { success: false, error: "Monto real acreditado debe ser mayor a 0" },
        { status: 400 }
      );
    }

    await updateAirtableRecord(tablePendientes, id, {
      Estado: "Acreditado",
      "Fecha Real de Acreditación": fechaReal,
      "Comisión Real": comisionReal,
      "Monto Real Acreditado": montoAcreditadoFinal,
      Observaciones: obs,
      "Monto Esperado": montoEsperado,
    });

    const cuentas = await fetchAirtableRecords<Record<string, unknown>>(tableCuentas);
    const cuentaExiste = cuentas.some((c) => c.id === cuentaDestinoId);
    const cuentaLink = cuentaExiste ? [cuentaDestinoId] : undefined;

    const txFieldsConfirmacion: Record<string, unknown> = {
      Fecha: fechaReal,
      "Tipo de Transacción": TIPO_TRANSACCION_VALOR,
      Concepto: `Acreditación ${medio}`,
      Estado: "Procesada",
      "Cuenta Destino": cuentaLink,
      "Método de Pago": medio,
      "Monto Total": montoAcreditadoFinal,
      Capital: capitalOriginal,
      Utilidad: utilidadNeta,
      IVA: ivaOriginal,
      Comisión: comisionReal,
      "Repuesto Proveedor Externo": 0,
      "Lleva Factura": false,
      "Referencia Externa": transRelacionadaId ?? id,
      "Descripción / Observaciones": obs,
    };

    const [txRecord] = await createAirtableRecords(tableTx, [txFieldsConfirmacion]);

    return NextResponse.json({ success: true, data: { transaccionId: txRecord?.id ?? null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}



