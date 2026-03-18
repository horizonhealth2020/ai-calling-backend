---
phase: 17-documentation-permission-cleanup
plan: 01
subsystem: documentation, ops-api
tags: [documentation, rbac, permissions, gap-closure]
dependency_graph:
  requires: []
  provides: [corrected-requirements, role-guarded-rep-roster]
  affects: [REQUIREMENTS.md, routes/index.ts]
tech_stack:
  added: []
  patterns: [requireRole-middleware-on-mutation-endpoints]
key_files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - apps/ops-api/src/routes/index.ts
decisions:
  - OWNER_VIEW landing card gap documented as intentional UX decision (not a bug)
  - GET /cs-rep-roster kept open to all authenticated users for assignment dropdown access
metrics:
  duration: 87s
  completed: "2026-03-18T19:51:10Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 17 Plan 01: Documentation & Permission Cleanup Summary

Corrected stale requirement text for TRKC-02/TRKT-02/TRKT-06 to match actual implementation, added requireRole guards to cs-rep-roster mutation endpoints, and documented OWNER_VIEW landing card gap as intentional UX decision.

## Tasks Completed

### Task 1: Fix stale REQUIREMENTS.md text and traceability entries
- **Commit:** 8eeae74
- **Files:** .planning/REQUIREMENTS.md
- Updated TRKC-02 from "15 columns" to "8 data columns" matching Phase 14 implementation
- Updated TRKT-02 to remove stale color coding references (active/first_billing blue, hold_reason red italic) and reflect actual UI-SPEC (hold_date red, next_billing green only)
- Updated TRKT-06 from "group-by-agent with collapsible sections" to "flat rows" per Phase 15 design decision
- Marked all three as [x] Complete in requirements and traceability table
- Added Known UX Decisions section documenting OWNER_VIEW landing card omission
- Updated coverage summary to show 0 pending items

### Task 2: Add requireRole guard to rep roster mutation endpoints
- **Commit:** 256aa9c
- **Files:** apps/ops-api/src/routes/index.ts
- Added `requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW")` to POST /cs-rep-roster
- Added `requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW")` to PATCH /cs-rep-roster/:id
- Added `requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW")` to DELETE /cs-rep-roster/:id
- GET /cs-rep-roster intentionally left with requireAuth only (read access needed for assignment dropdowns)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **OWNER_VIEW landing card gap is intentional** - Documented in Known UX Decisions section. OWNER_VIEW can access CS dashboard via direct URL; landing card omitted to keep owner landing focused on KPI summary.
2. **GET /cs-rep-roster stays open** - Read access needed by all authenticated CS users for the assignment dropdown in submission UI.

## Verification Results

- All 40 v1.1 requirements marked [x] (no unchecked boxes remain)
- All traceability entries show "Complete" (no "Pending" entries remain)
- Known UX Decisions section present with OWNER_VIEW documentation
- Exactly 3 cs-rep-roster routes have requireRole (POST, PATCH, DELETE)
- GET /cs-rep-roster has no requireRole (confirmed intentional)

## Self-Check: PASSED

All files exist, all commits verified.
