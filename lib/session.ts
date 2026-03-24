// Edge-safe session signing / verification (Web Crypto only)
// JWT-like structure: base64url(header).base64url(payload).base64url(signature)

const SESSION_COOKIE = "sg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET es requerido para sesiones (define AUTH_SECRET en .env.local)");
  }
  return textEncoder.encode(secret);
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return new Uint8Array(Buffer.from(base64, "base64"));
}

async function hmacSign(data: string, secret: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const dataBytes = textEncoder.encode(data);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return toBase64Url(new Uint8Array(sig));
}

async function hmacVerify(data: string, signatureB64Url: string, secret: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", secret.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sigBytes = fromBase64Url(signatureB64Url);
  const dataBytes = textEncoder.encode(data);
  return crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, dataBytes);
}

export async function signSession(payload: Record<string, unknown>) {
  const secret = getSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const h = toBase64Url(textEncoder.encode(JSON.stringify(header)));
  const p = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const toSign = `${h}.${p}`;
  const sig = await hmacSign(toSign, secret);
  const token = `${h}.${p}.${sig}`;
  console.info("[session] sign", { hasSecret: true, tokenLen: token.length, exp: (payload as any).exp });
  return token;
}

export async function verifySession(token?: string) {
  if (!token) {
    console.info("[session] verify", { reason: "no token" });
    return null;
  }
  try {
    const parts = token.split(".");
    console.info("[session] verify parts", { count: parts.length, len0: parts[0]?.length, len1: parts[1]?.length, len2: parts[2]?.length });
    if (parts.length !== 3) {
      console.info("[session] verify", { reason: "malformed (expected 3 parts)" });
      return null;
    }
    const [h, p, s] = parts;
    const secret = getSecret();
    const toSign = `${h}.${p}`;
    const valid = await hmacVerify(toSign, s, secret);
    if (!valid) {
      console.info("[session] verify", { reason: "hmac invalid" });
      return null;
    }
    const payloadJson = textDecoder.decode(fromBase64Url(p));
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.info("[session] verify", { reason: "expired" });
      return null;
    }
    console.info("[session] verify", { ok: true, exp: payload.exp });
    return payload;
  } catch (err) {
    console.error("[session] verifySession error", err);
    return null;
  }
}

export const sessionCookieName = SESSION_COOKIE;
export const sessionTtlSeconds = SESSION_TTL_SECONDS;

