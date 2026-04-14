# Enterprise Plan Audit Report

**Plan:** `.paul/phases/68-cs-analytics-upgrade/68-01-PLAN.md`
**Audited:** 2026-04-14
**Verdict:** Conditionally acceptable → **enterprise-ready after applied upgrades**

---

## 1. Executive Verdict

The plan was **structurally sound but conditionally acceptable** as originally written. Core architecture (read-side aggregator extension, role-gated endpoint, correct attribution model via `assignedTo`, explicit pre-v2.9 cutoff, idempotent by nature) is correct and reuses proven Phase 59/61/67 patterns. However, the plan had enterprise gaps around access logging for HR-adjacent performance data, input validation (malformed/unbounded ranges), test coverage for new math-heavy logic, API error contract, and accessibility.

After applying 3 must-have and 6 strongly-recommended upgrades, the plan is **enterprise-ready**. I would sign off on executing it as-is.

## 2. What Is Solid

- **Correct attribution model.** The plan locked in `assignedTo` (round-robin) as the credit anchor rather than `submittedBy` (owner/admin) or `resolvedBy` (whoever clicked resolve). This is the right accountability design — changing it would undermine the phase's purpose.
- **Explicit pre-v2.9 exclusion with rationale.** The cutoff is documented with the distinction between attempt-based exclusion and outcome-based inclusion — a nuanced, data-correct decision.
- **Read-side scope discipline.** No schema changes, no mutations, no new endpoints beyond one read endpoint. Blast radius is contained.
- **Role gate at the route level.** Authorization uses the established `requireAuth` + `requireRole` pattern, inheriting proven middleware.
- **Pattern reuse.** Extends existing `csAnalyticsAggregator.ts` additively instead of creating a parallel service. Low integration risk.
- **Partial-failure resilience called out.** The plan references the aggregator's try/catch-per-section pattern.
- **Divide-by-zero explicitly addressed.** `safeDivide` equivalent for saveRate.

## 3. Enterprise Gaps Identified

1. **No access audit trail.** The endpoint exposes per-rep performance data (HR-adjacent, SOC 2 relevant). A rogue owner or compromised account could pull rep performance history with no forensic evidence. Existing `logAudit()` infra was not wired in.
2. **No input validation on `from`/`to`.** Malformed ISO, reversed range, unbounded range (10-year query), and missing params all have undefined/unsafe behavior. Risks: 500s, slow queries, accidental DoS from the UI.
3. **No automated test coverage** for new aggregator math (saveRate, cutoff, bucket completeness, bypass rollup, attribution credit). Phase 61 established the test infrastructure specifically to catch this class of regression; not using it is a gap.
4. **API error contract not pinned.** "Partial results on failure" is mentioned but the shape of "partial" is not defined. UI could break on null vs. empty-array divergence depending on which sub-query fails.
5. **CSV export lacks audit traceability.** Exported file has no range or timestamp in filename — a printed/forwarded CSV cannot be traced back to the query that produced it.
6. **Roster reconciliation behavior unspecified.** `assignedTo` is free-text; typos, whitespace, or removed roster entries silently mis-attribute or drop credit. The existing aggregator does `.trim()` but no case-normalization and no explicit "unknown" bucket.
7. **No accessibility requirements** for sortable column headers or the Recharts visualization. WCAG conformance is an enterprise expectation and Phase 50 already established the project's a11y patterns.
8. **Timezone handling implicit.** Owners think in America/New_York days; Prisma queries take UTC boundaries. Without explicit Luxon conversion, day-boundary records are incorrectly included/excluded.
9. **Attribution model not documented as a boundary.** A future maintainer could "fix" the assignee-credit model into resolver-credit without realizing it's an intentional accountability design.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | No audit logging on endpoint access | Added AC-7; Task 1 action + verify | `logAudit("cs_outreach_analytics_viewed", {from, to})` wired in with best-effort try/catch |
| 2 | No input validation | Added AC-6; Task 1 action + verify | Zod schema, 400 on malformed/reversed/>366d, 30-day rolling default, Luxon America/New_York → UTC day boundary |
| 3 | No test coverage for math-heavy aggregator | Added new Task 1b + file in `files_modified` | 8 unit test cases covering divide-by-zero, cutoff, bucket completeness, bypass, attribution, unknown assignee, normalization, sub-query failure |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 4 | API error contract unpinned | Added AC-8; Task 1 action | Safe defaults (empty arrays, zero counts) on sub-query failure; stable event name for logError |
| 5 | CSV filename not audit-traceable | Task 2 action | Filename format `cs-outreach-{type}-{from}-to-{to}-generated-{ISO}.csv` |
| 6 | Roster reconciliation undefined | Added AC-9; Task 1 action | Trim + case-insensitive match against CsRepRoster; unknown assignees grouped under `(unassigned/unknown)` |
| 7 | Accessibility not required | Task 2 action + verify; Task 3 action + verify | `aria-sort` on headers with keyboard activation; chart `role="img"` + `aria-label` + visually-hidden data table |
| 8 | Timezone handling implicit | Task 1 action | Luxon America/New_York parse, convert to UTC day boundaries before Prisma |
| 9 | Attribution model undocumented | Added locked ATTRIBUTION MODEL section in `<boundaries>` | Assignee-credit model locked with requirement for stakeholder sign-off to change |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Cache layer | Explicitly scoped out in plan. If performance p95 exceeds 500ms, revisit. Not release-blocking for a sub-second aggregation on ~18 reps × ~50 records. |
| 2 | Rate limiting on endpoint | Internal ops tool; audience is 2 users (owner + super admin); auth gate already in place. Cost of abuse is low. |
| 3 | Feature flag for new section | Additive UI section in an already role-gated tab. Contained blast radius. Rollback = single file revert. Flag overhead unjustified. |

## 5. Audit & Compliance Readiness

**After applied upgrades:**

- **Defensible audit evidence:** Yes — `app_audit_log` entries on every successful access with userId, role, range. CSV exports are timestamped and range-tagged, so forwarded copies remain traceable.
- **Silent failure prevention:** Yes — safe-default error contract means sub-query failures surface as logged errors rather than UI crashes or misleading zeros without cause. Unknown assignees surface instead of being dropped.
- **Post-incident reconstruction:** Yes — audit log + logError event names enable reconstructing who viewed what performance data in a date range, and which aggregator sub-queries failed when.
- **Ownership and accountability:** Attribution model is locked in boundaries; changing it requires stakeholder sign-off. Documentation preserves intent.

**Remaining audit gaps:** None that would fail a SOC 2 / ISO review for this scope. Enterprise change management (signed PR, code review, deploy trail) is handled outside PAUL by the project's git/Railway flow.

## 6. Final Release Bar

**Must be true before ship:**
- All 8 unit test cases (Task 1b) pass
- Audit log entry verified to write on real endpoint call
- 400 responses verified for malformed/reversed/>366d ranges
- Pre-v2.9 exclusion spot-checked against a known record
- Accessibility — `aria-sort` headers sortable by keyboard; chart has aria-label and SR fallback table

**Remaining risk if shipped as-is after applying upgrades:**
- Free-text `assignedTo` normalization depends on rep names being spelled consistently at submission time. Mitigated by explicit `(unassigned/unknown)` surfacing — the risk is visible, not hidden. Long-term fix is FK to `CsRepRoster.id`, out of scope.
- No cache means each date-range change hits Prisma. Acceptable given small dataset; monitor p95 post-ship.

**Would I sign my name to this system?** Yes, with the applied upgrades. The plan is now enterprise-ready.

---

**Summary:** Applied 3 must-have + 6 strongly-recommended upgrades. Deferred 3 items with justification.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
