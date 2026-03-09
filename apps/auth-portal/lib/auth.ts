import { NextRequest } from "next/server";

export type AuthenticatedUser = {
  username: string;
  role: string;
};

type VerifyResponse = {
  authenticated: boolean;
  user?: AuthenticatedUser;
};

const AUTH_COOKIE_NAME = "ops_session";

const ROLE_ACCESS: Record<string, string[]> = {
  "/owner": ["owner", "super_admin"],
  "/payroll": ["payroll", "super_admin"],
  "/manager": ["manager", "super_admin"],
};

export function getAuthTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function verifyUser(token: string): Promise<VerifyResponse> {
  const authPortalUrl = process.env.AUTH_PORTAL_URL;
  if (!authPortalUrl) {
    return { authenticated: false };
  }

  try {
    const response = await fetch(`${authPortalUrl}/api/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { authenticated: false };
    }

    const data = (await response.json()) as VerifyResponse;
    if (!data.authenticated || !data.user?.username || !data.user?.role) {
      return { authenticated: false };
    }

    return data;
  } catch {
    return { authenticated: false };
  }
}

export function hasRequiredRole(pathname: string, role: string): boolean {
  const pathPrefix = Object.keys(ROLE_ACCESS).find((prefix) => pathname.startsWith(prefix));
  if (!pathPrefix) {
    return true;
  }

  return ROLE_ACCESS[pathPrefix].includes(role);
}

export function buildLoginRedirectUrl(request: NextRequest): string {
  const authPortalUrl = process.env.AUTH_PORTAL_URL;
  if (!authPortalUrl) {
    throw new Error("AUTH_PORTAL_URL is not configured");
  }

  const loginUrl = new URL(`${authPortalUrl}/login`);
  loginUrl.searchParams.set("redirect", request.url);
  return loginUrl.toString();
}
