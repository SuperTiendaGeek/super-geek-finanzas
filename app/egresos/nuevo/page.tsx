import PageContainer from "@/components/layout/PageContainer";
import EgresoForm from "@/components/egresos/EgresoForm";
import { getCuentas } from "@/services/cuentas";
import { Cuenta } from "@/types/cuenta";
export const dynamic = "force-dynamic";

async function getCuentasEgreso(): Promise<Cuenta[]> {
  try {
    const cuentas = await getCuentas();
    return cuentas.filter((c) => c.permiteEgresos);
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
