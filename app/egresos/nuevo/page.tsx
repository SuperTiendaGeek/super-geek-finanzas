import PageContainer from "@/components/layout/PageContainer";
import EgresoForm from "@/components/egresos/EgresoForm";
import { Cuenta } from "@/types/cuenta";
export const dynamic = "force-dynamic";


function resolveApiUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base}${path}`;
}

async function getCuentasEgreso(): Promise<Cuenta[]> {
  try {
    const url = resolveApiUrl("/api/cuentas");
    const res = await fetch(url, { cache: "no-store" });
    const payload = (await res.json()) as { success?: boolean; data?: Cuenta[] };

    if (!res.ok || !payload?.success || !Array.isArray(payload.data)) {
      throw new Error("Respuesta invÃ¡lida de cuentas");
    }

    return payload.data.filter((c) => c.permiteEgresos);
  } catch (error) {
    console.error("Error al cargar cuentas para egresos", error);
    return [];
  }
}

export default async function NuevoEgresoPage() {
  const cuentas = await getCuentasEgreso();

  return (
    <PageContainer title="Registrar egreso" subtitle="Control de gastos y salidas">
      <EgresoForm cuentas={cuentas} />
    </PageContainer>
  );
}

