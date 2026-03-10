export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email"));
  const password = String(form.get("password"));
  const response = await fetch(`${process.env.NEXT_PUBLIC_OPS_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return new Response("Invalid credentials", { status: 401 });

  // Forward the Set-Cookie header from the ops-api so the browser receives the session cookie
  const setCookie = response.headers.get("set-cookie");
  const user = await response.json();
  const roles: string[] = user.roles ?? [];
  const token: string = user.token ?? "";

  // Determine redirect target based on roles
  let destination = "/landing";
  if (roles.includes("SUPER_ADMIN") || roles.includes("OWNER_VIEW")) {
    destination = process.env.OWNER_DASHBOARD_URL || "https://owner.example.com";
  } else if (roles.includes("MANAGER")) {
    destination = process.env.MANAGER_DASHBOARD_URL || "https://manager.example.com";
  } else if (roles.includes("PAYROLL")) {
    destination = process.env.PAYROLL_DASHBOARD_URL || "https://payroll.example.com";
  }

  // Append token as query param so cross-domain dashboards can store it
  const url = new URL(destination, req.url);
  if (token) url.searchParams.set("session_token", token);

  const headers = new Headers({ Location: url.toString() });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(null, { status: 303, headers });
}
