import { NextResponse } from "next/server";

import { fetchAirtableRecords } from "@/lib/airtable";

import { Pendiente } from "@/types/pendiente";

import { safeNumber } from "@/lib/helpers";



function pickLinkedId(value: unknown): string | null {

  if (Array.isArray(value)) return (value[0] as string | undefined) ?? null;

  return (value as string | undefined) ?? null;

}



function pickNumber(value: unknown, fallback = 0): number {

  const num = Number(value);

  return Number.isFinite(num) ? num : fallback;

}



function pickString(value: unknown): string {

  return value == null ? "" : String(value);

}





function round2(value: number) {

  return Math.round(value * 100) / 100;

}



function computeRubros(

  fields: Record<string, unknown>,

  relacionada?: { capital: number; utilidad: number; iva: number; montoTotal: number; repuestoExterno: number }

) {

    const capitalCampo = pickNumber("Capital Asignado" in fields ? fields["Capital Asignado"] : fields["Capital"], NaN);

    const utilidadCampo = pickNumber("Utilidad Asignada" in fields ? fields["Utilidad Asignada"] : fields["Utilidad"], NaN);

    const ivaCampo = pickNumber("IVA Asignado" in fields ? fields["IVA Asignado"] : fields["IVA"], NaN);

    const repuestoCampo = pickNumber("Repuesto Externo Asignado" in fields ? fields["Repuesto Externo Asignado"] : fields["Repuesto Proveedor Externo"], NaN);

  const montoEsperado = pickNumber(fields["Monto Esperado"], relacionada?.montoTotal ?? 0);

  const ratio = relacionada && relacionada.montoTotal > 0 ? round2(montoEsperado / relacionada.montoTotal) : null;



  const capital = Number.isFinite(capitalCampo)

    ? capitalCampo

    : ratio !== null

      ? round2((relacionada?.capital ?? 0) * ratio)

      : relacionada?.capital ?? 0;



  const utilidad = Number.isFinite(utilidadCampo)

    ? utilidadCampo

    : ratio !== null

      ? round2((relacionada?.utilidad ?? 0) * ratio)

      : relacionada?.utilidad ?? 0;



  const iva = Number.isFinite(ivaCampo)

    ? ivaCampo

    : ratio !== null

      ? round2((relacionada?.iva ?? 0) * ratio)

      : relacionada?.iva ?? 0;



  const repuestoExterno = Number.isFinite(repuestoCampo)

    ? repuestoCampo

    : ratio !== null

      ? round2((relacionada?.repuestoExterno ?? 0) * ratio)

      : relacionada?.repuestoExterno ?? 0;



  return { capital, utilidad, iva, repuestoExterno, montoEsperado };

}



export async function GET() {

  try {

    const table = process.env.AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES;

    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;

    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;

    if (!table) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES");

    if (!tableCuentas) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_CUENTAS");

    if (!tableTx) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_TRANSACCIONES");



    const [records, cuentas, transacciones] = await Promise.all([

      fetchAirtableRecords<Record<string, unknown>>(table),

      fetchAirtableRecords<Record<string, unknown>>(tableCuentas),

      fetchAirtableRecords<Record<string, unknown>>(tableTx),

    ]);



    const cuentasMap: Record<string, string> = cuentas.reduce((acc, r) => {

      const nombre = pickString(r.fields?.["Nombre"]);

      if (r.id && nombre) acc[r.id] = nombre;

      return acc;

    }, {} as Record<string, string>);



    const transaccionesMap: Record<string, { capital: number; utilidad: number; iva: number; montoTotal: number; repuestoExterno: number }>

      = transacciones.reduce((acc, r) => {

        const f = r.fields ?? {};

        acc[r.id] = {

          capital: pickNumber(f["Capital"], 0),

          utilidad: pickNumber(f["Utilidad"], 0),

          iva: pickNumber(f["IVA"], 0),

          montoTotal: pickNumber(f["Monto Total"], 0),

          repuestoExterno: pickNumber(f["Repuesto Externo Asignado"], 0),

        };

        return acc;

      }, {} as Record<string, { capital: number; utilidad: number; iva: number; montoTotal: number; repuestoExterno: number }>);



    const soloPendientes = records.filter((r) => {

      const estado = pickString(r.fields?.["Estado"] ?? "Pendiente").toLowerCase();

      return estado === "pendiente";

    });



    

    const data: Pendiente[] = soloPendientes.map((r) => {

      const f = r.fields ?? {};

      const cuentaId = pickLinkedId(f["Cuenta Destino Final"]);

      const transaccionRelacionadaId = pickLinkedId(f["Transacci\u00f3n Relacionada"]);

      const transRelacionada = transaccionRelacionadaId ? transaccionesMap[transaccionRelacionadaId] : undefined;

      const rubros = computeRubros(f, transRelacionada);

      return {

        id: r.id,

        transaccionRelacionadaId,

        medio: pickString(f["Medio"] ?? f["M\u00e9todo de Pago"]),

        fecha: pickString(f["Fecha"] ?? ""),

        fechaEstimada: pickString(f["Fecha Estimada de Acreditaci\u00f3n"] ?? "") || null,

        montoEsperado: rubros.montoEsperado,

        capital: rubros.capital,

        utilidad: rubros.utilidad,

        iva: rubros.iva,

        comisionEstimada: pickNumber(f["Comisi\u00f3n Estimada"], 0),

        comisionReal: pickNumber(f["Comisi\u00f3n Real"], 0) || null,

        montoRealAcreditado: safeNumber(f["Monto Real Acreditado"], 0) || null,

        estado: pickString(f["Estado"] ?? "Pendiente"),

        cuentaDestinoFinalId: cuentaId,

        cuentaDestinoFinalNombre: cuentaId ? cuentasMap[cuentaId] ?? cuentaId : null,

        observaciones: pickString(f["Observaciones"] ?? ""),

      };

    });





    return NextResponse.json({ success: true, data });

  } catch (error) {

    const message = error instanceof Error ? error.message : "Error desconocido";

    return NextResponse.json({ success: false, error: message }, { status: 500 });

  }

}



