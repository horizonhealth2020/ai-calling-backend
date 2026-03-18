# Phase 15: Resolution & Polish - Research

**Researched:** 2026-03-18
**Domain:** Resolution workflow, role-based UI gating, formatting standardization
**Confidence:** HIGH

## Summary

Phase 15 adds resolution workflow to both chargeback and pending terms tracking tables, implements role-based tab visibility and API route gating for the customer_service role, and standardizes date/dollar formatting across all five dashboards via shared `@ops/utils` helpers.

The existing codebase provides strong patterns to follow: the delete handler pattern (optimistic UI update via `setChargebacks(prev => prev.filter(...))`) can be reused for resolve/unresolve, the `fmtDate` function already implements M/D/YYYY format (extract to `@ops/utils`), and `formatDollar` already exists in `cs-dashboard` (extract to `@ops/utils`). The `userRoles` state is already fetched via `/api/session/me` in the TrackingTab, so role-gating decisions can be made client-side for tab visibility and server-side for API protection.

**Primary recommendation:** Layer resolution fields onto existing Prisma models via migration, add PATCH endpoints with role gating, extend the TrackingTab with expandable row panels and status pill toggles, then extract formatting helpers to `@ops/utils` and update all dashboard imports.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Inline "Resolve" button in each table row; clicking expands row downward into panel with details + resolution fields + Save/Cancel
- Resolved records stay visible in default view but dimmed/faded with "Resolved" badge showing resolved_by and resolved_at
- Resolution is reopenable -- resolved records get an "Unresolve" button
- Chargebacks: Two resolution types -- "Recovered" (updates Total Recovered KPI) and "Closed" (written off, no KPI impact)
- Pending terms: Two resolution types -- "Saved" (member retained) and "Cancelled" (member lost)
- Resolution type stored alongside resolved_by, resolved_at, and resolution_note in database
- KPI counters NOT affected by status filters (open/resolved/all toggle)
- Total Recovered KPI updates ONLY when chargeback marked as "Recovered"
- Net Exposure = Total Chargebacks - Total Recovered
- Toggle pill buttons (Open / Resolved / All) above each tracking table, default: Open
- Status filter does NOT affect KPI counters or summary bars
- Remove agent grouping from pending terms table -- flat table view
- customer_service role: Submissions tab invisible, API routes blocked, no delete, no CSV export
- owner and super_admin: Both tabs visible, full access
- Extract formatDollar and formatDate to @ops/utils; update ALL 5 dashboards
- Client-side state management with useMemo for filter changes (consistent with Phase 14)

### Claude's Discretion
- Expandable row panel animation/transition
- Exact pill toggle styling (active/inactive states)
- Database migration approach for resolution fields
- Unresolve API endpoint design
- How to structure the @ops/utils exports

### Deferred Ideas (OUT OF SCOPE)
- Paid toggle fix (payroll dashboard)
- Inline sale editing in payroll
- Remove bonus/fronted/hold from paycard header
- +10 enrollment bonus indicator
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESV-01 | Customer service can mark a chargeback record as resolved with a resolution note | PATCH /api/chargebacks/:id/resolve endpoint + expandable row panel UI |
| RESV-02 | Customer service can mark a pending term record as resolved with a resolution note | PATCH /api/pending-terms/:id/resolve endpoint + expandable row panel UI |
| RESV-03 | Resolved records show resolved status, resolved_by, resolved_at, and resolution note | Dimmed row styling + Resolved badge + resolution metadata display |
| RESV-04 | Tracking tables can filter by status (open/resolved) with open as default view | Status pill toggle (Open/Resolved/All) with client-side useMemo filtering |
| ROLE-02 | customer_service can access Customer Service dashboard Tracking tab only | Client-side navItems filtering based on userRoles |
| ROLE-03 | customer_service cannot access Submissions tab or any other dashboard | Hide Submissions nav + block submission API routes server-side |
| ROLE-04 | owner and super_admin can access both Submissions and Tracking tabs | Default behavior -- no filtering for these roles |
| DASH-02 | Dashboard has two tabs: Submissions and Tracking with role-gated visibility | Conditional navItems array based on role check |
| DASH-04 | All counters, filters, and summaries update without page reload | Already uses useMemo + useState pattern from Phase 14 |
| DASH-05 | All dates M/D/YYYY, all dollars with commas and 2 decimals | Extract formatDollar/formatDate to @ops/utils, audit all dashboards |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | existing | Schema migration for resolution fields | Already used throughout; `prisma migrate dev` for new columns |
| Express | existing | PATCH resolve/unresolve API endpoints | All routes in single flat file `routes/index.ts` |
| Zod | existing | Request validation for resolve payloads | Consistent with all existing route validation |
| React (Next.js 15) | existing | Expandable row panel, status pills, role gating | All dashboards are Next.js 15 apps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/utils | existing | Shared formatDollar and formatDate helpers | All 5 dashboard apps import from here |
| @ops/ui | existing | Card, Button, Input for expandable row panel | Resolve panel UI components |
| @ops/auth/client | existing | authFetch for resolve/unresolve API calls | All API calls in cs-dashboard |
| @ops/types | existing | AppRole type for role checks | Type-safe role comparisons |
| lucide-react | existing | Icons for resolve/unresolve buttons | Already used throughout cs-dashboard |

### Alternatives Considered
None -- all technology is already established in the project.

## Architecture Patterns

### Database Migration: Resolution Fields

Add these fields to both `ChargebackSubmission` and `PendingTerm` models:

```prisma
// On ChargebackSubmission:
resolvedAt        DateTime? @map("resolved_at")
resolvedBy        String?   @map("resolved_by")
resolutionNote    String?   @map("resolution_note")
resolutionType    String?   @map("resolution_type")  // "recovered" | "closed"

resolver          User?     @relation("ChargebackResolvedBy", fields: [resolvedBy], references: [id])

// On PendingTerm:
resolvedAt        DateTime? @map("resolved_at")
resolvedBy        String?   @map("resolved_by")
resolutionNote    String?   @map("resolution_note")
resolutionType    String?   @map("resolution_type")  // "saved" | "cancelled"

resolver          User?     @relation("PendingTermResolvedBy", fields: [resolvedBy], references: [id])
```

**Key consideration:** The User model needs two new relation annotations added for the resolver relations. Check existing User model relations before adding.

### Pattern 1: Resolve/Unresolve API Endpoints

**What:** PATCH endpoints that set/clear resolution fields
**When to use:** For both chargebacks and pending terms

```typescript
// PATCH /api/chargebacks/:id/resolve
const resolveChargebackSchema = z.object({
  resolutionType: z.enum(["recovered", "closed"]),
  resolutionNote: z.string().min(1).max(2000),
});

router.patch("/chargebacks/:id/resolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = resolveChargebackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const record = await prisma.chargebackSubmission.update({
    where: { id: req.params.id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: req.user!.id,
      resolutionNote: parsed.data.resolutionNote,
      resolutionType: parsed.data.resolutionType,
    },
  });
  return res.json(record);
}));

// PATCH /api/chargebacks/:id/unresolve
router.patch("/chargebacks/:id/unresolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const record = await prisma.chargebackSubmission.update({
    where: { id: req.params.id },
    data: {
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      resolutionType: null,
    },
  });
  return res.json(record);
}));
```

Same pattern for pending terms with `z.enum(["saved", "cancelled"])`.

### Pattern 2: Updated Totals Endpoint with Recovery Tracking

The existing `/api/chargebacks/totals` already returns `totalRecovered: 0` (hardcoded). Update to calculate from resolution data:

```typescript
// Sum chargebackAmount where resolutionType = "recovered"
const recoveredResult = await prisma.chargebackSubmission.aggregate({
  _sum: { chargebackAmount: true },
  where: { resolutionType: "recovered" },
});
const totalRecovered = recoveredResult._sum.chargebackAmount
  ? Math.abs(Number(recoveredResult._sum.chargebackAmount))
  : 0;
```

### Pattern 3: Role-Gated Tab Visibility

```typescript
// In CSDashboard component, fetch roles and conditionally build navItems
const [userRoles, setUserRoles] = useState<string[]>([]);

// After fetching /api/session/me
const isCS = userRoles.includes("CUSTOMER_SERVICE")
  && !userRoles.includes("SUPER_ADMIN")
  && !userRoles.includes("OWNER_VIEW");

const navItems = isCS
  ? [{ icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" }]
  : [
      { icon: <ClipboardList size={18} />, label: "Submissions", key: "submissions" },
      { icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" },
    ];

// Force tab to "tracking" for CS role
const effectiveTab = isCS ? "tracking" : tab;
```

**Important:** The role check must happen at the top-level `CSDashboard` component, not just in the tab. Currently, `userRoles` is only fetched inside `TrackingTab`. It needs to be lifted to the parent component.

### Pattern 4: Server-Side Route Protection

Block submission routes for customer_service:

```typescript
// Existing routes already use requireRole("SUPER_ADMIN", "OWNER_VIEW")
// POST /chargebacks -- already protected
// POST /pending-terms -- already protected
// DELETE /chargebacks/:id -- already protected
// DELETE /pending-terms/:id -- already protected
```

**Finding:** The POST and DELETE routes for both chargebacks and pending terms already use `requireRole("SUPER_ADMIN", "OWNER_VIEW")`, which inherently blocks CUSTOMER_SERVICE. No server-side changes needed for submission route blocking. SUPER_ADMIN bypasses all role checks (built into `requireRole` middleware).

### Pattern 5: Expandable Row Panel

```typescript
const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
const [resolveNote, setResolveNote] = useState("");
const [resolveType, setResolveType] = useState<string>("");

// In table body, after the regular row:
{expandedRowId === cb.id && (
  <tr>
    <td colSpan={colCount} style={{ padding: 0, border: "none" }}>
      <div style={{
        padding: spacing.md,
        background: "rgba(255,255,255,0.03)",
        borderTop: `1px solid ${colors.border}`,
      }}>
        {/* Resolution type selector + note textarea + Save/Cancel */}
      </div>
    </td>
  </tr>
)}
```

### Pattern 6: Status Pill Toggle

```typescript
type StatusFilter = "open" | "resolved" | "all";
const [cbStatusFilter, setCbStatusFilter] = useState<StatusFilter>("open");

// Filter in useMemo:
const filteredChargebacks = useMemo(() => {
  let data = chargebacks;
  // Status filter FIRST
  if (cbStatusFilter === "open") data = data.filter(cb => !cb.resolvedAt);
  else if (cbStatusFilter === "resolved") data = data.filter(cb => !!cb.resolvedAt);
  // Then existing filters...
  return data;
}, [chargebacks, cbStatusFilter, /* other deps */]);
```

### Pattern 7: Shared Formatting Helpers

```typescript
// packages/utils/src/index.ts -- add alongside existing logEvent/logError

/** Format a number as $X,XXX.XX (always positive, 2 decimal places) */
export function formatDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Format a negative dollar as -$X,XXX.XX */
export function formatNegDollar(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `-$${abs}`;
}

/** Format an ISO date string as M/D/YYYY */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "--";
  const [y, m, dd] = d.split("T")[0].split("-");
  return `${parseInt(m)}/${parseInt(dd)}/${y}`;
}
```

### Anti-Patterns to Avoid
- **Don't filter KPI totals by status:** KPI counters must always show global totals regardless of the Open/Resolved/All toggle. The totals endpoint should always return unfiltered aggregates.
- **Don't use a separate isResolved boolean:** Store resolution as nullable fields (resolvedAt, resolvedBy, etc.). A record is "open" when resolvedAt is null. No separate status enum needed.
- **Don't gate roles only client-side:** Even though Submissions tab is hidden for CS, the API routes must also block access. (Already handled by existing `requireRole` on POST/DELETE routes.)
- **Don't add CUSTOMER_SERVICE to the ROLE_ENUM Zod schema in routes:** The user management Zod enum at line 101 of routes/index.ts only includes existing roles. CUSTOMER_SERVICE was already added to AppRole type in Phase 11 but may not be in the Zod schema for user creation. Verify before assuming it works.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dollar formatting | Per-dashboard format functions | `@ops/utils` `formatDollar` | 5 dashboards with inconsistent formatting today |
| Date formatting | Per-dashboard fmtDate functions | `@ops/utils` `formatDate` | Existing `fmtDate` in cs-dashboard already does M/D/YYYY |
| Role checking | Custom role logic in each component | Check against `userRoles` array with SUPER_ADMIN bypass | Consistent with existing `requireRole` server-side pattern |
| Optimistic UI updates | Full re-fetch after resolve/unresolve | Update local state like delete handler pattern | Already established in Phase 14 delete handlers |

## Common Pitfalls

### Pitfall 1: User Model Relation Conflicts
**What goes wrong:** Adding resolver relations to User model causes Prisma schema validation errors
**Why it happens:** User model already has `ChargebackSubmittedBy` and `PendingTermSubmittedBy` relations. New resolver relations need unique names and the User model needs corresponding fields.
**How to avoid:** Add explicit relation fields to the User model: `resolvedChargebacks ChargebackSubmission[] @relation("ChargebackResolvedBy")` and `resolvedPendingTerms PendingTerm[] @relation("PendingTermResolvedBy")`
**Warning signs:** `prisma migrate dev` fails with relation error

### Pitfall 2: CUSTOMER_SERVICE Not in User Management Zod Schema
**What goes wrong:** Cannot create CUSTOMER_SERVICE users via the admin API
**Why it happens:** Line 101 of routes/index.ts has `const ROLE_ENUM = z.enum(["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN"])` -- CUSTOMER_SERVICE is missing
**How to avoid:** Add "CUSTOMER_SERVICE" to the ROLE_ENUM Zod schema
**Warning signs:** 400 error when trying to assign CUSTOMER_SERVICE role to a user

### Pitfall 3: Role Check Must Account for SUPER_ADMIN Bypass
**What goes wrong:** SUPER_ADMIN users see reduced UI because client-side check looks for exact "OWNER_VIEW" role
**Why it happens:** Current `canExport` check is `userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW")` which is correct. But new "isCS" check must NOT restrict SUPER_ADMIN even if they also have CUSTOMER_SERVICE role.
**How to avoid:** Always check SUPER_ADMIN first: `const isCSOnly = userRoles.includes("CUSTOMER_SERVICE") && !userRoles.includes("SUPER_ADMIN") && !userRoles.includes("OWNER_VIEW")`
**Warning signs:** Admin users can't see Submissions tab

### Pitfall 4: Lifting userRoles to Parent Component
**What goes wrong:** Tab visibility determined after component renders, causing flash of wrong content
**Why it happens:** Currently `userRoles` is fetched inside `TrackingTab`, but tab visibility needs to be decided at `CSDashboard` level
**How to avoid:** Move the `/api/session/me` fetch to the `CSDashboard` parent component, pass roles down to children. Set default tab to "tracking" to avoid flash (safe for all roles).
**Warning signs:** Brief flash of Submissions tab before it disappears for CS users

### Pitfall 5: Totals Endpoint Must Aggregate Recovery Separately
**What goes wrong:** Total Recovered KPI shows wrong number
**Why it happens:** Must only count chargebacks where `resolutionType = "recovered"`, not all resolved chargebacks
**How to avoid:** Separate aggregate query with `where: { resolutionType: "recovered" }` for the recovery total
**Warning signs:** "Closed" chargebacks incorrectly inflate Total Recovered

### Pitfall 6: Dashboard Import Paths for @ops/utils
**What goes wrong:** Other dashboards can't resolve `@ops/utils` import
**Why it happens:** Each Next.js app needs `@ops/utils` in its `transpilePackages` config and the package must be in workspace dependencies
**How to avoid:** Check that `@ops/utils` is already listed in each dashboard's package.json and next.config.js `transpilePackages`. It likely already is since `@ops/utils` is used by `ops-api`.
**Warning signs:** Module not found error at build time

## Code Examples

### Existing Delete Handler (Pattern to Reuse for Resolve)
```typescript
// Source: apps/cs-dashboard/app/page.tsx line 1512
const handleDeleteCb = async (id: string) => {
  try {
    const res = await authFetch(`${API}/api/chargebacks/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setChargebacks(prev => prev.filter(cb => cb.id !== id));
    }
  } catch { /* silent */ }
};
```

### Existing fmtDate (Extract to @ops/utils)
```typescript
// Source: apps/cs-dashboard/app/page.tsx line 1565
const fmtDate = (d: string | null) => {
  if (!d) return "--";
  const [y, m, dd] = d.split("T")[0].split("-");
  return `${parseInt(m)}/${parseInt(dd)}/${y}`;
};
```

### Existing formatDollar (Extract to @ops/utils)
```typescript
// Source: apps/cs-dashboard/app/page.tsx line 235
function formatDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

### Existing Role Check Pattern
```typescript
// Source: apps/cs-dashboard/app/page.tsx line 1562
const canExport = userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `totalRecovered: 0` in /chargebacks/totals | Aggregate from resolution data | Phase 15 | Total Recovered KPI becomes live |
| Per-dashboard formatting functions | Shared `@ops/utils` formatDollar/formatDate | Phase 15 | Consistent formatting across all dashboards |
| No role gating on tabs | Client + server role gating | Phase 15 | CS role restricted to Tracking only |
| Agent-grouped pending terms table | Flat table (grouping removed) | Phase 15 | Simpler UX per user decision |

## Open Questions

1. **@ops/utils transpilePackages coverage**
   - What we know: ops-api uses @ops/utils. CS dashboard imports from @ops/ui and @ops/auth/client.
   - What's unclear: Whether all 5 frontend dashboard apps already have @ops/utils in their transpilePackages and package.json.
   - Recommendation: Audit each app's next.config.js and package.json during implementation. Add if missing.

2. **Pending terms group-by-agent removal scope**
   - What we know: TRKT-06 required group-by-agent with collapsible sections, now user wants it removed.
   - What's unclear: Whether the existing grouped code should be deleted entirely or just disabled.
   - Recommendation: Delete the grouping code entirely -- the user explicitly chose flat table view.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service only) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- --testPathPattern="helpers"` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESV-01 | Chargeback resolve endpoint sets fields | manual-only | N/A -- no API integration tests exist | N/A |
| RESV-02 | Pending term resolve endpoint sets fields | manual-only | N/A | N/A |
| RESV-03 | Resolved records display metadata | manual-only | N/A -- UI testing | N/A |
| RESV-04 | Status pill filtering works | manual-only | N/A -- client-side UI | N/A |
| ROLE-02 | CS role sees only Tracking tab | manual-only | N/A -- UI + API role check | N/A |
| ROLE-03 | CS role blocked from submission routes | manual-only | N/A -- existing requireRole already blocks | N/A |
| ROLE-04 | Owner/admin sees both tabs | manual-only | N/A -- UI check | N/A |
| DASH-02 | Tab visibility role-gated | manual-only | N/A | N/A |
| DASH-04 | No page reload on filter/data change | manual-only | N/A -- React state behavior | N/A |
| DASH-05 | Consistent date/dollar formatting | manual-only | N/A -- visual check | N/A |

### Sampling Rate
- **Per task commit:** Manual browser testing (no automated test infrastructure for frontend apps)
- **Per wave merge:** Manual verification against success criteria
- **Phase gate:** All 7 success criteria verified manually

### Wave 0 Gaps
- No API integration test infrastructure exists for ops-api routes
- No frontend component tests exist for any dashboard app
- Jest is configured only for the root Morgan voice service
- **Recommendation:** Manual testing is the established pattern for this project. All validation is manual-only, consistent with Phases 11-14.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` lines 476-548 -- Current ChargebackSubmission and PendingTerm models
- `apps/ops-api/src/routes/index.ts` lines 1930-2122 -- Current chargeback and pending terms routes
- `apps/cs-dashboard/app/page.tsx` -- Full dashboard implementation including TrackingTab, formatting, role checks
- `apps/ops-api/src/middleware/auth.ts` -- requireAuth and requireRole middleware
- `packages/types/src/index.ts` -- AppRole enum with CUSTOMER_SERVICE
- `packages/utils/src/index.ts` -- Current exports (logEvent, logError only)
- `packages/ui/src/index.tsx` -- PageShell navItems interface

### Secondary (MEDIUM confidence)
- All dashboard apps grep for formatting patterns -- confirmed inconsistent formatting across apps (mix of toFixed(2), toLocaleString, toLocaleDateString)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- patterns directly extend existing code with clear reference implementations
- Pitfalls: HIGH -- identified from reading actual codebase (relation conflicts, Zod enum gap, role bypass)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external dependencies changing)
