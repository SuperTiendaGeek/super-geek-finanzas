import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { signSession, sessionTtlSeconds } from "@/lib/session";

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

export async function createSessionToken(user: { id: string; email: string; role: string }) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  };
  return signSession(payload);
}
