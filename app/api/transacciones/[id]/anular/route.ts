import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchAirtableRecords, updateAirtableRecord } from "@/lib/airtable";
import { verifySession, sessionCookieName } from "@/lib/session";

const FIELD_ESTADO = "Estado";
const FIELD_ESTADO_PREVIO = "Estado Previo";
const FIELD_ID_TRANSACCION = "ID Transacción";
const FIELD_MOTIVO_ANULACION = "Motivo Anulación";
const FIELD_FECHA_ANULACION = "Fecha Anulación";
const FIELD_ANULADA_POR = "Anulada Por";
const FIELD_TIPO_FLUJO = "Tipo de Flujo";
const FIELD_ES_DISTRIBUCION = "Es Distribución Contable";

const FIELD_ESTADO_PAGO = "Estado del Pago";
const FIELD_ESTADO_RELACION = "Estado";

const LINK_FIELDS = [
  "Transacción Relacionada",
  "Transaccion Relacionada",
  "Transacción",
  "Transaccion",
  "Transacción Padre",
  "Transaccion Padre",
  "Transacción Origen",
  "Transaccion Origen",
];

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
const isAnulada = (estado: unknown) => normalize(estado).includes("anul") || normalize(estado).includes("cancel");
const isAcreditacion = (tipoFlujo: unknown) => normalize(tipoFlujo).includes("acredit");
const todayIso = () => new Date().toISOString().slice(0, 10);

function collectLinks(fields: Record<string, unknown>): Set<string> {
  const links = new Set<string>();
  LINK_FIELDS.forEach((key) => {
    const value = fields[key];
    if (Array.isArray(value)) (value as unknown[]).forEach((v) => links.add(String(v)));
    else if (value !== undefined && value !== null) links.add(String(value));
  });
  const idTransaccionCampo = fields[FIELD_ID_TRANSACCION];
  if (idTransaccionCampo) links.add(String(idTransaccionCampo));
  const idTransaccionOrigen = (fields["ID Transacción Origen"] ?? fields["ID Transaccion Origen"]) as unknown;
  if (idTransaccionOrigen) links.add(String(idTransaccionOrigen));
  return links;
}

function referencesTx(fields: Record<string, unknown>, candidateIds: Set<string>): boolean {
  const links = collectLinks(fields);
  return Array.from(candidateIds).some((id) => links.has(id));
}

async function resolveUserLabel(): Promise<string> {
  try {
    const token = cookies().get(sessionCookieName)?.value;
    const payload = await verifySession(token);
    if (payload && typeof payload === "object") {
      const email = (payload as Record<string, unknown>).email as string | undefined;
      const id = (payload as Record<string, unknown>).userId as string | undefined;
      const role = (payload as Record<string, unknown>).role as string | undefined;
      return email || id || role || "Sistema";
    }
  } catch (err) {
    console.warn("[transacciones/anular] no se pudo resolver usuario", err);
  }
  return "Sistema";
}

export async function POST(request: Request, context: { params: Promise<{ id?: string }> }) {
  const rawParams = await context.params;
  console.log("[transacciones/anular] context.params", rawParams);
  const txId = decodeURIComponent(rawParams?.id ?? "").trim();
  console.log("[transacciones/anular] txId", txId);
  if (!txId) {
    return NextResponse.json({ success: false, error: "ID de transacción requerido" }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { motivo?: string };
    const motivo = String(body.motivo ?? "").trim();
    if (!motivo) {
      return NextResponse.json({ success: false, error: "El motivo de anulación es obligatorio" }, { status: 400 });
    }

    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    const tablePendientes = process.env.AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES;
    const tablePagos = process.env.AIRTABLE_TABLE_DETALLE_PAGOS;

    if (!tableTx) throw new Error("Variable faltante: AIRTABLE_TABLE_TRANSACCIONES");

    const [txRecords, pendientesRecords, pagosRecords] = await Promise.all([
      fetchAirtableRecords<Record<string, unknown>>(tableTx),
      tablePendientes ? fetchAirtableRecords<Record<string, unknown>>(tablePendientes) : Promise.resolve([]),
      tablePagos ? fetchAirtableRecords<Record<string, unknown>>(tablePagos) : Promise.resolve([]),
    ]);

    const target = txRecords.find((r) => r.id === txId);
    if (!target) {
      return NextResponse.json({ success: false, error: "Transacción no encontrada" }, { status: 404 });
    }

    const fields = (target.fields ?? {}) as Record<string, unknown>;
    const posiblesIds = new Set<string>([txId]);
    const idTransaccion = String(fields[FIELD_ID_TRANSACCION] ?? "").trim();
    if (idTransaccion) posiblesIds.add(idTransaccion);

    const estadoActual = fields[FIELD_ESTADO];
    if (isAnulada(estadoActual)) {
      return NextResponse.json({ success: false, error: "La transacción ya está anulada" }, { status: 400 });
    }

    const relacionadosActivos = txRecords.filter(
      (r) =>
        r.id !== txId &&
        referencesTx((r.fields ?? {}) as Record<string, unknown>, posiblesIds) &&
        !isAnulada((r.fields as Record<string, unknown>)[FIELD_ESTADO])
    );

    const derivadosActivos = relacionadosActivos.filter(
      (r) =>
        !isAcreditacion((r.fields as Record<string, unknown>)[FIELD_TIPO_FLUJO]) &&
        !(r.fields as Record<string, unknown>)[FIELD_ES_DISTRIBUCION]
    );
    const distribucionesActivas = relacionadosActivos.filter(
      (r) => Boolean((r.fields as Record<string, unknown>)[FIELD_ES_DISTRIBUCION])
    );
    const acreditacionesActivas = relacionadosActivos.filter((r) =>
      isAcreditacion((r.fields as Record<string, unknown>)[FIELD_TIPO_FLUJO])
    );

    // Regla de integridad: no permitir anular si hay distribuciones contables activas vinculadas
    if (distribucionesActivas.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No se puede anular: existen distribuciones contables activas vinculadas. Anula primero los movimientos de distribución relacionados.",
          detalles: { distribucionesActivas: distribucionesActivas.map((r) => r.id) },
        },
        { status: 409 }
      );
    }

    const blockingReasons: string[] = [];
    if (derivadosActivos.length) blockingReasons.push("Tiene movimientos derivados activos vinculados.");
    if (acreditacionesActivas.length) blockingReasons.push("Tiene acreditaciones activas vinculadas.");

    if (blockingReasons.length) {
      return NextResponse.json(
        {
          success: false,
          error: blockingReasons.join(" "),
          detalles: {
            derivadosActivos: derivadosActivos.map((r) => r.id),
            distribucionesActivas: distribucionesActivas.map((r) => r.id),
            acreditacionesActivas: acreditacionesActivas.map((r) => r.id),
          },
        },
        { status: 409 }
      );
    }

    const userLabel = await resolveUserLabel();
    const estadoPrevio = String(fields[FIELD_ESTADO] ?? "").trim() || "Confirmado";

    await updateAirtableRecord(tableTx, txId, {
      [FIELD_ESTADO_PREVIO]: estadoPrevio,
      [FIELD_MOTIVO_ANULACION]: motivo,
      [FIELD_FECHA_ANULACION]: todayIso(),
      [FIELD_ANULADA_POR]: userLabel,
      [FIELD_ESTADO]: "Anulado",
    });

    let pendientesActualizados = 0;
    if (tablePendientes) {
      const pendientesRelacionados = pendientesRecords.filter((r) =>
        referencesTx((r.fields ?? {}) as Record<string, unknown>, posiblesIds)
      );
      await Promise.all(
        pendientesRelacionados.map((r) =>
          updateAirtableRecord(tablePendientes, r.id, { [FIELD_ESTADO_RELACION]: "Anulado" })
        )
      );
      pendientesActualizados = pendientesRelacionados.length;
    }

    let pagosActualizados = 0;
    if (tablePagos) {
      const pagosRelacionados = pagosRecords.filter((r) =>
        referencesTx((r.fields ?? {}) as Record<string, unknown>, posiblesIds)
      );
      await Promise.all(
        pagosRelacionados.map((r) =>
          updateAirtableRecord(tablePagos, r.id, { [FIELD_ESTADO_PAGO]: "Anulado" })
        )
      );
      pagosActualizados = pagosRelacionados.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: txId,
        estado: "Anulado",
        relacionados: { pendientesActualizados, pagosActualizados },
      },
    });
  } catch (error) {
    console.error("[transacciones/anular] error", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
