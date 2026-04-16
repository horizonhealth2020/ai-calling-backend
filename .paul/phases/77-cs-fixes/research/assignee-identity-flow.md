# Research: CS Assignee Identity Flow

**Phase:** 77-cs-fixes
**Agent:** Explore (codebase)
**Date:** 2026-04-16

## Question

Why does CSMyQueue + 48-hour stale alerts show empty for the 6 reported reps (Alex, Jasmine, Ibrahim, Willomar, Amer, Ally) despite them having active `CUSTOMER_SERVICE` logins and having records assigned to them?

## Key Findings

### Entities are UNLINKED

Three separate entity families, **no FK between them**:

| Entity | Purpose | Location |
|--------|---------|----------|
| `User` | Login identity (has email, password hash, roles) | `prisma/schema.prisma:62-88` |
| `CsRepRoster` | CS rep roster for round-robin assignment | `prisma/schema.prisma:650-661` |
| `ServiceAgent` | CS payroll entity | `prisma/schema.prisma:454-466` |

- `User` has NO FK to `CsRepRoster` or `ServiceAgent`
- `CsRepRoster.serviceAgentId → ServiceAgent` is the only FK
- `ContactAttempt.agentId → User` (reps log attempts as their User identity — not their ServiceAgent)

### Assignment stores a NAME STRING, not an ID

- `ChargebackSubmission.assignedTo: String?` (no FK) — `prisma/schema.prisma:607`
- `PendingTerm.assignedTo: String?` (no FK) — `prisma/schema.prisma:685`
- Round-robin assignment pulls `CsRepRoster.name` and writes it verbatim: `apps/ops-api/src/services/repSync.ts:125-160`

### Filter is a CASE-INSENSITIVE STRING MATCH

Session flow:
1. `apps/ops-dashboard/app/(dashboard)/cs/page.tsx:23-30` — fetches `/api/session/me`, grabs `User.name`
2. `apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx:58-69` — calls `/api/stale-summary?assignedTo=${userName}`
3. `apps/ops-api/src/routes/chargebacks.ts:626-715` — filters `Chargeback.assignedTo.toLowerCase().trim() === assignedToFilter`

The match only works if `User.name` EXACTLY equals `CsRepRoster.name` (case-insensitive, trimmed).

### No auto-linkage on user creation

`apps/ops-api/src/routes/users.ts:18-37` — creating a `CUSTOMER_SERVICE` user does NOT auto-create a `CsRepRoster` or `ServiceAgent` row. The `createSyncedRep` helper (`apps/ops-api/src/services/repSync.ts:9-26`) exists but is NOT called from the user-creation endpoint.

The seed (`prisma/seed.ts`) only creates SUPER_ADMIN / MANAGER / OWNER_VIEW / PAYROLL users — no CUSTOMER_SERVICE template.

## Root Cause Hypotheses

| # | Hypothesis | Likelihood | Fix shape |
|---|-----------|-----------|-----------|
| **A** | `User.name` ≠ `CsRepRoster.name` — e.g., user is "Alexander Johnson", roster is "Alex" | **HIGH** | Align name strings OR introduce FK |
| **B** | The 6 reps have `User` rows but NO `CsRepRoster` rows — so round-robin never assigned anything to "Alex" | **HIGH** | Create `CsRepRoster` for each CS rep (ideally auto-create when `CUSTOMER_SERVICE` role added) |
| **C** | Extra whitespace/punctuation in one side | **LOW** (code does `.toLowerCase().trim()`) | — |

Most likely: a COMBINATION of A + B. Some reps have no roster entry; some have roster entries with mismatched names.

## Fix Approaches (for plan phase to evaluate)

1. **Data-only fix** — write a one-time SQL/script: ensure each CUSTOMER_SERVICE `User` has a matching `CsRepRoster` entry with identical `name`. Forward-only matches user's v3.1 constraint.
2. **Structural fix** — add `User.csRepRosterId` FK, migrate existing name-string filter to FK-based lookup. More invasive but eliminates name-drift class of bug.
3. **Auto-sync fix** — modify `POST /api/users` to auto-create a `CsRepRoster` + `ServiceAgent` when a `CUSTOMER_SERVICE` role is present on creation. Prevents future drift but doesn't fix existing.
4. **Hybrid** — (1) immediate data fix + (3) auto-sync on creation to prevent regression.

## Key Files for Plan Phase

| File | Role |
|------|------|
| `apps/ops-api/src/routes/chargebacks.ts:626-715` | `GET /api/stale-summary` — filter logic |
| `apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx:58-69` | Client passes `User.name` as filter |
| `apps/ops-dashboard/app/(dashboard)/cs/page.tsx:23-30` | Session fetch populates `userName` |
| `apps/ops-api/src/services/repSync.ts:9-26` | `createSyncedRep` exists but unused from user creation |
| `apps/ops-api/src/routes/users.ts:18-37` | User creation — does NOT call createSyncedRep |
| `apps/ops-api/src/routes/cs-reps.ts:125-160` | Round-robin uses `CsRepRoster.name` |
| `prisma/schema.prisma:62-88, 454-466, 588-626, 650-661, 663-704` | All 4 relevant models |
| `prisma/seed.ts:8-21` | Seed — no CUSTOMER_SERVICE users |

## Open Questions for Plan

1. Is there a desire to introduce a FK (`User.csRepRosterId`), or is the name-string approach acceptable with better hygiene?
2. Should the auto-sync run at user-creation time (best UX), at login time (backfill safety net), or both?
3. For the existing 6 reps — does the user have the raw roster data to reconcile names, or should we surface a diagnostic endpoint/script that reports name mismatches?

---

*Research complete — 2026-04-16*
