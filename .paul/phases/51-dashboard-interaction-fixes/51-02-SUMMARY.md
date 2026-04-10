---
phase: 51-dashboard-interaction-fixes
plan: 02
subsystem: ui
tags: [react, toast, debounce, error-handling, form-validation, accessibility]

requires:
  - phase: 51-dashboard-interaction-fixes/01
    provides: ConfirmModal pattern, useToast already in some files

provides:
  - Zero silent error-swallowing catch blocks in dashboard code
  - Toast error feedback on all API failures across all dashboards
  - Debounced search inputs (CSTracking, AgentSidebar) at 300ms
  - Consistent form error clearing on all ManagerEntry fields

affects: [52-visual-consistency-pass]

tech-stack:
  added: []
  patterns:
    - "useDebounce hook (module-level, per-file) for search filtering"
    - "Toast error feedback pattern: .catch(() => { toast('error', 'Failed to [action]'); })"
    - "Form error clearing: setFieldErrors(fe => { const n = {...fe}; delete n.field; return n; })"

key-files:
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/page.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/page.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerConfig.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerKPIs.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/page.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/AgentSidebar.tsx
    - apps/ops-dashboard/app/(dashboard)/cs/page.tsx
    - apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx
    - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx

key-decisions:
  - "JWT decode catch kept intentionally — not an API error"
  - ".json().catch(() => ({})) patterns kept — JSON parse safety, not error swallowing"
  - "useDebounce duplicated in 2 files — not worth extracting for 2 consumers"
  - "cs/page.tsx restructured to inner/outer pattern to support ToastProvider + useToast"

patterns-established:
  - "All API failures show toast('error', 'Failed to [descriptive action]')"
  - "useDebounce<T>(value, delay) for filtering state (input stays instant, filter debounces)"

duration: ~25min
started: 2026-04-09T00:00:00Z
completed: 2026-04-10T00:00:00Z
---

# Phase 51 Plan 02: Error Surfacing, Debounce, Form Clearing Summary

**Replaced all silent .catch(() => {}) error swallowing with descriptive toast feedback across 16 dashboard files, added 300ms debounce to search inputs, and fixed error clearing on 6 ManagerEntry form fields.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25min |
| Tasks | 3 completed |
| Files modified | 16 |
| Qualify results | 3/3 PASS |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Silent catches replaced with toast feedback | Pass | grep confirms zero silent .catch(() => {}) remaining; 1 intentional JWT decode catch kept |
| AC-2: Files without useToast get it added | Pass | 8 files gained useToast import; cs/page.tsx restructured for ToastProvider |
| AC-3: Search inputs debounced at 300ms | Pass | CSTracking and AgentSidebar use useDebounce hook |
| AC-4: ManagerEntry clears all field errors on change | Pass | 6 fields fixed: enrollmentFee, notes, paymentType, leadSourceId, memberId, carrier |

## Accomplishments

- Eliminated all silent error-swallowing catch patterns across all 4 dashboard areas (manager, payroll, owner, CS)
- Added useToast to 8 files that previously had no error feedback mechanism
- Restructured cs/page.tsx to inner/outer component pattern for ToastProvider support
- Added useDebounce hook to CSTracking and AgentSidebar with 300ms delay
- Fixed 6 ManagerEntry form fields missing error clearing on change

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `manager/page.tsx` | Modified | useToast added, 5 fetch catches → toast |
| `manager/ManagerTracker.tsx` | Modified | useToast added, 2 catches → toast |
| `manager/ManagerAudits.tsx` | Modified | useToast added, 4 catches → toast |
| `manager/ManagerSales.tsx` | Modified | 2 sales refresh catches → toast |
| `manager/ManagerEntry.tsx` | Modified | 6 fields: error clearing on change |
| `owner/page.tsx` | Modified | useToast added, 1 catch → toast |
| `owner/OwnerConfig.tsx` | Modified | 4 config load catches → toast |
| `owner/OwnerUsers.tsx` | Modified | 1 users load catch → toast |
| `owner/OwnerOverview.tsx` | Modified | useToast added, 2 catches → toast |
| `owner/OwnerKPIs.tsx` | Modified | useToast added, 1 catch → toast |
| `payroll/page.tsx` | Modified | useToast added, 1 catch → toast |
| `payroll/PayrollChargebacks.tsx` | Modified | 2 catches → toast |
| `payroll/AgentSidebar.tsx` | Modified | useDebounce added, search debounced |
| `cs/page.tsx` | Modified | Restructured inner/outer, useToast, 1 catch → toast |
| `cs/CSTracking.tsx` | Modified | useDebounce added, 1 catch → toast, search debounced |
| `cs/CSSubmissions.tsx` | Modified | 6 catches → toast |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep JWT decode catch silent | Intentional — decoding stored token, not an API call | 1 exception to the "no silent catches" rule |
| Keep .json().catch(() => ({})) | JSON parse fallback for error response bodies | ~44 instances correctly preserved |
| useDebounce duplicated in 2 files | 2 consumers doesn't justify shared module | Can extract later if pattern spreads |
| cs/page.tsx → inner/outer | Needed ToastProvider wrapping to support useToast | Follows pattern already used by manager/page.tsx, owner/page.tsx |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope reduction | 1 | Positive — fewer files than estimated |
| Auto-fixed | 1 | cs/page.tsx restructured for ToastProvider |

### Details

**Scope reduction:** Plan estimated 20 files with silent catches. Actual count was 16 — 4 files (ManagerConfig, OwnerScoring, PayrollService, PayrollProducts) only had `.json().catch(() => ({}))` patterns (parse safety, correctly kept).

**cs/page.tsx restructure:** Component wasn't inside a ToastProvider. Restructured to inner/outer pattern matching other page.tsx files.

## Next Phase Readiness

**Ready:**
- Phase 51 complete (2/2 plans) — ready for transition
- All dashboards now have visible error feedback
- Phase 52 scope: design token migration, responsive grids, CSS transitions, typography tokens
- Skills for Phase 52: redesign-existing-projects, frontend-design

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 51-dashboard-interaction-fixes, Plan: 02*
*Completed: 2026-04-10*
