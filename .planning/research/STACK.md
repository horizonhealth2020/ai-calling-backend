# Stack Research: Lead Source Timing Analytics Visualizations

**Domain:** Data visualization additions to existing sales operations platform
**Researched:** 2026-03-26
**Confidence:** HIGH

## Decision: Hand-Rolled SVG Components (No Charting Library)

**Recommendation: Do NOT add a charting library. Build heatmap, sparklines, and recommendation cards with raw SVG + React.**

### Why

1. **The visualizations are simple.** A heatmap is a grid of `<rect>` elements with fill colors. A sparkline is a `<polyline>` in an `<svg>`. A recommendation card is just styled divs. None of these require a charting library's layout engine, axis system, or interaction model.

2. **Perfect inline-style compatibility.** Raw SVG elements accept `fill`, `stroke`, `opacity` as direct props -- no className or CSS import needed. The existing `@ops/ui` design tokens (CSS custom properties like `var(--success)`) work directly as SVG fill values. A charting library would introduce its own theming layer that fights the existing system.

3. **Zero new dependencies.** No bundle size increase, no version conflicts, no peer dependency management. The project already has React 18.3.1 which renders SVG natively.

4. **Matches project patterns.** The codebase uses hand-built components with inline CSSProperties everywhere. Adding a charting library introduces a different abstraction pattern that breaks consistency.

5. **Total code for all three visualizations is approximately 150-200 lines.** A `<HeatmapGrid>` component is roughly 60 lines. A `<Sparkline>` is 30 lines. The recommendation card is standard React with existing `Card` and `Badge` components.

## Recommended Stack (New Additions)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Raw SVG + React | (built-in) | Heatmap grid, sparkline charts | Zero dependencies, full inline-style control, native React rendering |

**That is it.** No new packages needed for the visualization layer.

### Supporting Libraries (Already Installed -- No Changes)

| Library | Version | Purpose | Role in v1.8 |
|---------|---------|---------|--------------|
| react | 18.3.1 | SVG rendering via JSX | Renders `<svg>`, `<rect>`, `<polyline>`, `<text>` natively |
| luxon | ^3.4.4 | Timezone-aware hour/day bucketing | Convert Convoso Pacific timestamps to hour-of-day, day-of-week |
| @ops/ui tokens | (workspace) | Design tokens for colors, spacing | Heatmap fill colors, card styling, text styles |
| lucide-react | ^0.577.0 | Icons | Recommendation card icons (TrendingUp, Clock, Zap) |
| socket.io-client | ^4.8.3 | Real-time updates | Live recommendation card refresh on new sale/call events |

### API Layer (Already Installed -- No Changes)

| Library | Version | Purpose | Role in v1.8 |
|---------|---------|---------|--------------|
| prisma | (workspace) | Query aggregation | GROUP BY hour, day_of_week, lead_source for heatmap data |
| express | ^4.18.2 | API endpoints | New `/analytics/timing` routes |
| zod | (workspace) | Input validation | Date range, granularity params |

## Implementation Patterns

### Heatmap Grid (Raw SVG)

```typescript
// Approximately 60 lines. Each cell is a <rect> with computed fill.
interface HeatmapProps {
  data: { hour: number; day: number; rate: number; count: number }[];
  width: number;
  height: number;
}

// Fill color interpolation using the existing design tokens:
// Low rate  -> dark muted color matching dark theme
// High rate -> emerald/teal matching colors.accentTeal
// Zero data -> transparent feel matching bgSurface
```

SVG `<rect>` elements accept `fill` as a prop. CSS custom properties work in SVG fill when the element is in the DOM (not `<img>`). Since these render inline in the React tree, `var(--success)` works directly.

For the color gradient (rate 0% to 100%), use a simple linear interpolation between two RGB values computed at render time -- no d3-scale needed for 24x7=168 cells.

### Sparkline (Raw SVG)

```typescript
// Approximately 30 lines. A <polyline> with points computed from data array.
interface SparklineProps {
  data: number[];  // 7 values for 7 days
  width?: number;  // default 120
  height?: number; // default 32
  color?: string;  // default colors.accentTeal
}

// Points: data.map((v, i) => `${(i / (len - 1)) * width},${height - (v / max) * height}`)
// Render: <svg><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} /></svg>
```

### Recommendation Card (React + Existing Components)

Uses existing `Card` and `Badge` from `@ops/ui`. No SVG needed. "Best Source Right Now" with current-hour close rate highlight. Animated pulse on the recommended source using CSS animation via inline style.

### Color Scale Helper (No Library Needed)

```typescript
// For heatmap cell colors -- interpolate between two hex values
function interpolateColor(t: number): string {
  // t: 0 (cold) to 1 (hot)
  // cold: rgb(26, 26, 46)  -- dark blue-gray matching dark theme
  // hot:  rgb(16, 185, 129) -- emerald/teal matching accent
  const r = Math.round(26 + t * (16 - 26));
  const g = Math.round(26 + t * (185 - 26));
  const b = Math.round(46 + t * (129 - 46));
  return `rgb(${r},${g},${b})`;
}
```

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Raw SVG `<rect>` grid | @visx/heatmap (3.12.0) | visx adds 5 packages (~250KB unpacked) for something achievable in 60 lines. visx heatmap uses its own scale/group system that does not integrate with existing @ops/ui tokens without adapter code. |
| Raw SVG `<polyline>` | recharts (3.8.1) | Recharts requires `<ResponsiveContainer>`, `<LineChart>`, `<Line>` -- massive overkill for a 7-point sparkline. Recharts also injects its own CSS classes and has known issues with pure inline styling (GitHub issue #2169). |
| Raw SVG `<polyline>` | react-sparklines (1.7.0) | Unmaintained (last publish 2018). Works but adds a dependency for 30 lines of code. |
| Hand-rolled interpolation | d3-scale (4.0.2) | d3-scale is 143KB for a linear interpolation between two colors. Overkill. |
| Inline `<svg>` in React | Chart.js / react-chartjs-2 | Canvas-based, requires CSS imports, does not integrate with inline CSSProperties at all. |
| Inline `<svg>` in React | @nivo/heatmap | Nivo has heavy dependencies (~1MB+), requires its own theme provider, and imposes its own styling system. |

### When TO Use a Charting Library (Not This Project)

- **Complex interactions**: Zoom, pan, brush selection on time series -- use visx
- **Many chart types**: If you need 10+ different chart types -- use recharts
- **Design-heavy dashboards**: If charts ARE the product -- use nivo for polish
- **This project**: 1 heatmap + 1 sparkline + 1 card = raw SVG is the right call

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Chart.js / react-chartjs-2 | Canvas-based, requires CSS imports, incompatible with inline CSSProperties approach | Raw SVG |
| @nivo/* | Heavy (~1MB), brings its own theme provider that conflicts with @ops/ui tokens | Raw SVG |
| recharts | Overkill for sparklines, known inline-style issues (GitHub #2169, #2785), injects classNames | Raw SVG `<polyline>` |
| d3 (full library) | 500KB+ for DOM manipulation React already handles better | Raw SVG with simple math |
| @visx/* | Reasonable library but adds 5+ packages for 2 simple visualizations, introduces visx patterns alongside existing @ops/ui patterns | Raw SVG |
| Any library requiring globals.css | Violates project constraint: no CSS files, inline CSSProperties only | Raw SVG with design tokens |
| react-sparklines | Unmaintained since 2018, React 18 compatibility unverified | Raw SVG `<polyline>` |

## Version Compatibility

| Existing Package | Compatible With | Notes |
|------------------|-----------------|-------|
| react@18.3.1 | Native SVG rendering | Full SVG support via JSX -- `<svg>`, `<rect>`, `<polyline>`, `<text>`, `<g>` all work as first-class elements |
| next@15.3.9 | SVG in Server Components | SVG elements render in both server and client components. Heatmap and sparkline should be `"use client"` for hover tooltips |
| luxon@^3.4.4 | Hour/day bucketing | Use `DateTime.fromISO(callDate).setZone('America/Los_Angeles')` for Convoso timestamp conversion per project memory |
| @ops/ui tokens | SVG fill/stroke | CSS custom properties (e.g., `var(--success)`) work as SVG `fill` values when rendered inline in DOM |

## Installation

```bash
# No new packages to install.
# All visualization code uses built-in React SVG rendering + existing @ops/ui tokens.
npm install          # existing workspace install, no new packages
```

## Stack Patterns by Variant

**If heatmap needs more than hover tooltips later (zoom, brush, click-to-drill):**
- Upgrade path is @visx/heatmap@3.12.0 + @visx/scale@3.12.0 + @visx/tooltip@3.12.0
- visx is modular (install only what you need) and SVG-based (compatible with inline styles)
- Peer dependency: react >=16.3.0 (compatible with project's 18.3.1)

**If more chart types are requested beyond v1.8 (bar charts, area charts, multi-axis):**
- Evaluate recharts@3.8.1 at that point -- more chart types justify the dependency
- Would require establishing a pattern for integrating recharts theming with @ops/ui tokens

**For v1.8 scope (1 heatmap + 1 sparkline + 1 recommendation card):**
- Raw SVG is the right call -- simpler, zero dependencies, full design system integration

## Sources

- [visx official site](https://visx.airbnb.tech/) -- evaluated as primary charting library candidate (HIGH confidence)
- npm @visx/heatmap -- version 3.12.0 verified via `npm view` (HIGH confidence)
- npm recharts -- version 3.8.1 verified via `npm view` (HIGH confidence)
- [Recharts inline style issues #2169](https://github.com/recharts/recharts/issues/2169) -- confirmed CSS class conflicts with pure inline styling (MEDIUM confidence)
- [react-sparklines GitHub](https://github.com/borisyankov/react-sparklines) -- last meaningful update 2018, unmaintained (HIGH confidence)
- React 18 SVG rendering -- native JSX SVG support confirmed (HIGH confidence)
- `packages/ui/src/tokens.ts` -- read directly from codebase, CSS custom properties as design tokens confirmed (HIGH confidence)
- `apps/ops-dashboard/package.json` -- React 18.3.1, Next.js 15.3.9, lucide-react 0.577.0 confirmed (HIGH confidence)
- Project memory `project_convoso_timezone.md` -- Convoso call_date uses America/Los_Angeles timezone (HIGH confidence)

---
*Stack research for: Lead Source Timing Analytics (v1.8)*
*Researched: 2026-03-26*
