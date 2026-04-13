# Phase 63: Bulk Operations — Context

**Created:** 2026-04-13
**Status:** Ready for /paul:plan

## Goals

1. Batch commission approval on payroll tab — select multiple sales via checkboxes, one confirm modal, one toast
2. Batch mark-paid on payroll tab — select multiple entries, mark all paid in one action
3. Reduce repetitive clicks for payroll staff processing 18 agents' weekly commissions

## Approach

- Single plan — API endpoints + payroll tab UI changes
- Multi-select checkboxes within agent cards on the payroll tab
- Batch-then-confirm pattern: select → one confirmation modal with summary → execute → one toast
- API: batch commission approval endpoint (accepts array of sale IDs)
- Existing mark-paid endpoint already accepts arrays — just needs UI multi-select
- Single Socket.IO broadcast + cache invalidation per batch (not per-sale)

## Scope

### API
- POST /api/payroll/batch-approve-commission — accepts { saleIds: string[] }, approves commission for all, calls upsertPayrollEntryForSale for each
- Existing POST /api/payroll/mark-paid already supports arrays — no API change needed

### UI (Payroll Tab)
- Checkbox column in agent card sale entries
- "Select All" toggle per agent card
- Floating action bar appears when items selected: "Approve Commission (N)" / "Mark Paid (N)"
- ConfirmModal with summary: "Approve commission for N sales?" with agent/member names
- Single toast: "N commissions approved" / "N entries marked paid"
- Deselect all after action completes

## Constraints

- Commission approval gated to PAYROLL + SUPER_ADMIN roles only
- No checkboxes on manager or owner dashboards
- Existing ConfirmModal component for confirmations
- invalidateAll() after batch operations (cache from Phase 62)
- Batch operations use a single transaction where possible

## Open Questions

None — scope is clear.

---

*This file persists across /clear so you can take a break if needed.*
