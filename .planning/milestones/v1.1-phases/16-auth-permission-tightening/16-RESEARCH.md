# Phase 16: Auth & Permission Tightening - Research

**Researched:** 2026-03-18
**Domain:** Frontend RBAC permission logic, auth-portal role mapping
**Confidence:** HIGH

## Summary

Phase 16 is a surgical frontend-only fix. The CS dashboard currently uses a negative-check pattern (`isCSOnly` = has CUSTOMER_SERVICE but NOT SUPER_ADMIN and NOT OWNER_VIEW) to gate features. This means any role not explicitly excluded gets access, which is fragile. The fix replaces this with a positive allowlist (`canManageCS` = has SUPER_ADMIN OR OWNER_VIEW).

The auth-portal login route also needs CUSTOMER_SERVICE added to the effectiveRoles array for SUPER_ADMIN so the CS dashboard card appears on the landing page. The DASHBOARD_MAP already includes a CUSTOMER_SERVICE entry, and the landing page already shows all DASHBOARD_MAP keys for SUPER_ADMIN, but adding it to effectiveRoles ensures consistency with the roles-based rendering path.

An audit of all other dashboards (manager, payroll, owner, sales-board) confirms they already use positive role checks. No negative-check patterns exist outside the CS dashboard.

**Primary recommendation:** Replace `isCSOnly` with `canManageCS` boolean across 6 usage sites in cs-dashboard/app/page.tsx, add CUSTOMER_SERVICE to effectiveRoles in auth-portal login route. No backend changes needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace `isCSOnly` negative check with a positive `canManageCS` boolean: `roles.includes('SUPER_ADMIN') || roles.includes('OWNER_VIEW')`
- `canManageCS` controls three things: Submissions tab visibility, delete button visibility, CSV export button visibility
- Change applies to `apps/cs-dashboard/app/page.tsx` only
- Backend DELETE endpoints already use `requireRole("SUPER_ADMIN", "OWNER_VIEW")` -- no backend changes needed
- Audit manager-dashboard, payroll-dashboard, owner-dashboard, and sales-board for similar negative-check patterns
- No route-level blocking for CS dashboard -- any authenticated user can navigate there
- Non-privileged users see only Tracking tab in read-only mode
- Add CUSTOMER_SERVICE to effectiveRoles array for SUPER_ADMIN in `apps/auth-portal/app/api/login/route.ts`
- Currently: `["SUPER_ADMIN", "MANAGER", "PAYROLL"]` -> updated to: `["SUPER_ADMIN", "MANAGER", "PAYROLL", "CUSTOMER_SERVICE"]`

### Claude's Discretion
- Whether to rename `isCSOnly` variable or remove it entirely
- How to structure the dashboard audit (single pass or per-dashboard)
- Whether to add comments explaining the canManageCS pattern

### Deferred Ideas (OUT OF SCOPE)
- Customizable permissions table -- Owner dashboard feature for configuring role access through a UI
- Route-level dashboard access control -- Block non-authorized roles from reaching certain dashboards
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROLE-04 | Owner and super_admin can access both Submissions and Tracking tabs | `canManageCS` boolean derived from SUPER_ADMIN or OWNER_VIEW roles controls Submissions tab visibility. Currently gated by `isCSOnly` negative check which works but is fragile. |
</phase_requirements>

## Architecture Patterns

### Current Pattern (Problem)

The `isCSOnly` variable at line 500-502 of `apps/cs-dashboard/app/page.tsx`:

```typescript
// CURRENT (negative check -- fragile)
const isCSOnly = userRoles.includes("CUSTOMER_SERVICE")
  && !userRoles.includes("SUPER_ADMIN")
  && !userRoles.includes("OWNER_VIEW");
```

This is used in 6 places:
1. **Line 504** -- `navItems` conditional (tabs shown)
2. **Line 511** -- `effectiveTab` override
3. **Line 522** -- passed as prop to `TrackingTab`
4. **Line 1691** -- `canExport` (already partially positive: also checks SUPER_ADMIN/OWNER_VIEW)
5. **Line 2015** -- chargeback delete button visibility (`!isCSOnly`)
6. **Line 2241** -- pending terms delete button visibility (`!isCSOnly`)

### Target Pattern (Fix)

```typescript
// REPLACEMENT (positive allowlist -- matches backend guards)
const canManageCS = userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW");
```

Usage mapping:
| Current | Replacement |
|---------|-------------|
| `isCSOnly ? [tracking] : [submissions, tracking]` | `canManageCS ? [submissions, tracking] : [tracking]` |
| `effectiveTab = isCSOnly ? "tracking" : tab` | `effectiveTab = canManageCS ? tab : "tracking"` |
| `<TrackingTab isCSOnly={isCSOnly}>` | `<TrackingTab canManageCS={canManageCS}>` |
| `canExport = !isCSOnly && (...)` | `canExport = canManageCS` (simplified) |
| `{!isCSOnly && !cb.resolvedAt && (` | `{canManageCS && !cb.resolvedAt && (` |
| `{!isCSOnly && !pt.resolvedAt && (` | `{canManageCS && !pt.resolvedAt && (` |

### Auth-Portal Fix

File: `apps/auth-portal/app/api/login/route.ts` line 40-42

```typescript
// CURRENT
const effectiveRoles = roles.includes("SUPER_ADMIN")
  ? ["SUPER_ADMIN", "MANAGER", "PAYROLL"]
  : roles;

// FIX
const effectiveRoles = roles.includes("SUPER_ADMIN")
  ? ["SUPER_ADMIN", "MANAGER", "PAYROLL", "CUSTOMER_SERVICE"]
  : roles;
```

### Prop Interface Update

The `TrackingTab` and `TrackingTabInner` components accept `isCSOnly` as a prop. This needs renaming:

```typescript
// Lines 1347 and 1355
function TrackingTab({ userRoles, isCSOnly }: { userRoles: string[]; isCSOnly: boolean })
function TrackingTabInner({ userRoles, isCSOnly }: { userRoles: string[]; isCSOnly: boolean })

// BECOMES
function TrackingTab({ userRoles, canManageCS }: { userRoles: string[]; canManageCS: boolean })
function TrackingTabInner({ userRoles, canManageCS }: { userRoles: string[]; canManageCS: boolean })
```

### Anti-Patterns to Avoid
- **Negative role checks:** Never gate features with `!hasRole("X")`. Always use positive allowlists (`hasRole("SUPER_ADMIN") || hasRole("OWNER_VIEW")`). Negative checks break when new roles are added.
- **Redundant checks:** The current `canExport` at line 1691 combines `!isCSOnly` AND positive role checks. With `canManageCS`, this simplifies to just `canManageCS` since it already checks the same roles.

## Dashboard Audit Results

| Dashboard | File | Negative Checks Found | Status |
|-----------|------|----------------------|--------|
| manager-dashboard | `app/page.tsx` | None. Uses positive check: `userRoles.includes("PAYROLL") \|\| userRoles.includes("SUPER_ADMIN")` at line 2068 | Clean |
| payroll-dashboard | `app/page.tsx` | No role checks in frontend | Clean |
| owner-dashboard | `app/page.tsx` | Positive check: `roles.includes("SUPER_ADMIN")` at lines 1191, 1207 | Clean |
| sales-board | `app/page.tsx` | No role checks (public board) | Clean |
| cs-dashboard | `app/page.tsx` | `isCSOnly` negative pattern at 6 locations | Needs fix |

**Audit conclusion:** Only cs-dashboard has the negative-check anti-pattern. All other dashboards either use positive allowlists or have no frontend role gating.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role checking | Custom role hierarchy | Simple `.includes()` positive check | Backend already enforces RBAC via `requireRole()` middleware. Frontend gating is UX-only. |

## Common Pitfalls

### Pitfall 1: Logic Inversion When Replacing isCSOnly with canManageCS
**What goes wrong:** All conditionals using `isCSOnly` need their boolean logic flipped. `isCSOnly` is true when the user CANNOT manage; `canManageCS` is true when they CAN.
**Why it happens:** Mechanical find-replace without inverting conditions.
**How to avoid:** Map each usage explicitly (see table above). `!isCSOnly` becomes `canManageCS`. Ternaries swap their branches.
**Warning signs:** Submissions tab visible to CS-only users, or delete buttons hidden from SUPER_ADMIN.

### Pitfall 2: Missing Prop Rename Propagation
**What goes wrong:** Renaming `isCSOnly` in the parent but forgetting to update `TrackingTab` and `TrackingTabInner` prop interfaces and internal usage.
**Why it happens:** The prop is passed through two layers: CSDashboard -> TrackingTab -> TrackingTabInner.
**How to avoid:** Update all three: prop definition in parent, TrackingTab signature, TrackingTabInner signature and internal usage at line 1691.

### Pitfall 3: canExport Redundancy
**What goes wrong:** Keeping the old compound check `!isCSOnly && (userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW"))` when `canManageCS` already encodes exactly those role checks.
**How to avoid:** Simplify `canExport = canManageCS`.

## Code Examples

### Complete isCSOnly Replacement

```typescript
// In CSDashboard component (replaces lines 500-522)
const canManageCS = userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW");

const navItems = canManageCS
  ? [
      { icon: <ClipboardList size={18} />, label: "Submissions", key: "submissions" },
      { icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" },
    ]
  : [{ icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" }];

const effectiveTab = canManageCS ? tab : "tracking";

return (
  <PageShell ...>
    {effectiveTab === "submissions" && <SubmissionsTab />}
    {effectiveTab === "tracking" && <TrackingTab userRoles={userRoles} canManageCS={canManageCS} />}
  </PageShell>
);
```

### Delete Button Guard (replaces !isCSOnly)

```typescript
// Lines 2015 and 2241 -- swap !isCSOnly for canManageCS
{canManageCS && !cb.resolvedAt && (
  <button onClick={() => handleDeleteCb(cb.id)} ...>
    <Trash2 size={14} />
  </button>
)}
```

### Simplified canExport

```typescript
// Line 1691 -- simplify compound check
const canExport = canManageCS;
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service only) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROLE-04 | SUPER_ADMIN and OWNER_VIEW see Submissions + Tracking tabs; CS-only sees Tracking only | manual-only | Manual browser verification with different role logins | N/A |

**Manual-only justification:** This phase modifies Next.js React components in `apps/cs-dashboard` and `apps/auth-portal`. No Jest test infrastructure exists for these frontend apps (Jest covers only the root Morgan service). Adding React Testing Library + JSDOM for a 6-line boolean change would be disproportionate. The backend role guards are already enforced by `requireRole()` middleware -- this is purely UX gating.

### Sampling Rate
- **Per task commit:** Manual verification: login as SUPER_ADMIN, OWNER_VIEW, CUSTOMER_SERVICE, MANAGER and confirm correct tab/button visibility
- **Per wave merge:** Same manual verification
- **Phase gate:** Confirm all 4 role scenarios show correct UI state

### Wave 0 Gaps
None -- this phase is a small frontend-only fix with no test infrastructure needed beyond manual verification.

## Open Questions

None. The scope is fully defined by the CONTEXT.md decisions and confirmed by code inspection.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/cs-dashboard/app/page.tsx` -- isCSOnly pattern at lines 500-522, 1347, 1355, 1691, 2015, 2241
- Direct code inspection of `apps/auth-portal/app/api/login/route.ts` -- effectiveRoles at lines 39-42
- Direct code inspection of `apps/auth-portal/app/landing/page.tsx` -- DASHBOARD_MAP at lines 35-76, isSuperAdmin logic at lines 320-329
- Direct code inspection of `apps/ops-api/src/middleware/auth.ts` -- requireRole with SUPER_ADMIN bypass at line 29
- Direct code inspection of `packages/types/src/index.ts` -- AppRole type including CUSTOMER_SERVICE
- Grep audit of manager-dashboard, payroll-dashboard, owner-dashboard, sales-board for negative role patterns -- none found

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, pure code refactor
- Architecture: HIGH -- direct code inspection of all affected files
- Pitfalls: HIGH -- all edge cases identified from actual code review
- Audit: HIGH -- grep search across all dashboard apps confirms no other negative-check patterns

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external dependencies)
