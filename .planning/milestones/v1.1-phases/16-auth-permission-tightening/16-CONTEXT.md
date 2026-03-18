# Phase 16: Auth & Permission Tightening - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix permission logic in the CS dashboard so Submissions tab, delete buttons, and CSV export use positive role allowlists (SUPER_ADMIN/OWNER_VIEW only) instead of the current `isCSOnly` negative check. Ensure SUPER_ADMIN sees the Customer Service dashboard card on the auth-portal landing page. Audit all dashboards for similar negative-check permission patterns.

</domain>

<decisions>
## Implementation Decisions

### Permission logic fix
- Replace `isCSOnly` negative check with a positive `canManageCS` boolean: `roles.includes('SUPER_ADMIN') || roles.includes('OWNER_VIEW')`
- `canManageCS` controls three things in the CS dashboard:
  1. Submissions tab visibility (only shown if canManageCS)
  2. Delete button visibility (only shown if canManageCS)
  3. CSV export button visibility (only shown if canManageCS)
- This change applies to `apps/cs-dashboard/app/page.tsx` only — other dashboards keep their own role gating
- Backend DELETE endpoints already use `requireRole("SUPER_ADMIN", "OWNER_VIEW")` — no backend changes needed for delete

### Dashboard permission audit
- Audit manager-dashboard, payroll-dashboard, owner-dashboard, and sales-board for similar negative-check patterns
- Fix any found patterns to use positive allowlists matching the backend role guards

### Dashboard access control
- No route-level blocking for the CS dashboard — any authenticated user can navigate there
- Non-privileged users (MANAGER, PAYROLL, ADMIN) see only the Tracking tab in read-only mode if they reach the CS dashboard
- This keeps things simple and will be easy to swap to a configurable permissions system in a future phase

### Auth-portal card display
- Add CUSTOMER_SERVICE to the effectiveRoles array for SUPER_ADMIN in `apps/auth-portal/app/api/login/route.ts`
- Currently: `["SUPER_ADMIN", "MANAGER", "PAYROLL"]` → updated to: `["SUPER_ADMIN", "MANAGER", "PAYROLL", "CUSTOMER_SERVICE"]`
- The landing page already shows all DASHBOARD_MAP cards for SUPER_ADMIN via `Object.keys(DASHBOARD_MAP)` bypass, but adding CS to effectiveRoles ensures consistency

### Claude's Discretion
- Whether to rename `isCSOnly` variable or remove it entirely
- How to structure the dashboard audit (single pass or per-dashboard)
- Whether to add comments explaining the canManageCS pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CS dashboard permissions (PRIMARY)
- `apps/cs-dashboard/app/page.tsx` — Lines 500-511: isCSOnly check, navItems, effectiveTab. Lines 2015-2028 and 2241-2254: delete buttons. CSV export buttons.

### Auth portal
- `apps/auth-portal/app/landing/page.tsx` — Lines 35-76: DASHBOARD_MAP. Lines 320-329: isSuperAdmin card selection logic.
- `apps/auth-portal/app/api/login/route.ts` — Lines 39-42: effectiveRoles mapping for SUPER_ADMIN.

### Backend role guards
- `apps/ops-api/src/middleware/auth.ts` — requireAuth, requireRole. SUPER_ADMIN bypass at line 29.
- `apps/ops-api/src/routes/index.ts` — DELETE endpoints at lines 1960 and 2160 already use requireRole("SUPER_ADMIN", "OWNER_VIEW").

### Role types
- `packages/types/src/index.ts` — AppRole type definition with CUSTOMER_SERVICE.

### Other dashboards (audit targets)
- `apps/manager-dashboard/app/page.tsx` — Check for negative role checks
- `apps/payroll-dashboard/app/page.tsx` — Check for negative role checks
- `apps/owner-dashboard/app/page.tsx` — Check for negative role checks
- `apps/sales-board/app/page.tsx` — Check for negative role checks

### Requirements
- `.planning/REQUIREMENTS.md` — ROLE-04: owner and super_admin can access both Submissions and Tracking tabs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authFetch` from @ops/auth/client — already used for all API calls
- `requireRole()` middleware — backend already enforces correct role guards
- DASHBOARD_MAP object — already has CUSTOMER_SERVICE card defined

### Established Patterns
- Inline React.CSSProperties for all styling
- Role fetching via `/api/session/me` with `authFetch` in useEffect
- Tab state via useState with type union
- `!isCSOnly` pattern used for feature gating (to be replaced with `canManageCS`)

### Integration Points
- `apps/cs-dashboard/app/page.tsx` — Replace isCSOnly with canManageCS for tabs, delete, CSV
- `apps/auth-portal/app/api/login/route.ts` — Add CUSTOMER_SERVICE to effectiveRoles
- Other dashboard apps — Audit for similar negative-check patterns

</code_context>

<specifics>
## Specific Ideas

- canManageCS should be a single boolean derived from roles, used consistently for all three gating points (tabs, delete, CSV export)
- The change only affects CS dashboard — other dashboards manage their own permissions independently
- Backend is already correct — this is purely a frontend permission fix

</specifics>

<deferred>
## Deferred Ideas

- **Customizable permissions table** — Owner dashboard feature where roles' access to each dashboard and feature can be configured through a UI. Significant new capability for a future phase.
- **Route-level dashboard access control** — Block non-authorized roles from even reaching certain dashboards (redirect to their own). Could be part of the customizable permissions feature.

</deferred>

---

*Phase: 16-auth-permission-tightening*
*Context gathered: 2026-03-18*
