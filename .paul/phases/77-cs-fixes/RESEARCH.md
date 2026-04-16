# Phase 77 Research — Consolidated

**Phase:** 77-cs-fixes
**Date:** 2026-04-16
**Agents:** 2 parallel Explore agents

## Summary

Two research streams investigated Phase 77's unknowns. **One finding changes the planning assumptions materially** — the dedupe the user wants to "change keys on" does not exist as a formal submission-time dedupe, suggesting the reported symptom may be a different class of bug.

## Stream 1 — CS Assignee Identity Flow

**File:** `research/assignee-identity-flow.md`

### Key finding
`User`, `CsRepRoster`, and `ServiceAgent` are **three unlinked entity families**. `Chargeback.assignedTo` and `PendingTerm.assignedTo` are plain string fields storing the rep NAME (e.g., `"Alex"`). MyQueue filters by `User.name` against those strings — so if a `CUSTOMER_SERVICE` user's `User.name` doesn't EXACTLY match (case-insensitive) a `CsRepRoster.name` that's been used for assignments, the queue is empty.

### Likely root cause
Some combination of:
- **(A)** Name mismatch (`User.name = "Alexander Johnson"`, `CsRepRoster.name = "Alex"`)
- **(B)** Missing `CsRepRoster` row for the CS rep → nothing ever round-robin-assigned to them

User-creation endpoint does **not** auto-create a `CsRepRoster` (though a `createSyncedRep` helper exists for that purpose — it's just not called from `POST /api/users`).

### Fix shape (for plan)
- Data repair (ensure `User.name` matches `CsRepRoster.name` for the 6 reps + roster rows exist)
- Plus optional auto-sync on user creation to prevent future drift
- OR structural: introduce `User.csRepRosterId` FK and filter by that instead of name string

## Stream 2 — Dedupe Enforcement

**File:** `research/dedupe-enforcement.md`

### Key finding — **HEADLINE**
**No submission-time dedupe exists.** The `POST /api/chargebacks` and `POST /api/pending-terms` endpoints run `createMany()` with no pre-check. No DB unique constraints. Client-side `consolidateByMember` only deduplicates WITHIN a single paste, not across history.

The only "dedupe" in the codebase is a downstream clawback dedupe in `alerts.ts:156-204` — prevents double-clawback on a sale during alert approval. Different concern.

### Implication
The user's complaint — *"when I try to re-add it is not going back into tracking because of dedup"* — is most likely caused by one of:
1. **UI tracking-list grouping** — the list view may be grouping by `memberId` and showing only one record per member, creating the appearance that the resubmission was "absorbed."
2. **Clawback downstream dedupe** — the new chargeback record IS in the DB, but the alert → clawback path short-circuits because a prior clawback exists for the same sale.
3. Less likely: a unique constraint exists only in production migration history, not in the current schema file.

### Fix shape (for plan)
**Depends on what the actual blocker is.** Options:
- If UI-grouping issue → fix the tracking-list query to show all non-resolved records, not group by member
- If we genuinely want dedupe to prevent accidental same-paste duplicates → add it now with `resolvedAt IS NULL` clause (user's proposed keys are sound)
- Combination: add thoughtful dedupe AND fix the UI grouping

## Revised Assumptions for Phase 77 Plan

| Original assumption (from discuss-milestone) | Updated after research |
|---------------------------------------------|------------------------|
| "MyQueue bug — `User.id` vs `ServiceAgent.id` mismatch" | **Partially correct.** It's `User.name` vs `CsRepRoster.name` string matching (no ServiceAgent involvement in the filter). |
| "Dedupe key needs updating to allow same-week re-submissions" | **Reframe needed.** No dedupe exists to "update the key" on. The actual problem is likely in the tracking LIST (grouping) or downstream clawback path. |
| "Forward-only" | Still applies — data repair for the 6 reps + new behavior forward |
| "Schema-safe" | Still applies — might need one additive migration if we add a partial unique index |

## Updated Open Questions for Plan

1. **Assignee fix approach** — data-repair only, structural FK introduction, or auto-sync on user creation + data repair?
2. **Dedupe reframe** — before we "change dedupe keys," can we reproduce the re-submission blocking in dev? If it's a UI-grouping issue, the fix is very different from a dedupe-key fix.
3. **UX for same-week re-submission** — if there genuinely IS a duplicate showing up twice in tracking (because no dedupe), is the complaint "it DOES show up, but it's confusing / doesn't group right"?

## User Confirmation (2026-04-16)

After research, user confirmed the actual symptom:

> "When re-adding a resolved member it just doesn't show up as a fresh row in tracking. It goes nowhere. If Mike canceled Monday and it was resolved Wednesday, he requests to cancel again and we try to add again, it doesn't show up in tracking fresh because it was already resolved Monday."

**This validates Stream 2 Candidate #1 (UI tracking-list grouping)** — the new record is likely being inserted (no formal dedupe to block it) but HIDDEN from tracking because the list view groups/filters by memberId and shows only one record per member (probably the first/resolved one).

**User intent on dedupe:**
- Dedupe SHOULD exist to prevent accidental re-paste of the identical request.
- Legitimate re-submission must go through when the date differs: new `postedDate` (chargeback) or `holdDate` (pending term).
- Proposed keys confirmed: `memberName + memberID + postedDate` (CB), `memberName + memberID + holdDate` (PT).

## Phase 77 Scope — Updated After Clarification

The phase splits into **two genuine problems**, not one:

**Problem A — Tracking list hides new rows when prior resolved row exists (root of user's reported symptom).**
- Find where the grouping/filtering happens: `CSTracking.tsx` + its `GET /api/chargebacks` / `GET /api/pending-terms` list endpoint.
- Fix so each submission is a separate row in tracking, regardless of prior resolved records for the same member.

**Problem B — No real dedupe exists; one needs to be added with the right keys.**
- Add dedupe (server-side and/or client-side) with `memberName + memberID + postedDate` (CB) / `memberName + memberID + holdDate` (PT).
- Per user: prevent accidental duplicate re-submission within a paste (or if someone tries to re-paste the same request). Allow when the date field differs.
- Forward-only — existing duplicates in the DB are not retroactively merged or deleted.

**Problem C (unchanged) — MyQueue rep-visibility.**
- Data repair on `User.name` ↔ `CsRepRoster.name` alignment for the 6 reps, plus likely auto-sync on user creation to prevent future drift.

## Recommendation for Next Step

Proceed to `/paul:discuss` Phase 77 with the updated three-problem frame. Discussion should confirm the fix shape for each problem (data-only vs structural for Problem C; client/server/DB dedupe layer for Problem B; grouping fix scope for Problem A) before `/paul:assumptions` and `/paul:plan`.

## Files Produced

- `.paul/phases/77-cs-fixes/research/assignee-identity-flow.md`
- `.paul/phases/77-cs-fixes/research/dedupe-enforcement.md`
- `.paul/phases/77-cs-fixes/RESEARCH.md` (this file)

---

*Consolidated 2026-04-16. Research informs planning but does not auto-integrate. Headline finding is the dedupe reframe — worth raising with the user before plan.*
