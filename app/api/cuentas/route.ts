import { NextResponse } from "next/server";
import { fetchAirtableRecords } from "@/lib/airtable";
import { safeNumber } from "@/lib/helpers";
import { Cuenta } from "@/types/cuenta";

export async function GET() {
  try {
    const tableName = process.env.AIRTABLE_TABLE_CUENTAS;
    if (!tableName) {
      throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_CUENTAS");
    }

    const records = await fetchAirtableRecords<Record<string, unknown>>(tableName);

    const data: Cuenta[] = records.map(({ id, fields }) => {
      const rawSaldo = fields["Saldo Actual"];
      const saldo = rawSaldo === undefined || rawSaldo === null ? undefined : safeNumber(rawSaldo, 0);

      return {
        id,
        nombre: String(fields["Nombre"] ?? ""),
        tipoCuenta: String(fields["Tipo de Cuenta"] ?? ""),
        permiteIngresos: Boolean(fields["Permite Ingresos"]),
        permiteEgresos: Boolean(fields["Permite Egresos"]),
        permiteTransferencias: Boolean(fields["Permite Transferencias"]),
        activa: Boolean(fields["Activa"]),
        saldo,
        moneda: (fields["Moneda"] as string | undefined) ?? undefined,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
