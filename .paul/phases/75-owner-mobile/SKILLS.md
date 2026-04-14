# Phase 75 Skill Loadout — Owner Mobile

## Primary
- **mobile-design** — KPI grid stacking, data drill-down on narrow screens.
- **redesign-existing-projects** — Owner command center + Trends are recently-shipped (v2.7); retrofit carefully.
- **ui-ux-pro-max** — Chart interactions on touch (tap-for-tooltip, no hover).
- **frontend-design** — Activity feed compact mode, leaderboard card layout.
- **kpi-dashboard-design** — KPI prioritization when space is scarce; what collapses vs stays primary.

## Targets
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` (command center)
- `OwnerKPIs.tsx`, `OwnerScoring.tsx`, `OwnerUsers.tsx`, `OwnerConfig.tsx`
- Recharts components in Trends tab — must use `<ResponsiveContainer>` with mobile-safe margins
- `sales-board` app — TV-primary; mobile is a secondary nice-to-have (leave 3013 unchanged unless trivial)

## Notes
- Recharts tooltips are hover-based by default — need tap handlers on mobile.
- KPI grid today uses `auto-fit minmax` (Phase 52) — verify stacking behavior below 480px.
- Activity feed items need truncation strategy on narrow screens, not wrap-to-four-lines.
