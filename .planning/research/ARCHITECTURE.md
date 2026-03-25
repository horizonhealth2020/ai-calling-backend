# Architecture Patterns: v1.7 Dashboard Fixes & Cost Tracking

**Domain:** Bug fixes, Convoso data flow repair, CS audit trail for Ops Platform
**Researched:** 2026-03-25
**Confidence:** HIGH (all recommendations based on direct codebase analysis)

---

## Current Architecture (Unchanged)

v1.7 does not modify the system architecture. All changes operate within existing component boundaries:

```
[Convoso API] --> [KPI Poller] --> [AgentCallKpi + ConvosoCallLog*] --> [API Endpoints] --> [Dashboard]
                                    (* new: poller writes to ConvosoCallLog)

[CS Dashboard] --> [Chargebacks API] --> [ChargebackSubmission table]
                                              |
                                    [Resolved Log Tab*] <-- queries WHERE resolvedAt IS NOT NULL
                                    (* new: read-only audit view)
```

### Component Boundaries (No Changes)

| Component | Responsibility | v1.7 Changes |
|-----------|---------------|--------------|
| ops-api | REST API, business logic | Add ConvosoCallLog writes in poller, add buffer to lead source create schema, add resolved filter to chargebacks/pending-terms endpoints |
| ops-dashboard | Unified dashboard UI | Remove Products from Manager Config, add Buffer to lead source create form, add Resolved Log tab, fix premium column display, show lead spend |
| @ops/db (Prisma) | Database access | No schema changes -- all models exist |
| Socket.IO | Real-time events | Existing `cs:changed` event covers resolved log refresh |

---

## Patterns to Follow

### Pattern 1: Poller Data Persistence (for Convoso fix)

**What:** The poller should write to `ConvosoCallLog` using the same deduplication boundary as `AgentCallKpi`.

**When:** Adding the `createMany` call in `pollLeadSource()`.

**Implementation:**
```typescript
// In pollLeadSource(), after newRaw filtering (line ~80) and before KPI aggregation:
if (newRaw.length > 0) {
  const callLogRecords = newRaw.map((r) => ({
    agentUser: String(r.user_id ?? "unknown"),
    listId: leadSource.listId!,
    recordingUrl: r.recording_url ? String(r.recording_url) : null,
    callDurationSeconds: r.call_length != null ? Number(r.call_length) : null,
    callTimestamp: r.call_date ? new Date(String(r.call_date)) : new Date(),
    agentId: agentMap.get(String(r.user_id ?? ""))?.id ?? null,
    leadSourceId: leadSource.id,
  }));

  await prisma.convosoCallLog.createMany({
    data: callLogRecords,
    skipDuplicates: true,
  });
}
```

**Key principle:** Insert from `newRaw` (post-dedup), not from `raw` (pre-dedup). This ensures the `ProcessedConvosoCall` dedup boundary is respected.

---

### Pattern 2: Query Filter Extension (for Resolved Log)

**What:** Add a query parameter to existing endpoints rather than creating new endpoints.

**When:** Building the resolved log API surface.

**Implementation:**
```typescript
// In chargebacks.ts GET /chargebacks handler, extend the where clause:
const resolvedFilter = req.query.resolved === "true"
  ? { resolvedAt: { not: null } }
  : req.query.resolved === "false"
    ? { resolvedAt: null }
    : {};

const records = await prisma.chargebackSubmission.findMany({
  where: { ...dateFilter, ...resolvedFilter },
  include: {
    submitter: { select: { name: true } },
    resolver: { select: { name: true } },
    matchedSale: { select: { id: true, memberName: true, agentId: true } },
  },
  orderBy: { resolvedAt: "desc" },
});
```

**Key principle:** Extend existing endpoints with optional filters rather than duplicating endpoints. The Zod query schema should include `resolved: z.enum(["true", "false"]).optional()`.

---

### Pattern 3: Addon-Inclusive Premium (for Manager Sales fix)

**What:** Sum all SaleProduct premiums (core + addon) per sale row.

**When:** Fixing the premium column in Manager Agent Sales.

**Implementation:** Follow the existing pattern from sales board:
```typescript
// Include SaleProducts with product type in the query
const sales = await prisma.sale.findMany({
  where: { agentId },
  include: {
    saleProducts: {
      include: { product: { select: { type: true } } },
    },
  },
});

// Calculate total premium per sale (core + addon)
const withPremium = sales.map(s => ({
  ...s,
  totalPremium: s.saleProducts.reduce(
    (sum, sp) => sum + Number(sp.actualPremium ?? 0),
    0
  ),
}));
```

**Key principle:** This exact pattern already exists in multiple places (sales board, payroll). Replicate it; do not invent a new aggregation approach.

---

### Pattern 4: Zod Schema Extension (for Buffer field)

**What:** Add missing fields to existing Zod validation schemas.

**When:** Adding `callBufferSeconds` to the lead source create endpoint.

**Implementation:**
```typescript
// Current (agents.ts line 76):
const schema = z.object({
  name: z.string().min(1),
  listId: z.string().optional(),
  costPerLead: z.number().min(0).default(0),
});

// Fixed:
const schema = z.object({
  name: z.string().min(1),
  listId: z.string().optional(),
  costPerLead: z.number().min(0).default(0),
  callBufferSeconds: z.number().int().min(0).default(0),
});
```

**Key principle:** Use `.default(0)` not `.optional()` so the value is always present in `parsed.data`. Pass the full `parsed.data` to `prisma.leadSource.create()`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate ConvosoCallLog Dedup System

**What:** Creating a new deduplication mechanism for ConvosoCallLog separate from ProcessedConvosoCall.

**Why bad:** Two dedup systems can drift. ProcessedConvosoCall already solves the problem. Adding a second check (e.g., a unique index on ConvosoCallLog) creates confusion about which is the source of truth.

**Instead:** Insert ConvosoCallLog records using the same `newRaw` filter that already excludes processed calls. One dedup system, used by both KPI writes and call log writes.

### Anti-Pattern 2: Creating Dedicated Resolved Log Endpoints

**What:** Building `GET /chargebacks/resolved` and `GET /pending-terms/resolved` as separate routes.

**Why bad:** Duplicates query logic from the existing GET endpoints. Date range filtering, pagination, includes -- all must be maintained in two places.

**Instead:** Add `?resolved=true` filter to existing endpoints. One query path, one maintenance surface.

### Anti-Pattern 3: Fetching All Data Client-Side for Resolved Log

**What:** Fetching all chargebacks and pending terms, then filtering `resolvedAt !== null` in the browser.

**Why bad:** Transfers potentially thousands of unresolved records over the network just to discard them. Wastes bandwidth and slows page load.

**Instead:** Server-side filtering via query parameter. Only resolved records travel over the wire.

---

## Data Flow Changes

### Before v1.7 (Current):
```
Convoso API -> Poller -> [newRaw filter] -> enrichWithTiers -> buildKpiSummary -> AgentCallKpi table
                                         -> ProcessedConvosoCall (dedup tracking)
                                         (ConvosoCallLog table: EMPTY)
```

### After v1.7:
```
Convoso API -> Poller -> [newRaw filter] -> ConvosoCallLog table (new write)
                                         -> enrichWithTiers -> buildKpiSummary -> AgentCallKpi table
                                         -> ProcessedConvosoCall (dedup tracking)
```

### Resolved Log Data Flow:
```
GET /chargebacks?resolved=true  ->  ChargebackSubmission WHERE resolvedAt IS NOT NULL
GET /pending-terms?resolved=true -> PendingTermSubmission WHERE resolvedAt IS NOT NULL
                                         |
                                    CSResolvedLog.tsx (merged view, sorted by resolvedAt desc)
```

---

## Scalability Considerations

Not applicable for v1.7. All changes operate at current scale (hundreds of agents, thousands of call records per week). No architectural scaling concerns for bug fixes and a read-only audit tab.

The only scale consideration is ConvosoCallLog table growth: if the poller writes hundreds of records per cycle (every 10 minutes), that is ~50,000 records per month. This is within PostgreSQL comfort zone and the existing archival system (v1.5) can manage lifecycle.

## Sources

- `apps/ops-api/src/workers/convosoKpiPoller.ts` -- Poller architecture, dedup pattern, agentMap
- `apps/ops-api/src/routes/chargebacks.ts` -- Existing GET endpoint with resolver include
- `apps/ops-api/src/routes/agents.ts:76` -- Lead source create schema
- `apps/ops-api/src/services/convosoCallLogs.ts` -- KPI aggregation service
- `prisma/schema.prisma` -- ConvosoCallLog model (line 457), LeadSource model (line 108)

---
*Architecture research for: v1.7 Dashboard Fixes & Cost Tracking*
*Researched: 2026-03-25*
