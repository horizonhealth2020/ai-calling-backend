# Architecture Patterns

**Domain:** Sales Operations Platform — v1.2 Integration Layer
**Researched:** 2026-03-18
**Overall confidence:** HIGH

## Current System Architecture

The platform is a monorepo with 6 Next.js 15 apps (App Router), 1 Express API, and 6 shared `@ops/*` packages. All frontend apps communicate with `ops-api` via HTTP (`authFetch`) and Socket.IO (`@ops/socket`). The API uses a single flat routes file (`routes/index.ts`, ~2200 lines) with Prisma ORM for PostgreSQL.

```
                        +------------------+
                        |   PostgreSQL     |
                        +--------+---------+
                                 |
                        +--------+---------+
                        |    ops-api       |
                        |  (Express+SIO)   |
                        +--+--+--+--+--+---+
                       /   |  |  |  |   \
                      /    |  |  |  |    \
              auth  mgr  pay  sb  own   cs
              3011  3019 3012 3013 3026  (port TBD)
```

### Existing Integration Points

| System | Integration | Current State |
|--------|------------|---------------|
| Convoso | Cron poller (10min) + webhook endpoint | Working — populates ConvosoCallLog, AgentCallKpi |
| Claude API | Call audit pipeline via auditQueue | Working — transcribe + audit with structured tool output |
| OpenAI API | Fallback for call audits | Working — legacy JSON response format |
| Whisper API | Transcription service | Working — external Whisper endpoint |
| Socket.IO | Real-time sale cascade | Working — `sale:changed` event to all dashboards |
| Socket.IO | Audit progress | Working — `processing_started`, `audit_status`, `new_audit`, `processing_failed` |

### Current Data Flow Patterns

**Sale entry flow:** Manager Dashboard -> POST /api/sales -> calculateCommission -> upsertPayrollEntry -> emitSaleChanged -> all dashboards update via Socket.IO

**Audit flow:** Convoso webhook -> enqueueAuditJob -> downloadRecording (retry up to 10x) -> Whisper transcribe -> Claude audit (structured tool) -> persist CallAudit -> emitAuditComplete

**CS submission flow:** CS Dashboard -> POST /api/chargebacks or /api/pending-terms -> persist batch -> return. No Socket.IO events emitted. No connection to payroll.

**Date filtering:** All list endpoints accept `?range=today|week|month`. Custom date ranges not supported. The `dateRange()` helper in routes returns `{ gte, lt }` boundaries.

---

## Recommended Architecture: v1.2 Integration Layer

### New Component Map

| Component | Type | Responsibility | Communicates With |
|-----------|------|---------------|-------------------|
| **DateRangeFilter** | @ops/ui component | Shared date picker with presets + custom range | All dashboard pages |
| **AlertService** | ops-api service | Create/query/clear alerts from domain events | Routes, ChargebackService |
| **AgentKpiAggregator** | ops-api service | Merge chargeback + pending term data into agent KPI views | Routes, Prisma |
| **CS Socket Events** | ops-api socket.ts | Emit `chargeback:changed`, `pending-term:changed` on mutations | CS dashboard, payroll dashboard |
| **AI Scoring Display** | owner-dashboard page | View/edit system prompt, view aggregate scores | ops-api (existing endpoints) |
| **RepChecklist** | ops-api + CS dashboard | Round-robin assignment tracking | Prisma, CS dashboard |

### Component Boundaries (Updated)

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| Manager Dashboard | Sale entry, agent tracker, call audits, config | ops-api (HTTP + SIO) |
| Payroll Dashboard | Period mgmt, commission review, **alert inbox**, exports | ops-api (HTTP + SIO) |
| Owner Dashboard | KPI summary, **AI scoring tab**, trend analysis | ops-api (HTTP) |
| Sales Board | Leaderboard display | ops-api (HTTP + SIO) |
| CS Dashboard | Chargeback/pending term submission, tracking, **rep checklist** | ops-api (HTTP + **SIO**) |
| ops-api Routes | Request validation, auth, routing | Services, Prisma, Socket.IO |
| Payroll Service | Commission calculation, period assignment | Prisma |
| **Alert Service** | Create alerts from chargebacks, surface in payroll | Prisma |
| **AgentKpiAggregator** | Combine chargeback/pending term counts per agent | Prisma |
| Socket.IO Layer | Real-time events: sales, audits, **CS submissions**, **alerts** | All dashboards |
| Prisma/PostgreSQL | Data persistence | ops-api |
| Auth System | JWT, RBAC, session management | All components |

---

## New Data Flows

### 1. Chargeback -> Payroll Alert Pipeline

This is the most architecturally significant new feature. When a chargeback is submitted or resolved, an alert must appear in the payroll dashboard.

```
CS Dashboard -> POST /api/chargebacks
  -> Create ChargebackSubmission records
  -> AlertService.createAlert({
       type: "CHARGEBACK_SUBMITTED",
       entityType: "ChargebackSubmission",
       entityId: batchId,
       targetRole: "PAYROLL",
       metadata: { count, totalAmount, submittedBy }
     })
  -> emitCSChanged({ type: "chargeback_batch", batchId })
  -> emitAlert({ type: "CHARGEBACK_SUBMITTED", ... })
  -> Payroll Dashboard receives alert via SIO, shows in alert inbox
  -> Payroll user clicks alert -> sees linked chargebacks
  -> Payroll user approves/clears alert -> AlertService.clearAlert(id)
```

**New schema required:**

```prisma
model Alert {
  id         String   @id @default(cuid())
  type       String                          // CHARGEBACK_SUBMITTED, CHARGEBACK_RESOLVED, etc.
  entityType String   @map("entity_type")    // ChargebackSubmission, PendingTerm
  entityId   String?  @map("entity_id")      // batch ID or record ID
  targetRole UserRole                        // PAYROLL, MANAGER, etc.
  metadata   Json?
  read       Boolean  @default(false)
  clearedAt  DateTime? @map("cleared_at")
  clearedBy  String?  @map("cleared_by")
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([targetRole, read])
  @@map("alerts")
}
```

**Why an Alert model vs. just querying chargebacks:** Alerts are cross-domain notifications. Payroll needs to see "new chargebacks submitted" without polling the chargeback table. Alerts also support approve/clear workflows that are independent of the chargeback resolution status.

### 2. Cross-Dashboard Date Range CSV Exports

The current `dateRange()` helper only supports `today|week|month` presets. Every dashboard needs custom date range selection.

```
Current: GET /api/sales?range=week
Target:  GET /api/sales?from=2026-03-01&to=2026-03-15
         GET /api/chargebacks?from=2026-03-01&to=2026-03-15
         GET /api/pending-terms?from=2026-03-01&to=2026-03-15
         GET /api/payroll/periods?from=2026-03-01&to=2026-03-15
```

**Pattern: Extend `dateRange()` to accept `from` and `to` query params alongside existing presets.**

```typescript
// Updated dateRange helper
function dateRange(query: { range?: string; from?: string; to?: string }): { gte: Date; lt: Date } | undefined {
  if (query.from && query.to) {
    return {
      gte: new Date(query.from),
      lt: new Date(new Date(query.to).getTime() + 86400000), // inclusive end
    };
  }
  // ... existing preset logic
}
```

**Shared UI component:** A `DateRangeFilter` component in `@ops/ui` that provides preset buttons (Today, This Week, This Month) plus a custom date range picker. All dashboards import this single component. The component passes `from` and `to` query params to `authFetch` calls.

### 3. Pending Terms + Chargebacks -> Agent KPI Tables

Chargebacks and pending terms must appear per-agent in new KPI tables. This requires aggregation queries, not schema changes.

```
Owner/Manager Dashboard -> GET /api/agents/kpi-summary?from=...&to=...
  -> AgentKpiAggregator.buildSummary(dateRange)
     -> Query chargebacks grouped by memberAgentId/memberAgentCompany
     -> Query pending terms grouped by agentName
     -> Match against Agent records (fuzzy: agent name or agent ID field)
     -> Return per-agent: { chargebackCount, chargebackTotal, pendingTermCount, pendingTermTotal, within30Days }
```

**Agent matching challenge:** ChargebackSubmission has `memberAgentId` and `memberAgentCompany` fields, while PendingTerm has `agentName` and `agentIdField`. These may not directly map to Agent.id or Agent.name. The aggregator must do best-effort matching:

1. Exact match on `memberAgentId` -> `Agent.id` (unlikely — different ID systems)
2. Exact match on agent name fields -> `Agent.name`
3. If no match, group under "Unmatched" with raw field values

**No new tables needed.** This is a read-side aggregation endpoint.

### 4. Real-Time Socket.IO for CS Submissions

Currently CS submissions have no real-time events. Add two new event types.

```typescript
// In socket.ts — new emitters
export function emitCSChanged(payload: {
  type: "chargeback_batch" | "chargeback_resolved" | "pending_term_batch" | "pending_term_resolved";
  batchId?: string;
  recordId?: string;
}) {
  io?.emit("cs:changed", payload);
}

export function emitAlertCreated(payload: { type: string; targetRole: string; metadata: any }) {
  io?.emit("alert:created", payload);
}
```

**CS dashboard** listens for `cs:changed` to refresh tracking tables when another user submits/resolves.
**Payroll dashboard** listens for `alert:created` where `targetRole === "PAYROLL"` to show new alert badge.

### 5. AI Scoring Visibility in Owner Dashboard

The existing `callAudit.ts` already produces structured scoring via Claude's tool-use pattern. The `CallAudit` model stores `aiScore`, `aiSummary`, `callOutcome`, `issues`, `wins`, `missedOpportunities`, `suggestedCoaching`, `managerSummary`.

The owner dashboard AI tab needs:
1. **Aggregate score view:** Average `aiScore` per agent, trend over time
2. **System prompt editor:** Already exists at `GET/PUT /api/settings/ai-audit-prompt` (reads from `SalesBoardSetting` where key = `ai_audit_system_prompt`). Currently only accessible to MANAGER/SUPER_ADMIN. Extend access to OWNER_VIEW.
3. **Score distribution:** Count of audits by outcome (sold/lost/callback/etc.)

**No new services needed.** Add new aggregation endpoints:
- `GET /api/call-audits/summary?from=...&to=...` -> aggregate scores
- Modify role access on existing prompt settings endpoints

### 6. Service Agent Sync Between Payroll and CS

Currently, `ServiceAgent` (payroll) and `CsRepRoster` (CS) are separate tables with no link. The v1.2 requirement is to sync them so adding a rep in one place reflects in the other.

**Recommended approach: Single source of truth.**

Make `CsRepRoster` reference `ServiceAgent` or vice versa. Since `ServiceAgent` has more fields (basePay), it should be the primary. Add a `csRepRosterId` to `ServiceAgent` or simply use `ServiceAgent` directly in CS workflows and deprecate `CsRepRoster`.

**Simplest path:** Add a `serviceAgentId` field to `CsRepRoster` (optional, for linking). When creating a CS rep, optionally link to an existing service agent. When creating a service agent, optionally create a matching CS rep. This avoids breaking either dashboard's existing data model.

### 7. Rep Checklist for Round Robin

A round-robin assignment system for chargebacks and pending terms.

```
CS Dashboard -> POST /api/cs-rep-roster/:id/check-in
  -> Update CsRepRoster.lastCheckIn, CsRepRoster.isAvailable
  -> When new batch submitted, auto-assign based on round-robin:
     1. Get all active, available reps
     2. Order by least recent assignment (lastAssignedAt ASC)
     3. Distribute records evenly
```

**New fields on CsRepRoster:**
```prisma
model CsRepRoster {
  // ... existing fields
  lastAssignedAt DateTime? @map("last_assigned_at")
  assignmentCount Int      @default(0) @map("assignment_count")
  isAvailable    Boolean   @default(true) @map("is_available")
}
```

The checklist UI shows each rep with their current assignment count, a toggle for availability, and a visual indicator of who is "next up."

---

## Patterns to Follow

### Pattern 1: Service Layer for Cross-Domain Logic

**What:** Extract business logic that spans multiple entities into dedicated service files under `ops-api/src/services/`.

**When:** Logic involves more than one Prisma model or triggers side effects (alerts, socket events).

**Example:** The AlertService should be a standalone module:

```typescript
// apps/ops-api/src/services/alerts.ts
import { prisma } from "@ops/db";
import { emitAlertCreated } from "../socket";

export async function createAlert(params: {
  type: string;
  entityType: string;
  entityId?: string;
  targetRole: string;
  metadata?: Record<string, any>;
}) {
  const alert = await prisma.alert.create({ data: params });
  emitAlertCreated({ type: params.type, targetRole: params.targetRole, metadata: params.metadata });
  return alert;
}

export async function getUnreadAlerts(role: string) {
  return prisma.alert.findMany({
    where: { targetRole: role as any, read: false, clearedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function clearAlert(id: string, userId: string) {
  return prisma.alert.update({
    where: { id },
    data: { clearedAt: new Date(), clearedBy: userId, read: true },
  });
}
```

### Pattern 2: Shared Date Range Component

**What:** A single `DateRangeFilter` component in `@ops/ui` that all dashboards use.

**When:** Any dashboard page that displays filtered data or exports CSV.

**Example:**

```typescript
// packages/ui/src/components/DateRangeFilter.tsx
export function DateRangeFilter({ onRangeChange }: {
  onRangeChange: (from: string, to: string) => void;
}) {
  // Preset buttons: Today, This Week, This Month, Custom
  // Custom shows two date inputs
  // Calls onRangeChange with ISO date strings
}
```

### Pattern 3: Socket Event Namespacing

**What:** Group Socket.IO events by domain with a colon-separated namespace.

**When:** Adding any new real-time event.

**Example:** Existing pattern uses `sale:changed`. Extend with `cs:changed`, `alert:created`, `payroll:updated`.

```typescript
// Event naming convention:
// {domain}:{action}
// sale:changed, cs:changed, alert:created, payroll:entry_updated
```

### Pattern 4: Date Range Backward Compatibility

**What:** The updated `dateRange()` helper must continue to accept the `range` preset parameter while also supporting `from`/`to`. This ensures existing dashboard code works without changes until migrated.

**When:** Modifying the date range helper.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Alert Polling from Frontend

**What:** Having dashboards poll `GET /api/alerts` on an interval to check for new alerts.

**Why bad:** Wastes bandwidth, creates N+1 request patterns, and alerts arrive with latency equal to poll interval.

**Instead:** Push alerts via Socket.IO. The `alert:created` event tells payroll dashboard to fetch updated alert list once.

### Anti-Pattern 2: Duplicating Agent Data Across CS and Payroll

**What:** Maintaining two separate agent tables (ServiceAgent + CsRepRoster) with manual sync.

**Why bad:** Data drift — a name change in one table won't propagate to the other. Creates confusion about which is authoritative.

**Instead:** Link with a foreign key. Either CsRepRoster references ServiceAgent, or consolidate into one table with a `csActive` flag.

### Anti-Pattern 3: Embedding Complex Aggregation in Route Handlers

**What:** Writing 50-line Prisma queries directly inside `asyncHandler` callbacks in routes/index.ts.

**Why bad:** The routes file is already ~2200 lines. Adding agent KPI aggregation, alert queries, and date-range exports inline makes it unmaintainable.

**Instead:** Create service files (`alerts.ts`, `agentKpiAggregator.ts`) and call them from thin route handlers.

### Anti-Pattern 4: Client-Side CSV Generation for Large Datasets

**What:** Fetching all records to the browser and generating CSV client-side.

**Why bad:** For large date ranges, this could mean thousands of records transferred as JSON, then transformed to CSV in the browser.

**Instead:** Add server-side CSV streaming endpoints (`GET /api/exports/sales?from=...&to=...&format=csv`) that set `Content-Type: text/csv` and stream rows. For the current scale (hundreds of records), client-side CSV is acceptable, but design the API to support server-side export for when data grows.

---

## Data Flow: Complete v1.2 Integration

```
CS Dashboard
  |
  POST /api/chargebacks (batch)
  |
  +-> Create ChargebackSubmission records
  +-> AlertService.createAlert(CHARGEBACK_SUBMITTED, targetRole: PAYROLL)
  +-> emitCSChanged({ type: "chargeback_batch" })
  |     |
  |     +-> CS Dashboard (other tabs refresh)
  |
  +-> emitAlertCreated({ type: CHARGEBACK_SUBMITTED, targetRole: PAYROLL })
        |
        +-> Payroll Dashboard (alert badge appears)
              |
              GET /api/alerts?role=PAYROLL
              |
              +-> Show alert inbox with chargeback details
              +-> User approves/clears -> PATCH /api/alerts/:id/clear

Agent KPI Tables
  |
  GET /api/agents/kpi-summary?from=...&to=...
  |
  +-> AgentKpiAggregator queries:
  |     ChargebackSubmission (grouped by agent)
  |     PendingTerm (grouped by agent)
  |     Sale counts per agent
  |
  +-> Returns per-agent summary with chargeback/pending term counts
  |
  +-> Owner Dashboard + Manager Dashboard render KPI tables
```

## Schema Changes Required

### New Models

```prisma
model Alert {
  id         String    @id @default(cuid())
  type       String                          // CHARGEBACK_SUBMITTED, CHARGEBACK_RESOLVED
  entityType String    @map("entity_type")
  entityId   String?   @map("entity_id")
  targetRole UserRole
  metadata   Json?
  read       Boolean   @default(false)
  clearedAt  DateTime? @map("cleared_at")
  clearedBy  String?   @map("cleared_by")
  createdAt  DateTime  @default(now()) @map("created_at")

  @@index([targetRole, read])
  @@map("alerts")
}
```

### Modified Models

```prisma
model CsRepRoster {
  // Add fields:
  serviceAgentId  String?   @map("service_agent_id")
  lastAssignedAt  DateTime? @map("last_assigned_at")
  assignmentCount Int       @default(0) @map("assignment_count")
  isAvailable     Boolean   @default(true) @map("is_available")

  serviceAgent ServiceAgent? @relation(fields: [serviceAgentId], references: [id])
}

model ServiceAgent {
  // Add relation:
  csRepRoster CsRepRoster[]
}
```

### No Schema Changes Needed For

- Date range exports (query param change only)
- AI scoring display (data already in CallAudit)
- Agent KPI aggregation (read-side queries on existing tables)
- Socket.IO CS events (code change only)
- Payroll UX fixes (frontend only)

## New API Endpoints

| Endpoint | Method | Purpose | Dashboard |
|----------|--------|---------|-----------|
| `/api/alerts` | GET | List alerts for role | Payroll |
| `/api/alerts/:id/clear` | PATCH | Clear/approve alert | Payroll |
| `/api/alerts/:id/read` | PATCH | Mark alert as read | Payroll |
| `/api/agents/kpi-summary` | GET | Agent KPI with chargeback/pending term data | Owner, Manager |
| `/api/call-audits/summary` | GET | Aggregate AI scores per agent | Owner |
| `/api/cs-rep-roster/:id/toggle-available` | PATCH | Toggle rep availability | CS |
| `/api/cs-rep-roster/round-robin` | POST | Auto-assign batch to reps | CS |

### Modified Endpoints (date range support)

All existing list/export endpoints gain `?from=YYYY-MM-DD&to=YYYY-MM-DD` support:
- `GET /api/sales`
- `GET /api/chargebacks`
- `GET /api/pending-terms`
- `GET /api/payroll/periods`
- `GET /api/tracker/summary`
- `GET /api/owner/summary`
- `GET /api/call-audits`
- `GET /api/call-logs`
- `GET /api/call-logs/kpi`

### Modified Endpoints (role access)

- `GET /api/settings/ai-audit-prompt` — add OWNER_VIEW access
- `PUT /api/settings/ai-audit-prompt` — add OWNER_VIEW access

## New Socket.IO Events

| Event | Payload | Emitted When | Consumed By |
|-------|---------|-------------|-------------|
| `cs:changed` | `{ type, batchId?, recordId? }` | Chargeback/pending term created or resolved | CS Dashboard |
| `alert:created` | `{ type, targetRole, metadata }` | Alert created | Payroll Dashboard |

## New Files

| File | Type | Purpose |
|------|------|---------|
| `apps/ops-api/src/services/alerts.ts` | Service | Alert CRUD + Socket.IO emit |
| `apps/ops-api/src/services/agentKpiAggregator.ts` | Service | Cross-table agent KPI queries |
| `packages/ui/src/components/DateRangeFilter.tsx` | Component | Shared date range picker |

## Build Order (Dependency Chain)

| Phase | What | Why This Order | Dependencies |
|-------|------|---------------|--------------|
| 1 | Cross-dashboard date range (dateRange helper + DateRangeFilter UI) | Foundational — every other feature needs date filtering for testing and export | None |
| 2 | CS Socket.IO events | Small change, unblocks real-time CS + alert pipeline | None |
| 3 | Alert model + AlertService + payroll alert inbox | Requires Socket.IO events (phase 2) | Phase 2 |
| 4 | Chargeback -> alert pipeline wiring | Connects CS submissions to payroll alerts | Phase 3 |
| 5 | Agent KPI aggregation (chargeback + pending term per agent) | Requires date range filtering (phase 1) | Phase 1 |
| 6 | AI scoring display in owner dashboard | Uses existing data, just needs new aggregation endpoint + UI | Phase 1 (date range) |
| 7 | Service agent sync (CsRepRoster <-> ServiceAgent) | Schema migration, independent of other features | None |
| 8 | Rep checklist / round robin | Requires CsRepRoster schema changes (phase 7) | Phase 7 |
| 9 | Payroll UX fixes (toggle, edit per sale, card layout, +10 indicator) | Pure frontend, no API dependencies | None (can parallel with any phase) |
| 10 | Manager dashboard cleanup (remove commission column, fix INP error) | Pure frontend, no API dependencies | None (can parallel with any phase) |

**Phase ordering rationale:**
- Date range is horizontal infrastructure used by every dashboard — build first
- Socket.IO for CS is a 15-minute change that unblocks the alert pipeline
- Alert pipeline is the biggest architectural addition and most complex integration
- KPI aggregation and AI scoring are read-only query additions — lower risk
- Service agent sync and rep checklist are self-contained
- UI-only fixes (phases 9-10) can be done in parallel with anything

## Scalability Considerations

| Concern | Current Scale | At 10K records | Mitigation |
|---------|--------------|----------------|------------|
| Alert table growth | Dozens/week | Thousands | Add TTL cleanup (archive alerts older than 90 days) |
| KPI aggregation query | Fast (hundreds of chargebacks) | Slow without indexes | Ensure indexes on `memberAgentId`, `agentName`, `createdAt` |
| Date range exports | Fine (client-side CSV) | Large JSON payloads | Add server-side CSV streaming endpoint as escape hatch |
| Socket.IO connections | ~6 dashboards open | Same | Not a concern — internal tool, fixed user count |
| Routes file size | ~2200 lines | ~2500 lines | Extract into domain-grouped route files in v1.3 if needed |

## Sources

- Codebase analysis: `apps/ops-api/src/` (routes, services, socket, workers)
- Schema: `prisma/schema.prisma`
- Socket patterns: `packages/socket/src/` (useSocket, types)
- AI pipeline: `apps/ops-api/src/services/callAudit.ts`, `auditQueue.ts`
- Payroll engine: `apps/ops-api/src/services/payroll.ts`

---
*Research completed: 2026-03-18 — v1.2 Platform Polish & Integration*
