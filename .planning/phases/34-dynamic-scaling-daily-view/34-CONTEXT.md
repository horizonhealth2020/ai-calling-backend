# Phase 34: Dynamic Scaling & Daily View - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Increase font sizes on the DailyView (podium cards + rest-of-agents columns) for TV-distance readability. Apply same padding-reduction pattern from Phase 33. No dynamic scaling logic — user handles fit via browser zoom. All changes in `apps/sales-board/app/page.tsx`. No new files, no new dependencies, no API changes.

</domain>

<decisions>
## Implementation Decisions

### Scaling Strategy
- **D-01:** No dynamic font scaling logic. User manages screen fit via browser zoom (already in use). All font sizes are static literals.
- **D-02:** SCAL-01 (dynamic scaling based on agent count) is satisfied by browser zoom — no code-level scaling needed.

### Podium Card Font Targets (Top 3 Agents)
- **D-03:** 1st place — name: 17px -> 22px, count: 36px (keep), premium: 12px -> 14px
- **D-04:** 2nd place — name: 15px -> 20px, count: 28px -> 32px, premium: 12px -> 14px
- **D-05:** 3rd place — name: 14px -> 18px, count: 26px -> 30px, premium: 12px -> 14px
- **D-06:** Rank labels above podium cards: 10px -> 13px
- **D-07:** Apply textTertiary -> textSecondary promotion on podium premium text (same as Phase 33 pattern)

### Rest-of-Agents Font Targets (4th Place and Beyond)
- **D-08:** Agent names: 14px -> 18px
- **D-09:** Sale counts: 28px -> 32px
- **D-10:** Premium amounts: 12px -> 14px
- **D-11:** Rank badge numbers: 11px -> 13px
- **D-12:** Section labels ("All Agents", "Top Performers"): 11px -> 13px
- **D-13:** Day/Week toggle buttons: 12px -> 14px
- **D-14:** Apply textTertiary -> textSecondary promotion on rest-of-agents premium text

### Layout Budget — Podium Cards
- **D-15:** Card dimensions stay unchanged (1st: 200x220, 2nd: 175x175, 3rd: 165x150)
- **D-16:** Reduce internal padding to absorb larger fonts — trade padding for font size, same as Phase 33 KPI card approach

### Layout Budget — Rest-of-Agents Columns
- **D-17:** Column minHeight and padding adjustments are Claude's discretion — optimize for TV readability while keeping layout balanced at typical zoom levels

### Claude's Discretion
- Exact padding reduction values for podium cards and rest-of-agents columns
- Column minHeight adjustments if needed
- Platform base number font sizes (currently 11px)
- Crown icon size adjustments if proportionally needed
- Any additional textMuted -> textSecondary promotions on DailyView elements

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sales Board
- `apps/sales-board/app/page.tsx` — Single file containing all views. DailyView: lines 285-521, PodiumCard: lines 99-218, PodiumPlatform: lines 222-281, PODIUM_CONFIG: lines 52-95

### Design Tokens
- `packages/ui/src/index.ts` — Exports `colors`, `spacing`, `radius`, `shadows` tokens used throughout the board

### Prior Phase Context
- `.planning/phases/33-core-tv-readability/33-CONTEXT.md` — Phase 33 decisions for WeeklyView/KPI cards. Font targets and padding reduction patterns to maintain consistency.

### Research
- `.planning/research/SUMMARY.md` — Synthesized TV readability research findings
- `.planning/research/PITFALLS.md` — Common mistakes when optimizing for TV distance

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PODIUM_CONFIG` object (lines 52-95) — contains `nameSize`, `countSize`, `height`, `width` per rank. Central place to update podium font sizes.
- `colors.textSecondary` (#94a3b8) — promotion target for textTertiary usages, same as Phase 33
- `AnimatedNumber` component — handles all numeric displays, no changes needed

### Established Patterns
- All fontSize values are numeric literals (e.g., `fontSize: 18`), not strings
- Padding uses `spacing[N]` tokens or inline px strings
- Phase 33 established the pattern: reduce padding to absorb larger fonts, keep container dimensions unchanged
- Conditional font sizing exists in podium (nameSize/countSize vary by rank)

### Integration Points
- PodiumCard component: receives rank config from PODIUM_CONFIG — update config values, component follows
- DailyView function: rest-of-agents section has inline styles at lines 386-509
- No other files touched

</code_context>

<specifics>
## Specific Ideas

- User already uses browser zoom to fit agents on screen — dynamic scaling code would be redundant
- Consistency with Phase 33 is the priority: same proportional bumps, same padding-reduction technique
- The board is always on a TV — every text element should be readable from 10-15 feet

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-dynamic-scaling-daily-view*
*Context gathered: 2026-03-31*
