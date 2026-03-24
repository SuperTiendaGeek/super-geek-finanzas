import PageContainer from "@/components/layout/PageContainer";
import IngresoForm from "@/components/ingresos/IngresoForm";

export default function NuevoIngresoPage() {
  return (
    <PageContainer
      title="Registrar ingreso"
      subtitle="Captura rapida de ingresos y valida la distribucion"
    >
      <IngresoForm />
    </PageContainer>
  );
}
