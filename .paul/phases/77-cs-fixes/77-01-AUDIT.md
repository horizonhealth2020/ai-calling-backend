# Enterprise Plan Audit Report

**Plan:** .paul/phases/77-cs-fixes/77-01-PLAN.md
**Audited:** 2026-04-16
**Verdict:** conditionally acceptable → enterprise-ready after upgrades applied

---

## 1. Executive Verdict

**Enterprise-ready after 3 must-have + 2 strongly-recommended upgrades applied.** Would approve for production with changes below in place.

The plan is well-scoped and the task sequencing (A → C → B) is sound. The three core problems are correctly diagnosed. The main risk cluster was in Task 2's schema definition and runtime filter resolution — both would have produced silent failures or migration-time crashes.

---

## 2. What Is Solid

| Element | Why It's Solid |
|---------|---------------|
| Problem diagnosis | All three root causes confirmed via code read (schema.prisma, chargebacks.ts, stale-summary) |
| `createSyncedRep` call + actor audit log | Third param IS the actor (admin) — correct for logAudit semantics; plan correctly separates FK update as follow-up step |
| Stale-summary in chargebacks.ts only | Endpoint aggregates both CB + PT but lives only in chargebacks.ts — plan correctly targets one file |
| Transaction wrap for dedupe insert | Prevents partial writes; correctly identified |
| Boundaries section | Explicit preservation of v2.9/v2.9.1 attribution model; no ServiceAgent model touch; clawback pipeline isolated |
| Option A (post-submit dedupe) | Lighter than Option B; correct for human-pace paste workflow |
| No DB unique index (app-logic only) | Correctly scoped per user decision; the trade-off is documented |

---

## 3. Enterprise Gaps Identified

| # | Severity | Gap |
|---|----------|-----|
| 1 | **Must-Have** | `User.csRepRosterId String?` has no `@unique` — Prisma requires `@unique` on FK side for 1:1 relation (`user User?`). `prisma migrate dev` would abort at schema validation. |
| 2 | **Must-Have** | Task 2 reads `req.user.csRepRosterId` from JWT. JWT is signed at login; new field is absent in existing sessions. Filter would silently fall back to broken name-match on every request until user re-logins. |
| 3 | **Must-Have** | AC-6 says "preview table renders after consolidation → shows warning indicator" implying pre-submit. Task 3 implements Option A (post-submit). These are inconsistent — AC would fail on apply if engineer tests pre-submit behavior. |
| 4 | **Strongly Recommended** | GET /api/cs-reps assumed present per research but never grep-verified in plan. Admin UI dropdown is blocked at apply-time if absent. |
| 5 | **Strongly Recommended** | TOCTOU window: concurrent POSTs both pass pre-check (transaction prevents partial commit but not concurrent reads). No DB index = race is real. Must document accepted risk. |
| 6 | **Can Safely Defer** | AC-1 phrasing implied resolved historical rows should show in active view. Active view's `resolvedAt: null` filter already hides them — this is intentional, not a bug. |

---

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Prisma 1:1 requires `@unique` on FK side | Task 2 SCHEMA | Added `@unique` to `csRepRosterId String?`; added named relation `@relation("CsRepRosterUser")` on inverse; documented why and when to switch to `users User[]` |
| 2 | JWT doesn't carry `csRepRosterId` — filter never activates | Task 2 STALE-SUMMARY FILTER | Rewrote filter to DB-lookup `prisma.user.findUnique({ select: { csRepRosterId, name } })` at request time instead of reading JWT field |
| 3 | AC-6 vs Option A timing mismatch | AC-6 | Rewrote AC-6 to match post-submit Option A: toast + post-submit row indicator; removed pre-submit "preview table renders after consolidation" language |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 4 | /api/cs-reps endpoint unverified | Task 2 action | Added PRECONDITION step: grep for endpoint, fallback plan if absent |
| 5 | TOCTOU race window undocumented | Task 3 BOUNDARY | Added explicit accepted-risk statement for concurrent-POST race; requires SUMMARY.md documentation |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 6 | AC-1 "BOTH rows" implied resolved+unresolved in active view | Rewritten to be accurate: active view hides resolved (correct). "BOTH" only applies when both are unresolved. No code change needed — the fix removes collapse, not the unresolved filter. |

---

## 5. Audit & Compliance Readiness

| Dimension | Assessment |
|-----------|-----------|
| Audit trail | `logAudit` called for PATCH link + createSyncedRep creation. ✓ |
| Silent failure prevention | JWT-read gap fixed (would have silently returned empty queue for all reps). ✓ after fix |
| Migration safety | Forward-only nullable FK + unique index. Zero backfill. `prisma migrate dev` clean after `@unique` fix. ✓ |
| Role gates | PATCH `/api/users/:id` gates on SUPER_ADMIN + OWNER_VIEW — matches existing user-admin surface. ✓ |
| Error shapes | `zodErr()` pattern for PATCH validation. Batch dedupe returns per-row `duplicate:true` (not silent discard). ✓ |
| Post-incident reconstruction | SUMMARY.md required; TOCTOU window documented in plan. ✓ |

---

## 6. Final Release Bar

**Before shipping:**
- Prisma `@unique` in place — migration validates without errors
- DB lookup in stale-summary filter — confirmed FK resolves to correct roster name in manual test (verify step 4: link 6 existing reps via UI, observe MyQueue populates)
- AC-6 post-submit toast renders with correct count and duplicate names visible

**Remaining risks if shipped as-is (pre-fixes):**
- Silent MyQueue empty for ALL reps (JWT never has new field) — regression would look identical to the current bug, making it undetectable without knowing the fix was applied
- Migration crash on `prisma migrate dev` blocks the entire apply

**Sign-off:** Would sign this plan for production with the 3 must-have fixes applied. Scope is tight, boundaries are clear, attribution model is protected.

---

**Summary:** Applied 3 must-have + 2 strongly-recommended upgrades. Deferred 1 item.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
