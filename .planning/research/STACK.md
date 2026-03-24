# Technology Stack — v1.5 Additions

**Project:** Ops Platform v1.5 (Platform Cleanup & Remaining Features)
**Researched:** 2026-03-24
**Confidence:** HIGH

## Key Finding: No New Libraries Required (Again)

Every v1.5 feature is implementable with the existing dependency tree. The most notable discovery: **recharts v3.8.0 is already installed** in the root package.json but has never been used in any dashboard component. All `BarChart3` references in the codebase are Lucide icons, not Recharts chart components. This is the charting library for the AI scoring dashboard.

## What Already Exists (Do Not Change)

| Package | Version | Used For in v1.5 |
|---------|---------|------------------|
| recharts | 3.8.0 | AI score trend charts (installed but unused until now) |
| @prisma/client | ^5.20.0 | Soft-delete archival via client extensions, groupBy aggregation for score trends |
| express | ^4.19.2 | Route splitting via Router composition |
| @anthropic-ai/sdk | ^0.78.0 | Already powers AI call scoring |
| zod | ^3.23.8 | Validation for new endpoints |
| socket.io | ^4.8.3 | Real-time updates for clawback events |
| luxon | ^3.4.4 | Timezone-safe date handling for archival queries |
| lucide-react | ^0.577.0 | Icons for new dashboard sections |

## Stack Decisions by Feature

---

### 1. AI Scoring Dashboard — Use Recharts (Already Installed)

**Decision:** Use `recharts` 3.8.0 from root package.json. Add it to `apps/ops-dashboard/package.json` as well so the dependency is explicit for the workspace.

**Why Recharts fits this project:**
- React-native components (not a canvas wrapper) -- composes naturally with existing JSX patterns
- Accepts inline style values directly via `stroke`, `fill` props -- matches the project's CSSProperties-only styling approach
- SVG-based rendering -- crisp at any zoom, no canvas blurriness
- Already installed, zero new bundle size cost

**What to use:**
| Component | Purpose |
|-----------|---------|
| `LineChart` + `Line` | AI score trend over time (7d/30d/90d) |
| `BarChart` + `Bar` | Per-agent score distribution / average comparison |
| `Tooltip` | Hover details on data points |
| `ResponsiveContainer` | Auto-sizing within the dashboard layout |
| `CartesianGrid` | Subtle grid lines matching dark theme |

**Theme integration:**
```typescript
// Pass @ops/ui design tokens directly to Recharts props
<Line stroke={colors.accent} strokeWidth={2} />
<CartesianGrid stroke="rgba(255,255,255,0.06)" />
<Tooltip contentStyle={{ background: colors.cardBg, border: `1px solid ${colors.border}` }} />
```

**Critical:** All Recharts components require browser APIs. Every file using Recharts must have `"use client"` directive at the top. This is already the pattern for all interactive dashboard components.

**Data source:** Prisma `groupBy` on `CallAudit` table, grouping by `agentId` + date truncation. The `aiScore` field (nullable Int) already exists. Aggregate with `_avg`, `_count`, `_min`, `_max`.

**What NOT to add:** chart.js, D3, nivo, victory, visx. Recharts is installed, lightweight, and React-idiomatic.

---

### 2. CSV Export Matching Print Card Format — No Library Needed

**Decision:** Extend the existing client-side Blob CSV pattern. No `papaparse`, no `json2csv`, no server-side generation.

**Current pattern (used in 4 places):**
```typescript
// Build rows as string[][], join, create Blob, trigger download
const rows = [["Header1", "Header2", ...]];
data.forEach(d => rows.push([...values]));
const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
```

**Why no library:** Data volumes are small (hundreds of entries per payroll period, not millions). The existing `PayrollExports.tsx` detailed CSV already demonstrates agent-grouped rows with subtotals and blank separators. The `esc()` helper handles comma/quote escaping. The "print card format" is purely a column layout and grouping concern.

**Print card format approach:**
- Reorder columns to match the physical print card layout
- Add agent header rows (name, period, total) as standalone CSV rows
- Add blank separator rows between agents (already done in `exportDetailedCSV`)
- Include hold amounts and halving reasons (fields exist on PayrollEntry)
- Format amounts with 2 decimal places (already done)

**If data volumes grow later:** Use Node.js `stream.Transform` for server-side streaming CSV. Still no external library needed. But this is not a v1.5 concern.

---

### 3. Data Archival — Prisma Soft-Delete with `archivedAt`

**Decision:** Add nullable `archivedAt DateTime?` column to archivable models. Use Prisma client extensions (not deprecated middleware) to auto-filter archived records.

**Why `archivedAt` (not `deletedAt` or `isArchived`):**
- **vs `deletedAt`:** This is archival with restore, not deletion. Naming matters for clarity.
- **vs `isArchived: Boolean`:** A timestamp provides both the flag (null = active) and audit trail (when archived). One field instead of two.
- **vs separate archive tables:** Doubles schema complexity, makes restore a multi-table copy, Prisma has no atomic cross-table move.

**Models to archive:**
| Model | Why | Restore? |
|-------|-----|----------|
| Sale | Historical sales should be archivable after payroll periods are finalized | Yes |
| PayrollEntry | Entries in finalized periods can be archived for cleaner views | Yes |
| PayrollPeriod | Old periods (3+ months) clutter the payroll dashboard | Yes |
| CallAudit | Completed audits accumulate over time | Yes |

**Schema change:**
```prisma
// Add to each model above:
archivedAt  DateTime? @map("archived_at")

// Add index for query performance:
@@index([archivedAt])
```

**Prisma client extension (not `$use` middleware, which is deprecated):**
```typescript
// packages/db/src/index.ts
export const db = prisma.$extends({
  query: {
    sale: {
      findMany({ args, query }) {
        if (!args.where?.archivedAt) {
          args.where = { ...args.where, archivedAt: null };
        }
        return query(args);
      },
      // Same for findFirst, count, aggregate, groupBy
    },
    // Repeat for payrollEntry, payrollPeriod, callAudit
  }
});
```

**Restore:** Set `archivedAt = null`. Log via existing `logAudit()`.

**Archive UI:** Add "Archive" button on period cards (owner/payroll role). Add "View Archived" toggle that removes the `archivedAt: null` filter. Standard pattern already used for status filtering throughout the app.

**What NOT to add:**
- `prisma-soft-delete` package -- abandoned, unnecessary with native extensions
- PostgreSQL partitioning -- premature at thousands of rows
- Separate archive database -- over-engineered for this scale
- `node-cron` for auto-archival -- archival should be manual/on-demand, not scheduled

---

### 4. Express Route File Splitting — Manual Domain Modules

**Decision:** Split `routes/index.ts` (2,750 lines) into ~10 domain-specific route files. No routing library needed.

**Target structure:**
```
apps/ops-api/src/routes/
  index.ts           -- Router composition (imports + router.use())
  helpers.ts         -- zodErr, asyncHandler, dateRange (shared utilities)
  auth.ts            -- Login, logout, password change, session validation
  sales.ts           -- Sale CRUD, status changes, edit requests, approval queue
  payroll.ts         -- Periods, entries, pay/unpay, exports
  agents.ts          -- Agent CRUD, tracker, performance KPIs
  cs.ts              -- Chargebacks, pending terms, CS submissions, reps
  owner.ts           -- Owner dashboard endpoints, permissions, config
  callAudit.ts       -- Call audit CRUD, AI scoring, audit queue
  alerts.ts          -- Payroll alert pipeline (approve/clear)
  salesBoard.ts      -- Public leaderboard endpoints (no auth)
  config.ts          -- Products, lead sources, AI prompts, board settings
```

**Composition pattern:**
```typescript
// routes/index.ts (after splitting)
import authRoutes from "./auth";
import salesRoutes from "./sales";
// ...

const router = Router();
router.use(authRoutes);
router.use(salesRoutes);
// ...
export default router;
```

**Critical: Keep flat URL paths.** Do not add route prefixes like `/api/v1/sales`. All dashboards have hardcoded API paths. Route splitting is internal code organization only, not an API redesign. Each domain file mounts routes at the same paths they currently use.

**What NOT to add:**
- `express-file-routing` -- magic file-system routing obscures the route map
- `express-autorouter` -- same problem
- API versioning -- not needed for an internal tool with 1 consumer per endpoint

---

### 5. Chargeback-to-Clawback Automation — No New Dependencies

**Decision:** Pure business logic addition. All models already exist.

**Existing infrastructure:**
| Model | Role | Status |
|-------|------|--------|
| `ChargebackSubmission` | CS-submitted chargebacks with `memberId`, `chargebackAmount` | Exists |
| `Clawback` | Tracks clawback with `saleId`, `agentId`, `amount`, status enum | Exists |
| `PayrollAlert` | Alert pipeline from CS to payroll with approve/clear | Exists |
| `ClawbackStatus` enum | OPEN, MATCHED, DEDUCTED, ZEROED states | Exists |
| `PayrollEntryStatus` enum | Has CLAWBACK_APPLIED state | Exists |

**Automation flow (new service function, no new packages):**
1. Payroll user approves a `PayrollAlert`
2. System matches chargeback to original `Sale` via `memberId` lookup
3. Creates `Clawback` record (status: MATCHED)
4. Finds or creates `PayrollEntry` in current period for that agent
5. Applies negative `adjustmentAmount` (field already allows negatives -- documented gotcha)
6. Updates `Clawback.status` to DEDUCTED, links `appliedPayrollPeriodId`
7. Updates `Sale.clawbackStatus` to DEDUCTED
8. Emits Socket.IO event for real-time dashboard update
9. Logs via `logAudit()`

**Implementation location:** New `services/clawback.ts` or extend existing `services/alerts.ts`.

---

### 6. CS Payroll on Owner Dashboard — No New Dependencies

**Decision:** Query existing `ServicePayrollEntry` data, display in owner period summary. Pure frontend addition using existing `@ops/ui` components and `authFetch`.

The `ServicePayrollEntry` model already has `basePay`, `bonusAmount`, `deductionAmount`, `totalPay` fields. The owner dashboard already shows period summaries. This is an additional aggregation query on existing data.

---

## Full Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Charts | Recharts 3.8.0 (installed) | Chart.js / react-chartjs-2 | New dependency; canvas-based (harder to style inline) |
| Charts | Recharts 3.8.0 (installed) | D3 | Massively over-engineered for trend lines; imperative API clashes with React |
| Charts | Recharts 3.8.0 (installed) | Nivo | ~400KB added bundle; Recharts already present |
| Charts | Recharts 3.8.0 (installed) | Tremor | Depends on Tailwind; project uses inline styles only |
| CSV | Client-side Blob | papaparse | Papaparse is for parsing incoming CSV, not generating |
| CSV | Client-side Blob | json2csv | Adds dependency for something 10 lines of code handles |
| CSV | Client-side Blob | Server-side streaming | Data too small to justify; adds API endpoint complexity |
| Archival | `archivedAt` column | Separate archive tables | Doubles schema; complicates restore |
| Archival | `archivedAt` column | PostgreSQL partitioning | Premature at thousands of rows |
| Archival | Prisma client extension | `prisma-soft-delete` package | Abandoned; native extensions are better |
| Archival | Manual on-demand | node-cron scheduled | Users should decide what to archive, not a timer |
| Route split | Manual domain files | express-file-routing | Magic routing obscures the route map |
| Route split | Keep flat paths | API versioning (v1/v2) | Internal tool, single consumer, no versioning need |

## What NOT to Install

| Library | Reason to Skip |
|---------|----------------|
| `chart.js` / `react-chartjs-2` | Recharts already installed |
| `d3` | Over-engineered |
| `nivo` / `victory` / `visx` | Redundant with Recharts |
| `tremor` | Requires Tailwind (project uses inline styles) |
| `papaparse` | CSV parsing, not generation |
| `json2csv` / `csv-writer` | Simple string concat works at this scale |
| `prisma-soft-delete` | Abandoned; Prisma client extensions handle this natively |
| `express-file-routing` | Explicit composition is more debuggable |
| `node-cron` (for archival) | Archival should be on-demand, not scheduled |

## Installation

```bash
# No new packages to install. Zero npm install commands for v1.5.

# Make recharts explicit in ops-dashboard workspace (optional but recommended):
# It's already hoisted from root, but adding to ops-dashboard/package.json
# makes the dependency explicit for that workspace.

# After schema changes:
npx prisma migrate dev --name add-archived-at-columns
```

## Confidence Assessment

| Decision | Confidence | Rationale |
|----------|------------|-----------|
| Recharts for charts | HIGH | Verified installed in root package.json line 27, version 3.8.0. Never used in dashboards yet (all BarChart3 refs are Lucide icons). |
| No CSV library | HIGH | Verified 4 existing CSV exports all use same Blob pattern. Data volumes are small. |
| `archivedAt` soft-delete | HIGH | Standard pattern. Prisma client extensions stable since v4.16. No existing soft-delete columns to conflict with. |
| Manual route splitting | HIGH | 2,750 line file confirmed. Express Router composition is well-documented standard practice. |
| No new deps for clawback | HIGH | All 4 required models verified in schema. ClawbackStatus enum has MATCHED/DEDUCTED states. adjustmentAmount allows negatives (documented gotcha). |

## Sources

- `package.json` (root) line 27: `"recharts": "^3.8.0"` -- confirmed installed
- `apps/ops-dashboard/package.json` -- confirmed recharts NOT listed (hoisted only)
- `apps/ops-api/src/routes/index.ts` -- confirmed 2,750 lines
- `prisma/schema.prisma` -- confirmed Clawback model (line 361), ChargebackSubmission (line 536), PayrollAlert, CallAudit (line 217), ClawbackStatus enum (line 46), PayrollEntryStatus.CLAWBACK_APPLIED (line 31)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` -- confirmed client-side CSV with `esc()` helper and agent-grouped detailed export
- Existing CSV exports verified in: CSTracking.tsx, ManagerTracker.tsx, PayrollExports.tsx (2 exports)
- No `archivedAt`/`deletedAt`/`isArchived` fields found in schema (grep returned no matches)

---
*Stack research for: v1.5 Platform Cleanup & Remaining Features*
*Researched: 2026-03-24*
