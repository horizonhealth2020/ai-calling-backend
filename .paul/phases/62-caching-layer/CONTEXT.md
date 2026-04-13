# Phase 62: Caching Layer — Context

**Created:** 2026-04-13
**Status:** Ready for /paul:plan

## Goals

1. Eliminate the lag when switching between dashboard tabs — aggregation queries should serve from cache on repeated requests
2. Cache results for the heaviest endpoints: command center, tracker summary, owner summary, trends, reporting periods
3. Auto-invalidate when data mutations happen via existing Socket.IO events
4. Short TTL (30-60s) as fallback so stale data self-heals even if an invalidation is missed

## Approach

- Single plan — one cache module used by multiple routes
- Simple in-memory cache (Node.js Map with TTL) — no Redis, no new dependencies
- Cache key = endpoint path + query params (date range, view type)
- Invalidate on Socket.IO events that already fire on mutations:
  - Sale created/updated/deleted
  - Chargeback submitted/resolved
  - Payroll period lock/unlock/finalize
- Short TTL (30-60s) as safety net for missed invalidations
- Cache bypass header for development/debugging

## Endpoints to Cache

| Endpoint | Current behavior | Cache benefit |
|----------|-----------------|---------------|
| GET /api/command-center | Multiple Prisma queries + aggregation | High — owner tab default view |
| GET /api/tracker/summary | Agent sales + calls + commission aggregation | High — manager tab default view |
| GET /api/owner/summary | Sales count + premium + clawback aggregation | Medium — owner KPI cards |
| GET /api/trends/* | Historical aggregation over 30-90 day windows | High — heaviest queries |
| GET /api/reporting/periods | Payroll period summaries (weekly/monthly) | Medium — payroll tab |

## Constraints

- Must work with Railway single-instance deployment (no shared cache)
- Must not serve stale data after a mutation — correctness over speed
- Must not break existing Socket.IO event flow
- No new npm dependencies (use native Map + setTimeout)
- No changes to frontend — cache is transparent to API consumers

## Open Questions

None — scope is clear.

---

*This file persists across /clear so you can take a break if needed.*
