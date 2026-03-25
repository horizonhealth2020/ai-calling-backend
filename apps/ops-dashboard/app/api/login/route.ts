import { getDefaultTab } from "@/lib/roles";
import type { AppRole } from "@ops/types";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const opsApiUrl = (process.env.OPS_API_INTERNAL_URL || process.env.NEXT_PUBLIC_OPS_API_URL || "").trim();

  if (!opsApiUrl) {
    console.error("[login] No API URL configured");
    return Response.json({ error: "Server misconfiguration: API URL not set" }, { status: 500 });
  }

  const loginUrl = `${opsApiUrl}/api/auth/login`;
  console.log("[login] Calling:", loginUrl, "email:", email, "pwLen:", password?.length);

  let response: globalThis.Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    response = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log("[login] Response status:", response.status);
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "Error";
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[login] FETCH ERROR:", name, message);
    return Response.json(
      { error: `Cannot reach API server (${name}: ${message})` },
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
