# Phase 29: Dashboard Fixes & Cost Tracking - Research

**Researched:** 2026-03-25
**Domain:** React dashboard UI fixes, Express API routes, Prisma data flow, Convoso poller repair
**Confidence:** HIGH

## Summary

Phase 29 addresses 14 requirements across five workstreams: (1) bug fixes for premium display and lead source form, (2) manager config products read-only conversion, (3) Convoso KPI poller repair to write individual call records to ConvosoCallLog, (4) cost tracking display logic in manager/owner dashboards, and (5) a new CS Resolved Log audit tab. All changes touch existing, well-understood code paths with established patterns.

The codebase has clear conventions: inline CSSProperties, asyncHandler wrappers, Zod validation with zodErr(), and role-based access via requireRole(). Every requirement maps to specific files already identified in CONTEXT.md canonical refs. The primary risk is the Convoso poller change (DATA-01/DATA-02) which modifies a production worker -- all other changes are isolated UI or straightforward API additions.

**Primary recommendation:** Implement in dependency order -- bug fixes first (independent), then Convoso poller repair (DATA-01/02), then cost display (DATA-03/04/05 depend on ConvosoCallLog data), config cleanup and CS resolved log can parallel.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Premium column in ManagerSales.tsx line 422 must sum core + addon premiums per row, matching the card-level total logic at lines 388-392
- **D-02:** Lead source create form in ManagerConfig.tsx must add a Buffer (seconds) number input field matching the edit form
- **D-03:** Lead source POST API in agents.ts must add `callBufferSeconds: z.number().int().min(0).optional()` to the Zod schema
- **D-04:** Products section in ManagerConfig.tsx becomes read-only -- remove add/edit/delete buttons and form
- **D-05:** Read-only view shows a simplified table: Product Name | Type (CORE/ADDON/AD_D) | Commission Rate | Bundle Config
- **D-06:** The KPI poller (convosoKpiPoller.ts) must write individual call records to the ConvosoCallLog table, not just AgentCallKpi snapshots
- **D-07:** Deduplication uses the `newRaw` array (post-dedup filter from ProcessedConvosoCall table) to avoid creating duplicates across poll cycles
- **D-08:** Keep AgentCallKpi writes as-is (parallel snapshot) -- do not deprecate
- **D-09:** Convoso not configured (no auth token): show "---" in cost columns (existing behavior)
- **D-10:** Convoso configured but no data: show "$0.00" for lead spend, "---" for cost per sale
- **D-11:** Agent with calls but zero sales: show total lead spend amount, "---" for cost per sale (avoid divide-by-zero)
- **D-12:** Agent with zero calls: show "$0.00" for lead spend, "---" for cost per sale
- **D-13:** Unified table combining resolved chargebacks and pending terms with a filterable "Type" column
- **D-14:** Columns: Type | Agent | Member | Resolution Date | Resolved By | Resolution Note | Original Amount
- **D-15:** Sorted by resolution date (most recent first)
- **D-16:** Notes displayed inline in table cell (truncated with expand-on-click if long)
- **D-17:** Tab visible only to OWNER_VIEW and SUPER_ADMIN roles (not CUSTOMER_SERVICE)
- **D-18:** Filterable by type (chargeback/pending term), date range, and agent
- **D-19:** Static audit view -- no Socket.IO real-time updates needed

### Claude's Discretion
- Exact implementation of ConvosoCallLog field mapping from Convoso API response
- How to handle Convoso API field name verification (call_date vs start_time)
- CS Resolved Log API endpoint design (single unified endpoint vs two separate fetches)
- Notes truncation threshold and expand interaction

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | Manager Agent Sales tab displays total premium (core + addon) per row | Line 422 in ManagerSales.tsx shows only `s.premium`; card-level logic at 388-392 shows correct addon summation pattern to copy |
| FIX-02 | Lead source create form includes Buffer (seconds) field | ManagerConfig.tsx line 316 missing callBufferSeconds in newLS state; edit form at line 162/172 has the field pattern to copy |
| FIX-03 | Lead source POST API accepts callBufferSeconds | agents.ts line 76 schema missing callBufferSeconds; PATCH at line 92 already has it -- copy same field definition |
| CFG-01 | Manager Config Products section is read-only | ProductRow component (line 222) has edit mode; remove edit button and onSave prop; keep read-only display (lines 237-258) |
| CFG-02 | Read-only Products view shows name, type, commission rates, bundle config | Existing ProductRow read mode already shows this info (lines 240-253); simplify to table format per D-05 |
| DATA-01 | Convoso KPI poller writes to ConvosoCallLog | convosoKpiPoller.ts currently only writes AgentCallKpi (line 120); must add prisma.convosoCallLog.createMany with field mapping from raw Convoso response |
| DATA-02 | Poller deduplicates ConvosoCallLog records | Already deduplicates via ProcessedConvosoCall (lines 59-65); newRaw array available for ConvosoCallLog writes |
| DATA-03 | Cost per sale displays in Manager Tracker | ManagerTracker.tsx line 197 already renders costPerSale; depends on ConvosoCallLog data being populated (DATA-01) |
| DATA-04 | Cost per sale displays in Owner Dashboard | OwnerOverview.tsx line 260 already renders costPerSale; same dependency on ConvosoCallLog |
| DATA-05 | Agent lead spend shows with zero sales | Display logic needs update: show totalLeadCost even when salesCount=0; costPerSale shows "---" per D-11/D-12 |
| CS-01 | CS dashboard has Resolved Log tab for OWNER_VIEW/SUPER_ADMIN | CS page.tsx (line 33) already conditionally shows tabs based on canManageCS; add third tab for resolved log |
| CS-02 | Resolved Log displays resolved chargebacks | ChargebackSubmission model has resolvedAt, resolvedBy, resolutionNote fields; query where resolvedAt IS NOT NULL |
| CS-03 | Resolved Log displays resolved pending terms | PendingTerm model has same resolution fields; unify with chargebacks in single response |
| CS-04 | Resolved Log supports filtering by type, date range, agent | Use existing DateRangeFilter component from @ops/ui; add type dropdown and agent filter |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (Next.js 15) | Dashboard UI components | Project standard |
| Express.js | 4.x | API routes | Project standard |
| Prisma | 6.x | Database ORM | Project standard |
| Zod | 3.x | Request validation | Project standard with zodErr() wrapper |
| @ops/ui | workspace | Shared components (Card, Badge, DateRangeFilter, etc.) | Monorepo package |
| @ops/auth/client | workspace | authFetch for API calls | Monorepo package |
| @ops/utils | workspace | formatDollar, formatDate, logEvent | Monorepo package |
| lucide-react | latest | Icons | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| socket.io-client | latest | Real-time updates | NOT needed for CS Resolved Log (D-19: static view) |

### Alternatives Considered
None -- all work uses existing stack.

## Architecture Patterns

### Recommended Implementation Structure

All changes are in existing files except one new component:

```
apps/ops-api/src/
  routes/agents.ts            # FIX-03: add callBufferSeconds to POST schema
  routes/cs-reps.ts           # CS-01 through CS-04: new resolved-log endpoint
  workers/convosoKpiPoller.ts # DATA-01, DATA-02: add ConvosoCallLog writes

apps/ops-dashboard/app/(dashboard)/
  manager/
    ManagerSales.tsx    # FIX-01: fix premium per-row display
    ManagerConfig.tsx   # FIX-02: add buffer field; CFG-01/02: read-only products
    ManagerTracker.tsx  # DATA-03, DATA-05: fix cost display logic
  owner/
    OwnerOverview.tsx   # DATA-04, DATA-05: fix cost display logic
  cs/
    page.tsx            # CS-01: add resolved log tab
    CSResolvedLog.tsx   # NEW: CS-02, CS-03, CS-04 component
```

### Pattern 1: Premium Calculation Fix (FIX-01)

**What:** Line 422 in ManagerSales.tsx shows `formatDollar(Number(s.premium))` which is core-only. Must match the card-level pattern at lines 388-392 that sums addons.

**Current (broken):**
```typescript
// Line 422 - only shows core premium
<td>{formatDollar(Number(s.premium))}</td>
```

**Fix pattern (from card-level lines 388-392):**
```typescript
const saleWithAddons = s as Sale & { addons?: { premium?: number | null }[] };
const addonTotal = saleWithAddons.addons?.reduce((aSum: number, a) => aSum + Number(a.premium ?? 0), 0) ?? 0;
const rowTotal = Number(s.premium ?? 0) + addonTotal;
// Then: formatDollar(rowTotal)
```

### Pattern 2: Lead Source Create Form Fix (FIX-02 + FIX-03)

**What:** The create form (line 316/391) is missing `callBufferSeconds`. The edit form (line 162/172) already has it.

**Frontend fix:**
```typescript
// State: add callBufferSeconds
const [newLS, setNewLS] = useState({ name: "", listId: "", costPerLead: "", callBufferSeconds: "0" });

// Form: add input (copy from edit form line 172)
<Input label="Call buffer (s)" type="number" min="0" value={newLS.callBufferSeconds}
  onChange={e => setNewLS(x => ({ ...x, callBufferSeconds: e.target.value }))} />

// Submit: include in body
body: JSON.stringify({
  name: newLS.name,
  listId: newLS.listId || undefined,
  costPerLead: Number(newLS.costPerLead) || 0,
  callBufferSeconds: Number(newLS.callBufferSeconds) || 0,
})
```

**API fix (agents.ts line 76):**
```typescript
const schema = z.object({
  name: z.string().min(1),
  listId: z.string().optional(),
  costPerLead: z.number().min(0).default(0),
  callBufferSeconds: z.number().int().min(0).optional(), // ADD THIS
});
```

### Pattern 3: Products Read-Only (CFG-01/CFG-02)

**What:** Replace ProductRow interactive component with a static table. Remove edit button, form, onSave.

**Implementation:** Replace the Products section (lines 447-455) with a simple table:
```typescript
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
  <thead>
    <tr>
      {["Product", "Type", "Commission", "Bundle Config"].map(h => (
        <th key={h} style={baseThStyle}>{h}</th>
      ))}
    </tr>
  </thead>
  <tbody>
    {products.map(p => (
      <tr key={p.id}>
        <td style={baseTdStyle}>{p.name}</td>
        <td style={baseTdStyle}><Badge ...>{TYPE_LABELS[p.type]}</Badge></td>
        <td style={baseTdStyle}>{/* commission rates based on type */}</td>
        <td style={baseTdStyle}>{/* bundle config for ADDON/AD_D */}</td>
      </tr>
    ))}
  </tbody>
</table>
```

Can also remove `saveProduct` function, `refreshProducts` usage, and simplify props.

### Pattern 4: ConvosoCallLog Writes in Poller (DATA-01/DATA-02)

**What:** After deduplication (line 65 `newRaw`), write individual call records to ConvosoCallLog table before aggregating into AgentCallKpi.

**ConvosoCallLog model fields:**
- `agentUser` (String) -- maps from raw `user_id`
- `listId` (String) -- from leadSource.listId
- `recordingUrl` (String?) -- from raw `recording_url`
- `callDurationSeconds` (Int?) -- from raw `call_length`
- `callTimestamp` (DateTime) -- from raw `call_date` or current time
- `agentId` (String?) -- resolved from agentMap lookup
- `leadSourceId` (String?) -- from leadSource.id

**Implementation (in pollLeadSource, after line 80):**
```typescript
// Write individual call records to ConvosoCallLog
const callLogRecords = newRaw
  .map(r => {
    const userId = String(r.user_id ?? "");
    const agentInfo = agentMap.get(userId);
    return {
      agentUser: userId,
      listId: leadSource.listId!,
      recordingUrl: r.recording_url ? String(r.recording_url) : null,
      callDurationSeconds: r.call_length != null ? Number(r.call_length) : null,
      callTimestamp: r.call_date ? new Date(String(r.call_date)) : new Date(),
      agentId: agentInfo?.id ?? null,
      leadSourceId: leadSource.id,
    };
  })
  .filter(r => r.agentUser); // skip records without user_id

if (callLogRecords.length > 0) {
  await prisma.convosoCallLog.createMany({ data: callLogRecords });
}
```

**Key:** Uses `newRaw` (post-dedup) per D-07. Existing AgentCallKpi writes remain untouched per D-08.

### Pattern 5: Cost Display Logic (DATA-03/04/05)

**Current behavior in ManagerTracker (line 197):**
```typescript
{row.costPerSale > 0
  ? <AnimatedNumber value={Number(row.costPerSale)} prefix="$" decimals={2} />
  : <span style={{ color: colors.textMuted }}>{"\u2014"}</span>}
```

**Problem:** This shows "---" for both "no Convoso data" and "Convoso data with zero sales". Need to differentiate per D-09 through D-12.

**Required logic for lead spend column:**
```typescript
// If no Convoso configured (totalLeadCost === 0 AND no call logs exist) -> "---"
// If Convoso configured but no calls for agent -> "$0.00"
// If agent has calls -> show actual totalLeadCost amount
```

**Required logic for cost per sale column:**
```typescript
// If agent has zero sales -> "---" (regardless of lead spend)
// If agent has sales AND lead spend > 0 -> show costPerSale
// If agent has sales AND lead spend === 0 -> "---"
```

**API consideration:** The tracker/summary endpoint (sales.ts line 539-595) already computes `totalLeadCost` and `costPerSale` correctly from ConvosoCallLog. The display fix is purely frontend. However, the API currently returns `costPerSale: 0` for agents with zero sales (line 590), which is ambiguous. Consider returning `null` for costPerSale when salesCount is 0 to let the frontend distinguish states properly.

### Pattern 6: CS Resolved Log (CS-01 through CS-04)

**API endpoint recommendation:** Single unified endpoint returning both types, since columns are compatible.

**Endpoint:** `GET /api/cs-reps/resolved-log?type=all|chargeback|pending_term&from=&to=&agentName=`

**Query:**
```typescript
const [chargebacks, pendingTerms] = await Promise.all([
  prisma.chargebackSubmission.findMany({
    where: { resolvedAt: { not: null }, ...dateFilter, ...agentFilter },
    include: { resolver: { select: { name: true } } },
  }),
  prisma.pendingTerm.findMany({
    where: { resolvedAt: { not: null }, ...dateFilter, ...agentFilter },
    include: { resolver: { select: { name: true } } },
  }),
]);
```

**Unified response shape:**
```typescript
{
  type: "chargeback" | "pending_term",
  agentName: string,
  memberName: string,
  resolvedAt: string,
  resolvedByName: string,
  resolutionNote: string | null,
  originalAmount: number, // chargebackAmount or enrollAmount
}
```

**Agent field mapping:**
- ChargebackSubmission: `payeeName` for agent, `memberCompany` for member, `chargebackAmount` for amount
- PendingTerm: `agentName` for agent, `memberName` for member, `enrollAmount` for amount

**Frontend component:** New `CSResolvedLog.tsx` following existing CSTracking.tsx patterns -- uses DateRangeFilter, SortHeader, baseThStyle/baseTdStyle, authFetch.

**Tab integration in page.tsx:** Add to navItems when canManageCS is true (OWNER_VIEW or SUPER_ADMIN per D-17). Note: D-17 says NOT CUSTOMER_SERVICE, so only show for canManageCS users.

### Anti-Patterns to Avoid
- **Don't use Socket.IO for resolved log:** D-19 explicitly says static view, no real-time
- **Don't deprecate AgentCallKpi:** D-08 says keep parallel snapshot
- **Don't add .min(0) to adjustmentAmount:** Project gotcha from CLAUDE.md
- **Don't use standalone output in next.config.js:** Project gotcha

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range filtering | Custom date picker | `DateRangeFilter` + `KPI_PRESETS` from @ops/ui | Already used in CSTracking, ManagerTracker |
| Dollar formatting | Custom formatters | `formatDollar` from @ops/utils | Consistent formatting across dashboards |
| API error display | Custom error parsing | `zodErr()` wrapper on API, `err.error` check on frontend | Project convention per CLAUDE.md |
| Table styling | Custom CSS | `baseThStyle`, `baseTdStyle` from @ops/ui | Consistent dark theme |
| Role gating | Custom checks | `requireRole("OWNER_VIEW", "SUPER_ADMIN")` middleware | Established pattern |

## Common Pitfalls

### Pitfall 1: Convoso API Field Name Mismatch
**What goes wrong:** Mapping raw Convoso response fields to ConvosoCallLog model using wrong field names (e.g., `call_date` vs `start_time`, `call_length` vs `duration`).
**Why it happens:** Convoso API docs may differ from actual response payload.
**How to avoid:** The existing code already uses `call_length` and `user_id` from the raw response (convosoCallLogs.ts line 14-17). Map `recording_url` and timestamp fields conservatively -- use `r.call_date || r.start_time` with fallback to `new Date()`.
**Warning signs:** Null timestamps or durations in ConvosoCallLog after polling.

### Pitfall 2: Duplicate ConvosoCallLog Records
**What goes wrong:** If createMany runs before ProcessedConvosoCall tracking (line 124), a crash between them could cause duplicates on next poll.
**Why it happens:** No unique constraint on ConvosoCallLog for external call IDs.
**How to avoid:** Write ConvosoCallLog records AND ProcessedConvosoCall records in the same transaction, or add a convosoCallId field to ConvosoCallLog with unique constraint. The simpler approach: write ConvosoCallLog within the same code block as ProcessedConvosoCall tracking, relying on the existing dedup mechanism.
**Warning signs:** Duplicate call records in ConvosoCallLog with same timestamps/agents.

### Pitfall 3: Cost Display Ambiguity
**What goes wrong:** Showing "$0.00" when Convoso is not configured, or showing "---" when there's actual $0 lead cost.
**Why it happens:** The API returns `totalLeadCost: 0` for both "no Convoso data" and "Convoso with zero calls".
**How to avoid:** The API should differentiate: return `totalLeadCost: null` when no Convoso is configured, `0` when configured but no calls. Frontend checks `null` vs `0` to decide display. Alternatively, add a `convosoEnabled` flag to the response.
**Warning signs:** All agents showing "$0.00" when Convoso is supposed to show "---".

### Pitfall 4: CS Resolved Log Agent Name Inconsistency
**What goes wrong:** ChargebackSubmission uses `payeeName` while PendingTerm uses `agentName` -- these may not match Agent.name exactly.
**Why it happens:** Different submission flows use different source names.
**How to avoid:** Map both to a single `agentName` field in the API response. Use the raw name from each model -- don't try to join on Agent table since names may not match.
**Warning signs:** Agent filter not matching expected results.

### Pitfall 5: Products Section Cleanup Breaks Props Interface
**What goes wrong:** Removing `refreshProducts` usage from ManagerConfig but not from the parent component that passes it.
**Why it happens:** Props interface still requires refreshProducts even though products section is read-only.
**How to avoid:** Keep `refreshProducts` in the interface but simply don't call it. Or update parent to stop passing it -- but that's a larger change. Simpler to keep the prop and ignore it.
**Warning signs:** TypeScript compilation errors.

## Code Examples

### CS Resolved Log API Endpoint
```typescript
// Source: Pattern from existing cs-reps.ts routes
router.get("/resolved-log", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    type: z.enum(["all", "chargeback", "pending_term"]).default("all"),
    from: z.string().optional(),
    to: z.string().optional(),
    agentName: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { type, from, to, agentName } = parsed.data;
  const dateFilter = from && to ? { resolvedAt: { gte: new Date(from), lt: new Date(to) } } : { resolvedAt: { not: null } };

  const results = [];

  if (type === "all" || type === "chargeback") {
    const chargebacks = await prisma.chargebackSubmission.findMany({
      where: { ...dateFilter, ...(agentName ? { payeeName: { contains: agentName, mode: "insensitive" } } : {}) },
      include: { resolver: { select: { name: true } } },
      orderBy: { resolvedAt: "desc" },
    });
    results.push(...chargebacks.map(c => ({
      type: "chargeback" as const,
      agentName: c.payeeName ?? "Unknown",
      memberName: c.memberCompany ?? c.memberId ?? "Unknown",
      resolvedAt: c.resolvedAt,
      resolvedByName: (c as any).resolver?.name ?? "Unknown",
      resolutionNote: c.resolutionNote,
      resolutionType: c.resolutionType,
      originalAmount: Number(c.chargebackAmount ?? 0),
    })));
  }

  if (type === "all" || type === "pending_term") {
    const terms = await prisma.pendingTerm.findMany({
      where: { ...dateFilter, ...(agentName ? { agentName: { contains: agentName, mode: "insensitive" } } : {}) },
      include: { resolver: { select: { name: true } } },
      orderBy: { resolvedAt: "desc" },
    });
    results.push(...terms.map(t => ({
      type: "pending_term" as const,
      agentName: t.agentName ?? "Unknown",
      memberName: t.memberName ?? t.memberId ?? "Unknown",
      resolvedAt: t.resolvedAt,
      resolvedByName: (t as any).resolver?.name ?? "Unknown",
      resolutionNote: t.resolutionNote,
      resolutionType: t.resolutionType,
      originalAmount: Number(t.enrollAmount ?? 0),
    })));
  }

  // Sort unified results by resolvedAt descending
  results.sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime());
  res.json(results);
}));
```

### Notes Truncation Pattern
```typescript
// Truncate long notes with expand-on-click
function TruncatedNote({ text, maxLength = 80 }: { text: string | null; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span style={{ color: colors.textMuted }}>---</span>;
  if (text.length <= maxLength) return <span>{text}</span>;
  return (
    <span
      style={{ cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
      title={expanded ? "Click to collapse" : "Click to expand"}
    >
      {expanded ? text : `${text.slice(0, maxLength)}...`}
    </span>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Convoso poller writes only AgentCallKpi | Must also write ConvosoCallLog | Phase 29 | Enables per-call cost tracking in tracker/summary endpoint |
| Products CRUD in manager config | Read-only view | Phase 29 | Managers reference products but can't modify |

**No library upgrades needed** -- all changes are within existing codebase patterns.

## Open Questions

1. **Convoso API field names for timestamp and recording**
   - What we know: `call_length` and `user_id` are confirmed by existing code usage
   - What's unclear: Exact field name for call timestamp (`call_date`? `start_time`?) and recording URL (`recording_url`?)
   - Recommendation: Use defensive mapping with fallbacks: `r.call_date || r.start_time || new Date()` and `r.recording_url || r.recording || null`

2. **ConvosoCallLog deduplication safety**
   - What we know: ProcessedConvosoCall dedup exists and works for AgentCallKpi
   - What's unclear: Whether we need a unique constraint on ConvosoCallLog for call IDs
   - Recommendation: Rely on existing ProcessedConvosoCall dedup since writes happen in same code path. No schema migration needed.

3. **Cost display differentiation (Convoso not configured vs zero data)**
   - What we know: Frontend currently checks `costPerSale > 0` for display
   - What's unclear: Whether the tracker/summary API needs modification to distinguish null vs zero
   - Recommendation: Add a `convosoConfigured` boolean to the tracker/summary response based on `process.env.CONVOSO_AUTH_TOKEN` existence. Frontend uses this to decide "---" vs "$0.00".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with ts-jest (ops-api), Morgan tests at root |
| Config file | `apps/ops-api/jest.config.ts` |
| Quick run command | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern="__tests__"` |
| Full suite command | `npm test` (runs Morgan tests) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | Premium sums core + addon per row | manual-only | Visual check in browser | N/A |
| FIX-02 | Create form has buffer field | manual-only | Visual check in browser | N/A |
| FIX-03 | POST schema accepts callBufferSeconds | unit | `npx jest --config apps/ops-api/jest.config.ts -t "callBufferSeconds"` | No -- Wave 0 |
| CFG-01 | Products section read-only | manual-only | Visual check in browser | N/A |
| CFG-02 | Read-only view shows correct columns | manual-only | Visual check in browser | N/A |
| DATA-01 | Poller writes to ConvosoCallLog | unit | `npx jest --config apps/ops-api/jest.config.ts -t "ConvosoCallLog"` | No -- Wave 0 |
| DATA-02 | Poller deduplicates call logs | unit | `npx jest --config apps/ops-api/jest.config.ts -t "dedup"` | No -- Wave 0 |
| DATA-03 | Cost per sale in manager tracker | manual-only | Visual check with test data | N/A |
| DATA-04 | Cost per sale in owner dashboard | manual-only | Visual check with test data | N/A |
| DATA-05 | Lead spend shows with zero sales | manual-only | Visual check with test data | N/A |
| CS-01 | Resolved Log tab visible to OWNER_VIEW/SUPER_ADMIN | manual-only | Role-based visual check | N/A |
| CS-02 | Resolved chargebacks displayed | unit | `npx jest --config apps/ops-api/jest.config.ts -t "resolved-log"` | No -- Wave 0 |
| CS-03 | Resolved pending terms displayed | unit | `npx jest --config apps/ops-api/jest.config.ts -t "resolved-log"` | No -- Wave 0 |
| CS-04 | Filtering by type/date/agent | unit | `npx jest --config apps/ops-api/jest.config.ts -t "resolved-log filter"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Visual verification of UI changes; unit test run for API changes
- **Per wave merge:** Full test suite + manual smoke test of all dashboard tabs
- **Phase gate:** All 14 requirements verified manually or via automated test

### Wave 0 Gaps
- [ ] `apps/ops-api/src/workers/__tests__/convosoKpiPoller.test.ts` -- covers DATA-01, DATA-02
- [ ] `apps/ops-api/src/routes/__tests__/cs-resolved-log.test.ts` -- covers CS-02, CS-03, CS-04
- [ ] `apps/ops-api/src/routes/__tests__/lead-source-post.test.ts` -- covers FIX-03

Note: Most requirements are frontend UI changes (FIX-01, FIX-02, CFG-01, CFG-02, DATA-03/04/05, CS-01) which are best verified by manual visual inspection in the browser rather than automated tests.

## Sources

### Primary (HIGH confidence)
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` -- premium calculation at lines 388-392 and 422
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerConfig.tsx` -- lead source form and product section
- `apps/ops-api/src/routes/agents.ts` -- lead source POST/PATCH Zod schemas
- `apps/ops-api/src/workers/convosoKpiPoller.ts` -- full poller implementation
- `apps/ops-api/src/services/convosoCallLogs.ts` -- Convoso API client and KPI building
- `apps/ops-api/src/routes/sales.ts` -- tracker/summary endpoint (lines 539-595)
- `prisma/schema.prisma` -- ConvosoCallLog, ChargebackSubmission, PendingTerm models
- `apps/ops-dashboard/app/(dashboard)/cs/page.tsx` -- CS dashboard tab structure
- `apps/ops-api/src/routes/cs-reps.ts` -- CS API route patterns
- `apps/ops-api/src/routes/chargebacks.ts` -- chargeback resolution endpoint patterns
- `apps/ops-api/src/routes/pending-terms.ts` -- pending term resolution endpoint patterns

### Secondary (MEDIUM confidence)
- Convoso API field names (`call_date`, `recording_url`) -- inferred from existing code usage but not verified against live API

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing project dependencies, no new libraries
- Architecture: HIGH -- all patterns verified from existing codebase
- Pitfalls: HIGH -- identified from actual code analysis, not speculation
- Convoso field mapping: MEDIUM -- inferred from existing code, not verified against API docs

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable codebase, no external dependencies changing)
