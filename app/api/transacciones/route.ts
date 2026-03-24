import { NextResponse } from "next/server";
import { fetchAirtableRecords } from "@/lib/airtable";
import { Transaccion } from "@/types/transaccion";

const FIELD_TIPO_TRANSACCION = "Tipo de Transacci\u00f3n";
const FIELD_ID_TRANSACCION = "ID Transacci\u00f3n";
const FIELD_TIPO_FLUJO = "Tipo de Flujo";
const FIELD_CUENTA_ORIGEN = "Cuenta Origen";
const FIELD_CUENTA_DESTINO = "Cuenta Destino";
const FIELD_METODO_PAGO = "M\u00e9todo de Pago";
const FIELD_MONTO_TOTAL = "Monto Total";
const FIELD_CAPITAL = "Capital";
const FIELD_UTILIDAD = "Utilidad";
const FIELD_IVA = "IVA";
const FIELD_COMISION = "Comisi\u00f3n";
const FIELD_MONTO_NETO = "Monto Neto Recibido";
const FIELD_REPUESTO_EXT = "Repuesto Proveedor Externo";
const FIELD_LLEVA_FACTURA = "Lleva Factura";
const FIELD_OBSERVACIONES = "Descripci\u00f3n / Observaciones";
const FIELD_REFERENCIA = "Referencia Externa";
const FIELD_FECHA = "Fecha";
const FIELD_CONCEPTO = "Concepto";
const FIELD_ESTADO = "Estado";
const FIELD_ES_DISTRIBUCION = "Es Distribución Contable";
const FIELD_COMPONENTE = "Componente Distribuido";
const FIELD_MONTO_DISTRIBUIDO = "Monto Distribuido";

function pickLinkedId(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as string | undefined) ?? null;
  return (value as string | undefined) ?? null;
}

function pickNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function resolveAccount(
  linkedValue: unknown,
  cuentasMap: Record<string, string>
): { id: string | null; nombre: string | null } {
  const id = pickLinkedId(linkedValue);
  if (!id) return { id: null, nombre: "-" };
  const nombre = cuentasMap[id] ?? id;
  return { id, nombre };
}

function parseDate(value: unknown): number {
  const time = new Date(String(value ?? "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function GET() {
  try {
    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
    if (!tableTx) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_TRANSACCIONES");
    if (!tableCuentas) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_CUENTAS");

    const [txRecords, cuentaRecords] = await Promise.all([
      fetchAirtableRecords<Record<string, unknown>>(tableTx),
      fetchAirtableRecords<Record<string, unknown>>(tableCuentas),
    ]);

    const cuentasMap: Record<string, string> = cuentaRecords.reduce((acc, record) => {
      const fields = (record?.fields as Record<string, unknown>) ?? {};
      const nombre = (fields["Nombre"] ?? fields["nombre"] ?? "") as string;
      if (record?.id && nombre) acc[record.id] = nombre;
      return acc;
    }, {} as Record<string, string>);

    const data: Transaccion[] = txRecords
      .map((record) => {
        const fields = (record?.fields as Record<string, unknown>) ?? {};
        const origen = resolveAccount(fields[FIELD_CUENTA_ORIGEN], cuentasMap);
        const destino = resolveAccount(fields[FIELD_CUENTA_DESTINO], cuentasMap);

        return {
          id: String(record?.id ?? ""),
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
        } as Transaccion;
      })
      .filter((tx) => tx.id)
      .sort((a, b) => {
        const timeDiff = parseDate(b.fecha) - parseDate(a.fecha);
        if (timeDiff !== 0) return timeDiff;
        const idA = String(a.idTransaccion ?? a.id ?? "");
        const idB = String(b.idTransaccion ?? b.id ?? "");
        return idB.localeCompare(idA);
      });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

