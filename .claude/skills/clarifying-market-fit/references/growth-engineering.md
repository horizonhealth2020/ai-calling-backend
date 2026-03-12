# Growth Engineering Reference

## Contents
- Growth levers in an internal ops platform
- Activation: first meaningful action per role
- Retention signals from existing data
- Sales board as an external growth surface
- Expanding platform reach

---

## Growth Levers in an Internal Ops Platform

Traditional growth metrics (signups, MAU) don't apply. The growth levers here are:

1. **Activation rate** — what % of provisioned users complete their core job in week 1
2. **Role coverage** — are all relevant staff provisioned with the right access
3. **Feature adoption** — are managers using all tabs, or just Sales Entry
4. **External reach** — the sales board (`apps/sales-board`) is the only unauthenticated surface and could serve as a recruitment/proof signal

---

## Activation: First Meaningful Action Per Role

| Role | Activation event | How to measure |
|------|-----------------|----------------|
| MANAGER | First sale logged | `SELECT MIN("createdAt") FROM "Sale" WHERE "managerId" = ?` |
| PAYROLL | First payroll period opened | `SELECT MIN("createdAt") FROM "PayrollPeriod"` |
| OWNER_VIEW | First dashboard load (no action required) | Needs event tracking |
| SUPER_ADMIN | First user created | `app_audit_log` where `action = 'user_created'` |

Activation query for all managers — identify who hasn't logged a sale yet:

```typescript
// Run from ops-api — manager activation report
const unactivated = await prisma.user.findMany({
  where: {
    role: "MANAGER",
    sales: { none: {} },
    createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // older than 7 days
  },
  select: { id: true, name: true, email: true, createdAt: true },
});
```

---

## Retention Signals

Retention = the platform is part of the daily workflow. Proxy signals from existing data:

```sql
-- Weekly sales entry cadence per manager (are they logging consistently?)
SELECT
  u.name,
  DATE_TRUNC('week', s."saleDate") as week,
  COUNT(*) as sales_logged
FROM "Sale" s
JOIN "User" u ON u.id = s."managerId"
GROUP BY u.name, week
ORDER BY u.name, week DESC;
```

```sql
-- Payroll period completion rate (are payroll staff closing periods on time?)
SELECT
  COUNT(*) FILTER (WHERE status = 'PAID') as completed,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'PAID')::decimal / COUNT(*) * 100) as pct
FROM "PayrollPeriod";
```

Managers who stop logging sales for 2+ weeks are churn risk — they may have reverted to spreadsheets or a previous workflow.

---

## Sales Board as External Growth Surface

`apps/sales-board` requires no authentication for the board display endpoints. It's the only surface visible to anyone without an account. Potential uses:

- Displayed on office TVs or monitors — keeps agents motivated
- Shared with recruits to demonstrate team performance
- Used in sales meetings as a live reference

### Enhancing the sales board for external impact

```tsx
// apps/sales-board/app/page.tsx
// Current: basic leaderboard
// Growth opportunity: add team name, date range, and incentive context

<header>
  <h1 style={{ fontSize: 32, fontWeight: 700 }}>Sales Arena</h1>
  <p style={{ color: "#aaa" }}>
    Horizon Health · Week of {weekLabel} · Top performers win [incentive]
  </p>
</header>
```

The `weekLabel` and incentive copy give context to external viewers without exposing sensitive data.

---

## Expanding Platform Reach

To add a new role or expand what an existing role can see:

1. Add the role to the `AppRole` enum in `packages/types/src/index.ts`
2. Add database migration if needed (`npm run db:migrate`)
3. Update role redirect map in `apps/auth-portal`
4. Add dashboard card in `apps/auth-portal/app/landing/page.tsx`
5. Update `requireRole()` guards in `apps/ops-api/src/routes/index.ts`

See the **scoping-feature-work** skill for slicing this into a shippable increment, and the **designing-onboarding-paths** skill for the first-run experience for the new role.

---

## WARNING: No Activation Notification System

**Detected:** No email or notification integration in dependencies (no nodemailer, sendgrid, resend, etc.)

**Impact:** When a user is provisioned, they must be manually informed of their credentials. There is no automated welcome email or first-login prompt. This creates activation lag — users who receive credentials informally may not log in for days.

**Minimal Fix:** Add a comment to the user creation flow documenting the manual step:

```typescript
// apps/ops-api/src/routes/index.ts — after user creation
// TODO: Send welcome email with credentials — no email service configured yet.
// Credentials must be communicated manually to: user.email
logAudit(req, "user_created", { userId: user.id, role, notificationSent: false });
```

Track `notificationSent: false` in audit log until email is wired up.
