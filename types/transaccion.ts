import { ID, ISODateString, TipoTransaccion, EstadoTransaccion } from "@/types/common";

export interface Transaccion {
  id: ID;
  idTransaccion?: string;
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
  creadoPor?: string;
  fechaRegistro?: string;
  idTransaccionAirtable?: string;
}
