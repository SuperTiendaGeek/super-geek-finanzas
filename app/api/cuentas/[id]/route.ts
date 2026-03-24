import { NextResponse } from "next/server";
import { fetchAirtableRecords } from "@/lib/airtable";
import { calcularSaldosPorCuenta } from "@/lib/calculations";
import { Cuenta } from "@/types/cuenta";
import { Transaccion } from "@/types/transaccion";

const FIELD_NOMBRE = "Nombre";
const FIELD_TIPO = "Tipo de Cuenta";
const FIELD_PERMITE_ING = "Permite Ingresos";
const FIELD_PERMITE_EGR = "Permite Egresos";
const FIELD_PERMITE_TRANS = "Permite Transferencias";
const FIELD_ACTIVA = "Activa";
const FIELD_SALDO_ACTUAL = "Saldo Actual";

const TX_FIELD_FECHA = "Fecha";
const TX_FIELD_TIPO = "Tipo de Transacción";
const TX_FIELD_CONCEPTO = "Concepto";
const TX_FIELD_ESTADO = "Estado";
const TX_FIELD_CTA_ORIGEN = "Cuenta Origen";
const TX_FIELD_CTA_DEST = "Cuenta Destino";
const TX_FIELD_METODO = "Método de Pago";
const TX_FIELD_MONTO = "Monto Total";
const TX_FIELD_ID = "ID Transacción";

function pickLinkedId(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as string | undefined) ?? null;
  return (value as string | undefined) ?? null;
}

function pickNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseDate(value: unknown): number {
  const time = new Date(String(value ?? "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const recordId = decodeURIComponent(id);

    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    if (!tableCuentas || !tableTx) {
      throw new Error("Variables de entorno faltantes");
    }

    const [cuentasRaw, txRaw] = await Promise.all([
      fetchAirtableRecords<Record<string, unknown>>(tableCuentas),
      fetchAirtableRecords<Record<string, unknown>>(tableTx),
    ]);

    const cuentasMap: Record<string, string> = cuentasRaw.reduce((acc, c) => {
      const nombre = (c.fields as Record<string, unknown>)[FIELD_NOMBRE] as string | undefined;
      if (c.id && nombre) acc[c.id] = nombre;
      return acc;
    }, {} as Record<string, string>);

    const cuentaRec = cuentasRaw.find((c) => c.id === recordId);
    if (!cuentaRec) {
      return NextResponse.json({ success: false, error: "Cuenta no encontrada" }, { status: 404 });
    }

    const cuentaFields = cuentaRec.fields as Record<string, unknown>;
    const cuenta: Cuenta = {
      id: recordId,
      nombre: String(cuentaFields[FIELD_NOMBRE] ?? ""),
      tipoCuenta: String(cuentaFields[FIELD_TIPO] ?? ""),
      permiteIngresos: Boolean(cuentaFields[FIELD_PERMITE_ING]),
      permiteEgresos: Boolean(cuentaFields[FIELD_PERMITE_EGR]),
      permiteTransferencias: Boolean(cuentaFields[FIELD_PERMITE_TRANS]),
      activa: Boolean(cuentaFields[FIELD_ACTIVA]),
      saldo: pickNumber(cuentaFields[FIELD_SALDO_ACTUAL], 0),
    };

    const transacciones: Transaccion[] = txRaw
      .map((r) => {
        const f = r.fields as Record<string, unknown>;
        const origenId = pickLinkedId(f[TX_FIELD_CTA_ORIGEN]);
        const destinoId = pickLinkedId(f[TX_FIELD_CTA_DEST]);

        return {
          id: String(r.id),
          idTransaccion: f[TX_FIELD_ID] ? String(f[TX_FIELD_ID]) : undefined,
          fecha: String(f[TX_FIELD_FECHA] ?? ""),
          tipoTransaccion: String(f[TX_FIELD_TIPO] ?? ""),
          concepto: String(f[TX_FIELD_CONCEPTO] ?? ""),
          estado: String(f[TX_FIELD_ESTADO] ?? ""),
          cuentaOrigenId: origenId,
          cuentaDestinoId: destinoId,
          cuentaOrigen: origenId ? cuentasMap[origenId] ?? origenId : origenId,
          cuentaDestino: destinoId ? cuentasMap[destinoId] ?? destinoId : destinoId,
          metodoPago: (f[TX_FIELD_METODO] as string | undefined) ?? undefined,
          montoTotal: pickNumber(f[TX_FIELD_MONTO], 0),
          capital: pickNumber(f["Capital"], 0),
          utilidad: pickNumber(f["Utilidad"], 0),
          iva: pickNumber(f["IVA"], 0),
          repuestoProveedorExterno: pickNumber(f["Repuesto Proveedor Externo"], 0),
          comision: pickNumber(f["Comisión"], 0),
          montoNetoRecibido: pickNumber(f["Monto Neto Recibido"], 0),
        } as Transaccion;
      })
      .filter((t) => t.cuentaOrigenId === recordId || t.cuentaDestinoId === recordId)
      .sort((a, b) => parseDate(b.fecha) - parseDate(a.fecha));

    const saldosPorCuenta = calcularSaldosPorCuenta([{ id: recordId } as Cuenta], transacciones);
    const saldoActual = saldosPorCuenta[recordId] ?? 0;

    const estadosValidos = ["confirmado", "procesada", "acreditado"];
    const esValida = (estado: string) => estadosValidos.includes(estado.toLowerCase());

    const totalRecibido = transacciones
      .filter((t) => t.cuentaDestinoId === recordId && esValida(t.estado))
      .reduce((acc, t) => acc + (t.montoTotal || 0), 0);

    const totalEnviado = transacciones
      .filter(
        (t) => t.tipoTransaccion?.toLowerCase() === "movimiento" && t.cuentaOrigenId === recordId && esValida(t.estado)
      )
      .reduce((acc, t) => acc + (t.montoTotal || 0), 0);

    const totalEgresado = transacciones
      .filter((t) => t.tipoTransaccion?.toLowerCase() === "egreso" && t.cuentaOrigenId === recordId && esValida(t.estado))
      .reduce((acc, t) => acc + (t.montoTotal || 0), 0);

    const cantidadTransacciones = transacciones.length;

    return NextResponse.json({
      success: true,
      data: {
        cuenta,
        saldoActual,
        totalRecibido,
        totalEnviado,
        totalEgresado,
        cantidadTransacciones,
        transacciones,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
