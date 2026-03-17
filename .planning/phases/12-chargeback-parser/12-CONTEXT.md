# Phase 12: Chargeback Parser - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can paste raw chargeback text (tab-separated spreadsheet rows) into the Submissions tab, see parsed records consolidated by member in an editable preview table, and submit confirmed records to the database. Includes a persistent rep roster with round-robin auto-distribution and a weekly chargeback total ticker.

</domain>

<decisions>
## Implementation Decisions

### Paste & parse flow
- Raw input is tab-separated text copied from a spreadsheet (Excel/Google Sheets)
- Each paste can contain multiple rows — often several products for the same member
- Auto-parse on paste — no "Parse" button needed, records appear instantly
- Field mapping from raw text (tab-separated positions):
  - posted_date: `22-Feb-26` format
  - type: `ADVANCED COMM` (or similar)
  - payee_id: numeric ID (e.g., `807713`)
  - payee_name: full string (e.g., `Horizon Health Solutions LLC - AOR Leah Fey - ADV2`)
  - payout_percent: `50%` format
  - chargeback_amount: parenthesized dollar pattern `($582.00)` → stored as negative decimal
  - total_amount: `$393.98` format
  - transaction_description: pipe-separated (e.g., `Payment 1,1 | Refund Reversal`)
  - product: name with ID in parens (e.g., `Good Health Distribution Partner Wellness (44899)`)
  - member_company: first value in member info pipe group (e.g., `Shatena Bates`)
  - member_id: second value in member info pipe group (e.g., `686501575`)
  - member_agent_company and member_agent_id: parsed but NOT priority fields
- **Key columns (user priority):** posted_date, total_amount, member_company, product
- After successful submission: clear textarea + show success toast with record count

### Preview & editing (consolidation)
- **Consolidate rows by member** before preview — multiple rows for same member become 1 row
- Sum both `chargeback_amount` and `total_amount` across rows for the same member
- Append products as comma-separated list (e.g., "Partner Wellness (44899), Complete Care (38530)")
- Display as editable table rows — all fields are editable before submit
- **1 consolidated DB record per member per batch** (not separate rows per product)
- Preview table columns: Posted Date, Type, Member Company, Products (consolidated), Chargeback Amount (summed), Total (summed), Assigned To (from rep roster)
- raw_paste stores the original pasted text for the entire batch

### Rep roster & auto-distribution
- Collapsible sidebar panel in the Submissions tab
- Persistent table of rep names stored in database (new `cs_rep_roster` table)
- Each rep has a name and active/inactive toggle
- Users can add, remove, or toggle reps at any time
- When chargebacks are submitted, they are automatically round-robin distributed across all active reps
- `assigned_to` field added to chargeback_submissions record (stores the rep name)
- Assigned rep is visible as a column in the preview table and editable before submit
- Roster records cleaned from database after 30 days (cleanup job or soft approach TBD)

### Total ticker
- **Weekly total** (Sunday–Saturday) of all submitted chargebacks — running sum that updates as batches are submitted
- Positioned above the preview table in the chargeback section
- Large and prominent display — big dollar number as the focal point
- Red text/accent on dark background card (chargebacks = loss theme)
- Shows: dollar total + record count + week date range (e.g., "$4,231.08 — 12 records — Week of 3/15–3/21")
- Fetched from API — sums chargeback_amount for records with submitted_at in current Sun–Sat window

### Claude's Discretion
- Exact parser regex/logic for splitting tab-separated fields
- How to handle malformed or partial rows during parsing
- Collapsible sidebar implementation (CSS transition approach)
- Round-robin tracking mechanism (last-assigned index)
- 30-day cleanup implementation (cron vs on-access pruning)
- Date picker component choice for posted_date editing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database schema
- `prisma/schema.prisma` — ChargebackSubmission model with all field definitions, needs assigned_to field added
- `prisma/migrations/20260317_add_cs_tables/migration.sql` — Existing migration for reference

### Dashboard app
- `apps/cs-dashboard/app/page.tsx` — Current placeholder SubmissionsTab to replace with parser UI
- `apps/cs-dashboard/package.json` — Workspace dependencies

### API patterns
- `apps/ops-api/src/routes/index.ts` — Route patterns, asyncHandler, Zod validation
- `apps/ops-api/src/middleware/auth.ts` — requireAuth, requireRole for route protection

### Shared components
- `packages/ui/src/index.tsx` — PageShell, Card, EmptyState, Button, Input components
- `packages/ui/src/tokens.ts` — Design tokens (colors, spacing, radius)

### Existing dashboard patterns
- `apps/manager-dashboard/app/page.tsx` — Reference for data fetching, tab state, inline styles

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card` component from @ops/ui — use for ticker card and preview table container
- `Button`, `Input` from @ops/ui — use for roster management and submit actions
- `authFetch` from `@ops/auth/client` — use for all API calls (POST chargebacks, GET roster, GET weekly total)
- `EmptyState` from @ops/ui — use when no records parsed yet
- Existing inline CSSProperties pattern — follow for all new styles

### Established Patterns
- Data fetched via `authFetch` with `NEXT_PUBLIC_OPS_API_URL` base
- Tab state managed via `useState<Tab>` with type union
- All async handlers wrapped with `asyncHandler()` in routes
- Request validation via Zod schemas
- Zod errors wrapped via `zodErr()` helper

### Integration Points
- `apps/cs-dashboard/app/page.tsx` — Replace SubmissionsTab placeholder with parser + roster + ticker
- `apps/ops-api/src/routes/index.ts` — Add POST /api/chargebacks, GET /api/chargebacks/weekly-total, GET/POST/PATCH/DELETE /api/cs-rep-roster
- `prisma/schema.prisma` — Add assigned_to field to ChargebackSubmission, add CsRepRoster model
- New migration for schema changes

</code_context>

<specifics>
## Specific Ideas

- Raw text format example (2 rows for same member, consolidated to 1 record):
  ```
  22-Feb-26    ADVANCED COMM
  Product    807713    Horizon Health Solutions LLC - AOR Leah Fey - ADV2    50%    ($582.00)    $393.98    Payment 1,1 | Refund Reversal    Good Health Distribution Partner Wellness (44899)    Shatena Bates | 686501575 | SUM    Horizon Health Solutions LLC - AOR Leah Fey - ADV2 | 807713 | SUM
  2    22-Feb-26    ADVANCED COMM
  Product    807713    Horizon Health Solutions LLC - AOR Leah Fey - ADV2    80%    ($211.08)    $393.98    Payment 1,1 | Refund Reversal    Complete Care Select - Add-on (38530)    Shatena Bates | 686501575 | SUM    Horizon Health Solutions LLC - AOR Leah Fey - ADV2 | 807713 | SUM
  ```
- These 2 rows consolidate to 1 record: member_company="Shatena Bates", total=$787.96, chargeback=($793.08), products="Good Health Distribution Partner Wellness (44899), Complete Care Select - Add-on (38530)"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-chargeback-parser*
*Context gathered: 2026-03-17*
