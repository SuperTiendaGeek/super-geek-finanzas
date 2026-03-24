import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/helpers";
import { Cuenta } from "@/types/cuenta";

interface CuentaCardProps {
  cuenta: Cuenta;
  defaultCurrency?: string;
}

export default function CuentaCard({ cuenta, defaultCurrency = "USD" }: CuentaCardProps) {
  const saldo = cuenta.saldo ?? 0;
  const currency = cuenta.moneda ?? defaultCurrency;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{cuenta.nombre}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(saldo, currency)}
          </p>
          <p className="text-xs text-slate-500">{cuenta.tipoCuenta}</p>
        </div>
        <Badge>{currency}</Badge>
      </div>
    </Card>
  );
}