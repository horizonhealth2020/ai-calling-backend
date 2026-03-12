# Distribution Reference

## Contents
- What distribution means for this platform
- Role provisioning as the distribution channel
- The auth redirect chain
- User creation and role assignment
- Anti-patterns in access distribution

---

## What Distribution Means Here

This platform has no external marketing distribution (no SEO, no ads, no email campaigns). Distribution is entirely **access provisioning**: a SUPER_ADMIN creates a user account with the correct role, and that user reaches their dashboard on first login. Distribution failure = user can't log in, gets the wrong dashboard, or has insufficient permissions.

The distribution chain: `SUPER_ADMIN creates user → user receives credentials → user logs into auth-portal → role detection → correct dashboard`

---

## Role Provisioning as the Distribution Channel

Users are created via the ops-api. The `POST /api/users` endpoint is the single provisioning surface.

```typescript
// apps/ops-api/src/routes/index.ts — user creation
// SUPER_ADMIN only — this is the distribution gate
router.post("/api/users", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { email, password, role, name } = parsed.data;
  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, password: hashed, role, name },
  });

  logAudit(req, "user_created", { userId: user.id, role });
  res.json({ id: user.id, email: user.email, role: user.role });
}));
```

The `role` field determines which dashboard(s) appear on the auth-portal landing page. **Wrong role at creation = wrong distribution.**

---

## The Auth Redirect Chain

After login, the auth-portal reads the JWT `role` and redirects. This is the routing logic that must match the dashboard copy:

```typescript
// apps/auth-portal — role-to-dashboard redirect map
const ROLE_REDIRECT: Partial<Record<AppRole, string>> = {
  MANAGER: process.env.NEXT_PUBLIC_MANAGER_URL!,
  PAYROLL: process.env.NEXT_PUBLIC_PAYROLL_URL!,
  OWNER_VIEW: process.env.NEXT_PUBLIC_OWNER_URL!,
  SERVICE: process.env.NEXT_PUBLIC_MANAGER_URL!, // SERVICE uses manager dashboard
};

// SUPER_ADMIN and users with multiple roles go to landing/page.tsx for selection
```

If a role is missing from this map, the user lands on the dashboard selector — which is fine if they have multiple roles, but a dead end if they have only one and it isn't mapped.

---

## User Creation Workflow

Copy this checklist when provisioning a new user:

- [ ] Confirm which dashboard(s) the user needs access to
- [ ] Map the dashboard to the correct `AppRole` (see table below)
- [ ] POST to `/api/users` with `{ email, password, role, name }`
- [ ] Communicate credentials to the user (default seed password: `ChangeMe123!` — change immediately)
- [ ] Confirm user can reach their dashboard on first login
- [ ] If user needs multiple dashboards, assign `SUPER_ADMIN` or request multi-role support

| Dashboard | Required Role |
|-----------|--------------|
| Manager Dashboard | `MANAGER` |
| Payroll Dashboard | `PAYROLL` |
| Owner Dashboard | `OWNER_VIEW` |
| All dashboards | `SUPER_ADMIN` |
| Service staff view | `SERVICE` |

---

## WARNING: Role Mismatch at Provisioning

**The Problem:**
```bash
# BAD — provisioning a payroll user as MANAGER
POST /api/users { "email": "jane@example.com", "role": "MANAGER" }
# Jane is payroll staff — she'll land on Manager Dashboard with no payroll access
```

**Why This Breaks:**
1. User sees the wrong dashboard and can't do their job
2. They may accidentally enter data they shouldn't touch
3. Fixing requires SUPER_ADMIN to update the role and user to log out/in

**The Fix:** Confirm role mapping before creation. The `AppRole` enum in `packages/types/src/index.ts` is authoritative.

---

## WARNING: Missing Role in Redirect Map

**The Problem:**
```typescript
// BAD — SERVICE role has no redirect configured
const ROLE_REDIRECT = {
  MANAGER: "...",
  PAYROLL: "...",
  OWNER_VIEW: "...",
  // SERVICE missing — user hits landing page with no options
};
```

**Why This Breaks:** SERVICE users land on dashboard selection with no cards shown, because there's no matching dashboard card for their role. Appears as a blank page.

**The Fix:** Either add SERVICE to the redirect map pointing to the appropriate dashboard, or add a SERVICE-role dashboard card to `landing/page.tsx`.

See the **mapping-user-journeys** skill for tracing these redirect chains in the code.
