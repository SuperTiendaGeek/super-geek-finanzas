import { Pendiente } from "@/types/pendiente";

interface PendientesResponse {
  success: boolean;
  data?: Pendiente[];
  error?: string;
}

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

export async function getPendientes(): Promise<Pendiente[]> {
  try {
    const url = resolveApiUrl("/api/pendientes");
    const payload = await fetchJson<PendientesResponse>(url, "getPendientes");

    if (!payload.success || !Array.isArray(payload.data)) {
      throw new Error("Respuesta de pendientes invalida");
    }

    return payload.data;
  } catch (error) {
    console.error("Error en getPendientes", error);
    return [];
  }
}
