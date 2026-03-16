---
phase: 09-ui-ux-polish
plan: 01
subsystem: ui-components
tags: [select, tokens, auth-portal, owner-dashboard, shared-components]
dependency_graph:
  requires: []
  provides: [Select-component, baseThStyle, baseTdStyle, auth-portal-shared-ui, owner-dashboard-shared-tokens]
  affects: [packages/ui, apps/auth-portal, apps/owner-dashboard]
tech_stack:
  added: []
  patterns: [shared-component-migration, per-field-validation, token-replacement]
key_files:
  created:
    - packages/ui/src/components/Select.tsx
  modified:
    - packages/ui/src/components/index.ts
    - packages/ui/src/tokens.ts
    - apps/auth-portal/app/page.tsx
    - apps/owner-dashboard/app/page.tsx
decisions:
  - Select component mirrors Input pattern exactly (label, error, icon, className="input-focus")
  - PasswordInput kept as local sub-component in auth-portal (needs show/hide toggle not in Input)
  - Owner dashboard CARD constant kept (extends baseCardStyle with 2xl radius)
  - Owner dashboard LBL constant kept (just spreads baseLabelStyle, harmless alias)
metrics:
  duration: 252s
  completed: "2026-03-16"
  tasks: 3
  files: 5
---

# Phase 9 Plan 01: Shared Select Component & Foundation Migrations Summary

Select component and table style tokens added to @ops/ui; auth-portal migrated to shared Input/Button/Card with per-field validation; owner dashboard local TH/TD/INP replaced with shared tokens.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Create Select component and table tokens | e33b4f1 | Select.tsx, baseThStyle/baseTdStyle in tokens.ts, barrel export |
| 2 | Migrate auth-portal to shared components | c819292 | Input/Button/Card replace local constants, fieldErrors validation |
| 3 | Migrate owner dashboard to shared tokens | 8413548 | baseThStyle/baseTdStyle replace TH/TD, Select replaces native select |

## Deviations from Plan

### Minor Adjustments

**1. [Rule 2 - Missing] Owner dashboard CARD constant retained**
- The plan suggested replacing CARD with Card component or baseCardStyle, but the local CARD extends baseCardStyle with `borderRadius: radius["2xl"]` which is used consistently. Kept as-is since it still derives from the shared token.

**2. [Rule 1 - Bug prevention] PasswordInput kept as local component**
- The plan acknowledged keeping PasswordInput local but adding error prop support. The show/hide toggle with eye button is specific to auth-portal and not generalizable to the shared Input component.

**3. Owner dashboard LBL constant retained**
- LBL is just `{ ...baseLabelStyle }` -- a harmless alias already deriving from shared tokens. Removing it would be a purely cosmetic change with no functional benefit.

## Verification Results

- Select.tsx exports `Select` function with `appearance: "none"`, error prop, icon support, `className="input-focus"`
- tokens.ts exports `baseThStyle` (fontSize 11, fontWeight 700, textTransform uppercase) and `baseTdStyle` (fontSize 13, textSecondary)
- Auth-portal: no SUBMIT_BTN, GHOST_BTN, INPUT, FORM_CARD, Spinner constants remain
- Auth-portal: Input, Button, Card components imported and used; fieldErrors state with per-field validation
- Owner dashboard: no TH, TD, INP constants remain; baseThStyle/baseTdStyle imported and used throughout
- Owner dashboard: row-hover class present on all data table rows; EmptyState and SkeletonCard still in use

## Self-Check: PASSED
