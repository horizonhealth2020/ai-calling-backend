# Features Research

**Project:** Ops Platform — Payroll & Usability Overhaul
**Dimension:** Features
**Confidence:** MEDIUM-HIGH

## Table Stakes (Must Have)

Features that must work or the platform is unusable for daily operations.

### Sales Entry (Critical Path)
| # | Feature | Complexity | Dependencies |
|---|---------|-----------|-------------|
| 1 | Sale creation without errors (fix 500) | Low | None — blocker for everything |
| 2 | Multi-product selection per sale | Medium | Product management working |
| 3 | Payment type selection (ACH/Check/Other) | Low | Sale form |
| 4 | Enrollment fee input with threshold display | Low | Product threshold data |
| 5 | Commission preview before submission | Medium | Commission calculation engine |
| 6 | Sale edit and correction workflow | Medium | Sale creation working |

### Commission Engine
| # | Feature | Complexity | Dependencies |
|---|---------|-----------|-------------|
| 7 | Core product commission at set rate | Low | Product with rate defined |
| 8 | Compass VAB bundle detection for full commission | Medium | Product identification (not string matching) |
| 9 | Half commission for unbundled core products | Low | Bundle detection |
| 10 | Add-on/AD&D half commission standalone | Low | Product type categorization |
| 11 | Add-on/AD&D full commission when bundled with core | Low | Bundle detection |
| 12 | Enrollment fee below threshold → half commission | Low | Product threshold config |
| 13 | $125 enrollment fee → $10 bonus | Low | Enrollment fee tracking |
| 14 | ACH payment extra week arrears delay | Medium | Period assignment logic |

### Payroll Period Management
| # | Feature | Complexity | Dependencies |
|---|---------|-----------|-------------|
| 15 | Week-in-arrears period assignment (Sun-Sat) | Medium | Sale creation |
| 16 | Payroll cards per agent per period | Low | Period assignment |
| 17 | Scrollable payroll cards | Low | UI fix only |
| 18 | Period status workflow (Pending → Ready → Finalized) | Medium | Payroll entries correct |
| 19 | Payroll export (CSV) | Medium | Period finalization |

### Dashboard Cascade
| # | Feature | Complexity | Dependencies |
|---|---------|-----------|-------------|
| 20 | Sale appears on agent tracker (manager) | Low | Socket.IO events |
| 21 | Sale appears on sales board leaderboard | Low | Socket.IO events |
| 22 | Sale updates payroll card for agent | Medium | Commission calculated |
| 23 | Sale updates owner dashboard KPIs | Medium | Aggregation queries |

### Reporting
| # | Feature | Complexity | Dependencies |
|---|---------|-----------|-------------|
| 24 | Per-agent sales count and commission totals | Medium | Correct commission data |
| 25 | Per-agent cost-per-sale tracking | Medium | Agent cost data |
| 26 | Weekly/monthly period summaries | Medium | Period data correct |
| 27 | Export-ready payroll reports | Medium | Period finalization |

### UI/UX
| # | Feature | Complexity | Dependencies |
|---|---------|-----------|-------------|
| 28 | Forms with proper validation and error display | Medium | Zod schemas |
| 29 | Responsive form layouts across dashboards | Medium | Design system |

## Differentiators (Competitive Advantage)

Features that go beyond basic operations platforms.

| # | Feature | Complexity | Value |
|---|---------|-----------|-------|
| 1 | Live commission preview as products are selected | Medium | Agents see earnings before submit |
| 2 | Real-time leaderboard with Socket.IO | Low | Already partially built |
| 3 | AI call audit analysis (Claude) | High | Already exists — enhance |
| 4 | Trend KPIs (vs prior week/month) | Medium | Owner decision support |
| 5 | Bulk sale import from CSV | Medium | Batch entry efficiency |
| 6 | Commission dispute workflow | High | Audit trail for adjustments |
| 7 | Agent performance scoring (composite metric) | Medium | Beyond raw numbers |

## Anti-Features (Do NOT Build)

| Feature | Reason |
|---------|--------|
| Client-side commission calculation | Must be server-authoritative for payroll accuracy |
| Real-time chat between roles | Out of scope, adds complexity |
| Mobile native app | Web-first, responsive is sufficient |
| Custom report builder | Predefined reports cover the use case |
| Automated payroll provider integration | Manual export is acceptable for v1 |
| Commission plan designer (drag-and-drop rules) | Current product/rate model is sufficient |
| Multi-tenant support | Single organization tool |
| Agent self-service portal | Agents view via sales board only |
| Automated clawback triggers | Manual clawback workflow is safer |

## Feature Dependencies

```
Sale Creation (fix 500)
  └→ Multi-Product Selection
      └→ Commission Calculation (bundling rules)
          └→ Period Assignment (arrears logic)
              └→ Payroll Card Update
                  └→ Period Finalization
                      └→ Export
  └→ Socket.IO Events
      └→ Agent Tracker Update
      └→ Sales Board Update
      └→ Owner KPI Update
```

## MVP Phasing Recommendation

1. **Fix pipeline:** Sale creation, commission calc, period assignment
2. **Wire cascade:** Socket.IO events, dashboard updates
3. **Payroll UX:** Scrollable cards, period workflow, exports
4. **Reporting:** Agent performance, period summaries, owner KPIs
5. **Polish:** Forms overhaul, UI consistency, edge cases

---
*Research completed: 2026-03-14*
