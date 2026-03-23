import { NextRequest, NextResponse } from "next/server";
import { TAB_ROLES } from "@/lib/roles";

const AUTH_COOKIE_NAME = "ops_session";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Extract token from: cookie or session_token query param
  let token: string | null = null;
  token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
  if (!token) {
    token = searchParams.get("session_token");
  }

  // No token -> redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Decode token roles without verification (Edge Runtime can't access secrets)
  // Real auth is enforced by ops-api on every API call
  let roles: string[] = [];
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      roles = payload.roles ?? [];
    }
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Role check: extract first path segment
  const pathPrefix = "/" + pathname.split("/").filter(Boolean)[0];
  const allowedRoles = TAB_ROLES[pathPrefix];
  if (allowedRoles && !allowedRoles.some((r: string) => roles.includes(r))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If session_token in URL: set cookie and let page load (client captures token too)
  if (searchParams.has("session_token")) {
    const response = NextResponse.next();
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/manager/:path*", "/payroll/:path*", "/owner/:path*", "/cs/:path*"],
};
