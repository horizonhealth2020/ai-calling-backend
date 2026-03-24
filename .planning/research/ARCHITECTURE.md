# Architecture Patterns: v1.5 Feature Integration

**Domain:** v1.5 Platform Cleanup and Remaining Features for Ops Platform
**Researched:** 2026-03-24
**Confidence:** HIGH (all recommendations based on direct codebase analysis)

## Current Architecture Snapshot

The ops-api is a single Express app (`apps/ops-api/src/index.ts`) mounting all routes from one 2750-line flat file (`apps/ops-api/src/routes/index.ts`). Business logic lives in 9 service files under `apps/ops-api/src/services/`. The frontend is a unified Next.js 15 app (`apps/ops-dashboard`) with 4 tab directories (`manager`, `payroll`, `owner`, `cs`), each containing sub-components rendered by a `page.tsx` that switches on active tab state.

```
ops-api/src/
  index.ts              # Express + Socket.IO setup, mounts /api
  routes/index.ts       # 2750 lines, ~95 route handlers, single Router
  services/             # 9 service files (payroll, alerts, audit, etc.)
  middleware/auth.ts    # requireAuth, requireRole
  socket.ts             # Socket.IO emit helpers
  workers/              # Convoso KPI poller

ops-dashboard/app/(dashboard)/
  layout.tsx            # Tab bar, Socket.IO provider, role-gated tabs
  manager/              # ManagerEntry, page.tsx
  payroll/              # PayrollPeriods, PayrollProducts, PayrollExports, etc.
  owner/                # OwnerOverview, OwnerKPIs, OwnerConfig, OwnerUsers
  cs/                   # CSSubmissions, CSTracking
```

Key data models relevant to v1.5: `CallAudit` (AI scoring), `ChargebackSubmission` + `PayrollAlert` + `Clawback` (chargeback-to-clawback chain), `PayrollEntry` + `ServicePayrollEntry` (payroll), `ConvosoCallLog` + `AiUsageLog` (AI pipeline).

---

## 1. Route File Splitting

### Problem

`routes/index.ts` is 2750 lines with 95 route handlers. Every feature touches this file, creating merge conflicts and cognitive overload.

### Recommended Pattern: Domain Router Modules

Split into domain-scoped router files, each exporting a `Router` instance mounted by a barrel `index.ts`. This is the standard Express pattern and requires zero library changes.

**Target structure:**

```
routes/
  helpers.ts        # zodErr, asyncHandler, dateRange -- shared utilities
  index.ts          # Barrel: imports + mounts sub-routers
  auth.ts           # /auth/* + /session/* (login, logout, change-password, refresh, me) ~50 lines
  users.ts          # /users/* CRUD ~50 lines
  agents.ts         # /agents/* CRUD + reactivate ~80 lines
  sales.ts          # /sales/* CRUD, preview, status, approve/unapprove ~450 lines
  payroll.ts        # /payroll/* periods, entries, mark-paid/unpaid, service-entries ~350 lines
  clawbacks.ts      # /clawbacks + /alerts/* ~120 lines
  products.ts       # /products/* CRUD + state-availability ~200 lines
  lead-sources.ts   # /lead-sources/* CRUD ~50 lines
  reporting.ts      # /owner/summary, /reporting/periods, /sales-board/*, /tracker ~250 lines
  cs.ts             # /chargebacks/*, /pending-terms/*, /reps/*, /cs-rep-roster/* ~350 lines
  call-audit.ts     # /call-audits/*, /call-recordings, /call-counts, /call-logs/* ~200 lines
  ai.ts             # /ai/* usage-stats, auto-score, budget ~50 lines
  settings.ts       # /settings/* ai-audit-prompt, audit-duration, service-bonus-categories ~80 lines
  admin.ts          # /permissions/*, /storage-stats, /agent-kpis ~120 lines
  webhooks.ts       # /webhooks/convoso ~80 lines
```

**Shared utilities extraction -- `routes/helpers.ts`:**

Three functions currently defined at the top of `routes/index.ts` must be extracted to avoid circular imports:

```typescript
// routes/helpers.ts
import { z } from "zod";
import { Request, Response, NextFunction } from "express";

/** Format Zod errors so the response always includes an `error` key */
export function zodErr(ze: z.ZodError) { /* ... exact current impl ... */ }

/** Wrap async route handlers so errors are forwarded to Express error handler */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

/** Compute date-range boundaries from a `range` query param or custom from/to dates */
export function dateRange(range?: string, from?: string, to?: string): { gte: Date; lt: Date } | undefined {
  /* ... exact current impl (~50 lines) ... */
}
```

**Barrel file pattern:**

```typescript
// routes/index.ts
import { Router } from "express";
import auth from "./auth";
import users from "./users";
import agents from "./agents";
import sales from "./sales";
import payroll from "./payroll";
import clawbacks from "./clawbacks";
import products from "./products";
import leadSources from "./lead-sources";
import reporting from "./reporting";
import cs from "./cs";
import callAudit from "./call-audit";
import ai from "./ai";
import settings from "./settings";
import admin from "./admin";
import webhooks from "./webhooks";

const router = Router();
router.use(auth);
router.use(users);
router.use(agents);
router.use(sales);
router.use(payroll);
router.use(clawbacks);
router.use(products);
router.use(leadSources);
router.use(reporting);
router.use(cs);
router.use(callAudit);
router.use(ai);
router.use(settings);
router.use(admin);
router.use(webhooks);

export default router;
```

**Each domain file pattern:**

```typescript
// routes/sales.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, zodErr, dateRange } from "./helpers";
import { upsertPayrollEntryForSale, /* ... */ } from "../services/payroll";
import { emitSaleChanged } from "../socket";

const router = Router();

router.post("/sales", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  // ... handler body unchanged
}));

// ... all /sales/* handlers moved here verbatim

export default router;
```

### Route-to-File Mapping

| Route Prefix | Target File | Line Count (approx) | Handlers |
|-------------|-------------|---------------------|----------|
| `/auth/*`, `/session/*` | `auth.ts` | 50 | 5 |
| `/users/*` | `users.ts` | 50 | 4 |
| `/agents/*` | `agents.ts` | 80 | 5 |
| `/lead-sources/*` | `lead-sources.ts` | 50 | 4 |
| `/products/*` | `products.ts` | 200 | 6 |
| `/sales/*` | `sales.ts` | 450 | 10 |
| `/tracker/*` | `reporting.ts` | 250 | 5 |
| `/payroll/*` | `payroll.ts` | 350 | 8 |
| `/clawbacks`, `/alerts/*` | `clawbacks.ts` | 120 | 5 |
| `/service-agents/*` | `payroll.ts` | (included above) | 3 |
| `/owner/*`, `/reporting/*`, `/sales-board/*` | `reporting.ts` | (included above) | 5 |
| `/webhooks/*` | `webhooks.ts` | 80 | 1 |
| `/call-recordings`, `/call-audits/*`, `/call-counts`, `/call-logs/*` | `call-audit.ts` | 200 | 7 |
| `/settings/*` | `settings.ts` | 80 | 5 |
| `/status-change-requests/*`, `/sale-edit-requests/*` | `sales.ts` | (included above) | 6 |
| `/chargebacks/*`, `/pending-terms/*`, `/reps/*`, `/cs-rep-roster/*` | `cs.ts` | 350 | 14 |
| `/ai/*` | `ai.ts` | 50 | 3 |
| `/permissions/*`, `/storage-stats`, `/agent-kpis` | `admin.ts` | 120 | 4 |

### What Changes vs What Stays

- **Changes:** File boundaries only. Every handler body stays identical.
- **Stays:** Route paths, middleware, service imports, Socket.IO emitters, Zod schemas.
- **Risk:** LOW. Pure refactor, no behavior change. Verify by hitting every endpoint before and after.

---

## 2. AI Scoring Dashboard

### Current State

AI scoring infrastructure already exists:
- `CallAudit` model stores structured audit data (issues, wins, missed_opportunities, suggested_coaching, scores)
- `AiUsageLog` tracks token usage and cost
- `callAudit.ts` service processes recordings through Claude/OpenAI
- `auditQueue.ts` manages batch auto-scoring
- API endpoints: `GET /call-audits`, `GET /ai/usage-stats`, `POST /ai/auto-score`, `PUT /ai/budget`

### What Needs to Be Built

**New dashboard section** on the Owner page. Currently Owner has 4 sections: `overview`, `kpis`, `config`, `users`. Add a 5th: `scoring`.

**New component:** `OwnerScoring.tsx` in `apps/ops-dashboard/app/(dashboard)/owner/`

**New API endpoints (go in `routes/ai.ts` after route splitting):**

| Endpoint | Purpose | Data Source |
|----------|---------|-------------|
| `GET /ai/scoring-summary` | Aggregate stats: avg score, total audits, score distribution buckets | `CallAudit` aggregate queries |
| `GET /ai/scoring-trends` | Score trends over time (weekly averages for last 8 weeks) | `CallAudit` grouped by week |
| `GET /ai/agent-scores` | Per-agent score breakdown with delta vs prior period | `CallAudit` grouped by agent + period |

**Data flow:**

```
CallAudit table (existing data)
  |
  +--> GET /ai/scoring-summary --> OwnerScoring (KPI cards at top)
  |      Returns: { totalAudits, avgScore, distribution: { low: n, mid: n, high: n, excellent: n } }
  |
  +--> GET /ai/scoring-trends  --> OwnerScoring (weekly trend table)
  |      Returns: [{ week: "2026-03-16", avgScore: 72, auditCount: 15 }, ...]
  |
  +--> GET /ai/agent-scores    --> OwnerScoring (agent breakdown table)
         Returns: [{ agentId, agentName, totalAudits, avgScore, lastScore, priorAvg }, ...]
```

### Component Structure

```typescript
// OwnerScoring.tsx
// Props: { API: string }
// State: scoringSummary, trends, agentScores, dateRange
//
// Layout:
//   DateRangeFilter (reuse from @ops/ui)
//   KPI row: Total Audits | Avg Score | Distribution breakdown (4 buckets: 0-40, 41-60, 61-80, 81-100)
//   Trend table: Week | Audits | Avg Score | Delta from prior week
//   Agent table: Agent | Total Audits | Avg Score | Last Score | Trend (up/down/flat arrow)
```

### Architecture Decision: No Chart Library

Use table-based trend display (week-over-week with delta arrows) rather than adding a chart library. This matches the existing pattern -- owner overview uses `AnimatedNumber` KPI cards and tables, not charts. Adding recharts/chart.js would add ~200KB to the bundle for one component.

### Integration Points

- **Existing reuse:** `DateRangeFilter` from `@ops/ui`, `authFetch` from `@ops/auth/client`, `AnimatedNumber` from `@ops/ui`
- **New route file:** `routes/ai.ts` gets the 3 new endpoints
- **Modified file:** `owner/page.tsx` adds the `scoring` tab to navItems and renders `OwnerScoring`
- **No schema changes needed** -- all data already exists in `CallAudit` and `AiUsageLog`

---

## 3. Chargeback to Clawback Auto-Creation

### Current Data Flow (Manual, 3-Step)

```
Step 1: CS submits chargeback batch (POST /chargebacks)
  --> Creates ChargebackSubmission rows
  --> For each: createAlertFromChargeback() --> PayrollAlert (PENDING)
  --> Socket.IO: alert:created

Step 2: Payroll user views alerts (GET /alerts)
  --> Sees pending alerts with chargeback details
  --> Must manually identify which agent/sale is affected

Step 3: Payroll user approves (POST /alerts/:id/approve)
  --> Must select a payroll period
  --> Creates Clawback record
  --> Updates PayrollAlert to APPROVED
  --> Socket.IO: alert:resolved
```

### Known Bug in Current approveAlert

In `services/alerts.ts` line 46, `approveAlert` creates a clawback with `saleId: alert.chargeback.memberId`. This is wrong -- `memberId` is a member identifier string (like "ABC12345"), not a Prisma Sale ID (cuid). The auto-creation flow must fix this by looking up the Sale by memberId.

### Proposed Auto-Creation Flow

Add an automated path that runs after alert creation, attempting to match the chargeback to an existing sale:

```
POST /chargebacks (batch submission)
  |
  For each chargeback in batch:
  |
  +--> createAlertFromChargeback() [existing, unchanged]
  |
  +--> autoMatchAndClawback(chargebackSubmission, alertId) [NEW]
       |
       +--> Match by memberId to Sale.memberId (exact match)
       |    OR match by payeeName to Sale.memberName (normalized exact)
       |
       +--> [MATCH FOUND]
       |    +--> Find Sale's most recent PayrollEntry
       |    +--> If entry not PAID: Create Clawback(ZEROED), zero out entry
       |    +--> If entry PAID: Create Clawback(DEDUCTED), adjust current open period
       |    +--> Update PayrollAlert to APPROVED (auto_matched: true)
       |    +--> Socket.IO: alert:resolved + sale:changed
       |    +--> Audit log: clawback_auto_created
       |
       +--> [NO MATCH]
            +--> PayrollAlert stays PENDING
            +--> Payroll user reviews manually (existing flow, unchanged)
```

### New Service: `services/clawbackAutomation.ts`

```typescript
export interface AutoMatchResult {
  matched: boolean;
  clawbackId?: string;
  saleId?: string;
  reason?: string;  // "matched_by_member_id" | "matched_by_member_name" | "no_sale_match" | "no_open_period"
}

export async function autoMatchAndClawback(
  chargebackSubmission: ChargebackSubmission,
  alertId: string
): Promise<AutoMatchResult>
```

Internal steps:
1. Load ChargebackSubmission fields: `memberId`, `payeeName`, `chargebackAmount`
2. Find Sale by `memberId` (exact match on `Sale.memberId`). If not found, try normalized `payeeName` match on `Sale.memberName` (lowercase, trimmed).
3. If no sale found: return `{ matched: false, reason: "no_sale_match" }`
4. Check if Clawback already exists for this chargebackSubmissionId (idempotency guard)
5. Find Sale's most recent PayrollEntry (ordered by createdAt desc)
6. Create Clawback record (reuse logic from existing `POST /clawbacks` handler)
7. Update PayrollAlert: `{ status: "APPROVED", autoMatched: true, matchedSaleId: sale.id }`
8. Emit socket events
9. Return `{ matched: true, clawbackId, saleId }`

### Key Design Decisions

**Match strategy:** Exact match on `memberId` first, then normalized name match (lowercase, trim whitespace). Do NOT use fuzzy/Levenshtein matching. False positives on clawbacks are far worse than false negatives. Unmatched chargebacks stay as manual alerts -- this is the safe default.

**Period selection for auto-clawbacks:** Use the current open payroll period (most recent by weekStart). If no open period exists, leave as manual alert with reason `no_open_period`.

**Idempotency:** Before creating a clawback, check if one already exists where `matchedValue = chargebackSubmissionId`. This prevents duplicate clawbacks if the automation runs twice.

### Schema Changes

**Migration: `add_clawback_automation_fields`**

```prisma
model Clawback {
  // ... existing fields unchanged
  sourceAlertId String? @map("source_alert_id")  // Links back to PayrollAlert if auto-created
}

model PayrollAlert {
  // ... existing fields unchanged
  autoMatched   Boolean  @default(false) @map("auto_matched")
  matchedSaleId String?  @map("matched_sale_id")
}
```

Two nullable columns added. No existing data affected. No foreign key constraints on these (simple audit trail fields).

### Integration Points

- **Modified:** `POST /chargebacks` handler in `routes/cs.ts` -- calls `autoMatchAndClawback` after `createAlertFromChargeback` for each submission
- **Modified:** `services/alerts.ts` `approveAlert` function -- fix the saleId bug (lookup sale by memberId instead of using memberId as saleId)
- **New file:** `services/clawbackAutomation.ts`
- **New migration:** Add `source_alert_id` to `clawbacks`, `auto_matched` + `matched_sale_id` to `payroll_alerts`
- **Socket.IO:** Emits existing `alert:resolved` and `sale:changed` events -- no new event types needed

---

## 4. Data Archival with Restore

### What to Archive

Tables that grow unboundedly and are not core business data:

| Table | Row Estimate/Month | Archive After | Rationale |
|-------|-------------------|---------------|-----------|
| `convoso_call_logs` | Highest | 90 days | Raw call data, audited copies preserved in call_audits |
| `processed_convoso_calls` | High | 90 days | Dedup tracking only, no business value after processing |
| `call_audits` | Medium-High | 90 days | Scored calls, trends computed at query time |
| `ai_usage_logs` | Medium | 180 days | Cost tracking, monthly summaries sufficient |
| `app_audit_log` | Medium | 180 days | Compliance trail, older entries rarely queried |
| `agent_call_kpis` | Medium | 180 days | Daily snapshots, aggregated in queries |

**Tables NOT to archive:** `sales`, `payroll_entries`, `payroll_periods`, `clawbacks`, `chargeback_submissions`, `pending_terms`, `users`, `agents`, `products` -- these are core business data that must remain queryable indefinitely.

### Recommended Architecture: Parallel Archive Tables

Use `*_archive` tables in the same database. This keeps restore trivial (SQL INSERT...SELECT) and avoids external storage dependencies.

**Why not external storage (S3, separate DB)?**
- Railway PostgreSQL is the only infra. Adding S3 or a second DB increases deployment complexity.
- Archive tables use the same Prisma `$queryRaw` interface already used for reporting queries.
- The storage savings come from reducing the main table sizes for faster queries and smaller indexes, not from moving data off-disk entirely.

### Implementation

**New migration: `create_archive_tables`**

Archive tables mirror source structure but drop foreign key constraints (archived data is frozen):

```sql
-- For each archivable table:
CREATE TABLE convoso_call_logs_archive AS SELECT * FROM convoso_call_logs WHERE false;
ALTER TABLE convoso_call_logs_archive ADD COLUMN archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- No foreign keys on archive tables -- data is frozen

CREATE TABLE call_audits_archive AS SELECT * FROM call_audits WHERE false;
ALTER TABLE call_audits_archive ADD COLUMN archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ... repeat for each table
```

Archive tables are NOT added to `schema.prisma`. They are accessed exclusively via `prisma.$queryRaw`. This avoids polluting the Prisma client with duplicate models.

**New service: `services/archival.ts`**

```typescript
export interface ArchivalConfig {
  table: string;
  archiveTable: string;
  dateColumn: string;
  retentionDays: number;
}

export const ARCHIVAL_CONFIGS: ArchivalConfig[] = [
  { table: "convoso_call_logs", archiveTable: "convoso_call_logs_archive", dateColumn: "created_at", retentionDays: 90 },
  { table: "call_audits", archiveTable: "call_audits_archive", dateColumn: "created_at", retentionDays: 90 },
  { table: "ai_usage_logs", archiveTable: "ai_usage_logs_archive", dateColumn: "created_at", retentionDays: 180 },
  { table: "app_audit_log", archiveTable: "app_audit_log_archive", dateColumn: "created_at", retentionDays: 180 },
  { table: "processed_convoso_calls", archiveTable: "processed_convoso_calls_archive", dateColumn: "processed_at", retentionDays: 90 },
  { table: "agent_call_kpis", archiveTable: "agent_call_kpis_archive", dateColumn: "created_at", retentionDays: 180 },
];

// Archive old records from main table to archive table
export async function archiveTable(config: ArchivalConfig): Promise<{ archived: number }>

// Restore specific records by ID from archive back to main table
export async function restoreFromArchive(config: ArchivalConfig, ids: string[]): Promise<{ restored: number }>

// Get row counts for main + archive tables
export async function getArchivalStats(): Promise<Array<{
  table: string;
  mainCount: number;
  archiveCount: number;
  oldestMainDate: string | null;
}>>
```

The archive operation runs in a transaction: INSERT into archive, DELETE from main. Uses `prisma.$executeRaw` with parameterized queries.

**New API endpoints (go in `routes/admin.ts`):**

| Endpoint | Method | Purpose | Role |
|----------|--------|---------|------|
| `/admin/archive/stats` | GET | Row counts and oldest dates per table | OWNER_VIEW, SUPER_ADMIN |
| `/admin/archive/run` | POST | Trigger archival for all configured tables | SUPER_ADMIN |
| `/admin/archive/run/:table` | POST | Trigger archival for one specific table | SUPER_ADMIN |
| `/admin/archive/restore` | POST | Restore specific record IDs | SUPER_ADMIN |

**UI location:** Owner dashboard > Config tab (existing `OwnerConfig.tsx`). Add a "Data Management" section below the existing AI config sections. Shows:
- Table-by-table stats (main count, archive count, oldest record)
- "Archive Now" button per table (or "Archive All")
- Storage usage from existing `/storage-stats` endpoint displayed alongside

### Restore Flow

Restore is by record ID. The flow:
1. Admin views archive stats, sees archived record counts
2. POST `/admin/archive/restore` with `{ table: "call_audits", ids: ["abc", "def"] }`
3. Service validates IDs exist in archive table
4. INSERT from archive back to main (transaction)
5. DELETE from archive
6. Return `{ restored: 2 }`

Note: Restore may fail if foreign key targets no longer exist (e.g., agent was deleted). The service should catch FK violations and return a clear error listing which records could not be restored and why.

### Foreign Key Handling During Archive

Before deleting from `convoso_call_logs`, must handle the `call_audit_id` FK:
- `ConvosoCallLog.callAuditId` references `CallAudit.id` (one-to-one)
- If archiving call_audits first, the convoso_call_log FK becomes dangling
- **Solution:** Archive `convoso_call_logs` first (it references call_audits), then archive `call_audits`. Or null out the `callAuditId` before archiving.
- Better: archive both in the same transaction when their dates overlap.

---

## 5. CS Payroll on Owner Dashboard Period Summary

### Current State

`GET /owner/summary` returns: `salesCount`, `premiumTotal`, `clawbacks`, `openPayrollPeriods`, and trend comparisons. It does NOT include service payroll data.

`GET /reporting/periods` returns weekly/monthly period summaries with sales commission but no service payroll totals.

### Changes Required

**Modified endpoint: `GET /owner/summary`**

Add `ServicePayrollEntry` aggregate to `fetchSummaryData`:

```typescript
// Add to the Promise.all in fetchSummaryData:
const servicePayroll = await prisma.servicePayrollEntry.aggregate({
  where: range ? { payrollPeriod: { weekStart: { gte: range.gte, lt: range.lt } } } : {},
  _sum: { totalPay: true },
  _count: true,
});

// Add to return:
return {
  ...existing,
  servicePayrollTotal: Number(servicePayroll._sum.totalPay ?? 0),
  serviceStaffCount: servicePayroll._count,
};
```

**Modified endpoint: `GET /reporting/periods` (weekly view)**

Add `serviceEntries` include and compute `servicePayrollTotal` per period:

```typescript
// Add to include:
serviceEntries: { select: { totalPay: true, status: true } }

// Add to result mapping:
servicePayrollTotal: p.serviceEntries.reduce((s, se) => s + Number(se.totalPay), 0),
```

**Modified component: `OwnerOverview.tsx`**

Add a new KPI card after the existing "Clawbacks" card:

```typescript
// New card in the KPI row:
{ label: "CS Payroll", value: summary.servicePayrollTotal, format: "dollar", trend: trends?.servicePayrollTotal }
```

This follows the existing KPI card pattern already used for Sales, Premium, and Clawbacks in `OwnerOverview.tsx`.

### Integration Points

- **Modified:** `GET /owner/summary` handler (in `routes/reporting.ts` after split) -- add ServicePayrollEntry aggregate
- **Modified:** `GET /reporting/periods` handler -- add serviceEntries include + total
- **Modified:** `OwnerOverview.tsx` -- add KPI card for CS payroll
- **No schema changes**
- **No new components** -- reuses existing KPI card pattern

---

## 6. Payroll CSV Export Matching Print Card Format

### Current Export Formats

Two CSV formats exist in `PayrollExports.tsx`:
- **Summary CSV:** Period-level rows (week start/end, quarter, status, entry count, gross, net)
- **Detailed CSV:** Entry-level rows with agent subtotals (agent, member ID/name, core/addon/AD&D, enroll fee, commission, bonus, fronted, hold, net)

### Print Card Format (what CSV should match)

The `printAgentCards` function in `PayrollPeriods.tsx` generates per-agent printable cards with:
- **Agent header:** name, week range, quarter, sale count
- **Summary row:** Commission total, Bonuses, Fronted, Hold, Net Payout
- **Entry table:** Member ID | Member Name | Core | Add-on | AD&D | Enroll Fee | Commission | Net
- **Subtotal row** at bottom

### Gap Analysis

The detailed CSV is close but structured differently. It interleaves agent subtotals between entry rows. The print card format groups everything under clear agent headers with summary data. The CSV version does not include the agent-level summary (commission/bonus/fronted/hold/net) as a header row -- it only has subtotal rows after entries.

### New Format: "Print Card CSV"

Add a third export option that matches the print card layout exactly:

```csv
Agent: John Smith
Week: 03-16-2026 to 03-22-2026 | Q1 2026 | 5 sales
Commission: $450.00 | Bonuses: +$20.00 | Fronted: -$50.00 | Hold: -$0.00 | Net: $420.00
Member ID,Member Name,Core,Add-on,AD&D,Enroll Fee,Commission,Net
ABC123,"Jane Doe","Globe Life","$15.00 Monthly","--",$125.00,$90.00,$90.00
DEF456,"Bob Smith","Globe Life","--","--",$99.00,$45.00,$45.00
SUBTOTAL,,,,,,,$450.00,$420.00

Agent: Sarah Jones
Week: 03-16-2026 to 03-22-2026 | Q1 2026 | 3 sales
Commission: $270.00 | Bonuses: +$10.00 | Fronted: -$0.00 | Hold: -$0.00 | Net: $280.00
Member ID,Member Name,Core,Add-on,AD&D,Enroll Fee,Commission,Net
...
```

### Implementation

**Client-side only.** Add `exportPrintCardCSV()` function to `PayrollExports.tsx`:

1. Filter periods by date range (reuse existing `filterPeriodsByDateRange`)
2. For each period, group entries by agent (reuse existing grouping logic)
3. For each agent group:
   - Emit agent header row (name)
   - Emit summary metadata row (week, quarter, sale count)
   - Emit summary values row (commission, bonus, fronted, hold, net)
   - Emit column header row
   - Emit entry rows matching print card columns
   - Emit subtotal row
   - Emit blank separator line

Add a third export button in the exports UI labeled "Print Card CSV" with description: "Per-agent cards matching the print layout -- agent header, summary, entries, subtotals."

### Integration Points

- **Modified:** `PayrollExports.tsx` -- add `exportPrintCardCSV()` function and third export button
- **No API changes** -- all data already available in the `periods` prop
- **No schema changes**

---

## Component Boundaries (All Features)

| Component | Responsibility | New/Modified | Communicates With |
|-----------|---------------|-------------|-------------------|
| `routes/helpers.ts` | Shared zodErr, asyncHandler, dateRange | NEW | All route files import from it |
| `routes/*.ts` (16 files) | Domain-scoped route handlers | NEW (split from index.ts) | Services, middleware, socket |
| `routes/ai.ts` | AI scoring + dashboard endpoints | NEW | `services/callAudit.ts`, `services/auditQueue.ts` |
| `routes/admin.ts` | Permissions, storage, archival endpoints | NEW | `services/archival.ts` |
| `services/clawbackAutomation.ts` | Auto-match chargeback to sale, create clawback | NEW | Prisma, `services/alerts.ts`, `socket.ts` |
| `services/archival.ts` | Archive/restore data across tables | NEW | Prisma raw queries |
| `OwnerScoring.tsx` | AI scoring dashboard UI | NEW | `GET /ai/scoring-*` endpoints |
| `owner/page.tsx` | Owner tab management | MODIFIED (add scoring tab) | Renders OwnerScoring |
| `OwnerOverview.tsx` | Owner KPI cards | MODIFIED (add CS payroll card) | `GET /owner/summary` |
| `OwnerConfig.tsx` | AI config + data management UI | MODIFIED (add archival section) | `GET/POST /admin/archive/*` |
| `PayrollExports.tsx` | CSV export options | MODIFIED (add print card CSV) | Local period data |
| `routes/cs.ts` (chargebacks handler) | Chargeback submission | MODIFIED (call autoMatch) | `services/clawbackAutomation.ts` |
| `services/alerts.ts` | Alert CRUD | MODIFIED (fix approveAlert bug) | Prisma |

### What Does NOT Change

| Component | Why Unchanged |
|-----------|--------------|
| `prisma/schema.prisma` core models | Sale, PayrollEntry, Product etc. stay identical |
| `socket.ts` | Existing events sufficient, no new event types |
| `middleware/auth.ts` | Same RBAC roles, no new permissions |
| `@ops/ui` package | Reuses existing components (DateRangeFilter, Card, AnimatedNumber, Button) |
| `@ops/auth` package | No auth changes |
| Manager dashboard | No changes to sales entry flow |
| CS dashboard | No UI changes (backend auto-match is invisible to CS users) |
| Sales board | No changes |

---

## Data Flow: Complete Chargeback to Clawback Pipeline

```
CS User pastes chargeback data
  |
  v
POST /chargebacks (batch create, in routes/cs.ts)
  |
  +--> For each row: Create ChargebackSubmission
  |
  +--> For each: createAlertFromChargeback()
  |    --> PayrollAlert (status: PENDING)
  |    --> Socket.IO: alert:created
  |
  +--> For each: autoMatchAndClawback() [NEW]
       |
       +--> Find Sale by memberId (exact) or memberName (normalized)
       |
       +--> [MATCH FOUND]
       |    |
       |    +--> Find Sale's most recent PayrollEntry
       |    |
       |    +--> [Entry NOT PAID]
       |    |    +--> Create Clawback (status: ZEROED)
       |    |    +--> Zero out PayrollEntry (payoutAmount: 0, netAmount: 0, status: ZEROED_OUT)
       |    |
       |    +--> [Entry PAID]
       |    |    +--> Find current OPEN PayrollPeriod
       |    |    +--> Create Clawback (status: DEDUCTED, appliedPayrollPeriodId)
       |    |    +--> Adjust entry: adjustmentAmount -= netAmount
       |    |
       |    +--> Update PayrollAlert (status: APPROVED, autoMatched: true, matchedSaleId)
       |    +--> Socket.IO: alert:resolved, sale:changed
       |    +--> Audit log: clawback_auto_created
       |
       +--> [NO MATCH]
            |
            +--> PayrollAlert stays PENDING
            +--> Payroll user reviews manually (unchanged flow)
            |
            +--> [Manual approve: POST /alerts/:id/approve]
                 +--> Select period, create Clawback (existing flow, but with saleId bug fixed)
```

---

## Suggested Build Order

Build order based on dependency analysis. Each phase is independently deployable.

| Order | Feature | Scope | Schema Migration | Depends On |
|-------|---------|-------|-----------------|------------|
| 1 | Route splitting | Backend refactor | None | Nothing |
| 2 | CS payroll on owner dashboard | Backend + frontend | None | Route splitting (cleaner diff) |
| 3 | Payroll CSV print card format | Frontend only | None | Nothing |
| 4 | AI scoring dashboard | Backend + frontend | None | Route splitting (new endpoints go in ai.ts) |
| 5 | Chargeback-to-clawback automation | Backend + migration | Yes (2 columns) | Route splitting (modifies cs.ts) |
| 6 | Data archival | Backend + frontend + migration | Yes (6 tables) | Route splitting (new admin.ts endpoints) |

**Rationale:**
- Route splitting FIRST eliminates the 2750-line file every other feature would touch. All subsequent work targets clean, small files.
- Features 2 and 3 are smallest scope with no schema changes -- quick wins to ship early.
- Feature 4 (AI scoring) adds new endpoints but no schema migration, moderate complexity.
- Feature 5 (clawback automation) modifies existing chargeback submission flow and adds a migration. Done after route splitting so the change is isolated to `routes/cs.ts` + `services/clawbackAutomation.ts`.
- Feature 6 (archival) is the riskiest work (raw SQL, data deletion, FK handling). Benefits from all other features being stable. Ship last.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Prisma Models for Archive Tables
**What:** Adding archive table models to `schema.prisma`
**Why bad:** Duplicates every model, pollutes generated client, archive tables have no FK constraints. Prisma would try to manage their migrations.
**Instead:** Use `prisma.$queryRaw` / `$executeRaw` for all archive operations. Keep archive tables as raw SQL in migrations only.

### Anti-Pattern 2: Fuzzy Matching for Auto-Clawbacks
**What:** Using Levenshtein distance, soundex, or partial string matching to match chargebacks to sales.
**Why bad:** False positive clawbacks directly reduce agent pay incorrectly. One bad match destroys trust in the system and creates accounting problems.
**Instead:** Exact match on memberId, normalized exact match on memberName. Everything else stays as a manual alert.

### Anti-Pattern 3: Moving HTTP Logic into Service Files During Route Split
**What:** During route splitting, moving req/res handling, status codes, and Zod parsing into services.
**Why bad:** Services should be pure business logic callable from anywhere (API routes, tests, workers). Mixing HTTP concerns makes them untestable and coupled to Express.
**Instead:** Route files handle HTTP (parse request, validate with Zod, set response status). Services handle business logic (query, calculate, write).

### Anti-Pattern 4: Adding a Chart Library for AI Scoring Dashboard
**What:** Installing recharts, chart.js, or nivo for trend visualization.
**Why bad:** Adds ~150-200KB to the client bundle for one component. Every other dashboard in the app uses table-based KPIs with `AnimatedNumber` and delta arrows.
**Instead:** Table-based trend display with week-over-week comparison and up/down/flat indicators. Matches existing UX patterns.

### Anti-Pattern 5: Archiving in a Background Cron Without User Trigger
**What:** Automatically archiving data on a schedule without user awareness.
**Why bad:** Silent data deletion is dangerous. If archival has a bug (e.g., wrong date column), data disappears without anyone noticing.
**Instead:** Manual trigger from Owner dashboard with confirmation. Show what will be archived (counts) before executing. Log the operation in audit log.

---

## Sources

- Direct codebase analysis:
  - `apps/ops-api/src/routes/index.ts` -- 2750 lines, 95 handlers, all route definitions
  - `apps/ops-api/src/services/alerts.ts` -- existing alert creation/approval flow, identified saleId bug
  - `apps/ops-api/src/services/callAudit.ts` -- AI scoring pipeline, CallAudit model usage
  - `apps/ops-api/src/services/payroll.ts` -- commission calculation, payroll entry management
  - `apps/ops-api/src/index.ts` -- Express app setup, Socket.IO, route mounting
  - `apps/ops-api/src/socket.ts` -- all Socket.IO event types
  - `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- print card HTML format
  - `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` -- existing CSV export formats
  - `apps/ops-dashboard/app/(dashboard)/owner/page.tsx` -- owner tab structure pattern
  - `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` -- KPI card pattern
  - `apps/ops-dashboard/app/(dashboard)/layout.tsx` -- dashboard tab navigation
  - `prisma/schema.prisma` -- all 28 models, 645 lines
  - `.planning/PROJECT.md` -- project context, v1.5 scope, architecture decisions
- Confidence: HIGH -- all recommendations derived from direct code analysis with no external dependencies
