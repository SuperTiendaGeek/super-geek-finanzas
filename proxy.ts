import { NextRequest, NextResponse } from "next/server";
import { verifySession, sessionCookieName } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/favicon.ico", "/robots.txt"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // No interceptar APIs públicas ni privadas: /api/ se deja pasar directo
  if (
    isPublic(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(sessionCookieName)?.value;
  console.info("[proxy] cookie", { name: sessionCookieName, present: Boolean(token) });
  const session = await verifySession(token);
  console.info("[proxy] session", { valid: Boolean(session) });

  if (session) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
