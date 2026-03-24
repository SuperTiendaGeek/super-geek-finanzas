import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/helpers";

interface ResumenGeneralProps {
  ingresos?: number;
  egresos?: number;
  disponible?: number;
}

export default function ResumenGeneral({
  ingresos = 0,
  egresos = 0,
  disponible = 0,
}: ResumenGeneralProps) {
  const items = [
    { label: "Ingresos", value: formatCurrency(ingresos) },
    { label: "Egresos", value: formatCurrency(egresos) },
    { label: "Disponible", value: formatCurrency(disponible) },
  ];

  return (
    <Card title="Resumen general" description="Cifras rapidas del periodo actual">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-md bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">{item.label}</p>
            <p className="text-lg font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}