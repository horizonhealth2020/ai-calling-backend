# Phase 1: Sales Entry Fix - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the 500 error on sale creation so a manager can submit a sale from the manager dashboard and have it persist correctly. Add memberState column to Sale model and per-addon premium to SaleAddon model. Improve error/success feedback on the form.

</domain>

<decisions>
## Implementation Decisions

### memberState handling
- Add `memberState` column to Sale model (String, optional, max 2 chars)
- No migration backfill — existing sales stay null
- Blank/null memberState = no FL exemption (standard commission rules apply)
- Field remains optional in the form — no new friction for managers

### SaleAddon premiums
- Add `premium` field to SaleAddon model (Decimal, optional)
- This is being added in Phase 1 (not deferred to Phase 4) to get the schema right early
- Null premium on an addon = skip commission calculation for that addon (no $0 payroll entries)
- Premium field is optional in the form — managers can add addons without entering a premium

### Error feedback
- Errors display inline above the form as a red alert bar — form stays visible so input isn't lost
- Error format: friendly message + HTTP status code (e.g., "Failed to create sale (400): Member name is required") — matches existing dashboard pattern
- Success: green success bar inline + form clears to blank + auto-dismiss after 5s
- Sales list auto-refreshes after successful creation (re-fetch weekly sales)

### Claude's Discretion
- Exact styling of success/error alert bars (follow existing dark glassmorphism theme)
- Auto-dismiss timing details
- Prisma migration file structure

</decisions>

<specifics>
## Specific Ideas

- No migration backfill for existing data — clean forward-only approach
- The `memberState` field already exists in the frontend form with maxLength=2 and uppercase transform — backend just needs to persist it
- Receipt parser already extracts memberState from text — that flow should continue working

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authFetch()` from `@ops/auth/client`: Already used for all API calls, injects Bearer token
- `zodErr()` helper in ops-api: Wraps Zod validation errors with `error` key for dashboard display
- `asyncHandler()`: Wraps async route handlers for error forwarding
- `INP` style constant in manager-dashboard: Inline CSSProperties for form inputs

### Established Patterns
- Inline React.CSSProperties with dark glassmorphism theme — no Tailwind, no globals.css
- Zod validation on API routes with `.optional()` for non-required fields
- `upsertPayrollEntryForSale(sale.id)` called after sale creation for commission calc
- Error display pattern: `err.error` key checked in dashboard error handlers

### Integration Points
- `POST /api/sales` route in `apps/ops-api/src/routes/index.ts` (line ~279) — where memberState needs to be persisted
- `payroll.ts` line 110 — `sale.memberState?.toUpperCase() === "FL"` needs the field to actually exist on the Sale type
- Manager dashboard `submitSale()` (line ~732) — already sends memberState in request body
- `blankForm()` (line ~631) — already includes memberState and addonProductIds

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-sales-entry-fix*
*Context gathered: 2026-03-14*
