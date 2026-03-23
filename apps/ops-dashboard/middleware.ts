import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@ops/auth";
import { TAB_ROLES } from "@/lib/roles";

// MUST use Node.js runtime — Edge Runtime cannot access runtime env vars (AUTH_JWT_SECRET)
export const runtime = "nodejs";

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

  // If session_token in URL params: set cookie but let the page load WITH the token
  // in the URL so client-side captureTokenFromUrl() can save it to localStorage.
  // The client code will clean the URL itself via history.replaceState.
  if (searchParams.has("session_token")) {
    const response = NextResponse.next();
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
