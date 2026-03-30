# Phase 30: Lead Source Timing Analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 30-lead-source-timing-analytics
**Areas discussed:** Heatmap visual design, Metric definition, Analytics section layout, Commission fix scope

---

## Heatmap Visual Design

### Color Scale

| Option | Description | Selected |
|--------|-------------|----------|
| Red-to-green gradient | Classic: red (low) to yellow (mid) to green (high). High contrast against dark bg. | ✓ |
| Single-color intensity | One accent color from dim to bright. Cleaner on dark theme. | |
| You decide | Claude picks best for dark glassmorphism theme | |

**User's choice:** Red-to-green gradient
**Notes:** None

### Toggle UX

| Option | Description | Selected |
|--------|-------------|----------|
| Pill toggle above heatmap | Two buttons styled like date range presets | |
| Dropdown selector | Compact dropdown for grouping mode | ✓ (modified) |
| You decide | Claude picks matching existing controls | |

**User's choice:** Dropdown — but with three options: Day of Week, Week of Month, AND Month of Year (user added third option)
**Notes:** User explicitly requested Month of Year as a third grouping dimension beyond the original two.

---

## Metric Definition

### Timezone

| Option | Description | Selected |
|--------|-------------|----------|
| Eastern (America/New_York) | Team operates on Eastern time | ✓ |
| Pacific (America/Los_Angeles) | Match Convoso source data | |
| Local browser time | Each user sees own timezone | |

**User's choice:** Eastern (America/New_York)
**Notes:** None

### Sale Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Use Sale.createdAt | Has actual hour/minute, represents when entered | ✓ |
| Use Sale.saleDate | Date field, may lack hour precision | |

**User's choice:** Use Sale.createdAt
**Notes:** saleDate lacks hour precision, createdAt is the only viable option for hourly bucketing.

---

## Analytics Section Layout

### Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Best Source top, heatmap below, sparklines bottom | Vertical stack, progressively more detail | |
| Card + sparklines side by side, heatmap below | Two-column top row, heatmap full width | |
| You decide | Claude picks best layout for dark theme | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on internal layout arrangement.

### Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Section always shows, scroll to see | |
| Collapsible with header | Click to expand/collapse | ✓ |

**User's choice:** Collapsible with header
**Notes:** None

---

## Commission Fix Scope

### Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Half commission | Primary available in state but not in sale — fallback doesn't substitute | ✓ |
| Full commission anyway | Any qualifying addon gives full commission regardless | |

**User's choice:** Half commission — fallback only qualifies when primary is NOT available in that state
**Notes:** Fix is surgical: add `!requiredAvail` guard before entering fallback loop in `resolveBundleRequirement()`.

---

## Claude's Discretion

- Analytics section internal layout (arrangement of card, heatmap, sparklines)
- Heatmap cell sizing, spacing, gradient RGB values
- Sparkline SVG dimensions and styling
- Loading skeleton design
- Error state handling

## Deferred Ideas

None — discussion stayed within phase scope
