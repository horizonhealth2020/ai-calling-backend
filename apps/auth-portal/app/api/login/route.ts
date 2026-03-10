export async function POST(req: Request) {
  const { email, password } = await req.json();

  const response = await fetch(`${process.env.NEXT_PUBLIC_OPS_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const setCookie = response.headers.get("set-cookie");
  const user = await response.json();
  const roles: string[] = user.roles ?? [];
  const token: string = user.token ?? "";

  // Map roles to their dashboard URLs
  const ROLE_DASHBOARDS: Record<string, string | undefined> = {
    SUPER_ADMIN: process.env.OWNER_DASHBOARD_URL,
    OWNER_VIEW: process.env.OWNER_DASHBOARD_URL,
    MANAGER: process.env.MANAGER_DASHBOARD_URL,
    PAYROLL: process.env.PAYROLL_DASHBOARD_URL,
  };

  // Which dashboards can this user access?
  const dashboardRoles = roles.filter(r => ROLE_DASHBOARDS[r]);

  let destination: string;
  if (dashboardRoles.length === 1) {
    destination = ROLE_DASHBOARDS[dashboardRoles[0]]!;
  } else {
    // Multiple roles or none — show the picker
    const base = process.env.AUTH_PORTAL_URL || req.url;
    destination = new URL("/landing", base).toString();
  }

  const url = new URL(destination);
  if (token) url.searchParams.set("session_token", token);
  if (dashboardRoles.length > 1) url.searchParams.set("roles", dashboardRoles.join(","));

  const headers = new Headers({ "Content-Type": "application/json" });
  if (setCookie) headers.set("Set-Cookie", setCookie);

  return new Response(JSON.stringify({ redirect: url.toString() }), { status: 200, headers });
}
