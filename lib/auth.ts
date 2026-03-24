import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

type SessionPayload = {
  userId: string;
  email: string;
  role: string;
  exp: number; // unix seconds
};

const SESSION_COOKIE = "sg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET es requerido para firmar sesiones");
  return secret;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const hash = Buffer.from(hashHex, "hex");
  const derived = scryptSync(password, salt, hash.length);
  return timingSafeEqual(hash, derived);
}

function sign(payload: SessionPayload): string {
  const secret = getAuthSecret();
  const data = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(data).digest("hex");
  return Buffer.from(`${data}.${sig}`).toString("base64url");
}

function unsign(token: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [data, sig] = decoded.split(".");
    if (!data || !sig) return null;
    const expected = createHmac("sha256", getAuthSecret()).update(data).digest("hex");
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(data) as SessionPayload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionCookie(user: { id: string; email: string; role: string }) {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const token = sign(payload);
  return token;
}

export function parseSession(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return unsign(token);
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
}
