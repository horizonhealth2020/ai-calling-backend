# Phase 65: Outreach Data Model — Context

**Created:** 2026-04-13
**Status:** Ready for /paul:plan

## Goals

1. ContactAttempt table — polymorphic link (one table, two nullable FKs to ChargebackSubmission and PendingTerm)
2. Auto-incrementing attemptNumber — agent clicks "Log Call" and it records attempt #N with timestamp
3. Resolution outcome expansion — SAVED, CANCELLED, NO_CONTACT on existing resolutionType field
4. Resolution gate — CANCELLED/NO_CONTACT blocked until 3 CALL attempts logged; SAVED allowed anytime
5. Toast warning if agent tries to resolve as CANCELLED/NO_CONTACT without sufficient call attempts

## Approach

- **Option A (polymorphic):** Single ContactAttempt table with nullable chargebackSubmissionId and pendingTermId
- **Type enum:** CALL, EMAIL, TEXT — but only CALL counts toward the 3-attempt requirement
- **attemptNumber:** Auto-calculated from count of existing CALL attempts + 1 (not manually entered)
- **Resolution gate logic:** API-enforced — the resolve endpoint checks CALL attempt count >= 3 before allowing CANCELLED/NO_CONTACT. Frontend shows toast warning but the gate is server-side.
- **resolutionType expansion:** Existing field on ChargebackSubmission and PendingTerm already holds strings. Expand expected values: SAVED, CANCELLED, NO_CONTACT (backward-compatible with existing resolved records)
- **Clean UI:** "Log Call" / "Log Email" / "Log Text" buttons with optional notes field. No complex forms. Click → timestamp recorded → counter updates.

## Scope

### Prisma Schema
- New model: ContactAttempt (id, type, notes, attemptNumber, chargebackSubmissionId?, pendingTermId?, agentId, createdAt)
- Relations: ChargebackSubmission hasMany ContactAttempt, PendingTerm hasMany ContactAttempt, User hasMany ContactAttempt
- Migration: additive only, no breaking changes

### API Endpoints
- POST /api/contact-attempts — create attempt (auto-calculates attemptNumber from CALL count)
- GET /api/contact-attempts?chargebackId=X or ?pendingTermId=X — list attempts for a record
- PATCH /api/chargebacks/:id/resolve and /api/pending-terms/:id/resolve — add gate: require 3 CALL attempts for CANCELLED/NO_CONTACT

### Resolution Gate
- Server-side enforcement: resolve endpoint counts CALL-type ContactAttempts before allowing CANCELLED/NO_CONTACT
- SAVED bypasses gate (saving a customer is always good)
- Frontend shows toast warning: "3 call attempts required before marking as cancelled"

## Constraints

- Additive schema only — existing ChargebackSubmission and PendingTerm models unchanged except adding relation
- Existing resolved records (resolutionType already set) remain valid
- Email/text outreach logged but only CALL type counts toward the 3-attempt gate
- No automated outbound — this is a manual logging tool

## Open Questions

- Do email/text attempts count toward the 3-call requirement? (Assumed: no, strictly calls)

---

*This file persists across /clear so you can take a break if needed.*
