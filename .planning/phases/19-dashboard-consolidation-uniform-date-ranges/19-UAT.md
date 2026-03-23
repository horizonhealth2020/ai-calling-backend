---
phase: 19
status: diagnosed
created: 2026-03-23T16:33:31.250Z
updated: 2026-03-23T16:33:31.250Z
---

# Phase 19 UAT: Dashboard Consolidation & Uniform Date Ranges

## Test Results

| # | Test | Requirements | Result | Notes |
|---|------|-------------|--------|-------|
| 1 | Login & role redirect | SHELL-01, SHELL-04 | ✓ Pass | SUPER_ADMIN lands on Owner tab |
| 2 | Role tab visibility | SHELL-02, SHELL-03 | ✓ Pass | All 4 tabs visible on hover |
| 3 | Tab navigation (no reconnect) | SHELL-05 | ✓ Pass | No white flash or reconnection |
| 4 | Owner sub-tabs | MIG-02 | ⚠ Partial | Sub-tabs work; KPIs show core premium only, missing add-on premiums |
| 5 | Manager sub-tabs | MIG-04 | ⚠ Partial | Sub-tabs work; Tracker and Sales show core premium only |
| 6 | Payroll sub-tabs | MIG-03 | ✓ Pass | All 5 sub-tabs load |
| 7 | CS sub-tabs | MIG-01 | ✓ Pass | Both sub-tabs load |
| 8 | Date range filter | DR-01, DR-02, DR-03, DR-04 | ✓ Pass | 4 presets work, numbers update |
| 9 | Date range persistence | DR-05 | ✓ Pass | Selection persists across tab switches |
| 10 | Sales board independence | DEPLOY-01 | ✗ Fail | Background loads but agent features and breakdown sections missing |

## Gaps

### Gap 1: KPI premium calculations exclude add-on premiums

- **status:** failed
- **severity:** medium
- **affected:** Owner KPIs, Manager Tracker, Manager Sales
- **description:** KPI displays show only core product premium. Add-on product premiums are not included in the aggregated totals. May be pre-existing API issue (not confirmed whether old standalone dashboards had same behavior).
- **likely_cause:** API endpoints that aggregate premium/commission data may not be joining the `sale_addons` table.

### Gap 2: Sales board UI broken

- **status:** failed
- **severity:** high
- **affected:** Sales board standalone app (localhost:3013 / Railway)
- **description:** Sales board loads with background colors but agent features and breakdown sections are missing. The board was not modified in phase 19 but may be affected by CORS changes or shared dependency updates.
- **likely_cause:** CORS `ALLOWED_ORIGINS` on ops-api may not include the sales board URL after phase 19 changes, or shared `@ops/ui` changes affected the sales board layout.

## Summary

- **Tests:** 10
- **Passed:** 7
- **Partial:** 2
- **Failed:** 1
- **Gaps:** 2
