# Phase 33: Core TV Readability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 33-core-tv-readability
**Areas discussed:** Font size targets, Contrast & color, Name overflow strategy, KPI card sizing

---

## Font Size Targets

| Option | Description | Selected |
|--------|-------------|----------|
| 20px | Match current daily count size — moderate increase | |
| 22px | Slight bump above current — balanced visibility | |
| 24px | Research minimum for TV — noticeable increase | ✓ |

**User's choice:** 24px for the matching group (agent names, daily count, weekly total premium, team total daily count)
**Notes:** User specified that the previous attempt "messed up" the board because fonts were "all over the place" — inconsistent sizing. Wants uniform 24px for the main data group. Daily premium and team total daily premium get +2px only (12→14px). Weekly total sales (24px) and grand total (28px) stay as-is.

### Follow-up: Total column sizing

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is | 24px total, 28px grand total already prominent | ✓ |
| Bump slightly | Total to 28px, grand total to 32px | |

**User's choice:** Keep as-is

---

## Contrast & Color

| Option | Description | Selected |
|--------|-------------|----------|
| Promote to textSecondary | One tier brighter (#94a3b8), still subtle | ✓ |
| Promote to textPrimary | Full brightness, less visual hierarchy | |
| You decide | Claude picks per element | |

**User's choice:** Promote to textSecondary
**Notes:** All textTertiary usage promoted one tier

---

## Name Overflow Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate with ellipsis | Fixed column width, consistent | |
| Show first name only | Cleaner on TV | |
| Shrink font for long names | Auto-reduce | |
| Let it wrap | Two-line names | |

**User's choice:** "We always only use first name. If long, truncate."
**Notes:** First names are the existing convention. Ellipsis truncation as a safety net for unusually long first names.

---

## KPI Card Sizing

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Top cards already most visible | |
| Small bump | Labels 11→14px, numbers 30→36px | ✓ |
| Match table sizing | Align with 24px baseline | |

**User's choice:** Small bump, but reduce padding so card size stays the same. Also reduce spacing between cards and tab toggles.

---

## Claude's Discretion

- Exact padding reduction values to keep cells same size
- Table header font bump
- Premium conditional sizing thresholds on KPI cards

## Deferred Ideas

None
