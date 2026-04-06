# Architecture Patterns

**Domain:** Batch chargeback review and payroll agent tab navigation
**Researched:** 2026-04-06

## Recommended Architecture

Two independent feature areas that touch different parts of the stack but share no new data dependencies between them. Build them as parallel workstreams.

### Feature 1: Batch Chargeback Review (CS Dashboard)

Extends the existing paste-to-parse chargeback flow in `CSSubmissions.tsx` with a pre-submit review table that shows match results before the user commits.

### Feature 2: Payroll Agent Tabs (Payroll Dashboard)

Replaces the vertically-scrolled `AgentCard` list in `PayrollPeriods.tsx` with a left sidebar of agent names. Selecting an agent shows their last 4 pay periods with a "Load More" button for pagination.

---

## Component Boundaries

### New Components

| Component | File Location | Responsibility | Communicates With |
|-----------|---------------|----------------|-------------------|
| `ChargebackReviewTable` | `cs/ChargebackReviewTable.tsx` | Pre-submit table showing parsed chargebacks with match status, agent name, member info, product selection, amounts | `CSSubmissions` (parent) |
| `AgentSidebar` | `payroll/AgentSidebar.tsx` | Left sidebar listing agent names with sale counts, sorted by gross earnings | `PayrollPeriods` (parent) |

### Modified Components

| Component | File | What Changes |
|-----------|------|--------------|
| `CSSubmissions.tsx` | `cs/CSSubmissions.tsx` | Add batch preview step between parse and submit. After paste-to-parse, show `ChargebackReviewTable` instead of immediately rendering editable rows. User confirms/edits each row, then bulk-submits. |
| `PayrollPeriods.tsx` | `payroll/PayrollPeriods.tsx` | Replace `sortedAgents.map(AgentCard)` scroll list with `AgentSidebar` + single `AgentCard` for the selected agent. Fetch periods per-agent instead of all-at-once. |
| `payroll/page.tsx` | `payroll/page.tsx` | Possibly adjust initial data load to defer period fetching (agent list only on mount, periods on agent select). |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `AgentCard.tsx` | Already renders a single agent's data with week sections. Just receives different data (4 periods instead of all). |
| `WeekSection.tsx` | No changes needed. Renders one period's entries for one agent. |
| `PayrollChargebacks.tsx` | This is the payroll-side chargeback alert view, not the CS submission flow. |

---

## Data Flow Changes

### Chargeback Batch Review

**Current flow:**
```
Paste text -> parseChargebackText() -> consolidateByMember() -> fetchBatchAssign()
  -> setRecords() -> render editable table rows -> Submit all -> POST /api/chargebacks
```

**New flow:**
```
Paste text -> parseChargebackText() -> consolidateByMember() -> fetchBatchAssign()
  -> setRecords() -> render REVIEW TABLE (read-only match preview)
  -> User can: toggle product inclusion, edit amounts, remove rows
  -> User clicks "Submit" -> POST /api/chargebacks (unchanged API)
```

**Key change:** The existing editable table becomes a review step. The API endpoint (`POST /api/chargebacks`) stays the same -- it already accepts `records[]` array. The review table adds a client-side pre-submit preview that shows:

1. **Matched agent** -- call a new lightweight API endpoint to look up the agent name from `memberId` before submitting
2. **Member name/ID** -- already parsed from paste
3. **Products with checkboxes** -- when a member has multiple products in the paste, allow partial selection (deselect individual products from the chargeback)
4. **Chargeback amount per entry** -- editable, pre-filled from parsed data

**New API endpoint needed:**

```
GET /api/chargebacks/preview-match?memberIds=id1,id2,id3
```

Returns match results for each memberId so the review table can show agent names and match status before submit. This avoids the current pattern where matching happens _after_ submission in the POST handler.

Response shape:
```typescript
{
  matches: {
    [memberId: string]: {
      status: "MATCHED" | "MULTIPLE" | "UNMATCHED";
      agentName?: string;
      saleName?: string;
      saleId?: string;
    }
  }
}
```

This is a read-only query that reuses the same `prisma.sale.findMany({ where: { memberId } })` logic already in the POST handler.

### Payroll Agent Tabs

**Current flow:**
```
Mount -> fetch ALL periods (GET /api/payroll/periods) -> client-side regroup by agent
  -> render all AgentCards in a scroll list
```

**New flow:**
```
Mount -> fetch agent list (GET /api/agents, already fetched) + fetch last 4 periods
  -> render AgentSidebar (left) + selected agent's AgentCard (right)
  -> "Load More" -> fetch next 4 periods for that agent
```

**Option A: Keep existing all-periods fetch, paginate client-side.**
The current `/api/payroll/periods` endpoint fetches ALL periods with all entries. For a small team (10-20 agents, 10-20 periods), this is fine. The client already does agent regrouping via `useMemo`. Just slice the `agentData.periods` array to show 4 at a time with "Load More" revealing the next batch.

**Option B: New per-agent paginated endpoint.**
`GET /api/payroll/agent-periods/:agentId?limit=4&offset=0` returns only that agent's entries. Better for scale but adds API complexity.

**Recommendation: Option A** -- client-side pagination of existing data. The current fetch already works, the data volume is small (10-20 agents x 10-20 periods), and it avoids a new endpoint. The `agentData` Map already groups by agent. Just add a `visibleCount` state per agent (default 4) and slice `agentData.periods.slice(0, visibleCount)`. "Load More" increments `visibleCount` by 4.

If data grows beyond ~50 periods, Option B can be added later without UI changes (just swap the data source).

---

## Architecture Patterns

### Pattern 1: Preview-Before-Submit

**What:** Parse input, show results in a review table, let user edit/deselect, then submit.

**When:** Batch operations where the user needs to verify before committing.

**Implementation:**
```typescript
// State machine for submission flow
type SubmitPhase = "input" | "review" | "submitting" | "done";

const [phase, setPhase] = useState<SubmitPhase>("input");
const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);

// Parse triggers review
function handleParse(text: string) {
  const parsed = parseChargebackText(text);
  const consolidated = consolidateByMember(parsed);
  // Fetch match previews
  const memberIds = consolidated.map(r => r.memberId).filter(Boolean);
  const matches = await authFetch(`${API}/api/chargebacks/preview-match?memberIds=${memberIds.join(",")}`);
  // Merge match data into records
  setReviewRecords(consolidated.map(r => ({
    ...r,
    matchStatus: matches[r.memberId]?.status ?? "UNMATCHED",
    agentName: matches[r.memberId]?.agentName ?? null,
    included: true, // checkbox state
  })));
  setPhase("review");
}

// Submit only included records
function handleSubmit() {
  const toSubmit = reviewRecords.filter(r => r.included);
  // POST /api/chargebacks with filtered records
}
```

### Pattern 2: Sidebar-Content Split with Client Pagination

**What:** Left sidebar lists items, clicking one shows its detail in the main content area. Detail data is paginated client-side from an already-fetched dataset.

**When:** The dataset fits in memory but showing all at once is overwhelming.

**Implementation:**
```typescript
const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
const [visiblePeriods, setVisiblePeriods] = useState<Map<string, number>>(
  new Map() // agent name -> number of visible periods
);

// Default to 4 visible periods per agent
const getVisibleCount = (agent: string) => visiblePeriods.get(agent) ?? 4;

// Slice periods for display
const displayPeriods = agentData.get(selectedAgent)?.periods
  .sort(byWeekStartDesc)
  .slice(0, getVisibleCount(selectedAgent));

// Load more
const handleLoadMore = () => {
  setVisiblePeriods(prev => {
    const next = new Map(prev);
    next.set(selectedAgent, getVisibleCount(selectedAgent) + 4);
    return next;
  });
};
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Endpoints for Match Preview vs Submission

**What:** Creating a complex preview endpoint that duplicates the matching logic from the POST handler.

**Why bad:** Two places to maintain matching logic. They drift.

**Instead:** Extract the matching logic into a shared service function (`matchChargebackToSale(memberId)`) used by both the preview endpoint and the POST handler. Keep matching logic in one place.

### Anti-Pattern 2: Server-Side Pagination for Small Datasets

**What:** Building a paginated API endpoint for agent periods when there are only 10-20 periods total.

**Why bad:** Adds endpoint complexity, requires cursor/offset handling, complicates Socket.IO real-time updates (which period page is the user on?).

**Instead:** Fetch all periods upfront (existing pattern), paginate client-side with a simple slice. The `visibleCount` state is trivial to manage.

### Anti-Pattern 3: Breaking the AgentCard/WeekSection Hierarchy

**What:** Creating a completely new component structure for the tabbed layout.

**Why bad:** AgentCard and WeekSection already handle all the payroll display logic (print, paid/unpaid, edit requests, etc.). Rewriting duplicates hundreds of lines.

**Instead:** Keep AgentCard and WeekSection unchanged. The sidebar just controls which agent's data feeds into the existing AgentCard. The only change is that AgentCard receives a sliced `agentData` (4 periods) instead of all periods.

### Anti-Pattern 4: Adding Review State to the API

**What:** Persisting "draft" or "review" chargebacks to the database before the user confirms.

**Why bad:** Adds draft cleanup logic, orphan handling, and state machine complexity to the API.

**Instead:** Keep the review table entirely client-side. Nothing hits the database until the user clicks "Submit." The preview-match endpoint is a read-only query.

---

## Integration Points

### Chargeback Batch Review

| Layer | What | Integration Point |
|-------|------|-------------------|
| **API** | New `GET /api/chargebacks/preview-match` endpoint | `apps/ops-api/src/routes/chargebacks.ts` -- add to existing router |
| **API** | Extract `matchMemberIdToSale()` helper | `apps/ops-api/src/routes/chargebacks.ts` -- refactor existing POST handler to use shared function |
| **Client** | `ChargebackReviewTable` component | `apps/ops-dashboard/app/(dashboard)/cs/ChargebackReviewTable.tsx` -- new file |
| **Client** | Modified `CSSubmissions.tsx` | Add `SubmitPhase` state machine, call preview-match on parse, render review table |
| **Socket.IO** | No changes | Existing `emitCSChanged()` in POST handler covers real-time updates |

### Payroll Agent Tabs

| Layer | What | Integration Point |
|-------|------|-------------------|
| **API** | No new endpoints | Existing `GET /api/payroll/periods` and `GET /api/agents` suffice |
| **Client** | `AgentSidebar` component | `apps/ops-dashboard/app/(dashboard)/payroll/AgentSidebar.tsx` -- new file |
| **Client** | Modified `PayrollPeriods.tsx` | Replace AgentCard scroll list with sidebar+detail layout, add `visiblePeriods` state |
| **Types** | No schema changes | `payroll-types.ts` unchanged |
| **Socket.IO** | No changes | Existing `sale:changed` handler updates `periods` state, `useMemo` recomputes `agentData` |

---

## Suggested Build Order

Build order considers feature independence and dependency chains.

### Phase 1: Payroll Agent Tabs

**Rationale:** Self-contained UI refactor with zero API changes. Lower risk. Provides immediate UX improvement. No new endpoints, no schema changes, no migration.

1. Create `AgentSidebar` component (agent name list, click handler, active highlight)
2. Modify `PayrollPeriods.tsx` layout: sidebar (240px fixed) + content area
3. Add `selectedAgent` state, default to first agent
4. Add `visiblePeriods` Map state, default 4 per agent
5. Slice `agentData.periods` by `visiblePeriods` count
6. Add "Load More" button when `totalPeriods > visibleCount`
7. Preserve all existing AgentCard/WeekSection functionality

### Phase 2: Chargeback Batch Review

**Rationale:** Requires one new API endpoint (preview-match) and a new client component. Slightly higher complexity due to the match-preview integration.

1. Extract `matchMemberIdToSale()` from POST handler into shared function
2. Add `GET /api/chargebacks/preview-match` endpoint using shared function
3. Create `ChargebackReviewTable` component
4. Add `SubmitPhase` state machine to `CSSubmissions.tsx`
5. Wire parse -> preview-match API call -> review table render
6. Add product inclusion checkboxes, amount editing, row removal
7. Submit only included/edited records via existing POST endpoint

---

## Scalability Considerations

| Concern | Current (10-20 agents) | At 50 agents | At 100+ agents |
|---------|------------------------|--------------|----------------|
| Period data volume | Fetch all (~50KB) | Fetch all (~200KB) | Add per-agent API endpoint |
| Agent sidebar | All fit on screen | Scrollable, add search filter | Virtual scroll |
| Chargeback batch size | 5-20 per paste | 50+ per paste | Add batch size limit warning |
| Preview-match API | Individual queries | Batch query OK | Add index on Sale.memberId if missing |

## Sources

- Direct codebase analysis (HIGH confidence)
- `apps/ops-api/src/routes/chargebacks.ts` -- existing POST handler with matching logic
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` -- existing parse flow
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- existing agent data regrouping
- `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` -- existing card component
- `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` -- existing type definitions
- `packages/ui/src/index.tsx` -- PageShell and NavItem interfaces
