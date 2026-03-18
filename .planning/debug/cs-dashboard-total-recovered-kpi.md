---
status: diagnosed
trigger: "Total Recovered KPI does not auto-update after resolving a chargeback as Recovered on the CS Dashboard"
created: 2026-03-18T00:00:00Z
updated: 2026-03-18T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — resolve handler does not re-fetch /chargebacks/totals; delete handler does
test: compared handleResolveCb and handleDeleteCb line by line
expecting: n/a — root cause confirmed
next_action: none (diagnose-only mode)

## Symptoms

expected: After resolving a chargeback as Recovered, the Total Recovered KPI increments immediately without page refresh
actual: Row dims and badge appear (optimistic UI works) but Total Recovered KPI value stays stale until page refresh
errors: none
reproduction: Resolve any open chargeback as Recovered → observe KPI counter
started: unknown / possibly always

## Eliminated

- hypothesis: totals endpoint itself is broken or does not count Recovered records
  evidence: /chargebacks/totals correctly queries WHERE resolutionType = 'recovered'; endpoint is fine
  timestamp: 2026-03-18

## Evidence

- timestamp: 2026-03-18
  checked: handleDeleteCb (line 1546-1554 in page.tsx)
  found: after a successful DELETE, immediately calls authFetch('/api/chargebacks/totals') and calls setTotals() with the result
  implication: delete path intentionally re-fetches totals and updates KPI

- timestamp: 2026-03-18
  checked: handleResolveCb (line 1568-1596 in page.tsx)
  found: after successful PATCH, only calls setChargebacks() to merge updated row — no call to authFetch('/api/chargebacks/totals') and no call to setTotals()
  implication: resolve path NEVER refreshes the totals state — this is the bug

- timestamp: 2026-03-18
  checked: totals state (line 1359 and 1750 in page.tsx)
  found: `totals` state is only set in fetchData() (initial load) and handleDeleteCb(); KPI renders directly from totals.totalRecovered
  implication: every path that mutates resolution status must re-fetch totals, but resolve/unresolve do not

- timestamp: 2026-03-18
  checked: /chargebacks/totals endpoint (line 2028-2044 in routes/index.ts)
  found: aggregates chargebackAmount WHERE resolutionType = 'recovered' (lowercase). The optimistic UI uses resolveType from state (user-selected string e.g. "Recovered" with capital R). The API persists the lowercase form.
  implication: endpoint is correct; nothing needs to change there

## Resolution

root_cause: |
  handleResolveCb and handleUnresolveCb mutate the chargebacks list state (optimistic UI) but
  never re-fetch /api/chargebacks/totals or call setTotals(). The totals state — which drives
  the Total Recovered KPI — is only refreshed on initial page load and after a DELETE.
  By contrast, handleDeleteCb explicitly re-fetches totals on line 1551-1552.

fix: |
  After the successful PATCH in handleResolveCb, add a totals re-fetch (same pattern as handleDeleteCb):
    const totalsRes = await authFetch(`${API}/api/chargebacks/totals`);
    if (totalsRes.ok) setTotals(await totalsRes.json());

  Optionally also add this in handleUnresolveCb so unresolving a "Recovered" chargeback
  decrements the KPI immediately too.

verification:
files_changed:
  - apps/cs-dashboard/app/page.tsx
