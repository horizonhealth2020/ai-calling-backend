# Phase 10: Sale Status Payroll Logic - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Sale status (Ran/Declined/Dead) drives commission calculation — only Ran earns commission. All three statuses create payroll entries for visibility. Changing a sale from Dead/Declined to Ran requires payroll approval through a change request workflow. This phase replaces the existing SaleStatus enum, modifies commission logic to gate on status, adds the approval workflow, and updates affected dashboards.

</domain>

<decisions>
## Implementation Decisions

### Status model
- Replace current SaleStatus enum (SUBMITTED/APPROVED/REJECTED/CANCELLED) with three values: RAN, DECLINED, DEAD
- Migrate all existing sale records to RAN (they were working sales)
- Sales entry form includes a status dropdown — manager picks Ran/Declined/Dead at creation time
- Status dropdown defaults to blank ("Select status...") — manager must explicitly choose
- Status is also changeable inline on the agent sales tab (which already has a status column)

### Status transition rules
- Managers can freely change status in any direction EXCEPT Dead/Declined → Ran
- Dead/Declined → Ran creates a change request for payroll approval instead of applying immediately
- Ran → Dead/Declined applies immediately and zeroes commission instantly (no approval needed)
- Dead ↔ Declined changes are free (no commission impact either way)

### Commission zeroing behavior
- Declined/Dead sales create $0 payroll entries — visible as normal rows with a status badge
- $0 entries are EXCLUDED from period totals (sale count and net amount only reflect Ran sales)
- When Ran → Dead/Declined and the original period is already finalized/paid, create a negative adjustment in the current open period (similar to existing clawback mechanism)
- Sales board leaderboard only counts Ran sales — Declined/Dead don't appear

### Pending Ran state
- While awaiting payroll approval, sale stays at $0 commission (treated as Dead/Declined still)
- "Pending Ran" does not count on leaderboard or KPIs until approved
- Commission only activates after payroll approves the change request
- Pending Ran gets a distinct badge color (amber/yellow) with a clock/pending icon on the agent sales tab

### Change request workflow
- Selecting Ran on a Dead/Declined sale triggers inline confirmation: "This will create a change request for payroll approval"
- Sale status shows as "Pending Ran" with visual indicator until approved/rejected
- Approval queue appears INSIDE payroll cards — pending requests show within the relevant agent's payroll card, highlighted
- PAYROLL and SUPER_ADMIN roles can approve/reject requests
- On rejection: sale reverts to its original Dead or Declined status, no reason required

### Audit and data model
- Status changes and approval actions logged via existing logAudit() service (app_audit_log table)
- New StatusChangeRequest table for persisting pending approvals: saleId, requestedBy, requestedAt, oldStatus, newStatus, status (PENDING/APPROVED/REJECTED), reviewedBy, reviewedAt
- Approval/rejection also logged to audit log for compliance

### Claude's Discretion
- Exact badge colors for Ran (green), Declined (red), Dead (gray), Pending Ran (amber)
- StatusChangeRequest table field naming conventions (follow existing @map pattern)
- How the inline confirmation dialog looks (toast, popover, or modal)
- Payroll card highlighting style for pending approval items
- Whether to add a "Pending" count badge to the payroll dashboard header

</decisions>

<specifics>
## Specific Ideas

- "Agent sales tab already has a status column" — leverage existing column for the status dropdown
- Change request should feel lightweight — inline confirmation, not a heavy modal workflow
- Payroll sees pending requests in context of the agent's card, not in a separate queue
- Negative adjustments for finalized periods should follow the same pattern as existing clawbacks

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatusBadge` component in manager-dashboard/app/page.tsx (line 352): Already renders colored badges by status string — extend with Ran/Declined/Dead/Pending Ran colors
- `logAudit()` in apps/ops-api/src/services/audit.ts: Existing audit logging infrastructure for status changes and approvals
- `upsertPayrollEntryForSale()` in apps/ops-api/src/services/payroll.ts: Payroll entry creation — needs status gate to set commission to $0 for non-Ran
- Clawback model and logic: Pattern for negative adjustments in finalized periods

### Established Patterns
- SaleStatus enum in prisma/schema.prisma (line 33): Currently SUBMITTED/APPROVED/REJECTED/CANCELLED — will be replaced
- PayrollEntryStatus enum: PENDING/READY/PAID/ZEROED_OUT/CLAWBACK_APPLIED — ZEROED_OUT may be useful for Dead/Declined entries
- Inline CSSProperties with dark glassmorphism theme for all UI changes
- Zod validation with zodErr() wrapper for all API input validation

### Integration Points
- POST /api/sales route: Needs to accept status field and gate commission calculation
- PATCH /api/sales/:id route: Needs status change logic with approval workflow trigger
- Manager dashboard sales form: Add status dropdown (blank default, Ran/Declined/Dead options)
- Agent sales tab: Status column already exists — make it an editable dropdown with approval logic
- Payroll dashboard: Add pending approval display inside agent payroll cards
- Sales board queries: Filter to status = RAN only

</code_context>

<deferred>
## Deferred Ideas

- Bulk status changes (selecting multiple sales to change status at once) — future enhancement
- Rejection reason field on change requests — keep it simple for now
- Notification system for change request outcomes (manager notified when approved/rejected) — future phase

</deferred>

---

*Phase: 10-sale-status-payroll-logic*
*Context gathered: 2026-03-15*
