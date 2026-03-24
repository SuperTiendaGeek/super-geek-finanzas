import PageContainer from "@/components/layout/PageContainer";
import { StatCard, Section } from "@/components/dashboard/StatCard";
import CuentasTable from "@/components/cuentas/CuentasTable";
import { calcularSaldosPorCuenta } from "@/lib/calculations";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { getCuentas } from "@/services/cuentas";
import { getTransacciones } from "@/services/transacciones";
import { Cuenta } from "@/types/cuenta";
import { Transaccion } from "@/types/transaccion";
export const dynamic = "force-dynamic";


function pickSaldo(nombre: string, cuentas: Cuenta[], saldos: Record<string, number>) {
  const c = cuentas.find((cuenta) => cuenta.nombre === nombre);
  if (!c) return 0;
  return saldos[c.id] ?? 0;
}

export default async function CuentasPage() {
  let cuentas: Cuenta[] = [];
  let transacciones: Transaccion[] = [];

  try {
    const [cuentasResponse, transaccionesResponse] = await Promise.all([
      getCuentas(),
      getTransacciones(),
    ]);

    cuentas = cuentasResponse;
    transacciones = transaccionesResponse;
  } catch (error) {
    console.error("No se pudieron cargar las cuentas o transacciones", error);
  }

  const saldos = calcularSaldosPorCuenta(cuentas, transacciones);
  const cuentasConSaldo = cuentas.map((cuenta) => ({
    ...cuenta,
    saldo: saldos[cuenta.id] ?? cuenta.saldo ?? 0,
    moneda: cuenta.moneda ?? DEFAULT_CURRENCY,
  }));

  const totalCuentas = cuentas.length;
  const cuentasActivas = cuentasConSaldo.filter((c) => c.activa).length;
  const saldoTotalVisible = cuentasConSaldo
    .filter((c) => c.activa)
    .reduce((acc, c) => acc + (c.saldo ?? 0), 0);

  const saldoCaja = pickSaldo("Caja Registradora", cuentasConSaldo, saldos);
  const saldoIngresos = pickSaldo("SGINGRESOS", cuentasConSaldo, saldos);

  return (
    <PageContainer
      title="Cuentas"
      subtitle="Listado de cuentas con su configuración y saldo actual"
    >
      <div className="space-y-8">
        <Section title="Resumen de cuentas" description="Estado general y saldos principales">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total de cuentas" value={totalCuentas} currency="" tone="violet" />
            <StatCard label="Cuentas activas" value={cuentasActivas} currency="" tone="green" />
            <StatCard label="Saldo total visible" value={saldoTotalVisible} currency={DEFAULT_CURRENCY} tone="blue" />
            <StatCard label="Saldo Caja Registradora" value={saldoCaja} currency={DEFAULT_CURRENCY} tone="green" />
            <StatCard label="Saldo SGINGRESOS" value={saldoIngresos} currency={DEFAULT_CURRENCY} tone="blue" />
          </div>
        </Section>

        <Section title="Cuentas" description="Filtra, ordena y explora las cuentas registradas">
          <CuentasTable cuentas={cuentasConSaldo} currencyFallback={DEFAULT_CURRENCY} />
        </Section>
      </div>
    </PageContainer>
  );
}

