# Phase 33: Core TV Readability - Research

**Researched:** 2026-03-31
**Domain:** CSS typography and layout tuning for TV-distance readability in a React inline-style codebase
**Confidence:** HIGH

## Summary

This phase is a surgical CSS-only pass on a single file (`apps/sales-board/app/page.tsx`). Every change is a numeric literal substitution in inline `React.CSSProperties` objects -- no new files, no new dependencies, no API changes, no component restructuring. The user has provided exact font size targets for every element, making this a mechanical implementation with one critical constraint: cell dimensions must not grow, so padding must decrease to absorb larger fonts.

The entire scope is constrained to three visual regions within `page.tsx`: (1) the WeeklyView table (lines ~539-783) covering headers, agent name cells, daily count/premium cells, total column, premium column, and team total row; (2) the KPI stats bar (lines ~987-1200) covering 4 stat cards with labels and numbers; and (3) the gap between the stats bar and the TabNav view toggle. The TabNav component lives in `packages/ui/src/components/TabNav.tsx` but is NOT being modified -- only the margin/gap around it changes.

**Primary recommendation:** Apply the user's exact font size targets (D-01 through D-15) as literal number changes, reduce vertical padding proportionally to maintain cell height, promote all `colors.textTertiary` references to `colors.textSecondary`, and add text-overflow ellipsis as a safety net on agent name cells.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Uniform 24px for: agent names (weekly table), daily sale count, weekly total premium, team total daily count, team total grand premium
- **D-02:** Daily premium per cell: 12px to 14px (+2px)
- **D-03:** Team total daily premium: 12px to 14px (+2px)
- **D-04:** Weekly TOTAL sales column stays at 24px (already at target)
- **D-05:** Team total grand total stays at 28px (already prominent)
- **D-06:** Table headers: 15px to 18px (proportional bump)
- **D-07:** Card labels: 11px to 14px
- **D-08:** Card numbers: 30px to 36px (premium conditional sizing scales proportionally)
- **D-09:** Reduce card internal padding so card dimensions stay the same
- **D-10:** Reduce spacing between cards and the leaderboard/weekly breakdown tab toggles
- **D-11:** Promote all textTertiary usage to textSecondary -- one tier brighter for TV visibility in lit office
- **D-12:** Agents always use first names only -- this is the existing convention
- **D-13:** If a long first name exceeds column width, truncate with ellipsis as safety net (text-overflow: ellipsis, overflow: hidden)
- **D-14:** Reduce cell vertical padding from 14px to ~11-12px to compensate for larger fonts -- cell dimensions must stay visually consistent
- **D-15:** Team total row padding adjusts proportionally

### Claude's Discretion
- Exact padding reduction values -- tune to keep cells the same visual size
- Table header font bump (18px suggested, Claude can adjust)
- Premium conditional sizing thresholds on KPI cards (currently 10000 threshold may need adjustment at 36px base)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TYPO-01 | All data elements on weekly breakdown table have font sizes increased for TV-distance readability | D-01, D-02, D-04: exact px targets for agent names (18->24), daily counts (20->24), daily premiums (12->14), total column (stays 24), premium column (15->24) |
| TYPO-03 | Team total row font sizes increased proportionally | D-01, D-03, D-05: team total daily count (20->24), daily premium (12->14), grand total (stays 28), grand premium (16->24) |
| TYPO-04 | KPI stat cards at top have font sizes increased for TV distance | D-07, D-08: labels (11->14), numbers (30->36), conditional sizing scales proportionally |
| TYPO-05 | Secondary text colors promoted one contrast tier for TV visibility | D-11: all textTertiary -> textSecondary; identified 2 instances in WeeklyView (daily premium text color) |
| OVFL-01 | Long agent names don't cause horizontal scrolling at increased font sizes | D-12, D-13: first-name convention + ellipsis safety net with overflow:hidden, text-overflow:ellipsis |
| OVFL-02 | Large premium values don't overflow cells at increased font sizes | D-14: padding reduction absorbs larger font; premium cells already use whiteSpace:"nowrap" and fmt$whole (no cents) |
| SCAL-04 | Row padding adjusts to compensate for larger fonts -- cell dimensions stay consistent | D-14, D-15: reduce vertical padding from 14px to ~11-12px on agent rows, proportional adjustment on team total row |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (inline CSSProperties) | 18+ | All styling | Project convention -- no CSS files, no Tailwind |
| Next.js | 15 | App framework | Existing app, no config changes needed |
| Inter font (weight 700-800) | via next/font/google | Typography | Already loaded, renders well at display sizes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ops/ui` tokens | local package | `colors`, `spacing`, `radius` constants | Every style reference |
| `fmt$whole` helper | in page.tsx | Dollar formatting without cents | All premium displays |
| `AnimatedNumber` | in page.tsx | Animated number rendering | All numeric displays -- no changes needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded px values | `clamp()` for responsive scaling | User locked to 1080p target; clamp() requires string fontSize breaking numeric convention; defer to Phase 34 if needed |
| Manual padding tuning | CSS `line-height: 1` to control cell height | Line-height affects text rendering quality; padding gives more control |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/sales-board/app/page.tsx    # ALL changes land here (single file)
packages/ui/src/tokens.ts        # Reference only -- not modified
packages/ui/src/components/TabNav.tsx  # Reference only -- not modified
```

### Pattern 1: Font Size as Numeric Literal
**What:** All fontSize values are plain numbers (not strings), interpreted as px by React
**When to use:** Every font size change in this phase
**Example:**
```typescript
// Source: existing codebase convention
// CORRECT:
fontSize: 24,
// WRONG (breaks convention):
fontSize: "24px",
fontSize: "clamp(18px, 2vw, 28px)",
```

### Pattern 2: Padding Compensation
**What:** When increasing fontSize, reduce vertical padding to keep total cell height constant
**When to use:** Every cell where fontSize increases
**Example:**
```typescript
// Before: fontSize 18, padding 14px top+bottom = 18 + 28 = ~46px row
// After:  fontSize 24, padding 11px top+bottom = 24 + 22 = ~46px row
padding: "11px 16px",  // was "14px 16px"
```

### Pattern 3: Color Token Promotion
**What:** Replace `colors.textTertiary` with `colors.textSecondary` for TV-readable text
**When to use:** Any text that needs to be readable from 10-15 feet
**Example:**
```typescript
// Before:
color: colors.textTertiary  // #64748b -- too dim for TV
// After:
color: colors.textSecondary  // #94a3b8 -- readable from distance
```

### Pattern 4: Ellipsis Overflow Safety
**What:** Add overflow protection on text cells that could exceed their column width
**When to use:** Agent name cells at increased font sizes
**Example:**
```typescript
// Add to the <span> wrapping the agent name text
<span style={{
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 160,  // tune based on column budget
}}>
  {agent}
</span>
```

### Anti-Patterns to Avoid
- **Introducing CSS files or className-based styles:** The entire codebase uses inline CSSProperties. Do not create a .css file or use Tailwind classes.
- **Using string fontSize values:** The codebase convention is numeric (e.g., `fontSize: 24` not `fontSize: "24px"`). Strings would break pattern consistency.
- **Changing the table's `minWidth: 760`:** This is the horizontal floor that prevents the table from collapsing. Do not reduce it.
- **Modifying AnimatedNumber component:** It works correctly; only the surrounding style containers change.
- **Changing `fmt$whole` or `fmt$` helpers:** Formatting logic is correct; only the display size/color changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dollar formatting | Custom formatter | Existing `fmt$whole` | Already strips cents, handles commas |
| Number animation | New animation logic | Existing `AnimatedNumber` | Already handles all number display with animation |
| Color tokens | Hardcoded hex values | `colors.textSecondary` from tokens | Responds to theme toggle automatically |
| Spacing values | Arbitrary magic numbers for margins | `spacing[N]` from tokens | Consistent with design system |

**Key insight:** This phase changes ONLY numeric literals for fontSize and padding. Every other piece of infrastructure (formatting, animation, tokens, components) remains untouched.

## Common Pitfalls

### Pitfall 1: Cell Height Growth Pushes Team Total Off-Screen
**What goes wrong:** Increasing fontSize from 18-20px to 24px without reducing padding causes each row to grow by ~6px. With 15 agents + header + team total = 17 rows, that is ~102px of extra height, pushing the team total row below the 1080px viewport fold.
**Why it happens:** `padding: "14px 16px"` stays unchanged while fontSize grows. Browser computes cell height as padding-top + line-box + padding-bottom.
**How to avoid:** Reduce vertical padding from 14px to 11px on agent rows (D-14). Verify with 15 agents that no vertical overflow occurs.
**Warning signs:** Team total row not visible without scrolling; vertical scrollbar appearing.

### Pitfall 2: KPI Card Dimensions Growing
**What goes wrong:** Increasing card label from 11px to 14px and card number from 30px to 36px makes cards taller unless padding shrinks.
**Why it happens:** Cards use `padding: ${spacing[5]}px` (20px) on all sides. Larger text pushes card height up.
**How to avoid:** Reduce card padding from `spacing[5]` (20px) to `spacing[3]` (12px) or `spacing[4]` (16px) to absorb the larger text (D-09).
**Warning signs:** Stats bar takes noticeably more vertical space than before.

### Pitfall 3: Premium Conditional Sizing Threshold Wrong at New Base
**What goes wrong:** KPI cards have `fontSize: data && totalPremToday >= 10000 ? 22 : 26` (Today's Premium) and `fontSize: data && data.grandTotalPremium >= 10000 ? 20 : 26` (Weekly Premium). At the new 36px base, scaling these proportionally means the threshold condition and reduced sizes need updating.
**Why it happens:** The threshold (10000) and the reduced sizes (22/20) were tuned for the 26/30px base. At 36px base, the conditional sizes need proportional scaling.
**How to avoid:** Scale proportionally: base 36px, reduced size for large numbers ~28-30px. The 10000 threshold may stay the same (it is a dollar amount, not a pixel value). Test with `$12,345.67` and `$9,999.99` to verify both branches look correct.
**Warning signs:** Large premium values overflow the card width or look cramped.

### Pitfall 4: textTertiary Instances Outside Weekly Table
**What goes wrong:** Only promoting textTertiary in the WeeklyView but missing instances in the stats bar or other areas visible on TV.
**Why it happens:** Grep for `textTertiary` reveals it is used in the daily premium sub-text within weekly table cells (line 668). There may be other instances in the full file.
**How to avoid:** Search the entire file for `colors.textTertiary` and promote all instances that render text visible on TV. The ones in the daily cells (line 668) are confirmed. Do a full-file sweep before declaring done.
**Warning signs:** Some secondary text remains dim/invisible on TV while other text is bright.

### Pitfall 5: Agent Name Column Too Narrow After Adding maxWidth
**What goes wrong:** Adding `maxWidth: 120px` on agent names truncates even short names like "Mike" or "Sarah" on narrow viewports.
**Why it happens:** maxWidth is a hard cap regardless of available space. The agent column has no explicit width -- it flexes with content.
**How to avoid:** Use a generous maxWidth (e.g., 160-180px) or use percentage-based column width. Since the table is 1920px wide on a 1080p TV, the agent column gets roughly 200-240px. A maxWidth of 160px at 24px font accommodates ~8-9 characters which covers most first names.
**Warning signs:** Common 5-6 letter names getting truncated with ellipsis.

## Code Examples

### Current vs Target: Agent Name Cell
```typescript
// Source: apps/sales-board/app/page.tsx line 601-638
// BEFORE:
<td style={{
  padding: `14px ${spacing[5]}px`,    // 14px vertical
  fontSize: 18,                        // current size
  // ...
}}>

// AFTER (D-01, D-14):
<td style={{
  padding: `11px ${spacing[5]}px`,    // reduced to ~11px
  fontSize: 24,                        // target size
  // ...
}}>
```

### Current vs Target: Daily Cell Count
```typescript
// Source: apps/sales-board/app/page.tsx line 646-676
// BEFORE:
<td style={{ padding: "14px 16px", /* ... */ }}>
  <span style={{ fontSize: 20, fontWeight: 800, /* ... */ }}>
    <AnimatedNumber value={stat.count} />
  </span>
  <span style={{ fontSize: 12, fontWeight: 600, color: colors.textTertiary }}>
    {fmt$whole(stat.premium)}
  </span>

// AFTER (D-01, D-02, D-11, D-14):
<td style={{ padding: "11px 16px", /* ... */ }}>
  <span style={{ fontSize: 24, fontWeight: 800, /* ... */ }}>
    <AnimatedNumber value={stat.count} />
  </span>
  <span style={{ fontSize: 14, fontWeight: 600, color: colors.textSecondary }}>
    {fmt$whole(stat.premium)}
  </span>
```

### Current vs Target: Team Total Daily Cell
```typescript
// Source: apps/sales-board/app/page.tsx line 727-751
// BEFORE:
<div style={{ fontSize: 20, fontWeight: 800, color: colors.gold }}>
  <AnimatedNumber value={d.totalSales} />
</div>
<div style={{ fontSize: 12, fontWeight: 600, color: colors.gold, opacity: 0.7 }}>
  {fmt$whole(d.totalPremium)}
</div>

// AFTER (D-01, D-03):
<div style={{ fontSize: 24, fontWeight: 800, color: colors.gold }}>
  <AnimatedNumber value={d.totalSales} />
</div>
<div style={{ fontSize: 14, fontWeight: 600, color: colors.gold, opacity: 0.7 }}>
  {fmt$whole(d.totalPremium)}
</div>
```

### Current vs Target: KPI Card
```typescript
// Source: apps/sales-board/app/page.tsx line 997-1043
// BEFORE:
<div style={{ padding: `${spacing[5]}px`, /* 20px all sides */ }}>
  <div style={{ fontSize: 11, /* label */ }}> Today's Sales </div>
  <div style={{ fontSize: 30, /* number */ }}>
    <AnimatedNumber value={totalToday} />
  </div>
</div>

// AFTER (D-07, D-08, D-09):
<div style={{ padding: `${spacing[3]}px ${spacing[4]}px`, /* reduced padding */ }}>
  <div style={{ fontSize: 14, /* label */ }}> Today's Sales </div>
  <div style={{ fontSize: 36, /* number */ }}>
    <AnimatedNumber value={totalToday} />
  </div>
</div>
```

### Current vs Target: Premium KPI Card (Conditional Sizing)
```typescript
// Source: apps/sales-board/app/page.tsx line 1080-1087
// BEFORE:
fontSize: data && totalPremToday >= 10000 ? 22 : 26,

// AFTER (D-08, proportional scaling):
// Base: 26->36 = 1.38x multiplier
// Reduced: 22->30 (22 * 1.38 = ~30)
fontSize: data && totalPremToday >= 10000 ? 30 : 36,
```

### Weekly Premium KPI Card (Conditional Sizing)
```typescript
// Source: apps/sales-board/app/page.tsx line 1186
// BEFORE:
fontSize: data && data.grandTotalPremium >= 10000 ? 20 : 26,

// AFTER (proportional):
// Base: 26->36 = 1.38x; Reduced: 20->28 (20 * 1.38 = ~28)
fontSize: data && data.grandTotalPremium >= 10000 ? 28 : 36,
```

### Agent Name Ellipsis Safety Net
```typescript
// Source: apps/sales-board/app/page.tsx line 631
// BEFORE:
<span>{agent}</span>

// AFTER (D-13):
<span style={{
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 160,
  display: "inline-block",
  verticalAlign: "middle",
}}>
  {agent}
</span>
```

### Table Header
```typescript
// Source: apps/sales-board/app/page.tsx line 539-554
// BEFORE:
const TH: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 15,
  // ...
};

// AFTER (D-06, D-14):
const TH: React.CSSProperties = {
  padding: "10px 16px",    // reduced proportionally
  fontSize: 18,
  // ...
};
```

### Weekly Total Premium Column
```typescript
// Source: apps/sales-board/app/page.tsx line 694-707
// BEFORE:
<td style={{
  padding: `14px ${spacing[5]}px`,
  fontSize: 15,
  // ...
}}>
  {fmt$whole(total?.premium ?? 0)}
</td>

// AFTER (D-01, D-14):
<td style={{
  padding: `11px ${spacing[5]}px`,
  fontSize: 24,
  // ...
}}>
  {fmt$whole(total?.premium ?? 0)}
</td>
```

### Team Total Grand Premium
```typescript
// Source: apps/sales-board/app/page.tsx line 766-778
// BEFORE:
fontSize: 16,

// AFTER (D-01):
fontSize: 24,
```

### Spacing Between Stats Bar and TabNav
```typescript
// Source: apps/sales-board/app/page.tsx line 1204
// BEFORE:
<div className="animate-fade-in stagger-3" style={{ marginBottom: spacing[3] }}>
  <TabNav ... />
</div>

// AFTER (D-10) -- reduce marginTop on stats grid and marginBottom on tab toggle:
// The stats grid has marginTop: spacing[3] (12px), reduce to spacing[2] (8px) or spacing[1] (4px)
// The tab toggle wrapper has marginBottom: spacing[3] (12px), reduce to spacing[2] (8px)
```

## Complete Change Map

All changes in `apps/sales-board/app/page.tsx`:

| Line(s) | Element | Property | Before | After | Decision |
|---------|---------|----------|--------|-------|----------|
| 540 | TH (table header) | padding | "14px 16px" | "10px 16px" | D-14 |
| 542 | TH | fontSize | 15 | 18 | D-06 |
| 603 | Agent name td | padding | `14px ${spacing[5]}px` | `11px ${spacing[5]}px` | D-14 |
| 606 | Agent name td | fontSize | 18 | 24 | D-01 |
| 631 | Agent name span | (add) | -- | overflow/ellipsis/maxWidth | D-13 |
| 647 | Daily cell td | padding | "14px 16px" | "11px 16px" | D-14 |
| 656 | Daily count span | fontSize | 20 | 24 | D-01 |
| 668 | Daily premium span | fontSize | 12 | 14 | D-02 |
| 668 | Daily premium span | color | colors.textTertiary | colors.textSecondary | D-11 |
| 685 | Total column td | fontSize | 24 | 24 | D-04 (no change) |
| 681 | Total column td | padding | "14px 16px" | "11px 16px" | D-14 |
| 696 | Premium column td | padding | `14px ${spacing[5]}px` | `11px ${spacing[5]}px` | D-14 |
| 700 | Premium column td | fontSize | 15 | 24 | D-01 |
| 719 | Team total "Team Total" label | fontSize | 14 | 14 | (no change -- label) |
| 716 | Team total label td | padding | `${spacing[4]}px ${spacing[5]}px` | `${spacing[3]}px ${spacing[5]}px` | D-15 |
| 733 | Team total daily td | padding | `${spacing[4]}px 16px` | `${spacing[3]}px 16px` | D-15 |
| 740 | Team total daily count | fontSize | 20 | 24 | D-01 |
| 743 | Team total daily premium | fontSize | 12 | 14 | D-03 |
| 755 | Team total grand total td | padding | `${spacing[4]}px 16px` | `${spacing[3]}px 16px` | D-15 |
| 758 | Team total grand total | fontSize | 28 | 28 | D-05 (no change) |
| 768 | Team total grand premium td | padding | `${spacing[4]}px ${spacing[5]}px` | `${spacing[3]}px ${spacing[5]}px` | D-15 |
| 770 | Team total grand premium | fontSize | 16 | 24 | D-01 |
| 1001 | KPI card (all 4) | padding | `${spacing[5]}px` | `${spacing[3]}px ${spacing[4]}px` | D-09 |
| 1022 | KPI label (all 4) | fontSize | 11 | 14 | D-07 |
| 1034 | KPI number (Today Sales) | fontSize | 30 | 36 | D-08 |
| 1082 | KPI number (Today Prem) | fontSize | 22/26 | 30/36 | D-08 |
| 1134 | KPI number (Weekly Sales) | fontSize | 30 | 36 | D-08 |
| 1186 | KPI number (Weekly Prem) | fontSize | 20/26 | 28/36 | D-08 |
| 990 | Stats grid | marginTop | spacing[3] | spacing[2] | D-10 |
| 1204 | Tab toggle wrapper | marginBottom | spacing[3] | spacing[2] | D-10 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS files with media queries | Inline CSSProperties | Project inception | All changes are numeric literal substitutions in JSX |
| Dynamic font scaling by agent count | Fixed px targets per user decision | This phase | Phase 34 may add dynamic scaling; this phase uses fixed values |

**Deprecated/outdated:**
- Nothing deprecated. The inline CSSProperties approach is the project standard and remains correct for this phase.

## Open Questions

1. **Exact padding values for consistent cell height**
   - What we know: Reducing from 14px to ~11px compensates for 18->24px font growth. The math works out to roughly equal row height.
   - What's unclear: Exact rendered height depends on line-height and font metrics. May need fine-tuning to 10px or 12px.
   - Recommendation: Start with 11px, verify visually, adjust within the 10-12px range. This is marked as Claude's discretion.

2. **KPI card padding exact values**
   - What we know: Cards use `spacing[5]` (20px) padding. Need reduction to absorb 11->14 label and 30->36 number growth.
   - What's unclear: Whether `spacing[3]` (12px) or `spacing[4]` (16px) keeps cards the same size.
   - Recommendation: Try `spacing[3]` vertical, `spacing[4]` horizontal (asymmetric padding). This is Claude's discretion.

3. **Agent name maxWidth value**
   - What we know: At 1920px table width with 9 columns (agent + 7 days + total + premium), agent column gets roughly 200-250px.
   - What's unclear: Exact rendered column width depends on other column content widths.
   - Recommendation: Start with maxWidth 160px. Covers names up to ~9 characters at 24px. Long names like "Christopher" (11 chars) would truncate to "Christoph..." which is acceptable per D-12/D-13.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- sales-board has no test infrastructure |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TYPO-01 | Weekly table fonts increased | manual-only | Visual inspection at 1080p | N/A |
| TYPO-03 | Team total row fonts increased | manual-only | Visual inspection | N/A |
| TYPO-04 | KPI card fonts increased | manual-only | Visual inspection | N/A |
| TYPO-05 | textTertiary promoted to textSecondary | manual-only | Grep for `textTertiary` in page.tsx -- should find zero instances in TV-visible elements | N/A |
| OVFL-01 | Long names don't cause horizontal scroll | manual-only | Test with "Christopher" as agent name at 1080p | N/A |
| OVFL-02 | Large premiums fit in cells | manual-only | Test with $12,345 value at 1080p | N/A |
| SCAL-04 | Padding adjusted to maintain cell height | manual-only | Compare row heights before/after | N/A |

**Justification for manual-only:** All requirements are visual/CSS properties. The sales-board app has no test infrastructure and the changes are numeric literal substitutions verifiable by visual inspection. Adding a test framework for CSS property assertions would be over-engineering for this scope.

### Sampling Rate
- **Per task commit:** Visual inspection in browser at 1920x1080
- **Per wave merge:** Full visual check with 15 agent names including one long name and one $12,345+ premium
- **Phase gate:** All 7 requirements verified by visual inspection before declaring done

### Wave 0 Gaps
None -- no test infrastructure needed for CSS-only changes. Verification is visual inspection.

## Sources

### Primary (HIGH confidence)
- `apps/sales-board/app/page.tsx` -- direct code audit, all font sizes, padding values, color references, line numbers verified
- `packages/ui/src/tokens.ts` -- spacing values (spacing[3]=12, spacing[4]=16, spacing[5]=20), color token names
- `packages/ui/src/components/TabNav.tsx` -- confirmed TabNav styling (fontSize:13, padding:"12px 16px") is NOT modified in this phase
- `.planning/research/SUMMARY.md` -- project-level TV readability research, pixel budget analysis
- `.planning/research/PITFALLS.md` -- 7 documented pitfalls with prevention strategies

### Secondary (MEDIUM confidence)
- `.planning/phases/33-core-tv-readability/33-CONTEXT.md` -- user decisions D-01 through D-15 with exact targets

### Tertiary (LOW confidence)
- None -- all findings derived from direct code inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all changes use existing patterns
- Architecture: HIGH -- single file, every line number and current value verified by code inspection
- Pitfalls: HIGH -- pixel budget math verified, color tokens confirmed, overflow mechanics understood from direct code analysis

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependencies that could change)
