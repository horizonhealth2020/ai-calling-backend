# Phase 7: Payroll Management - Research

**Researched:** 2026-03-16
**Domain:** Payroll period lifecycle, per-agent paid status, card scrollability, CSV export
**Confidence:** HIGH

## Summary

Phase 7 implements payroll period lifecycle management with a simplified two-state model (OPEN/PAID) applied per-agent rather than per-period. The existing codebase already has significant scaffolding: `AgentPayCard` with `onMarkPaid`/`onMarkUnpaid` prop stubs, mark-paid/mark-unpaid API routes that update `PayrollEntry.status`, and client-side CSV export functions. The main work is: (1) migrating the `PayrollPeriodStatus` enum from OPEN/LOCKED/FINALIZED to just OPEN (since paid status moves to per-agent entry level), (2) adding API guards that reject writes when an agent's entries are marked PAID, (3) implementing collapsible entries with "Show N more" in `AgentPayCard`, and (4) adding a visual flag for entries that arrive after an agent is marked paid.

The net amount formula `payout + adjustment + bonus - fronted` is already implemented in two places (routes line 912 and payroll.ts line 228, which also includes `- hold`). The REQUIREMENTS.md formula omits `- hold` but the code consistently uses `payout + adjustment + bonus - fronted - hold`. This is the correct implementation and should be preserved.

**Primary recommendation:** Repurpose the existing per-entry `mark-paid`/`mark-unpaid` API routes (which already work per-agent by passing all agent entry IDs) and add finalization guards to the `PATCH /payroll/entries/:id` route. The `PayrollPeriodStatus` enum becomes largely irrelevant since paid status lives at the entry level -- but keep the enum as-is to avoid migration risk, just stop using LOCKED/FINALIZED states.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two states only: OPEN and PAID (drop LOCKED/FINALIZED three-state model)
- OPEN = current active week, agents writing sales into it, payroll can edit entries
- PAID = agent has been paid, edits rejected by API until toggled back to OPEN
- Paid status is per-agent card, NOT per-period -- payroll marks individual agent cards as paid within a period
- PAYROLL and SUPER_ADMIN roles only can mark paid / toggle unpaid
- Status is toggled manually by payroll, not triggered by date
- Payroll can toggle an agent back to OPEN/unpaid to make corrections, then re-mark as paid
- API rejects writes to entries for a paid agent with a clear error message ("Agent already marked paid")
- UI disables editing on paid agent cards (defense in depth -- both API and UI enforce)
- Payroll can change agent back to unpaid to re-enable editing
- When a new sale lands in a period where the agent is already marked PAID, the payroll entry IS created but flagged visually as "arrived after paid"
- Managers create sales normally with no visibility into payment status -- silent creation, flagged on payroll side only
- Collapsible entries: show first 5 entries by default, "Show N more" button to expand
- When expanded, card fully expands to show all entries (no internal scroll / max-height)
- Page scrolls naturally -- no sticky period headers, no scroll-within-scroll
- Period view stacks agent cards vertically with natural page scroll
- Export any period data (OPEN or PAID) -- not restricted to paid-only
- Keep existing client-side export approach (browser generates CSV from loaded data)
- Financial data only in CSV -- no paid/unpaid status column
- Existing summary and detailed export formats are sufficient -- no new export types needed

### Claude's Discretion
- Schema migration strategy for renaming OPEN/LOCKED/FINALIZED to OPEN/PAID (or repurposing existing enum values)
- Visual indicator design for entries that arrived after agent was marked paid
- "Show more" button styling and animation
- Per-agent paid/unpaid toggle button placement within AgentPayCard

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAYR-02 | Payroll cards display per agent per period with correct commission totals | AgentPayCard already exists with per-agent grouping (page.tsx:776). Financial summary strip shows Commission/Bonus/Fronted/Hold/Net. Needs collapsible entries (5 default). |
| PAYR-03 | Payroll cards are scrollable when content exceeds viewport | User decision: natural page scroll, no scroll-within-scroll. Collapsible entries with "Show N more". Full expansion on click. |
| PAYR-04 | Payroll periods follow status workflow: Pending -> Ready -> Finalized | User decision overrides: Two states OPEN/PAID, per-agent not per-period. Existing mark-paid/mark-unpaid routes already handle this at entry level. |
| PAYR-05 | Finalized periods reject new writes (entries or modifications) | API guard needed on PATCH /payroll/entries/:id -- check if agent's entries are PAID in that period. UI disables editing on paid cards. Late entries still created but flagged. |
| PAYR-06 | Payroll data can be exported as CSV | Already implemented: exportCSV (summary) and exportDetailedCSV (per-entry with agent subtotals) at page.tsx:1485-1564. No changes needed per user decision. |
| PAYR-07 | Net amount formula is consistent: payout + adjustment + bonus - fronted | Already implemented in routes (line 912) and payroll.ts (line 228). Code uses `payout + adjustment + bonus - fronted - hold`. Verify consistency across all calculation points. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | API routes for payroll guards | Already in use for all ops-api routes |
| Prisma | existing | Database queries and migrations | Already in use for all data access |
| Zod | existing | Request validation | Already in use for all route validation |
| React (Next.js 15) | existing | Payroll dashboard UI | Already in use for payroll-dashboard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/auth | existing | JWT auth, role checks | requireAuth + requireRole middleware |
| @ops/ui | existing | PageShell, Badge, AnimatedNumber | Shared UI components |
| @ops/socket | existing | Real-time sale:changed events | Already wired into payroll dashboard |
| lucide-react | existing | Icons (CheckCircle, XCircle, Lock, etc.) | Already imported in payroll dashboard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-entry paid status | Per-period status enum | User decision: per-agent granularity required. Period-level status is too coarse. |
| Schema migration (rename enum) | Repurpose existing values | Repurposing avoids migration risk. OPEN stays OPEN, entries use PAID status which already exists in PayrollEntryStatus. |

## Architecture Patterns

### Existing Structure (no changes needed)
```
apps/ops-api/src/
  routes/index.ts          # All routes in single flat file
  services/payroll.ts      # Commission calc, period assignment
  middleware/auth.ts        # requireAuth, requireRole
apps/payroll-dashboard/
  app/page.tsx             # Full payroll UI including AgentPayCard
prisma/
  schema.prisma            # PayrollPeriodStatus enum, PayrollEntry model
```

### Pattern 1: Per-Agent Paid Guard (API)
**What:** Before allowing writes to payroll entries, check if the agent's entries in that period are already marked PAID.
**When to use:** On PATCH /payroll/entries/:id (bonus/fronted/hold edits)
**Example:**
```typescript
// In PATCH /payroll/entries/:id handler, before applying changes:
const entry = await prisma.payrollEntry.findUnique({
  where: { id: req.params.id },
});
if (!entry) return res.status(404).json({ error: "Entry not found" });

// Check if this agent's entries in this period are marked PAID
const paidEntries = await prisma.payrollEntry.findMany({
  where: {
    payrollPeriodId: entry.payrollPeriodId,
    agentId: entry.agentId,
    status: "PAID",
  },
});
if (paidEntries.length > 0) {
  return res.status(400).json({ error: "Agent already marked paid for this period" });
}
```

### Pattern 2: Late Entry Flagging
**What:** When upsertPayrollEntryForSale creates an entry where the agent already has PAID entries in that period, mark the new entry with a visual flag.
**When to use:** In upsertPayrollEntryForSale after creating the entry.
**Example:**
```typescript
// After upsert, check if agent has PAID entries in same period
const agentPaidEntries = await prisma.payrollEntry.findMany({
  where: {
    payrollPeriodId: period.id,
    agentId: sale.agentId,
    status: "PAID",
  },
});
// If agent was already paid, the new PENDING entry is the "late" one
// UI detects this by checking: entry.status !== "PAID" && sibling entries are PAID
```

### Pattern 3: Collapsible Entries in AgentPayCard
**What:** Show first 5 entries by default with "Show N more" expansion button.
**When to use:** In AgentPayCard component when entries.length > 5.
**Example:**
```typescript
const [showAll, setShowAll] = useState(false);
const visibleEntries = showAll ? entries : entries.slice(0, 5);
const hiddenCount = entries.length - 5;

// Render visibleEntries in the table
// After table, if hiddenCount > 0 && !showAll:
<button onClick={() => setShowAll(true)}>
  Show {hiddenCount} more
</button>
```

### Anti-Patterns to Avoid
- **Per-period finalization:** Do NOT change PayrollPeriod.status to control editing. The user explicitly chose per-agent granularity.
- **Blocking late entries:** Do NOT prevent entry creation when agent is paid. Entries must still be created and flagged.
- **Scroll-within-scroll:** Do NOT add max-height + overflow:auto to AgentPayCard. Cards expand fully; page scrolls naturally.
- **New export formats:** Do NOT add new CSV columns or export types. Existing exportCSV and exportDetailedCSV are sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Server-side CSV endpoint | Existing client-side exportCSV/exportDetailedCSV | Already built and working (page.tsx:1485-1564) |
| Entry status management | Custom state machine | Existing PayrollEntryStatus enum (PENDING/READY/PAID/ZEROED_OUT/CLAWBACK_APPLIED) | Already has PAID status, mark-paid/mark-unpaid routes exist |
| Role-based access | Custom auth checks | Existing requireRole("PAYROLL", "SUPER_ADMIN") middleware | Already used on mark-paid/mark-unpaid routes |

**Key insight:** Most of Phase 7's infrastructure already exists. The mark-paid/mark-unpaid routes work at the entry level, AgentPayCard has onMarkPaid/onMarkUnpaid prop stubs, and CSV export is fully functional. The new work is guards, collapsibility, and late-entry flagging.

## Common Pitfalls

### Pitfall 1: PayrollPeriodStatus enum confusion
**What goes wrong:** Trying to change PayrollPeriodStatus from OPEN/LOCKED/FINALIZED to OPEN/PAID requires a Prisma enum migration that can break existing data.
**Why it happens:** The user decision says two states (OPEN/PAID) but that's at the entry level, not the period level.
**How to avoid:** Leave PayrollPeriodStatus as-is. All periods stay OPEN. The paid/unpaid concept lives entirely in PayrollEntry.status (already has PAID value). The period-level enum becomes vestigial.
**Warning signs:** Any migration that alters the PayrollPeriodStatus enum values.

### Pitfall 2: Existing mark-paid route marks individual entries, not agent-groups
**What goes wrong:** The existing `POST /payroll/mark-paid` accepts `entryIds` array. The UI already sends all entry IDs for an agent: `entries.map(e => e.id)`. This is correct behavior.
**Why it happens:** Might think a new "mark agent paid" endpoint is needed.
**How to avoid:** The existing pattern works: UI collects all entry IDs for an agent in a period and sends them to mark-paid. No new endpoint needed.
**Warning signs:** Creating a new route when the existing one works.

### Pitfall 3: Net formula mismatch with requirements
**What goes wrong:** REQUIREMENTS.md says `payout + adjustment + bonus - fronted` but code uses `payout + adjustment + bonus - fronted - hold`.
**Why it happens:** Requirements were written before the hold feature was added.
**How to avoid:** Keep the code formula (with hold). It's correct and used consistently in both routes/index.ts:912 and services/payroll.ts:228.
**Warning signs:** Removing `- hold` from the calculation to "match requirements."

### Pitfall 4: Guard must check sibling entries, not just the target entry
**What goes wrong:** Checking only `entry.status === "PAID"` on the entry being edited misses the case where the agent's other entries are PAID but this specific one is PENDING (late arrival).
**Why it happens:** Per-agent paid status means ALL entries for that agent in the period should be locked when ANY are marked paid.
**How to avoid:** Query for any PAID entries for the same agentId + payrollPeriodId combination.
**Warning signs:** Guard only checking `entry.status` instead of sibling entries.

### Pitfall 5: ZEROED_OUT entries should not become PAID
**What goes wrong:** Mark-paid on an agent's entries marks ZEROED_OUT entries as PAID, breaking the commission zeroing logic.
**Why it happens:** The existing route already handles this correctly: `status: { not: "ZEROED_OUT" }` filter on mark-paid.
**How to avoid:** Preserve the existing filter. Verify it's still in place.
**Warning signs:** Removing the ZEROED_OUT exclusion.

## Code Examples

### Existing mark-paid route (routes/index.ts:808-835)
```typescript
// Already implemented -- marks entries as PAID, excludes ZEROED_OUT
router.post("/payroll/mark-paid", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const { entryIds, serviceEntryIds } = z.object({
    entryIds: z.array(z.string()).optional().default([]),
    serviceEntryIds: z.array(z.string()).optional().default([]),
  }).parse(req.body);
  // ...updates PayrollEntry.status to "PAID" with paidAt timestamp
}));
```

### Existing AgentPayCard paid/unpaid toggle (page.tsx:890-898)
```typescript
// Already shows Paid/Unpaid button based on entry status
{entries.every(e => e.status === "PAID") ? (
  <button onClick={onMarkUnpaid}>
    <CheckCircle size={11} /> Paid
  </button>
) : (
  <button onClick={onMarkPaid}>
    <XCircle size={11} /> Unpaid
  </button>
)}
```

### Existing net amount calculation (routes/index.ts:912)
```typescript
const net = Number(entry.payoutAmount) + Number(entry.adjustmentAmount) + bonus - fronted - hold;
```

### Existing CSV export (page.tsx:1485-1500)
```typescript
function exportCSV(range: ExportRange) {
  const filtered = filterPeriodsByRange(range);
  const rows = [["Week Start", "Week End", "Quarter", "Status", "Entries", "Gross", "Net"]];
  // ...generates and downloads CSV from loaded period data
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-period LOCKED/FINALIZED | Per-agent PAID at entry level | Phase 7 (this phase) | Period-level status becomes vestigial; all control at entry level |
| Show all entries always | Collapsible with "Show N more" | Phase 7 (this phase) | Better UX for agents with many entries |

**Deprecated/outdated:**
- `PayrollPeriodStatus.LOCKED` and `PayrollPeriodStatus.FINALIZED`: No longer used in the workflow. All periods remain OPEN. Enum kept in schema to avoid migration risk but never set.

## Open Questions

1. **Schema migration strategy for PayrollPeriodStatus**
   - What we know: Current enum is OPEN/LOCKED/FINALIZED. User wants OPEN/PAID per-agent (entry-level).
   - What's unclear: Whether to remove LOCKED/FINALIZED from the enum or leave them.
   - Recommendation: **Leave the enum as-is.** No period ever needs to be LOCKED or FINALIZED since paid status lives at the entry level. This avoids any migration risk. The `PayrollPeriodStatus` becomes effectively single-valued (always OPEN) but changing it would require enum migration SQL.

2. **Late entry detection mechanism**
   - What we know: When a sale arrives after agent is marked PAID, the entry is created as PENDING.
   - What's unclear: Whether to add a boolean `arrivedAfterPaid` column or detect via sibling status.
   - Recommendation: **Detect via sibling status on the client.** If an agent has some entries with status PAID and others with status PENDING in the same period, the PENDING ones arrived after paid. No schema change needed. Optionally add a `paidAt` timestamp check (entries created after the agent's `paidAt` timestamp).

3. **Handling CLAWBACK_APPLIED entries during mark-paid**
   - What we know: ZEROED_OUT is already excluded from mark-paid. CLAWBACK_APPLIED entries exist for finalized-period adjustments.
   - What's unclear: Should CLAWBACK_APPLIED entries also be excluded from mark-paid?
   - Recommendation: Include CLAWBACK_APPLIED in mark-paid (they represent real financial adjustments that were paid). Only exclude ZEROED_OUT.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | apps/ops-api/jest.config.ts |
| Quick run command | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll" -x` |
| Full suite command | `npx jest --config apps/ops-api/jest.config.ts` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAYR-02 | Agent cards show correct commission totals | manual-only | N/A (React component, no test infra for frontend) | N/A |
| PAYR-03 | Cards collapse/expand with "Show N more" | manual-only | N/A (UI behavior) | N/A |
| PAYR-04 | Per-agent OPEN/PAID status toggle | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll-guard" -x` | No - Wave 0 |
| PAYR-05 | PAID agent rejects entry modifications | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll-guard" -x` | No - Wave 0 |
| PAYR-06 | CSV export works for any period | manual-only | N/A (client-side, already working) | N/A |
| PAYR-07 | Net formula: payout + adjustment + bonus - fronted - hold | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "commission" -x` | Yes (existing) |

### Sampling Rate
- **Per task commit:** `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll" -x`
- **Per wave merge:** `npx jest --config apps/ops-api/jest.config.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/payroll-guard.test.ts` -- covers PAYR-04, PAYR-05 (paid agent guard logic)
- [ ] Test should validate: PAID entries block edits, toggle back to unpaid re-enables edits, late entries are created but not blocked

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `prisma/schema.prisma` -- PayrollPeriodStatus enum (OPEN/LOCKED/FINALIZED), PayrollEntryStatus enum (PENDING/READY/PAID/ZEROED_OUT/CLAWBACK_APPLIED)
- Codebase analysis: `apps/ops-api/src/routes/index.ts` lines 808-864 -- existing mark-paid/mark-unpaid routes
- Codebase analysis: `apps/ops-api/src/routes/index.ts` lines 898-920 -- PATCH /payroll/entries/:id with net formula
- Codebase analysis: `apps/payroll-dashboard/app/page.tsx` lines 776-1140 -- AgentPayCard component
- Codebase analysis: `apps/payroll-dashboard/app/page.tsx` lines 1485-1564 -- CSV export functions
- Codebase analysis: `apps/ops-api/src/services/payroll.ts` -- upsertPayrollEntryForSale, net amount formula

### Secondary (MEDIUM confidence)
- Phase 7 CONTEXT.md -- user decisions on OPEN/PAID workflow, collapsibility, exports

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- extending existing patterns (mark-paid routes, AgentPayCard props)
- Pitfalls: HIGH -- identified from direct codebase analysis of existing guards and formulas

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable internal codebase, no external dependency changes)
