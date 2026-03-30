# Roadmap: v1.9 Auth Stability & Phone Number Display

**Milestone:** v1.9
**Phases:** 2
**Granularity:** Fine
**Coverage:** 10/10 requirements mapped

## Phases

- [x] **Phase 31: Auth Stability Fix** - Fix the production login redirect loop affecting 3 users by adding JWT expiry checks and stale token cleanup
- [ ] **Phase 32: Phone Number Data Pipeline** - Add lead phone numbers from Convoso data to call audit and agent sales views

## Phase Details

### Phase 31: Auth Stability Fix
**Goal**: Users with expired tokens are cleanly redirected to login instead of stuck in an infinite redirect loop
**Depends on**: Nothing
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. A user with an expired JWT cookie hitting a dashboard route is redirected to login exactly once (no loop)
  2. After redirect, the expired cookie is gone -- refreshing the login page does not re-trigger a redirect
  3. A user with an expired localStorage token on the login page sees the login form (not a flash redirect back to dashboard)
  4. A user with a valid, non-expired token continues to access dashboard routes without interruption
**Plans:** 1 plan
Plans:
- [x] 31-01-PLAN.md -- Add JWT expiry checks to middleware and login page with token cleanup

### Phase 32: Phone Number Data Pipeline
**Goal**: Managers can see lead phone numbers on call audit rows and agent sales rows for quick reference
**Depends on**: Phase 31 (ship auth fix first as higher priority, though technically independent)
**Requirements**: PHONE-01, PHONE-02, PHONE-03, PHONE-04, PHONE-05, PHONE-06, PHONE-07
**Success Criteria** (what must be TRUE):
  1. New Convoso call logs captured after deployment show a phone number in the Manager Audits table
  2. When creating or editing a sale, the optional leadPhone field is accepted and persisted
  3. The Manager Sales table displays a Phone column with lead phone data when present
  4. Existing call logs and sales without phone data display gracefully (no errors, empty cell)
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 31. Auth Stability Fix | 1/1 | Complete | 2026-03-30 |
| 32. Phone Number Data Pipeline | 0/0 | Not started | - |

---
*Roadmap created: 2026-03-30*
*Last updated: 2026-03-30 -- Phase 31 complete*
