import { ID, ISODateString } from "@/types/common";

export interface Pendiente {
  id: ID;
  transaccionRelacionadaId?: ID | null;
  medio: string;
  fecha: ISODateString;
  fechaEstimada?: ISODateString | null;
  montoEsperado: number;
  comisionEstimada?: number | null;
  comisionReal?: number | null;
  montoRealAcreditado?: number | null;
  estado: string;
  cuentaDestinoFinalId?: ID | null;
  cuentaDestinoFinalNombre?: string | null;
  observaciones?: string | null;
}
