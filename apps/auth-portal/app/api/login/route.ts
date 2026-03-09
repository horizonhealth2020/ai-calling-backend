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
  if (user.role === "MANAGER") redirect(process.env.MANAGER_DASHBOARD_URL || "https://manager.example.com");
  if (user.role === "PAYROLL") redirect(process.env.PAYROLL_DASHBOARD_URL || "https://payroll.example.com");
  if (user.role === "OWNER_VIEW") redirect(process.env.OWNER_DASHBOARD_URL || "https://owner.example.com");
  redirect("/landing");
}
