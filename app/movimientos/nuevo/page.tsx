import PageContainer from "@/components/layout/PageContainer";
import MovimientoForm from "@/components/movimientos/MovimientoForm";
import { Cuenta } from "@/types/cuenta";

function resolveApiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base}${path}`;
}

async function getCuentasMovimiento(): Promise<Cuenta[]> {
  try {
    const url = resolveApiUrl("/api/cuentas");
    const res = await fetch(url, { cache: "no-store" });
    const payload = (await res.json()) as { success?: boolean; data?: Cuenta[] };

    if (!res.ok || !payload?.success || !Array.isArray(payload.data)) {
      throw new Error("Respuesta inválida de cuentas");
    }

    const cuentas = payload.data.filter((c) => c.activa && c.permiteTransferencias);
    console.log("[movimientos/page] cuentas disponibles", cuentas.map((c) => c.nombre));
    return cuentas;
  } catch (error) {
    console.error("Error al cargar cuentas para movimientos", error);
    return [];
  }
}

export default async function NuevoMovimientoPage() {
  const cuentas = await getCuentasMovimiento();

  return (
    <PageContainer title="Registrar movimiento interno" subtitle="Transferencias entre cuentas">
      <MovimientoForm cuentas={cuentas} />
    </PageContainer>
  );
}
