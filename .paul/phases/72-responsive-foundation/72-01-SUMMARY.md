---
phase: 72-responsive-foundation
plan: 01
subsystem: ui
tags: [responsive, mobile, breakpoints, drawer, hydration, a11y, focus-trap, inline-css]

requires:
  - phase: 52-visual-consistency-pass
    provides: design tokens, responsive.css base utilities, touch-friendly sidebar

provides:
  - breakpoints + mediaQuery tokens (single source of truth shared between JS and CSS)
  - useBreakpoint / useIsMobile / useHasMounted hooks (SSR/hydration-safe)
  - MobileDrawer component (focus trap, scroll-lock correctness, reduced-motion, required ariaLabel)
  - Extended responsive.css utilities (.touch-target, .bottom-sheet-base, .mobile-text-*, .stack-mobile-md)
  - Dashboard nav hamburger+drawer on mobile (desktop hover-collapse preserved)
affects: [73-manager-mobile, 74-payroll-mobile, 75-owner-mobile, 76-cs-mobile]

tech-stack:
  added: []
  patterns:
    - "Hydration-safe JSX branching: hook returns { ..., mounted } and consumers gate on mounted === true"
    - "Dialog primitives: focus capture in ref on open, focus restoration on close, Tab-cycle trap"
    - "Scroll lock correctness: capture prior body.style.overflow in ref, restore exactly"
    - "Required-prop accessibility: ariaLabel enforced at the TypeScript type level"

key-files:
  created:
    - packages/ui/src/hooks/useBreakpoint.ts
    - packages/ui/src/hooks/index.ts
    - packages/ui/src/components/MobileDrawer.tsx
  modified:
    - packages/ui/src/tokens.ts
    - packages/ui/src/responsive.css
    - packages/ui/src/index.tsx
    - packages/ui/src/components/index.ts
    - apps/ops-dashboard/app/(dashboard)/layout.tsx

key-decisions:
  - "Breakpoint keys named mobileMax/tabletMin/tabletMax/desktopMin/wideMin (unambiguous max vs min)"
  - "ariaLabel is required (not optional) on MobileDrawer — every dialog must be named"
  - "No new runtime deps — focus trap, scroll lock, transitions implemented locally"
  - "Inline render (no portal) — z-index 1000 sufficient, consistent with ConfirmModal"
  - "viewport-fit=cover deliberately deferred; bottom-sheet is a progressive enhancement on notched iOS"

patterns-established:
  - "Responsive hooks MUST expose a `mounted` signal and be gated by consumers to avoid hydration mismatches"
  - "Dialog components MUST: capture prior-focus + prior-overflow in refs, restore both on close, trap Tab inside"
  - "Touch-target sizing is opt-in via className; consumers decide where 44×44 is needed"

duration: ~45min
started: 2026-04-14T00:00:00Z
completed: 2026-04-14T00:00:00Z
---

# Phase 72 Plan 01: Responsive Foundation Summary

**Shipped the mobile foundation for v3.0: unified breakpoint tokens, SSR/hydration-safe breakpoint hooks, an accessible MobileDrawer primitive, extended responsive CSS utilities, and a hamburger+drawer dashboard nav that preserves the existing desktop hover-collapse behavior.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~45min |
| Tasks | 3 completed, 0 deferred |
| Files modified | 8 (3 created, 5 modified) |
| TS errors introduced | 0 (55 pre-existing → 55 post) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Breakpoint tokens unified | Pass | `breakpoints.*Max/*Min` + `mediaQuery.*` exported; values match the @media rules in responsive.css. |
| AC-2: JS breakpoint detection SSR-safe AND hydration-safe | Pass (code) / Pending browser smoke | Hook returns `{ breakpoint, mounted }`; deterministic initial state (`desktop`/`false`); single `setState` flips both on mount; Safari < 14 addListener fallback included. Zero-hydration-warning verification awaits browser smoke. |
| AC-3: MobileDrawer primitive accessible & production-safe | Pass (code) / Pending browser smoke | ariaLabel required at type level; focus trap (Tab-cycle); focus restore to opener on close; scroll-lock captures prior value; prefers-reduced-motion respected; × close button with touch-target class. |
| AC-4: Dashboard nav usable on a phone and accessible | Pass (code) / Pending browser smoke | `showMobileNav = mounted && isMobile && tabs.length > 1`. Hamburger carries `aria-label`, `aria-expanded`, `aria-controls`, `touch-target`. Selecting a tab closes the drawer. Desktop block preserved byte-for-byte in the `!showMobileNav && tabs.length > 1` branch. |
| AC-5: Extended responsive utilities available | Pass | `.touch-target`, `.bottom-sheet-base`, `.mobile-text-base`, `.mobile-text-lg`, `.stack-mobile-md` present; existing selectors unchanged. |

**Code-level verification:** PASS on all five. **Browser smoke verification:** deferred to caller (manual DevTools pass). Compile check: zero new TypeScript errors across the monorepo.

## Accomplishments

- Unified breakpoint source of truth with deliberately unambiguous key names, eliminating an entire class of off-by-one bugs before Phases 73-76 consume the tokens.
- Shipped a mobile-safe, accessibility-compliant drawer primitive with zero new runtime dependencies and a type-enforced required label — future drawers cannot regress this.
- Refactored the dashboard nav with a hydration-safe branching pattern that preserves the shipped desktop hover-collapse behavior exactly (same block, same lines, gated only by a new condition).

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `packages/ui/src/tokens.ts` | Modified | Added `breakpoints` and `mediaQuery` exports |
| `packages/ui/src/responsive.css` | Modified | Added `.touch-target`, `.bottom-sheet-base`, `.mobile-text-base`, `.mobile-text-lg`, `.stack-mobile-md` |
| `packages/ui/src/index.tsx` | Modified | Re-exports `./hooks` |
| `packages/ui/src/hooks/useBreakpoint.ts` | Created | `useBreakpoint`, `useIsMobile`, `useHasMounted` + Breakpoint type |
| `packages/ui/src/hooks/index.ts` | Created | Barrel file for hooks |
| `packages/ui/src/components/MobileDrawer.tsx` | Created | Accessible slide-over / bottom-sheet with focus trap and scroll lock |
| `packages/ui/src/components/index.ts` | Modified | Barrel adds `MobileDrawer` + `MobileDrawerProps` |
| `apps/ops-dashboard/app/(dashboard)/layout.tsx` | Modified | Mobile branch using hamburger + MobileDrawer, gated on `mounted && isMobile` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Breakpoint keys use explicit `Max`/`Min` suffixes | Audit identified ambiguous `mobile: 767` vs `desktop: 1024` as off-by-one bait for 4 downstream phases | Phases 73-76 cannot misread semantics; type hints are self-documenting |
| `ariaLabel` required (not optional) on MobileDrawer | Every dialog MUST be named; optional props silently regress a11y | TypeScript compile blocks unnamed drawers across the codebase |
| Zero new runtime deps (no react-focus-lock, body-scroll-lock, framer-motion) | ~20 KB gzipped saved for functionality three useEffects can deliver | Keeps bundle weight flat; matches inline-CSSProperties ethos |
| No portal for MobileDrawer | Matches ConfirmModal precedent; z-index 1000 sufficient for current app structure | Simpler SSR, no portal-root plumbing |
| `viewport-fit=cover` deferred | Progressive enhancement for notched iOS only; bottom-sheet fully functional without it | iOS polish can be a follow-up addendum if requested |
| Single-role branch (`tabs.length <= 1`) unchanged | Out of mobile nav scope; retains current behavior on all viewports | No regression risk for single-role users |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** None. Plan executed as written after the enterprise audit upgrades were applied pre-APPLY.

### Deferred Items

None.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| No `tsconfig.json` in `packages/ui/` | Compiled the new files directly against `tsconfig.base.json` with explicit flags to confirm they type-check. No code change needed. |
| `npm run build -w @ops/ui` not applicable (source-only package, consumed via `transpilePackages`) | Replaced with direct `tsc --noEmit` against the new files + full `apps/ops-dashboard` tsc comparison (55 errors before → 55 after). |

## Skill Audit

| Skill | Invoked | Notes |
|-------|---------|-------|
| mobile-design | ✓ (discovered + recorded in SKILLS.md) | Informed drawer sizing, touch targets |
| redesign-existing-projects | ✓ (discovered + recorded) | Informed "preserve desktop verbatim" discipline |
| frontend-developer | ✓ (discovered + recorded) | Informed hook + component implementation |
| react-patterns | ✓ (optional; discovered + recorded) | Informed hydration-safe hook composition |

**Skill evolution (OpenSpace):** Not applicable — MCP server disconnected during phase; no delegated tasks.

## Next Phase Readiness

**Ready:**
- Phase 73 (Manager Mobile) can import `useIsMobile` / `MobileDrawer` / `breakpoints` / `mediaQuery` from `@ops/ui` directly.
- `.touch-target` and `.bottom-sheet-base` utility classes available for table→card transformations.
- Hamburger+drawer pattern established for any subsequent mobile nav-like UIs.

**Concerns:**
- Browser smoke verification (items 6-10 of the verification checklist) has not been run. The contracts are met at the code/type level and all hydration/focus/scroll-lock patterns are defensively implemented, but empirical proof awaits a DevTools pass.
- iOS notched-device bottom-sheet polish is degraded without `viewport-fit=cover`. Will become visible when Phase 76 adds the CS bottom-sheet on iPhone X+. Not blocking.
- No multi-drawer ESC stacking. If Phase 76 introduces a nested drawer/sheet, it must close the outer one first or extend this primitive.

**Blockers:** None.

---
*Phase: 72-responsive-foundation, Plan: 01*
*Completed: 2026-04-14*
