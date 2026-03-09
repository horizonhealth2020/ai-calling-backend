import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authPortalUrl = process.env.AUTH_PORTAL_URL;
  if (!authPortalUrl) {
    return new NextResponse("AUTH_PORTAL_URL is not configured", { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const redirectUrl = new URL(`${authPortalUrl}/login`);
  redirectUrl.searchParams.set("redirect", requestUrl.origin);

  return NextResponse.redirect(redirectUrl);
}
