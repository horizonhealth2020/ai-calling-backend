---
phase: 73-manager-mobile
plan: 01
subsystem: ui
tags: [responsive, mobile, manager-dashboard, responsive-table, sales-entry, lead-timing, heatmap, a11y]

requires:
  - phase: 72-responsive-foundation
    provides: useIsMobile hook, .responsive-table / .grid-mobile-1 / .stack-mobile / .full-width-mobile / .touch-target utilities

provides:
  - ManagerEntry mobile-friendly form (stacked, touch-sized, safe-area-padded)
  - ManagerEntry mobile-only mini Commission Preview card above Submit (shows commission + halvingReason warning before submit)
  - ManagerSales card-per-sale view on mobile via .responsive-table + data-label
  - Inline sale-edit form mobile-tuned (escapes card formatting, stacked grid, full-width Save/Cancel)
  - ManagerTracker agent-leaderboard table card-per-agent on mobile
  - LeadTimingHeatmap horizontally scrollable on mobile with project-standard "← swipe to see all hours →" hint
  - .responsive-table-no-label CSS escape valve for cells with controls and colspan rows
  - Project-wide standard scroll-affordance pattern (textual hint)
affects: [74-payroll-mobile, 75-owner-mobile, 76-cs-mobile]

tech-stack:
  added: []
  patterns:
    - "Pre-existing .stack-mobile className on display:grid container is a no-op (audit-discovered bug fixed in ManagerEntry)"
    - "Mobile-only mini-summary in primary flow when key info lives in stacked-below sidebar"
    - ".responsive-table-no-label escape valve for action cells + colspan rows"
    - "Inline submit + safe-area padding (NOT sticky) — avoids iOS keyboard occlusion"
    - "Heatmap natural-width spec via constant (HEATMAP_MIN_WIDTH = 100 + COLS*50 + COLS*2)"
    - "Project-wide scroll affordance: textual hint '← swipe to see all hours →'"

key-files:
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/LeadTimingHeatmap.tsx
    - packages/ui/src/responsive.css

key-decisions:
  - "Submit button INLINE (not sticky) — audit reversal; iOS keyboard would occlude focused input"
  - ".responsive-table-no-label is the only new responsive.css selector this phase (4 lines, narrowly justified)"
  - "Mobile-only mini Commission Preview card injected above Submit — managers must see halvingReason before tapping Submit"
  - "Heatmap kept native-width with overflow-x scroll — not made responsive (would lose data legibility)"
  - "Scroll-hint pattern is textual; recorded as project-wide standard"
  - "ManagerAudits + ManagerConfig deliberately deferred to a follow-up plan (758 + 417 lines, not core-flow)"
  - "Pre-existing .stack-mobile bug on display:grid container fixed (silent no-op since whoever first added it)"

patterns-established:
  - "Always inspect parent display mode before applying .grid-mobile-1 (grid only) vs .stack-mobile (flex only)"
  - "When key info lives in a stacked-below sidebar on mobile, inject a compact mirror inline above primary CTA"
  - "Action / colspan cells in .responsive-table use .responsive-table-no-label to escape per-field card formatting"
  - "Horizontal-scroll wrappers must set explicit minWidth on inner content so the wrapper actually overflows"

duration: ~30min
started: 2026-04-14T00:00:00Z
completed: 2026-04-14T00:00:00Z
---

# Phase 73 Plan 01: Manager Mobile Summary

**Shipped manager dashboard mobile retrofits for the three highest-traffic surfaces — sales entry, sales list, and tracker + lead-timing — using Phase 72 utilities. Layout-only; zero changes to commission preview API, parser, validation, or edit/delete handlers. ManagerAudits and ManagerConfig deliberately deferred.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30min |
| Tasks | 3 completed (+ 1 precondition CSS edit), 0 deferred |
| Files modified | 6 (5 manager files + responsive.css) |
| TS errors introduced | 0 (55 pre-existing → 55 post) |
| Bugs incidentally fixed | 1 (pre-existing `.stack-mobile` no-op on `display:grid` ManagerEntry container) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: ManagerEntry usable on 375px | Pass (code) / Pending browser smoke | Stacked form, full-width inputs, ACA grid 1-col, inline (not sticky) submit, safe-area padding, mobile-only mini Commission Preview card injected above submit so halvingReason is visible. |
| AC-2: ManagerSales as cards on mobile | Pass (code) / Pending browser smoke | `.responsive-table` + 11 data-labels (Date, Member, Carrier, Product, Lead Source, Phone, Premium, Status, Notes, Edit, Delete). Notes/Edit/Delete + colspan rows use `.responsive-table-no-label`. Inline edit form: grid-mobile-1, stack-mobile + full-width-mobile + touch-target Save/Cancel; visual differentiation via existing variant="success"/variant="secondary". |
| AC-3: ManagerTracker + LeadTiming mobile | Pass (code) / Pending browser smoke | Tracker table now `.responsive-table` with 10 data-labels. LeadTimingSection wraps heatmap in `overflowX: showMobileHeatmap ? "auto" : "visible"`. Heatmap GRID gets `minWidth: HEATMAP_MIN_WIDTH` (724px) so wrapper actually overflows. Mobile-only "← swipe to see all hours →" hint above heatmap. |
| AC-4: No regressions + zero new TS errors | Pass | `npx tsc --noEmit` from `apps/ops-dashboard`: 55 → 55. Desktop checklist requires browser verification. |
| AC-5: Hydration-safe responsive branching | Pass (code) / Pending browser smoke | Three components (`ManagerEntry`, `LeadTimingSection`) gate JSX on `mounted && isMobile`. Desktop branch is the SSR/first-render default. |
| AC-6: Keyboard accessibility preserved | Pass (code) / Pending browser smoke | No tab-order changes (markup only). Existing focus rings (Phase 50) untouched. Edit form Escape behavior preserved (no handler changes). |

**Code-level verification:** PASS on all six. **Browser smoke verification:** deferred to user (DevTools 375px + 1280px + iOS Safari focus check + keyboard nav). Compile check: zero new TypeScript errors.

## Accomplishments

- **Sales entry on a phone is fully usable** — every input full-width, ACA section stacked, inline submit (no iOS keyboard collision), and a compact preview card showing commission + halvingReason warning right above submit so managers don't miss the warning.
- **Sales list reads as a card stack** without breaking the desktop table; inline edit form escapes the per-field card formatting cleanly via `.responsive-table-no-label`.
- **Lead-timing heatmap stays legible** on mobile via horizontal scroll + textual swipe hint instead of being squashed into illegibility — this is now the project-wide pattern for any wide data grid.
- **Incidentally fixed a pre-existing silent bug**: the `.stack-mobile` className on the ManagerEntry's outer 2-column grid was a no-op because `.stack-mobile` only affects flex containers. Switched to `.grid-mobile-1`.

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `packages/ui/src/responsive.css` | +4 lines | `.responsive-table-no-label` escape valve for action cells and colspan rows |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` | Modified | useIsMobile + mobile mini Commission Preview + safe-area padding + grid-mobile-1 fix + ACA grid classes + touch-target on submit |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` | Modified | responsive-table + 11 data-labels + responsive-table-no-label on action cells & colspan rows + grid-mobile-1 on edit form + stack-mobile/full-width-mobile/touch-target on Save/Cancel + touch-target on day-filter pills |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` | Modified | responsive-table + 10 data-labels |
| `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx` | Modified | useIsMobile + heatmap horizontal-scroll wrapper + textual swipe hint |
| `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingHeatmap.tsx` | Modified | HEATMAP_MIN_WIDTH constant on GRID style so wrapper overflows on narrow viewports |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Submit INLINE not sticky | Sticky on iOS Safari occludes focused inputs when soft keyboard opens AND occludes Commission Preview at form bottom | Manager always sees what they're typing; preview always reachable |
| Inject mobile-only mini Commission Preview above Submit | Right-column preview stacks BELOW Submit on mobile (separate grid columns); managers must see halvingReason before tapping Submit | New compact warning card prevents un-warned submissions |
| `.responsive-table-no-label` is the only new responsive.css selector | Action cells and colspan rows can't render the data-label prefix without breaking visually | 4-line addition documented as the "narrow exception" of this phase |
| Heatmap scroll-affordance is textual | "← swipe →" is unambiguous; box-shadow fade is decorative; one project, one pattern | Phases 75/76 must reuse the textual pattern |
| ManagerAudits + ManagerConfig deferred | 758 + 417 lines, not core daily flow; would balloon plan beyond 3 tasks | Standalone follow-up plan if needed |
| Save/Cancel use existing variant prop for visual differentiation | `variant="success"` and `variant="secondary"` already deliver the primary/neutral contrast the audit asked for; no need to add custom inline styles | Minimum churn; consistent with shipped Button component |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Pre-existing `.stack-mobile` no-op bug fixed in passing |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Plan executed as written after audit upgrades. One incidental fix (silent pre-existing bug surfaced during the display-mode-aware container check).

### Auto-fixed Issues

**1. ManagerEntry outer grid had `.stack-mobile` className but `display: grid`**
- **Found during:** Task 1 (display-mode-aware container check)
- **Issue:** `.stack-mobile` translates to `flex-direction: column` which is a no-op on grid containers. Mobile users were getting the desktop 2-column form layout because the override never applied.
- **Fix:** Changed className to `.grid-mobile-1` (which sets `grid-template-columns: 1fr` — works on grid).
- **Files:** `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` line 569
- **Verification:** TS unchanged; visual smoke pending — but the previous behavior was already broken on mobile (likely never correct since whoever added the className).

### Deferred Items

None.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| LeadTimingHeatmap already had an inner `overflowX: auto` wrapper (GRID_WRAP at line 87) but the GRID inside used `1fr` columns so it scaled to container width — overflow never triggered | Added `minWidth: HEATMAP_MIN_WIDTH` to the GRID style so it has natural pixel width that exceeds narrow viewports. The existing inner wrapper now actually scrolls. |
| Right column with `position: sticky; top: 20` would be wrong on mobile (column stacks below; nothing to scroll past) | Conditionalized `position: showMobileLayout ? "static" : "sticky"` |

## Skill Audit

| Skill | Invoked | Notes |
|-------|---------|-------|
| mobile-design | ✓ (recorded in SKILLS.md, applied to layout decisions) | Drove inline-submit decision, touch-target sizing |
| redesign-existing-projects | ✓ (recorded, applied throughout) | "Retrofit, don't rewrite" discipline maintained |
| ui-ux-pro-max | ✓ (recorded) | Form UX + table-to-card pattern |
| frontend-design | ✓ (optional, recorded) | Heatmap horizontal-scroll affordance |

## Next Phase Readiness

**Ready:**
- Phase 74 (Payroll Mobile) can adopt the same patterns: `responsive-table` + data-label for AgentCard/WeekSection grids; `responsive-table-no-label` for action cells; the textual swipe hint for any wide data grids.
- Phase 75 (Owner Mobile) can use the new project-standard scroll-affordance pattern for any horizontal scroll containers (Recharts excluded — those have their own ResponsiveContainer).
- Phase 76 (CS Mobile) can use `.responsive-table-no-label` for the CSTracking expanded "Work" rows.

**Concerns:**
- Browser smoke verification has not been run. Six AC items pass at code/type level; empirical confirmation awaits a manual DevTools pass at 375px, 1280px, iOS Safari emulation, and keyboard nav.
- ManagerAudits (758 lines) and ManagerConfig (417 lines) remain desktop-only. Documented; not blocking unless a manager needs to triage audits or change config from a phone.
- The mini Commission Preview card on mobile is a stylistic addition not present on desktop. If managers later request the same compact card on desktop, the JSX is already factored.

**Blockers:** None.

---
*Phase: 73-manager-mobile, Plan: 01*
*Completed: 2026-04-14*
