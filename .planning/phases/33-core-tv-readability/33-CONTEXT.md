# Phase 33: Core TV Readability - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Increase font sizes on the weekly breakdown table, KPI stat cards, and team total row for TV-distance readability. Promote secondary text contrast. Handle agent name overflow. All changes in `apps/sales-board/app/page.tsx`. No new files, no new dependencies, no API changes.

</domain>

<decisions>
## Implementation Decisions

### Font Size Targets
- **D-01:** Uniform 24px for: agent names (weekly table), daily sale count, weekly total premium, team total daily count, team total grand premium
- **D-02:** Daily premium per cell: 12px → 14px (+2px)
- **D-03:** Team total daily premium: 12px → 14px (+2px)
- **D-04:** Weekly TOTAL sales column stays at 24px (already at target)
- **D-05:** Team total grand total stays at 28px (already prominent)
- **D-06:** Table headers: 15px → 18px (proportional bump)

### KPI Stat Cards
- **D-07:** Card labels: 11px → 14px
- **D-08:** Card numbers: 30px → 36px (premium conditional sizing scales proportionally)
- **D-09:** Reduce card internal padding so card dimensions stay the same
- **D-10:** Reduce spacing between cards and the leaderboard/weekly breakdown tab toggles

### Contrast & Color
- **D-11:** Promote all textTertiary usage to textSecondary — one tier brighter for TV visibility in lit office

### Name Overflow
- **D-12:** Agents always use first names only — this is the existing convention
- **D-13:** If a long first name exceeds column width, truncate with ellipsis as safety net (text-overflow: ellipsis, overflow: hidden)

### Row Budget
- **D-14:** Reduce cell vertical padding from 14px to ~11-12px to compensate for larger fonts — cell dimensions must stay visually consistent
- **D-15:** Team total row padding adjusts proportionally

### Claude's Discretion
- Exact padding reduction values — tune to keep cells the same visual size
- Table header font bump (18px suggested, Claude can adjust)
- Premium conditional sizing thresholds on KPI cards (currently 10000 → may need adjustment at 36px base)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sales Board
- `apps/sales-board/app/page.tsx` — Single file containing all views (WeeklyView, DailyView, PodiumCard, KPI stats bar). All font sizes are inline numeric literals in React.CSSProperties.

### Design Tokens
- `packages/ui/src/index.ts` — Exports `colors`, `spacing`, `radius`, `shadows` tokens used throughout the board

### Research
- `.planning/research/SUMMARY.md` — Synthesized TV readability research findings
- `.planning/research/PITFALLS.md` — Common mistakes when optimizing for TV distance

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `colors.textSecondary` (#94a3b8) — the promotion target for all textTertiary usages
- `colors.textTertiary` (#64748b) — being replaced in this phase
- `AnimatedNumber` component — handles all numeric displays, no changes needed
- `fmt$whole` / `fmt$` — formatting helpers, no changes needed

### Established Patterns
- All fontSize values are numeric literals (e.g., `fontSize: 18`), not strings
- Padding uses either `spacing[N]` tokens or inline px strings (e.g., `"14px 16px"`)
- No CSS files — everything is inline CSSProperties
- Conditional font sizing exists for premium amounts (e.g., `fontSize: data && totalPremToday >= 10000 ? 22 : 26`)

### Integration Points
- WeeklyView: lines 539-783 (TH style, agent rows, daily cells, total column, premium column, team total row)
- KPI stats bar: lines 987-1146 (4 stat cards with labels, numbers, icons)
- No other files touched

</code_context>

<specifics>
## Specific Ideas

- User wants consistency: multiple elements sharing the same 24px size rather than varied sizes that look "all over the place"
- The previous attempt failed because sizes were inconsistent — some bumped more than others
- Cell dimensions must not grow — trade padding for font size
- KPI cards should stay the same physical size — reduce padding to absorb larger fonts
- Reduce gap between KPI cards and the tab toggles below them

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-core-tv-readability*
*Context gathered: 2026-03-31*
