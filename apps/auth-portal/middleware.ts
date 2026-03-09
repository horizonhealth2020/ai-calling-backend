import { NextRequest, NextResponse } from "next/server";
import { buildLoginRedirectUrl, getAuthTokenFromRequest, hasRequiredRole, verifyUser } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);

  if (!token) {
    return NextResponse.redirect(buildLoginRedirectUrl(request));
  }

  const verified = await verifyUser(token);

  if (!verified.authenticated || !verified.user) {
    return NextResponse.redirect(buildLoginRedirectUrl(request));
  }

  if (!hasRequiredRole(request.nextUrl.pathname, verified.user.role)) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/payroll/:path*", "/manager/:path*"],
};
