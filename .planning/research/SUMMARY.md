# Project Research Summary

**Project:** Sales Board TV Readability (v2.0)
**Domain:** TV-mounted sales leaderboard — font scaling and contrast optimization within an existing Next.js dashboard
**Researched:** 2026-03-31
**Confidence:** HIGH

## Executive Summary

This milestone is a narrow, focused improvement to an existing working product. The sales board at `apps/sales-board/app/page.tsx` already delivers the core functionality; the v2.0 goal is to make it legible from across a sales floor on a wall-mounted TV. Research across all four domains converges on the same recommendation: increase font sizes using hardcoded `px` values within the existing inline `React.CSSProperties` pattern, bump low-contrast secondary text one tier up the color scale, and validate against 15 agents at 1080p before shipping. No new dependencies, no new files, no architectural changes.

The recommended approach treats this as a surgical pass on a single file. All ~30 font-size literals in `apps/sales-board/app/page.tsx` need to increase by 20-40%, following a TV-readability tier system: glanceable numbers (sale counts, totals) at 30-42px, key labels (agent names, headers) at 20-26px, and supporting text (premiums, section labels) at 16-20px. Font weight (already 800 on key numbers) and negative letter-spacing (already applied to large counts) should be preserved — they contribute more to readability than raw size alone. Dollar amounts should drop cents and use `fmt$whole` consistently across both views.

The primary risk is cell height overflow with 15 agents at 1080p: increasing font sizes also increases computed row height, which can push the team total row off-screen. The pixel budget analysis shows 741px available for 15 agent rows — approximately 49px per row — which is tight but workable if vertical padding is reduced from 14px to 11-12px per side to compensate for larger type. The secondary risk is contrast failure on actual TVs: colors passing WCAG AA on a backlit monitor can wash out on a consumer TV in a bright office. Both risks must be addressed in Phase 1, not deferred.

## Key Findings

### Recommended Stack

No new technologies are needed. The existing stack (Next.js 15, React, Inter font via `next/font/google`, inline `React.CSSProperties`) is entirely sufficient for this milestone. The Inter font at weight 800 renders well at display sizes, and the project's numeric `fontSize` convention (e.g., `fontSize: 18`) should be preserved — introducing CSS string values like `clamp()` would break this convention and solve a problem that does not exist on a single known-resolution display.

**Core technologies:**
- **React inline CSSProperties (existing):** All font size changes stay as numeric literals — keeps consistency with the 1,240-line file convention and avoids introducing string-typed fontSize values
- **Next.js 15 (existing):** No config changes needed; the sales board is already a standalone Next.js app
- **Inter at weight 800 (already loaded):** Renders well at display sizes; negative letter-spacing already applied to large counts should be preserved
- **`fmt$whole` helper (existing):** Whole-dollar formatting already exists — consistency pass only, no new helper needed

### Expected Features

Research confirmed all table-stakes items are low-complexity changes to existing inline styles. The highest-value differentiators (auto-scaling by agent count, podium card enlargement) should be deferred until base font sizes are validated on a real TV.

**Must have (table stakes — v2.0):**
- Enlarged table fonts in WeeklyView (agent names to ~22px, daily counts to ~26px, premiums to ~16px, totals to ~32px) — currently 12-24px range
- Enlarged KPI card numbers in stats bar (32-36px) — currently 26-30px
- Enlarged team total row (grand total to 36px) — currently 14-28px; this is the most-glanced row
- Minimum fontWeight 700 on all data-bearing text — currently some premium sub-text uses weight 600
- Contrast promotion for secondary/tertiary text — promote `textTertiary` to `textSecondary` for anything a manager reads from 3+ meters
- `fmt$whole` consistency across both WeeklyView and DailyView — suppress "$0" for zero-premium agents

**Should have (competitive — v2.x, after TV validation):**
- Auto-scaling font sizes based on agent count using `Math.max(MIN, BASE - (count - 9) * STEP)` pattern
- Podium card size increase in DailyView (~1.5x nameSize and countSize) for dramatic leaderboard impact

**Defer (v3+):**
- TV-specific URL parameter (`?tv=1`) to toggle between TV and desktop sizing — only if the board must serve both contexts simultaneously
- Configurable default view persistence — only if offices disagree on weekly vs. daily default
- Abbreviated K/M suffixes — only if full dollar amounts remain noisy after the font increase

### Architecture Approach

All changes land in a single file: `apps/sales-board/app/page.tsx`. No shared package changes, no API changes, no new components. The correct integration points are: `PODIUM_CONFIG` constant for podium nameSize and countSize values, direct literal changes for WeeklyView and stats bar elements, and the `PodiumCard` component's inline premium fontSize. A centralized `TV` constant object at the top of the file (following the existing `TH`, `PODIUM_CONFIG` pattern) is recommended as an optional organizational improvement but is not required for correctness.

**Major components (all within `page.tsx`):**
1. `PODIUM_CONFIG` constant — entry point for podium nameSize and countSize; change values here, not in JSX downstream
2. `WeeklyView` component — ~12 font-size literals across TH, agent name cells, daily count/premium cells, total column, team total row
3. `SalesBoard` / stats bar — 4 KPI card value sizes (labels can stay small at 11-13px)

### Critical Pitfalls

1. **Cell height overflow at 15 agents** — Increasing fontSize raises computed row height. At 17 rows in ~741px of available space, each row gets ~49px. Reduce vertical padding from `14px` to `11-12px` per side as font sizes grow. Verify with exactly 15 agents that no vertical scrollbar appears and the team total row stays visible.

2. **Dark theme contrast fails on actual TV** — `textTertiary: #64748b` on `#070a0a` passes WCAG AA on a monitor but can become invisible on a consumer TV in ambient office light. Promote all content text at least one tier: `textTertiary` → `textSecondary`, `textMuted` → `textTertiary`. Nothing readable on a TV should use `colors.textMuted` or `colors.borderStrong`.

3. **Agent name truncation with larger fonts** — Agent names use `whiteSpace: "nowrap"`. At 22-24px, long names like "Christopher Rodriguez" overflow the agent column and trigger the table's `overflowX: auto` scrollbar — unusable on a wall TV. Add `overflow: hidden`, `textOverflow: "ellipsis"`, and a `maxWidth` on agent name cells before shipping.

4. **Podium vertical overflow on DailyView** — The podium cards (160-220px tall) plus the "All Agents" section below may exceed 1080px. If DailyView is a TV target, card heights must be compressed by 30-40%. The milestone spec focuses on the weekly table, so this may be out of Phase 1 scope — confirm with stakeholders.

5. **`$0` visual noise at large font sizes** — Promoting `fmt$whole` output to 16-18px makes large "$0" prominent for zero-sales agents. Suppress to a dash or empty string for the zero case to prevent visual clutter drawing the eye to inactive agents.

## Implications for Roadmap

The work naturally separates into two phases: a core readability pass (all table-stakes features + critical pitfall prevention) followed by a polish/validation pass after real-world TV testing.

### Phase 1: Core TV Readability

**Rationale:** All table-stakes features and all critical pitfalls must ship atomically. Increasing font sizes without simultaneously fixing row height budget, contrast, name truncation, and dollar formatting leaves the board in a broken intermediate state — improved in some conditions, broken in others (15 agents, long names, bright room).

**Delivers:** A production-ready TV-readable sales board at 1080p for 9-15 agents, using the weekly table as the primary TV view.

**Addresses:**
- Enlarged WeeklyView table fonts (agent names to ~22px, daily counts to ~26px, premiums to ~16px, totals to ~32px)
- Enlarged KPI card numbers (32-36px) in stats bar
- Enlarged team total row (grand total to 36px)
- Font weight minimum 700 on all data text
- Contrast promotion (textTertiary to textSecondary for readable content)
- `fmt$whole` consistency + suppress "$0" for zero-premium agents
- Day/week toggle buttons and section labels enlarged for TV readability

**Avoids:**
- Cell height overflow — reduce vertical padding 14px → 11-12px while increasing font
- Contrast failure on TV — promote all readable text one color tier
- Agent name overflow — add textOverflow ellipsis + maxWidth to agent name cells
- Dollar format noise — suppress zero-premium agents to dash

**Research flag:** No additional research needed. All patterns are well-documented, scope is a single file, implementation path is unambiguous. Execute directly.

### Phase 2: Polish and TV Validation

**Rationale:** After Phase 1 ships and is tested on an actual office TV, real-world feedback will reveal whether podium view needs work, whether agent counts cause overflow at extremes, and whether animation duration needs tuning. These cannot be validated without the Phase 1 baseline.

**Delivers:** A refined TV experience with dynamic agent count scaling, enlarged podium cards for DailyView, and animation behavior appropriate for peripheral display.

**Addresses:**
- Auto-scaling font sizes based on agent count (P2 feature)
- Podium card size increase in DailyView (P2 feature)
- AnimatedNumber duration reduction for TV (under 200ms, or switch to static + background pulse)
- DailyView podium vertical fit at 1080p (if DailyView is confirmed as TV-facing view)

**Avoids:**
- AnimatedNumber jitter causing distraction during active sales periods
- Fixed pixel resolution fragility if TVs vary (consider clamp() post-validation if 4K TVs are in use)

**Research flag:** Podium resizing requires a brief layout analysis before implementation — the 3-card fixed-width geometry (165/175/200px) is the most resolution-sensitive part of the layout. Verify cards + remaining-agents flex section fit at 1920px with increased widths before committing to specific values.

### Phase Ordering Rationale

- Phase 1 before Phase 2 because: auto-scaling fonts depend on establishing correct base sizes; podium work is isolated to DailyView and does not affect the weekly table; animation tuning is non-blocking polish that requires watching the board during live sales activity.
- All Phase 1 items must ship atomically: font sizes, padding adjustments, contrast promotion, and text overflow handling are co-dependent — partial application creates a broken intermediate state.
- DailyView (podium) work is intentionally deferred: the milestone spec targets the weekly breakdown table, and podium geometry is more complex to change without overflow risks across agent counts.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (podium resizing):** Podium card geometry involves fixed pixel widths for 3 side-by-side cards at 1920px. Resizing requires verifying the 3-card layout still fits with increased widths and that the "All Agents" flex section below remains usable. A brief layout analysis before implementation is warranted.

Phases with standard patterns (skip research-phase):
- **Phase 1 (font size + contrast pass):** Entirely within established inline CSSProperties pattern. Target values are documented in STACK.md. Implementation is mechanical number substitution with one layout constraint (row height budget). No research needed — execute directly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase analysis; no new dependencies means zero uncertainty about library compatibility or version conflicts |
| Features | HIGH | Features are well-scoped to CSS property changes; priority tiers based on multiple corroborating industry sources (Klipfolio, Spinify, Android TV guidelines) |
| Architecture | HIGH | Single-file change set confirmed by direct code inspection; component boundaries are unambiguous; integration points explicitly identified |
| Pitfalls | HIGH | Primary pitfalls derived from direct pixel budget calculation (not estimation) and confirmed color token analysis against known hex values |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact padding reduction values:** Research recommends reducing vertical padding from 14px to 11-12px, but the precise amount depends on the font sizes chosen. Implementation must measure actual rendered row height at chosen sizes and adjust padding to stay within the ~49px row budget. This is a test-and-adjust step during Phase 1, not a pre-calculable value.
- **DailyView as TV target:** Research is ambiguous on whether DailyView (podium + remaining agents) is expected to fit on a TV. The milestone spec focuses on weekly table readability. If the office uses DailyView on the TV, Phase 1 scope expands significantly. Confirm with stakeholders before starting Phase 1 implementation.
- **Actual TV hardware:** Research assumes a 50-65 inch 1080p TV at 10-15 feet. If the specific TV is smaller (40 inch) or the room is deeper, font size targets may need upward adjustment. Verify Phase 1 output on the actual hardware before declaring done.

## Sources

### Primary (HIGH confidence)
- `apps/sales-board/app/page.tsx` — direct code audit; all font sizes, padding values, layout structure, ~1,240 lines inspected
- `packages/ui/src/tokens.ts` — color token values, typography scale
- `packages/ui/src/theme.css` — CSS custom properties, actual hex values for contrast analysis
- `.planning/PROJECT.md` — milestone requirements and constraints

### Secondary (MEDIUM confidence)
- [Klipfolio: Best Practices for Displaying Dashboards on Large Screens](https://www.klipfolio.com/resources/articles/best-practices-large-screen-wallboard-tv-dashboard) — abbreviate numbers, design for glancing, avoid data density
- [DigitalSignage.com: Typography & Viewing Distance Guide](https://digitalsignage.com/digital_signage/docs/guides/typography-viewing-distance/) — font size formulas by viewing distance
- [Pascal Potvin: Designing a 10ft UI](https://pascalpotvin.medium.com/designing-a-10ft-ui-ae2ca0da08b7) — 24px minimum body text at 10ft on 1080p
- [Android TV Style Guide](https://spot.pcc.edu/~mgoodman/developer.android.com/preview/tv/design/style.html) — 28px minimum on 1080p display
- [Spinify: Sales Leaderboard Best Practices](https://spinify.com/blog/top-10-sales-leaderboard-best-practices/) — motivation through visibility, avoid ranking-based public shaming
- [Ambition: Wallboards and Leaderboards Best Practices](https://ambition.com/blog/entry/2017-09-26-how-use-wallboards-and-leaderboards-close-out-year-strong/) — keep metrics simple, multiple recognition opportunities
- [RiseVision: Digital Signage Best Practices](https://www.risevision.com/blog/digital-signage-best-practices) — sans-serif bold, limit text density, test at distance

### Tertiary (LOW confidence)
- General TV contrast research — consumer TV panels have lower native contrast than IPS monitors; ambient light worsens perceived contrast; specific contrast degradation values vary by TV model and cannot be precisely predicted without testing on target hardware

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
