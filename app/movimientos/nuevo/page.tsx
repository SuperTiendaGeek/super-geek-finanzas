import PageContainer from "@/components/layout/PageContainer";
import MovimientoForm from "@/components/movimientos/MovimientoForm";
import { getCuentas } from "@/services/cuentas";
import { Cuenta } from "@/types/cuenta";
export const dynamic = "force-dynamic";

async function getCuentasMovimiento(): Promise<Cuenta[]> {
  try {
    const cuentas = await getCuentas();
    return cuentas.filter((c) => c.activa && c.permiteTransferencias);
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
