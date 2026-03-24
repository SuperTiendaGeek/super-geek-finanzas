import { Transaccion } from "@/types/transaccion";

type TransaccionesResponse = { success: boolean; data?: Transaccion[]; error?: string };
type TransaccionDetalleResponse = {
  success: boolean;
  data?: { transaccion?: Transaccion | null; detalleReparacion?: Record<string, unknown> | null; pendientes?: Record<string, unknown>[] };
  error?: string;
};

function resolveApiUrl(path: string) {
  if (typeof window !== "undefined") return path;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return `${base}${path}`;
}

async function fetchJson<T>(url: string, label: string) {
  const res = await fetch(url, { cache: "no-store" });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("application/json")) {
    const body = await res.text();
    console.error(`[${label}] respuesta no json`, {
      url,
      status: res.status,
      contentType,
      body: body.slice(0, 200),
    });
    throw new Error(`Respuesta inesperada de ${url} status ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getTransacciones(): Promise<Transaccion[]> {
  try {
    const url = resolveApiUrl("/api/transacciones");
    const payload = await fetchJson<TransaccionesResponse>(url, "getTransacciones");

    if (!payload.success || !Array.isArray(payload.data)) {
      throw new Error("Respuesta de transacciones invalida");
    }

    return payload.data;
  } catch (error) {
    console.error("Error en getTransacciones", error);
    return [];
  }
}

export async function getTransaccionDetalle(id: string) {
  try {
    const url = resolveApiUrl(`/api/transacciones/${id}`);
    const payload = await fetchJson<TransaccionDetalleResponse>(url, "getTransaccionDetalle");

    if (payload.success === false && payload.error === "Transacción no encontrada") {
      const all = await getTransacciones();
      const match = all.find((tx) => tx.id === id || tx.idTransaccion === id);
      if (match) return { transaccion: match, detalleReparacion: null, pendientes: [] };
      return { transaccion: null, detalleReparacion: null, pendientes: [] };
    }

    if (!payload.success || !payload.data) {
      throw new Error(payload.error ?? "Respuesta invalida de transaccion");
    }
    return payload.data;
  } catch (error) {
    console.error("Error en getTransaccionDetalle", error);
    return { transaccion: null, detalleReparacion: null, pendientes: [] };
  }
}
