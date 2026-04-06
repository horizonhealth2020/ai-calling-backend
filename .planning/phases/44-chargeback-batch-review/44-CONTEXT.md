# Phase 44: Chargeback Batch Review - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

CS staff can paste multiple chargebacks, review all parsed entries with match status and product details in a review table, edit or remove entries, and submit the entire batch in one action. This adds a review step between paste/parse and submission in the existing CSSubmissions flow.

</domain>

<decisions>
## Implementation Decisions

### Match preview flow
- **D-01:** New `POST /api/chargebacks/preview` endpoint that receives parsed records, runs the same memberId matching logic as the existing submit endpoint, and returns match status + matched sale details (agent name, products with id/name/type/premium, member info, chargeback amount) without creating any database records.
- **D-02:** Frontend calls the preview endpoint after paste/parse completes. The review table is populated from the preview response, not from the raw parsed data alone.
- **D-03:** For MULTIPLE match status (several sales match one memberId), the review table shows all candidate sales. User selects which sale the chargeback applies to, promoting the entry to MATCHED status in the review state.

### Review table layout
- **D-04:** All-visible flat rows — every field visible in a wide table row with no expansion/collapse. Products shown inline. Horizontal scrolling if needed for many columns.
- **D-05:** Each row displays: match status badge (MATCHED green / MULTIPLE yellow / UNMATCHED red), member name, member ID, agent name, chargeback amount, product checkboxes, rep assignment dropdown, and remove button.
- **D-06:** Validation summary bar above the review table shows colored count badges (X Matched, Y Multiple, Z Unmatched) plus total chargeback dollar amount. Clicking a badge filters the table to show only entries with that status.

### Product selection UX
- **D-07:** For matched entries, sale products appear as inline checkboxes directly in the flat row. Each checkbox shows product name + premium amount.
- **D-08:** Toggling a product checkbox auto-recalculates the row's chargeback amount to reflect only the selected products' premiums. User can still manually override the amount field after auto-calculation.

### Edit & remove behavior
- **D-09:** Amount, rep assignment (dropdown), and product checkboxes are always interactive — no click-to-edit toggle. Matches the existing CSSubmissions pattern where fields are directly editable in the table.
- **D-10:** X button removes the row instantly. A toast notification appears with an "Undo" option for a few seconds. No confirmation modal.

### Claude's Discretion
- Exact column widths and table responsive behavior
- Loading/spinner state while preview API is processing
- How MULTIPLE match candidate sales are visually presented (dropdown, inline list, etc.)
- Toast duration and animation for undo on row removal
- Whether summary bar filter is toggle (click again to clear) or radio-style

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Chargeback UI
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` — Existing paste/parse/submit component. Contains ParsedRow/ConsolidatedRecord types, parser functions, round-robin assignment, table rendering. The review table extends this existing flow.
- `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` — CS tracking view showing submitted chargebacks with match status. Reference for badge styling and status display patterns.
- `apps/ops-dashboard/app/(dashboard)/cs/CSResolvedLog.tsx` — Resolved chargebacks log. Reference for resolution display patterns.

### Chargeback API
- `apps/ops-api/src/routes/chargebacks.ts` — Existing chargeback routes: POST /chargebacks (submit), GET /chargebacks, DELETE, resolve/unresolve. Contains matching logic (memberId → sale lookup) that the preview endpoint must replicate.
- `apps/ops-api/src/services/alerts.ts` — `createAlertFromChargeback()` called during submission. Preview endpoint must NOT create alerts.
- `apps/ops-api/src/routes/cs-reps.ts` — CS rep roster and batch-assign endpoint used for round-robin assignment.

### Database schema
- `prisma/schema.prisma` — ChargebackSubmission model with matchStatus, matchedSaleId, and related Sale/Product models.

### Design system
- `packages/ui/` — Shared components: Card, Button, EmptyState, ToastProvider/useToast, Badge, design tokens (colors, spacing, typography, motion, baseInputStyle, baseThStyle, baseTdStyle).

### Requirements
- `.planning/REQUIREMENTS.md` — CB-01 through CB-09 requirements for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CSSubmissions.tsx` parser functions (`parseChargebackText`, `consolidateByMember`, `assignRoundRobinLocal`): Reuse for paste/parse step before calling preview API.
- `@ops/ui` ToastProvider/useToast: Already imported in CSSubmissions — use for undo-on-remove toast.
- `@ops/ui` baseThStyle/baseTdStyle: Table styling tokens already used in CSSubmissions.
- `fetchBatchAssign()` in CSSubmissions: Existing round-robin assignment via `/api/reps/batch-assign`.
- Match status enum values (MATCHED/MULTIPLE/UNMATCHED) already defined in chargebacks.ts API route.

### Established Patterns
- Inline CSSProperties with SCREAMING_SNAKE_CASE constants (SECTION_HEADING, TEXTAREA, TABLE_WRAP, COMPACT_INPUT) — follow this pattern for new review table styles.
- `authFetch()` from `@ops/auth/client` for all API calls.
- Socket.io `emitCSChanged()` for real-time updates after submission.
- Zod schema validation on API routes with `zodErr()` helper.

### Integration Points
- The review step inserts between existing parse and submit in CSSubmissions.tsx.
- Preview API reuses matching logic from the existing POST /chargebacks handler (memberId → sale lookup).
- Submit still calls existing POST /chargebacks endpoint but now sends user-reviewed/edited data.
- Summary bar badge counts derived from preview API response.

</code_context>

<specifics>
## Specific Ideas

- User specified "full match details and chargeback amount" — preview API should return comprehensive data so the review table has everything it needs in a single call.
- For MULTIPLE matches, user wants to see all candidates and pick one — this resolves ambiguity before submission rather than after.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 44-chargeback-batch-review*
*Context gathered: 2026-04-06*
