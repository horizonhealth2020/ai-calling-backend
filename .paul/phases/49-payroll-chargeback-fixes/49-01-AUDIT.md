# Enterprise Plan Audit Report

**Plan:** .paul/phases/49-payroll-chargeback-fixes/49-01-PLAN.md
**Audited:** 2026-04-09
**Verdict:** Enterprise-ready (after applying 2 must-have + 1 strongly-recommended upgrades)

---

## 1. Executive Verdict

**Conditionally acceptable → Enterprise-ready after fixes applied.**

The plan correctly identified the root cause of the net deduction display bug (adjustmentAmount excluded from agent totals) and the print view color gap. The batch parser design was sound in structure but had two functional gaps that would cause silent failures in production: member names were parsed but discarded, and chargebackAmount=0 would produce no deduction for cross-period clawbacks. Both have been fixed. Would sign off on this plan post-remediation.

## 2. What Is Solid

- **Root cause analysis for Task 1** is precise: traced from `applyChargebackToEntry()` creating `adjustmentAmount: -chargebackAmount` through to the display calculation that only sums `payoutAmount`. This is the correct diagnosis.
- **Print color priority order** mirrors WeekSection.tsx exactly (cross-period > in-period-zero > clawback-applied > ACH > default). Avoids color conflicts.
- **Format auto-detection** approach is sound — checking for financial format markers ($, %, date patterns) to distinguish from simple ID+name format.
- **Boundaries are well-scoped** — correctly protects payroll service logic, schema, and payroll routes from unintended changes.
- **isActiveEntry filter preserved** — plan correctly avoids changing this filter, which would have cascading display effects.

## 3. Enterprise Gaps Identified

### GAP-1: Member name parsed but discarded (MUST-HAVE)
`parseSimpleChargebackList` computed `nameParts` from fields but never assigned it to any record field. The `payeeName` field was set to `null` and `memberCompany` to `""`. In the preview table, this would show blank name columns, making it impossible for CS staff to verify they pasted the correct data before submission. Additionally, the chargebacks route can match by `memberName` as fallback — discarding the name removes this matching path.

### GAP-2: chargebackAmount=0 produces no cross-period deduction (MUST-HAVE)
The simple format has no dollar amounts, so `chargebackAmount` arrives as 0. `applyChargebackToEntry()` uses this value directly: `adjustmentAmount: -chargebackAmount`. For cross-period clawbacks, this creates an entry with `adjustmentAmount: 0, netAmount: 0` — a row that shows up as CLAWBACK_CROSS_PERIOD but deducts nothing. The in-period path zeros out regardless (doesn't use the amount), but cross-period silently fails. This is the most dangerous gap: it would appear to work (row created, status set) but the agent's net wouldn't change.

### GAP-3: Format detection with no fallback (STRONGLY RECOMMENDED)
`isSimpleChargebackFormat` uses `sample.every()` on the first 3 lines. If unusual whitespace or a header line causes misclassification, `parseSimpleChargebackList` could return 0 records with no fallback to the financial parser. The user would see an empty preview with no error message.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Member name discarded | Task 3 `parseSimpleChargebackList` | Assigned parsed name to `payeeName` and `memberCompany` fields for preview display and matching fallback |
| 2 | chargebackAmount=0 no-op for cross-period | New Task 4 added, boundaries updated | Added Task 4: server-side default to matched sale's full commission when chargebackAmount=0. Removed chargebacks.ts from DO NOT CHANGE list. Updated frontmatter files_modified. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | No format detection fallback | Task 3 action section | Added fallback instruction: if simple format returns 0 records, retry with financial parser |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Audit logging for detected format type | Low risk — format detection is deterministic and user sees the result immediately in the preview table. Logging adds no safety value for this flow. |

## 5. Audit & Compliance Readiness

- **Audit trail:** Chargeback submissions are already tracked via `ChargebackSubmission` records with timestamps, source, and batch IDs. The new format flows through the same path — no audit trail gap.
- **Silent failure prevention:** GAP-2 was the primary silent failure risk (cross-period deduction appearing to work but doing nothing). Fixed by defaulting to full commission server-side.
- **Post-incident reconstruction:** The existing `rawPaste` field on chargebackSubmission preserves the original input for forensic review. Both formats will be stored.
- **Ownership:** All changes are in known, maintained files with clear ownership (payroll dashboard team, CS dashboard team, API team).

## 6. Final Release Bar

**What must be true before shipping:**
- Task 4 (server-side chargebackAmount=0 default) must be implemented and tested with both OPEN and CLOSED period scenarios
- Member name must be visible in the CS preview table for verification before submission
- Existing financial format must produce identical results to current behavior (regression test)

**Remaining risks if shipped as-is (post-remediation):**
- Format detection heuristic could theoretically misclassify a novel paste format. Mitigated by fallback + preview table showing results before submission.
- No automated tests for the new parser. Acceptable for v2.4 given the preview-before-submit safeguard, but recommend adding parser unit tests in a future phase.

**Sign-off:** Would approve this plan for production after the applied remediations.

---

**Summary:** Applied 2 must-have + 1 strongly-recommended upgrades. Deferred 1 item.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
