# Research: Chargeback / Pending-Term Dedupe Enforcement

**Phase:** 77-cs-fixes
**Agent:** Explore (codebase)
**Date:** 2026-04-16

## Question

Where is dedupe enforced for chargeback and pending-term submissions, what keys does it match on, and how should we change it to allow legitimate same-week re-submissions after resolution?

## Headline Finding

**There is NO formal dedupe on submission.** Every paste-to-parse insert goes through `createMany()` with no pre-check for existing records. No DB unique constraint. No server-side validation. No client-side filter against existing records.

The only thing called "dedupe" in the codebase is a **clawback dedupe guard** (`apps/ops-api/src/services/alerts.ts:156-204`) that prevents double-clawback on a sale during chargeback-alert approval — a downstream, different concern.

## Investigated Layers

### Client-side (`CSSubmissions.tsx`)

- **Consolidation, not dedupe:** `consolidateByMember` (lines 241-268) and `consolidatePendingByMember` (lines 363-380) group rows from a SINGLE paste by memberId. They do NOT query existing records.
- No filter against previously-submitted records in the DB.
- Preview table shows all rows; nothing is silently skipped for being a "duplicate of history."

### Server-side (routes)

- `apps/ops-api/src/routes/chargebacks.ts:128-158` — `POST /api/chargebacks` runs `tx.chargebackSubmission.createMany({ data: records.map(...) })` with no `findMany()` lookup beforehand.
- `apps/ops-api/src/routes/pending-terms.ts:39-88` — same `createMany()` pattern.
- Global error handler maps Prisma `P2002` (unique violation) to 409, but there are no unique constraints to trigger it.

### Database schema (`prisma/schema.prisma`)

- `ChargebackSubmission` (lines 588-626): no `@@unique(...)` constraints on any combination of `memberId`, `memberCompany`, `postedDate`, or similar.
- `PendingTerm` (lines 663-704): same — no `@@unique`.
- `resolvedAt` + `resolutionType` fields exist but are only used for querying/filtering open vs resolved records, never for deciding whether to accept a new submission.

### The only real dedupe: clawback alert approval

`apps/ops-api/src/services/alerts.ts:156-204` — when a chargeback ALERT is approved (which triggers clawback creation), it checks for existing clawbacks with matching `saleId` + (`matchedBy: "chargeback_alert"` OR `matchedBy: "member_id"` with recent `createdAt`). This prevents double-clawback on the same sale. Different flow, different concern.

## Implication for User's Complaint

User reported: *"When I try to re add it is not going back into the tracking because of dedup."*

Based on the evidence above, the re-submission is likely NOT being blocked at submit time. Candidates for what's actually happening:

1. **The insert succeeds silently** — the record IS in the DB, but a UI filter in `CSTracking.tsx` (or the list endpoint) may hide it because it groups by `memberId` and shows only the most recent / only the unresolved one per member.
2. **The clawback dedupe catches the downstream effect** — alert approval short-circuits because a clawback already exists on the same `saleId` with the same `memberId`. So the record is in the DB but doesn't produce visible payroll impact (new clawback/row).
3. **A migration not visible in the current schema** — a past migration may have added a unique constraint that was later removed, or an index exists only in production. Less likely but possible.

## What Needs Further Investigation (before plan)

This research DID NOT locate a code path that literally blocks re-submission. The plan phase (or a targeted follow-up) should:

1. Reproduce the blocking behavior in dev — paste the same member twice and observe what happens.
2. Inspect the tracking-list query (`GET /api/chargebacks` and `CSTracking.tsx`) — is it filtering/grouping by memberId in a way that hides "duplicates"?
3. Verify no rogue unique constraint exists in the live DB (run a `\d+ chargeback_submissions` equivalent against production).

## Schema Fields Available for a New Dedupe Key (if introduced)

If the plan phase decides to introduce dedupe (server-side or DB-level) with the user's proposed keys:

**ChargebackSubmission:** `memberId` + `memberCompany` + `postedDate`
- All three exist (lines 599, 600, ~598 for postedDate)
- `postedDate DateTime?` — nullable; need to decide how to dedupe when null (today's DB is mixed)

**PendingTerm:** `memberId` + `memberName` + `holdDate`
- `memberId: String?` (line 667)
- `memberName: String?` (line 668)
- `holdDate: Date?` (line ~684; Prisma `Date`, not `DateTime`)

**Important gotcha:** `memberId` and date fields are nullable. A composite unique index with nullable fields in Postgres treats NULL as distinct from NULL, so it wouldn't block legitimate cases with missing data — which is probably desirable.

## Approach Options for Plan

1. **No new dedupe — fix the UI/tracking-list grouping.** If re-submissions are actually being blocked in the UI grouping (most likely per Candidate #1 above), the fix is to surface ALL records per member, or group only unresolved ones. No schema change.
2. **Add client-side dedupe against existing-records API.** New endpoint `GET /api/chargebacks/exists?memberId=X&postedDate=Y` returns whether an UNRESOLVED record matches. Parser surfaces conflicts in the preview table. Forward-only.
3. **Add server-side soft dedupe with `resolvedAt IS NULL` filter.** On insert, reject if a matching record exists AND `resolvedAt IS NULL`. Allows re-submission when prior is resolved.
4. **Add DB `@@unique` on `(memberId, postedDate, resolvedAt)` (partial index).** Postgres partial unique index: `CREATE UNIQUE INDEX ... WHERE resolved_at IS NULL`. Database-enforced, cheap. Migration required.

## Key Files for Plan Phase

| File | Role |
|------|------|
| `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx:241-380` | Client parser + consolidation (no dedupe) |
| `apps/ops-api/src/routes/chargebacks.ts:128-158` | POST /chargebacks — `createMany()` |
| `apps/ops-api/src/routes/pending-terms.ts:39-88` | POST /pending-terms — `createMany()` |
| `apps/ops-api/src/routes/chargebacks.ts` (list endpoint — line TBD) | **Investigate grouping in tracking list** |
| `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` | **Investigate how tracking list hydrates + filters** |
| `apps/ops-api/src/services/alerts.ts:156-204` | Post-submission clawback dedupe (different concern) |
| `prisma/schema.prisma:588-626, 663-704` | Models where a `@@unique` would live |

## Open Questions for Plan

1. Is the blocking actually in the UI tracking list (hides existing memberId from re-submission view), not in the dedupe at all?
2. Does the user want the fix to PREVENT same-week duplicate submissions (e.g., accidental re-paste of the same batch), or to ALLOW legitimate re-submissions (which is the reported complaint)? These are opposite goals.
3. If we add real dedupe with `resolvedAt IS NULL` filter: should the block happen on the client (warning in preview), the server (409 response), the DB (partial unique index), or layered?

---

*Research complete — 2026-04-16 — critical finding: no dedupe exists as the user's mental model suggests; the complaint may be a UI-grouping issue rather than a dedupe issue*
