---
phase: 80-myqueue-rep-linkage
topic: MyQueue rep-visibility regression — Phase 77 claimed shipped but existing CS users unlinked
depth: standard
confidence: HIGH
created: 2026-04-16
---

# Discovery: MyQueue Rep Linkage Reconciliation

**Recommendation:** One plan with three sequential parts — (1) data reconciliation script + admin diagnostic, (2) name-drift fallback hardening, (3) admin UI visibility of link status. No schema changes.

**Confidence:** HIGH — server logic verified correct; failure is operational (unlinked rows + name drift), not code logic.

## Objective

Close the gap between Phase 77 claim ("MyQueue + stale alerts resolve by DB lookup, not name-string") and production reality ("the earlier fix didn't happen" per user). Determine why CS users still can't see their queues despite the FK, auto-sync, and DB-lookup code being present.

## Scope

**Include:**
- `apps/ops-api/src/routes/chargebacks.ts:660-678` (`GET /stale-summary` handler)
- `apps/ops-api/src/routes/users.ts:15-80` (auto-sync + link-roster)
- `apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx:65` (client fetch)
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx` (admin dropdown)
- `apps/ops-api/src/services/repSync.ts` (createSyncedRep helper)
- One-time data audit: unlinked CS users + name-drift detection

**Exclude:**
- Schema changes (FK already exists at `User.csRepRosterId`)
- Retroactive reassignment of historical chargebacks (forward-only; match via linked-rep name)

## Findings

### Finding 1 — Server DB-lookup is correct, but only fires when csRepRosterId is non-null

**Location:** `apps/ops-api/src/routes/chargebacks.ts:660-678`

```ts
if (req.user?.id) {
  const dbUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { csRepRosterId: true, name: true } });
  if (dbUser?.csRepRosterId) {
    const roster = await prisma.csRepRoster.findUnique({ where: { id: dbUser.csRepRosterId }, select: { name: true } });
    assignedToFilter = roster?.name?.toLowerCase().trim() ?? null;
  } else if (dbUser?.name) {
    // Fallback: use name match for pre-linked users
    assignedToFilter = dbUser.name.toLowerCase().trim();
  }
}
```

**Logic is sound.** When `csRepRosterId` IS set, resolves roster.name → filter. When NULL, falls back to User.name. Query-param `?assignedTo=` only overrides for OWNER_VIEW/SUPER_ADMIN (line 676-678).

**Problem:** in production, the 3 active CS users (Jasmin, Ally, Alex) likely have `csRepRosterId = NULL`. The FK exists but isn't populated.

### Finding 2 — Auto-sync only fires at user creation, not on existing users

**Location:** `apps/ops-api/src/routes/users.ts:33-36`

```ts
const { csRep } = await createSyncedRep(user.name, 0, req.user!.id);
user = await prisma.user.update({ where: { id: user.id }, data: { csRepRosterId: csRep.id }, select: USER_SELECT });
```

Auto-sync on `POST /api/users`. Pre-existing CS users (created before v3.1 deploy) remain with `csRepRosterId = NULL` forever unless:
- Admin opens Users page and picks from roster dropdown (Phase 77 UI at `OwnerUsers.tsx:325-333`)
- OR a backfill script runs one-time

Phase 77 PLAN (`.paul/phases/77-cs-fixes/CONTEXT.md:35`) explicitly stated:
> **One-time repair for 6 existing reps:** owner manually links each via the new dropdown — no script needed.

This was a conscious decision in Phase 77. User did not execute the manual link step, so the fix is dormant.

### Finding 3 — Name-fallback is fragile on name drift

**Evidence:** STATE.md resume context lists rep roster as *"Alex, Jasmine, Ibrahim, Willomar, Amer, Ally"*. User's current active CUSTOMER_SERVICE users are *"Jasmin, Ally, Alex"* (per the Users page they pasted today).

Mismatch:
- User: `Jasmin` → fallback filter: `"jasmin"`
- Chargeback.assignedTo: `"Jasmine"` (lowercase) → does not match `"jasmin"`

One letter of drift breaks the fallback silently. Even if `csRepRosterId` were set correctly but pointing to a roster entry with a differently-spelled name, the roster-derived filter would still fail to match historical `assignedTo` strings.

Also, Ibrahim / Willomar / Amer no longer appear as active Users but still exist as roster entries — orphan state.

### Finding 4 — Client passes `?assignedTo=<userName>` but it's ignored for CS role

**Location:** `apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx:65`

```ts
const res = await authFetch(`${API}/api/stale-summary?assignedTo=${encodeURIComponent(userName)}`);
```

Cosmetic issue only — server ignores this query param for CUSTOMER_SERVICE role. But it's misleading: it looks like the client is driving filtering, and it's dead code for the primary use case. Worth dropping or guarding.

### Finding 5 — Admin UI doesn't surface link status at a glance

**Location:** `apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx`

Dropdown exists and saves correctly. But in the default Users table view, there's no visual indicator ("⚠ not linked to roster") that would prompt the admin to act. A CS user can appear Active with role CUSTOMER_SERVICE and be completely invisible to the rep-visibility system.

## Recommendation

**Phase 80, single plan, 3 tasks in dependency order:**

| Task | Work | Files | Risk |
|------|------|-------|------|
| 1 | **Data reconciliation script** — list all `CUSTOMER_SERVICE` Users with `csRepRosterId IS NULL`, report name-match candidates in CsRepRoster (case-insensitive, Levenshtein-1 for drift like Jasmin↔Jasmine). Auto-link exact matches; surface fuzzy matches for admin approval. | `apps/ops-api/scripts/reconcile-cs-rep-links.ts` (new) + admin diagnostic endpoint | Low (script is read-only by default, mutation only with --apply flag) |
| 2 | **Admin UI: flag unlinked CS users** — red pill "⚠ unlinked" next to name in Users table; dropdown value "(none — not linked)" already exists but isn't visually distinct. | `apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx` | Trivial |
| 3 | **Name-drift tolerance** — server fallback uses fuzzy match (Levenshtein ≤ 1) OR removes the fallback entirely and returns empty queue with a clear error log if csRepRosterId is null (force explicit link). Recommend the latter — fail loud. | `apps/ops-api/src/routes/chargebacks.ts:670-673` | Low (behavior change; may surface other unlinked users) |

**Rationale:**
- Task 1 is the one-time unblock — auto-link exact-match users (Alex, Ally, Jasmin↔Jasmine with fuzzy approval). Addresses Fail Mode A immediately.
- Task 2 prevents this silent drift from recurring — admin will SEE unlinked users next time a new hire gets added.
- Task 3 is defense-in-depth. Your original decision ("DB lookup not JWT") was about session freshness. Now we add "fail loud when link missing, don't silently return empty."

**Caveats:**
- Fuzzy matching must have a confidence threshold — do NOT auto-link if two roster entries both match within Levenshtein 2. Require admin approval.
- Once users are linked, existing chargebacks still have string `assignedTo`. Going forward, the round-robin assignment (`repSync.ts`) should write the CsRepRoster.name (not User.name), so there's a single source of truth.

## Open Questions

- Do you want script-driven auto-link for exact matches, or admin-approved for all? — Impact: **LOW** (either is fine; exact-match auto is safe)
- Should the server FAIL LOUD when csRepRosterId is null (return 409 + error log) vs silent empty queue? — Impact: **MEDIUM** (louder failure catches future drift but requires client error handling)
- Are the 3 "orphan" roster entries (Ibrahim, Willomar, Amer) deactivated intentionally? Script should optionally mark unmatched roster entries as Inactive. — Impact: **LOW** (clean-up only)

## Quality Report

**Sources consulted (2026-04-16):**
- `apps/ops-api/src/routes/chargebacks.ts:660-768` — full /stale-summary handler
- `apps/ops-api/src/routes/users.ts:12-80` — POST /users auto-sync + PATCH /link-roster
- `apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx:58-95` — client fetch + render
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerUsers.tsx:175-376,820-834` — roster dropdown UI + linkRoster API call
- `.paul/phases/77-cs-fixes/CONTEXT.md:29-72` — Phase 77 scope decisions including "manual link, no backfill script"
- `.paul/phases/77-cs-fixes/77-01-PLAN.md:78-106` — AC-1/4/5 for rep-visibility, admin dropdown, auto-sync
- `.paul/STATE.md:133` — resume context listing roster names
- User-provided Users table (2026-04-16): Jasmin, Ally, Alex (CUSTOMER_SERVICE, Active)

**Verification:**
- Server DB-lookup fires correctly: Verified via chargebacks.ts:666-673 — `prisma.user.findUnique` at request time, not from JWT
- Query-param override scoped to admin roles: Verified via chargebacks.ts:676-678 — role check gates the override
- Auto-sync only at POST /users: Verified via users.ts:33-36 — no backfill path exists
- OwnerUsers dropdown wiring: Verified via OwnerUsers.tsx:325-333 (dropdown) + 825-834 (linkRoster handler)

**Assumptions (not verified via DB query):**
- Current 3 CS users have `csRepRosterId = NULL` — HIGH confidence from Phase 77 context ("owner manually links"); DB query would confirm trivially
- Name "Jasmin" in Users table vs "Jasmine" in roster — HIGH confidence from STATE.md resume context; re-read of CsRepRoster table would confirm

**Pre-plan verification — COMPLETED 2026-04-16:**

Query run against prod:
```
id                             name   email               cs_rep_roster_id  roster_name
cmmw9sh3h0000346y1zy0riav      Alex   Alex@horizon.com    NULL              NULL
cmn4s22ai0002z5xjca5v4bsu      Ally   Ally@horizon.com    NULL              NULL
cmn4s2idj0004z5xj33pdvvvb      Jasmin Jasmin@horizon.com  NULL              NULL
```

**Fail Mode A confirmed: 100% of active CS users have `csRepRosterId = NULL`.** Phase 77 manual-link step was never executed. Root cause confirmed; no name-drift investigation needed until FKs are populated.

**Follow-up query needed at plan-time (not blocking discovery):**
```sql
SELECT id, name, active FROM cs_rep_roster ORDER BY name;
```
This enumerates the reconciliation targets. Expected names per STATE.md resume context: Alex, Jasmine, Ibrahim, Willomar, Amer, Ally. User-side spelling is "Jasmin" (vs roster "Jasmine"?) — the one predictable drift to handle. Ibrahim/Willomar/Amer likely orphan roster entries (former employees).

## User-confirmed decisions (2026-04-16)

1. Fail loud on `csRepRosterId = NULL` — server returns 409 + error log when a CUSTOMER_SERVICE user hits `/stale-summary` without a linked roster entry. No silent-empty fallback. No name-string fallback either. FK is the ONLY source of truth.
2. Reconciliation script: auto-link exact matches; surface fuzzy (Levenshtein ≤ 1) for admin approval. The "Jasmin"↔"Jasmine" case fits fuzzy; user approves before commit.

---
*Discovery completed: 2026-04-16*
*Confidence: HIGH (code-verified); MEDIUM (data-state — SQL query will finalize)*
*Ready for: /paul:milestone (v3.2 scope confirmation) → /paul:plan 80-myqueue-rep-linkage*
