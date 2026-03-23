import { getDefaultTab } from "@/lib/roles";
import type { AppRole } from "@ops/types";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const opsApiUrl = process.env.OPS_API_INTERNAL_URL || process.env.NEXT_PUBLIC_OPS_API_URL;

  if (!opsApiUrl) {
    console.error("[login] NEXT_PUBLIC_OPS_API_URL is not set");
    return Response.json({ error: "Server misconfiguration: API URL not set" }, { status: 500 });
  }

  const loginUrl = `${opsApiUrl}/api/auth/login`;
  console.log("[login] Calling ops-api:", loginUrl, "for email:", email, "password length:", password?.length);

  let response: globalThis.Response;
  try {
    response = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (err: any) {
    console.error("[login] Failed to reach ops-api at", loginUrl, ":", err.message);
    return Response.json(
      { error: `Cannot reach API server. Check that ops-api is running at ${opsApiUrl}` },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[login] ops-api returned", response.status, body);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const setCookie = response.headers.get("set-cookie");
  const user = await response.json();
  const roles: AppRole[] = user.roles ?? [];
  const token: string = user.token ?? "";

  const defaultTab = getDefaultTab(roles);
  const redirect = `${defaultTab}?session_token=${token}`;

  const headers = new Headers({ "Content-Type": "application/json" });
  if (setCookie) headers.set("Set-Cookie", setCookie);

  return new Response(JSON.stringify({ redirect }), { status: 200, headers });
}
