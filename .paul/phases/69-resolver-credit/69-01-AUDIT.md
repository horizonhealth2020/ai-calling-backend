# Enterprise Plan Audit Report

**Plan:** `.paul/phases/69-resolver-credit/69-01-PLAN.md`
**Audited:** 2026-04-14
**Verdict:** Conditionally acceptable → **enterprise-ready after applied upgrades**

---

## 1. Executive Verdict

The plan is a surgical, focused extension of Phase 68. Scope discipline is strong: read-side only, no schema changes, and AC-6 explicitly mandates byte-identical Phase 68 metrics as a regression guard. Attribution model extension is deliberate and stakeholder-signed, with clear documentation in both boundaries and accumulated decisions.

However, several gaps existed around edge cases that aren't obvious at plan-time but would bite in production: pre-v2.9 cutoff behavior for the new metric was undefined, `(unresolved)` bypass handling treated a data-integrity signal as just a formatting case, the assist-only row (rep with zero assigned but nonzero assistSaves) risked NaN in `saveRate`, and row isolation for cross-rep CANCELLED/NO_CONTACT wasn't verified.

After applying 3 must-have and 2 strongly-recommended upgrades, the plan is **enterprise-ready**. I would sign off on executing it as-is.

## 2. What Is Solid

- **AC-6 byte-identical guarantee** — explicit regression guard against Phase 68 metrics. Strong.
- **Attribution boundary table** — fully enumerates which metrics are assignee-credit vs. resolver-credit; prevents future maintainers from guessing.
- **Conservation law test** in Task 1b — mathematical provability that no double-counting exists.
- **Non-roster resolver surfacing** — admin overrides go to `(owner/admin override)` row, not silently dropped. Auditable.
- **Read-side scope discipline** — no schema changes, no migrations, no new endpoints, no retroactive mutations.
- **Correlation chart locked as unchanged** — effort-based metric anchored on assignee; resolver-credit is purely outcome-layer.
- **Stakeholder sign-off for attribution extension** — documented in STATE.md decisions + CONTEXT.md rationale, linked to original Phase 68 boundary.
- **No "Total Saves" column** — user-requested simplicity preserved; readers can mentally sum.

## 3. Enterprise Gaps Identified

1. **Pre-v2.9 cutoff behavior for `assistSaves` was undefined.** Phase 68 established a cutoff rule: outcome metrics (saved/cancelled) include pre-v2.9, effort metrics (worked/correlation) exclude. `assistSaves` is clearly an outcome metric, but the plan didn't state whether it follows the outcome side of the rule. Ambiguity in a boundary case = future regression risk.

2. **`(unresolved)` bypass case treated as formatting, not a signal.** Per Phase 66 workflow, `bypassReason` is written during the resolve action — so `resolvedBy` should always be populated when `bypassReason` is. If `(unresolved)` ever appears with nonzero count, that indicates a real data-integrity issue (probably a direct DB write bypassing the application layer). Plan handled it gracefully but didn't flag it as a surfaced diagnostic.

3. **Assist-only row NaN risk.** A rep with 0 assigned + 1 assistSaves triggers `saved / (saved + cancelled)` = `0 / 0` for save rate. The existing `safeDivide` helper returns 0 here, but the plan didn't enumerate this as a test case. If the helper were ever refactored or the computation path changed, this edge case would silently regress into `NaN` — which breaks JSON serialization and the frontend's numeric display.

4. **Row isolation not verified.** AC-3 tested that cross-rep CANCELLED/NO_CONTACT doesn't create a NEW row for the resolver. But what if the resolver *already* has a row (from their own assigned work)? The plan didn't verify that a cross-rep CANCELLED resolve doesn't mutate the resolver's existing `cancelled` count — which would double-count cancellations across assignee + resolver.

5. **Sort tiebreaker change undocumented.** Phase 68's default sort was `saveRate desc, assigned desc`. Phase 69 inserts `(saved + assistSaves) desc` as a new middle tiebreaker. Subtle behavior change — reps with identical save rates may now sort differently than they did yesterday. Owners might notice and question it.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Pre-v2.9 cutoff behavior for assistSaves undefined | Added AC-8; Task 1b test case 11 | Explicitly locks assistSaves to OUTCOME semantics (pre-v2.9 counts) with rationale linked to Phase 68 cutoff rule |
| 2 | `(unresolved)` bypass is data-integrity signal, not just formatting | Added AC-11; Task 1b test case 14 | Documents as diagnostic surfacing; note that non-zero count indicates DB-level mutation outside normal resolve flow |
| 3 | Assist-only row NaN risk not tested | Added AC-9; Task 1b test case 12 | Hard check that `JSON.stringify(row)` succeeds; all numeric fields explicitly 0, not NaN |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 4 | Row isolation for cross-rep non-SAVED resolves | Added AC-10; Task 1b test case 13 | Test that Jasmine's existing cancelled count is NOT incremented by a CANCELLED resolve of Alex's record |
| 5 | Sort tiebreaker change undocumented | Task 1 Part D | Annotated as INTENTIONAL behavior change with rationale; noted to appear in SUMMARY.md decisions |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Audit log metadata for Phase 69 endpoint changes | Endpoint name + query shape unchanged; payload additive. Forensic value of updating the audit log entry's metadata is low. |
| 2 | Document two-pass iteration perf cost | 18 reps × ~50 records = ~900 iterations. Trivial. If aggregation ever slows, cache layer from Phase 68 deferred list is the right fix. |
| 3 | Over-engineered tooltip helper | Cosmetic style preference. Plan's `getColTooltip` helper is fine; inline ternary would be equivalent. Not worth flagging. |

## 5. Audit & Compliance Readiness

**After applied upgrades:**

- **Defensible audit evidence:** Yes — 14 unit tests covering attribution, cutoff, NaN safety, row isolation, bypass edge cases. Conservation-law test provides mathematical evidence of no double-counting.
- **Silent failure prevention:** Yes — `(unresolved)` bypass bucket surfaces the edge instead of hiding it; assist-only row NaN prevented; Phase 68 regression caught by AC-6 byte-identical guarantee.
- **Post-incident reconstruction:** Yes — attribution model table in boundaries enumerates every metric's credit rule. Any future "who should be credited" question has a lookup.
- **Ownership and accountability:** Yes — stakeholder sign-off for attribution extension documented in STATE.md decisions with Phase 68 boundary cross-reference.

**Remaining audit gaps:** None that would fail a SOC 2 review for this scope.

## 6. Final Release Bar

**Must be true before ship:**
- All 25 aggregator tests pass (11 Phase 68 + 14 new)
- Phase 68 metrics byte-identical in manual spot-check
- `JSON.stringify` of every leaderboard row returns valid JSON (no NaN)
- Bypass `perRep` names match resolver identities
- Correlation chart pixel-identical (visual diff acceptable)
- Frontend CSV header includes "Assist Saves" in the correct position

**Remaining risk if shipped as-is after applying upgrades:**
- If resolver User.name spelling drifts from CsRepRoster.name over time (same risk as assignedTo), cross-rep SAVED would silently fail to credit as assist. Mitigated by same normalization + `(owner/admin override)` surfacing. Long-term fix: FK to `CsRepRoster.id` in User table — out of scope.
- Two-pass iteration doubles the aggregation constant factor. Negligible at 18-rep scale. Monitor post-ship.

**Would I sign my name to this system?** Yes, with the applied upgrades. Plan is enterprise-ready.

---

**Summary:** Applied 3 must-have + 2 strongly-recommended upgrades. Deferred 3 items with justification.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
