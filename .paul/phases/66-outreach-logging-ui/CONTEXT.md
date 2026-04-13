# Phase 66: Outreach Logging UI — Discussion Context

## Goals

1. **Attempt count badge front-and-center** on each CS card — "0/3 Calls" with green indicator at 3/3
2. **Card expansion reworked** — expand shows full working area (attempt timeline + log buttons + resolve), not just resolve. Expand trigger changes from "resolve" to something broader since agents do more before resolving now
3. **Log Call/Email/Text buttons** inside expanded area with required notes field
4. **Attempt timeline** showing logged attempts with timestamps, type, agent name, notes
5. **Resolve section** at bottom of expanded area with enriched resolution options (recovered/closed/no_contact for chargebacks, saved/cancelled/no_contact for pending terms)
6. **Soft gate with override** — if < 3 calls and agent tries to close/cancel/no_contact, show "Override 3-call gate" checkbox that reveals a required textarea for justification
7. **Gate bypass audit-logged** — override reason recorded in audit log

## Approach

- Reuse existing card expand pattern but change the trigger/label to reflect broader scope
- Existing expand mechanism: clicking "resolve" expands card to show notes + saved/cancelled buttons. Rework so expand shows: timeline + log buttons + resolve section
- API change needed: Phase 65's hard 400 block needs a `bypassReason` optional field that allows resolution with < 3 calls when justification is provided
- Notes required on all contact attempts (Zod `.min(1)`)
- Follow existing inline CSSProperties pattern (dark glassmorphism theme)
- Consume Phase 65 API: POST/GET /api/contact-attempts

## Constraints

- No new libraries — use existing patterns (inline styles, authFetch, existing components)
- Must be backward-compatible: existing resolved records display correctly
- Phase 65 migration must be deployed before this UI work is functional

## Key Decisions

- Gate is soft, not hard — bypass allowed with detailed justification note
- "Override 3-call gate" checkbox pattern (reveals required textarea)
- Green indicator when 3/3 calls reached
- Attempt count prominent on card (not hidden in expand)
- Card expand trigger renamed from "resolve" to broader label
- Notes required on every contact attempt

## Open Questions

- Exact label for the new expand trigger (e.g., "Work", "Details", "Manage"?)
- Timeline layout: vertical list vs compact rows — decide during planning
- Whether EMAIL/TEXT attempts show in the count badge or just CALL type

## Dependencies

- Phase 65 API: POST /api/contact-attempts, GET /api/contact-attempts
- Phase 65 resolution gate on PATCH resolve endpoints
- Existing CS card components in ops-dashboard

---
*Created: 2026-04-13 — from /paul:discuss*
