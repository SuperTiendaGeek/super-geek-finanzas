import PageContainer from "@/components/layout/PageContainer";
import TransaccionesTable from "@/components/transacciones/TransaccionesTable";
import { getTransacciones } from "@/services/transacciones";
import { getPendientes } from "@/services/pendientes";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { Transaccion } from "@/types/transaccion";
export const dynamic = "force-dynamic";

export default async function TransaccionesPage() {
  let transacciones: Transaccion[] = [];
  let pendientesTotal = 0;

  try {
    const [txRes, pendRes] = await Promise.all([getTransacciones(), getPendientes()]);
    transacciones = txRes;
    pendientesTotal = pendRes.reduce((acc, p) => acc + (p.montoEsperado ?? 0), 0);
  } catch (error) {
    console.error("No se pudieron cargar las transacciones", error);
  }

  return (
    <PageContainer title="Transacciones" subtitle="Consulta y audita todos los movimientos del sistema">
      <TransaccionesTable
        transacciones={transacciones}
        currency={DEFAULT_CURRENCY}
        pendientesTotal={pendientesTotal}
      />
    </PageContainer>
  );
}
