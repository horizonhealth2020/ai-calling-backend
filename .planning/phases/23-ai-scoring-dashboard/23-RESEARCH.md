# Phase 23: AI Scoring Dashboard - Research

**Researched:** 2026-03-24
**Domain:** Owner dashboard UI + API aggregation endpoints (read-only)
**Confidence:** HIGH

## Summary

This phase adds a "Scoring" tab to the owner dashboard that surfaces AI audit score data already stored in the `CallAudit` model (`aiScore` field, 0-100 integer). The work is entirely read-only: one new API endpoint aggregates scoring data, and one new React component renders KPIs, a per-agent sortable table, and weekly trend rows.

The codebase has well-established patterns for every piece of this phase. The `OwnerKPIs.tsx` file is the exact template for a sortable agent table with StatCards and DateRangeFilter. The `page.tsx` tab system uses a union type + conditional rendering pattern that makes adding a new tab mechanical. The `dateRange()` helper on the API side handles all date filtering. No new dependencies are needed.

**Primary recommendation:** Clone the OwnerKPIs pattern exactly -- one new `OwnerScoring.tsx` component, one new API endpoint in `ai-budget.ts`, and a three-line change to `page.tsx` to wire the tab.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation decisions are at Claude's discretion.

### Claude's Discretion
- **D-01:** Score visualization approach (weekly trends) -- Claude decides the best format that fits existing table/card patterns. No charting library exists; keep it dependency-free.
- **D-02:** Score distribution breakdown format -- Claude decides between numeric buckets, letter grades, summary stats, or hybrid. Pick what's most useful for an owner monitoring call quality.
- **D-03:** Agent coaching signals -- Claude decides whether to add visual flags (threshold-based, trend-based, or none). Sortable columns are the minimum; any additional signals are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCORE-01 | Owner dashboard has Scoring tab showing aggregate KPIs (avg score, total audits, score distribution) | StatCard pattern from OwnerOverview/OwnerKPIs, new API aggregation endpoint |
| SCORE-02 | Per-agent score breakdown table with sortable columns | OwnerKPIs.tsx AgentKPITable pattern with sort state, toggle, chevron icons |
| SCORE-03 | Weekly trend data showing score changes over time | API groups by ISO week, table renders week-over-week with delta arrows |
| SCORE-04 | DateRangeFilter integration on scoring tab | DateRangeProvider already at layout level; useDateRange + buildDateParams pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | UI rendering | Already in use across all dashboards |
| Express | 4.x | API routes | ops-api framework |
| Prisma | existing | DB queries | ORM already configured for CallAudit model |
| Zod | existing | Request validation | Used in all API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons | StatCard icons, sort chevrons, trend arrows |
| @ops/ui | workspace | StatCard, DateRangeFilter, tokens | All UI components and styling |
| @ops/auth/client | workspace | authFetch | API calls from dashboard |
| @ops/utils | workspace | formatDollar (if needed) | Currency formatting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML table for trends | Chart.js/Recharts | Adds dependency; project has no charting lib; HTML table matches existing patterns |
| Computed trend badges | No coaching signals | Sortable columns alone meet requirements; badges add immediate value at low cost |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/ops-dashboard/app/(dashboard)/owner/
  OwnerScoring.tsx          # NEW -- scoring tab component
  page.tsx                  # MODIFIED -- add "scoring" to ActiveSection, tab button, render

apps/ops-api/src/routes/
  ai-budget.ts              # MODIFIED -- add GET /ai/scoring-stats endpoint
```

### Pattern 1: Owner Tab Registration
**What:** Adding a new tab to the owner dashboard
**When to use:** Every new owner tab follows this pattern
**Example:**
```typescript
// page.tsx changes:
// 1. Extend the union type
type ActiveSection = "overview" | "kpis" | "config" | "users" | "scoring";

// 2. Add nav item (with appropriate lucide icon)
{ icon: <Target size={18} />, label: "Scoring", key: "scoring" }

// 3. Add subtitle
scoring: "AI audit scores and agent quality trends"

// 4. Add conditional render
{activeTab === "scoring" && <OwnerScoring API={API} />}
```

### Pattern 2: Sortable Agent Table (from OwnerKPIs.tsx)
**What:** Table with clickable column headers that toggle sort direction
**When to use:** Any per-agent data table
**Example:**
```typescript
// State
const [sortCol, setSortCol] = useState<keyof AgentScore>("avgScore");
const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

// Toggle function
const toggleSort = (col: keyof AgentScore) => {
  if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
  else { setSortCol(col); setSortDir("desc"); }
};

// Sort icon inline
const SortIcon = ({ col }: { col: keyof AgentScore }) => {
  if (sortCol !== col) return null;
  return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
};

// Column header
<th style={{ ...baseThStyle, cursor: "pointer", userSelect: "none" }}
    onClick={() => toggleSort("avgScore")}>
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
    Avg Score <SortIcon col="avgScore" />
  </span>
</th>
```

### Pattern 3: DateRangeFilter Integration
**What:** Using the shared date range context for filtering
**When to use:** Every tab that supports date filtering
**Example:**
```typescript
// In component
const { value: dateRange, onChange: setDateRange } = useDateRange();

// Build query params
function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to) return `from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `range=${dr.preset}`;
  return "";
}

// Fetch on range change
useEffect(() => {
  const dp = buildDateParams(dateRange);
  const qs = dp ? `?${dp}` : "";
  authFetch(`${API}/api/ai/scoring-stats${qs}`)
    .then(r => r.ok ? r.json() : null)
    .then(setData)
    .catch(() => {});
}, [API, dateRange]);

// Render filter
<DateRangeFilter value={dateRange} onChange={setDateRange} presets={KPI_PRESETS} />
```

### Pattern 4: API Aggregation Endpoint
**What:** Server-side aggregation with Prisma for scoring stats
**When to use:** New read-only analytics endpoints
**Example:**
```typescript
// In ai-budget.ts
router.get("/ai/scoring-stats", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const dr = dateRange(req.query.range as string, req.query.from as string, req.query.to as string);
    const where: any = { aiScore: { not: null } };
    if (dr) where.callDate = { gte: dr.gte, lt: dr.lt };

    // Aggregate KPIs
    const agg = await prisma.callAudit.aggregate({
      where,
      _avg: { aiScore: true },
      _count: { id: true },
    });

    // Per-agent breakdown
    const byAgent = await prisma.callAudit.groupBy({
      by: ["agentId"],
      where,
      _avg: { aiScore: true },
      _count: { id: true },
    });

    // ... resolve agent names, compute weekly trends
    res.json({ aggregate, agents, weeklyTrends });
  })
);
```

### Anti-Patterns to Avoid
- **Client-side aggregation:** Do NOT fetch all CallAudit records and aggregate in the browser. Use Prisma `aggregate()` and `groupBy()` on the server.
- **Custom charting library:** Do NOT add chart.js/recharts. Use HTML tables for weekly trends -- consistent with existing codebase patterns.
- **Separate DateRangeFilter state:** Do NOT create a local date range state. Use `useDateRange()` from the shared context so all owner tabs share the same date range.
- **New route file:** Do NOT create a new route file for one endpoint. Add to `ai-budget.ts` which already owns AI-related endpoints.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range filtering | Custom date parsing | `dateRange()` from `./helpers` | Handles presets, custom ranges, edge cases |
| Sort state management | Custom sort hook | Inline pattern from OwnerKPIs | 15 lines, works perfectly, no abstraction needed |
| Score aggregation | Raw SQL | Prisma `aggregate()` + `groupBy()` | Type-safe, handles NULL filtering |
| Date range UI | Custom date picker | `DateRangeFilter` from @ops/ui | Already used in every owner tab |
| Stat display cards | Custom card layout | `StatCard` from @ops/ui | Consistent look, supports trends |

**Key insight:** Every building block for this phase already exists in the codebase. The implementation is composition of existing patterns, not invention.

## Common Pitfalls

### Pitfall 1: Forgetting aiScore NULL filtering
**What goes wrong:** Prisma `aggregate()` on `aiScore` includes rows where `aiScore` is NULL, skewing averages.
**Why it happens:** `aiScore` is optional (`Int?`). Many CallAudit records may have manual scores (`score` field) but no AI score.
**How to avoid:** Always include `aiScore: { not: null }` in the `where` clause for all scoring queries.
**Warning signs:** Average scores appear much lower than expected.

### Pitfall 2: Confusing score vs aiScore
**What goes wrong:** Using `score` (manual reviewer score) instead of `aiScore` (AI-generated score).
**Why it happens:** CallAudit has two score fields: `score: Int` (required, manual) and `aiScore: Int?` (optional, AI-generated).
**How to avoid:** All scoring dashboard queries must use `aiScore` exclusively since this is the "AI Scoring" dashboard.
**Warning signs:** Scores appear for audits that were never AI-scored.

### Pitfall 3: Weekly trend grouping timezone issues
**What goes wrong:** ISO week boundaries shift depending on server timezone, causing inconsistent weekly buckets.
**Why it happens:** `callDate` is stored as UTC DateTime, but week grouping may use server local time.
**How to avoid:** Group by extracting ISO week from the UTC `callDate` value. Use `$queryRaw` or compute week numbers in JS from the fetched dates.
**Warning signs:** Edge-of-week audits appear in different weeks depending on when the query runs.

### Pitfall 4: Missing role authorization
**What goes wrong:** Endpoint accessible to roles that shouldn't see scoring data.
**Why it happens:** Copy-pasting from a route with different role requirements.
**How to avoid:** Use `requireRole("OWNER_VIEW", "SUPER_ADMIN")` -- same as other AI/budget endpoints in `ai-budget.ts`.
**Warning signs:** Non-owner users can access the scoring tab.

### Pitfall 5: Not handling empty data states
**What goes wrong:** Component crashes or shows blank when no audits have AI scores.
**Why it happens:** Division by zero in averages, or trying to render empty arrays.
**How to avoid:** Use `EmptyState` component from @ops/ui. Guard against zero counts before computing percentages.
**Warning signs:** White screen or NaN values displayed.

## Code Examples

### Aggregate KPI Computation (API side)
```typescript
// Source: Prisma aggregate/groupBy patterns used throughout ops-api
const where: any = { aiScore: { not: null } };
if (dr) where.callDate = { gte: dr.gte, lt: dr.lt };

const agg = await prisma.callAudit.aggregate({
  where,
  _avg: { aiScore: true },
  _count: { id: true },
  _min: { aiScore: true },
  _max: { aiScore: true },
});

// Score distribution buckets (0-49 Poor, 50-69 Fair, 70-84 Good, 85-100 Excellent)
const distribution = await Promise.all([
  prisma.callAudit.count({ where: { ...where, aiScore: { gte: 0, lt: 50 } } }),
  prisma.callAudit.count({ where: { ...where, aiScore: { gte: 50, lt: 70 } } }),
  prisma.callAudit.count({ where: { ...where, aiScore: { gte: 70, lt: 85 } } }),
  prisma.callAudit.count({ where: { ...where, aiScore: { gte: 85, lte: 100 } } }),
]);
```

### Per-Agent Score Breakdown (API side)
```typescript
// Group by agent, compute averages
const byAgent = await prisma.callAudit.groupBy({
  by: ["agentId"],
  where,
  _avg: { aiScore: true },
  _count: { id: true },
});

// Resolve agent names
const agentIds = byAgent.map(a => a.agentId);
const agents = await prisma.agent.findMany({
  where: { id: { in: agentIds } },
  select: { id: true, name: true },
});
const nameMap = new Map(agents.map(a => [a.id, a.name]));

const agentScores = byAgent.map(a => ({
  agentId: a.agentId,
  agentName: nameMap.get(a.agentId) ?? "Unknown",
  avgScore: Math.round(a._avg.aiScore ?? 0),
  auditCount: a._count.id,
}));
```

### Weekly Trend Computation (API side)
```typescript
// Fetch raw scored audits for trend calculation
const scored = await prisma.callAudit.findMany({
  where,
  select: { aiScore: true, callDate: true },
  orderBy: { callDate: "asc" },
});

// Group by ISO week
const weekMap = new Map<string, number[]>();
for (const audit of scored) {
  const d = new Date(audit.callDate);
  // ISO week key: YYYY-Www
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  if (!weekMap.has(key)) weekMap.set(key, []);
  weekMap.get(key)!.push(audit.aiScore!);
}

// Compute weekly averages
const weeklyTrends = [...weekMap.entries()]
  .map(([week, scores]) => ({
    week,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    auditCount: scores.length,
  }))
  .sort((a, b) => a.week.localeCompare(b.week));
```

### Score Distribution Display (Frontend)
```typescript
// D-02 recommendation: Numeric buckets with color-coded badges
// Most useful for owners -- immediately see what % of calls are below standard

const SCORE_BUCKETS = [
  { label: "Excellent", range: "85-100", color: colors.success, key: "excellent" },
  { label: "Good", range: "70-84", color: colors.accentTeal, key: "good" },
  { label: "Fair", range: "50-69", color: colors.warning, key: "fair" },
  { label: "Poor", range: "0-49", color: colors.danger, key: "poor" },
] as const;

// Render as a horizontal bar or inline badges within a card
```

### Trend Direction Indicator (Frontend)
```typescript
// D-01 recommendation: Table with week column + delta arrow
// Consistent with how OwnerOverview shows trends

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta === 0) return <span style={{ color: colors.textTertiary }}>--</span>;
  const color = delta > 0 ? colors.success : colors.danger;
  const Icon = delta > 0 ? ChevronUp : ChevronDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color, fontSize: 12, fontWeight: 600 }}>
      <Icon size={12} /> {Math.abs(delta)} pts
    </span>
  );
}
```

### Agent Coaching Signal (Frontend)
```typescript
// D-03 recommendation: Threshold-based color for avg score cell
// Simple, immediately useful, no extra UI complexity

function scoreColor(avg: number): string {
  if (avg >= 85) return colors.success;
  if (avg >= 70) return colors.accentTeal;
  if (avg >= 50) return colors.warning ?? "#eab308";
  return colors.danger;
}

// In table cell:
<td style={{ ...baseTdStyle, textAlign: "right", color: scoreColor(agent.avgScore), fontWeight: 600 }}>
  {agent.avgScore}
</td>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw SQL aggregation | Prisma aggregate/groupBy | Prisma 4+ | Type-safe, no SQL injection risk |
| Per-component date state | Shared DateRangeContext | v1.2 (project) | All tabs share date range |
| Custom card components | @ops/ui StatCard | v1.1 (project) | Consistent look, trend support |

**Deprecated/outdated:**
- None relevant -- all patterns in use are current.

## Open Questions

1. **How many CallAudit records have aiScore populated?**
   - What we know: aiScore is optional, written by AI auto-scoring via `auditQueue.ts`
   - What's unclear: Volume of scored audits (affects whether pagination is needed)
   - Recommendation: The endpoint should work fine without pagination since it returns aggregates, not raw records. The weekly trend query fetches individual records but only selects two columns; this scales to thousands of records without issue.

2. **Should the scoring tab be visible to MANAGER role?**
   - What we know: Current AI endpoints in `ai-budget.ts` require `OWNER_VIEW` or `SUPER_ADMIN`. Call audit listing requires `MANAGER`.
   - What's unclear: Whether managers should see aggregate scoring data
   - Recommendation: Match `ai-budget.ts` pattern -- `OWNER_VIEW` and `SUPER_ADMIN` only. This is an owner dashboard tab.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service) |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- helpers.test.js` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | API returns aggregate KPIs (avg, count, distribution) | integration | Manual verification via curl/browser | No -- frontend-heavy |
| SCORE-02 | Per-agent breakdown returns sorted data | integration | Manual verification via curl/browser | No -- frontend-heavy |
| SCORE-03 | Weekly trend data grouped by ISO week | unit | `npm test -- scoring` | No -- Wave 0 |
| SCORE-04 | Date range params filter results | integration | Manual verification via curl/browser | No -- frontend-heavy |

### Sampling Rate
- **Per task commit:** Manual browser verification (owner dashboard scoring tab)
- **Per wave merge:** Full manual walkthrough of all 4 requirements
- **Phase gate:** All StatCards render, table sorts correctly, date range filters data

### Wave 0 Gaps
- None critical -- this is primarily frontend composition of existing patterns. The API endpoint uses Prisma aggregate/groupBy which is well-tested by Prisma itself. Optional: a unit test for ISO week grouping logic if extracted to a helper function.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- CallAudit model with aiScore field definition
- `apps/ops-dashboard/app/(dashboard)/owner/page.tsx` -- Owner tab registration pattern
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerKPIs.tsx` -- Sortable agent table pattern
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` -- StatCard + DateRangeFilter pattern
- `apps/ops-api/src/routes/ai-budget.ts` -- AI endpoint patterns, role requirements
- `apps/ops-api/src/routes/call-audits.ts` -- CallAudit query patterns
- `apps/ops-api/src/routes/helpers.ts` -- dateRange helper function
- `packages/ui/src/components/StatCard.tsx` -- StatCard props interface and trend support
- `apps/ops-dashboard/lib/DateRangeContext.tsx` -- Shared date range context

### Secondary (MEDIUM confidence)
- Prisma documentation for `aggregate()` and `groupBy()` -- standard Prisma features

### Tertiary (LOW confidence)
- None -- all findings verified from codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- exact patterns exist in OwnerKPIs.tsx and OwnerOverview.tsx
- Pitfalls: HIGH -- identified from direct codebase inspection (dual score fields, NULL handling)

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- internal project patterns)
