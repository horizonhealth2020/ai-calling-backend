---
phase: 16-auth-permission-tightening
plan: 01
subsystem: cs-dashboard, auth-portal
tags: [permission-fix, role-gating, gap-closure]
dependency_graph:
  requires: []
  provides: [canManageCS-positive-allowlist, super-admin-cs-dashboard-card]
  affects: [cs-dashboard, auth-portal]
tech_stack:
  added: []
  patterns: [positive-allowlist-over-negative-exclusion]
key_files:
  created: []
  modified:
    - apps/cs-dashboard/app/page.tsx
    - apps/auth-portal/app/api/login/route.ts
decisions:
  - Replaced isCSOnly negative check with canManageCS positive allowlist (SUPER_ADMIN or OWNER_VIEW)
  - CUSTOMER_SERVICE added to SUPER_ADMIN effectiveRoles so CS dashboard card renders on landing page
metrics:
  duration: 120s
  completed: 2026-03-18
---

# Phase 16 Plan 01: Replace isCSOnly with canManageCS Positive Allowlist Summary

Replaced fragile negative role exclusion check with positive allowlist gating so Submissions tab, delete buttons, and CSV export are visible only to SUPER_ADMIN/OWNER_VIEW, and added CUSTOMER_SERVICE to SUPER_ADMIN effectiveRoles for landing page card visibility.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Replace isCSOnly with canManageCS in CS dashboard and add CUSTOMER_SERVICE to auth-portal effectiveRoles | a684149 | apps/cs-dashboard/app/page.tsx, apps/auth-portal/app/api/login/route.ts |
| 2 | Human-verify checkpoint: permission behavior across roles | APPROVED | N/A |

## What Was Done

### Task 1: Permission Logic Overhaul

**CS Dashboard (apps/cs-dashboard/app/page.tsx):**
- Removed `isCSOnly` negative check (`userRoles.includes("CUSTOMER_SERVICE") && !userRoles.includes("SUPER_ADMIN") && !userRoles.includes("OWNER_VIEW")`)
- Introduced `canManageCS` positive allowlist: `userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW")`
- Updated all 8 usage sites: navItems conditional, effectiveTab, TrackingTab prop, TrackingTab signature, TrackingTabInner signature, canExport, and both delete button guards
- `canExport` simplified from compound check to just `canManageCS`

**Auth Portal (apps/auth-portal/app/api/login/route.ts):**
- Added `"CUSTOMER_SERVICE"` to SUPER_ADMIN effectiveRoles array so the CS dashboard card appears on the landing page

### Task 2: Human Verification

User verified across multiple roles that:
- SUPER_ADMIN sees CS dashboard card and both tabs
- OWNER_VIEW sees both tabs with delete and export
- CUSTOMER_SERVICE sees only Tracking tab without delete or export
- Permission behavior approved

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. Zero occurrences of `isCSOnly` in cs-dashboard/app/page.tsx
2. `canManageCS` appears at all 8 expected locations
3. `CUSTOMER_SERVICE` present in SUPER_ADMIN effectiveRoles array
4. No negative role exclusion patterns remain in permission logic

## Self-Check: PASSED

- FOUND: apps/cs-dashboard/app/page.tsx
- FOUND: apps/auth-portal/app/api/login/route.ts
- FOUND: commit a684149
