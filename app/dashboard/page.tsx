import PageContainer from "@/components/layout/PageContainer";
import { StatCard, Section } from "@/components/dashboard/StatCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import AlertsPanel from "@/components/dashboard/AlertsPanel";
import Card from "@/components/ui/Card";
import DistribucionPanel from "@/components/distribucion/DistribucionPanel";
import { getCuentas } from "@/services/cuentas";
import { getTransacciones } from "@/services/transacciones";
import { calcularDistribucionContable } from "@/services/distribucion";
import { getPendientes } from "@/services/pendientes";
import { calcularSaldosPorCuenta } from "@/lib/calculations";
import { formatCurrency } from "@/lib/helpers";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { Cuenta } from "@/types/cuenta";
import { Transaccion } from "@/types/transaccion";
export const dynamic = "force-dynamic";

function normalize(value: string | undefined | null) {
  return (value ?? "").toLowerCase();
}

function isPending(tx: Transaccion) {
  const e = normalize(tx.estado);
  return e.includes("pend");
}

function isCanceled(tx: Transaccion) {
  const e = normalize(tx.estado);
  return e.includes("anul") || e.includes("cancel");
}

function isConfirmed(tx: Transaccion) {
  const e = normalize(tx.estado);
  if (!e) return true;
  return !isPending(tx) && !isCanceled(tx);
}

function isIngreso(tx: Transaccion) {
  return normalize(tx.tipoTransaccion).includes("ingreso");
}

function isEgreso(tx: Transaccion) {
  return normalize(tx.tipoTransaccion).includes("egreso");
}

function isAcreditacion(tx: Transaccion) {
  return normalize(tx.tipoFlujo).includes("acredit");
}

const PENDING_METHODS = ["datafast", "payphone", "paypal", "mixto"];

function sumAmounts(list: Transaccion[], predicate: (t: Transaccion) => boolean) {
  return list.filter(predicate).reduce((acc, t) => acc + (t.montoTotal || 0), 0);
}

function inCurrentMonth(fecha: string) {
  if (!fecha) return false;
  const d = new Date(fecha);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function pickSaldoPorNombre(nombre: string, cuentas: Cuenta[], saldos: Record<string, number>) {
  const cuenta = cuentas.find((c) => c.nombre === nombre);
  if (!cuenta) return 0;
  return saldos[cuenta.id] ?? 0;
}

export default async function DashboardPage() {
  let cuentas: Cuenta[] = [];
  let transacciones: Transaccion[] = [];
  let pendientes = [] as Awaited<ReturnType<typeof getPendientes>>;

  try {
    const [cRes, tRes, pRes] = await Promise.all([getCuentas(), getTransacciones(), getPendientes()]);
    cuentas = cRes;
    transacciones = tRes;
    pendientes = pRes;
  } catch (error) {
    console.error("No se pudieron cargar datos para el dashboard", error);
  }

  const saldos = calcularSaldosPorCuenta(cuentas, transacciones);
  const cuentasActivas = cuentas.filter((c) => c.activa);
  const saldosActivos = cuentasActivas.reduce((acc, c) => acc + (saldos[c.id] ?? 0), 0);

  const ingresosMes = sumAmounts(transacciones, (t) => {
    if (!isConfirmed(t) || !inCurrentMonth(t.fecha) || t.esDistribucionContable) return false;
    const metodo = normalize(t.metodoPago);
    const esPendienteMedio = PENDING_METHODS.includes(metodo);
    if (isAcreditacion(t)) return true; // neto acreditado
    if (isIngreso(t) && !esPendienteMedio) return true; // ingresos directos
    return false;
  });

  const egresosMes = sumAmounts(transacciones, (t) => isConfirmed(t) && isEgreso(t) && inCurrentMonth(t.fecha));
  const pendientePorAcreditar = pendientes.reduce((acc, p) => acc + (p.montoEsperado ?? 0), 0);

  const saldoCaja = pickSaldoPorNombre("Caja Registradora", cuentas, saldos);
  const saldoIngresos = pickSaldoPorNombre("SGINGRESOS", cuentas, saldos);

  const distribucion = calcularDistribucionContable(transacciones);

  const transaccionesOrdenadas = [...transacciones].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const alerts: string[] = [];
  const pendientesCount = pendientes.length;
  if (pendientesCount) alerts.push(`${pendientesCount} pago(s) pendiente(s) por acreditar.`);

  const anuladas = transacciones.filter((t) => isCanceled(t)).slice(0, 3);
  if (anuladas.length) alerts.push(`Hay ${anuladas.length} movimiento(s) anulado(s) reciente(s).`);

  const distribucionItems = [
    ["Capital", distribucion.capital],
    ["Utilidad", distribucion.utilidad],
    ["IVA", distribucion.iva],
  ] as const;

  return (
    <PageContainer title="Dashboard" subtitle="Visión general de tus finanzas" actions={null}>
      <div className="space-y-8">
        <Section title="Resumen principal" description="Indicadores claves del mes y saldos principales">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Ingresos del mes" value={ingresosMes} currency={DEFAULT_CURRENCY} tone="green" />
            <StatCard label="Egresos del mes" value={egresosMes} currency={DEFAULT_CURRENCY} tone="red" />
            <StatCard label="Pendiente por acreditar" value={pendientePorAcreditar} currency={DEFAULT_CURRENCY} tone="amber" />
            <StatCard label="Saldo Caja Registradora" value={saldoCaja} currency={DEFAULT_CURRENCY} tone="blue" />
            <StatCard label="Saldo SGINGRESOS" value={saldoIngresos} currency={DEFAULT_CURRENCY} tone="blue" />
            <StatCard label="Saldo total visible" value={saldosActivos} currency={DEFAULT_CURRENCY} tone="violet" />
          </div>
        </Section>

        <Section title="Distribución contable" description="Generado, distribuido y pendiente por componente">
          <DistribucionPanel distribucion={distribucion} saldoIngresos={saldoIngresos} currency={DEFAULT_CURRENCY} />
        </Section>

        <Section title="Actividad reciente" description="Últimas transacciones registradas">
          <RecentActivity transacciones={transaccionesOrdenadas} currency={DEFAULT_CURRENCY} limit={8} />
        </Section>

        <Section title="Alertas y atención" description="Pagos pendientes o movimientos a revisar">
          <AlertsPanel
            title="Alertas"
            items={alerts.map((a, idx) => (
              <span key={idx}>{a}</span>
            ))}
          />
        </Section>

        <Section title="Cuentas" description="Saldos actuales por cuenta">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cuentasActivas.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-600">Aún no hay cuentas disponibles.</p>
              </Card>
            ) : (
              cuentasActivas.map((cuenta) => (
                <Card key={cuenta.id}>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{cuenta.nombre}</p>
                    <p className="text-xl font-semibold text-slate-900">{formatCurrency(saldos[cuenta.id] ?? 0, cuenta.moneda ?? DEFAULT_CURRENCY)}</p>
                    <p className="text-xs text-slate-500">{cuenta.tipoCuenta}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
