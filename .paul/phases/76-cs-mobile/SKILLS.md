# Phase 76 Skill Loadout — CS Mobile

## Primary
- **mobile-design** — Table → card transformations for dense tracking data.
- **redesign-existing-projects** — CSTracking / CSMyQueue / CSAnalytics all shipped through v2.9.1; retrofit without breaking outreach logging flows.
- **ui-ux-pro-max** — Expanded-row pattern (Work button) → full-screen sheet on mobile.
- **frontend-design** — Attempt timeline, log-call form, resolution modal all mobile-tuned.

## Targets
- `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` — chargeback + pending-term tables → card lists
- `apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx` — agent queue
- `apps/ops-dashboard/app/(dashboard)/cs/CSAnalytics.tsx` — leaderboards, correlation chart, bypass rollup (already has overflow fix from v2.9.1)

## Notes
- The expanded "Work" row contains Log Attempt + Resolve forms — on mobile this should become a bottom sheet or full-screen modal, NOT an inline row (row would push other records off-screen).
- Attempt counter badge (0/3, 1/3, 2/3) from commit 01c2d08 must stay visible in the card layout.
- Debounced search inputs (v2.5) must remain functional.
- Resolution gate override UI (Phase 66) needs touch-friendly spacing — bypassReason textarea is critical path.
- Pre-v2.9 cutoff handling in analytics must stay intact — layout changes only, no logic changes.
