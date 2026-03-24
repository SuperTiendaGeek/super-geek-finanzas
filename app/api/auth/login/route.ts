import { NextResponse } from "next/server";
import { fetchAirtableRecords } from "@/lib/airtable";
import { createSessionToken, verifyPassword } from "@/lib/auth-server";
import { sessionCookieName, sessionTtlSeconds } from "@/lib/session";

const FIELD_EMAIL = "Email";
const FIELD_USUARIO = "Usuario";
const FIELD_PASSWORD = "Password Hash"; // campo exacto en Airtable
const FIELD_ROL = "Rol";
const FIELD_ACTIVO = "Activo";
const FIELD_NOMBRE = "Nombre";

const isProd = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier: string = (body.email || body.usuario || "").trim();
    const password: string = body.password || "";

    console.info("[auth/login] intento", { identifier });

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: "Credenciales incompletas" }, { status: 400 });
    }

    const table = process.env.AIRTABLE_TABLE_USUARIOS;
    if (!table) throw new Error("Falta AIRTABLE_TABLE_USUARIOS");

    let records;
    try {
      records = await fetchAirtableRecords<Record<string, unknown>>(table);
    } catch (err) {
      console.error("[auth/login] error consultando Airtable", err);
      const message = err instanceof Error ? err.message : "No se pudo consultar Airtable";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }

    const match = records.find((r) => {
      const f = (r.fields || {}) as Record<string, unknown>;
      const email = (f[FIELD_EMAIL] as string | undefined)?.toLowerCase();
      const user = (f[FIELD_USUARIO] as string | undefined)?.toLowerCase();
      return email === identifier.toLowerCase() || user === identifier.toLowerCase();
    });

    console.info("[auth/login] registro encontrado", { found: Boolean(match) });

    if (!match) {
      return NextResponse.json({ success: false, error: "Usuario o contraseña inválidos" }, { status: 401 });
    }

    const fields = (match.fields || {}) as Record<string, unknown>;
    const activo = Boolean(fields[FIELD_ACTIVO] ?? true);
    const hash = (fields[FIELD_PASSWORD] as string | undefined)?.trim() ?? "";

    console.info("[auth/login] activo/hash", { activo, hasHash: Boolean(hash) });

    if (!activo) {
      return NextResponse.json({ success: false, error: "Usuario inactivo" }, { status: 403 });
    }

    if (!hash || !verifyPassword(password, hash)) {
      return NextResponse.json({ success: false, error: "Usuario o contraseña inválidos" }, { status: 401 });
    }

    const role = (fields[FIELD_ROL] as string | undefined) ?? "consulta";
    const email = (fields[FIELD_EMAIL] as string | undefined) ?? identifier;

    let token: string;
    try {
      token = await createSessionToken({ id: match.id, email, role });
    } catch (err) {
      console.error("[auth/login] error creando sesión", err);
      const message = err instanceof Error ? err.message : "No se pudo crear la sesión";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }

    const res = NextResponse.json({
      success: true,
      user: { id: match.id, email, role, nombre: fields[FIELD_NOMBRE] },
    });

    res.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: sessionTtlSeconds,
    });

    console.info("[auth/login] set-cookie", {
      name: sessionCookieName,
      secure: isProd,
      maxAge: sessionTtlSeconds,
    });

    return res;
  } catch (error) {
    console.error("[auth/login] error inesperado", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
