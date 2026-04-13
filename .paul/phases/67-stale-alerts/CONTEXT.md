# Phase 67: 48-Hour Stale Alerts — Discussion Context

## Goals

1. **Pending terms: 48-hour hard deadline from morning of createdAt** — alert stays until resolved, logging attempts does NOT clear it. Only resolution clears the alert.
2. **Chargebacks: 48-hour deadline from morning of createdAt** — alert clears when any contact attempt is logged (record "worked"). Clock resets on each attempt.
3. **"My Queue" personal view** — new section/tab on CS page for CUSTOMER_SERVICE users showing only records assigned to them, with stale items highlighted and prioritized at top
4. **Agent matching** — match `assignedTo` (name string like "Alex") to logged-in user's `name` field (case-insensitive)
5. **Owner/admin stale overview** — OWNER_VIEW and SUPER_ADMIN see aggregate stale counts across all CS reps (e.g., "Alex: 3 stale, Maria: 1 stale") — bird's-eye accountability view

## Staleness Rules

- **Deadline calculation:** midnight of createdAt date (start of day) + 48 hours
- **Pending term stale:** current time > deadline AND not resolved
- **Chargeback stale:** current time > deadline AND no contact attempts logged (or last attempt > 48 hours ago for reset behavior)
- **Chargeback worked:** any contact attempt logged resets the 48-hour clock. New deadline = last attempt createdAt + 48 hours
- **Already resolved records:** never stale (resolved = done)

## Approach

- My Queue is a NEW section/tab on the CS page, not a replacement for existing tracking view
- Existing CS tracking view stays as-is (all records, all agents) for everyone
- My Queue only shows for CUSTOMER_SERVICE role users — filtered to assignedTo matching their name
- Owner/admin stale overview could be a card/section on the existing CS page or a new sub-tab showing per-agent stale counts
- Staleness computed server-side (API endpoint) to avoid timezone issues
- Need API endpoint: GET /api/stale-alerts (returns stale records grouped by assignedTo, filterable by agent)

## Agent Matching

- `assignedTo` field on ChargebackSubmission and PendingTerm stores a name string (e.g., "Alex")
- Logged-in user has `name` field (e.g., "Alex") and `email` (e.g., "Alex@horizon.com")
- Match strategy: case-insensitive comparison of `assignedTo` to logged-in user's `name`
- Edge case: if names don't match exactly, records won't appear in My Queue

## Constraints

- No new libraries
- Staleness logic should be server-side (SQL query with date math)
- Must work with existing round-robin assignment flow (assignedTo already populated)
- Phase 66 ContactAttempt data used for chargeback "worked" detection

## Dependencies

- Phase 66 API: GET /api/contact-attempts (for chargeback last-worked detection)
- Phase 65: ContactAttempt model
- Existing assignedTo field on ChargebackSubmission and PendingTerm

## Open Questions

- Where exactly does the owner/admin stale overview appear? New section on CS page? Existing CS analytics tab?
- Should My Queue show a countdown timer ("12h remaining") or just a "STALE" badge?
- Should stale items have a visual treatment in the main tracking view too (red highlight for everyone)?

---
*Created: 2026-04-13 — from /paul:discuss*
