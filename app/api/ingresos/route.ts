import { NextResponse } from "next/server";
import { createAirtableRecords, fetchAirtableRecords } from "@/lib/airtable";
import { safeNumber } from "@/lib/helpers";

const DESTINO_FINAL_INGRESOS = "SGINGRESOS";

type MetodoMeta = {
  cuentaInicial: string | null;
  cuentaDestinoFinal: string | null;
  estado: string;
  label: string;
  creaPendiente: boolean;
};

const METODO_META: Record<string, MetodoMeta> = {
  efectivo: {
    cuentaInicial: "Caja Registradora",
    cuentaDestinoFinal: "Caja Registradora",
    estado: "Procesada",
    label: "Efectivo",
    creaPendiente: false,
  },
  transferencia: {
    cuentaInicial: DESTINO_FINAL_INGRESOS,
    cuentaDestinoFinal: DESTINO_FINAL_INGRESOS,
    estado: "Procesada",
    label: "Transferencia bancaria",
    creaPendiente: false,
  },
  datafast: {
    cuentaInicial: "DataFast",
    cuentaDestinoFinal: DESTINO_FINAL_INGRESOS,
    estado: "Pendiente",
    label: "DataFast",
    creaPendiente: true,
  },
  payphone: {
    cuentaInicial: "PayPhone",
    cuentaDestinoFinal: DESTINO_FINAL_INGRESOS,
    estado: "Pendiente",
    label: "PayPhone",
    creaPendiente: true,
  },
  paypal: {
    cuentaInicial: "PayPal",
    cuentaDestinoFinal: DESTINO_FINAL_INGRESOS,
    estado: "Pendiente",
    label: "PayPal",
    creaPendiente: true,
  },
  mixto: {
    cuentaInicial: null,
    cuentaDestinoFinal: null,
    estado: "Pendiente",
    label: "Mixto",
    creaPendiente: true,
  },
};

const CONCEPTO_LABEL: Record<string, string> = {
  venta: "Venta",
  orden_reparacion: "Orden de reparaci\u00f3n",
  reserva: "Reserva",
  otro: "Otro ingreso",
};

const TIPO_TRANSACCION_VALOR = "Ingreso";
const CONCEPTO_COMPONENTE_MIXTO = "Componente pago mixto";

type MetodoPago = keyof typeof METODO_META;
type Concepto = keyof typeof CONCEPTO_LABEL;

type PagoMixto = { metodo: MetodoPago; monto: string | number };

type IngresoPayload = {
  concepto?: Concepto;
  fecha?: string;
  metodoPago?: MetodoPago;
  referencia?: string;
  observaciones?: string;
  llevaFactura?: boolean;
  montosVenta?: { montoTotal?: string; capital?: string; utilidad?: string; iva?: string };
  montosReparacion?: {
    manoObra?: string;
    repuestoSG?: string;
    repuestoProveedorExterno?: string;
    iva?: string;
    totalReparacion?: string;
  };
  pagosMixtos?: PagoMixto[];
};

function almostZero(value: number) {
  return Math.abs(value) < 0.01;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

async function buildCuentasIndex(table: string) {
  const records = await fetchAirtableRecords<Record<string, unknown>>(table);
  const map: Record<string, string> = {};
  for (const r of records) {
    const nombre = (r.fields?.["Nombre"] as string | undefined) ?? "";
    if (r.id && nombre) map[nombre] = r.id;
  }
  return map;
}

function resolveCuentaId(nombre: string | null, index: Record<string, string>) {
  if (!nombre) return null;
  return index[nombre] ?? null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as IngresoPayload;

    const tableTx = process.env.AIRTABLE_TABLE_TRANSACCIONES;
    const tableDetalle = process.env.AIRTABLE_TABLE_DETALLE_REPARACION;
    const tableCuentas = process.env.AIRTABLE_TABLE_CUENTAS;
    const tablePagos = process.env.AIRTABLE_TABLE_DETALLE_PAGOS;
    const tablePendientes = process.env.AIRTABLE_TABLE_MOVIMIENTOS_PENDIENTES;
    if (!tableTx) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_TRANSACCIONES");
    if (!tableCuentas) throw new Error("Variable de entorno requerida faltante: AIRTABLE_TABLE_CUENTAS");

    const concepto = payload.concepto ?? "venta";
    const metodoPago = payload.metodoPago ?? "efectivo";
    const fecha = payload.fecha ?? new Date().toISOString().slice(0, 10);
    const llevaFactura = Boolean(payload.llevaFactura);

    const venta = payload.montosVenta ?? {};
    const reparacion = payload.montosReparacion ?? {};

    let total = 0;
    let capital = 0;
    let utilidad = 0;
    let iva = 0;
    let repuestoExterno = 0;

    if (concepto === "venta") {
      total = safeNumber(venta.montoTotal, 0);
      capital = safeNumber(venta.capital, 0);
      if (capital > total && !almostZero(total - capital)) {
        return NextResponse.json(
          { success: false, error: "El capital no puede ser mayor al total de la venta." },
          { status: 400 }
        );
      }

      const base = round2(total / 1.15);
      if (llevaFactura) {
        iva = round2(total - base);
        utilidad = round2(base - capital);
      } else {
        iva = 0;
        utilidad = round2(total - capital);
      }

      const check = total - (capital + utilidad + iva);
      if (!almostZero(check)) {
        return NextResponse.json(
          { success: false, error: "El total de la venta no cuadra con capital + utilidad + IVA." },
          { status: 400 }
        );
      }
    } else if (concepto === "orden_reparacion") {
      const manoObra = safeNumber(reparacion.manoObra, 0);
      const repuestoSG = safeNumber(reparacion.repuestoSG, 0);
      repuestoExterno = safeNumber(reparacion.repuestoProveedorExterno, 0);
      iva = llevaFactura ? safeNumber(reparacion.iva, 0) : 0;
      total = safeNumber(reparacion.totalReparacion, 0);
      capital = repuestoSG;
      utilidad = manoObra;
      const diff = total - (manoObra + repuestoSG + repuestoExterno + iva);
      if (!almostZero(diff)) {
        return NextResponse.json(
          { success: false, error: "La reparaci?n no cuadra con sus componentes." },
          { status: 400 }
        );
      }
    } else {
      total = safeNumber(venta.montoTotal, 0);
      capital = total;
      utilidad = 0;
      iva = 0;
    }

    const cuentasIndex = await buildCuentasIndex(tableCuentas);

    const pagosMixtos = (payload.pagosMixtos ?? []).filter((p) => p && p.metodo && p.monto !== undefined);
    let estadoTx = METODO_META[metodoPago]?.estado ?? "Procesada";
    let cuentaDestinoId: string | null = null;

    if (metodoPago === "mixto") {
      if (!tablePagos) {
        return NextResponse.json(
          { success: false, error: "Tabla de Detalle Pagos no configurada" },
          { status: 500 }
        );
      }

      if (pagosMixtos.length === 0) {
        return NextResponse.json(
          { success: false, error: "Debe incluir al menos un componente de pago mixto." },
          { status: 400 }
        );
      }

      const pagosNormalizados = pagosMixtos.map((pago) => {
        const meta = METODO_META[pago.metodo] ?? METODO_META.efectivo;
        const monto = safeNumber(pago.monto, 0);
        return { ...pago, monto, meta };
      });

      const totalMixto = pagosNormalizados.reduce((acc, p) => acc + p.monto, 0);
      const diff = total - totalMixto;
      if (!almostZero(diff)) {
        return NextResponse.json(
          { success: false, error: "La suma del pago mixto no coincide con el total del ingreso." },
          { status: 400 }
        );
      }

      const existePendiente = pagosNormalizados.some((p) => p.meta.estado === "Pendiente");
      estadoTx = existePendiente ? "Pendiente" : "Procesada";

      cuentaDestinoId = null;

      const txFields: Record<string, unknown> = {
        Fecha: fecha,
        "Tipo de Transacci\u00f3n": TIPO_TRANSACCION_VALOR,
        Concepto: CONCEPTO_LABEL[concepto] ?? concepto,
        Estado: estadoTx,
        "M\u00e9todo de Pago": METODO_META.mixto.label,
        "Monto Total": total,
        Capital: capital,
        Utilidad: utilidad,
        IVA: iva,
        "Repuesto Proveedor Externo": repuestoExterno,
        "Lleva Factura": llevaFactura,
        "Referencia Externa": payload.referencia ?? "",
        "Descripci\u00f3n / Observaciones": payload.observaciones ?? "",
      };

      const [txRecord] = await createAirtableRecords(tableTx, [txFields]);
      if (!txRecord?.id) {
        throw new Error("Airtable no devolvi\u00f3 ID de transacci\u00f3n");
      }

      const pagoRecords = pagosNormalizados.map((pago) => {
        const cuentaInicialId = resolveCuentaId(pago.meta.cuentaInicial, cuentasIndex);
        const cuentaFinalId = resolveCuentaId(pago.meta.cuentaDestinoFinal, cuentasIndex);
        return {
          "Transacci\u00f3n": [txRecord.id],
          "M\u00e9todo de Pago": pago.meta.label,
          "Monto": pago.monto,
          "Cuenta Receptora Inicial": cuentaInicialId ? [cuentaInicialId] : undefined,
          "Estado del Pago": pago.meta.estado,
          "Es Pago Pendiente": pago.meta.estado === "Pendiente",
          "Fecha de Pago": fecha,
          "Cuenta Destino Final": cuentaFinalId ? [cuentaFinalId] : undefined,
          Observaciones: payload.observaciones ?? "",
        } as Record<string, unknown>;
      });

      const pagosCreados = await createAirtableRecords(tablePagos, pagoRecords);
      if (!pagosCreados.length) {
        throw new Error("No se pudo crear el detalle de pagos");
      }

      const componentTxFields = pagosNormalizados
        .filter((p) => p.meta.estado === "Procesada")
        .map((pago) => {
          const cuentaFinalId = resolveCuentaId(pago.meta.cuentaDestinoFinal, cuentasIndex);
          if (!cuentaFinalId) return null;
          return {
            Fecha: fecha,
            "Tipo de Transacci\u00f3n": TIPO_TRANSACCION_VALOR,
            Concepto: `${CONCEPTO_COMPONENTE_MIXTO} - ${pago.meta.label}`,
            Estado: pago.meta.estado,
            "Cuenta Destino": [cuentaFinalId],
            "M\u00e9todo de Pago": pago.meta.label,
            "Monto Total": pago.monto,
            Capital: pago.monto,
            Utilidad: 0,
            IVA: 0,
            "Repuesto Proveedor Externo": 0,
            "Lleva Factura": llevaFactura,
            "Referencia Externa": payload.referencia ?? txRecord.id,
            "Descripci\u00f3n / Observaciones": payload.observaciones ?? "",
          } as Record<string, unknown>;
        })
        .filter(Boolean) as Record<string, unknown>[];

      if (componentTxFields.length) {
        await createAirtableRecords(tableTx, componentTxFields);
      }

      if (tablePendientes) {
        const pendientes = pagosNormalizados
          .filter((p) => p.meta.estado === "Pendiente")
          .map((pago) => {
            const cuentaFinalId = resolveCuentaId(pago.meta.cuentaDestinoFinal, cuentasIndex);
            return {
              "Transacci\u00f3n Relacionada": [txRecord.id],
              Medio: pago.meta.label,
              Fecha: fecha,
              "Monto Esperado": pago.monto,
              Estado: "Pendiente",
              "Cuenta Destino Final": cuentaFinalId ? [cuentaFinalId] : undefined,
              Observaciones: payload.observaciones ?? "",
            } as Record<string, unknown>;
          });

        if (pendientes.length) {
          await createAirtableRecords(tablePendientes, pendientes);
        }
      }

      if (concepto === "orden_reparacion" && tableDetalle) {
        const detalleFields: Record<string, unknown> = {
          "Transacci\u00f3n": [txRecord.id],
          "Mano de Obra": utilidad,
          "Repuesto Proporcionado por SG": capital,
          "Repuesto Proveedor Externo": repuestoExterno,
          "Lleva IVA": llevaFactura,
          "IVA Calculado": iva,
          Notas: payload.observaciones ?? "",
        };

        await createAirtableRecords(tableDetalle, [detalleFields]);
      }

      return NextResponse.json({ success: true, data: { transaccionId: txRecord.id } });
    }

    const meta = METODO_META[metodoPago];
    const cuentaFinalId = resolveCuentaId(meta.cuentaDestinoFinal, cuentasIndex);
    const esPendiente = meta.creaPendiente;
    cuentaDestinoId = esPendiente ? null : cuentaFinalId;
    estadoTx = meta.estado;

    const txFields: Record<string, unknown> = {
      Fecha: fecha,
      "Tipo de Transacci\u00f3n": TIPO_TRANSACCION_VALOR,
      Concepto: CONCEPTO_LABEL[concepto] ?? concepto,
      Estado: estadoTx,
      "Cuenta Destino": cuentaDestinoId ? [cuentaDestinoId] : undefined,
      "M\u00e9todo de Pago": meta.label,
      "Monto Total": total,
      Capital: capital,
      Utilidad: utilidad,
      IVA: iva,
      "Repuesto Proveedor Externo": repuestoExterno,
      "Lleva Factura": llevaFactura,
      "Referencia Externa": payload.referencia ?? "",
      "Descripci\u00f3n / Observaciones": payload.observaciones ?? "",
    };

    const [txRecord] = await createAirtableRecords(tableTx, [txFields]);
    if (!txRecord?.id) {
      throw new Error("Airtable no devolvi\u00f3 ID de transacci\u00f3n");
    }

    if (esPendiente) {
      if (!tablePendientes) {
        return NextResponse.json(
          { success: false, error: "Tabla de movimientos pendientes no configurada" },
          { status: 500 }
        );
      }
      const cuentaPendienteId = resolveCuentaId(meta.cuentaDestinoFinal, cuentasIndex);
      const pendiente = {
        "Transacci\u00f3n Relacionada": [txRecord.id],
        Medio: meta.label,
        Fecha: fecha,
        "Monto Esperado": total,
        Estado: "Pendiente",
        "Cuenta Destino Final": cuentaPendienteId ? [cuentaPendienteId] : undefined,
        Observaciones: payload.observaciones ?? "",
      } as Record<string, unknown>;

      await createAirtableRecords(tablePendientes, [pendiente]);
    }

    if (concepto === "orden_reparacion" && tableDetalle) {
      const detalleFields: Record<string, unknown> = {
        "Transacci\u00f3n": [txRecord.id],
        "Mano de Obra": utilidad,
        "Repuesto Proporcionado por SG": capital,
        "Repuesto Proveedor Externo": repuestoExterno,
        "Lleva IVA": llevaFactura,
        "IVA Calculado": iva,
        Notas: payload.observaciones ?? "",
      };

      await createAirtableRecords(tableDetalle, [detalleFields]);
    }

    return NextResponse.json({ success: true, data: { transaccionId: txRecord.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
