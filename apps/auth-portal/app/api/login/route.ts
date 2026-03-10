import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email"));
  const password = String(form.get("password"));
  const response = await fetch(`${process.env.NEXT_PUBLIC_OPS_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!response.ok) return new Response("Invalid credentials", { status: 401 });
  const user = await response.json();
  const roles: string[] = user.roles ?? [];
  // SUPER_ADMIN and OWNER_VIEW go to owner dashboard
  if (roles.includes("SUPER_ADMIN") || roles.includes("OWNER_VIEW")) redirect(process.env.OWNER_DASHBOARD_URL || "https://owner.example.com");
  if (roles.includes("MANAGER")) redirect(process.env.MANAGER_DASHBOARD_URL || "https://manager.example.com");
  if (roles.includes("PAYROLL")) redirect(process.env.PAYROLL_DASHBOARD_URL || "https://payroll.example.com");
  redirect("/landing");
}
