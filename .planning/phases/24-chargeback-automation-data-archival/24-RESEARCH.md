# Phase 24: Chargeback Automation & Data Archival - Research

**Researched:** 2026-03-24
**Domain:** Backend service logic (Prisma/Express), Prisma migrations, Socket.IO events, React dashboard UI
**Confidence:** HIGH

## Summary

This phase has two independent workstreams: (1) chargeback-to-clawback automation fixing the `approveAlert()` bug and adding sale matching, and (2) data archival for high-volume log tables. Both workstreams are well-scoped with clear data models and existing patterns to follow.

The chargeback automation requires modifying the `ChargebackSubmission` model to store a matched sale reference, updating the submission flow to auto-match by `memberId`, enhancing `approveAlert()` to look up the actual commission amount from PayrollEntry, and adding a dedupe guard. The data archival requires a Prisma migration to create three parallel archive tables, new API routes for archive/restore operations using raw SQL (Prisma does not model archive tables as Prisma models since they have no relations), and a new UI section in OwnerConfig.tsx.

**Primary recommendation:** Implement chargeback matching as a schema change + service layer enhancement, keeping archive tables as raw SQL operations via `prisma.$executeRawUnsafe` since they are structurally identical copies without relational constraints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Match chargebacks to sales using exact `memberId` match (chargeback.memberId -> sale.memberId). No fuzzy matching.
- **D-02:** When multiple sales match a single chargeback, flag for manual review -- do NOT auto-select. CS team picks the correct sale.
- **D-03:** Dedupe guard required -- when a chargeback is manually entered or converted from the CS board, the system must check if a clawback already exists for that chargeback/sale combo in the agent's payroll and flag the duplicate. Prevents double-deducting.
- **D-04:** Auto-clawback amount = agent's commission portion on the original sale, NOT the full chargeback amount. Must look up the original sale's commission/payout to calculate.
- **D-05:** Approver chooses the payroll period for the clawback. This matches the existing alert approval UX which already has period selection.
- **D-06:** Archive all three high-volume tables: `call_audits`, `convoso_call_logs`, `app_audit_log`.
- **D-07:** Use parallel archive tables (`call_audits_archive`, `convoso_call_logs_archive`, `app_audit_log_archive`) with identical schemas. Restore = copy rows back to main table.
- **D-08:** Default age threshold: 90 days. Records older than 90 days are eligible for archival.
- **D-09:** Archive management lives inside the existing Config tab of the owner dashboard -- NOT a separate tab or page.
- **D-10:** Inline confirmation UX showing record count (e.g., "Archive 1,247 records older than 90 days?") with confirm/cancel buttons. No modal or type-to-confirm.

### Claude's Discretion
- Migration strategy for creating archive tables (single migration vs per-table)
- Socket.IO event name/payload for auto-created clawbacks (CLAWBACK-05)
- Archive stats display format within Config tab (cards, table, or inline stats)
- How to surface unmatched chargebacks visually in the tracking table (CLAWBACK-04)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLAWBACK-01 | Fix approveAlert() to use correct sale reference (not memberId as saleId) | Bug identified at alerts.ts:46 -- `saleId: alert.chargeback.memberId` must use matched sale ID instead |
| CLAWBACK-02 | Auto-match chargebacks to sales by memberId on submission | New `matchedSaleId` field on ChargebackSubmission + matching logic in POST /chargebacks |
| CLAWBACK-03 | Auto-create clawback record when chargeback is approved and sale is matched | Enhanced approveAlert() uses matched sale's PayrollEntry.payoutAmount for clawback amount |
| CLAWBACK-04 | Unmatched chargebacks flagged for manual review | Visual indicator in CSTracking.tsx table rows + match status field on ChargebackSubmission |
| CLAWBACK-05 | Socket.IO event when clawback is auto-created | New emitClawbackCreated() following existing socket.ts patterns |
| ARCHIVE-01 | Admin can archive old call logs, audit logs, and KPI snapshots by date range | New archive routes + raw SQL INSERT INTO...SELECT + DELETE pattern |
| ARCHIVE-02 | Archived data moved to parallel archive tables (not soft-delete) | Prisma migration creates 3 archive tables; physical DELETE from main tables |
| ARCHIVE-03 | Admin can restore archived data back to main tables | Reverse operation: INSERT INTO main FROM archive + DELETE from archive |
| ARCHIVE-04 | Data management section in owner dashboard showing archive stats | New section in OwnerConfig.tsx with stat cards showing row counts and date ranges |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | Current (project) | Schema migration for new fields + raw SQL for archive ops | Already used throughout; `$executeRawUnsafe` for archive table operations |
| Express | Current (project) | New archive routes | Existing route pattern in ops-api |
| Socket.IO | Current (project) | Real-time clawback notifications | Existing emit pattern in socket.ts |
| Zod | Current (project) | Request validation for archive endpoints | Existing validation pattern |
| React | Current (project) | Archive management UI in OwnerConfig | Inline CSSProperties pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui | workspace | Badge, Button, Card, StatCard components | Archive stats display, unmatched chargeback indicators |
| @ops/auth/client | workspace | authFetch for archive API calls | All new frontend API calls |
| @ops/utils | workspace | formatDate, formatDollar, logEvent | Display and logging |
| lucide-react | Current | Icons for archive UI | Archive, RotateCcw, Database icons |

## Architecture Patterns

### Recommended Project Structure
```
apps/ops-api/src/
  routes/
    archive.ts              # NEW: archive/restore routes
    chargebacks.ts          # MODIFY: add auto-matching on submission
    alerts.ts               # MODIFY: nothing (uses service)
  services/
    alerts.ts               # MODIFY: fix approveAlert(), add clawback amount lookup
    archive.ts              # NEW: archive/restore service logic
  socket.ts                 # MODIFY: add emitClawbackCreated

apps/ops-dashboard/app/(dashboard)/
  owner/
    OwnerConfig.tsx          # MODIFY: add DataArchiveSection
    OwnerArchiveSection.tsx  # NEW: archive management component
  cs/
    CSTracking.tsx           # MODIFY: add unmatched visual indicator

prisma/
  migrations/YYYYMMDD_chargeback_matching_and_archive/
    migration.sql            # Schema changes + archive tables
  schema.prisma              # Add matchedSaleId, matchStatus to ChargebackSubmission
```

### Pattern 1: Chargeback Sale Matching (on submission)
**What:** When chargebacks are submitted via POST /chargebacks, each record with a `memberId` is matched against the `sales` table.
**When to use:** Every chargeback submission (batch paste or individual).
**Example:**
```typescript
// In chargebacks.ts POST handler, after createMany:
for (const cb of createdChargebacks) {
  if (cb.memberId) {
    const matchingSales = await prisma.sale.findMany({
      where: { memberId: cb.memberId },
      include: { payrollEntries: true, agent: true },
    });

    if (matchingSales.length === 1) {
      await prisma.chargebackSubmission.update({
        where: { id: cb.id },
        data: { matchedSaleId: matchingSales[0].id, matchStatus: "MATCHED" },
      });
    } else if (matchingSales.length > 1) {
      await prisma.chargebackSubmission.update({
        where: { id: cb.id },
        data: { matchStatus: "MULTIPLE" },
      });
    } else {
      await prisma.chargebackSubmission.update({
        where: { id: cb.id },
        data: { matchStatus: "UNMATCHED" },
      });
    }
  } else {
    await prisma.chargebackSubmission.update({
      where: { id: cb.id },
      data: { matchStatus: "UNMATCHED" },
    });
  }
}
```

### Pattern 2: Commission-Based Clawback Amount (D-04)
**What:** When approving a chargeback alert, look up the agent's actual commission from PayrollEntry, not the chargeback amount.
**When to use:** In `approveAlert()` when creating the clawback record.
**Example:**
```typescript
// In approveAlert(), after finding the matched sale:
const sale = await prisma.sale.findUnique({
  where: { id: matchedSaleId },
  include: { payrollEntries: true },
});
// Use the payroll entry's payoutAmount as clawback amount
const payrollEntry = sale.payrollEntries[0]; // The original commission entry
const clawbackAmount = payrollEntry ? Number(payrollEntry.payoutAmount) : 0;
```

### Pattern 3: Archive via Raw SQL
**What:** Archive tables are not Prisma models. Use raw SQL for insert-select-delete operations.
**When to use:** All archive/restore operations.
**Example:**
```typescript
// Archive: move rows older than cutoff to archive table
await prisma.$executeRawUnsafe(`
  INSERT INTO call_audits_archive SELECT * FROM call_audits WHERE created_at < $1
`, cutoffDate);
await prisma.$executeRawUnsafe(`
  DELETE FROM call_audits WHERE created_at < $1
`, cutoffDate);
```

### Pattern 4: Dedupe Guard (D-03)
**What:** Before creating a clawback, check if one already exists for this chargeback+sale combo.
**When to use:** In `approveAlert()` and in the manual `POST /clawbacks` route.
**Example:**
```typescript
const existing = await prisma.clawback.findFirst({
  where: {
    saleId: matchedSaleId,
    matchedBy: "chargeback_alert",
    matchedValue: alert.chargebackSubmissionId,
  },
});
if (existing) {
  throw new Error("Clawback already exists for this chargeback/sale combination");
}
```

### Anti-Patterns to Avoid
- **Modeling archive tables in Prisma schema:** Archive tables should NOT be Prisma models. They have no relations, no migrations after creation, and adding them to Prisma bloats the client. Use raw SQL.
- **Using chargeback amount as clawback amount:** D-04 requires looking up the agent's actual commission (PayrollEntry.payoutAmount), not the chargeback's chargebackAmount field.
- **Using `memberId` as `saleId` in clawback creation:** This is the exact bug CLAWBACK-01 fixes. The `memberId` is a carrier member identifier string, NOT a Sale record ID.
- **Wrapping archive in a transaction without batching:** Large archive operations (10k+ rows) should batch to avoid long-running transactions that block other queries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range filtering | Custom date parsing | Existing `dateRange()` helper from routes/helpers.ts | Already handles week/month/custom from/to patterns |
| Socket event broadcasting | Custom WebSocket | Existing `io?.emit()` pattern in socket.ts | Consistent with all other real-time features |
| Audit logging | Console.log | Existing `logAudit()` from services/audit.ts | Writes to app_audit_log table for traceability |
| Error formatting | Manual JSON | Existing `zodErr()` helper | Consistent error shape for dashboard display |
| Commission calculation | Recalculate from product rates | Look up PayrollEntry.payoutAmount | The payroll entry already has the calculated commission; recalculating risks divergence |

**Key insight:** The commission amount for clawbacks should come from the existing PayrollEntry record (which was calculated when the sale was entered), not by re-running `calculateCommission()`. This avoids edge cases where product rates changed after the original sale.

## Common Pitfalls

### Pitfall 1: memberId Confusion
**What goes wrong:** The `ChargebackSubmission.memberId` is a carrier member ID string (e.g., "M12345"), while `Sale.memberId` is also a string field. But `Clawback.saleId` expects a Sale record's `id` (a cuid). The current bug (CLAWBACK-01) passes `memberId` where `saleId` is expected.
**Why it happens:** Fields are named similarly but reference different things.
**How to avoid:** Always resolve to a `Sale.id` via `prisma.sale.findFirst({ where: { memberId } })` before creating clawback records.
**Warning signs:** Clawback records with saleId values that look like carrier IDs instead of cuids.

### Pitfall 2: Multiple Sales per Member
**What goes wrong:** A single member can have multiple sales (renewals, different products). Auto-selecting the wrong sale creates an incorrect clawback.
**Why it happens:** memberId is not unique in the sales table.
**How to avoid:** D-02 requires flagging multi-match cases for manual review. Never auto-select when count > 1.
**Warning signs:** `Sale.findMany({ where: { memberId } })` returns more than one result.

### Pitfall 3: Archive Table FK Constraints
**What goes wrong:** Archive tables with foreign key constraints prevent deletion of related records in main tables.
**Why it happens:** Copying the schema verbatim includes FK constraints.
**How to avoid:** Archive tables must drop all foreign key constraints. They store data snapshots, not relational references. Only keep column structure and indexes on date columns.
**Warning signs:** "violates foreign key constraint" errors during archive operations.

### Pitfall 4: ConvosoCallLog.callAuditId Unique Constraint
**What goes wrong:** `convoso_call_logs` has a unique constraint on `call_audit_id` referencing `call_audits`. If call_audits rows are archived but convoso_call_logs rows remain (or vice versa), the FK breaks.
**Why it happens:** These tables are related via a 1:1 relationship.
**How to avoid:** Archive both tables together when their records overlap, OR drop the FK in the archive migration and set `call_audit_id = NULL` on orphaned convoso_call_logs rows before archiving call_audits.
**Warning signs:** FK violation errors during selective archival.

### Pitfall 5: Large Batch Performance
**What goes wrong:** Archiving 100k+ rows in a single transaction locks tables and causes timeouts.
**Why it happens:** INSERT INTO...SELECT + DELETE is I/O heavy on large datasets.
**How to avoid:** Batch operations in chunks (e.g., 5000 rows per batch) within a loop, each chunk in its own transaction.
**Warning signs:** Slow API responses, database timeouts during archive operations.

### Pitfall 6: Double Clawback from Multiple Entry Paths
**What goes wrong:** A chargeback enters the system via batch paste, then the same chargeback is manually entered or converted from CS board, creating two clawbacks for the same sale.
**Why it happens:** Multiple paths into the clawback creation pipeline.
**How to avoid:** D-03 dedupe guard checks `Clawback.findFirst({ saleId, matchedValue: chargebackId })` before creating.
**Warning signs:** Two clawback records with the same saleId and similar matchedValue.

## Code Examples

### Schema Changes for ChargebackSubmission
```prisma
// Add to ChargebackSubmission model in schema.prisma:
  matchedSaleId  String?  @map("matched_sale_id")
  matchStatus    String?  @map("match_status")  // MATCHED, MULTIPLE, UNMATCHED

  matchedSale    Sale?    @relation(fields: [matchedSaleId], references: [id])
```

### Fixed approveAlert() Service
```typescript
export async function approveAlert(alertId: string, periodId: string, userId: string) {
  const alert = await prisma.payrollAlert.findUnique({
    where: { id: alertId },
    include: { chargeback: { include: { matchedSale: { include: { payrollEntries: true } } } } },
  });
  if (!alert) throw new Error("Alert not found");
  if (alert.status !== "PENDING") throw new Error("Alert already resolved");

  // Require matched sale
  const saleId = alert.chargeback.matchedSaleId;
  if (!saleId) throw new Error("Chargeback has no matched sale. Match manually before approving.");

  // Dedupe guard (D-03)
  const existingClawback = await prisma.clawback.findFirst({
    where: { saleId, matchedValue: alert.chargebackSubmissionId },
  });
  if (existingClawback) throw new Error("Clawback already exists for this chargeback/sale");

  // Look up commission amount from PayrollEntry (D-04)
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { payrollEntries: true },
  });
  const payrollEntry = sale?.payrollEntries[0];
  const clawbackAmount = payrollEntry ? Number(payrollEntry.payoutAmount) : Number(alert.amount ?? 0);

  // Create clawback with correct sale reference (CLAWBACK-01 fix)
  const clawback = await prisma.clawback.create({
    data: {
      saleId,  // Correct: actual Sale ID, not memberId
      agentId: sale?.agentId || alert.agentId || "",
      matchedBy: "chargeback_alert",
      matchedValue: alert.chargebackSubmissionId,
      amount: clawbackAmount,
      status: "MATCHED",
      appliedPayrollPeriodId: periodId,
      notes: `Auto-created from chargeback. Commission clawback: $${clawbackAmount}`,
    },
  });

  // Emit socket event (CLAWBACK-05)
  emitClawbackCreated({ clawbackId: clawback.id, saleId, amount: clawbackAmount });

  // ... rest of approval logic
}
```

### Socket Event for Clawback Creation
```typescript
// In socket.ts:
export interface ClawbackCreatedPayload {
  clawbackId: string;
  saleId: string;
  agentName?: string;
  amount: number;
}

export function emitClawbackCreated(payload: ClawbackCreatedPayload) {
  io?.emit("clawback:created", payload);
}
```

### Archive Migration SQL
```sql
-- Single migration for all archive tables (Claude's discretion: single migration)

-- call_audits_archive: identical columns, no FKs
CREATE TABLE call_audits_archive (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  call_date TIMESTAMPTZ NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL,
  coaching_notes TEXT,
  reviewer_user_id TEXT,
  transcription TEXT,
  ai_summary TEXT,
  ai_score INTEGER,
  ai_coaching_notes TEXT,
  recording_url TEXT,
  call_outcome TEXT,
  call_duration_estimate TEXT,
  issues JSONB,
  wins JSONB,
  missed_opportunities JSONB,
  suggested_coaching JSONB,
  manager_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_batch_id TEXT NOT NULL
);
CREATE INDEX idx_call_audits_archive_batch ON call_audits_archive(archive_batch_id);
CREATE INDEX idx_call_audits_archive_date ON call_audits_archive(created_at);

-- convoso_call_logs_archive: identical columns, no FKs
CREATE TABLE convoso_call_logs_archive (
  id TEXT PRIMARY KEY,
  agent_user TEXT NOT NULL,
  list_id TEXT NOT NULL,
  recording_url TEXT,
  call_duration_seconds INTEGER,
  call_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  agent_id TEXT,
  lead_source_id TEXT,
  transcription TEXT,
  audit_status TEXT NOT NULL DEFAULT 'pending',
  call_audit_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_batch_id TEXT NOT NULL
);
CREATE INDEX idx_convoso_archive_batch ON convoso_call_logs_archive(archive_batch_id);
CREATE INDEX idx_convoso_archive_date ON convoso_call_logs_archive(created_at);

-- app_audit_log_archive: identical columns, no FKs
CREATE TABLE app_audit_log_archive (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archive_batch_id TEXT NOT NULL
);
CREATE INDEX idx_audit_log_archive_batch ON app_audit_log_archive(archive_batch_id);
CREATE INDEX idx_audit_log_archive_date ON app_audit_log_archive(created_at);

-- ChargebackSubmission: add matching fields
ALTER TABLE chargeback_submissions ADD COLUMN matched_sale_id TEXT REFERENCES sales(id);
ALTER TABLE chargeback_submissions ADD COLUMN match_status TEXT;
```

### Archive Service Pattern
```typescript
// services/archive.ts
import { prisma } from "@ops/db";
import { randomUUID } from "crypto";

const ARCHIVE_TABLES = [
  { main: "call_audits", archive: "call_audits_archive", dateCol: "created_at" },
  { main: "convoso_call_logs", archive: "convoso_call_logs_archive", dateCol: "created_at" },
  { main: "app_audit_log", archive: "app_audit_log_archive", dateCol: "created_at" },
] as const;

export async function archiveRecords(cutoffDate: Date, tables: string[]) {
  const batchId = randomUUID();
  const results: { table: string; count: number }[] = [];

  for (const t of ARCHIVE_TABLES) {
    if (!tables.includes(t.main)) continue;

    // Handle FK: null out call_audit_id on convoso_call_logs if archiving call_audits
    if (t.main === "call_audits") {
      await prisma.$executeRawUnsafe(`
        UPDATE convoso_call_logs SET call_audit_id = NULL
        WHERE call_audit_id IN (SELECT id FROM call_audits WHERE ${t.dateCol} < $1)
      `, cutoffDate);
    }

    // Count first
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM ${t.main} WHERE ${t.dateCol} < $1`, cutoffDate
    );
    const count = Number(countResult[0].count);

    if (count > 0) {
      // Insert into archive with batch metadata
      await prisma.$executeRawUnsafe(`
        INSERT INTO ${t.archive} SELECT *, NOW(), '${batchId}' FROM ${t.main} WHERE ${t.dateCol} < $1
      `, cutoffDate);

      await prisma.$executeRawUnsafe(
        `DELETE FROM ${t.main} WHERE ${t.dateCol} < $1`, cutoffDate
      );
    }

    results.push({ table: t.main, count });
  }

  return { batchId, results };
}
```

### Unmatched Chargeback Visual Indicator (Claude's Discretion)
```typescript
// In CSTracking.tsx table row, recommended approach:
// Add a colored dot/badge next to the chargeback row based on matchStatus
// MATCHED = green badge, MULTIPLE = amber badge "Manual Review", UNMATCHED = red badge "No Match"
<Badge
  color={
    cb.matchStatus === "MATCHED" ? colors.success :
    cb.matchStatus === "MULTIPLE" ? colors.warning :
    colors.danger
  }
  size="sm"
>
  {cb.matchStatus === "MATCHED" ? "Matched" :
   cb.matchStatus === "MULTIPLE" ? "Multiple Matches" : "No Match"}
</Badge>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| approveAlert uses memberId as saleId | Must resolve to actual Sale.id | This phase (bug fix) | Clawback records will reference valid sales |
| Clawback amount = chargeback amount | Clawback amount = agent's commission portion | This phase (D-04) | Agents only clawed back for what they earned |
| No auto-matching | Exact memberId matching on submission | This phase (CLAWBACK-02) | Reduces manual work for CS team |
| No archival | Physical archive to parallel tables | This phase (ARCHIVE-01) | Reduces query scan size on high-volume tables |

## Open Questions

1. **ConvosoCallLog FK handling during archival**
   - What we know: `convoso_call_logs.call_audit_id` has a unique FK to `call_audits.id`. Archiving call_audits without handling this will break.
   - What's unclear: Should we always archive both tables together, or null out the FK on orphaned rows?
   - Recommendation: Null out `call_audit_id` on convoso_call_logs rows before archiving their linked call_audits. This is safer and allows independent archival schedules. The archive tables preserve the original `call_audit_id` value for reference.

2. **AgentCallKpi archival**
   - What we know: ARCHIVE-01 mentions "KPI snapshots" but D-06 only lists three tables. AgentCallKpi is a high-volume table with daily snapshots.
   - What's unclear: Whether AgentCallKpi should be included in archival.
   - Recommendation: Focus on the three tables in D-06 for this phase. AgentCallKpi can be added later if needed -- it has no FK complications and follows the same pattern.

3. **Batch size for large archives**
   - What we know: Production may accumulate 100k+ log rows over 90 days.
   - What's unclear: Exact row volumes to determine if batching is needed.
   - Recommendation: Implement with a batch size of 5000 rows per chunk. If counts are small, the overhead is negligible. If large, it prevents timeouts.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service only) |
| Config file | jest.config.js |
| Quick run command | `npm test -- helpers.test.js` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLAWBACK-01 | approveAlert creates clawback with correct saleId | unit | Manual verification -- no API test infra for ops-api | No |
| CLAWBACK-02 | Auto-match by memberId on submission | unit | Manual verification | No |
| CLAWBACK-03 | Auto-create clawback on approval with commission amount | unit | Manual verification | No |
| CLAWBACK-04 | Unmatched chargebacks show visual indicator | manual-only | Visual inspection in browser | N/A |
| CLAWBACK-05 | Socket event emitted on clawback creation | manual-only | Verify via browser devtools network/socket tab | N/A |
| ARCHIVE-01 | Archive moves rows from main to archive table | unit | Manual verification via SQL count queries | No |
| ARCHIVE-02 | Physical delete from main tables | unit | Verify row count decreases after archive | No |
| ARCHIVE-03 | Restore copies from archive back to main | unit | Manual verification via SQL | No |
| ARCHIVE-04 | Archive stats displayed in owner config | manual-only | Visual inspection in browser | N/A |

### Sampling Rate
- **Per task commit:** Manual API testing via curl/Postman against local dev
- **Per wave merge:** Full manual walkthrough of both chargeback and archive flows
- **Phase gate:** All 9 success criteria verified manually

### Wave 0 Gaps
- No automated test infrastructure exists for ops-api (Jest only covers root Morgan service)
- All validation will be manual API testing + browser verification
- This matches the pattern used in all previous ops-api phases

## Sources

### Primary (HIGH confidence)
- `apps/ops-api/src/services/alerts.ts` -- Current approveAlert() code showing saleId bug at line 46
- `apps/ops-api/src/routes/chargebacks.ts` -- Current submission flow, no matching logic
- `prisma/schema.prisma` -- Full schema including ChargebackSubmission, Clawback, CallAudit, ConvosoCallLog, AppAuditLog models
- `apps/ops-api/src/services/payroll.ts` -- Commission calculation and PayrollEntry upsert logic
- `apps/ops-api/src/socket.ts` -- Socket.IO emit patterns
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerConfig.tsx` -- Config tab UI patterns
- `apps/ops-api/src/routes/payroll.ts` -- Existing manual clawback creation route pattern

### Secondary (MEDIUM confidence)
- Prisma raw SQL documentation for `$executeRawUnsafe` and `$queryRawUnsafe` usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies needed
- Architecture: HIGH -- follows established patterns in codebase, clear schema changes
- Pitfalls: HIGH -- identified from direct code analysis (FK constraints, memberId confusion, batch sizing)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- internal codebase patterns)
