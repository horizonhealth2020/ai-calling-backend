---
phase: 46
plan: 5
plan_id: 46-P05
subsystem: ops-api / sales delete
tags: [sales, delete, cascade, aca, audit, transaction]
dependency_graph:
  requires:
    - Phase 42 acaCoveringSaleId self-relation on Sale
    - apps/ops-api/src/services/audit.ts logAudit helper
  provides:
    - Atomic single-click cascade delete for parent sales with ACA child sales
    - cascadedChildSaleIds field on DELETE Sale audit log payloads
  affects:
    - apps/ops-api/src/routes/sales.ts (DELETE /sales/:id handler)
tech_stack:
  added: []
  patterns:
    - "Pre-fetch related child IDs OUTSIDE the transaction; pass through deleteMany with `id: { in: childIds }` inside a single $transaction for atomicity"
    - "deleteMany with empty `in: []` arrays is a safe no-op — guards not required for the no-child path"
key_files:
  created:
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-05-SUMMARY.md
  modified:
    - apps/ops-api/src/routes/sales.ts
decisions:
  - "Cascade child dependents (saleAddon, clawback, payrollEntry, statusChangeRequest, saleEditRequest) BEFORE the child sale row, BEFORE the parent cleanup block — all 12 operations live inside a single prisma.$transaction array"
  - "Audit payload extended with cascadedChildSaleIds (always present, empty array on no-child path) — never silently dropped per D-19"
metrics:
  duration: ~10m
  completed: 2026-04-07T16:52:04Z
  tasks_completed: 1 of 2
  checkpoint_pending: human-verify (Task 2)
---

# Phase 46 Plan 05: ACA Cascade Delete Summary

DELETE /sales/:id now atomically removes the parent sale plus any ACA child sales linked via Phase 42's `acaCoveringSaleId` self-relation, eliminating the orphaned-child / second-click delete bug.

## Tasks Completed

### Task 1: Cascade ACA child sale delete in DELETE /sales/:id transaction
**Commit:** `eefee0d`
**Files:** `apps/ops-api/src/routes/sales.ts`

Rewrote the DELETE handler at `apps/ops-api/src/routes/sales.ts:523`:

1. Added a `prisma.sale.findMany({ where: { acaCoveringSaleId: saleId } })` lookup BEFORE the transaction to collect child sale IDs.
2. Expanded the `prisma.$transaction` array from 6 operations to 12: six new `deleteMany` calls covering child dependents (`saleAddon`, `clawback`, `payrollEntry`, `statusChangeRequest`, `saleEditRequest`) and the child sale rows themselves, ordered before the existing parent cleanup so FK references resolve correctly.
3. Extended the `logAudit` payload with `cascadedChildSaleIds: childIds` so the audit log records exactly which children were removed (empty array on the no-child regression path).
4. Preserved `requireAuth`, `requireRole("MANAGER", "SUPER_ADMIN")`, `zodErr(pp.error)` wrapper, and existing 404 / 204 response semantics.

**Verification (acceptance criteria):**
- `grep acaCoveringSaleId apps/ops-api/src/routes/sales.ts` -> match (line 533)
- `grep cascadedChildSaleIds apps/ops-api/src/routes/sales.ts` -> match (line 565)
- `grep -c 'saleId: { in: childIds }' apps/ops-api/src/routes/sales.ts` -> 5 (one per dependent table)
- `grep prisma.sale.findMany apps/ops-api/src/routes/sales.ts` -> matches at line 532 (new child lookup)
- `grep prisma.\$transaction` -> still a single transaction
- `npx tsc -p apps/ops-api/tsconfig.json --noEmit` -> sales.ts is clean (pre-existing errors in unrelated files: bcryptjs/jsonwebtoken/cookie type defs and rootDir config in `auth.ts`/`packages/auth`, plus `acaBundledCommission` non-optional shape mismatch in `commission.test.ts` / `status-commission.test.ts` — out of scope per SCOPE BOUNDARY rule, owned by other Phase 46 plans).

### Task 2: Human verification — Sammy Machado single-click cascade delete (D-20)
**Status:** Pending — checkpoint deferred to post-wave verification.

This is a `checkpoint:human-verify` gate that requires browser interaction and DB inspection against live data. It cannot be performed inside the parallel worktree. The orchestrator should surface this checkpoint after the wave merges back to main, at which point the operator should:

1. Navigate to Sammy Machado's AD&D core sale row with an attached ACA chip.
2. Click delete ONCE on the parent sale row.
3. Confirm both rows disappear without a second delete.
4. Refresh and confirm both rows stay deleted.
5. Inspect the most recent `app_audit_log` DELETE Sale row — confirm `metadata.cascadedChildSaleIds` is present and contains the ACA child's ID.
6. Regression: delete a non-ACA-bundled sale; confirm `cascadedChildSaleIds` is `[]` and no crash.
7. Regression: delete a sale with clawbacks + payroll entries but no ACA child; confirm parent cleanup path is unchanged.

## Deviations from Plan

None — Task 1 was implemented exactly as specified in the plan's `<action>` block. The pre-existing TypeScript errors found while running `tsc` are unrelated to this plan's file (`sales.ts`) and are out of scope per the executor's scope boundary rule.

## Authentication Gates

None.

## Deferred Issues

Pre-existing TypeScript errors discovered while running the verification command (out of scope, NOT introduced by this plan):

- `apps/ops-api/src/routes/auth.ts` / `apps/ops-api/src/routes/users.ts`: missing `@types/bcryptjs`
- `packages/auth/src/index.ts`: missing `@types/jsonwebtoken`, `@types/cookie`, plus `rootDir` constraint violations for `@ops/auth` and `@ops/types`
- `apps/ops-api/src/services/__tests__/commission.test.ts` and `status-commission.test.ts`: `acaBundledCommission` shape mismatch (`Decimal | null | undefined` vs `Decimal | null`) — owned by Plan 46-01 which adds the new Product field

These are tracked here for visibility but should not block plan 46-05 completion.

## Self-Check: PASSED

- `apps/ops-api/src/routes/sales.ts` modified — FOUND (verified via grep)
- Commit `eefee0d` — FOUND in `git log`
- `46-05-SUMMARY.md` created — FOUND (this file)
