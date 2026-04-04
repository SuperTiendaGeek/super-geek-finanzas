import { ID, ISODateString, TipoTransaccion, EstadoTransaccion } from "@/types/common";

export interface Transaccion {
  recordId: ID; // Airtable record id (clave primaria para rutas y updates)
  id?: ID; // alias legacy; siempre igual a recordId mientras convivamos con código viejo
  idTransaccion?: string; // autonumérico/visible en Airtable
  fecha: ISODateString;
  tipoTransaccion: TipoTransaccion;
  tipoFlujo?: string;
  concepto: string;
  estado: EstadoTransaccion;
  // IDs de cuenta (para calculos)
  cuentaOrigenId?: ID | null;
  cuentaDestinoId?: ID | null;
  // Nombres legibles de cuenta (para UI)
  cuentaOrigen?: string | null;
  cuentaDestino?: string | null;
  metodoPago?: string;
  montoTotal: number;
  capital?: number;
  utilidad?: number;
  iva?: number;
  repuestoProveedorExterno?: number;
  llevaFactura?: boolean;
  comision?: number;
  montoNetoRecibido?: number;
  descripcionObservaciones?: string;
  descripcion?: string;
  referenciaExterna?: string;
  esDistribucionContable?: boolean;
  componenteDistribuido?: string;
  montoDistribuido?: number;
  estadoPrevio?: string;
  motivoAnulacion?: string;
  fechaAnulacion?: string;
  anuladaPor?: string;
  fechaRehabilitacion?: string;
  rehabilitadaPor?: string;
  creadoPor?: string;
  fechaRegistro?: string;
  idTransaccionAirtable?: string;
}
