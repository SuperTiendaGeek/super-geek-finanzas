import PageContainer from "@/components/layout/PageContainer";
import TransaccionesTable from "@/components/transacciones/TransaccionesTable";
import { getTransacciones } from "@/services/transacciones";
import { DEFAULT_CURRENCY } from "@/lib/constants";

export default async function TransaccionesPage() {
  let transacciones = [];

  try {
    transacciones = await getTransacciones();
  } catch (error) {
    console.error("No se pudieron cargar las transacciones", error);
  }

  return (
    <PageContainer
      title="Transacciones"
      subtitle="Consulta y audita todos los movimientos del sistema"
    >
      <TransaccionesTable transacciones={transacciones} currency={DEFAULT_CURRENCY} />
    </PageContainer>
  );
}
