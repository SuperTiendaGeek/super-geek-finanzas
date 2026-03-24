// Helper de servidor para obtener y crear registros en Airtable.
// No usar en componentes cliente.

interface AirtableErrorResponse {
  error?: { type?: string; message?: string };
}

export interface AirtableRecord<T> {
  id: string;
  createdTime?: string;
  fields: T;
}

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

function getEnvVar(name: "AIRTABLE_TOKEN" | "AIRTABLE_BASE_ID") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno requerida faltante: ${name}`);
  }
  return value;
}

// Obtiene todos los registros de una tabla (paginando) en servidor.
export async function fetchAirtableRecords<T>(tableName: string): Promise<AirtableRecord<T>[]> {
  if (typeof window !== "undefined") {
    throw new Error("fetchAirtableRecords solo debe ejecutarse en el servidor.");
  }

  const token = getEnvVar("AIRTABLE_TOKEN");
  const baseId = getEnvVar("AIRTABLE_BASE_ID");
  const table = encodeURIComponent(tableName);

  let offset: string | undefined;
  const all: AirtableRecord<T>[] = [];

  do {
    const url = new URL(`${AIRTABLE_API_URL}/${baseId}/${table}`);
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    const data = (await response.json()) as
      | { records?: AirtableRecord<T>[]; offset?: string }
      | AirtableErrorResponse;

    if (!response.ok) {
      const message = (data as AirtableErrorResponse).error?.message;
      throw new Error(
        message ?? `Airtable respondio con estado ${response.status} (base=${baseId} tabla=${tableName})`
      );
    }

    const chunk = (data as { records?: AirtableRecord<T>[] }).records ?? [];
    all.push(...chunk);
    offset = (data as { offset?: string }).offset;
  } while (offset);

  return all;
}

// Obtiene un registro especifico por ID en Airtable. Solo servidor.
export async function fetchAirtableRecordById<T>(
  tableName: string,
  recordId: string
): Promise<AirtableRecord<T> | null> {
  if (typeof window !== "undefined") {
    throw new Error("fetchAirtableRecordById solo debe ejecutarse en el servidor.");
  }

  const token = getEnvVar("AIRTABLE_TOKEN");
  const baseId = getEnvVar("AIRTABLE_BASE_ID");
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (response.status === 404) return null;

  const data = (await response.json()) as AirtableRecord<T> | AirtableErrorResponse;

  if (!response.ok) {
    const message = (data as AirtableErrorResponse).error?.message;
    throw new Error(message ?? `Airtable respondio con estado ${response.status}`);
  }

  return data as AirtableRecord<T>;
}

// Crea uno o varios registros en Airtable. Solo para uso en servidor.
export async function createAirtableRecords<T>(
  tableName: string,
  records: Record<string, unknown>[]
): Promise<AirtableRecord<T>[]> {
  if (typeof window !== "undefined") {
    throw new Error("createAirtableRecords solo debe ejecutarse en el servidor.");
  }

  const token = getEnvVar("AIRTABLE_TOKEN");
  const baseId = getEnvVar("AIRTABLE_BASE_ID");
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}`;

  const payload = {
    records: records.map((fields) => ({ fields })),
    typecast: true,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { records?: AirtableRecord<T>[] } | AirtableErrorResponse;

  if (!response.ok) {
    const message = (data as AirtableErrorResponse).error?.message;
    throw new Error(message ?? `Airtable respondio con estado ${response.status}`);
  }

  return (data as { records: AirtableRecord<T>[] }).records ?? [];
}

// Actualiza un registro en Airtable por ID. Solo servidor.
export async function updateAirtableRecord<T>(
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord<T>> {
  if (typeof window !== "undefined") {
    throw new Error("updateAirtableRecord solo debe ejecutarse en el servidor.");
  }

  const token = getEnvVar("AIRTABLE_TOKEN");
  const baseId = getEnvVar("AIRTABLE_BASE_ID");
  const url = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}`;

  const payload = {
    records: [
      {
        id: recordId,
        fields,
      },
    ],
    typecast: true,
  };

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { records?: AirtableRecord<T>[] } | AirtableErrorResponse;

  if (!response.ok) {
    const message = (data as AirtableErrorResponse).error?.message;
    throw new Error(message ?? `Airtable respondio con estado ${response.status}`);
  }

  const rec = (data as { records?: AirtableRecord<T>[] }).records?.[0];
  if (!rec) throw new Error("Airtable no devolvio el registro actualizado");
  return rec;
}
