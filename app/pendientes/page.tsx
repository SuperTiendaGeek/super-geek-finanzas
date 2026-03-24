import PageContainer from "@/components/layout/PageContainer";
import PendientesTable from "@/components/pendientes/PendientesTable";
import { getPendientes } from "@/services/pendientes";

export default async function PendientesPage() {
  const pendientes = await getPendientes();

  return (
    <PageContainer
      title="Movimientos Pendientes"
      subtitle="Confirma la acreditación de pagos pendientes"
    >
      <PendientesTable pendientes={pendientes} />
    </PageContainer>
  );
}
