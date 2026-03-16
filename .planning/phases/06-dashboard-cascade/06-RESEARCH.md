# Phase 6: Dashboard Cascade - Research

**Researched:** 2026-03-16
**Domain:** Real-time WebSocket event broadcasting with Socket.IO across Next.js dashboards
**Confidence:** HIGH

## Summary

This phase adds real-time sale cascade across four dashboards using Socket.IO, which is already installed and running in the ops-api server (v4.8.3) and the manager-dashboard client. The server has a singleton pattern in `apps/ops-api/src/socket.ts` with typed emit helpers -- we extend this with a `sale:changed` event. Three dashboards (sales-board, payroll, owner) need Socket.IO client integration; the manager dashboard already has a working connection pattern to reuse.

The user decided on a shared `@ops/socket` package with a `useSocket` hook, single `sale:changed` event with type discriminator, and direct local state patching (no API refetch on event). The existing monorepo package pattern (`packages/{name}/`) with workspace resolution and `transpilePackages` in each Next.js app provides a clear template. The sales board currently polls every 30 seconds -- Socket.IO replaces this with instant updates while keeping the poll as a fallback.

**Primary recommendation:** Build `@ops/socket` package first, then wire server-side emits into POST /api/sales and status-change-request approval, then integrate each dashboard one at a time.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single `sale:changed` event emitted from the server with full payload
- Payload includes: type discriminator, sale object, and payroll entries array
- Type discriminator values: `created`, `updated`, `status_changed`, `deleted`
- Each dashboard picks what it needs from the same payload -- no per-dashboard events or namespaces
- Approval actions (edit request approved, status change approved) also emit `sale:changed` events
- Dashboards patch local React state directly from event payload (no API refetch on event)
- `created` inserts into lists, `updated` replaces in lists, `status_changed` updates status + recomputes, `deleted` removes from lists
- Sales board re-sorts leaderboard rankings on every event (agent may jump positions)
- New/changed rows get a brief highlight animation (blue glow, 1.5s fade) to draw attention
- Owner KPI numbers swap instantly (no count animation), combined with highlight glow on the card
- Manager agent tracker: new sale row inserted AND agent sale count summary incremented
- Silent auto-reconnect (Socket.IO default behavior)
- On reconnect, do a one-time full data refetch to catch events missed during disconnect
- Show disconnection banner only if disconnected for 10+ seconds
- No JWT auth required for Socket.IO connections -- sale data is already publicly visible on sales board
- Create shared `@ops/socket` package with `useSocket` hook and typed event interfaces, imported by all dashboard apps
- Sale creation (POST /api/sales) -- core cascade trigger
- Dead/Declined-to-Ran status change approval -- treated as new sale appearing
- NOT triggered by: sale editing, Ran-to-Dead/Declined status changes, sale deletion
- Sales board treats Dead/Declined-to-Ran as a new entry (sale wasn't previously showing per STATUS-08)

### Claude's Discretion
- Exact payload shape and field selection for the sale object
- Socket.IO transport configuration (websocket vs polling fallback order)
- Debounce/throttle strategy if multiple events fire rapidly
- Internal structure of the @ops/socket package
- Highlight animation CSS implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CASC-01 | Sale entry appears on agent tracker in manager dashboard in real-time | Manager dashboard already has Socket.IO client connection pattern (line ~969); extend with `sale:changed` listener that patches tracker state and agent sales list |
| CASC-02 | Sale entry appears on sales board leaderboard in real-time | Sales board currently polls `/api/sales-board/detailed` every 30s; add Socket.IO connection using `@ops/socket` hook, patch `DetailedData` state and re-sort |
| CASC-03 | Sale entry updates the correct agent's payroll card in payroll dashboard | Payroll dashboard has `AgentPayCard` component (line ~773) with per-agent entries; Socket.IO event patches entries for matching agent's period |
| CASC-04 | Sale entry updates KPI metrics on owner dashboard | Owner dashboard has `summary` state (salesCount, premiumTotal, clawbacks, openPayrollPeriods) and `tracker` state; patch both from event payload |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | ^4.8.3 | Server-side WebSocket with fallback | Already installed in ops-api, proven in production |
| socket.io-client | ^4.8.3 | Client-side Socket.IO | Already installed in manager-dashboard, match server version |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | - | All dependencies already in the monorepo |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO | SSE (Server-Sent Events) | SSE is simpler for one-way but Socket.IO already set up, has reconnect built-in |
| Socket.IO | WebSocket raw | Socket.IO adds reconnect, fallback, room support -- already in use |
| State patching | Full refetch on event | User explicitly decided against refetch for performance |

**Installation:**
```bash
# socket.io-client needs adding to three dashboard apps (already in manager-dashboard)
cd apps/sales-board && npm install socket.io-client@^4.8.3
cd apps/payroll-dashboard && npm install socket.io-client@^4.8.3
cd apps/owner-dashboard && npm install socket.io-client@^4.8.3

# New shared package (no external deps beyond socket.io-client)
# packages/socket/package.json references socket.io-client as peer dependency
```

## Architecture Patterns

### Recommended Project Structure
```
packages/socket/
  package.json           # @ops/socket, peerDeps: socket.io-client
  src/
    index.ts             # re-exports useSocket hook and types
    useSocket.ts         # React hook: connect, reconnect, disconnect banner
    types.ts             # SaleChangedPayload, SaleChangedType discriminator

apps/ops-api/src/
  socket.ts              # EXTEND: add emitSaleChanged() helper
  routes/index.ts        # MODIFY: call emitSaleChanged after sale creation and approval

apps/{dashboard}/
  app/page.tsx           # MODIFY: add useSocket() + event handler in each dashboard
  next.config.js         # MODIFY: add @ops/socket to transpilePackages
  package.json           # MODIFY: add @ops/socket workspace dependency
```

### Pattern 1: Server-side Emit Helper (extend existing socket.ts)
**What:** Add `emitSaleChanged()` to the existing singleton emit pattern
**When to use:** After successful DB write in route handlers
**Example:**
```typescript
// apps/ops-api/src/socket.ts
export type SaleChangedType = "created" | "updated" | "status_changed" | "deleted";

export interface SaleChangedPayload {
  type: SaleChangedType;
  sale: {
    id: string;
    saleDate: string;
    memberName: string;
    memberId?: string;
    carrier: string;
    premium: number;
    enrollmentFee: number | null;
    status: string;
    agent: { id: string; name: string };
    product: { id: string; name: string; type: string };
    addons?: { product: { id: string; name: string; type: string } }[];
  };
  payrollEntries: {
    id: string;
    payoutAmount: number;
    adjustmentAmount: number;
    bonusAmount: number;
    frontedAmount: number;
    holdAmount: number;
    netAmount: number;
    status: string;
    periodId: string;
    periodWeekStart: string;
    periodWeekEnd: string;
  }[];
}

export function emitSaleChanged(payload: SaleChangedPayload) {
  io?.emit("sale:changed", payload);
}
```

### Pattern 2: Shared useSocket Hook
**What:** React hook managing Socket.IO lifecycle, reconnect, and disconnection banner
**When to use:** In every dashboard's main page component
**Example:**
```typescript
// packages/socket/src/useSocket.ts
import { useEffect, useRef, useState, useCallback } from "react";
import type { SaleChangedPayload } from "./types";

type SocketClient = import("socket.io-client").Socket;

export function useSocket(
  apiUrl: string,
  onSaleChanged: (payload: SaleChangedPayload) => void,
  onReconnect?: () => void,
) {
  const [disconnected, setDisconnected] = useState(false);
  const socketRef = useRef<SocketClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let socket: SocketClient;
    // Dynamic import to avoid SSR issues (Next.js pattern from manager-dashboard)
    import("socket.io-client").then(({ io }) => {
      socket = io(apiUrl, { transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("sale:changed", onSaleChanged);

      socket.on("disconnect", () => {
        timerRef.current = setTimeout(() => setDisconnected(true), 10_000);
      });

      socket.on("connect", () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (disconnected) {
          setDisconnected(false);
          onReconnect?.(); // Full refetch to catch missed events
        }
      });
    });

    return () => {
      socketRef.current?.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [apiUrl]); // Stable deps only -- callbacks via refs if needed

  return { disconnected };
}
```

### Pattern 3: Dashboard State Patching (per dashboard)
**What:** Each dashboard's event handler patches its local state from the payload
**When to use:** Inside the `onSaleChanged` callback passed to `useSocket`
**Example (sales board):**
```typescript
// In SalesBoard component
const handleSaleChanged = useCallback((payload: SaleChangedPayload) => {
  if (payload.sale.status !== "RAN") return; // Only RAN sales on board
  // Refresh full data since board aggregates are complex
  refresh();
}, []);
```

### Pattern 4: Highlight Animation with Inline Styles
**What:** Blue glow with 1.5s fade for new/changed rows
**When to use:** On rows/cards that just received an update via Socket.IO
**Example:**
```typescript
// Track highlighted IDs with timestamps
const [highlights, setHighlights] = useState<Set<string>>(new Set());

// On event: add ID to highlights, remove after 1.5s
const highlightItem = (id: string) => {
  setHighlights(prev => new Set(prev).add(id));
  setTimeout(() => {
    setHighlights(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, 1500);
};

// Style applied to row/card
const HIGHLIGHT: React.CSSProperties = {
  boxShadow: "0 0 20px rgba(59, 130, 246, 0.15), 0 0 40px rgba(59, 130, 246, 0.08)",
  transition: "box-shadow 1.5s ease-out",
};
```

### Anti-Patterns to Avoid
- **Refetching on every event:** User explicitly decided against this. Patch state directly.
- **Per-dashboard Socket.IO events:** User decided single `sale:changed` event, each dashboard filters locally.
- **SSR socket connection:** Always use dynamic `import("socket.io-client")` in useEffect -- Next.js v15 will error on server-side socket connections.
- **Emitting before DB commit:** Always emit after successful transaction to avoid broadcasting failed operations.
- **Forgetting reconnect refetch:** On reconnect, do a full data refetch to catch events missed while disconnected.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom reconnect logic | Socket.IO built-in reconnect | Handles backoff, transport fallback automatically |
| Event typing | Untyped string events | Shared TypeScript interfaces in @ops/socket | Prevents payload mismatches across 4 dashboards |
| Dynamic import for SSR | Conditional require() | `import("socket.io-client")` in useEffect | Established pattern in manager-dashboard (line ~970) |
| Connection state tracking | Custom heartbeat | Socket.IO `connect`/`disconnect` events | Already handles network changes, tab sleep, etc. |

**Key insight:** Socket.IO handles all the hard WebSocket problems (reconnection, fallback, multiplexing). The real work in this phase is the state patching logic in each dashboard, which is dashboard-specific and cannot be abstracted.

## Common Pitfalls

### Pitfall 1: SSR Socket Connection Crash
**What goes wrong:** Socket.IO client imported at module level causes "window is not defined" in Next.js
**Why it happens:** Next.js v15 renders components on server first
**How to avoid:** Dynamic import inside useEffect (already established pattern in manager-dashboard)
**Warning signs:** Build errors mentioning `window`, `WebSocket`, or `navigator`

### Pitfall 2: Stale Closure in Event Handler
**What goes wrong:** Socket.IO event callback captures stale state, patches don't work correctly
**Why it happens:** useEffect creates closure over initial state values
**How to avoid:** Use functional setState (`setData(prev => ...)`) in all event handlers, or use refs for callbacks
**Warning signs:** Updates work on first event but not subsequent ones

### Pitfall 3: CORS Blocking Socket.IO from New Dashboards
**What goes wrong:** Sales board, payroll, owner dashboards can't connect to Socket.IO
**Why it happens:** Socket.IO server CORS uses `allowedOrigins` from env -- all dashboard ports are already listed (3011-3026)
**How to avoid:** Verify CORS config in `apps/ops-api/src/index.ts` line 49-54 -- already includes all ports
**Warning signs:** Console shows CORS errors on WebSocket upgrade

### Pitfall 4: Sales Board Has No Auth
**What goes wrong:** Attempting to use authFetch or JWT validation for socket connections on sales board
**Why it happens:** Instinct to secure all connections
**How to avoid:** User decided no JWT auth for Socket.IO -- sales board is publicly accessible. Don't add auth middleware to socket connections.
**Warning signs:** Sales board socket failing to connect while others work

### Pitfall 5: Payroll Entry Data Not Available at Emit Time
**What goes wrong:** Emit fires before `upsertPayrollEntryForSale` completes, payload has no payroll data
**Why it happens:** Current POST /api/sales calls upsert in a try/catch after sale creation (line 314-318)
**How to avoid:** Emit AFTER upsertPayrollEntryForSale completes. Re-fetch the sale with includes and payroll entries before emitting.
**Warning signs:** Payroll dashboard receives event but entries array is empty

### Pitfall 6: Complex Board Aggregation From Single Sale Event
**What goes wrong:** Sales board uses aggregated `DetailedData` (agents[], weeklyDays[], weeklyTotals[], todayStats[]) that's hard to incrementally patch from a single sale
**Why it happens:** Board endpoint does server-side aggregation across all agents and days
**How to avoid:** For the sales board specifically, a simplified approach may work better: on `sale:changed` with type `created`, increment the correct agent's count and premium in todayStats and the matching weekday row. Or simply call `refresh()` which is already a fast endpoint.
**Warning signs:** Board data gets out of sync with complex partial patches

### Pitfall 7: Highlight Animation Without CSS Transitions
**What goes wrong:** Blue glow appears but doesn't fade -- it just disappears abruptly
**Why it happens:** Inline styles can't animate removal without transition setup
**How to avoid:** Use a two-phase approach: apply highlight style, then after a frame, remove it (with transition property set). Or use a CSS class injected via a `<style>` tag.
**Warning signs:** Glow snaps on/off instead of smooth 1.5s fade

## Code Examples

### Server-side emit after sale creation
```typescript
// In POST /api/sales handler, after upsertPayrollEntryForSale
// Re-fetch sale with relations for the event payload
const fullSale = await prisma.sale.findUnique({
  where: { id: sale.id },
  include: {
    agent: { select: { id: true, name: true } },
    product: { select: { id: true, name: true, type: true } },
    addons: { include: { product: { select: { id: true, name: true, type: true } } } },
  },
});
const payrollEntries = await prisma.payrollEntry.findMany({
  where: { saleId: sale.id },
  include: { period: { select: { id: true, weekStart: true, weekEnd: true } } },
});
emitSaleChanged({
  type: "created",
  sale: fullSale!,
  payrollEntries: payrollEntries.map(e => ({
    id: e.id,
    payoutAmount: Number(e.payoutAmount),
    adjustmentAmount: Number(e.adjustmentAmount),
    bonusAmount: Number(e.bonusAmount),
    frontedAmount: Number(e.frontedAmount),
    holdAmount: Number(e.holdAmount),
    netAmount: Number(e.netAmount),
    status: e.status,
    periodId: e.period.id,
    periodWeekStart: e.period.weekStart.toISOString(),
    periodWeekEnd: e.period.weekEnd.toISOString(),
  })),
});
```

### Server-side emit after Dead/Declined-to-Ran approval
```typescript
// In POST /status-change-requests/:id/approve handler, after upsertPayrollEntryForSale
// Only emit for Dead/Declined -> Ran transitions (user decision)
if (changeRequest.newStatus === "RAN" && changeRequest.oldStatus !== "RAN") {
  const fullSale = await prisma.sale.findUnique({
    where: { id: changeRequest.saleId },
    include: {
      agent: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, type: true } },
      addons: { include: { product: { select: { id: true, name: true, type: true } } } },
    },
  });
  const payrollEntries = await prisma.payrollEntry.findMany({
    where: { saleId: changeRequest.saleId },
    include: { period: { select: { id: true, weekStart: true, weekEnd: true } } },
  });
  emitSaleChanged({
    type: "status_changed",
    sale: fullSale!,
    payrollEntries: payrollEntries.map(e => ({
      id: e.id,
      payoutAmount: Number(e.payoutAmount),
      adjustmentAmount: Number(e.adjustmentAmount),
      bonusAmount: Number(e.bonusAmount),
      frontedAmount: Number(e.frontedAmount),
      holdAmount: Number(e.holdAmount),
      netAmount: Number(e.netAmount),
      status: e.status,
      periodId: e.period.id,
      periodWeekStart: e.period.weekStart.toISOString(),
      periodWeekEnd: e.period.weekEnd.toISOString(),
    })),
  });
}
```

### Shared package.json for @ops/socket
```json
{
  "name": "@ops/socket",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "peerDependencies": {
    "socket.io-client": "^4.8.0",
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

### Disconnection Banner Component
```typescript
// Inside useSocket or as a separate component
const BANNER: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  padding: "8px 16px",
  background: "rgba(239, 68, 68, 0.9)",
  color: "#fff",
  textAlign: "center",
  fontSize: 13,
  fontWeight: 600,
  zIndex: 9999,
  backdropFilter: "blur(8px)",
};
// Render: {disconnected && <div style={BANNER}>Connection lost. Reconnecting...</div>}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling every 30s (sales board) | Socket.IO real-time events | This phase | Instant updates, no polling delay |
| No cross-dashboard updates | Single event broadcast to all | This phase | Sale appears everywhere simultaneously |
| Manual page refresh needed | Auto state patching from events | This phase | Zero-refresh workflow for all users |

**Current codebase state:**
- Socket.IO server running in ops-api (v4.8.3) -- only emits audit events currently
- Manager dashboard has working Socket.IO client for audit events -- pattern to reuse
- Three other dashboards have no Socket.IO connection yet
- Sales board polls every 30s via `setInterval`

## Open Questions

1. **Decimal serialization for payroll amounts**
   - What we know: Prisma Decimal fields serialize as strings by default, but the dashboards expect numbers
   - What's unclear: Whether `Number()` conversion in the emit helper is sufficient or if precision issues arise
   - Recommendation: Use `Number()` conversion (already done elsewhere in the codebase for display), flag if precision matters for >2 decimal places

2. **Sales board aggregation complexity**
   - What we know: `/api/sales-board/detailed` returns heavily aggregated data (weeklyDays, weeklyTotals, todayStats by agent name)
   - What's unclear: Whether incremental patching is worth the complexity vs. just calling `refresh()` on event
   - Recommendation: Start with calling `refresh()` on `sale:changed` event for the sales board. The endpoint is fast (no auth, simple query) and the 30s poll already works. If latency is noticeable, optimize to incremental patching later. This satisfies CASC-02 (real-time appearance) without complex aggregation logic.

3. **Owner dashboard range-filtered KPIs**
   - What we know: Owner dashboard fetches summary with range filter (today/week/month)
   - What's unclear: Whether to patch locally and risk range mismatch, or refetch with current range
   - Recommendation: On `sale:changed`, call `fetchData(range)` to refetch with current range filter. The owner summary endpoint is fast and authenticated. This avoids complex client-side range filtering.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x (existing) |
| Config file | `apps/ops-api/jest.config.ts` and root `jest.config.js` |
| Quick run command | `npm test -- --testPathPattern socket` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CASC-01 | Manager tracker updates on sale:changed | manual-only | N/A -- requires browser with Socket.IO connection | N/A |
| CASC-02 | Sales board updates on sale:changed | manual-only | N/A -- requires browser with Socket.IO connection | N/A |
| CASC-03 | Payroll card updates on sale:changed | manual-only | N/A -- requires browser with Socket.IO connection | N/A |
| CASC-04 | Owner KPIs update on sale:changed | manual-only | N/A -- requires browser with Socket.IO connection | N/A |

**Manual-only justification:** All four requirements are about real-time UI updates across browser clients connected via WebSocket. The server-side emit logic is straightforward (call `emitSaleChanged` after DB write) and testable as a unit, but the actual cascade behavior requires multiple browser windows. Testing this automatically would require a full E2E framework (Playwright/Cypress) which is out of scope for this project.

### Testable Server-Side Units
| Behavior | Test Type | Command |
|----------|-----------|---------|
| `emitSaleChanged` calls `io.emit` with correct payload shape | unit | `npm test -- socket` |
| Payload type discriminator matches trigger action | unit | `npm test -- socket` |

### Sampling Rate
- **Per task commit:** Manual verification -- create a sale in manager dashboard, observe all four dashboards
- **Per wave merge:** Full manual cascade test with all four dashboards open
- **Phase gate:** All four dashboards showing real-time updates verified visually

### Wave 0 Gaps
- [ ] `packages/socket/` directory and package.json -- new shared package
- [ ] `socket.io-client` in sales-board, payroll-dashboard, owner-dashboard package.json
- [ ] `@ops/socket` added to `transpilePackages` in all four dashboard next.config.js files
- [ ] `@ops/socket` added as workspace dependency in all four dashboard package.json files

## Sources

### Primary (HIGH confidence)
- `apps/ops-api/src/socket.ts` -- existing Socket.IO singleton pattern, 4 emit helpers for audit events
- `apps/ops-api/src/index.ts` -- Socket.IO server setup (lines 47-62), CORS config includes all dashboard ports
- `apps/manager-dashboard/app/page.tsx` (lines 968-983) -- existing dynamic import pattern for socket.io-client
- `apps/ops-api/src/routes/index.ts` (line 279) -- POST /api/sales handler, (line 1404) status change approval
- `apps/ops-api/package.json` -- socket.io ^4.8.3
- `apps/manager-dashboard/package.json` -- socket.io-client ^4.8.3

### Secondary (MEDIUM confidence)
- Socket.IO v4 documentation -- reconnection is enabled by default with exponential backoff
- Socket.IO transport order -- websocket first with polling fallback is the recommended configuration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Socket.IO already installed and running, no new dependencies needed
- Architecture: HIGH -- extending existing patterns (socket.ts singleton, dynamic import, shared packages)
- Pitfalls: HIGH -- based on direct code inspection of all four dashboards and the server
- State patching strategy: MEDIUM -- sales board and owner dashboard may need refetch instead of direct patching (documented in Open Questions)

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- Socket.IO 4.x is mature, project patterns are established)
