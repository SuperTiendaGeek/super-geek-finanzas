import PageContainer from "@/components/layout/PageContainer";
import ReportesView from "@/components/reportes/ReportesView";
import { calcularSaldosPorCuenta } from "@/lib/calculations";
import { getCuentas } from "@/services/cuentas";
import { getPendientes } from "@/services/pendientes";
import { calcularDistribucionContable } from "@/services/distribucion";
import { getTransacciones } from "@/services/transacciones";
export const dynamic = "force-dynamic";


export default async function ReportesPage() {
  const [cuentas, transacciones, pendientes] = await Promise.all([
    getCuentas(),
    getTransacciones(),
    getPendientes(),
  ]);

  const distribucion = calcularDistribucionContable(transacciones);
  const saldos = calcularSaldosPorCuenta(cuentas, transacciones);
  const cuentaIngresos = cuentas.find((c) => c.nombre === "SGINGRESOS");
  const saldoIngresos = cuentaIngresos ? saldos[cuentaIngresos.id] ?? 0 : 0;

  return (
    <PageContainer title="Reportes" subtitle="Visualiza indicadores clave del negocio">
      <ReportesView cuentas={cuentas} transacciones={transacciones} pendientes={pendientes} distribucion={distribucion} saldoIngresos={saldoIngresos} />
    </PageContainer>
  );
}







