---
phase: 46
plan: 7
plan_id: 46-07
subsystem: ops-api / chargebacks / alerts
tags: [chargeback, alerts, payroll, cs-dashboard, gap-closure, uat]
gap_closure: true
requirements: [GAP-46-UAT-02]
dependency_graph:
  requires:
    - apps/ops-api/src/routes/chargebacks.ts (46-02 wire-up + 46-06 observability)
    - apps/ops-api/src/services/alerts.ts (createAlertFromChargeback + dedupe)
  provides:
    - Source-aware chargeback alert gating (CS creates alerts; PAYROLL skips)
    - source field on POST /api/chargebacks Zod schema with safer "PAYROLL" default
    - source field on POST /api/chargebacks 201 response so callers can confirm path
  affects:
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx
tech_stack:
  added: []
  patterns:
    - "Discriminated POST handler — single endpoint, two flows gated on a body field"
    - "Server-side default favors safer regression: missing source = PAYROLL = no alerts"
key_files:
  created:
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-07-SUMMARY.md
  modified:
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx
decisions:
  - "Server default for missing source is PAYROLL (not CS): unauthored or legacy callers get the safer no-alert path. CS UI declares source explicitly so it is never silently dropped."
  - "Preserved 46-06 observability inside the CS branch unchanged. The empty-payloads warn, per-cb error log, batch summary log, and alertCount/alertAttempted/alertFailed in the 201 response are all wrapped inside if (source === 'CS'); the PAYROLL branch emits its own console.info with batchId and skipped count."
  - "Did NOT persist source on chargebackSubmission DB row. Gating is purely runtime — no schema migration needed and dedupe in alerts.approveAlert (matchedBy IN member_id/member_name) continues to protect legacy data automatically."
metrics:
  duration: ~10m
  completed: 2026-04-07
  tasks_completed: 2 of 2
---

# Phase 46 Plan 07: GAP-46-UAT-02 — Source-Aware Chargeback Alert Gating

UAT round 1 confirmed plan 46-02's design was inverted. 46-02 fired `createAlertFromChargeback` for ALL chargeback submissions, but the user clarified the alert step is a CS → payroll review queue and was never meant to fire on payroll-originated submissions (payroll IS the team that would otherwise approve the alert — the alert is redundant noise on that path).

This plan adds a `source: "CS" | "PAYROLL"` discriminator on the shared POST /api/chargebacks handler and gates the alert pipeline on `source === "CS"`. Both UI submitters now declare their source explicitly. The 46-06 observability landed last hour is preserved unchanged inside the CS branch.

## Tasks Completed

### Task 1 — Server-side gating
**Commit:** `8381728`
**File:** `apps/ops-api/src/routes/chargebacks.ts`

Three changes inside the file:

**1. chargebackSchema** — added optional `source` with safer "PAYROLL" default:

```ts
const chargebackSchema = z.object({
  records: z.array(z.object({...})),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
  // GAP-46-UAT-02 (46-07): discriminator that decides whether to fire the
  // CS → payroll alert pipeline. CS-originated submissions create alerts so
  // payroll can review them; payroll-originated submissions skip the alert
  // step because payroll IS the team that would otherwise approve. Server
  // defaults to "PAYROLL" — the safer regression for any unauthored caller.
  source: z.enum(["CS", "PAYROLL"]).optional().default("PAYROLL"),
});
```

**2. Handler destructure** — pull `source` out of parsed body:

```ts
const { records, rawPaste, batchId, source } = parsed.data;
```

**3. Post-commit alert loop wrapped in `if (source === "CS") {...} else {...}`** — preserves all 46-06 observability inside the CS branch:

```ts
let alertSuccessCount = 0;
let alertErrors: string[] = [];
if (source === "CS") {
  if (alertPayloads.length === 0) {
    console.warn(`[chargebacks] batch ${batchId}: 0 alert payloads built ...`);
  }
  for (const p of alertPayloads) {
    try {
      await createAlertFromChargeback(p.chargebackId, p.agentName, p.memberName, p.amount);
      alertSuccessCount++;
    } catch (err) {
      // ... existing 46-06 per-cb error log ...
      alertErrors.push(`${p.chargebackId}: ${msg}`);
    }
  }
  if (alertErrors.length > 0) {
    console.error(`[chargebacks] batch ${batchId}: ${alertErrors.length}/${alertPayloads.length} alert creations failed (${alertSuccessCount} succeeded)`);
  }
} else {
  console.info(
    `[chargebacks] batch ${batchId}: source=${source}, skipping ${alertPayloads.length} ` +
    `alert creation(s) (direct-to-clawback path — payroll-originated submission)`,
  );
}

return res.status(201).json({
  count: result.count,
  batchId,
  source,
  alertCount: alertSuccessCount,
  alertAttempted: alertPayloads.length,
  alertFailed: alertErrors.length,
});
```

**Note on let vs const:** the 46-06 code declared `alertSuccessCount` and `alertErrors` with `const`/`let` inside the linear flow. After wrapping in the `if (source === "CS")` branch, both are hoisted to the outer scope (still `let`) so the 201 response can read them in the PAYROLL path too — they will simply be `0` and `[]` for that branch, which is the documented expected outcome for payroll-originated callers.

### Task 2 — UI submitters declare source
**Commit:** `e252854`
**Files:** `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx`, `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx`

**CSSubmissions.tsx:595**

```diff
-        body: JSON.stringify({ records, rawPaste: rawText, batchId }),
+        body: JSON.stringify({ records, rawPaste: rawText, batchId, source: "CS" }),
```

**PayrollChargebacks.tsx:481**

```diff
-        body: JSON.stringify({ records: submitRecords, rawPaste: rawText, batchId }),
+        body: JSON.stringify({ records: submitRecords, rawPaste: rawText, batchId, source: "PAYROLL" }),
```

**Other-caller audit:** repo-wide grep for `api/chargebacks` (POST) in `apps/ops-dashboard` returned exactly two POST callsites — the two above. (CSTracking.tsx hits `/api/chargebacks/totals`, `/api/chargebacks/:id`, `/api/chargebacks/:id/resolve`, `/api/chargebacks/:id/unresolve`, none of which are POSTs to the bare endpoint. PayrollChargebacks.tsx:341 hits `/api/chargebacks/preview` which has its own `previewSchema`.) No third caller exists.

## Verification Results

`npx tsc -p apps/ops-api/tsconfig.json --noEmit` — only pre-existing infrastructure errors reported (`@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cookie`, and the `rootDir` misconfig in `apps/ops-api/tsconfig.json` that complains about `packages/auth/src/index.ts` and `packages/types/src/index.ts`). None of the errors mention `chargebacks.ts` or any file modified by this plan. These pre-existing errors are out of scope per the deviation rules — they were already noted in the 46-06 SUMMARY.

Acceptance grep checks (all pass):
- `grep 'source:\s*z\.enum' apps/ops-api/src/routes/chargebacks.ts` → 1 hit (line 40)
- `grep 'source\s*===\s*"CS"' apps/ops-api/src/routes/chargebacks.ts` → 1 hit (line 310)
- `grep 'source:\s*"CS"' apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` → 1 hit (line 595)
- `grep 'source:\s*"PAYROLL"' apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` → 1 hit (line 481)
- `grep 'matchedBy.*chargeback_alert' apps/ops-api/src/services/alerts.ts` → still grep-able (dedupe preserved, untouched by this plan)
- `grep 'GAP-46-UAT-01 diagnosis' apps/ops-api/src/routes/chargebacks.ts` → still present (46-06 diagnosis comment preserved above the now-gated loop)

## Coordination With 46-06

46-06 added observability to the same handler less than an hour before this plan landed. All of it is preserved:

- The empty-payloads `console.warn` lives inside the `if (source === "CS")` branch where it still fires for the CS path that legitimately produced zero matches. For the PAYROLL path the warn is irrelevant (alerts aren't being created at all by design) and the new `console.info` covers it.
- The per-cb `console.error` with `batch ${batchId} cb=${p.chargebackId}` context is unchanged inside the CS loop body.
- The batch-level summary `console.error` for partial failures is unchanged inside the CS branch.
- `alertCount`, `alertAttempted`, `alertFailed` in the 201 response are all preserved. `source` is added alongside them so callers can correlate the count with the path taken. PAYROLL callers see `alertCount: 0, alertAttempted: 0` (alertPayloads is built unconditionally — payroll just skips iterating it).
- The `alerts.ts` defense-in-depth try/catch around `emitAlertCreated` from 46-06 is orthogonal to this plan and untouched.
- The 46-06 diagnosis comment block above the loop is left in place as a historical record — UAT round 1 root cause for "no alert in payroll" was independent of this plan's gating fix and the comment still accurately describes the auto-match starvation pattern.

## Behavior After This Plan

| Submission origin | chargebackSubmission row | Clawback row | payrollAlert row | 201 response source |
|-------------------|--------------------------|--------------|------------------|---------------------|
| CSSubmissions.tsx | created | created (if MATCHED) | created (if MATCHED) | "CS" |
| PayrollChargebacks.tsx | created | created (if MATCHED) | NOT created | "PAYROLL" |
| Unauthored / legacy caller (no source field) | created | created (if MATCHED) | NOT created | "PAYROLL" (default) |

The dedupe in `alerts.approveAlert` continues to recognize legacy `matchedBy IN ("member_id", "member_name")` clawbacks, so any pre-existing payrollAlert rows that get approved post-deploy still short-circuit gracefully without double-clawing.

## Deviations from Plan

None — both tasks executed exactly as written. One micro-deviation: the plan example in Task 1 used `let alertSuccessCount = 0` and `const alertErrors: string[] = []` inside the if branch. Implementation hoisted both to the outer `if`/`else` scope (both `let`) so the 201 response can read them in the PAYROLL path too (where they remain at their initial 0/[] values). The plan's `alertSuccessCount ?? 0` fallback in the response example anticipated this — no surprise, just slightly cleaner.

## Self-Check: PASSED

- `apps/ops-api/src/routes/chargebacks.ts` — modified (schema + destructure + gated loop + response field) — FOUND
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` — modified (source: "CS") — FOUND
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` — modified (source: "PAYROLL") — FOUND
- `.planning/phases/46-.../46-07-SUMMARY.md` — created — FOUND
- Commit `8381728` (Task 1 server-side gating) — FOUND in `git log --oneline`
- Commit `e252854` (Task 2 UI submitters) — FOUND in `git log --oneline`
