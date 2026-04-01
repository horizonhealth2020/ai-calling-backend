# Phase 24: Chargeback Automation & Data Archival - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Two capabilities:
1. **Chargeback-to-clawback automation** — Auto-match chargebacks to sales on submission, auto-create clawback records when approved, fix the existing approveAlert() bug that uses memberId as saleId.
2. **Data archival** — Archive high-volume log tables (call_audits, convoso_call_logs, app_audit_log) to parallel archive tables with admin restore capability.

</domain>

<decisions>
## Implementation Decisions

### Sale Matching Strategy
- **D-01:** Match chargebacks to sales using exact `memberId` match (chargeback.memberId -> sale.memberId). No fuzzy matching.
- **D-02:** When multiple sales match a single chargeback, flag for manual review — do NOT auto-select. CS team picks the correct sale.
- **D-03:** Dedupe guard required — when a chargeback is manually entered or converted from the CS board, the system must check if a clawback already exists for that chargeback/sale combo in the agent's payroll and flag the duplicate. Prevents double-deducting.

### Clawback Amounts & Timing
- **D-04:** Auto-clawback amount = agent's commission portion on the original sale, NOT the full chargeback amount. Must look up the original sale's commission/payout to calculate.
- **D-05:** Approver chooses the payroll period for the clawback. This matches the existing alert approval UX which already has period selection.

### Archive Table Design
- **D-06:** Archive all three high-volume tables: `call_audits`, `convoso_call_logs`, `app_audit_log`.
- **D-07:** Use parallel archive tables (`call_audits_archive`, `convoso_call_logs_archive`, `app_audit_log_archive`) with identical schemas. Restore = copy rows back to main table.
- **D-08:** Default age threshold: 90 days. Records older than 90 days are eligible for archival.

### Archive UI
- **D-09:** Archive management lives inside the existing Config tab of the owner dashboard — NOT a separate tab or page.
- **D-10:** Inline confirmation UX showing record count (e.g., "Archive 1,247 records older than 90 days?") with confirm/cancel buttons. No modal or type-to-confirm.

### Claude's Discretion
- Migration strategy for creating archive tables (single migration vs per-table)
- Socket.IO event name/payload for auto-created clawbacks (CLAWBACK-05)
- Archive stats display format within Config tab (cards, table, or inline stats)
- How to surface unmatched chargebacks visually in the tracking table (CLAWBACK-04)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Chargeback & Clawback Logic
- `apps/ops-api/src/services/alerts.ts` — Current approveAlert() with the saleId bug (line 46) that CLAWBACK-01 fixes
- `apps/ops-api/src/routes/chargebacks.ts` — Chargeback submission, resolution, and listing routes
- `apps/ops-api/src/routes/alerts.ts` — Alert approval/clearing routes that call approveAlert()

### Database Schema
- `prisma/schema.prisma` — ChargebackSubmission (line 536), Clawback (line 361), PayrollAlert (line 570), CallAudit (line 217), ConvosoCallLog (line 456), AppAuditLog (line 444)

### Socket Events
- `apps/ops-api/src/socket.ts` — Existing emitAlertCreated, emitAlertResolved, emitCSChanged patterns

### Owner Dashboard
- `apps/ops-dashboard/app/(dashboard)/owner/page.tsx` — Tab registration pattern (ActiveSection type, navItems, subtitleMap, conditional render)
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerConfig.tsx` — Config tab where archive management section will be added

### Commission Lookup
- `apps/ops-api/src/services/payroll.ts` — Commission calculation logic needed to compute agent's commission portion for D-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createAlertFromChargeback()` in services/alerts.ts — already creates PayrollAlert from chargeback; needs enhancement for auto-matching
- `emitCSChanged`, `emitAlertCreated`, `emitAlertResolved` — Socket.IO patterns for real-time updates
- `asyncHandler`, `zodErr`, `dateRange` — shared route helpers already imported in chargebacks.ts
- `StatCard`, `EmptyState`, `SkeletonTable` from @ops/ui — reusable for archive stats display
- `getSundayWeekRange` from services/payroll.ts — date range utilities

### Established Patterns
- Route files are split by domain (chargebacks.ts, alerts.ts, etc.) — new archive routes go in a new file
- Prisma schema uses `@@map("table_name")` convention — archive tables should follow same pattern
- Inline React.CSSProperties for all UI — no Tailwind
- Config tab pattern in OwnerConfig.tsx for adding new sections

### Integration Points
- Chargeback submission POST `/chargebacks` — where auto-matching runs on submission
- Alert approval in `approveAlert()` — where auto-clawback creation triggers
- Owner dashboard Config tab — where archive management UI is added
- Prisma migrations — new archive tables need a migration

</code_context>

<specifics>
## Specific Ideas

- Dedupe is critical: the user specifically wants a guard against double-clawbacks when chargebacks enter the system through multiple paths (manual entry, CS board conversion, batch paste)
- Commission portion clawback (not full chargeback amount) requires looking up the original PayrollEntry for the sale to get the actual payout amount

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-chargeback-automation-data-archival*
*Context gathered: 2026-03-24*
