import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchAirtableRecords, updateAirtableRecord } from "@/lib/airtable";
import { verifySession, sessionCookieName } from "@/lib/session";

const FIELD_ESTADO = "Estado";
const FIELD_ESTADO_PREVIO = "Estado Previo";
const FIELD_ID_TRANSACCION = "ID Transacción";
const FIELD_FECHA_REHABILITACION = "Fecha Rehabilitación";
const FIELD_REHABILITADA_POR = "Rehabilitada Por";

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
    console.warn("[transacciones/rehabilitar] no se pudo resolver usuario", err);
  }
  return "Sistema";
}

export async function POST(_: Request, context: { params: Promise<{ id?: string }> }) {
  const rawParams = await context.params;
  console.log("[transacciones/rehabilitar] context.params", rawParams);
  const txId = decodeURIComponent(rawParams?.id ?? "").trim();
  console.log("[transacciones/rehabilitar] txId", txId);
  if (!txId) {
    return NextResponse.json({ success: false, error: "ID de transacción requerido" }, { status: 400 });
  }

  try {
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
    if (!isAnulada(estadoActual)) {
      return NextResponse.json({ success: false, error: "Solo se pueden rehabilitar transacciones anuladas" }, { status: 400 });
    }

    const estadoPrevio = String(fields[FIELD_ESTADO_PREVIO] ?? "").trim() || "Confirmado";
    const userLabel = await resolveUserLabel();

    await updateAirtableRecord(tableTx, txId, {
      [FIELD_ESTADO]: estadoPrevio,
      [FIELD_FECHA_REHABILITACION]: todayIso(),
      [FIELD_REHABILITADA_POR]: userLabel,
    });

    let pendientesActualizados = 0;
    if (tablePendientes) {
      const pendientesRelacionados = pendientesRecords.filter((r) =>
        referencesTx((r.fields ?? {}) as Record<string, unknown>, posiblesIds)
      );
      await Promise.all(
        pendientesRelacionados.map((r) =>
          updateAirtableRecord(tablePendientes, r.id, { [FIELD_ESTADO_RELACION]: "Pendiente" })
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
          updateAirtableRecord(tablePagos, r.id, { [FIELD_ESTADO_PAGO]: "Pendiente" })
        )
      );
      pagosActualizados = pagosRelacionados.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: txId,
        estado: estadoPrevio,
        relacionados: { pendientesActualizados, pagosActualizados },
      },
    });
  } catch (error) {
    console.error("[transacciones/rehabilitar] error", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
