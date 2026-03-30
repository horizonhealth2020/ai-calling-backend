# Requirements: Ops Platform

**Defined:** 2026-03-30
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.9 Requirements

Requirements for Auth Stability & Phone Number Display. Each maps to roadmap phases.

### Auth Stability

- [ ] **AUTH-01**: Middleware checks JWT `exp` claim and rejects expired tokens before role check
- [ ] **AUTH-02**: Middleware deletes `ops_session` cookie when redirecting due to expired token
- [ ] **AUTH-03**: Login page clears expired localStorage token before attempting auto-redirect

### Phone Number Display

- [ ] **PHONE-01**: ConvosoCallLog model has nullable `leadPhone` field with Prisma migration
- [ ] **PHONE-02**: Sale model has nullable `leadPhone` field (same migration)
- [ ] **PHONE-03**: Convoso poller captures `phone_number` from API response into `leadPhone`
- [ ] **PHONE-04**: Call audits API includes `convosoCallLog.leadPhone` in list response
- [ ] **PHONE-05**: ManagerAudits table displays Phone column from call log data
- [ ] **PHONE-06**: Sales API Zod schema accepts optional `leadPhone` on POST/PATCH
- [ ] **PHONE-07**: ManagerSales table displays Phone column from sale data

## Future Requirements

None deferred from this milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full JWT verification in Edge Runtime | Edge Runtime cannot access server secrets; API remains auth authority |
| Phone number formatting/masking | Display raw Convoso data as-is; formatting adds complexity for no clear benefit |
| Phone number search/filter | Scope creep; not requested |
| Backfill phone numbers for existing call logs | Depends on Convoso API data retention; new calls will have data going forward |
| Token refresh in middleware | Client-side ensureTokenFresh already handles this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| PHONE-01 | TBD | Pending |
| PHONE-02 | TBD | Pending |
| PHONE-03 | TBD | Pending |
| PHONE-04 | TBD | Pending |
| PHONE-05 | TBD | Pending |
| PHONE-06 | TBD | Pending |
| PHONE-07 | TBD | Pending |

**Coverage:**
- v1.9 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10 ⚠️

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after initial definition*
