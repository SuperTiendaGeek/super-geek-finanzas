import { fetchAirtableRecordById, fetchAirtableRecords } from "@/lib/airtable";
import { Transaccion } from "@/types/transaccion";

const FIELD_TIPO_TRANSACCION = "Tipo de Transacción";
const FIELD_ID_TRANSACCION = "ID Transacción";
const FIELD_TIPO_FLUJO = "Tipo de Flujo";
const FIELD_CUENTA_ORIGEN = "Cuenta Origen";
const FIELD_CUENTA_DESTINO = "Cuenta Destino";
const FIELD_METODO_PAGO = "Método de Pago";
const FIELD_MONTO_TOTAL = "Monto Total";
const FIELD_CAPITAL = "Capital";
const FIELD_UTILIDAD = "Utilidad";
const FIELD_IVA = "IVA";
const FIELD_COMISION = "Comisión";
const FIELD_MONTO_NETO = "Monto Neto Recibido";
const FIELD_REPUESTO_EXT = "Repuesto Proveedor Externo";
const FIELD_LLEVA_FACTURA = "Lleva Factura";
const FIELD_OBSERVACIONES = "Descripción / Observaciones";
const FIELD_REFERENCIA = "Referencia Externa";
const FIELD_FECHA = "Fecha";
const FIELD_CONCEPTO = "Concepto";
const FIELD_ESTADO = "Estado";
const FIELD_ES_DISTRIBUCION = "Es Distribución Contable";
const FIELD_COMPONENTE = "Componente Distribuido";
const FIELD_MONTO_DISTRIBUIDO = "Monto Distribuido";
const FIELD_ESTADO_PREVIO = "Estado Previo";
const FIELD_MOTIVO_ANULACION = "Motivo Anulación";
const FIELD_FECHA_ANULACION = "Fecha Anulación";
const FIELD_ANULADA_POR = "Anulada Por";
const FIELD_FECHA_REHABILITACION = "Fecha Rehabilitación";
const FIELD_REHABILITADA_POR = "Rehabilitada Por";

function pickLinkedId(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as string | undefined) ?? null;
  return (value as string | undefined) ?? null;
}

function pickNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pickString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str.length ? str : undefined;
}

function resolveAccount(linkedValue: unknown, cuentasMap: Record<string, string>): { id: string | null; nombre: string | null } {
  const id = pickLinkedId(linkedValue);
  if (!id) return { id: null, nombre: "-" };
  const nombre = cuentasMap[id] ?? id;
  return { id, nombre };
}

function parseDate(value: unknown): number {
  const time = new Date(String(value ?? "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function loadCuentasMap(): Promise<Record<string, string>> {
  const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
  if (!tableCuentas) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_CUENTAS");
  const cuentaRecords = await fetchAirtableRecords<Record<string, unknown>>(tableCuentas);
  return cuentaRecords.reduce((acc, record) => {
    const fields = (record?.fields as Record<string, unknown>) ?? {};
    const nombre = (fields["Nombre"] ?? fields["nombre"] ?? "") as string;
    if (record?.id && nombre) acc[record.id] = nombre;
    return acc;
  }, {} as Record<string, string>);
}

async function loadTransaccionesRaw() {
  const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
  if (!tableTx) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_TRANSACCIONES");
  return fetchAirtableRecords<Record<string, unknown>>(tableTx);
}

function mapTransaccion(record: { id: string; fields: Record<string, unknown> }, cuentasMap: Record<string, string>): Transaccion {
  const fields = record.fields ?? {};
  const origen = resolveAccount(fields[FIELD_CUENTA_ORIGEN], cuentasMap);
  const destino = resolveAccount(fields[FIELD_CUENTA_DESTINO], cuentasMap);

  const recordId = String(record?.id ?? "").trim();

  return {
    id: recordId,
    recordId,
    idTransaccion: fields[FIELD_ID_TRANSACCION] ? String(fields[FIELD_ID_TRANSACCION]) : undefined,
    fecha: String(fields[FIELD_FECHA] ?? ""),
    tipoTransaccion: String(fields[FIELD_TIPO_TRANSACCION] ?? ""),
    tipoFlujo: (fields[FIELD_TIPO_FLUJO] as string | undefined) ?? undefined,
    concepto: String(fields[FIELD_CONCEPTO] ?? ""),
    estado: String(fields[FIELD_ESTADO] ?? ""),
    cuentaOrigenId: origen.id,
    cuentaDestinoId: destino.id,
    cuentaOrigen: origen.nombre,
    cuentaDestino: destino.nombre,
    metodoPago: (fields[FIELD_METODO_PAGO] as string | undefined) ?? undefined,
    montoTotal: pickNumber(fields[FIELD_MONTO_TOTAL], 0),
    capital: pickNumber(fields[FIELD_CAPITAL], 0),
    utilidad: pickNumber(fields[FIELD_UTILIDAD], 0),
    iva: pickNumber(fields[FIELD_IVA], 0),
    comision: pickNumber(fields[FIELD_COMISION], 0),
    montoNetoRecibido: pickNumber(fields[FIELD_MONTO_NETO], 0),
    repuestoProveedorExterno: pickNumber(fields[FIELD_REPUESTO_EXT], 0),
    llevaFactura: Boolean(fields[FIELD_LLEVA_FACTURA]),
    descripcionObservaciones: (fields[FIELD_OBSERVACIONES] as string | undefined) ?? undefined,
    referenciaExterna: (fields[FIELD_REFERENCIA] as string | undefined) ?? undefined,
    esDistribucionContable: Boolean(fields[FIELD_ES_DISTRIBUCION]),
    componenteDistribuido: (fields[FIELD_COMPONENTE] as string | undefined) ?? undefined,
    montoDistribuido: pickNumber(fields[FIELD_MONTO_DISTRIBUIDO], 0),
    estadoPrevio: pickString(fields[FIELD_ESTADO_PREVIO]),
    motivoAnulacion: pickString(fields[FIELD_MOTIVO_ANULACION]),
    fechaAnulacion: pickString(fields[FIELD_FECHA_ANULACION]),
    anuladaPor: pickString(fields[FIELD_ANULADA_POR]),
    fechaRehabilitacion: pickString(fields[FIELD_FECHA_REHABILITACION]),
    rehabilitadaPor: pickString(fields[FIELD_REHABILITADA_POR]),
  } as Transaccion;
}

export async function getTransacciones(): Promise<Transaccion[]> {
  try {
    const [cuentasMap, txRecords] = await Promise.all([loadCuentasMap(), loadTransaccionesRaw()]);

    return txRecords
      .map((record) => mapTransaccion({ id: record.id, fields: record.fields as Record<string, unknown> }, cuentasMap))
      .filter((tx) => tx.id)
      .sort((a, b) => {
        const timeDiff = parseDate(b.fecha) - parseDate(a.fecha);
        if (timeDiff !== 0) return timeDiff;
        const idA = String(a.idTransaccion ?? a.id ?? "");
        const idB = String(b.idTransaccion ?? b.id ?? "");
        return idB.localeCompare(idA);
      });
  } catch (error) {
    console.error("Error en getTransacciones", error);
    return [];
  }
}

export async function getTransaccionDetalle(id: string) {
  try {
    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    if (!tableTx) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_TRANSACCIONES");

    const cuentasMapPromise = loadCuentasMap();
    const normalizedId = String(id ?? "").trim();
    console.log("[getTransaccionDetalle] id raw:", id, "normalized:", normalizedId);
    let match: { id: string; fields: Record<string, unknown> } | null = null;
    let foundBy: "recordId" | "idTransaccion" | "unknown" | null = null;

    // 1) Intento directo por recordId (preferido)
    if (normalizedId && normalizedId.startsWith("rec")) {
      const byId = await fetchAirtableRecordById<Record<string, unknown>>(tableTx, normalizedId).catch((err) => {
        console.warn("[getTransaccionDetalle] fetch by recordId falló", err);
        return null;
      });
      if (byId) {
        match = { id: byId.id, fields: byId.fields as Record<string, unknown> };
        foundBy = "recordId";
      }
    }

    // 2) Fallback: buscar por recordId o ID Transacción en toda la tabla
    if (!match) {
      const txRecords = await loadTransaccionesRaw();
      const found = txRecords.find(
        (r) => r.id === normalizedId || String((r.fields as any)[FIELD_ID_TRANSACCION]) === normalizedId
      );
      if (found) {
        match = { id: found.id, fields: found.fields as Record<string, unknown> };
        foundBy = found.id === normalizedId ? "recordId" : "idTransaccion";
      }
    }

    if (!match) {
      return {
        transaccion: null,
        detalleReparacion: null,
        pendientes: [],
        error: "No se encontró la transacción por recordId ni por ID Transacción.",
      };
    }

    const cuentasMap = await cuentasMapPromise;
    const transaccion = mapTransaccion({ id: match.id, fields: match.fields as Record<string, unknown> }, cuentasMap);

    return { transaccion, detalleReparacion: null, pendientes: [], foundBy, error: null };
  } catch (error) {
    console.error("Error en getTransaccionDetalle", error);
    const message = error instanceof Error ? error.message : "Error desconocido al cargar la transacción";
    return { transaccion: null, detalleReparacion: null, pendientes: [], error: message };
  }
}
