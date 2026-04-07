---
phase: 46
plan: 2
plan_id: 46-02
subsystem: ops-api / chargebacks / alerts
tags: [chargeback, alerts, payroll, cs-dashboard, dead-code]
dependency_graph:
  requires:
    - apps/ops-api/src/services/alerts.ts (createAlertFromChargeback existed but was unwired)
    - apps/ops-api/src/socket.ts (emitAlertCreated)
  provides:
    - End-to-end CS chargeback → payroll alert pipeline
    - Dedupe guard against double-clawback when batch-created clawbacks already exist
  affects:
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/services/alerts.ts
tech_stack:
  added: []
  patterns:
    - "Post-commit best-effort alert dispatch (try/catch around createAlertFromChargeback)"
    - "Idempotent approveAlert: short-circuit gracefully when a matching clawback already exists with matchedBy in (member_id, member_name)"
key_files:
  created:
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-DIAGNOSIS.md
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-02-SUMMARY.md
  modified:
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/services/alerts.ts
decisions:
  - "Plan premise was incorrect: neither CS-originated nor payroll-originated chargebacks were creating payrollAlert rows. createAlertFromChargeback was dead code with zero callers. Fix wires it in for both paths (the user perceived payroll-side as 'working' due to the inline submitted-list UI refresh in PayrollChargebacks.tsx)."
  - "alerts_batch_created event referenced in plan + CONTEXT.md was never implemented. Only emitAlertCreated (single-item, alert:created) exists. Dashboard already subscribes to alert:created — no new socket event needed."
metrics:
  duration: ~30m
  completed: 2026-04-07
  tasks_completed: 2 of 3
  checkpoint_pending: human-verify (Task 3 — UI flow + plan-premise correction)
---

# Phase 46 Plan 02: CS Chargeback Alert Diagnosis and Fix

The CS dashboard's chargeback flow was not surfacing alerts in the payroll dashboard alert area. Diagnosis revealed the root cause was deeper than the plan assumed: **`createAlertFromChargeback` was dead code with zero callers**, so neither CS nor payroll-side submissions were producing `payrollAlert` rows.

## Tasks Completed

### Task 1: Diagnose root cause and write 46-DIAGNOSIS.md
**Commit:** `d3846d4`
**Files:** `.planning/phases/46-.../46-DIAGNOSIS.md`

Findings:
- Both `PayrollChargebacks.tsx` (line 478) and `CSSubmissions.tsx` (line 592) hit the same `POST /api/chargebacks` handler at `apps/ops-api/src/routes/chargebacks.ts:91`
- That handler creates `chargebackSubmission` and `Clawback` rows but **never invokes `createAlertFromChargeback`**
- `createAlertFromChargeback` exists at `apps/ops-api/src/services/alerts.ts:6` but a repo-wide grep shows zero callers
- The user's perception that "payroll path works" is a UI artifact: the same dashboard's submitted-list refreshes inline so the chargeback appears immediately. The actual `payrollAlert` table never received a row from either path
- The `alerts_batch_created` socket event referenced in the plan and CONTEXT.md was never implemented; only `emitAlertCreated` (single-item, event name `"alert:created"`) exists, and the payroll dashboard already subscribes to it at `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx:218`

### Task 2: Wire CS chargebacks into the payroll alert pipeline
**Commit:** `91620e8`
**Files:** `apps/ops-api/src/routes/chargebacks.ts`, `apps/ops-api/src/services/alerts.ts`

- `chargebacks.ts`: imported `createAlertFromChargeback`, added `agent: true` include, collected `alertPayloads` inside the transaction, fired `createAlertFromChargeback` post-commit for each matched chargeback (best-effort try/catch)
- `alerts.ts`: extended `approveAlert` dedupe guard to also recognize batch-created clawbacks (`matchedBy IN ("member_id", "member_name")`) so the alert is gracefully marked APPROVED instead of throwing or double-clawing

### Task 3: Human verification — DEFERRED CHECKPOINT
**Status:** Pending — surfaces in HUMAN-UAT post-wave.

Verification steps (with plan-premise correction):
1. Submit a chargeback from the CS dashboard → confirm an alert appears in the payroll dashboard alert area
2. Submit a chargeback directly from `PayrollChargebacks.tsx` → confirm an alert ALSO appears (this is **new behavior** — verify it now works rather than verify it's unchanged from before)
3. Approve one of the alerts → confirm the existing batch-created clawback is recognized and the alert is short-circuited to APPROVED without double-clawing

## Recovery note

This plan's executor agent encountered a Windows worktree branching bug where its worktree was based on `39e2d1d` (pre-Phase 46) instead of `228af5e`, and the soft-reset check (`merge-base`) falsely reported equality. The agent then routed its work through the main repo path. Recovery happened in the orchestrator: Task 1's diagnosis commit (`d3846d4`) and Task 2's working-tree edits were committed from main as `91620e8`, no work was lost. The merge-base check pattern was the orchestrator's bug; the agent's work output was correct.

## Self-Check: PASSED (Tasks 1-2 done; Task 3 deferred per checkpoint protocol)
