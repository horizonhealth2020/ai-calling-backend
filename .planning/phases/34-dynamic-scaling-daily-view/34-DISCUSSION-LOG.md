# Phase 34: Dynamic Scaling & Daily View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 34-dynamic-scaling-daily-view
**Areas discussed:** Scaling strategy, DailyView font targets, DailyView layout budget

---

## Scaling Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Breakpoints (Recommended) | 2-3 tiers like small/medium/large based on agent count. Simple, predictable. | |
| Linear interpolation | Smoothly scales between min/max font sizes based on exact count. | |
| CSS clamp() | Uses CSS clamp with viewport units. Less control. | |

**User's choice:** None of the above — user explained they already use browser zoom to adjust fit, so dynamic scaling logic is unnecessary.
**Notes:** User manages agent fit via browser zoom. The phase simplifies to just bumping DailyView fonts for TV readability (matching Phase 33 approach for WeeklyView).

---

## Confirmation: Scope Simplification

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, just bump fonts | Skip dynamic scaling entirely. Increase DailyView fonts. Handle zoom manually. | ✓ |
| Bump fonts + light scaling | Increase fonts AND add simple breakpoint scaling. | |

**User's choice:** Yes, just bump fonts
**Notes:** Dynamic scaling requirements (SCAL-01) satisfied by browser zoom, not code.

---

## DailyView Font Targets — Podium Cards

| Option | Description | Selected |
|--------|-------------|----------|
| Match Phase 33 pattern (Recommended) | Apply same +2-6px bumps as WeeklyView. Names 17->22, 15->20, 14->18. Premium 12->14. | ✓ |
| Bigger — prioritize distance | More aggressive bumps. Names 24px uniform, counts 36px uniform. | |
| You decide | Claude picks proportional sizes. | |

**User's choice:** Match Phase 33 pattern (Recommended)
**Notes:** Consistent proportional bumps matching WeeklyView treatment.

---

## DailyView Font Targets — Rest-of-Agents

| Option | Description | Selected |
|--------|-------------|----------|
| Match WeeklyView sizes (Recommended) | Names 14->18px, counts 28->32px, premium 12->14px, ranks 11->13px. | ✓ |
| Uniform 24px names | Agent names at 24px same as WeeklyView rows. May feel cramped. | |
| You decide | Claude picks within column constraints. | |

**User's choice:** Match WeeklyView sizes (Recommended)
**Notes:** Keeps proportions consistent with WeeklyView post-Phase 33.

---

## DailyView Layout Budget — Podium Cards

| Option | Description | Selected |
|--------|-------------|----------|
| Keep dimensions, reduce padding (Recommended) | Same Phase 33 approach: trade padding for fonts. Card sizes unchanged. | ✓ |
| Allow cards to grow slightly | Let height increase 10-15%. | |
| You decide | Claude balances padding vs dimensions. | |

**User's choice:** Keep dimensions, reduce padding (Recommended)
**Notes:** Proven pattern from Phase 33 KPI cards.

---

## DailyView Layout Budget — Rest-of-Agents Columns

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 120px, reduce padding (Recommended) | Reduce column padding to absorb bigger fonts. | |
| You decide | Claude adjusts sizing. | |

**User's choice:** Claude decides, but reminded that layout adjusts based on number of agents (via browser zoom).
**Notes:** User relies on browser zoom for different agent counts, so column sizing should look good at typical zoom levels.

---

## Claude's Discretion

- Exact padding reduction values for podium cards and rest-of-agents columns
- Column minHeight adjustments
- Platform base number font sizes
- Crown icon size adjustments
- Additional textMuted -> textSecondary promotions

## Deferred Ideas

None — discussion stayed within phase scope
