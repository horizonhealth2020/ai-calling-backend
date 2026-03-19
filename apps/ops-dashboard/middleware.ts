import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@ops/auth";
import { TAB_ROLES } from "@/lib/roles";

const AUTH_COOKIE_NAME = "ops_session";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Extract token from: cookie, Authorization header, or session_token query param
  let token: string | null = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token) {
    token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
  }
  if (!token) {
    token = searchParams.get("session_token");
  }

  // No token -> redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Verify token
  const user = verifySessionToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Role check: extract first path segment
  const pathPrefix = "/" + pathname.split("/").filter(Boolean)[0];
  const allowedRoles = TAB_ROLES[pathPrefix];
  if (allowedRoles && !allowedRoles.some(r => user.roles.includes(r))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If session_token in URL params: capture into cookie and redirect without param
  if (searchParams.has("session_token")) {
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete("session_token");

    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/manager/:path*", "/payroll/:path*", "/owner/:path*", "/cs/:path*"],
};
