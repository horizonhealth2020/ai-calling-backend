---
phase: 05-commission-preview-sale-editing
plan: 02
subsystem: ui
tags: [react, commission-preview, inline-editing, live-diff, debounce, abort-controller]

requires:
  - phase: 05-commission-preview-sale-editing
    provides: "Commission preview API endpoint and sale edit PATCH endpoint (Plan 01)"
provides:
  - "Commission preview panel on sales entry form with live calculation"
  - "Inline sale editing in agent sales tab with field diff display"
  - "Role-based save button (Submit for Approval vs Save Changes)"
affects:
  - "apps/manager-dashboard/app/page.tsx"

tech-stack:
  added: []
  patterns:
    - "Debounced preview: 500ms on numeric inputs, immediate on dropdowns"
    - "AbortController for stale request cancellation on preview calls"
    - "JWT decode on client for role-based UI rendering"
    - "Inline edit expansion with animate-slide-down animation"
    - "Live diff with DIFF_OLD (line-through) and DIFF_NEW (bold green) styles"

key-files:
  created: []
  modified:
    - "apps/manager-dashboard/app/page.tsx"

key-decisions:
  - "Commission preview fires on productId, premium, enrollmentFee, paymentType, addonProductIds changes only"
  - "Preview panel always rendered (not conditionally mounted) to hold layout slot"
  - "JWT decoded client-side via atob to determine PAYROLL/SUPER_ADMIN for save button label"
  - "Edit expansion uses colSpan=9 full-width row below sale row"
  - "Pending guard blocks edit form when hasPendingStatusChange or hasPendingEditRequest is true"
  - "Edit state clears on tab switch via onNavChange handler"

patterns-established:
  - "Commission preview panel pattern with debounce + AbortController"
  - "Inline edit expansion pattern with React.Fragment wrapping table rows"
  - "Role detection via client-side JWT decode"

requirements-completed: [SALE-05, SALE-06]

duration: 342s
completed: 2026-03-15
---

# Phase 5 Plan 02: Manager Dashboard Commission Preview and Inline Editing Summary

**Commission preview panel with debounced live calculation on sales entry form, plus inline sale editing in agent sales tab with 7-row grid layout, live field diff, and role-based save behavior**

## Performance

- **Duration:** 342s (~5.7 min)
- **Tasks:** 2/2
- **Files modified:** 1

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `263ee0c` | Commission preview panel on sales entry form |
| 2 | `ae0f5f7` | Inline sale editing with live diff in agent sales tab |

## Task Details

### Task 1: Commission Preview Panel

Added preview panel at top of right column on sales entry form:
- PREVIEW_PANEL, PREVIEW_TOTAL, PREVIEW_LINE, PREVIEW_LABEL style constants
- triggerPreview function with debounce (500ms numeric, immediate dropdowns)
- AbortController to cancel stale in-flight requests
- Shows commission total, bundle status, enrollment bonus, and period
- Loading state with pulse animation, empty state prompt, error fallback
- aria-live="polite" for screen reader accessibility

### Task 2: Inline Sale Editing

Added inline edit capability to agent sales tab:
- EDIT_ROW_EXPANSION, DIFF_OLD, DIFF_NEW, EDIT_BTN, PENDING_EDIT_BADGE style constants
- startEdit fetches full sale details via GET /api/sales/:id
- 7-row edit grid: Product, Premium/Fee, PaymentType/Agent, Addons, Carrier/Member/State, Dates/LeadSource, Notes
- Live diff panel shows changed fields with old-vs-new styling
- triggerEditPreview for commission recalculation during editing
- Role-based save: MANAGER sees "Submit for Approval", PAYROLL/SUPER_ADMIN sees "Save Changes"
- "Edit Pending" badge on rows with pending edit requests
- Guard message blocks editing when change already pending
- Edit state clears on tab switch
- autoFocus on product dropdown when expansion opens

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added JWT decode for user role detection**
- **Found during:** Task 2
- **Issue:** No existing mechanism to determine user role in manager dashboard component
- **Fix:** Imported getToken from @ops/auth/client, decode JWT payload on mount to extract roles array, stored in userRoles state for role-based button rendering
- **Files modified:** apps/manager-dashboard/app/page.tsx
- **Commit:** ae0f5f7

**2. [Rule 2 - Missing functionality] Added hasPendingEditRequest to Sale type**
- **Found during:** Task 2
- **Issue:** Sale type did not include hasPendingEditRequest boolean needed for edit pending badge
- **Fix:** Added hasPendingEditRequest?: boolean to Sale type definition
- **Files modified:** apps/manager-dashboard/app/page.tsx
- **Commit:** ae0f5f7

## Verification

- Build passes: `npx next build --no-lint` completes successfully
- All acceptance criteria strings verified present in page.tsx
- Preview panel renders with aria-live, CALCULATING label, empty/error states
- Edit expansion renders with animate-slide-down, role-based button, diff with role="status"
