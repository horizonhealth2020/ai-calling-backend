---
phase: 46
plan: 8
plan_id: 46-08
subsystem: ops-dashboard / payroll alerts
tags: [chargeback, alerts, ui, payroll, empty-state, gap-closure, uat]
gap_closure: true
requirements: [GAP-46-UAT-03]
dependency_graph:
  requires:
    - 46-03 (collapsed-badge UX being reverted to always-render)
    - 46-06 (alert pipeline for CS chargebacks)
    - 46-07 (alert pipeline completions)
  provides:
    - Always-visible chargeback container with empty-state fallback
  affects:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
tech_stack:
  added: []
  patterns:
    - "Always-render container with conditional inner branches (empty-state vs populated)"
key_files:
  created:
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-08-SUMMARY.md
  modified:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
decisions:
  - "Empty-state renders inside the same bordered container (same borderLeft danger accent) for visual continuity so users recognize the region whether empty or populated"
  - "AlertTriangle icon reused in empty state at opacity 0.6 with C.textMuted color to signal 'known region, just empty' rather than alarm"
  - "Button + table are only rendered when alerts.length > 0; clicking into an empty expand panel would be a bad affordance"
  - "printAgentCards left untouched — that region is 46-09's responsibility within the same wave"
metrics:
  duration: ~5m
  completed: 2026-04-07
  tasks_completed: 1 of 1
---

# Phase 46 Plan 08: Always-Render Chargeback Container with Empty-State Fallback

GAP-46-UAT-03: restore an always-visible chargeback container in the payroll period view. Plan 46-03 had wrapped the entire container in `{alerts.length > 0 && (...)}`, causing the area to render nothing when empty and leaving users unable to distinguish "empty" from "broken". After 46-06 + 46-07 fixed the alert pipeline, this UX regression still had to be reverted so the user could always see the chargeback region.

## Tasks Completed

### Task 1: Always render chargeback container with empty-state fallback
**Commit:** `6216312`
**Files:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`

Changes in the render block around the chargeback container (lines 848-1000):

**Before (lines 848-984):**

```tsx
{/* Chargeback Alerts — collapsed badge with inline expand panel (Phase 46-03) */}
{alerts.length > 0 && (
<div style={{
  background: C.bgSurface,
  borderLeft: `4px solid ${C.danger}`,
  borderRadius: R["2xl"],
  padding: S[4],
}}>
  <button onClick={() => setShowChargebacks(v => !v)} ...>
    <AlertTriangle size={14} color={C.danger} />
    <span>Chargebacks ({alerts.length})</span>
    <span>{showChargebacks ? "(click to collapse)" : "(click to expand)"}</span>
  </button>
  {showChargebacks && (
    <div style={{ overflowX: "auto" }}>
      <table>{/* thead/tbody/alerts.map */}</table>
    </div>
  )}
</div>
)}
```

**After:**

```tsx
{/* Chargeback Alerts — always-visible container (46-08) */}
{/* Phase 46-03: collapsed badge + inline expand when N > 0 */}
{/* GAP-46-UAT-03: empty-state fallback when N === 0 so user can tell empty vs broken */}
<div style={{
  background: C.bgSurface,
  borderLeft: `4px solid ${C.danger}`,
  borderRadius: R["2xl"],
  padding: S[4],
}}>
  {alerts.length === 0 ? (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      fontWeight: 600,
      color: C.textMuted,
    }}>
      <AlertTriangle size={14} color={C.textMuted} style={{ opacity: 0.6 }} />
      <span>No chargebacks</span>
    </div>
  ) : (
  <>
  <button onClick={() => setShowChargebacks(v => !v)} ...>
    <AlertTriangle size={14} color={C.danger} />
    <span>Chargebacks ({alerts.length})</span>
    <span>{showChargebacks ? "(click to collapse)" : "(click to expand)"}</span>
  </button>
  {showChargebacks && (
    <div style={{ overflowX: "auto" }}>
      <table>{/* thead/tbody/alerts.map — byte-identical preservation */}</table>
    </div>
  )}
  </>
  )}
</div>
```

Key properties:

- The outer `<div>` with `borderLeft: 4px solid C.danger` is now unconditionally rendered.
- `{alerts.length === 0 ? emptyState : <>populated</>}` ternary lives inside the container.
- The populated branch wraps the existing 46-03 `<button>` + `{showChargebacks && <div><table>...</table></div>}` inside a `React.Fragment` so the outer `<div>` has exactly one child per branch.
- **thead / tbody / alerts.map block is byte-identical to the prior version** — no whitespace or logic changes inside the table. Only the wrapping conditional and its parentheses moved.
- No new imports, no new state (`showChargebacks` is the same hook from 46-03), no Tailwind.

## Verification

- `grep -q "No chargebacks" PayrollPeriods.tsx` → match (line 867)
- `grep -q "GAP-46-UAT-03" PayrollPeriods.tsx` → match (line 850)
- `grep -E "^\s*\{alerts\.length > 0 && \(\s*$" PayrollPeriods.tsx` → no match (wrapper removed)
- Existing approve flow handlers (`handleApproveAlert`, `handleClearAlert`) still present and untouched
- `npx tsc --noEmit` on ops-dashboard reports zero new errors in PayrollPeriods.tsx (the pre-existing errors in `page.tsx`, `middleware.ts`, and `packages/auth` are out of scope and unrelated)
- printAgentCards region untouched — grep confirms no diff outside the chargeback container block

## Deviations from Plan

None — plan executed exactly as written.

## Sequencing Note (46-09)

Plan 46-09 runs **next** in wave 2 and also modifies `PayrollPeriods.tsx` (print view / `printAgentCards`). This plan was careful to touch **only** the chargeback render region (lines 848-1000). The `printAgentCards` function and byType/print view code are untouched, so 46-09 can layer cleanly on top without merge conflicts. Both plans are sequenced atomically on the main working tree.

## Self-Check: PASSED

- File exists: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (FOUND)
- Commit exists: `6216312` (FOUND)
- SUMMARY.md path: `.planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-08-SUMMARY.md`
