export type ID = string;
export type ISODateString = string;

export type TipoCuenta = string; // Compatible con valores de Airtable
export type TipoTransaccion = "ingreso" | "egreso" | "transferencia" | string;
export type EstadoTransaccion = "pendiente" | "procesada" | "cancelada" | string;
export type EstadoPendiente = "abierto" | "en_progreso" | "cerrado" | string;