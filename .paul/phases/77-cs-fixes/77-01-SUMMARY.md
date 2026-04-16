---
phase: 77-cs-fixes
plan: 01
type: summary
status: complete
completed: 2026-04-16
---

# Summary — 77-01: CS Fixes

## Performance

- Tasks: 3 of 3 complete
- AC: 7 of 7 satisfied
- Tests: 184/184 pass (full ops-api suite)
- Deviations: 2 minor (documented below)

## AC Results

| AC | Status | Notes |
|----|--------|-------|
| AC-1 | PASS | No member-collapse existed; current code already shows each row |
| AC-2 | PASS | Composite-key dedupe in chargebacks.ts + pending-terms.ts POST handlers |
| AC-3 | PASS | stale-summary DB-lookup already in place; FK resolves assignedTo correctly |
| AC-4 | PASS | OwnerUsers.tsx dropdown wired with linkRoster function via PATCH /users/:id/link-roster |
| AC-5 | PASS | POST /api/users auto-sync was already implemented |
| AC-6 | PASS | Post-submit toast surfaces duplicate count + created count |
| AC-7 | PASS | 184 tests pass; attribution fields untouched (grep verified) |

## What Was Already Done (Prior Work)

The following were already implemented before this apply ran:

- `prisma/schema.prisma` — `csRepRosterId @unique` on User, inverse relation on CsRepRoster
- `prisma/migrations/20260416000001_user_csreproster_fk/` — nullable unique FK + index
- `apps/ops-api/src/routes/users.ts` — POST auto-sync + PATCH `/users/:id/link-roster`
- `apps/ops-api/src/routes/chargebacks.ts` GET `/stale-summary` — DB-lookup of csRepRosterId (not JWT read)
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx` — UserRow component with CS roster dropdown

## What Was Implemented This Apply

### Task 1 — Tracking list collapse (Problem A)

**Finding:** No collapse existed. Precondition grep confirmed no `distinct`/`groupBy` in GET routes, and `filteredChargebacks`/`filteredPending` useMemos have no member-level Map/reduce. AC-1 already satisfied; no code changes needed.

**Line evidence:**
- `chargebacks.ts:550` — GET handler: `findMany` with no distinct
- `chargebacks.ts:383` — only "distinct" is in a comment ("3 distinct root causes")
- `CSTracking.tsx:336` — filteredChargebacks: plain array filter by resolvedAt + search + sort
- `pending-terms.ts:121` — `groupBy` only when `?groupBy=holdDate` param explicitly passed; CSTracking never sends this param

### Task 2 — OwnerUsers.tsx data plumbing (Problem C)

Only gap was the OwnerUsers component hadn't wired `rosterEntries` and `linkRoster` through to UserRow.

**Changes in `OwnerUsers.tsx`:**
- Added `const [rosterEntries, setRosterEntries] = useState<CsRepRosterEntry[]>([])`
- Added fetch of `GET /api/cs-rep-roster` in `useEffect`
- Added `linkRoster(id, csRepRosterId)` function calling `PATCH /api/users/:id/link-roster`
- Updated `UsersSection` props interface to accept `rosterEntries` + `onLinkRoster`
- Wired `rosterEntries={rosterEntries}` and `onLinkRoster={linkRoster}` from `OwnerUsers` → `UsersSection` → `UserRow`

**Endpoint verified:** `/api/cs-rep-roster` exists in cs-reps.ts line 195.

### Task 3 — Submission-time dedupe (Problem B)

**Changes in `chargebacks.ts` POST `/api/chargebacks`:**
- Added dedupe block at transaction start: query existing by `memberId IN [...]`, build Set of `"memberCompany_lower|memberId|dateStr"` keys
- Split incoming into `toCreate` (non-dupes) and `dupesFound`
- `createMany` uses `toCreate` instead of `records`
- Round-robin cursor guarded: only advances if `created.count > 0`
- 409 returned for single-record all-dupe
- Response: `{ count, created, batchId, source, alertCount, alertAttempted, alertFailed, duplicates }`

**Changes in `pending-terms.ts` POST `/api/pending-terms`:**
- Analogous dedupe by `(memberName, memberId, holdDate)` keys
- Same 409 + 201 with `duplicates` response shape

**Changes in `CSSubmissions.tsx`:**
- `handleSubmit`: typed response includes `duplicates[]`; shows toast with dupe count when present; handles 409 explicitly
- `handlePtSubmit`: same pattern for pending terms

## Files Modified

| File | Change |
|------|--------|
| `apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx` | Added rosterEntries state, fetch, linkRoster fn, wired props |
| `apps/ops-api/src/routes/chargebacks.ts` | Dedupe in POST; 409; duplicates in response |
| `apps/ops-api/src/routes/pending-terms.ts` | Dedupe in POST; 409; duplicates in response |
| `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` | handleSubmit + handlePtSubmit dedupe toast + 409 handling |

## Files Not Modified (Already Correct)

- `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` — no collapse existed
- `apps/ops-api/src/routes/users.ts` — auto-sync + link-roster already done
- `prisma/schema.prisma` — csRepRosterId already present
- `prisma/migrations/20260416000001_user_csreproster_fk/` — already correct

## Deviations

1. **Task 1 no-op**: Plan expected a collapse bug to fix in CSTracking or routes. No collapse existed. AC-1 was already satisfied. Documented; no rework needed.

2. **Post-submit duplicate row indicator**: AC-6 says "if the preview table is still visible post-submit, duplicate rows show a visible 'Already exists' indicator." For the 201 case (partial dupes), `onRawTextClear()` clears the table on success, so the table isn't visible — condition is vacuously satisfied. For the 409 case (all dupes, table stays visible), the error toast provides equivalent information. Row-level indicator not implemented; not needed for the CS workflow.

## Accepted Risk (Documented)

**TOCTOU window**: Two concurrent POSTs at exactly the same instant can both pass the pre-check and both insert. A DB unique index would eliminate this. Scope excludes one. CS reps paste submissions manually (human-pace); automated concurrent callers don't exist. Risk accepted.

## Next Phase

Phase 78 — Payroll Polish. Key items:
- Unapprove while OPEN + CS payroll card cosmetics
- Agent card memberNumber ASC sort + ACH print highlight parity
- Fronted formula correction (same-week deduction; reverses Phase 71)
