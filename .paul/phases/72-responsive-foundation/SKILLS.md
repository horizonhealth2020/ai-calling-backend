# Phase 72 Skill Loadout — Responsive Foundation

Skills to invoke during /paul:plan and /paul:apply for this phase.

## Primary
- **mobile-design** — Mobile-first, touch-first, platform-respectful principles. Foundation patterns used by every subsequent phase.
- **redesign-existing-projects** — Retrofit responsive behavior into shipped UIs without breaking functionality. This phase touches @ops/ui primitives that all dashboards already consume.
- **frontend-developer** — React 19 / Next.js 15 responsive layout patterns. Matches stack.
- **react-patterns** — Hook composition for inline-CSS-compatible responsive helpers (useMediaQuery / breakpoint hook pattern).

## Notes
- No Tailwind. No CSS files. Inline `React.CSSProperties` only (CLAUDE.md constraint).
- Responsiveness implemented via JS media-query hooks + conditional style objects, not CSS @media rules.
- Breakpoint tokens land in `packages/ui` so every dashboard consumes the same scale.
