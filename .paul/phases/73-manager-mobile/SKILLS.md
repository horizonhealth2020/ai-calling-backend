# Phase 73 Skill Loadout — Manager Mobile

## Primary
- **mobile-design** — Touch targets, stacked forms, thumb-zone CTAs.
- **redesign-existing-projects** — ManagerEntry.tsx + tracker tables are shipped and stable; retrofit without regressions.
- **ui-ux-pro-max** — Form UX on mobile (input sizing, validation placement, sticky submit).
- **frontend-design** — Card-per-sale layout below breakpoint, filter-panel-as-drawer pattern.

## Targets
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` — multi-product form → stacked layout
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` — table → card list on narrow screens
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingHeatmap.tsx` + sparkline components — horizontal scroll vs compressed view

## Notes
- Consumes breakpoint tokens + responsive primitives from Phase 72.
- ConfirmModal already mobile-safe (Phase 50) — verify touch targets only.
