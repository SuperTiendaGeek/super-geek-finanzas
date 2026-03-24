import PageContainer from "@/components/layout/PageContainer";
import ReportesView from "@/components/reportes/ReportesView";
import { getCuentas } from "@/services/cuentas";
import { getPendientes } from "@/services/pendientes";
import { getTransacciones } from "@/services/transacciones";
export const dynamic = "force-dynamic";


export default async function ReportesPage() {
  const [cuentas, transacciones, pendientes] = await Promise.all([
    getCuentas(),
    getTransacciones(),
    getPendientes(),
  ]);

  return (
    <PageContainer title="Reportes" subtitle="Visualiza indicadores clave del negocio">
      <ReportesView cuentas={cuentas} transacciones={transacciones} pendientes={pendientes} />
    </PageContainer>
  );
}

