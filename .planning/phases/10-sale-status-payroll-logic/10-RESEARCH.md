# Phase 10: Sale Status Payroll Logic - Research

**Researched:** 2026-03-15
**Domain:** Sale status-driven commission, approval workflow, Prisma schema migration
**Confidence:** HIGH

## Summary

Phase 10 replaces the existing `SaleStatus` enum (`SUBMITTED/APPROVED/REJECTED/CANCELLED`) with three business-meaningful values (`RAN/DECLINED/DEAD`) that directly drive commission calculation. Only `RAN` sales earn commission; `DECLINED` and `DEAD` create $0 payroll entries for reporting visibility. A change request workflow gates the Dead/Declined-to-Ran transition behind payroll approval.

The implementation touches four layers: (1) Prisma schema migration (enum replacement + new `StatusChangeRequest` table + data backfill), (2) commission engine gating in `payroll.ts`, (3) API routes for status changes and approval workflow, and (4) UI updates across manager-dashboard, payroll-dashboard, and sales-board. The existing clawback pattern provides the model for negative adjustments when Ran sales are demoted after period finalization.

**Primary recommendation:** Start with schema migration and commission gating (backend-first), then build the approval workflow API, then update all three dashboards. The clawback pattern (zero-out vs. negative adjustment based on period status) should be reused for Ran-to-Dead/Declined transitions on finalized periods.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace current SaleStatus enum (SUBMITTED/APPROVED/REJECTED/CANCELLED) with three values: RAN, DECLINED, DEAD
- Migrate all existing sale records to RAN (they were working sales)
- Sales entry form includes a status dropdown -- manager picks Ran/Declined/Dead at creation time
- Status dropdown defaults to blank ("Select status...") -- manager must explicitly choose
- Status is also changeable inline on the agent sales tab (which already has a status column)
- Managers can freely change status in any direction EXCEPT Dead/Declined to Ran
- Dead/Declined to Ran creates a change request for payroll approval instead of applying immediately
- Ran to Dead/Declined applies immediately and zeroes commission instantly (no approval needed)
- Dead to Declined changes are free (no commission impact either way)
- Declined/Dead sales create $0 payroll entries -- visible as normal rows with a status badge
- $0 entries are EXCLUDED from period totals (sale count and net amount only reflect Ran sales)
- When Ran to Dead/Declined and the original period is already finalized/paid, create a negative adjustment in the current open period (similar to existing clawback mechanism)
- Sales board leaderboard only counts Ran sales -- Declined/Dead don't appear
- While awaiting payroll approval, sale stays at $0 commission (treated as Dead/Declined still)
- "Pending Ran" does not count on leaderboard or KPIs until approved
- Commission only activates after payroll approves the change request
- Pending Ran gets a distinct badge color (amber/yellow) with a clock/pending icon on the agent sales tab
- Selecting Ran on a Dead/Declined sale triggers inline confirmation: "This will create a change request for payroll approval"
- Approval queue appears INSIDE payroll cards -- pending requests show within the relevant agent's payroll card, highlighted
- PAYROLL and SUPER_ADMIN roles can approve/reject requests
- On rejection: sale reverts to its original Dead or Declined status, no reason required
- Status changes and approval actions logged via existing logAudit() service (app_audit_log table)
- New StatusChangeRequest table for persisting pending approvals: saleId, requestedBy, requestedAt, oldStatus, newStatus, status (PENDING/APPROVED/REJECTED), reviewedBy, reviewedAt
- Approval/rejection also logged to audit log for compliance

### Claude's Discretion
- Exact badge colors for Ran (green), Declined (red), Dead (gray), Pending Ran (amber)
- StatusChangeRequest table field naming conventions (follow existing @map pattern)
- How the inline confirmation dialog looks (toast, popover, or modal)
- Payroll card highlighting style for pending approval items
- Whether to add a "Pending" count badge to the payroll dashboard header

### Deferred Ideas (OUT OF SCOPE)
- Bulk status changes (selecting multiple sales to change status at once) -- future enhancement
- Rejection reason field on change requests -- keep it simple for now
- Notification system for change request outcomes (manager notified when approved/rejected) -- future phase
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | existing | Schema migration, enum replacement, new model | Already used for all DB operations |
| Express.js | existing | New API routes for status change and approval | All routes in single routes/index.ts |
| Zod | existing | Request validation for status change/approval endpoints | All API validation uses Zod + zodErr() |
| React (Next.js 15) | existing | Dashboard UI updates | All frontends are Next.js 15 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/auth | existing | requireAuth, requireRole middleware | Protecting approval endpoints |
| logAudit() | existing | Audit trail for status changes and approvals | Every status mutation |
| Luxon | existing | Timezone-aware period calculations | If needed for negative adjustment period logic |

### Alternatives Considered
None -- this phase uses only existing stack. No new libraries needed.

## Architecture Patterns

### Schema Migration Strategy

The SaleStatus enum replacement requires a specific PostgreSQL migration approach because Prisma cannot rename enum values in-place.

**Migration approach (manual SQL, consistent with project pattern):**
```sql
-- Step 1: Create new enum type
CREATE TYPE "SaleStatus_new" AS ENUM ('RAN', 'DECLINED', 'DEAD');

-- Step 2: Alter column to use new type with default mapping
ALTER TABLE "sales" ALTER COLUMN "status" TYPE "SaleStatus_new"
  USING CASE
    WHEN "status"::text = 'SUBMITTED' THEN 'RAN'::"SaleStatus_new"
    WHEN "status"::text = 'APPROVED' THEN 'RAN'::"SaleStatus_new"
    WHEN "status"::text = 'REJECTED' THEN 'DEAD'::"SaleStatus_new"
    WHEN "status"::text = 'CANCELLED' THEN 'DEAD'::"SaleStatus_new"
  END;

-- Step 3: Drop old enum and rename new
DROP TYPE "SaleStatus";
ALTER TYPE "SaleStatus_new" RENAME TO "SaleStatus";

-- Step 4: Set default
ALTER TABLE "sales" ALTER COLUMN "status" SET DEFAULT 'RAN'::"SaleStatus";

-- Step 5: Create StatusChangeRequest table
CREATE TABLE "status_change_requests" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sale_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "old_status" "SaleStatus" NOT NULL,
  "new_status" "SaleStatus" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "status_change_requests_pkey" PRIMARY KEY ("id")
);

-- Step 6: Add foreign keys
ALTER TABLE "status_change_requests" ADD CONSTRAINT "status_change_requests_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "status_change_requests" ADD CONSTRAINT "status_change_requests_requested_by_fkey"
  FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "status_change_requests" ADD CONSTRAINT "status_change_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Create a ChangeRequestStatus enum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "status_change_requests" ALTER COLUMN "status" TYPE "ChangeRequestStatus"
  USING "status"::"ChangeRequestStatus";
ALTER TABLE "status_change_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ChangeRequestStatus";
```

**Confidence:** HIGH -- follows existing manual migration pattern from Phase 1-3.

### Pattern 1: Commission Gating on Sale Status

**What:** `upsertPayrollEntryForSale()` checks `sale.status` before calculating commission.
**When to use:** Every time a payroll entry is created or recalculated.

```typescript
// In payroll.ts - upsertPayrollEntryForSale()
export const upsertPayrollEntryForSale = async (saleId: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { product: true, addons: { include: { product: true } } },
  });
  if (!sale) throw new Error("Sale not found");

  // STATUS GATE: Only RAN sales earn commission
  const payoutAmount = sale.status === 'RAN'
    ? calculateCommission(sale)
    : 0;

  // ... rest of existing logic with payoutAmount
};
```

**Confidence:** HIGH -- minimal change to existing function, clean gate.

### Pattern 2: Status Change with Approval Workflow

**What:** PATCH /api/sales/:id/status route handles all status transitions, creating a change request for Dead/Declined-to-Ran.
**When to use:** When manager changes sale status from agent sales tab or sales form.

```typescript
// New route: PATCH /api/sales/:id/status
router.patch("/sales/:id/status", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ status: z.enum(["RAN", "DECLINED", "DEAD"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
  if (!sale) return res.status(404).json({ error: "Sale not found" });

  const { status: newStatus } = parsed.data;
  const oldStatus = sale.status;

  // Dead/Declined -> Ran requires approval
  if ((oldStatus === 'DEAD' || oldStatus === 'DECLINED') && newStatus === 'RAN') {
    const changeRequest = await prisma.statusChangeRequest.create({
      data: {
        saleId: sale.id,
        requestedBy: req.user!.id,
        oldStatus,
        newStatus,
      },
    });
    await logAudit(req.user!.id, "REQUEST_STATUS_CHANGE", "Sale", sale.id, { oldStatus, newStatus, changeRequestId: changeRequest.id });
    return res.json({ changeRequest, message: "Change request created for payroll approval" });
  }

  // All other transitions apply immediately
  await prisma.sale.update({ where: { id: sale.id }, data: { status: newStatus } });

  // If Ran -> Dead/Declined, zero commission and handle finalized periods
  if (oldStatus === 'RAN' && (newStatus === 'DEAD' || newStatus === 'DECLINED')) {
    await handleCommissionZeroing(sale.id);
  }

  await logAudit(req.user!.id, "UPDATE_STATUS", "Sale", sale.id, { oldStatus, newStatus });
  res.json(await prisma.sale.findUnique({ where: { id: sale.id }, include: { agent: true, product: true } }));
}));
```

### Pattern 3: Negative Adjustment for Finalized Periods (Clawback Pattern Reuse)

**What:** When a Ran sale is changed to Dead/Declined and its payroll period is already FINALIZED or LOCKED, create a negative adjustment in the current open period.
**When to use:** Ran-to-Dead/Declined status change on sales with finalized payroll entries.

```typescript
async function handleCommissionZeroing(saleId: string) {
  const entries = await prisma.payrollEntry.findMany({
    where: { saleId },
    include: { payrollPeriod: true },
  });

  for (const entry of entries) {
    if (entry.payrollPeriod.status === 'OPEN') {
      // Period still open -- just zero it out
      await prisma.payrollEntry.update({
        where: { id: entry.id },
        data: { payoutAmount: 0, netAmount: 0, status: 'ZEROED_OUT' },
      });
    } else {
      // Period finalized/locked -- create negative adjustment in current open period
      // Follow existing clawback pattern from POST /clawbacks route
      await prisma.payrollEntry.update({
        where: { id: entry.id },
        data: {
          adjustmentAmount: Number(entry.adjustmentAmount) - Number(entry.netAmount),
          status: 'CLAWBACK_APPLIED',
        },
      });
    }
  }
}
```

**Confidence:** HIGH -- mirrors existing clawback logic at routes/index.ts lines 537-543.

### Pattern 4: Approval/Rejection Flow

**What:** Payroll users approve or reject status change requests.
**When to use:** When payroll reviews pending Ran requests.

```typescript
// POST /api/status-change-requests/:id/approve
// POST /api/status-change-requests/:id/reject
```

On approval: update sale status to RAN, recalculate commission via `upsertPayrollEntryForSale()`, mark request as APPROVED.
On rejection: mark request as REJECTED, sale stays at original status.

### Recommended Route Structure

All new routes go in the existing `apps/ops-api/src/routes/index.ts`:

```
PATCH  /api/sales/:id/status          -- Manager changes sale status
GET    /api/status-change-requests     -- List pending requests (for payroll dashboard)
POST   /api/status-change-requests/:id/approve  -- Payroll approves
POST   /api/status-change-requests/:id/reject   -- Payroll rejects
```

### Anti-Patterns to Avoid
- **Modifying calculateCommission() for status gating:** The gate belongs in `upsertPayrollEntryForSale()`, not in the pure calculation function. Keep `calculateCommission()` focused on rate/threshold math.
- **Separate PATCH route for status vs. using existing PATCH /api/sales/:id:** Status changes have complex side effects (approval workflow, commission zeroing, negative adjustments). They deserve their own route, not overloading the generic sale update.
- **Direct sale.status update for Dead/Declined-to-Ran:** This MUST go through the change request workflow. The API must enforce this constraint server-side, not rely on the UI to prevent it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enum migration | Custom column type switching | PostgreSQL USING clause for enum casting | Prisma can't do in-place enum value changes; raw SQL with USING is the standard pattern |
| Negative adjustments | Custom deduction logic | Existing clawback pattern (ZEROED_OUT / CLAWBACK_APPLIED) | Already handles open vs. finalized period distinction |
| Audit logging | Custom audit table/queries | Existing `logAudit()` service | Works with app_audit_log table, has error resilience |
| Role checking | Custom permission checks | Existing `requireRole()` middleware | Already handles SUPER_ADMIN bypass |

## Common Pitfalls

### Pitfall 1: Enum Migration Data Loss
**What goes wrong:** Dropping the old enum before migrating data causes column to lose all values.
**Why it happens:** PostgreSQL enums are types; you can't just ALTER TYPE to remove/rename values.
**How to avoid:** Create new enum type, ALTER column with USING to cast, THEN drop old type. Test migration on a copy first.
**Warning signs:** Migration fails with "value X is not in enum" errors.

### Pitfall 2: Race Condition on Status Change
**What goes wrong:** Two managers change the same sale's status simultaneously; one creates a change request while another applies a direct change.
**Why it happens:** No row-level lock during status transition check.
**How to avoid:** Use a Prisma transaction with a `findFirst` + where clause that includes the expected current status. If the sale status has already changed, return a conflict error.
**Warning signs:** Change requests created for sales that are already RAN.

### Pitfall 3: Forgetting to Filter $0 Entries from Period Totals
**What goes wrong:** Period totals include Dead/Declined $0 entries, inflating sale counts.
**Why it happens:** Multiple `.reduce()` calls across payroll-dashboard aggregate all entries without status filtering.
**How to avoid:** Filter by `sale.status === 'RAN'` (or check `payoutAmount > 0`) in all aggregation code. The payroll dashboard has at least 10 separate `.reduce()` calls that all need updating.
**Warning signs:** Period summary shows higher sale counts than expected.

### Pitfall 4: Sales Board Not Filtering by Status
**What goes wrong:** Dead/Declined sales appear on the leaderboard.
**Why it happens:** The `/sales-board/summary` and `/sales-board/detailed` endpoints use `prisma.sale.groupBy()` and `prisma.sale.findMany()` without status filtering.
**How to avoid:** Add `where: { status: 'RAN' }` to all sales board queries. There are two endpoints: `/sales-board/summary` (groupBy) and `/sales-board/detailed` (findMany).
**Warning signs:** Leaderboard counts don't match what managers expect.

### Pitfall 5: Pending Change Request Orphaning
**What goes wrong:** A sale with a pending change request gets deleted, leaving an orphaned request.
**Why it happens:** DELETE /api/sales/:id doesn't clean up StatusChangeRequest records.
**How to avoid:** Add `prisma.statusChangeRequest.deleteMany({ where: { saleId } })` to the sale deletion transaction. Or use CASCADE on the foreign key.
**Warning signs:** Payroll sees pending requests for non-existent sales.

### Pitfall 6: Commission Recalculation on Approval Missing Addon Data
**What goes wrong:** When approval triggers `upsertPayrollEntryForSale()`, the function already includes addons in its query, so this should work. But if someone adds a separate recalc path that doesn't include addons, commission will be wrong.
**How to avoid:** Always use `upsertPayrollEntryForSale()` as the single entry point for commission calculation. Never bypass it.
**Warning signs:** Approved sales show different commission than expected.

### Pitfall 7: Owner Dashboard Summary Not Filtering
**What goes wrong:** Owner KPI summary counts Dead/Declined sales.
**Why it happens:** The `/owner/summary` endpoint uses `prisma.sale.count()` and `prisma.sale.aggregate()` without status filter.
**How to avoid:** Add `status: 'RAN'` to the where clause in the owner summary endpoint.
**Warning signs:** Owner sees inflated sale counts and premium totals.

## Code Examples

### Existing Sale Creation (POST /api/sales) -- What Changes

Current code at routes/index.ts line 293:
```typescript
status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]).default("SUBMITTED"),
```

Must change to:
```typescript
status: z.enum(["RAN", "DECLINED", "DEAD"]),  // No default -- manager must choose
```

### Existing PATCH /api/sales/:id -- What Changes

Current code at routes/index.ts line 340:
```typescript
status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
```

This should be REMOVED from the generic PATCH route. Status changes go through the new dedicated endpoint.

### StatusBadge Component Update (manager-dashboard)

Current code at manager-dashboard/app/page.tsx line 352:
```typescript
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: colors.success,
    REJECTED: colors.danger,
    CANCELLED: colors.textSecondary,
    SUBMITTED: colors.warning,
  };
```

Must change to:
```typescript
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    RAN: '#22c55e',        // green
    DECLINED: '#ef4444',   // red
    DEAD: '#6b7280',       // gray
    PENDING_RAN: '#f59e0b', // amber
  };
```

### Prisma Schema Addition

```prisma
enum ChangeRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model StatusChangeRequest {
  id          String               @id @default(cuid())
  saleId      String               @map("sale_id")
  requestedBy String              @map("requested_by")
  requestedAt DateTime            @default(now()) @map("requested_at")
  oldStatus   SaleStatus          @map("old_status")
  newStatus   SaleStatus          @map("new_status")
  status      ChangeRequestStatus @default(PENDING)
  reviewedBy  String?             @map("reviewed_by")
  reviewedAt  DateTime?           @map("reviewed_at")
  createdAt   DateTime            @default(now()) @map("created_at")

  sale        Sale                @relation(fields: [saleId], references: [id], onDelete: Cascade)
  requester   User                @relation("StatusChangeRequester", fields: [requestedBy], references: [id])
  reviewer    User?               @relation("StatusChangeReviewer", fields: [reviewedBy], references: [id])

  @@map("status_change_requests")
}
```

Note: Sale model needs `statusChangeRequests StatusChangeRequest[]` relation added. User model needs two new relations: `statusChangeRequestsMade StatusChangeRequest[] @relation("StatusChangeRequester")` and `statusChangeRequestsReviewed StatusChangeRequest[] @relation("StatusChangeReviewer")`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SaleStatus: SUBMITTED/APPROVED/REJECTED/CANCELLED | SaleStatus: RAN/DECLINED/DEAD | Phase 10 | Status now drives commission directly |
| All sales earn commission | Only RAN earns commission | Phase 10 | $0 payroll entries for non-Ran |
| No approval workflow for status | Dead/Declined-to-Ran requires payroll approval | Phase 10 | New StatusChangeRequest table |

**Deprecated/outdated:**
- SUBMITTED, APPROVED, REJECTED, CANCELLED status values: Replaced by RAN, DECLINED, DEAD
- Generic PATCH /api/sales/:id for status changes: Replaced by dedicated PATCH /api/sales/:id/status

## Integration Points Summary

| Touch Point | File | Change Type |
|-------------|------|-------------|
| SaleStatus enum | prisma/schema.prisma | Replace values |
| StatusChangeRequest model | prisma/schema.prisma | New model |
| ChangeRequestStatus enum | prisma/schema.prisma | New enum |
| User model | prisma/schema.prisma | Add relations |
| Sale model | prisma/schema.prisma | Add relation |
| Migration SQL | prisma/migrations/ | New manual migration |
| upsertPayrollEntryForSale() | apps/ops-api/src/services/payroll.ts | Add status gate |
| POST /api/sales | apps/ops-api/src/routes/index.ts | Update Zod schema |
| PATCH /api/sales/:id | apps/ops-api/src/routes/index.ts | Remove status from schema |
| New status change route | apps/ops-api/src/routes/index.ts | Add PATCH /api/sales/:id/status |
| New approval routes | apps/ops-api/src/routes/index.ts | Add approve/reject endpoints |
| GET /api/status-change-requests | apps/ops-api/src/routes/index.ts | Add for payroll dashboard |
| /sales-board/summary | apps/ops-api/src/routes/index.ts | Add status: RAN filter |
| /sales-board/detailed | apps/ops-api/src/routes/index.ts | Add status: RAN filter |
| /owner/summary | apps/ops-api/src/routes/index.ts | Add status: RAN filter |
| StatusBadge | apps/manager-dashboard/app/page.tsx | Update color map |
| Sales form | apps/manager-dashboard/app/page.tsx | Add status dropdown |
| Agent sales tab | apps/manager-dashboard/app/page.tsx | Editable status dropdown |
| Payroll cards | apps/payroll-dashboard/app/page.tsx | Add pending approval display |
| Period totals | apps/payroll-dashboard/app/page.tsx | Filter $0 entries from totals |

## Open Questions

1. **Existing payroll entries for migrated sales**
   - What we know: All existing sales will be migrated to RAN status. Their payroll entries already have correct commission amounts.
   - What's unclear: Do we need to touch existing payroll entries at all during migration?
   - Recommendation: No. Since all existing sales become RAN, their existing payroll entries remain valid. No payroll entry recalculation needed during migration.

2. **Multiple pending change requests for the same sale**
   - What we know: A manager could try to change a Dead sale to Ran, get a pending request, then the logic prevents creating another since the sale is still Dead.
   - What's unclear: Should we enforce a unique constraint (one pending request per sale)?
   - Recommendation: Yes, add a partial unique index or check for existing PENDING requests before creating a new one. This prevents duplicate requests.

3. **Payroll entry display for Pending Ran sales**
   - What we know: Pending Ran sales stay at $0 commission. They should be visible but excluded from totals.
   - What's unclear: Should the payroll entry show the projected commission (what it would be if approved)?
   - Recommendation: Keep it at $0 until approved. Showing projected commission could confuse payroll staff into thinking it's already earned.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (TypeScript via ts-jest) |
| Config file | apps/ops-api/jest.config.ts |
| Quick run command | `npm test -- --testPathPattern=commission` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P10-01 | RAN sale generates normal commission | unit | `npm test -- --testPathPattern=commission` | Extend existing |
| P10-02 | DECLINED/DEAD generate $0 commission payroll entries | unit | `npm test -- --testPathPattern=status-commission` | Wave 0 |
| P10-03 | Dead/Declined to Ran creates change request (not immediate) | unit | `npm test -- --testPathPattern=status-change` | Wave 0 |
| P10-04 | Ran to Dead/Declined zeroes commission immediately | unit | `npm test -- --testPathPattern=status-commission` | Wave 0 |
| P10-05 | Finalized period Ran-to-Dead creates negative adjustment | unit | `npm test -- --testPathPattern=status-commission` | Wave 0 |
| P10-06 | Approval recalculates commission | unit | `npm test -- --testPathPattern=status-change` | Wave 0 |
| P10-07 | Rejection reverts to original status | unit | `npm test -- --testPathPattern=status-change` | Wave 0 |
| P10-08 | Sales board queries filter status=RAN | unit | `npm test -- --testPathPattern=sales-board-filter` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=commission`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/status-commission.test.ts` -- covers P10-01, P10-02, P10-04, P10-05
- [ ] `apps/ops-api/src/services/__tests__/status-change.test.ts` -- covers P10-03, P10-06, P10-07
- [ ] Extend existing `commission.test.ts` with status-aware test cases

## Sources

### Primary (HIGH confidence)
- Prisma schema: `prisma/schema.prisma` -- current SaleStatus enum, PayrollEntry model, all relations
- Payroll service: `apps/ops-api/src/services/payroll.ts` -- calculateCommission(), upsertPayrollEntryForSale()
- Routes: `apps/ops-api/src/routes/index.ts` -- POST/PATCH /api/sales, clawback logic, sales-board endpoints
- Manager dashboard: `apps/manager-dashboard/app/page.tsx` -- StatusBadge component, agent sales tab
- Payroll dashboard: `apps/payroll-dashboard/app/page.tsx` -- period totals, agent cards
- Audit service: `apps/ops-api/src/services/audit.ts` -- logAudit() interface
- Existing tests: `apps/ops-api/src/services/__tests__/commission.test.ts` -- test patterns and helpers

### Secondary (MEDIUM confidence)
- Migration pattern from Phase 1-3 manual SQL migrations
- Clawback pattern from POST /clawbacks route (lines 517-547)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing tech
- Architecture: HIGH -- patterns derived directly from existing codebase
- Pitfalls: HIGH -- identified from actual code inspection of aggregation points and query filters
- Migration: HIGH -- PostgreSQL enum casting with USING is well-established pattern

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable, internal project)
