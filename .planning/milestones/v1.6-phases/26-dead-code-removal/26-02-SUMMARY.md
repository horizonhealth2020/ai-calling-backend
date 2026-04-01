---
phase: 26-dead-code-removal
plan: 02
subsystem: monorepo-wide
tags: [dead-code, exports, dependencies, cleanup, refactor]
dependency_graph:
  requires: [clean-imports, no-dead-locals]
  provides: [clean-exports, clean-dependencies]
  affects: [ops-api, ops-dashboard, sales-board, packages]
tech_stack:
  added: []
  patterns: [grep-based-export-audit, dependency-audit-by-package]
key_files:
  created: []
  modified:
    - packages/ui/src/components/index.ts
    - packages/utils/src/index.ts
    - packages/socket/src/types.ts
    - apps/ops-api/src/services/auditQueue.ts
    - package.json
    - apps/ops-api/package.json
    - apps/sales-board/package.json
    - package-lock.json
  deleted:
    - packages/ui/src/components/Tooltip.tsx
decisions:
  - Tooltip component removed (zero consumers after v1.3 dashboard consolidation)
  - logEvent/logError removed from @ops/utils (zero consumers -- logging was done inline)
  - formatNegDollar removed from @ops/utils (zero consumers)
  - recharts removed entirely (not imported anywhere in codebase)
  - payroll-dashboard empty directory cannot be removed due to Windows file lock but git does not track it
metrics:
  duration: ~11 minutes
  completed: 2026-03-25
---

# Phase 26 Plan 02: Unreferenced Exports & Unused Dependencies Summary

Removed all dead exports (functions, components, types with zero consumers) and unused dependencies across the monorepo. Every remaining export now has at least one call site, and every dependency in every package.json has a corresponding import.

## Task Results

### Task 1: Remove unreferenced exports, functions, and components

**Commit:** c64f999

**@ops/ui (2 files):**
- Deleted `Tooltip.tsx` component file (zero consumers in any app)
- Removed `Tooltip` re-export from `components/index.ts`

**@ops/utils (1 file):**
- Removed `logEvent` function (zero consumers)
- Removed `logError` function (zero consumers)
- Removed `formatNegDollar` function (zero consumers)
- Kept `formatDollar` and `formatDate` (actively used by 10 dashboard files)

**@ops/socket (1 file):**
- Removed `CSChangedPayload` interface from `types.ts` (not exported from barrel, ops-api defines its own copy)
- Removed `AlertCreatedPayload` interface from `types.ts` (same reason)
- Removed `AlertResolvedPayload` interface from `types.ts` (same reason)

**ops-api services (1 file):**
- Removed `stopAutoScorePolling` function from `auditQueue.ts` (zero call sites; `startAutoScorePolling` is used but stop was never wired up)

**Morgan (0 changes):** All exports have consumers.

**Shared packages verified clean:**
- `@ops/auth`: All 6 exports used (signSessionToken, verifySessionToken, buildSessionCookie, buildLogoutCookie, SESSION_COOKIE + 5 client exports)
- `@ops/types`: All exports used (AppRole, SessionUser, US_STATES, StateCode)
- `@ops/db`: prisma export used by 26 files
- `@ops/socket`: Remaining exports all used (useSocket, SaleChangedPayload, SaleChangedType, DISCONNECT_BANNER, HIGHLIGHT_GLOW)

### Task 2: Remove unused dependencies and clean up empty payroll-dashboard directory

**Commit:** c3cbefd

**Root package.json (2 deps removed):**
- `lucide-react` -- removed (already in ops-dashboard's own package.json; not used by Morgan)
- `recharts` -- removed entirely (not imported by any source file in any app or package)

**apps/ops-api/package.json (1 dep removed):**
- `@ops/utils` -- removed (no import of @ops/utils in ops-api source)

**apps/sales-board/package.json (1 dep removed):**
- `@ops/utils` -- removed (no import of @ops/utils in sales-board source)

**Other package.json files verified clean:**
- ops-dashboard: all 9 deps used
- packages/auth: jsonwebtoken, cookie both imported
- packages/db: @prisma/client imported
- packages/ui, types, utils, socket: no external deps (workspace-only or peer deps)

**payroll-dashboard directory:**
- Directory is empty (0 files) and git does not track it
- Windows file lock prevents deletion in this session
- Any fresh `git clone` will not have this directory (git does not track empty dirs)

## Deviations from Plan

None -- plan executed exactly as written. The only minor note is the payroll-dashboard directory removal was blocked by a Windows file lock, but since git does not track empty directories, this has no impact on the repository.

## Verification

- `npm test`: 90 tests passed (7 suites)
- `npm run test:ops`: 77 tests passed (6 suites)
- `npm install`: completed successfully after dependency removal
- Every remaining export in shared packages verified to have at least one consumer via grep
- Every dependency in every package.json verified to have at least one import in source

## Requirements Satisfied

- **DC-02:** Every exported function and component has at least one call site in the codebase
- **DC-04:** Every dependency in every package.json is imported somewhere in that package's source code

## Self-Check: PASSED

- All modified files exist on disk
- Tooltip.tsx confirmed deleted
- Commit c64f999 (Task 1) verified in git log
- Commit c3cbefd (Task 2) verified in git log
- All tests passing (90 Morgan + 77 ops-api)
