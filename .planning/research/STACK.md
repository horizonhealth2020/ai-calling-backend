# Technology Stack

**Project:** Ops Platform v1.2 -- Platform Polish & Integration
**Researched:** 2026-03-18

## Existing Stack (DO NOT change)

Already validated and shipping. Listed for reference only.

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15 | All 6 dashboard apps |
| Express.js | 4.19.x | ops-api REST server |
| Prisma | 5.20.x | ORM + migrations |
| PostgreSQL | -- | Primary database |
| Socket.IO | 4.8.x | Real-time dashboard cascade |
| Zod | 3.23.x | Request validation |
| Luxon | 3.4.x | Timezone-aware date handling |
| @anthropic-ai/sdk | 0.78.0 | AI call audit (Claude) |
| OpenAI SDK | 4.73.x | Legacy fallback auditor |
| Recharts | 3.8.x | Dashboard charts |
| Lucide React | 0.577.x | Icons |

## Recommended Stack Additions for v1.2

### ZERO new npm packages needed

v1.2 does NOT require any new libraries. Every feature maps to existing capabilities. This is the key finding.

Here is the feature-by-feature analysis:

---

### 1. AI Call Transcript Scoring (visible/editable system prompt)

**What exists:** `@anthropic-ai/sdk` v0.78.0 is installed and fully integrated in `apps/ops-api/src/services/callAudit.ts`. The system prompt is already stored in `SalesBoardSetting` (key: `ai_audit_system_prompt`) and loaded dynamically before each audit. Routes for GET/PUT of the system prompt exist in `routes/index.ts` (lines ~1502-1516). The audit pipeline downloads recordings, transcribes via Whisper API, runs structured analysis via Claude tool-use, stores results in `CallAudit` with both legacy fields and structured JSON fields (issues, wins, missed_opportunities, suggested_coaching).

**What v1.2 needs:**
- Owner dashboard UI tab to display and edit the system prompt (frontend only -- API already exists)
- Fix the "INP not defined" error in owner dashboard (CSS constant bug, not a library issue)
- Optionally bump `@anthropic-ai/sdk` from 0.78.0 to 0.79.0 (latest) -- minor patch, not required

**New libraries needed:** NONE

**Confidence:** HIGH -- verified by reading `callAudit.ts`, `auditQueue.ts`, and route definitions directly.

| Decision | Rationale |
|----------|-----------|
| Keep @anthropic-ai/sdk 0.78.0 | Working in production, 0.79.0 is a minor bump with no breaking changes. Upgrade opportunistically, not as a blocker. |
| Keep OpenAI as fallback | Already coded as fallback when ANTHROPIC_API_KEY is missing. No reason to remove. |
| Keep SalesBoardSetting for prompt storage | Already works. A dedicated `SystemConfig` table would be over-engineering for a single key-value pair. |

---

### 2. Cross-Dashboard Date Range CSV Exports

**What exists:** CSV exports are 100% client-side. The payroll dashboard builds CSV strings in-browser from already-fetched data and triggers downloads via `URL.createObjectURL` + invisible `<a>` tag click. The API has a `dateRange()` helper that accepts `range=today|week|month` query params and computes `{ gte, lt }` boundaries.

**What v1.2 needs:**
- Extend the `dateRange()` API helper to accept custom ISO date strings (e.g., `from=2026-01-01&to=2026-01-31`) alongside the existing preset ranges
- Add a date range picker UI component to each dashboard's export section
- The date picker is a standard HTML `<input type="date">` -- no library needed with the inline CSSProperties pattern

**New libraries needed:** NONE

**Confidence:** HIGH -- verified by reading `dateRange()` function (routes/index.ts lines 30-55) and payroll CSV export code.

| Decision | Rationale |
|----------|-----------|
| Use native `<input type="date">` | Project uses inline CSSProperties, no CSS framework. A date picker library (react-datepicker, etc.) would add styling conflicts. Native date inputs work in all modern browsers and match the existing form pattern. |
| Extend `dateRange()` server-side | Adding `from`/`to` params to the existing helper is ~10 lines. Client can pass custom ranges or presets. |
| Keep client-side CSV generation | Data is already fetched for display. Generating CSV server-side would duplicate logic and add download endpoints for every dashboard. |

---

### 3. Chargeback-to-Payroll Alert Pipeline

**What exists:** `ChargebackSubmission` and `Clawback` models in Prisma. Payroll entries with `adjustmentAmount` (allows negatives for chargebacks). Socket.IO event infrastructure (`emitSaleChanged`).

**What v1.2 needs:**
- New `PayrollAlert` Prisma model (type, sourceId, status, message, createdAt) -- schema change only
- API endpoint to create alert when chargeback is submitted (or resolved)
- API endpoint to list/approve/clear alerts for payroll dashboard
- Socket.IO event for new alerts (`payroll:alert`)
- Payroll dashboard UI for alert list with approve/clear actions

**New libraries needed:** NONE

**Confidence:** HIGH -- this is a standard CRUD + event pattern using existing Prisma + Socket.IO + Express.

| Decision | Rationale |
|----------|-----------|
| New Prisma model, not a JSON column | Alerts need querying (unread count, filtering by status). A dedicated table with proper indexes is correct. |
| Socket.IO for real-time alerts | Already used for sale cascading. Same pattern: server emits on creation, dashboard listens. |
| No external notification service | Alerts are in-app only (payroll dashboard). No email/SMS/Slack needed for internal ops tool. |

---

### 4. Pending Terms + Chargebacks within 30 Days to Agent KPIs

**What exists:** `PendingTerm` and `ChargebackSubmission` models with `memberId`, `agentName` fields. `AgentCallKpi` model for call-based KPIs. Sales linked to agents via `agentId`.

**What v1.2 needs:**
- Server-side query joining chargebacks/pending terms to agents (via member ID matching to sales, or direct agent name)
- New API endpoint returning per-agent chargeback/pending-term counts and amounts within a rolling 30-day window
- KPI table components in manager and owner dashboards
- No new models needed -- these are computed views over existing data

**New libraries needed:** NONE

**Confidence:** HIGH -- pure Prisma queries and frontend tables.

| Decision | Rationale |
|----------|-----------|
| Computed at query time, not materialized | Volume is low (dozens of agents, hundreds of chargebacks). Real-time accuracy matters more than query optimization. |
| Match via memberId on Sale | ChargebackSubmission has `memberId`, Sale has `memberId` + `agentId`. Join through Sale to get agent. |

---

### 5. Storage Monitoring / Alerting with CSV Download

**What exists:** Nothing for storage monitoring. The project runs on Railway (cloud PaaS) and Docker.

**What v1.2 needs:** Clarification on what "storage" means in this context:

- **If database storage (PostgreSQL):** Query `pg_database_size()` via Prisma raw query (`prisma.$queryRaw`). No library needed.
- **If disk storage (server filesystem):** Use Node.js built-in `fs.statfs()` (available since Node 18.15, stable in Node 20.x). No external library needed.
- **If recording storage (Convoso audio files):** These are external URLs, not stored locally. Monitoring would mean tracking row counts/sizes in the database.

**New libraries needed:** NONE (Node 20.x `fs.statfs` covers disk checks natively)

**Confidence:** MEDIUM -- "storage alerting" is ambiguous in the requirements. Need to clarify whether this means database size, disk usage, or data volume tracking.

| Decision | Rationale |
|----------|-----------|
| Use `fs.statfs()` for disk monitoring | Native Node 20.x API. No dependency needed. Returns free/total bytes. |
| Use `pg_database_size()` for DB monitoring | Standard PostgreSQL function, callable via `prisma.$queryRaw`. |
| CSV download of storage data | Same client-side CSV pattern as existing exports. |

---

### 6. Real-Time Socket.IO for CS Submissions

**What exists:** Socket.IO server in `apps/ops-api/src/socket.ts` with typed emit functions: `emitSaleChanged`, `emitAuditStatus`, `emitAuditComplete`. CS dashboard exists at `apps/cs-dashboard`.

**What v1.2 needs:**
- Add `emitCSSubmission` function to `socket.ts` (same pattern as `emitSaleChanged`)
- Emit after chargeback/pending term creation in routes
- CS dashboard connects to Socket.IO and listens for new submissions

**New libraries needed:** NONE -- `socket.io` (server) already installed in ops-api, `socket.io-client` already used by other dashboards.

**Confidence:** HIGH -- exact same pattern as existing sale cascade events.

---

### 7. Rep Checklist for Round Robin Assignment

**What exists:** `CsRepRoster` model with `name`, `active` fields. `assignedTo` field on both `ChargebackSubmission` and `PendingTerm`.

**What v1.2 needs:**
- Add `assignmentCount` to `CsRepRoster` for round-robin tracking
- Server-side function to pick next rep (least-assigned among active reps)
- UI checklist component showing active reps with toggle

**New libraries needed:** NONE

**Confidence:** HIGH -- trivial state tracking on an existing model.

---

## What NOT to Add

| Library | Why You Might Think to Add It | Why NOT To |
|---------|-------------------------------|------------|
| react-datepicker | Date range picker for exports | Native `<input type="date">` works. Adding a date picker library introduces CSS conflicts with the inline CSSProperties pattern. No globals.css allowed. |
| @tanstack/react-query | Data fetching + caching | Existing `authFetch()` wrapper works. Adding a query library to 6 dashboards mid-project is a rewrite, not an enhancement. |
| node-cron (new jobs) | Scheduled storage checks | Already installed at root. If periodic storage checks are needed, add a cron job to the existing pattern. No new package. |
| check-disk-space | Disk monitoring | Node 20.x has native `fs.statfs()`. Zero-dependency solution. |
| bull / bullmq | Job queue for alerts | The in-memory audit queue (`auditQueue.ts`) works for the scale of this app. Alert creation is synchronous -- no queue needed. |
| nodemailer | Email notifications | Out of scope. Alerts are in-app only. |
| winston / pino | Structured logging | `@ops/utils` already has `logEvent`/`logError`. Don't split logging infrastructure. |
| prisma-json-types-generator | Typed JSON columns | Nice-to-have but adds build complexity. Cast with `as any` like existing code does for `issues`, `wins`, etc. |

## Version Pinning Strategy

No version bumps are required. If choosing to bump opportunistically:

| Package | Current | Latest | Risk | Recommendation |
|---------|---------|--------|------|----------------|
| @anthropic-ai/sdk | 0.78.0 | 0.79.0 | Low (patch) | Bump if convenient, not blocking |
| Prisma | 5.20.0 | 5.x latest | Low | Stay on 5.20.x unless a specific feature is needed |
| Socket.IO | 4.8.3 | 4.8.x | Low | No action needed |

## New Prisma Schema Additions

These are the only infrastructure changes needed:

```prisma
model PayrollAlert {
  id              String   @id @default(cuid())
  type            String   // "chargeback", "pending_term", "storage"
  sourceType      String   @map("source_type") // "ChargebackSubmission", "PendingTerm"
  sourceId        String   @map("source_id")
  agentName       String?  @map("agent_name")
  message         String
  amount          Decimal? @db.Decimal(12, 2)
  status          String   @default("pending") // "pending", "approved", "cleared"
  reviewedBy      String?  @map("reviewed_by")
  reviewedAt      DateTime? @map("reviewed_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([status])
  @@index([createdAt])
  @@map("payroll_alerts")
}
```

And modifications to existing models:

```prisma
// Add to CsRepRoster:
  assignmentCount Int @default(0) @map("assignment_count")
```

## New Socket.IO Events

| Event | Payload | Emitter | Listener |
|-------|---------|---------|----------|
| `cs:submission` | `{ type, id, agentName, memberName }` | ops-api on chargeback/pending term create | cs-dashboard |
| `payroll:alert` | `{ id, type, message, amount }` | ops-api on alert create | payroll-dashboard |

## New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/payroll-alerts` | List alerts (filterable by status) |
| PUT | `/api/payroll-alerts/:id/approve` | Approve alert |
| PUT | `/api/payroll-alerts/:id/clear` | Clear/dismiss alert |
| GET | `/api/agents/:id/kpis` | Agent KPIs including chargeback/pending term counts |
| GET | `/api/storage/status` | Database size + optional disk usage |

## Installation

```bash
# No new packages to install.
# Only Prisma migration needed:
npx prisma migrate dev --name add-payroll-alerts-and-rep-tracking
```

## Summary

v1.2 is an integration milestone, not a technology milestone. Every feature builds on existing infrastructure:

- **AI scoring:** Already built (callAudit.ts). Need frontend exposure only.
- **Date range exports:** Extend existing `dateRange()` helper + native date inputs.
- **Alert pipeline:** New Prisma model + Socket.IO event (existing patterns).
- **Agent KPIs:** Prisma queries over existing data.
- **Storage monitoring:** Node.js native APIs.
- **CS real-time:** Same Socket.IO pattern as sale cascade.
- **Round robin:** Counter field on existing model.

Zero new npm dependencies. One new Prisma model. Two new Socket.IO events. Five new API endpoints.

## Sources

- [Anthropic SDK on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- v0.79.0 latest (MEDIUM confidence)
- [check-disk-space on npm](https://www.npmjs.com/package/check-disk-space) -- evaluated and rejected in favor of native Node 20 APIs
- [Node.js fs.statfs docs](https://nodejs.org/api/fs.html#fsstatfspath-options-callback) -- native disk monitoring (HIGH confidence)
- Codebase verification: `apps/ops-api/src/services/callAudit.ts`, `apps/ops-api/src/socket.ts`, `apps/ops-api/src/routes/index.ts`, `prisma/schema.prisma` (HIGH confidence)

---
*Research completed: 2026-03-18*
