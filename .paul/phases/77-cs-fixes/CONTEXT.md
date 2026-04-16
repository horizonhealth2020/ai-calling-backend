# Phase 77: CS Fixes — Context

**Generated:** 2026-04-16 · **Updated:** 2026-04-16 (post-assumptions)
**Phase:** 77-cs-fixes · **Milestone:** v3.1 CS + Payroll Gap Closure
**Status:** Ready for /paul:plan

## Problems (3 independent)

| # | Problem | Root cause / finding |
|---|---------|---------------------|
| A | New submission "goes nowhere" in tracking when a prior resolved record exists for the same member (user example: Mike cancels Mon, resolved Wed, cancels again Thu → Thu row invisible) | Tracking-list query or client filter collapses by `memberId`, surfacing one record per member. Needs code confirmation in plan Task 1 open |
| B | No submission-time dedupe exists — `POST /api/chargebacks` and `POST /api/pending-terms` run `createMany()` with no pre-check; client `consolidateByMember` only dedupes within a single paste | App-logic only; research-confirmed |
| C | 6 CS reps (Alex, Jasmine, Ibrahim, Willomar, Amer, Ally) with active CUSTOMER_SERVICE logins have empty MyQueue — `User`, `CsRepRoster`, `ServiceAgent` are unlinked entity families; `assignedTo` is a plain name string, filter relies on `User.name` === `assignedTo` match | Research-confirmed |

## Approach (user-confirmed)

### Problem A — Tracking list fix
- Plan Task 1 opens with a targeted trace of `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` + its list endpoints in `apps/ops-api/src/routes/chargebacks.ts` and `pending-terms.ts` to locate where same-member records are collapsed.
- Remove the collapse; return + render one row per submission.
- Attribution-model preservation (v2.9/v2.9.1) — display fix only, no attribution change.

### Problem B — Server-side soft dedupe + client preview warnings
- Server: pre-query existing records matching `(memberName, memberID, postedDate)` / `(memberName, memberID, holdDate)` before `createMany()`.
- **Batch UX (user choice 1a):** accept the non-duplicates, flag duplicates per-record in the 201 response. Single POST returns 409.
- Client: `CSSubmissions.tsx` preview marks duplicates with visible warning and excludes them from the submit payload.
- Match against ALL historical records (no resolved/unresolved filter) — date key naturally separates legitimate re-submissions.
- `memberName` match case-insensitive; `postedDate`/`holdDate` normalized to UTC midnight for comparison (Luxon, matches project convention).
- NO DB unique index. App-logic only.

### Problem C — `User.csRepRosterId` FK + admin UI dropdown (user choice 1)
- **Schema migration:** add `User.csRepRosterId: String?` FK → `CsRepRoster.id`. One Prisma migration.
- **Admin UI:** owner dashboard Users page gets a dropdown on each CUSTOMER_SERVICE row listing `CsRepRoster` entries. PATCH endpoint persists the link.
- **MyQueue filter:** `/api/stale-summary` resolves `User.csRepRosterId → CsRepRoster.name`, then matches `Chargeback.assignedTo` / `PendingTerm.assignedTo` against that resolved name. Historical `assignedTo` strings untouched — the FK is the source of truth for identity; name string becomes display-only.
- **Auto-sync on user creation:** when CUSTOMER_SERVICE role is included at `POST /api/users`, call `createSyncedRep` (helper exists at `apps/ops-api/src/services/repSync.ts:9-26`) and set `User.csRepRosterId` to the new roster's id.
- **One-time repair for 6 existing reps:** owner manually links each via the new dropdown — no script needed.
- Auto-sync on role ADD via PATCH (not initial POST) → deferred (out of scope).

## Constraints

- Forward-only (no retro changes to historical data)
- Attribution-model preservation (v2.9/v2.9.1 untouched)
- Minimum-diff discipline (git-diff parity on mutation-logic paths)
- NO DB unique index for dedupe (Problem B app-logic only)
- ONE nullable FK + ONE migration accepted for Problem C (justified by user-chosen FK-based identity link)
- Inline CSSProperties only — no Tailwind / per-app CSS
- Role gates preserved — CUSTOMER_SERVICE + SUPER_ADMIN + OWNER_VIEW access unchanged

## Plan Shape Preview

Single plan `77-01` with three independent tasks (any order, recommend A → C → B):

| Task | Problem | Shape |
|------|---------|-------|
| 1 | A | Trace + fix tracking-list grouping in 1 client file + 2 route files |
| 2 | C | Prisma migration + schema.prisma edit + OwnerUsers.tsx dropdown + PATCH endpoint + /api/stale-summary filter update + auto-sync wire in users.ts |
| 3 | B | Pre-check in 2 route files + CSSubmissions.tsx preview warnings |

## Key Files

| File | Touched By |
|------|-----------|
| `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` | A |
| `apps/ops-api/src/routes/chargebacks.ts` | A, B, C (stale-summary filter) |
| `apps/ops-api/src/routes/pending-terms.ts` | A, B |
| `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` | B |
| `apps/ops-api/src/routes/users.ts` | C (auto-sync + PATCH link endpoint) |
| `apps/ops-api/src/services/repSync.ts` | C (call from users route) |
| `apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx` | C (dropdown + save) |
| `prisma/schema.prisma` | C (`User.csRepRosterId` FK) |
| `prisma/migrations/*` | C (new migration) |

---

*Ready for /paul:plan. Persists across /clear.*
