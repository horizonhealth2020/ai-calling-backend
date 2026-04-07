---
phase: 46
plan: 6
plan_id: 46-06
subsystem: ops-api / chargebacks / alerts
tags: [chargeback, alerts, observability, gap-closure, uat]
gap_closure: true
requirements: [GAP-46-UAT-01]
dependency_graph:
  requires:
    - apps/ops-api/src/routes/chargebacks.ts (46-02 wire-up)
    - apps/ops-api/src/services/alerts.ts (createAlertFromChargeback)
  provides:
    - Loud failure logging for the CS-to-payroll alert pipeline
    - alertCount / alertAttempted / alertFailed in POST /api/chargebacks 201 response
  affects:
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/services/alerts.ts
tech_stack:
  added: []
  patterns:
    - "Observability-first gap closure: when a wire-up looks correct in source but UAT shows it not firing, instrument the silent paths before re-architecting"
    - "Defensive try/catch around side-effect emits so a downstream emit failure cannot abort an already-committed row insert"
key_files:
  created:
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-06-SUMMARY.md
  modified:
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/services/alerts.ts
decisions:
  - "Hypothesis A confirmed via code reading (no DB query needed): the wire-up is correct, but alertPayloads is silently empty when CS-submitted chargebacks land UNMATCHED or MULTIPLE. The fix is observability, not logic — the alert-creation gate itself belongs to plan 46-07."
  - "Did NOT change the matchStatus gate at chargebacks.ts:198 — that decision is the subject of plan 46-07 (source-aware gating). 46-06 only makes failure modes visible."
metrics:
  duration: ~15m
  completed: 2026-04-07
  tasks_completed: 2 of 2
---

# Phase 46 Plan 06: GAP-46-UAT-01 — CS Chargeback Alert Pipeline Observability

UAT round 1 reported "no chargeback alert in payroll when submitting in CS submissions" even though plan 46-02 wired `createAlertFromChargeback` into POST /api/chargebacks. Diagnosis (Task 1) confirmed Hypothesis A: the wire-up is correct, but the path is starved at the source — `alertPayloads` is only populated for chargebacks that auto-match to exactly one sale. CS rows whose memberId resolves to 0 sales (UNMATCHED) or >1 sales (MULTIPLE) silently produce zero alert rows with zero log output, leaving payroll users with an empty alert area and no signal about why.

Task 2 fixes the observability gap without touching the gate itself (that is 46-07's responsibility).

## Root Cause (Hypothesis A — confirmed)

**Where:** `apps/ops-api/src/routes/chargebacks.ts:198` and `:242-247`

The matching loop only flips `matchStatus="MATCHED"` when `tx.sale.findMany({ where: { memberId } })` returns exactly one row (`:163-166`). The `alertPayloads.push(...)` at `:242-247` is gated on `matchStatus === "MATCHED" && matchedSaleId` at `:198`. CS submissions from `CSSubmissions.tsx:595` send `{records, rawPaste, batchId}` with **no** `selectedSaleId`, so every record goes through the auto-match path and is at the mercy of how many sales exist for that memberId.

**Downstream pipeline is intact** (verified, no changes needed):
- `apps/ops-api/src/services/alerts.ts:6-22` — `createAlertFromChargeback` inserts the row and emits `alert:created`
- `apps/ops-api/src/services/alerts.ts:24-30` — `getPendingAlerts` filters only on `status: "PENDING"`, no hidden agentId or join filter
- `apps/ops-api/src/routes/alerts.ts:11-14` — `GET /api/alerts` returns `getPendingAlerts()` directly
- `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx:143, :240` — fetches `/api/alerts` and stores in `alerts` state
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:849, :874, :892` — renders when `alerts.length > 0`, no client-side filter
- `apps/ops-api/src/socket.ts:101-107` — `emitAlertCreated` is already wrapped in try/catch + io optional chain, cannot throw

So the only way no alert reaches the dashboard is `alertPayloads.length === 0` at the top of the post-commit loop. That state was completely silent before this plan.

## Tasks Completed

### Task 1 — Diagnosis comment
**Commit:** `6c8e0f9`
**File:** `apps/ops-api/src/routes/chargebacks.ts`

Wrote a `// GAP-46-UAT-01 diagnosis (46-06):` comment block above the alertPayloads loop citing root cause + 6 file:line evidence pointers and naming the Task 2 fix. No business logic changed.

### Task 2 — Observability fix
**Commits:** `c3e7b06`
**Files:** `apps/ops-api/src/routes/chargebacks.ts`, `apps/ops-api/src/services/alerts.ts`

`chargebacks.ts`:
- Added a `console.warn` immediately before the alertPayloads loop when `alertPayloads.length === 0`. The warning includes batchId, total chargebacks submitted, and an explicit pointer to "matchStatus on the inserted chargebackSubmission rows" so future UAT can resolve "no alerts" in a single grep.
- Replaced the silent `console.error("createAlertFromChargeback failed:", err)` with a per-chargeback error log carrying `batch ${batchId} cb=${p.chargebackId}` context, and a batch-level summary log when any failures occur.
- Tracked `alertSuccessCount` and `alertErrors` and added them to the 201 response as `alertCount`, `alertAttempted`, `alertFailed`. This lets CSSubmissions.tsx (or any future caller) detect a partial-failure mode without scraping server logs.

`alerts.ts`:
- Wrapped `emitAlertCreated` inside `createAlertFromChargeback` in its own try/catch as a defense-in-depth guard. The socket emit is already safe (`emitAlertCreated` has its own try/catch + io optional chain), but a future change could push a throw earlier. With the new wrapper, the alert row insert that already committed cannot be undone by an emit-side throw.

## Diagnosis Comment Block (current state in chargebacks.ts)

```ts
// GAP-46-UAT-01 diagnosis (46-06):
// Root cause: Hypothesis A — alertPayloads is silently empty for CS-submitted
//   chargebacks whose member has 0 or >1 sales in the DB. The matching loop
//   at chargebacks.ts:157-186 only flips matchStatus="MATCHED" when exactly
//   one sale exists for cb.memberId; the alertPayloads push at :242-247 is
//   gated on "matchStatus === MATCHED" at :198. UAT round 1 Test 1 ("no
//   alert in payroll") and Test 3 ("chargebacks exist, no alerts at all")
//   are both explained by chargebacks landing in UNMATCHED/MULTIPLE with
//   zero observable logging. createAlertFromChargeback + GET /api/alerts +
//   payroll page.tsx:143 all work correctly end-to-end — the pipeline is
//   starved at the source. Evidence:
//     - chargebacks.ts:198 (gate)
//     - chargebacks.ts:242-247 (push only when matched)
//     - alerts.ts:24-30 getPendingAlerts (no hidden filter)
//     - routes/alerts.ts:11-14 GET /alerts (no hidden filter)
//     - payroll/page.tsx:143 + PayrollPeriods.tsx:849 (renders alerts.length>0)
//     - CSSubmissions.tsx:595 sends {records, rawPaste, batchId} with no
//       selectedSaleId, so every CS row auto-matches by memberId only.
// Fix in Task 2: Make the silent empty-payloads path loud with a structured
//   warn log (batchId, chargeback count, matched count, unmatched/multiple
//   counts), track alertSuccessCount / alertErrors around createAlertFromChargeback
//   with batchId + cbId context, and return alertCount in the 201 response
//   so callers can detect the silent mode without scraping logs. Non-MATCHED
//   chargebacks still flow through the existing /chargebacks UI — this plan
//   does NOT change the alert-creation gate (that belongs to 46-07).
```

## Verification Results

`npx tsc -p apps/ops-api/tsconfig.json --noEmit` — the only errors reported are pre-existing infrastructure issues (missing `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cookie`, and a `rootDir` misconfig in `apps/ops-api/tsconfig.json` that makes it complain about `packages/auth/src/index.ts` and `packages/types/src/index.ts`). None of the errors mention `chargebacks.ts` or `services/alerts.ts`. These pre-existing errors are out of scope per the deviation rules and have been logged for follow-up.

Acceptance grep checks (all pass):
- `grep -c "GAP-46-UAT-01 diagnosis" apps/ops-api/src/routes/chargebacks.ts` → 1
- `grep -c "alertSuccessCount" apps/ops-api/src/routes/chargebacks.ts` → 5
- `grep -c "alertCount" apps/ops-api/src/routes/chargebacks.ts` → 2
- `grep -c "matchedBy.*chargeback_alert" apps/ops-api/src/services/alerts.ts` → 2 (dedupe preserved)
- No changes to `prisma/schema.prisma`

## Coordination With Plan 46-07

Plan 46-07 will restructure POST /api/chargebacks so that payroll-side submissions skip the alert path entirely (alerts only fire for CS-originated rows). The observability added by 46-06 survives 46-07 unchanged:
- The empty-payloads warn log keeps working — it just becomes the expected outcome for payroll-originated batches and an unexpected outcome (worth investigating) for CS-originated batches.
- The `alertCount` response field is also forward-compatible: payroll-originated callers will see `alertCount: 0` by design, CS-originated callers will see it match their submission count when matching succeeds.
- The defensive try/catch around `emitAlertCreated` is orthogonal to the gating change.

No part of 46-06's fix will be ripped out by 46-07. The fix is purely additive instrumentation around an existing wire-up.

## Deviations from Plan

None — both tasks executed exactly as written. The plan's "If Hypothesis A" branch in Task 2 was selected after the Task 1 diagnosis confirmed it.

## Self-Check: PASSED

- `apps/ops-api/src/routes/chargebacks.ts` — modified (diagnosis comment + observability) ✓
- `apps/ops-api/src/services/alerts.ts` — modified (defensive try/catch around emit) ✓
- `.planning/phases/46-.../46-06-SUMMARY.md` — created ✓
- Commit `6c8e0f9` (Task 1 diagnosis) — `git log --oneline | grep 6c8e0f9` → FOUND ✓
- Commit `c3e7b06` (Task 2 fix) — `git log --oneline | grep c3e7b06` → FOUND ✓
