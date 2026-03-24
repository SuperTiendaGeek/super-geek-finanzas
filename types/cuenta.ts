import { ID, TipoCuenta } from "@/types/common";

export interface Cuenta {
  id: ID;
  nombre: string;
  tipoCuenta: TipoCuenta;
  permiteIngresos: boolean;
  permiteEgresos: boolean;
  permiteTransferencias: boolean;
  activa: boolean;
  saldo?: number;
  moneda?: string;
}