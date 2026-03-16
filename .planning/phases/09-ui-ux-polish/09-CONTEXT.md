# Phase 9: UI/UX Polish - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

All dashboards have consistent, validated forms and polished layouts following the dark glassmorphism design system. This phase standardizes form validation, migrates local style constants to shared @ops/ui tokens/components, adds loading skeletons and empty states, and ensures hover/focus consistency. No new features or capabilities — only polish of what exists.

</domain>

<decisions>
## Implementation Decisions

### Validation display
- Inline per-field errors: red border on invalid field + red error text below the field
- Validation triggers on submit only — no on-blur or real-time validation
- Existing alert bar above form stays for API-level errors (500s, network failures)
- Inline errors for client-side field validation only (required fields, format, range)
- Submit button always enabled — clicking with errors triggers validation display and shows inline errors

### Form consistency scope
- Migrate local style constants (CARD, INP, BTN, etc.) to shared @ops/ui tokens and components
- All dashboards treated equally: manager, payroll, owner, auth-portal
- All input types (text, dropdown, date picker) share the same base style — same height, border, background, padding; only icons/affordances differ
- Labels positioned above inputs (stacked layout) across all forms

### Polish beyond forms
- Add Skeleton loading placeholders from @ops/ui where loading states are blank or spinner-only
- Standardize hover/focus states across all interactive elements (buttons, table rows, links) using motion tokens from @ops/ui
- Use EmptyState component from @ops/ui for no-data scenarios ("No sales this period", "No agents found")
- Desktop-only for v1 — no responsive/mobile optimization (internal ops tool)

### Design guidance approach
- Use ui-ux-pro-max skill for targeted fixes — audit existing components and fix specific issues (contrast, spacing, visual hierarchy)
- Do not redesign from scratch — targeted improvements only
- Keep current dark glassmorphism theme depth as-is — fix consistency across dashboards, don't deepen the effect
- Unify button styles via shared Button component from @ops/ui with primary/secondary/danger variants
- Standardize table styling: consistent row height, hover color, header styling, border treatment across all table views

### Claude's Discretion
- Exact skeleton layout per dashboard (which sections get skeletons)
- Specific contrast/spacing fixes identified during ui-ux-pro-max audit
- Whether to create a shared Table component or just align table style constants
- Typography hierarchy adjustments within the existing token system
- Error message wording for each validation rule

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design system
- `packages/ui/src/tokens.ts` — Design tokens: colors, spacing, radius, shadows, typography, motion
- `packages/ui/src/components/Button.tsx` — Base button styles and variants
- `packages/ui/src/components/Input.tsx` — Base input styles (baseInputStyle)
- `packages/ui/src/components/Card.tsx` — Card container component
- `packages/ui/src/components/Skeleton.tsx` — Loading skeleton component
- `packages/ui/src/components/EmptyState.tsx` — Empty state placeholder component
- `packages/ui/src/components/Toast.tsx` — Toast notification component
- `packages/ui/src/components/Badge.tsx` — Badge component
- `packages/ui/src/components/StatCard.tsx` — KPI stat card component
- `packages/ui/src/components/TabNav.tsx` — Tab navigation component
- `packages/ui/src/theme.css` — Global CSS variables and animations
- `packages/ui/src/animations.css` — Animation keyframes

### Dashboard pages (all forms and layouts to polish)
- `apps/manager-dashboard/app/page.tsx` — Sales entry form, agent tracker, config management
- `apps/payroll-dashboard/app/page.tsx` — Payroll periods, commission approval, agent pay cards
- `apps/owner-dashboard/app/page.tsx` — KPI summary, trend indicators, period summary
- `apps/auth-portal/app/page.tsx` — Login form
- `apps/sales-board/app/page.tsx` — Sales leaderboard (read-only, minimal forms)

### Codebase analysis
- `.planning/codebase/CONVENTIONS.md` — Coding conventions, React component patterns, style system
- `.planning/codebase/STRUCTURE.md` — Codebase structure, where to add new code

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/ui/src/tokens.ts`: Full design token set (colors, spacing, radius, shadows, typography, motion) — should be the single source of truth
- `packages/ui/src/components/`: Button, Card, Input, Badge, Toast, Tooltip, ProgressRing, Skeleton, StatCard, AnimatedNumber, TabNav, EmptyState — many already exist but may not be used in all dashboards
- `packages/ui/src/ThemeProvider.tsx`: Theme context provider already wired into all dashboards

### Established Patterns
- All styling via inline React.CSSProperties objects — no Tailwind, no global CSS
- Style constants defined at module scope: `const CARD: React.CSSProperties = { ... }`
- Each dashboard currently defines its own local style constants — these need consolidation
- `authFetch()` from `@ops/auth/client` handles all API calls with Bearer header injection

### Integration Points
- Each dashboard's `page.tsx` is the main integration point — single-file components with local styles
- `@ops/ui` package exports are consumed via `transpilePackages` in each Next.js config
- Adding new shared components: create in `packages/ui/src/components/`, export from `index.ts`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-ui-ux-polish*
*Context gathered: 2026-03-16*
