# Phase 74 Skill Loadout — Payroll Mobile

## Primary
- **mobile-design** — Data-dense layouts on small screens, drawer patterns.
- **redesign-existing-projects** — AgentCard / WeekSection / PayrollPeriods all shipped and financially critical. Zero tolerance for regressions on math display.
- **ui-ux-pro-max** — Adjustment / clawback entry forms on mobile (number pads, sign conventions visible).
- **frontend-design** — Agent sidebar → drawer pattern; collapsible week sections.

## Targets
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`
- `AgentCard` / `WeekSection` components (commission + adjustment + clawback display)
- Payroll agent sidebar (debounced search from v2.5 must stay functional)

## Notes
- Net formula displays must remain correct after layout changes — verify `computeNetAmount` output is preserved, not reformatted.
- Print view must stay desktop-shaped (print is a separate concern from mobile).
- Touch targets ≥ 44pt on dollar-amount inputs — fat-finger errors on payroll = real money.
