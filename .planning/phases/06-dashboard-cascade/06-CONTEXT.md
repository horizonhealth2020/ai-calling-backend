# Phase 6: Dashboard Cascade - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A sale entered on the manager dashboard appears on all other dashboards in real-time without page refresh. Covers manager agent tracker, sales board leaderboard, payroll agent cards, and owner KPI metrics. Real-time updates also trigger on Dead/Declined-to-Ran status change approvals.

</domain>

<decisions>
## Implementation Decisions

### Event granularity
- Single `sale:changed` event emitted from the server with full payload
- Payload includes: type discriminator, sale object, and payroll entries array
- Type discriminator values: `created`, `updated`, `status_changed`, `deleted`
- Each dashboard picks what it needs from the same payload — no per-dashboard events or namespaces
- Approval actions (edit request approved, status change approved) also emit `sale:changed` events

### Client update strategy
- Dashboards patch local React state directly from event payload (no API refetch on event)
- `created` inserts into lists, `updated` replaces in lists, `status_changed` updates status + recomputes, `deleted` removes from lists
- Sales board re-sorts leaderboard rankings on every event (agent may jump positions)
- New/changed rows get a brief highlight animation (blue glow, 1.5s fade) to draw attention
- Owner KPI numbers swap instantly (no count animation), combined with highlight glow on the card
- Manager agent tracker: new sale row inserted AND agent sale count summary incremented

### Connection & resilience
- Silent auto-reconnect (Socket.IO default behavior)
- On reconnect, do a one-time full data refetch to catch events missed during disconnect
- Show disconnection banner only if disconnected for 10+ seconds
- No JWT auth required for Socket.IO connections — sale data is already publicly visible on sales board
- Create shared `@ops/socket` package with `useSocket` hook and typed event interfaces, imported by all dashboard apps

### Scope of cascade triggers
- Sale creation (POST /api/sales) — core cascade trigger
- Dead/Declined-to-Ran status change approval — treated as new sale appearing (since non-RAN sales are invisible on board/KPIs)
- NOT triggered by: sale editing, Ran-to-Dead/Declined status changes, sale deletion
- Sales board treats Dead/Declined-to-Ran as a new entry (sale wasn't previously showing per STATUS-08)

### Claude's Discretion
- Exact payload shape and field selection for the sale object
- Socket.IO transport configuration (websocket vs polling fallback order)
- Debounce/throttle strategy if multiple events fire rapidly
- Internal structure of the @ops/socket package
- Highlight animation CSS implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Real-time infrastructure
- `apps/ops-api/src/socket.ts` — Existing Socket.IO emit helpers (audit events only — extend with sale events)
- `apps/ops-api/src/index.ts` — Socket.IO server setup, CORS config, connection handler

### Sale creation flow
- `apps/ops-api/src/routes/index.ts` — POST /api/sales (line ~279), status change approval endpoints (~1463)
- `apps/ops-api/src/services/payroll.ts` — upsertPayrollEntryForSale, commission calculation

### Dashboard consumers
- `apps/manager-dashboard/app/page.tsx` — Already has Socket.IO client connection for audit events (line ~969)
- `apps/sales-board/app/page.tsx` — Currently fetch-only, needs Socket.IO integration
- `apps/payroll-dashboard/app/page.tsx` — Currently fetch-only, needs Socket.IO integration
- `apps/owner-dashboard/app/page.tsx` — Currently fetch-only, needs Socket.IO integration

### Shared packages pattern
- `packages/auth/src/index.ts` — Reference for how shared packages are structured in this monorepo
- `packages/types/src/index.ts` — Where shared types live (AppRole, SessionUser)

### Prior decisions affecting this phase
- Phase 10 STATUS-08: Sales board and owner KPIs only count RAN sales
- Phase 10: AgentPayCard extracted for per-card state management with header financial summary
- Phase 10: Pending requests grouped by agentId for display in payroll cards

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/ops-api/src/socket.ts`: Socket.IO singleton pattern with `setIO()` and typed emit helpers — extend with `emitSaleChanged()`
- `apps/manager-dashboard/app/page.tsx` (line ~969): Existing `socket.io-client` dynamic import pattern — reuse in shared hook
- `socket.io-client` already in `manager-dashboard/package.json` — needs adding to other dashboard apps (or centralize in @ops/socket)

### Established Patterns
- Shared packages follow `packages/{name}/src/index.ts` convention with `@ops/{name}` alias
- All dashboard apps use `transpilePackages` in next.config for shared imports
- Inline `React.CSSProperties` for all styling (no Tailwind) — highlight animation must use this pattern
- Dynamic `import("socket.io-client")` used in manager dashboard to avoid SSR issues in Next.js

### Integration Points
- Server: Emit calls go after successful DB transaction in route handlers (POST /api/sales, status change approval)
- Client: Each dashboard's main `page.tsx` useEffect connects to Socket.IO and patches component state
- Shared: New `packages/socket/` package needs workspace entry in root `package.json` and `transpilePackages` in each Next.js app

</code_context>

<specifics>
## Specific Ideas

- Highlight animation: blue glow (`rgba(59, 130, 246, 0.15)`) with 1.5s ease-out fade — consistent across all dashboards
- Sales board leaderboard should feel dynamic and competitive — rankings shift in real-time as sales come in
- Dead/Declined-to-Ran approval on payroll dashboard cascades as if it's a new sale on the board (it was previously invisible)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-dashboard-cascade*
*Context gathered: 2026-03-16*
