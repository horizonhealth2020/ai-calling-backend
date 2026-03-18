# Phase 18: Platform Polish & Integration - Research

**Researched:** 2026-03-18
**Domain:** Cross-dashboard integration, alert pipelines, AI scoring, CSV exports, payroll UX, permission management
**Confidence:** HIGH

## Summary

Phase 18 is an integration phase across 6 dashboards and 1 API. All 24 requirements map to existing infrastructure -- no new npm packages, no new frameworks. The work breaks into seven technical domains: (1) shared date range infrastructure for exports, (2) chargeback-to-payroll alert pipeline with new Prisma model, (3) agent KPI aggregation on owner dashboard, (4) AI scoring visibility and auto-scoring with DB-backed queue, (5) service agent sync and round robin assignment, (6) permission table with role-level defaults and per-user overrides, and (7) standalone UI fixes across payroll and manager dashboards.

The highest-risk work is the chargeback alert pipeline (financial safety -- must never auto-deduct) and AI auto-scoring (cost control -- must ship with budget cap). The lowest-risk work is the standalone UI fixes (INP bug, commission column removal, card layout changes) which carry zero API dependencies and can be parallelized freely.

**Primary recommendation:** Build in dependency order -- date range infrastructure first (cross-cutting), then Socket.IO events for CS, then chargeback alert pipeline, then agent sync/KPIs, then AI scoring last (highest operational risk). Standalone UI fixes can be parallelized at any point.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Chargebacks submitted in CS create alerts displayed in a **table above the current open week** in payroll dashboard
- **Approve action:** Payroll selects which unpaid week to apply the clawback to from a dropdown of the agent's unpaid periods. If 3 weeks are unpaid, all 3 appear as options. Selecting a week creates a clawback entry in that period.
- **Clear action:** Permanently dismisses the alert -- no record kept, treated as false positive or already handled
- New `PayrollAlert` model needed (or similar) to persist alerts between CS submission and payroll action
- Socket.IO `alert:created` event so payroll dashboard auto-refreshes when new chargebacks are submitted
- **Agent KPI Tables location:** Owner dashboard only -- new KPI section with per-agent breakdown
- **KPI Metrics:** Chargeback count, chargeback dollar total, pending term count -- all within 30-day rolling window
- Sale parser paste textarea **already exists** -- fix "invalid enum APPROVED" bug, add preview step, auto-match ALL products, core product NOT auto-selected by default
- **Lead source:** Move field to top of form, next to agent selector
- **State field:** Must be correctly populated from parsed address data
- **Permission Model:** Role-level defaults + per-user overrides (both layers). Hard-coded restrictions: Payroll access SUPER_ADMIN only, User creation SUPER_ADMIN only. Configurable create actions for all entity creates.
- **Rep Sync:** FK link -- keep both ServiceAgent and CsRepRoster tables, add `serviceAgentId` FK on CsRepRoster. Creating a rep in one dashboard auto-creates in the other.
- **Round robin:** Keep existing auto-assign behavior with editable dropdown before submission
- **Rep checklist:** Per-rep tracking showing assigned chargebacks + pending terms with completion status
- **Rep creation roles:** OWNER_VIEW + PAYROLL can create from either CS or payroll dashboard
- Date range picker (from/to) on ALL CSV exports across all 6 dashboards with relative presets
- Shared `DateRangeFilter` component in `@ops/ui`
- Storage monitoring via `pg_database_size()` with alert in owner dashboard
- Paid/unpaid toggle works both directions -- un-pay restricted to OPEN periods only
- Edit button per sale record in payroll view -- inline edit
- Bonus, fronted, hold fields removed from sale rows -- only on agent card header
- "+10" enrollment indicator next to enrollment fee amount
- Remove commission column from agent tracker
- Fix "INP not defined" error on owner dashboard AI config tab
- System prompt visible and editable in owner dashboard AI tab
- AI auto-scores call transcripts with configurable daily budget cap
- Real-time Socket.IO `cs:changed` event for CS tracking tables

### Claude's Discretion
- Exact DateRangeFilter component styling (follow existing @ops/ui patterns)
- Storage alert threshold percentage
- KPI table layout and sorting on owner dashboard
- Permission table UI layout details
- How to handle edge cases in receipt parsing (missing fields, unusual formats)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPORT-01 | Date range (from/to) on any CSV export across all dashboards | Extend existing `dateRange()` helper with `from`/`to` ISO params; shared `DateRangeFilter` in `@ops/ui` |
| EXPORT-02 | Relative presets (Last 7/30 days, This month) alongside custom range | Add preset logic to extended `dateRange()` function |
| EXPORT-03 | Storage alert when near capacity with CSV download/clearance | `pg_database_size()` via `prisma.$queryRaw`; stats endpoint + alert banner |
| AI-01 | System prompt visible and editable in owner dashboard AI tab | Read/write `SalesBoardSetting` key `ai_audit_system_prompt`; add `AiPromptHistory` table |
| AI-02 | Fix "INP not defined" error on AI config | Missing style constant reference -- define or import `INP` in owner dashboard |
| AI-03 | AI auto-scores call transcripts with budget controls | DB-backed queue via `scoring_status` on `ConvosoCallLog`; `AiUsageLog` for cost tracking; daily budget cap in `SalesBoardSetting` |
| CS-01 | Chargeback alerts in payroll with approve/clear actions | New `PayrollAlert` Prisma model; `alert:created` Socket.IO event; approve creates Clawback in selected period |
| CS-02 | Agent KPI tables with chargeback + pending term metrics | Aggregation endpoint computing from `ChargebackSubmission` and `PendingTerm` tables; 30-day rolling window |
| CS-03 | Pending terms tracker with holder date records per date | Group pending terms by `holdDate`; replace "due within 7 days" filter |
| CS-04 | Real-time Socket.IO for CS tracking tables | New `emitCSChanged` in `socket.ts`; extend `useSocket` hook with `cs:changed` event |
| PAY-01 | Bidirectional paid/unpaid toggle | Existing `/payroll/mark-unpaid` route needs period status guard -- reject if period is LOCKED or FINALIZED |
| PAY-02 | Edit button per sale in payroll view | Route through existing `SaleEditRequest` pipeline; inline edit UI in payroll |
| PAY-03 | Bonus/fronted/hold removed from sale rows, kept on agent card header | Frontend-only layout change in payroll-dashboard `page.tsx` |
| PAY-04 | "+10" enrollment fee indicator | Display logic reads from same threshold as `applyEnrollmentFee()` -- extract shared constant |
| MGR-01 | Remove commission column from agent tracker | Frontend-only column removal in manager-dashboard |
| MGR-02 | Paste-to-parse with preview step before form fill | Extend existing `parseReceipt()` + add confirmation card UI pattern |
| MGR-03 | Fix "invalid enum APPROVED" error | Map parsed status values ("Approved", "SALE", etc.) to `SaleStatus` enum (`RAN`, `DECLINED`, `DEAD`) |
| MGR-04 | Core product NOT auto-selected by default | Change `handleParse()` logic -- only select core product when explicitly parsed from text |
| MGR-05 | Lead source field moved to top of form | Frontend layout reorder |
| MGR-06 | State field populated from parsed address data | Fix `parseReceipt()` regex to capture state from address lines |
| REP-01 | Service agents synced between payroll and CS | Add `serviceAgentId` FK on `CsRepRoster`; create in both tables on rep creation |
| REP-02 | CS reps creatable from either dashboard | New route or extend existing; check `OWNER_VIEW` or `PAYROLL` role |
| REP-03 | Round robin checklist with per-rep assignment tracking | `lastAssignedIndex` in DB; `SELECT ... FOR UPDATE` for concurrency; checklist UI |
| REP-04 | Customizable permission table in owner dashboard | New `PermissionOverride` model or `SalesBoardSetting` entries; owner dashboard UI table |
</phase_requirements>

## Standard Stack

### Core (No Changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 5.20.x | ORM for all DB operations | Already in use; schema additions via migration |
| Socket.IO | 4.8.x | Real-time event cascade | Already in use; extend with new event types |
| Zod | 3.x | Request validation | Already in use; all new endpoints need Zod schemas |
| Express | 4.x | API routing | Already in use; new routes added to single `routes/index.ts` |
| Next.js | 15 | Dashboard frontends | Already in use; all 6 apps |
| @anthropic-ai/sdk | 0.78.0 | AI call auditing | Already in use in `callAudit.ts` |

### Supporting (No Changes)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `<input type="date">` | N/A | Date range picker | DateRangeFilter component -- avoids CSS conflicts with inline CSSProperties |
| `pg_database_size()` | PostgreSQL built-in | Storage monitoring | EXPORT-03 via `prisma.$queryRaw` |
| Luxon | Already installed | Date boundaries | Payroll period date logic (already standardized on `America/New_York`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<input type="date">` | react-datepicker | Adds CSS dependency; conflicts with inline CSSProperties pattern |
| In-memory audit queue | BullMQ/Redis | Overkill -- DB-backed polling on `ConvosoCallLog.auditStatus` is simpler and matches existing Prisma patterns |
| Separate permissions table | SalesBoardSetting entries | Dedicated table is cleaner for per-user overrides; SalesBoardSetting is key-value only |

**Installation:**
```bash
# No new packages needed
npm install
```

## Architecture Patterns

### New Files (3 service files + 1 shared component + 1 migration)
```
apps/ops-api/src/services/
  alerts.ts              # PayrollAlert CRUD, emitAlertCreated
  agentKpiAggregator.ts  # Compute chargeback/pending term KPIs per agent
  (auditQueue.ts)        # MODIFY: Replace in-memory array with DB-backed polling

packages/ui/src/components/
  DateRangeFilter.tsx     # Shared date range picker with presets

prisma/migrations/
  YYYYMMDD_phase18/      # PayrollAlert, AiPromptHistory, CsRepRoster.serviceAgentId, PermissionOverride
```

### Pattern 1: PayrollAlert Pipeline
**What:** Chargeback submission in CS creates a `PayrollAlert` record, emits `alert:created` via Socket.IO, payroll dashboard renders alert table above open week, approve creates `Clawback` in selected period.
**When to use:** Any cross-dashboard notification that requires manual action.

```typescript
// New PayrollAlert model
model PayrollAlert {
  id                     String    @id @default(cuid())
  chargebackSubmissionId String    @map("chargeback_submission_id")
  agentId                String?   @map("agent_id")
  amount                 Decimal?  @db.Decimal(12, 2)
  status                 String    @default("PENDING") // PENDING, APPROVED, CLEARED
  approvedPeriodId       String?   @map("approved_period_id")
  approvedBy             String?   @map("approved_by")
  approvedAt             DateTime? @map("approved_at")
  clearedBy              String?   @map("cleared_by")
  clearedAt              DateTime? @map("cleared_at")
  createdAt              DateTime  @default(now()) @map("created_at")
  updatedAt              DateTime  @updatedAt @map("updated_at")

  @@map("payroll_alerts")
}
```

### Pattern 2: Extended dateRange() with from/to
**What:** Extend existing `dateRange()` to accept `from` and `to` ISO date strings alongside preset ranges.
**When to use:** Every export endpoint and date-filtered query.

```typescript
function dateRange(range?: string, from?: string, to?: string): { gte: Date; lt: Date } | undefined {
  // Custom range takes precedence
  if (from && to) {
    return { gte: new Date(from + "T00:00:00Z"), lt: new Date(to + "T23:59:59.999Z") };
  }
  // Existing preset logic: "today" | "week" | "month" | "7d" | "30d"
  if (!range) return undefined;
  // ... existing logic plus new presets
}
```

### Pattern 3: DB-Backed Audit Queue
**What:** Replace in-memory `pendingJobs` array with polling `ConvosoCallLog` where `auditStatus = 'queued'`.
**When to use:** AI auto-scoring pipeline.

```typescript
// Poll for pending jobs instead of in-memory array
async function pollPendingJobs(): Promise<void> {
  const pending = await prisma.convosoCallLog.findMany({
    where: { auditStatus: "queued", recordingUrl: { not: null } },
    orderBy: { callTimestamp: "asc" },
    take: MAX_CONCURRENT - activeJobs.size,
  });
  for (const job of pending) {
    if (!activeJobs.has(job.id)) {
      activeJobs.add(job.id);
      await prisma.convosoCallLog.update({ where: { id: job.id }, data: { auditStatus: "processing" } });
      runJob(job.id).finally(() => { activeJobs.delete(job.id); });
    }
  }
}
```

### Pattern 4: Permission Override Model
**What:** Two-layer permission system: role-level defaults stored as `SalesBoardSetting` entries, per-user overrides in a new `PermissionOverride` table.
**When to use:** REP-04 configurable permissions.

```typescript
model PermissionOverride {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  permission String   // e.g., "create:sale", "create:chargeback", "create:agent"
  granted    Boolean  @default(true)
  grantedBy  String   @map("granted_by")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([userId, permission])
  @@map("permission_overrides")
}
```

### Pattern 5: Socket.IO Event Extension
**What:** Add `emitCSChanged` and `emitAlertCreated` to existing `socket.ts` following the `emitSaleChanged` pattern.
**When to use:** CS-04 and CS-01 real-time updates.

```typescript
// Follows existing emitSaleChanged pattern exactly
export function emitCSChanged(data: { type: "chargeback" | "pending_term"; batchId: string; count: number }) {
  io?.emit("cs:changed", data);
}

export function emitAlertCreated(data: { alertId: string; agentName?: string; amount?: number }) {
  io?.emit("alert:created", data);
}
```

### Anti-Patterns to Avoid
- **Auto-deducting payroll from chargeback alerts:** NEVER create a Clawback automatically. Alerts are informational-only; payroll staff must explicitly approve and select the period.
- **Building separate edit routes for payroll vs manager:** Both UIs must call the same sale edit pipeline (`SaleEditRequest` + `handleSaleEditApproval`). Never create a parallel edit endpoint.
- **Hardcoding enrollment fee threshold in frontend:** The "+10" display logic must read from the same constant as `applyEnrollmentFee()` in payroll.ts. Extract to `@ops/utils`.
- **Per-row Socket.IO events for CS batch submissions:** Emit one `cs:changed` event per batch, not per row. Dashboard re-fetches with current filters.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range picker | Custom date dropdown | Native `<input type="date">` + preset buttons | Avoids CSS library conflicts with inline CSSProperties; browser-native accessibility |
| Audit job queue | Redis/BullMQ queue | DB polling on `ConvosoCallLog.auditStatus` | Already have Prisma; survives restarts; matches existing patterns; no new infrastructure |
| Permission checks | Custom middleware per route | Extend `requireRole` with permission override lookup | Single authorization path; SUPER_ADMIN bypass stays consistent |
| Storage monitoring | External monitoring service | `pg_database_size()` via `prisma.$queryRaw` | PostgreSQL built-in; zero dependencies; sufficient for Railway |
| Date boundary logic | Per-dashboard date utilities | Shared function in `dateRange()` helper | Prevents timezone inconsistency across 6 dashboards |

## Common Pitfalls

### Pitfall 1: Chargeback Alert Creates Phantom Financial Impact (P2)
**What goes wrong:** `ChargebackSubmission.memberId` is free-text from paste-parsed carrier reports, not a FK. Naive matching produces false positives.
**Why it happens:** CS paste parser captures whatever text the carrier report contains.
**How to avoid:** Alerts are informational-only with manual approval required. Add nullable `matchedSaleId` FK and match confidence indicators. NEVER auto-deduct.
**Warning signs:** Payroll staff reporting incorrect agent matches in alert table.

### Pitfall 2: Bidirectional Toggle Corrupts Finalized Periods (P4)
**What goes wrong:** Un-paying an entry in a LOCKED or FINALIZED period breaks `handleCommissionZeroing` logic.
**Why it happens:** Business needs mistake correction but period lifecycle assumes irreversibility.
**How to avoid:** Guard `/payroll/mark-unpaid` route: query the `PayrollPeriod.status` for each entry's period; reject if any period is not OPEN. Return 400 with message specifying which entries are in non-OPEN periods.
**Warning signs:** Entries in FINALIZED periods showing status changes.

### Pitfall 3: AI Scoring Queue Memory/Loss (P1)
**What goes wrong:** In-memory `pendingJobs` array grows unbounded with auto-scoring; jobs lost on restart.
**Why it happens:** Queue designed for manual one-off audits, not batch processing.
**How to avoid:** Replace with DB-backed queue using `auditStatus` column (already exists on `ConvosoCallLog`). Poll `WHERE auditStatus = 'queued'` instead of maintaining in-memory array.
**Warning signs:** `pendingJobs.length` growing continuously; jobs disappearing after Railway deploy.

### Pitfall 4: AI Scoring Cost Spiral (P11)
**What goes wrong:** 200 calls/day at Claude + Whisper rates = $15-30/day with no budget controls.
**Why it happens:** No cost tracking in current `callAudit.ts` pipeline.
**How to avoid:** Ship daily budget cap (configurable via `SalesBoardSetting`), minimum call duration filter (2+ minutes), and `AiUsageLog` table for cost tracking. Show estimated monthly cost in owner dashboard.
**Warning signs:** Unexpected Anthropic API bills.

### Pitfall 5: Service Agent Identity Split (P5)
**What goes wrong:** `ServiceAgent` and `CsRepRoster` are separate tables with no shared key.
**Why it happens:** Tables created in different milestones for different purposes.
**How to avoid:** Add `serviceAgentId` FK on `CsRepRoster` (user decision). Auto-create in both tables on rep creation. Must be done BEFORE round robin (REP-01 before REP-03).
**Warning signs:** Rep exists in one dashboard but not the other.

### Pitfall 6: Socket.IO Event Explosion for CS Batches (P7)
**What goes wrong:** CS paste submissions can contain 50-200 rows. Per-row events cause 200 rapid re-renders.
**Why it happens:** Existing `sale:changed` pattern is per-sale (entered one at a time).
**How to avoid:** Emit single `cs:changed` event with batch summary. Dashboard does one re-fetch.
**Warning signs:** Dashboard becoming unresponsive during large CS paste submissions.

### Pitfall 7: Payroll Edit Bypasses Commission Recalculation (P9)
**What goes wrong:** Payroll-side edit calls `prisma.payrollEntry.update()` directly instead of going through `handleSaleEditApproval`.
**Why it happens:** Two different UIs for the same operation.
**How to avoid:** One route for editing sale financial data. Payroll edit button routes through existing `SaleEditRequest` pipeline.
**Warning signs:** Commission amounts diverging between manager and payroll views.

### Pitfall 8: "+10" Display Logic Drift (P14)
**What goes wrong:** Frontend threshold doesn't match `applyEnrollmentFee()` calculation.
**Why it happens:** Threshold hardcoded in two places.
**How to avoid:** Extract threshold (125) and bonus amount (10) into shared constants.
**Warning signs:** "+10" showing on sales that don't actually get the enrollment bonus.

### Pitfall 9: Round Robin Concurrency (P10)
**What goes wrong:** Two concurrent submissions both read "next rep = Alice" and assign to Alice.
**Why it happens:** Round robin state read and increment are not atomic.
**How to avoid:** Store `lastAssignedIndex` in DB. Use `SELECT ... FOR UPDATE` in a transaction.
**Warning signs:** Duplicate assignments in concurrent paste submissions.

## Code Examples

### Extending dateRange() for Custom Ranges
```typescript
// Source: apps/ops-api/src/routes/index.ts line 31 (existing) + extension
function dateRange(range?: string, from?: string, to?: string): { gte: Date; lt: Date } | undefined {
  // Custom from/to takes precedence
  if (from && to) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) return undefined;
    return {
      gte: new Date(from + "T00:00:00.000Z"),
      lt: new Date(to + "T23:59:59.999Z"),
    };
  }
  // New presets
  if (range === "7d") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { gte: start, lt: end };
  }
  if (range === "30d") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { gte: start, lt: end };
  }
  // Existing: "today" | "week" | "month"
  if (!range || !["today", "week", "month"].includes(range)) return undefined;
  // ... existing logic unchanged
}
```

### Existing Mark-Unpaid Route (Needs Period Guard)
```typescript
// Source: apps/ops-api/src/routes/index.ts line 880 -- NEEDS MODIFICATION
// Current: no period status check. Must add:
router.post("/payroll/mark-unpaid", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const { entryIds, serviceEntryIds } = z.object({
    entryIds: z.array(z.string()).optional().default([]),
    serviceEntryIds: z.array(z.string()).optional().default([]),
  }).parse(req.body);

  // NEW: Check all entries are in OPEN periods
  if (entryIds.length > 0) {
    const entries = await prisma.payrollEntry.findMany({
      where: { id: { in: entryIds } },
      include: { payrollPeriod: { select: { status: true } } },
    });
    const nonOpen = entries.filter(e => e.payrollPeriod.status !== "OPEN");
    if (nonOpen.length > 0) {
      return res.status(400).json({ error: "Cannot un-pay entries in LOCKED or FINALIZED periods" });
    }
  }
  // ... rest of existing logic
}));
```

### Socket.IO Extension Pattern
```typescript
// Source: apps/ops-api/src/socket.ts -- following existing emitSaleChanged pattern
export interface CSChangedPayload {
  type: "chargeback" | "pending_term";
  batchId: string;
  count: number;
}

export function emitCSChanged(payload: CSChangedPayload) {
  io?.emit("cs:changed", payload);
}

export function emitAlertCreated(data: { alertId: string; agentName?: string; amount?: number }) {
  io?.emit("alert:created", data);
}
```

### useSocket Hook Extension
```typescript
// Source: packages/socket/src/useSocket.ts -- extend to accept additional event handlers
export function useSocket(
  apiUrl: string,
  onSaleChanged: (payload: SaleChangedPayload) => void,
  onReconnect?: () => void,
  additionalHandlers?: Record<string, (data: any) => void>,
) {
  // In the socket.on setup block, register additional handlers:
  if (additionalHandlers) {
    for (const [event, handler] of Object.entries(additionalHandlers)) {
      socket.on(event, handler);
    }
  }
}
```

### Agent KPI Aggregation Query
```typescript
// Source: new file apps/ops-api/src/services/agentKpiAggregator.ts
export async function getAgentRetentionKpis(agentIds: string[]) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const chargebacks = await prisma.chargebackSubmission.groupBy({
    by: ["memberAgentId"],
    where: {
      memberAgentId: { in: agentIds },
      submittedAt: { gte: thirtyDaysAgo },
    },
    _count: true,
    _sum: { chargebackAmount: true },
  });

  const pendingTerms = await prisma.pendingTerm.groupBy({
    by: ["agentIdField"],
    where: {
      agentIdField: { in: agentIds },
      submittedAt: { gte: thirtyDaysAgo },
    },
    _count: true,
  });

  return { chargebacks, pendingTerms };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Preset-only date ranges ("today"/"week"/"month") | Custom from/to + presets | Phase 18 | Every export endpoint gains custom date range support |
| In-memory audit queue (`pendingJobs[]`) | DB-backed queue via `auditStatus` column | Phase 18 | Queue survives restarts; enables auto-scoring at scale |
| One-way paid toggle | Bidirectional with period guards | Phase 18 | Mistake recovery for payroll staff; OPEN-only restriction prevents corruption |
| Separate ServiceAgent and CsRepRoster | FK-linked tables with auto-sync | Phase 18 | Single source of truth for rep management |
| RBAC via fixed roles only | Role defaults + per-user permission overrides | Phase 18 | Granular permission control for owners |

## Open Questions

1. **Chargeback-to-agent matching accuracy**
   - What we know: `ChargebackSubmission.memberAgentId` is free-text; `Agent.id` is cuid
   - What's unclear: What format does `memberAgentId` actually contain? Agent name? Company ID? Extension?
   - Recommendation: During implementation, sample existing `ChargebackSubmission` records to determine matching strategy. Likely match on agent name (fuzzy) rather than ID.

2. **AI prompt write access for OWNER_VIEW**
   - What we know: `PUT /api/settings/ai-audit-prompt` currently requires MANAGER or SUPER_ADMIN
   - What's unclear: Should OWNER_VIEW be able to edit the AI system prompt?
   - Recommendation: Context says "owner dashboard AI tab" has the editor. Extend write access to OWNER_VIEW since the UI is in their dashboard.

3. **Storage alert threshold**
   - What we know: Need to alert when near Railway plan capacity
   - What's unclear: What is the actual Railway plan storage limit?
   - Recommendation: Make threshold configurable via `SalesBoardSetting`. Default to 80% as a reasonable starting point. Show actual size vs estimated limit.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root: Morgan service) + Jest (ops-api services) |
| Config file | `jest.config.js` (root), `apps/ops-api/` uses ts-jest via workspace |
| Quick run command | `npm test -- --testPathPattern="ops-api"` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01 | dateRange() accepts from/to params | unit | `npm test -- --testPathPattern="dateRange"` | No -- Wave 0 |
| EXPORT-02 | dateRange() handles presets 7d, 30d | unit | `npm test -- --testPathPattern="dateRange"` | No -- Wave 0 |
| PAY-01 | mark-unpaid rejects non-OPEN periods | unit | `npm test -- --testPathPattern="payroll"` | No -- Wave 0 |
| PAY-04 | enrollment fee threshold constant shared | unit | `npm test -- --testPathPattern="enrollment"` | No -- Wave 0 |
| MGR-03 | parseReceipt maps status to enum | unit | `npm test -- --testPathPattern="parseReceipt"` | No -- Wave 0 |
| CS-01 | Alert creation from chargeback | unit | `npm test -- --testPathPattern="alerts"` | No -- Wave 0 |
| AI-03 | Budget cap prevents over-scoring | unit | `npm test -- --testPathPattern="auditQueue"` | No -- Wave 0 |
| REP-03 | Round robin increments atomically | unit | `npm test -- --testPathPattern="roundRobin"` | No -- Wave 0 |
| CS-02 | KPI aggregation groups correctly | unit | `npm test -- --testPathPattern="agentKpi"` | No -- Wave 0 |
| REP-01 | Rep sync creates in both tables | unit | `npm test -- --testPathPattern="repSync"` | No -- Wave 0 |
| PAY-02 | Sale edit routes through SaleEditRequest | manual-only | Manual: verify payroll edit creates SaleEditRequest | N/A |
| CS-04 | Socket.IO emits cs:changed on batch | manual-only | Manual: submit CS batch, verify single event | N/A |
| AI-01 | Prompt editor saves to SalesBoardSetting | manual-only | Manual: edit prompt, verify persistence | N/A |
| REP-04 | Permission override blocks create action | manual-only | Manual: revoke permission, verify 403 | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="ops-api"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/dateRange.test.ts` -- covers EXPORT-01, EXPORT-02
- [ ] `apps/ops-api/src/services/__tests__/alerts.test.ts` -- covers CS-01
- [ ] `apps/ops-api/src/services/__tests__/agentKpiAggregator.test.ts` -- covers CS-02
- [ ] `apps/ops-api/src/services/__tests__/auditQueue.test.ts` -- covers AI-03 budget cap
- [ ] `apps/ops-api/src/services/__tests__/payroll-toggle.test.ts` -- covers PAY-01 period guard
- [ ] Extract `parseReceipt` to testable module + `__tests__/parseReceipt.test.ts` -- covers MGR-03, MGR-04, MGR-06
- [ ] `apps/ops-api/src/services/__tests__/repSync.test.ts` -- covers REP-01
- [ ] `apps/ops-api/src/services/__tests__/roundRobin.test.ts` -- covers REP-03

## Sources

### Primary (HIGH confidence)
- Codebase: `prisma/schema.prisma` -- all current models (ChargebackSubmission, PendingTerm, CsRepRoster, ServiceAgent, ConvosoCallLog, PayrollPeriod, PayrollEntry, Clawback, SalesBoardSetting, CallAudit)
- Codebase: `apps/ops-api/src/routes/index.ts` -- `dateRange()` helper (line 31), mark-paid (line 851), mark-unpaid (line 880), clawback creation (line 909)
- Codebase: `apps/ops-api/src/socket.ts` -- `emitSaleChanged` pattern, all emit functions
- Codebase: `apps/ops-api/src/services/auditQueue.ts` -- in-memory queue implementation, `MAX_CONCURRENT`, retry logic
- Codebase: `apps/ops-api/src/middleware/auth.ts` -- `requireAuth`, `requireRole`, SUPER_ADMIN bypass
- Codebase: `packages/socket/src/useSocket.ts` -- client-side hook pattern, `sale:changed` listener
- Codebase: `apps/manager-dashboard/app/page.tsx` -- `parseReceipt()`, `matchProduct()`, `handleParse()`
- `.planning/research/SUMMARY.md` -- prior research with dependency ordering and phase structure
- `.planning/research/PITFALLS.md` -- all 15 pitfalls with detection strategies

### Secondary (MEDIUM confidence)
- `.planning/phases/18-platform-polish-integration/18-CONTEXT.md` -- user decisions constraining all implementation choices

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified all libraries exist in codebase; zero new packages needed
- Architecture: HIGH -- all patterns extend proven existing patterns observed in code
- Pitfalls: HIGH -- all critical pitfalls confirmed by direct code inspection of `auditQueue.ts`, `payroll.ts`, `CsRepRoster` model, mark-unpaid route
- Test infrastructure: MEDIUM -- Jest exists but ops-api test coverage is limited to pure function tests; no integration test setup

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external dependencies changing)
