# Measurement and Testing Reference

## Contents
- What to measure for market fit in this platform
- Available data sources
- Testing copy changes
- AppAuditLog as a measurement proxy
- Missing analytics warning

---

## What to Measure for Market Fit

Market fit in an internal ops platform is measured by **task completion, not traffic**. The signals that matter:

| Signal | What it tells you | Where to find it |
|--------|-------------------|-----------------|
| Auth errors by role | Wrong role assignments, redirect misconfiguration | `app_audit_log` + server logs |
| Dashboard tab usage | Which tabs managers/payroll staff actually use | No tracking currently |
| Empty state impressions | How often users land on a surface with no data | No tracking currently |
| Sales entry rate | Managers actively logging sales (core activation) | `Sale` table — count by manager/week |
| Payroll period completion | Payroll staff completing full period cycle | `PayrollPeriod` status transitions |

---

## Available Data Sources

### AppAuditLog (existing)

The `app_audit_log` table is written by `logAudit()` in `apps/ops-api/src/services/audit.ts`. It captures sensitive operations with actor, action, and metadata. Query it for behavior signals:

```sql
-- Which actions are most common by role?
SELECT al.action, u.role, COUNT(*) as count
FROM app_audit_log al
JOIN "User" u ON u.id = al."userId"
GROUP BY al.action, u.role
ORDER BY count DESC;
```

```sql
-- Auth error rate by day
SELECT DATE(al."createdAt") as day, COUNT(*) as errors
FROM app_audit_log al
WHERE al.action IN ('auth_failed', 'access_denied')
GROUP BY day
ORDER BY day DESC;
```

### Sales Table (activation proxy)

First sale logged by a manager = activation signal. Managers who never log a sale haven't adopted the platform:

```typescript
// apps/ops-api — query for manager activation
const neverActivated = await prisma.user.findMany({
  where: {
    role: "MANAGER",
    sales: { none: {} }, // no sales ever logged
  },
  select: { id: true, email: true, name: true, createdAt: true },
});
```

---

## Testing Copy Changes

There is no A/B testing framework. Copy changes are **ship-and-observe**:

1. Update copy in the relevant `.tsx` file
2. Deploy to staging (or dev: `npm run <app>:dev`)
3. Walk through the affected role's journey manually
4. Confirm copy renders correctly for each role that sees it
5. Check that no other role sees broken or missing copy

### Role-specific manual test matrix

Copy this checklist when testing copy changes in `apps/auth-portal`:

- [ ] Log in as MANAGER — confirm dashboard card description is correct
- [ ] Log in as PAYROLL — confirm dashboard card description is correct
- [ ] Log in as OWNER_VIEW — confirm dashboard card description is correct
- [ ] Log in as SUPER_ADMIN — confirm both/all cards appear
- [ ] Trigger access-denied page — confirm recovery link is present
- [ ] Trigger unauthorized page — confirm it distinguishes from access-denied

Seed users for each role:
```bash
npm run db:seed
# Default password for all seed users: ChangeMe123!
```

---

## WARNING: No Analytics — Measuring Copy Impact is Blind

**Detected:** No analytics library in any `package.json` across the monorepo.

**Impact:** You cannot measure:
- Whether role description copy changes improve time-to-dashboard
- Which roles generate the most access-denied errors
- Whether empty state copy changes reduce support requests

### Minimal Fix: Extend AppAuditLog

The `logAudit()` function already writes structured events. Extend it to capture UX funnel events from the frontend via a lightweight endpoint:

```typescript
// apps/ops-api/src/routes/index.ts — add event tracking endpoint
router.post("/api/events", requireAuth, asyncHandler(async (req, res) => {
  const { event, metadata } = req.body;
  // Reuse audit log infrastructure — no new table needed
  logAudit(req, event, metadata ?? {});
  res.json({ ok: true });
}));
```

```typescript
// apps/auth-portal — fire on dashboard selection
async function trackEvent(event: string, meta: Record<string, unknown>) {
  await authFetch(`${process.env.NEXT_PUBLIC_OPS_API_URL}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, metadata: meta }),
  }).catch(() => {}); // never block navigation on tracking failure
}
```

See the **instrumenting-product-metrics** skill for a full event taxonomy and funnel design.
