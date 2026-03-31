# Architecture Patterns

**Domain:** TV-readable sales board leaderboard (font scaling within existing layout)
**Researched:** 2026-03-31

## Current Architecture (Relevant Subset)

The sales board is a single-file page component (`apps/sales-board/app/page.tsx`, ~1240 lines) with two views:

```
SalesBoard (main)
  |-- Hero Header (title, stats bar, view toggle)
  |-- DailyView (podium cards + remaining agent columns)
  |-- WeeklyView (7-day breakdown table)
```

### Font Size Inventory (Current State)

Every font size in the sales board is hardcoded as a literal number in inline `style={{ fontSize: N }}` objects. There are no CSS classes, no shared font-size constants, and no references to the `typography.sizes` tokens from `@ops/ui`.

**DailyView -- Podium Cards (top 3 agents):**

| Element | Current Size | Location |
|---------|-------------|----------|
| Rank label ("1st Place") | 10px | PODIUM_CONFIG, line ~63 |
| Agent name (1st) | 17px | PODIUM_CONFIG.0.nameSize |
| Agent name (2nd) | 15px | PODIUM_CONFIG.1.nameSize |
| Agent name (3rd) | 14px | PODIUM_CONFIG.2.nameSize |
| Sales count (1st) | 36px | PODIUM_CONFIG.0.countSize |
| Sales count (2nd) | 28px | PODIUM_CONFIG.1.countSize |
| Sales count (3rd) | 26px | PODIUM_CONFIG.2.countSize |
| Premium | 12px | Line ~212 |

**DailyView -- Remaining Agents (4th+):**

| Element | Current Size | Location |
|---------|-------------|----------|
| Rank badge number | 11px | Line ~440 |
| Agent name | 14px | Line ~469 |
| Sales count | 28px | Line ~481 |
| Premium | 12px | Line ~492 |

**WeeklyView -- Table:**

| Element | Current Size | Location |
|---------|-------------|----------|
| Table header (TH) | 15px | TH constant, line ~543 |
| Agent name cell | 18px | Line ~607 |
| Rank badge | 11px | Line ~624 |
| Daily count | 20px | Line ~656 |
| Daily premium | 12px | Line ~668 |
| Empty dash | 14px | Line ~673 |
| Total column | 24px | Line ~686 |
| Premium column | 15px | Line ~701 |
| Team total label | 14px | Line ~719 |
| Team total daily count | 20px | Line ~740 |
| Team total daily premium | 12px | Line ~743 |
| Team total grand count | 28px | Line ~759 |
| Team total grand premium | 16px | Line ~770 |

**Stats Bar (header KPIs):**

| Element | Current Size | Location |
|---------|-------------|----------|
| KPI label | 11px | Lines ~1022, ~1070, ~1124, ~1174 |
| KPI value (sales count) | 30px | Lines ~1035, ~1135 |
| KPI value (premium, dynamic) | 22-26px | Lines ~1082, ~1186 |

**Other:**

| Element | Current Size | Location |
|---------|-------------|----------|
| Page title "Sales Board" | 36px | Line ~917 |
| "Top Performers" label | 11px | Line ~326 |
| "All Agents" label | 11px | Line ~389 |
| Day/Week toggle buttons | 12px | Line ~348 |
| Countdown timer | 11px | Lines ~974, ~980 |

### Existing Design Token System

The `@ops/ui` package (`packages/ui/src/tokens.ts`) already has a `typography.sizes` scale:

```
xs: 11px, sm: 13px, base: 14px, md: 16px, lg: 18px,
xl: 22px, 2xl: 28px, 3xl: 36px, display: 48px
```

**The sales board does NOT use `typography.sizes`.** Every font size is a raw number literal. This is consistent with the rest of the codebase pattern -- the ops-dashboard uses `typography.sizes` in some places but the sales board was built with raw values.

### Cell Dimension Inventory

The constraint is: cell dimensions must NOT change. Larger fonts must use existing whitespace.

**WeeklyView table cells:**
- Table header (TH): `padding: 14px 16px`
- Agent name cell: `padding: 14px 20px` (uses `spacing[5]` = 20)
- Daily cells: `padding: 14px 16px`
- Total cell: `padding: 14px 16px`
- Premium cell: `padding: 14px 20px`
- Team total row: `padding: 16px 16px` or `16px 20px`

**DailyView agent columns:**
- Rank badge: 26x26px
- Column padding: `16px 8px 20px` (top/sides/bottom)
- `flex: 1` with `maxWidth: 200` per agent
- `minHeight: 120` on the column body

**Podium cards:**
- 1st: 200px wide x 220px tall
- 2nd: 175px wide x 180px tall
- 3rd: 165px wide x 160px tall
- Padding: `20px 16px`

## Recommended Architecture for TV Readability

### Approach: Inline Font Size Increases with No New Abstraction Layer

**Decision:** Increase font sizes directly in the existing inline style literals. Do NOT extract to new token constants or create a scaling system.

**Rationale:**
1. The milestone scope is narrow -- increase readability, keep cell dimensions unchanged
2. The sales board is a single standalone file with no shared font-size dependencies
3. Adding a token layer for one component would be over-engineering
4. The existing `typography.sizes` scale does not cover TV-optimized sizes (would need new entries like `tvLg`, `tvXl`, etc.) which pollutes the shared design system for a single consumer
5. The values only need to change once, not dynamically

### Integration Points

All changes occur in a single file: `apps/sales-board/app/page.tsx`.

**No new files. No new tokens. No new components. No API changes. No package changes.**

| Integration Point | What Changes | Type |
|-------------------|-------------|------|
| PODIUM_CONFIG constant (lines 52-95) | Increase `nameSize` and `countSize` values | MODIFY literal values |
| PodiumCard premium line (line 212) | Increase fontSize from 12 | MODIFY literal |
| Remaining agent columns (lines 469, 481, 492) | Increase name, count, premium sizes | MODIFY literals |
| WeeklyView TH constant (line 543) | Increase fontSize from 15 | MODIFY literal |
| WeeklyView agent name cell (line 607) | Increase fontSize from 18 | MODIFY literal |
| WeeklyView daily count (line 656) | Increase fontSize from 20 | MODIFY literal |
| WeeklyView daily premium (line 668) | Increase fontSize from 12 | MODIFY literal |
| WeeklyView total column (line 686) | Increase fontSize from 24 | MODIFY literal |
| WeeklyView premium column (line 701) | Increase fontSize from 15 | MODIFY literal |
| WeeklyView team total cells (lines 719-770) | Increase team total font sizes | MODIFY literals |
| Stats bar KPI values (lines 1035, 1082, 1135, 1186) | Increase KPI value sizes | MODIFY literals |

### Suggested Font Size Targets

Based on TV viewing at 10-15 feet on a 1080p 50-65 inch display:

| Element | Current | Target | Headroom in Cell |
|---------|---------|--------|-----------------|
| **WeeklyView** | | | |
| Agent name | 18px | 22px | 14px padding each side = plenty |
| Daily sale count | 20px | 26px | 14px vert padding absorbs this |
| Daily premium | 12px | 16px | Currently tiny, still fits easily |
| Total column | 24px | 32px | Same cell width, bold number only |
| Premium column | 15px | 20px | Right-aligned, fits in padding |
| Team total label | 14px | 18px | "Team Total" text, left cell |
| Team total counts | 20px/28px | 26px/36px | Same cells as data rows |
| Team total premiums | 12px/16px | 16px/22px | Same cells as data rows |
| Table header | 15px | 18px | Sticky header, uppercase letters |
| **DailyView** | | | |
| Podium name (1st) | 17px | 22px | 200px card width |
| Podium name (2nd) | 15px | 20px | 175px card width |
| Podium name (3rd) | 14px | 18px | 165px card width |
| Podium count (1st) | 36px | 44px | Ample vertical space |
| Podium count (2nd) | 28px | 36px | Ample vertical space |
| Podium count (3rd) | 26px | 32px | Ample vertical space |
| Podium premium | 12px | 16px | Below count, fits easily |
| Remaining agent name | 14px | 18px | flex column, word-break enabled |
| Remaining agent count | 28px | 36px | Center-aligned, single digits |
| Remaining agent premium | 12px | 16px | Below count |
| **Stats Bar** | | | |
| KPI label | 11px | 13px | Uppercase label, subtle increase |
| KPI value | 26-30px | 32-36px | Card-based, no overflow risk |

### Handling Variable Agent Counts (9-15 Agents)

This is the primary layout challenge. The board must remain single-screen (no scrolling) for wall-mounted TV display.

**DailyView (Leaderboard tab):**

Current behavior: Top 3 agents get podium cards (fixed width), remaining agents get `flex: 1` columns with `maxWidth: 200px`. This already scales because `flex: 1` distributes space evenly.

- **9 agents:** 3 podium + 6 flex columns = 6 columns sharing ~1200px = ~200px each (at maxWidth)
- **15 agents:** 3 podium + 12 flex columns = 12 columns sharing ~1200px = ~100px each

**Concern at 15 agents:** 100px per column with 18px agent names may truncate. Agent names are typically first names only (e.g., "Michael", "Jessica") which fit in ~80px at 18px font.

**Recommendation:** Keep existing `flex: 1` layout. The `word-break: break-word` on agent names (line 474) handles long names. At 15 agents, columns compress gracefully. No code change needed for the flex layout itself.

**WeeklyView (Table tab):**

Current behavior: 10-column table (Agent + 7 days + Total + Premium) with `minWidth: 760px` and `overflowX: auto`. Agent count determines row count, not column count.

- **9 agents:** 9 rows + 1 header + 1 team total = 11 rows
- **15 agents:** 15 rows + 1 header + 1 team total = 17 rows

**Concern at 15 agents:** At increased font sizes, row height will be ~50-54px (from current ~48px due to padding). 17 rows x 54px = 918px. A 1080p TV has ~980px usable height after browser chrome. This fits, but barely.

**Recommendation:** Do NOT increase row padding. The font size increase within existing `14px 16px` padding is sufficient. The extra whitespace will reduce slightly but rows remain readable. If needed, the `padding` on table cells could be reduced from `14px 16px` to `12px 14px` to gain back vertical space, but try without this first.

**Stats bar (header):**

The 4-card stats bar uses `gridTemplateColumns: repeat(4, 1fr)` with `gap: 12px`. This is responsive to container width and unaffected by agent count.

### Data Flow for Dynamic Sizing

No dynamic sizing is needed. The current layout already handles variable agent counts through:

1. **DailyView:** `flex: 1` columns auto-distribute width
2. **WeeklyView:** Table rows stack vertically, 1080p has room for 17 rows
3. **Stats bar:** CSS Grid `1fr` columns, agent-count independent

If a truly dynamic approach were ever needed (e.g., supporting 20+ agents), the only change would be reducing font sizes via a computed multiplier:

```typescript
const scaleFactor = agents.length <= 12 ? 1 : 12 / agents.length;
// Apply: fontSize: Math.round(baseSize * scaleFactor)
```

**This is NOT recommended for the current milestone.** The 9-15 agent range fits without dynamic scaling. Adding computed sizing introduces complexity for a problem that does not exist.

## Patterns to Follow

### Pattern 1: Increase Font Size, Preserve Padding

**What:** Change `fontSize` values in existing inline styles. Do not touch `padding`, `width`, `height`, `gap`, or `margin` values.

**When:** Every font size modification in this milestone.

**Why:** The milestone constraint says "cell dimensions unchanged -- use existing whitespace." Padding defines cell dimensions. Font size uses space within the cell. A 14px font in a cell with 14px top/bottom padding has 28px of vertical space to grow into.

### Pattern 2: PODIUM_CONFIG as the Single Source for Podium Sizes

**What:** All podium font sizes are defined in the `PODIUM_CONFIG` constant (lines 52-95). Change them there, not in the JSX.

**When:** Modifying podium card text sizes.

**Why:** The `PodiumCard` component reads from `cfg.nameSize` and `cfg.countSize`. Changing the config object is the correct integration point. Hardcoding sizes in the JSX would create conflicting sources.

### Pattern 3: Verify Changes at Both Breakpoints

**What:** After changing sizes, verify the board looks correct with both 9 agents and 15 agents.

**When:** Testing the changes.

**Why:** The flex layout and table both behave differently at these extremes. Font sizes that look great with 9 agents may overflow with 15.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding New Typography Tokens for This

**What:** Creating `typography.sizes.tvLg`, `tvXl`, etc. in `@ops/ui/tokens.ts`.

**Why bad:** The sales board is the only consumer. Adding TV-specific tokens to the shared design system pollutes it for all 4 apps. The tokens would be misleading ("tvLg" implies TV-only usage when they are just "bigger" sizes). The existing token scale already covers the target sizes (e.g., `xl: 22`, `2xl: 28`, `3xl: 36`).

**Instead:** Use raw number literals in the single page.tsx file, as the file already does.

### Anti-Pattern 2: CSS Media Queries or Container Queries

**What:** Adding `@media (min-width: 1920px)` rules or CSS files for TV-specific breakpoints.

**Why bad:** The project constraint is "inline React.CSSProperties -- no Tailwind, no CSS files." Media queries require CSS files or `<style>` tags. The sales board uses `100vh` and fills the screen regardless of resolution. A 1080p TV and a 1080p monitor render identically.

**Instead:** Increase the base font sizes so they read well on TV. The sizes should also look fine on a desktop monitor (the increase is moderate, not extreme).

### Anti-Pattern 3: Dynamic Font Scaling Based on Window Size

**What:** Using `window.innerHeight` or `ResizeObserver` to compute font sizes at runtime.

**Why bad:** Adds complexity, re-render cycles, and flash of unstyled text. The display target is known (1080p TV). The agent count range is known (9-15). Fixed sizes that work across this range are simpler and more reliable.

### Anti-Pattern 4: Reducing Padding to Make Room for Larger Fonts

**What:** Changing `padding: "14px 16px"` to `padding: "8px 12px"` to accommodate larger text.

**Why bad:** Violates the "cell dimensions unchanged" constraint. Padding defines the cell's visual breathing room. Smaller padding makes the table feel cramped even if cell outer dimensions are technically the same.

**Instead:** The current padding provides sufficient room. A jump from 20px to 26px font in a cell with 14px top + 14px bottom padding (48px total cell height) still has 22px of padding. This is fine.

## Component Boundaries

```
apps/sales-board/app/page.tsx (ONLY FILE MODIFIED)
  |
  |-- PODIUM_CONFIG constant       <-- increase nameSize, countSize
  |-- PodiumCard component         <-- increase premium fontSize
  |-- DailyView component          <-- increase remaining-agent font sizes
  |-- WeeklyView component         <-- increase TH, agent name, daily count,
  |                                    daily premium, totals, team total sizes
  |-- SalesBoard component         <-- increase stats bar KPI sizes
  |
  NO CHANGES:
  |-- packages/ui/src/tokens.ts    <-- leave typography.sizes unchanged
  |-- @ops/ui components           <-- no shared component changes
  |-- apps/ops-api/                <-- no API changes
  |-- Any other file               <-- single-file change set
```

## Files Modified vs Created

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `apps/sales-board/app/page.tsx` | MODIFY | ~30 fontSize value changes |

**Total: 1 file modified. 0 files created. Estimated ~30 line changes (number literal swaps).**

## Sources

- Direct code inspection of `apps/sales-board/app/page.tsx` (HIGH confidence)
- Direct code inspection of `packages/ui/src/tokens.ts` (HIGH confidence)
- Project requirements from `.planning/PROJECT.md` (HIGH confidence)
- TV readability standards: 1080p at 10-15 feet viewing distance, minimum ~18px effective for body text (MEDIUM confidence, based on general UX guidelines)
