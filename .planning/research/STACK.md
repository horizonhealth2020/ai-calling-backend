# Technology Stack

**Project:** Sales Board TV Readability (v2.0)
**Researched:** 2026-03-31

## Recommendation: No New Dependencies

This milestone requires zero new libraries. The existing stack (Next.js 15, React, inline CSSProperties, Inter font via next/font/google) provides everything needed. The work is purely CSS font-size and layout tuning within the existing pattern.

## Current Font Size Inventory

Understanding what exists is critical before changing anything. All values are in `px` (hardcoded integers in inline styles).

### Weekly View (table layout -- primary TV view)

| Element | Current Size | Location |
|---------|-------------|----------|
| Table header (day labels) | 15px | `TH` style object, line 542 |
| Agent name | 18px | Agent name `<td>`, line 606 |
| Rank badge number | 11px | Rank `<span>`, line 623 |
| Daily cell count | 20px | Sale count per day, line 656 |
| Daily cell premium | 12px | Premium per day, line 668 |
| Empty cell dash | 14px | `&mdash;` placeholder, line 673 |
| Agent total count | 24px | Weekly total column, line 685 |
| Agent total premium | 15px | Premium total, line 702 |
| Team Total label | 14px | Footer row label, line 719 |
| Team Total daily count | 20px | Footer daily counts, line 740 |
| Team Total daily premium | 12px | Footer daily premiums, line 743 |
| Team Total grand count | 28px | Grand total number, line 758 |
| Team Total grand premium | 16px | Grand total premium, line 771 |

### Daily View (podium + columns)

| Element | Current Size | Location |
|---------|-------------|----------|
| 1st place name | 17px | `PODIUM_CONFIG[0].nameSize`, line 61 |
| 1st place count | 36px | `PODIUM_CONFIG[0].countSize`, line 62 |
| 2nd place name | 15px | `PODIUM_CONFIG[1].nameSize`, line 75 |
| 2nd place count | 28px | `PODIUM_CONFIG[1].countSize`, line 76 |
| 3rd place name | 14px | `PODIUM_CONFIG[2].nameSize`, line 89 |
| 3rd place count | 26px | `PODIUM_CONFIG[2].countSize`, line 90 |
| Podium premium | 12px | Below count, line 212 |
| Remaining agent name | 14px | Column name, line 469 |
| Remaining agent count | 28px | Column count, line 481 |
| Remaining agent premium | 12px | Column premium, line 492 |
| Rank badge number | 11px | Rank circle, line 440 |

### Header / Stats Bar

| Element | Current Size | Location |
|---------|-------------|----------|
| "Sales Board" title | 36px | `<h1>`, line 917 |
| Stats card label | 11px | "TODAY'S SALES" etc., lines 1022/1070/1122/1174 |
| Stats card value | 20-30px | Varies by data magnitude, lines 1034/1082/1134/1186 |

## Techniques for TV-Distance Readability

### Use Static `px` Values (Not `clamp()` or `vw`)

**Recommendation: Keep using hardcoded `px` values. Do NOT introduce `clamp()`, `vw`, or responsive font techniques.**

**Why:**
1. The sales board runs on a single known display: a wall-mounted TV, typically 1080p (1920x1080). The viewport does not change.
2. `clamp()` and viewport units solve a problem that does not exist here -- adapting to unknown screen sizes. A TV is a fixed target.
3. CSS `clamp()` cannot be expressed as a React `CSSProperties` `fontSize` number -- it requires a string value like `"clamp(18px, 2vw, 28px)"`. This would break the existing pattern of `fontSize: 18` (number) and create inconsistency across the codebase.
4. Viewport units (`2vw` = ~38px on 1920px wide) are harder to reason about than explicit pixel values when the target resolution is known.

**Bottom line:** When you know the screen, pick the right number. `fontSize: 24` is clearer than `fontSize: "clamp(18px, 1.25vw, 24px)"` and produces identical results on the target TV.

### Font Size Scaling Strategy

For a 1080p TV viewed from 10-15 feet (typical sales floor):

| Readability Tier | Minimum Size | Purpose |
|-----------------|-------------|---------|
| Glanceable numbers | 28-36px | Sale counts, totals -- the numbers agents care about most |
| Key labels | 20-24px | Agent names, day headers, premium amounts |
| Supporting text | 14-16px | Section labels, secondary metrics |
| Decorative/metadata | 11-12px | Rank labels, timestamps -- fine to stay small |

**Confidence:** MEDIUM -- based on TV typography best practices (minimum 24px for body text at 10ft viewing distance on 1080p). The exact sweet spots will need real-world testing on the actual TV.

### Font Weight as a Readability Multiplier

The codebase already uses `fontWeight: 800` for key numbers. This is correct. Bold text is more legible at distance than increasing font size alone. The Inter font (already loaded via `next/font/google`) renders well at heavy weights.

**Key insight:** Going from 700 to 800 weight on a number gains more perceived readability than adding 2px of font size, at no layout cost.

### Letter Spacing for Large Numbers

Current: `letterSpacing: "-0.03em"` on large counts. This tight tracking works well for display-size numbers and should be preserved. At large sizes, negative letter spacing prevents numbers from looking spaced-out.

### Row Cell Padding Constraints

The milestone requirement states "cell dimensions unchanged -- use existing whitespace, not bigger rows." Current cell padding is `14px 16px`. The existing whitespace within cells can absorb larger font sizes because:

- Agent name cells have `whiteSpace: "nowrap"` and adequate horizontal padding (`14px + spacing[5]px`)
- Daily cells center-align content with `16px` horizontal padding
- The table has `minWidth: 760` which is far below 1920px, leaving generous horizontal space

Increasing fonts within cells will consume vertical whitespace but the current `14px` top/bottom padding provides buffer.

## What NOT to Add

| Library/Technique | Why Skip It |
|-------------------|-------------|
| `clamp()` / CSS functions | Fixed viewport; adds string-type fontSize breaking numeric pattern |
| Viewport units (`vw`, `vh`) | Harder to reason about than explicit px for known screen |
| `@media` queries | Single target resolution; no breakpoints needed |
| CSS Container Queries | Overkill for static TV layout |
| `react-responsive` / `react-use` | Zero benefit over hardcoded values for single-screen target |
| Custom font (e.g., `Roboto Mono`) | Inter at weight 800 is excellent for numbers; monospace not needed |
| `fitty` / `textFit` libraries | Auto-sizing libraries solve dynamic content; agent counts are 1-3 digits |
| CSS Grid `auto-fit`/`auto-fill` | The table already handles column distribution; podium uses flex |

## What to Change (Implementation Guidance)

### Approach: Bump Static Values

Create a font size constant object at the top of `page.tsx` to centralize TV-optimized values:

```typescript
const TV = {
  // Weekly table
  tableHeader: 18,      // was 15
  agentName: 22,        // was 18
  dailyCount: 24,       // was 20
  dailyPremium: 15,     // was 12
  totalCount: 30,       // was 24
  totalPremium: 20,     // was 15
  teamLabel: 18,        // was 14
  teamDailyCount: 24,   // was 20
  teamDailyPremium: 15, // was 12
  teamGrandCount: 34,   // was 28
  teamGrandPremium: 20, // was 16

  // Daily podium
  podium1Name: 22,      // was 17
  podium1Count: 42,     // was 36
  podium2Name: 19,      // was 15
  podium2Count: 34,     // was 28
  podium3Name: 17,      // was 14
  podium3Count: 30,     // was 26
  podiumPremium: 15,    // was 12

  // Remaining agents
  restName: 18,         // was 14
  restCount: 34,        // was 28
  restPremium: 15,      // was 12
} as const;
```

This keeps the inline CSSProperties pattern (`fontSize: TV.agentName`) while making all TV-optimized values discoverable and tunable in one place.

### Agent Count Scaling (9-15 agents)

The weekly table handles variable agent counts naturally -- rows stack vertically with no overflow concern at 9-15 rows on a 1080px tall screen (each row ~50-60px = 450-900px total, well within budget with header/footer).

The daily view's "remaining agents" section uses `flex: 1` columns with `minWidth: 0` and `maxWidth: 200`. For 6-12 remaining agents (after top 3 podium), this distributes evenly across 1920px width. No changes needed to the flex layout -- just the font sizes within columns.

## Integration with Existing Patterns

All changes stay within the existing pattern:

- **Inline `React.CSSProperties`** -- fontSize remains a number, not a string
- **Constant objects** -- the `TV` constant follows the existing `TH`, `PODIUM_CONFIG` pattern
- **No CSS files** -- no `@media`, no `clamp()`, no global styles
- **No new imports** -- zero new dependencies
- **Inter font** -- already loaded, already used at weight 800

## Sources

- Direct analysis of `apps/sales-board/app/page.tsx` (current font sizes, layout structure, styling patterns)
- Direct analysis of `apps/sales-board/app/layout.tsx` (Inter font, ThemeProvider)
- TV typography guidelines: 24px minimum for body text at 10ft on 1080p (MEDIUM confidence -- general industry guidance, not verified against a specific standard)
- CSS `clamp()` incompatibility with `React.CSSProperties` number type: verified via TypeScript type definition (`fontSize` accepts `number | string`, but project convention is numbers only)
