import { fetchAirtableRecords } from "@/lib/airtable";
import { safeNumber } from "@/lib/helpers";
import { Pendiente } from "@/types/pendiente";

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

export async function getPendientes(): Promise<Pendiente[]> {
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
        transaccionRelacionadaId: pickLinkedId(f["Transacción Relacionada"]),
        medio: pickString(f["Medio"] ?? f["Método de Pago"]),
        fecha: pickString(f["Fecha"] ?? ""),
        fechaEstimada: pickString(f["Fecha Estimada de Acreditación"] ?? "") || null,
        montoEsperado: pickNumber(f["Monto Esperado"], 0),
        comisionEstimada: pickNumber(f["Comisión Estimada"], 0),
        comisionReal: pickNumber(f["Comisión Real"], 0) || null,
        montoRealAcreditado: safeNumber(f["Monto Real Acreditado"], 0) || null,
        estado: pickString(f["Estado"] ?? "Pendiente"),
        cuentaDestinoFinalId: cuentaId,
        cuentaDestinoFinalNombre: cuentaId ? cuentasMap[cuentaId] ?? cuentaId : null,
        observaciones: pickString(f["Observaciones"] ?? ""),
      };
    });

    return data;
  } catch (error) {
    console.error("Error en getPendientes", error);
    return [];
  }
}

