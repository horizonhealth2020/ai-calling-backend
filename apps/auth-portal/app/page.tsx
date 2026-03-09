import { PageShell } from "@ops/ui";

export default function AuthPortal() {
  return (
    <PageShell title="INS Ops Login">
      <form action="/api/login" method="post" style={{ display: "grid", gap: 12, maxWidth: 400 }}>
        <input name="email" placeholder="Email" required />
        <input name="password" placeholder="Password" type="password" required />
        <button type="submit">Sign in</button>
      </form>
      <p>After sign in, users are redirected by role to manager, payroll, owner, or multi-access landing.</p>
    </PageShell>
  );
}
