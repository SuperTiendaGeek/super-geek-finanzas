import { NextResponse } from "next/server";

import {

  createAirtableRecords,

  fetchAirtableRecordById,

  fetchAirtableRecords,

  updateAirtableRecord,

} from "@/lib/airtable";

import { safeNumber } from "@/lib/helpers";



function pickLinkedId(value: unknown): string | null {

  if (Array.isArray(value)) return (value[0] as string | undefined) ?? null;

  return (value as string | undefined) ?? null;

}



function pickString(value: unknown): string {

  return value == null ? "" : String(value);

}





function pickNumber(value: unknown, fallback = NaN): number {

  const num = Number(value);

  return Number.isFinite(num) ? num : fallback;

}



function computeRubros(

  fields: Record<string, unknown>,

  txFields: Record<string, unknown>

) {

  const capitalTx = safeNumber(txFields["Capital"], 0);

  const utilidadTx = safeNumber(txFields["Utilidad"], 0);

  const ivaTx = safeNumber(txFields["IVA"], 0);

  const repuestoTx = safeNumber(txFields["Repuesto Proveedor Externo"], 0);

  const montoRef = safeNumber(txFields["Monto Total"], capitalTx + utilidadTx + ivaTx + repuestoTx);



    const capitalCampo = pickNumber("Capital Asignado" in fields ? fields["Capital Asignado"] : fields["Capital"], NaN);

    const utilidadCampo = pickNumber("Utilidad Asignada" in fields ? fields["Utilidad Asignada"] : fields["Utilidad"], NaN);

    const ivaCampo = pickNumber("IVA Asignado" in fields ? fields["IVA Asignado"] : fields["IVA"], NaN);

    const repuestoCampo = pickNumber("Repuesto Externo Asignado" in fields ? fields["Repuesto Externo Asignado"] : fields["Repuesto Proveedor Externo"], NaN);

  const montoEsperado = pickNumber(fields["Monto Esperado"], montoRef);

  const ratio = montoRef > 0 ? round2(montoEsperado / montoRef) : null;



  const capital = Number.isFinite(capitalCampo)

    ? capitalCampo

    : ratio !== null

      ? round2(capitalTx * ratio)

      : capitalTx;



  const utilidad = Number.isFinite(utilidadCampo)

    ? utilidadCampo

    : ratio !== null

      ? round2(utilidadTx * ratio)

      : utilidadTx;



  const iva = Number.isFinite(ivaCampo)

    ? ivaCampo

    : ratio !== null

      ? round2(ivaTx * ratio)

      : ivaTx;



  const repuestoExterno = Number.isFinite(repuestoCampo)

    ? repuestoCampo

    : ratio !== null

      ? round2(repuestoTx * ratio)

      : repuestoTx;



  return { capital, utilidad, iva, repuestoExterno, montoEsperado };

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

    const medio = pickString(f["Medio"] ?? f["M\u00e9todo de Pago"] ?? "");

    const cuentaDestinoId = pickLinkedId(f["Cuenta Destino Final"]);

    const transRelacionadaId = pickLinkedId(f["Transacci\u00f3n Relacionada"]);

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



    const rubrosAsignados = computeRubros(f, txFields);

    const capitalAsignado = round2(rubrosAsignados.capital);

    const utilidadAsignada = round2(rubrosAsignados.utilidad);

    const ivaAsignada = round2(rubrosAsignados.iva);

    const repuestoAsignado = round2(rubrosAsignados.repuestoExterno);

    const montoEsperado = round2((rubrosAsignados.montoEsperado ?? montoEsperadoCampo));



    if (comisionReal > utilidadAsignada) {

      return NextResponse.json(

        { success: false, error: "La comisi\u00f3n real no puede ser mayor a la utilidad original." },

        { status: 400 }

      );

    }



    const utilidadNeta = round2(Math.max(0, utilidadAsignada - comisionReal));

    const montoAcreditadoFinal = round2(capitalAsignado + utilidadNeta + ivaAsignada + repuestoAsignado);



    if (montoAcreditadoFinal <= 0 || !Number.isFinite(montoAcreditadoFinal)) {

      return NextResponse.json(

        { success: false, error: "Monto real acreditado debe ser mayor a 0" },

        { status: 400 }

      );

    }



    await updateAirtableRecord(tablePendientes, id, {

      Estado: "Acreditado",

      "Fecha Real de Acreditaci\u00f3n": fechaReal,

      "Comisi\u00f3n Real": comisionReal,

      "Monto Real Acreditado": montoAcreditadoFinal,

      Observaciones: obs,

      "Monto Esperado": montoEsperado,

      "Capital Asignado": capitalAsignado,

      "Utilidad Asignada": utilidadAsignada,

      "IVA Asignado": ivaAsignada,

      "Repuesto Externo Asignado": repuestoAsignado,

    });



    let estadoTxActualizado = "Procesada";

    if (transRelacionadaId) {

      const pendientesRelacionados = pendientes.filter((p) => {

        if (p.id === id) return false;

        const pf = (p.fields as Record<string, unknown> | undefined) ?? {};

        const relacion = pickLinkedId(pf["Transacci\u00f3n Relacionada"]);

        const estadoRel = pickString(pf["Estado"] ?? "").toLowerCase();

        return relacion === transRelacionadaId && estadoRel === "pendiente";

      });

      estadoTxActualizado = pendientesRelacionados.length ? "Pendiente" : "Procesada";



      await updateAirtableRecord(tableTx, transRelacionadaId, {

        Estado: estadoTxActualizado,

        Capital: capitalAsignado,

        Utilidad: utilidadNeta,

        IVA: ivaAsignada,

        "Repuesto Proveedor Externo": repuestoAsignado,

        Comisi\u00f3n: comisionReal,

      });

    }

    const cuentas = await fetchAirtableRecords<Record<string, unknown>>(tableCuentas);

    const cuentaExiste = cuentas.some((c) => c.id === cuentaDestinoId);

    const cuentaLink = cuentaExiste ? [cuentaDestinoId] : undefined;



    

    const txFieldsConfirmacion: Record<string, unknown> = {

      Fecha: fechaReal,

      "Tipo de Transacci\u00f3n": "Ingreso",

      "Tipo de Flujo": "Acreditaci\u00f3n pendiente",

      Concepto: (pickString(txFields["M\u00e9todo de Pago"] ?? "").toLowerCase().includes("mixto")

        ? `Componente pago mixto - ${medio}`

        : `Acreditaci\u00f3n ${medio}`),

      Estado: "Confirmado",

      "Cuenta Destino": cuentaLink,

      "M\u00e9todo de Pago": medio,

      "Monto Total": montoAcreditadoFinal,

      Comisi\u00f3n: comisionReal,

      Capital: capitalAsignado,

      Utilidad: utilidadNeta,

      IVA: ivaAsignada,

      "Repuesto Proveedor Externo": repuestoAsignado,

      "Lleva Factura": Boolean(txFields["Lleva Factura"]),

      "Referencia Externa": transRelacionadaId ?? id,

      "Descripci\u00f3n / Observaciones": obs,

    };



    const [txRecord] = await createAirtableRecords(tableTx, [txFieldsConfirmacion]);



    return NextResponse.json({ success: true, data: { transaccionId: txRecord?.id ?? null } });

  } catch (error) {

    const message = error instanceof Error ? error.message : "Error desconocido";

    return NextResponse.json({ success: false, error: message }, { status: 500 });

  }

}

