# Feature Landscape: v1.5 Platform Cleanup & Remaining Features

**Domain:** Insurance sales operations platform -- AI scoring, payroll automation, data lifecycle
**Researched:** 2026-03-24
**Focus:** NEW features only (existing v1.0-v1.4 features are shipped)

---

## Table Stakes

Features users expect given what already exists. Missing = workflow gap or operational friction.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Chargeback-to-clawback auto-creation | Alert pipeline exists (v1.2) but requires manual clawback creation; users expect the approve action to auto-deduct from payroll | Medium | Existing PayrollAlert, Clawback, PayrollEntry models |
| CS payroll on owner period summary | Owner sees sales count, premium, clawbacks but NOT service payroll totals; incomplete financial picture | Low | Existing ServicePayrollEntry, owner/summary endpoint |
| Route file splitting | 2750-line single route file is a maintenance hazard; any contributor touching routes risks merge conflicts | Medium | No feature dependencies; pure tech debt |
| Payroll CSV matching print card format | Existing detailed CSV is entry-level rows; users print pay cards grouped by agent with weekly subtotals and expect CSV to match | Medium | Existing PayrollExports component, period data |

## Differentiators

Features that elevate the platform beyond basic ops tooling.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| AI scoring dashboard with trend analysis | Transforms raw call audits into actionable coaching insights; managers see score trajectories per agent over time, not just individual audit cards | High | Existing CallAudit model with aiScore, issues, wins, suggestedCoaching JSON fields |
| Data archival with restore | Prevents database bloat (Railway 1GB limit noted in storage-stats endpoint), enables compliance retention, and lets users recover archived data | High | All major tables; requires new archive tables or soft-delete strategy |

## Anti-Features

Features to explicitly NOT build for v1.5.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time streaming trend charts (WebSocket-updated) | Over-engineering; audit data changes infrequently (batch scoring runs) | Static fetch on page load with manual refresh button |
| Full data warehouse / analytics engine | Scope creep; the platform is an ops tool, not a BI platform | Simple aggregation queries with Prisma, pre-computed where needed |
| Automated chargeback-to-sale matching by AI | Fuzzy matching is error-prone with insurance member IDs; wrong matches create payroll errors | Keep human-confirmed matching via the existing alert approve flow |
| Archive scheduler / cron jobs | Adds infrastructure complexity (no cron runner in current stack) | Manual archive trigger by OWNER_VIEW/SUPER_ADMIN role |
| Per-field CSV column customization | UI complexity for minimal value | Fixed format matching the print card layout |

---

## Feature Details

### 1. AI Scoring Dashboard with Trend Analysis

**Current state:** CallAudit records exist with structured fields (score 0-100, issues array, wins array, suggestedCoaching array, callOutcome enum, managerSummary). ManagerAudits.tsx shows individual audit cards. AiUsageLog tracks token costs. No aggregation or trend views exist.

**What users expect:**

- **Agent score trend line** -- rolling average score per agent over time (7-day, 30-day windows). Managers want to see "is this agent improving?" at a glance.
- **Team average benchmark** -- horizontal line on trend chart showing team mean so individual agents are contextualized.
- **Issue category distribution** -- which categories (missed_discovery, weak_objection_handling, etc.) appear most frequently across agents. The 12 category enums already exist in the audit tool schema.
- **Top coaching priorities** -- aggregated suggested_coaching across recent audits, ranked by frequency. "3 agents this week need objection handling work."
- **Score distribution histogram** -- how many audits fall in 0-25, 25-50, 50-75, 75-100 ranges.
- **Per-agent drill-down** -- click agent name to see their audit history, score trajectory, recurring issues.
- **Date range filtering** -- use existing DateRangeFilter component and DateRangeContext.

**Implementation approach:**

- New API endpoint: `GET /call-audits/trends` -- aggregates CallAudit data with date range params, returns pre-computed trend data (score averages by agent by day, issue category counts, coaching priority frequencies).
- New dashboard tab or sub-view within ManagerAudits -- "Trends" toggle alongside existing audit list.
- Chart rendering: Use a lightweight chart library. Recharts is the standard choice for React dashboards -- it handles line charts, bar charts, and area charts with minimal bundle size. No need for D3 directly.
- Agent selector dropdown to filter trends to specific agent or "All".

**Complexity:** HIGH -- requires new aggregation queries, chart rendering, responsive layout within existing dark theme.

**Risks:**
- Large audit datasets could make aggregation slow. Mitigation: add DB indexes on `call_audits(agent_id, call_date)` if not present, limit trend window to 90 days max.
- Chart library styling must match dark glassmorphism theme (inline CSSProperties). Recharts supports custom styling via props, not CSS classes, so this is compatible.

---

### 2. Chargeback-to-Clawback Auto-Creation

**Current state:** The pipeline is 80% built:
1. CS submits chargeback (ChargebackSubmission created)
2. `createAlertFromChargeback()` creates PayrollAlert with agentName, customerName, amount
3. Payroll user sees alert, clicks "Approve" with a target period
4. `approveAlert()` creates a Clawback record with `matchedBy: "chargeback_alert"`

**The gap:** The current `approveAlert()` in `alerts.ts` creates a Clawback record but does NOT create a corresponding PayrollEntry adjustment. The clawback record exists in isolation -- it does not actually deduct from the agent's pay card. The `saleId` is set to `alert.chargeback.memberId || ""` which is the member ID string, not a valid sale ID (this is a bug).

**What "auto-creation" means in insurance ops:**

1. **Match chargeback to original sale** -- use memberId from ChargebackSubmission to find the Sale record. This is the critical step that's currently broken.
2. **Create clawback linked to actual sale** -- `Clawback.saleId` must reference a real Sale, not a member ID string.
3. **Apply deduction to payroll** -- either:
   - If the sale's payroll period is OPEN: zero out or reduce the PayrollEntry
   - If the period is LOCKED/FINALIZED: create a negative adjustment in the current open period (same pattern as `handleCommissionZeroing`)
4. **Update sale's clawbackStatus** -- set to DEDUCTED on the Sale record
5. **Emit socket event** -- notify payroll dashboard of the new clawback entry

**Expected user flow:**
1. CS submits chargeback batch (existing)
2. System auto-matches chargebacks to sales by memberId (new -- currently just creates alert)
3. Payroll user sees alert with matched sale details (agent name, sale date, commission amount)
4. Payroll clicks "Approve to Period [X]" (existing UI)
5. System creates Clawback, applies PayrollEntry deduction, updates Sale.clawbackStatus (new logic)
6. If no sale match found: alert stays as informational, payroll can manually create clawback (existing manual flow)

**Implementation approach:**

- Fix `approveAlert()` to: (a) find Sale by memberId match, (b) create Clawback with real saleId, (c) call deduction logic similar to `handleCommissionZeroing`, (d) update Sale.clawbackStatus.
- Add sale-matching step in `createAlertFromChargeback()` -- attempt to match `ChargebackSubmission.memberId` to `Sale.memberId`, populate `PayrollAlert.agentId` from matched sale's agentId.
- Handle unmatched chargebacks gracefully -- still create alert but flag as "UNMATCHED" so payroll knows manual intervention needed.

**Complexity:** MEDIUM -- most infrastructure exists, but the sale-matching logic and payroll deduction integration need careful handling of edge cases (multiple sales for same member, already-paid periods).

**Risks:**
- Member ID matching may not be 1:1 (member could have multiple sales). Mitigation: match most recent RAN sale, or surface multiple matches for human selection.
- Race condition if chargeback and period finalization happen simultaneously. Mitigation: wrap in transaction.

---

### 3. Data Archival with Restore

**Current state:** `GET /storage-stats` endpoint exists showing DB size vs plan limit (default 1GB). No archival mechanism exists. The `storage_alert_threshold_pct` setting exists for warning.

**What data archival means in SaaS ops tools:**

This is NOT backup/restore. It's **lifecycle management** -- moving old operational data out of hot tables to reduce query load and storage, while keeping it recoverable.

**What users expect:**

- **Archive by date range** -- "Archive all data older than 6 months" or custom date cutoff.
- **Archive scope selection** -- choose which data types to archive (sales, payroll entries, call audits, chargebacks, pending terms). Not all-or-nothing.
- **Preview before archive** -- show row counts that would be affected before executing.
- **Restore capability** -- bring archived data back into active tables. This is the hard part.
- **Archive status visibility** -- "X records archived, Y MB recovered" feedback.

**Architecture options (pick one):**

**Option A: Soft-delete with archived flag (RECOMMENDED)**
- Add `archivedAt DateTime?` column to Sale, PayrollEntry, CallAudit, ChargebackSubmission, PendingTerm.
- All existing queries add `WHERE archivedAt IS NULL` (or use Prisma middleware to auto-filter).
- Archive = set archivedAt. Restore = set archivedAt to null.
- Pros: Simple, no data movement, instant restore, no schema duplication.
- Cons: Doesn't reduce table size (rows still in same table). BUT with proper indexes on archivedAt, query performance is fine. Actual storage savings come from VACUUM after delete, not from moving rows.

**Option B: Shadow archive tables**
- Create `archived_sales`, `archived_payroll_entries`, etc. with identical schemas.
- Archive = INSERT INTO archive + DELETE FROM active. Restore = reverse.
- Pros: Active tables stay lean, clear separation.
- Cons: Schema duplication (every migration must update both), complex restore with foreign key re-linking, Prisma doesn't natively support "copy to different table."

**Option C: JSON export to file storage**
- Archive = export to JSON files (S3 or local), delete from DB. Restore = re-import.
- Pros: Minimal DB impact, unlimited archive size.
- Cons: No queryability of archived data, restore is slow, requires file storage infrastructure not in current stack.

**Recommendation: Option A (soft-delete).** It's the simplest, most reliable approach for a platform at this scale. The Railway 1GB limit is better addressed by archiving call transcriptions (the largest data by far -- each transcription is thousands of characters) than by moving rows between tables.

**Implementation approach:**

- Add `archivedAt` to 5 models via Prisma migration.
- Add Prisma middleware or utility wrapper that filters archived records by default.
- New API endpoints: `POST /admin/archive` (preview + execute), `POST /admin/restore` (by date range or entity IDs), `GET /admin/archive-stats`.
- Owner dashboard: Archive management card showing archived record counts, last archive date, restore button.
- Special handling for call_audits transcription field -- consider separate "purge transcriptions" action that nulls the text but keeps the structured audit data (score, issues, etc.).

**Complexity:** HIGH -- touches many models, requires careful migration, needs Prisma query wrapper to prevent accidentally showing archived data.

**Risks:**
- Forgetting to add archive filter to a query = users see "deleted" data. Mitigation: Prisma middleware that auto-applies the filter, explicit opt-in to include archived.
- Foreign key chains: archiving a Sale but not its PayrollEntries creates orphans. Mitigation: cascade archive -- when Sale is archived, archive its entries too.
- Transcription purge is irreversible. Mitigation: separate "purge" action with confirmation, distinct from "archive."

---

### 4. Route File Splitting

**Current state:** `apps/ops-api/src/routes/index.ts` is 2750 lines with ~90+ route handlers in a single flat file. All routes use the same router instance.

**Standard pattern for Express route splitting:**

```
routes/
  index.ts          -- imports and mounts sub-routers
  auth.ts           -- /auth/*
  sales.ts          -- /sales/*
  payroll.ts        -- /payroll/*
  agents.ts         -- /agents/*
  owner.ts          -- /owner/*
  reporting.ts      -- /reporting/*
  callAudits.ts     -- /call-audits/*, /call-recordings/*
  cs.ts             -- /chargebacks/*, /pending-terms/*, /reps/*
  ai.ts             -- /ai/*
  admin.ts          -- /permissions/*, /storage-stats/*, /admin/*
  salesBoard.ts     -- /sales-board/*
```

**Implementation approach:**

- Each file exports an Express Router.
- `index.ts` becomes a thin file that imports and `router.use()` mounts each sub-router.
- Shared helpers (dateRange, zodErr, asyncHandler) stay in a shared `routes/helpers.ts`.
- Middleware imports (requireAuth, requireRole) stay as-is.

**Complexity:** MEDIUM -- mechanical refactor but requires careful testing that all routes still work at the same paths. No path prefixes should change.

**Risks:**
- Accidentally changing route paths during extraction. Mitigation: run full route list comparison before/after.
- Import circular dependencies if route files import from each other. Mitigation: keep route files independent, shared logic in services/.

---

### 5. CS Payroll on Owner Dashboard Period Summary

**Current state:** `GET /owner/summary` returns salesCount, premiumTotal, clawbacks, openPayrollPeriods. `GET /reporting/periods` returns weekly period summaries with sales count, premium, commission paid. Neither includes ServicePayrollEntry totals.

**What users expect:** The owner viewing period summaries wants to see total payroll cost including service staff (CS reps). Currently they see agent commission but not service payroll, giving an incomplete picture of labor cost per period.

**Implementation approach:**

- Modify `GET /reporting/periods` to include `servicePayrollTotal` per period -- SUM of ServicePayrollEntry.totalPay for each period.
- Modify `GET /owner/summary` to include `servicePayrollTotal` in the response -- SUM of all ServicePayrollEntry.totalPay in the date range.
- Update OwnerOverview.tsx to display a new StatCard for service payroll.
- Update period summary table to show the service total column.

**Complexity:** LOW -- straightforward query additions to existing endpoints and a new StatCard on the dashboard.

**Risks:** Minimal. ServicePayrollEntry already has a payrollPeriodId FK, so the join is clean.

---

### 6. Payroll CSV Export Matching Print Card Format

**Current state:** PayrollExports.tsx has two exports:
- Summary CSV: period-level rows (week range, status, entries, gross, net)
- Detailed CSV: entry-level rows sorted by agent with subtotals

**What "matching print card format" means:** The payroll print cards (PayrollPeriods.tsx) show data grouped by agent, with each agent's card containing their individual sale entries and a summary row (commission total, bonus, fronted, hold, net). The CSV should mirror this exact layout so the printout and spreadsheet are interchangeable.

**Expected format (agent-grouped weekly card CSV):**

```
Agent: John Smith
Week: 03-16-2026 to 03-22-2026
Member ID | Member Name | Product | Premium | Commission | Status
12345     | Jane Doe    | Core    | $150    | $22.50     | READY
12346     | Bob Smith   | Core+AD&D | $200  | $30.00     | READY
                         SUBTOTAL:            $52.50
                         Bonus:               $10.00
                         Fronted:             -$0.00
                         Hold:                -$0.00
                         Adjustment:          $0.00
                         NET:                 $62.50

Agent: Sarah Johnson
...
```

**Key differences from current detailed CSV:**
- Agent name as a header row, not a column value
- Weekly grouping within each agent section
- Summary block at bottom of each agent section matching the pay card layout
- Adjustment amount included (missing from current detailed CSV)
- Premium column per sale entry
- Blank rows between agents for readability

**Implementation approach:**

- New export function `exportPayCardCSV()` in PayrollExports.tsx (client-side, same pattern as existing exports).
- Group entries by agent, then by period within agent.
- Format header/detail/subtotal rows to match visual pay card structure.
- Add as third export option: "Pay Card CSV" alongside existing Summary and Detailed.

**Complexity:** MEDIUM -- the data is already available in the periods prop, but the formatting logic to match pay card layout requires careful string building.

**Risks:**
- Excel/Sheets may not render the grouped format prettily. Mitigation: use consistent column widths, merge-friendly layout.
- Adjustment amount is in the data but not currently in the detailed CSV columns. Need to add it.

---

## Feature Dependencies

```
Route File Splitting ---- (no dependencies, do first for clean codebase)
     |
     v
CS Payroll on Owner Summary ---- depends on clean route structure
     |
Chargeback-to-Clawback Auto ---- depends on existing alert pipeline
     |
     v
Data Archival ---- depends on all features being stable (archive touches all models)
     |
AI Scoring Dashboard ---- depends on sufficient CallAudit data; independent of others
     |
Payroll CSV Export ---- independent; uses existing data
```

## MVP Recommendation

**Phase order by dependency chain and risk:**

1. **Route File Splitting** -- tech debt first, makes all subsequent work cleaner. Zero feature risk.
2. **CS Payroll on Owner Summary** -- LOW complexity, quick win, gives owners complete financial view.
3. **Payroll CSV Matching Print Card** -- MEDIUM complexity, standalone, immediate user value.
4. **Chargeback-to-Clawback Auto-Creation** -- MEDIUM complexity, fixes the broken alert pipeline, high operational value.
5. **AI Scoring Dashboard** -- HIGH complexity, requires chart library integration, highest UX effort.
6. **Data Archival with Restore** -- HIGH complexity, touches all models, should go last when platform is stable.

**Defer from v1.5:**
- Automated chargeback-to-sale matching by AI -- keep human confirmation
- Archive scheduler / cron -- manual trigger is sufficient for now
- Real-time trend chart updates -- static fetch is fine for audit cadence

## Sources

- Codebase analysis: `apps/ops-api/src/routes/index.ts` (2750 lines, ~90 routes)
- Codebase analysis: `apps/ops-api/src/services/alerts.ts` (approveAlert creates Clawback with broken saleId reference)
- Codebase analysis: `apps/ops-api/src/services/callAudit.ts` (structured audit with 12 issue categories)
- Codebase analysis: `apps/ops-api/src/services/payroll.ts` (commission engine, handleCommissionZeroing pattern)
- Codebase analysis: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` (current CSV exports)
- Codebase analysis: `prisma/schema.prisma` (all models, ClawbackStatus enum, PayrollEntry fields)
- Codebase analysis: `apps/ops-api/src/routes/index.ts:2720` (storage-stats endpoint)
- Project context: `.planning/PROJECT.md` (v1.5 target features, existing shipped features)
- Confidence: HIGH -- all findings from direct codebase analysis, no external sources needed
