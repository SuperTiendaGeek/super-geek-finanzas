import { NextResponse } from "next/server";
import { getTransaccionDetalle } from "@/services/transacciones";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await context.params;
    const recordId = decodeURIComponent(resolved.id);
    console.log("[api/transacciones/[id]] params:", resolved);
    console.log("[api/transacciones/[id]] recordId:", recordId);
    const detalle = await getTransaccionDetalle(recordId);

    if (!detalle.transaccion) {
      return NextResponse.json(
        { success: false, error: detalle.error || "Transacción no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: detalle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error("[api/transacciones/[id]] error", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
