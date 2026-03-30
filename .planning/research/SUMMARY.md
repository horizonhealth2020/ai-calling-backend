# Research Summary: v1.9 Auth Stability & Phone Number Display

**Domain:** Auth bug fix + Convoso data enrichment
**Researched:** 2026-03-30
**Overall confidence:** HIGH

## Executive Summary

This milestone requires zero new dependencies. Both features are application logic fixes using the existing stack (Next.js 15.3.9, Prisma, Express, existing @ops/auth package).

The auth redirect loop affecting 3 production users is caused by a gap between middleware and client-side token lifecycle management. The Next.js middleware decodes JWT base64 to read roles but does not check the `exp` claim, so expired tokens pass the middleware guard. The API correctly rejects them, the client clears localStorage, but the cookie persists -- creating an infinite redirect between the login page and dashboard routes. The fix is adding an expiry timestamp check in middleware (with cookie deletion) and a stale token cleanup on the login page.

The phone number display is a straightforward data pipeline extension. Convoso already returns `phone_number` in call log responses, but the poller does not map it to the database. Adding a nullable `leadPhone` column to `ConvosoCallLog` and mapping the field in the poller completes the pipeline. Dashboard components then add a column to display the data.

Both features are low complexity, well-understood, and require no new patterns or libraries.

## Key Findings

**Stack:** No new dependencies. Pure application logic changes using existing Next.js middleware, @ops/auth/client, Prisma, and React components.
**Architecture:** No structural changes. Data flows through existing pipelines with one new field added.
**Critical pitfall:** The cookie must be explicitly deleted in the middleware redirect response. A redirect alone does not clear cookies, and the expired cookie will recreate the loop.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Auth Stability Fix** - Fix the production redirect loop
   - Addresses: Middleware expiry check, cookie deletion, login page stale token cleanup
   - Avoids: Pitfall 1 (cookie not deleted) and Pitfall 2 (localStorage-only fix)
   - Rationale: Unblocks 3 affected production users immediately

2. **Phone Number Data Pipeline** - Add phone capture and display
   - Addresses: Prisma migration, poller mapping, dashboard columns
   - Avoids: Pitfall 4 (missing fallback field) and Pitfall 5 (non-nullable column)
   - Rationale: Schema migration must land before poller change; columns depend on data existing

**Phase ordering rationale:**
- Auth fix is the higher-priority bug fix affecting real users now. Ship first.
- Phone number is an enhancement that can follow. The migration should deploy before the poller change to avoid write errors.
- Both phases are independent and could theoretically run in parallel, but sequential ordering is safer for a 2-phase milestone.

**Research flags for phases:**
- Phase 1 (Auth): No deeper research needed. The bug is fully understood from code review.
- Phase 2 (Phone): No deeper research needed. The Convoso field is confirmed available.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. All code paths verified by reading source. |
| Features | HIGH | Both features are small, well-scoped, with clear implementation paths. |
| Architecture | HIGH | No architectural changes. Operates within existing boundaries. |
| Pitfalls | HIGH | Primary pitfall (cookie deletion) identified from understanding Next.js Response API behavior. |

## Gaps to Address

- None identified. Both features are fully understood from the existing codebase. No external research was needed beyond confirming the Convoso API returns `phone_number` (which is confirmed by the existing `CALL_LOG_PASS_THROUGH_PARAMS` constant in the codebase).
