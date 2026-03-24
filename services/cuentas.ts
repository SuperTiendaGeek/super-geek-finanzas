import { Cuenta } from "@/types/cuenta";
import { Transaccion } from "@/types/transaccion";

type CuentaDetalleResponse = {
  success: boolean;
  data?: {
    cuenta: Cuenta;
    saldoActual: number;
    totalRecibido: number;
    totalEnviado: number;
    totalEgresado: number;
    cantidadTransacciones: number;
    transacciones: Transaccion[];
  };
  error?: string;
};

type CuentasResponse = {
  success: boolean;
  data?: Cuenta[];
  error?: string;
};

function resolveApiUrl(path: string) {
  if (typeof window !== "undefined") return path;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return `${base}${path}`;
}

async function fetchJson<T>(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("application/json")) {
    const body = await res.text();
    console.error("[getCuentas] respuesta no json", {
      url,
      status: res.status,
      contentType,
      body: body.slice(0, 200),
    });
    throw new Error(`Respuesta inesperada de ${url} status ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getCuentas(): Promise<Cuenta[]> {
  try {
    const url = resolveApiUrl("/api/cuentas");
    const payload = await fetchJson<CuentasResponse>(url);

    if (!payload.success || !Array.isArray(payload.data)) {
      throw new Error("Respuesta de cuentas invalida");
    }

    return payload.data;
  } catch (error) {
    console.error("Error en getCuentas", error);
    return [];
  }
}

export async function getCuentaDetalle(id: string) {
  try {
    const encodedId = encodeURIComponent(id);
    const url = resolveApiUrl(`/api/cuentas/${encodedId}`);
    const payload = await fetchJson<CuentaDetalleResponse>(url);
    if (!payload.success || !payload.data) {
      throw new Error(payload.error ?? "Respuesta invalida de cuenta");
    }
    return payload.data;
  } catch (error) {
    console.error("Error en getCuentaDetalle", error);
    return null;
  }
}
