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

export async function GET() {
  try {
    const table = process.env.AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES;
    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
    if (!table) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES");
    if (!tableCuentas) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_CUENTAS");

    const [records, cuentas] = await Promise.all([
      fetchAirtableRecords<Record<string, unknown>>(table),
      fetchAirtableRecords<Record<string, unknown>>(tableCuentas),
    ]);

    const cuentasMap: Record<string, string> = cuentas.reduce((acc, r) => {
      const nombre = pickString(r.fields?.["Nombre"]);
      if (r.id && nombre) acc[r.id] = nombre;
      return acc;
    }, {} as Record<string, string>);

    const soloPendientes = records.filter((r) => {
      const estado = pickString(r.fields?.["Estado"] ?? "Pendiente").toLowerCase();
      return estado === "pendiente";
    });

    const data: Pendiente[] = soloPendientes.map((r) => {
      const f = r.fields ?? {};
      const cuentaId = pickLinkedId(f["Cuenta Destino Final"]);
      return {
        id: r.id,
        transaccionRelacionadaId: pickLinkedId(f["Transacci\u00f3n Relacionada"]),
        medio: pickString(f["Medio"] ?? f["M\u00e9todo de Pago"]),
        fecha: pickString(f["Fecha"] ?? ""),
        fechaEstimada: pickString(f["Fecha Estimada de Acreditaci\u00f3n"] ?? "") || null,
        montoEsperado: pickNumber(f["Monto Esperado"], 0),
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
