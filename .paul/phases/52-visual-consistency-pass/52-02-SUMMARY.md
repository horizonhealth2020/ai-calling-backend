---
phase: 52-visual-consistency-pass
plan: 02
subsystem: ui
tags: [design-tokens, color-migration, typography, refactor]

requires:
  - phase: 52-visual-consistency-pass/01
    provides: semanticColors (30 aliases), colorAlpha helper, typography tokens

provides:
  - Hardcoded hex colors migrated to semanticColors tokens
  - Hardcoded rgba() migrated to colorAlpha() calls
  - Hardcoded fontSize migrated to typography.sizes.*.fontSize references
  - Centralized visual value management across all dashboards

affects: []

tech-stack:
  added: []
  patterns:
    - "All status/accent colors referenced via semanticColors.* tokens"
    - "rgba opacity patterns use colorAlpha(token, alpha)"
    - "fontSize values reference typography.sizes.*.fontSize for exact matches"

key-files:
  modified:
    - 25 dashboard files across payroll, manager, owner, CS areas

key-decisions:
  - "Exact-match fontSize only — no lossy conversions (9,10,12,15,20 left as-is)"
  - "Skip rgba(0,0,0,*) and rgba(255,255,255,*) — generic overlays not tokenizable"
  - "Skip hex in SVG data URIs — encoded strings not suitable for token refs"
  - "Print CSS hex values left as-is (template literal strings)"

patterns-established:
  - "Import semanticColors, colorAlpha, typography from @ops/ui for all visual values"

duration: ~30min
started: 2026-04-10T00:00:00Z
completed: 2026-04-10T00:00:00Z
---

# Phase 52 Plan 02: Bulk Token Migration Summary

**Migrated 324 hardcoded visual values to design tokens: 64 hex → semanticColors, 54 rgba → colorAlpha, 206 fontSize → typography.sizes — zero visual regressions, zero new TypeScript errors.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30min |
| Tasks | 3 completed (2 via subagent delegation) |
| Files modified | 25 |
| Total replacements | 324 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Hex colors → semanticColors | Pass | 64 replacements across 18 files |
| AC-2: rgba() → colorAlpha() | Pass | 54 replacements, skipped black/white overlays |
| AC-3: fontSize → typography tokens | Pass | 206 exact-match replacements, no lossy conversions |
| AC-4: No visual regressions | Pass | All mappings are 1:1 value-identical |

## Accomplishments

- Eliminated 64 hardcoded hex color values in favor of named semanticColors tokens
- Replaced 54 inline rgba() patterns with colorAlpha(token, alpha) calls
- Migrated 206 fontSize values to typography.sizes.*.fontSize references
- All visual values now centrally managed — changing a token value updates all consumers

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope reduction | 1 | Positive — fewer total instances than estimated |

### Details

**Scope reduction:** Original estimate was ~222 hex + ~362 fontSize. Actual was 64 hex + 206 fontSize exact matches. Many "hardcoded hex" instances were `.json().catch()` parse fallbacks or SVG data URIs (correctly skipped). Many fontSize values (9, 10, 12, 15, 20) were non-exact matches (correctly skipped per audit).

## Remaining Hardcoded Values (Intentional)

| Category | Count | Reason |
|----------|-------|--------|
| fontSize: 9, 10 | ~30 | Intentionally tiny labels, no exact token |
| fontSize: 12 | ~40 | Token is 13, would be visual change |
| fontSize: 15, 20, 24 | ~15 | No exact token match |
| rgba(0,0,0,*) | ~20 | Generic black overlay, not semantic |
| rgba(255,255,255,*) | ~10 | Generic white overlay |
| Hex in SVG data URIs | ~5 | Encoded strings |
| Print CSS hex | ~20 | Template literal strings |

## Next Phase Readiness

**Ready:**
- Phase 52 complete (2/2 plans) — v2.5 milestone ready for completion
- All 3 phases shipped: Shared UI Hardening, Dashboard Interactions, Visual Consistency

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 52-visual-consistency-pass, Plan: 02*
*Completed: 2026-04-10*
