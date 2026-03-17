# Phase 13: Pending Terms Parser - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can paste raw pending terms text (3-line-per-record format from spreadsheet) into the Submissions tab, see parsed records consolidated by member in an editable preview table, and submit confirmed records to the database. Uses the same rep roster + round-robin distribution as chargebacks.

</domain>

<decisions>
## Implementation Decisions

### Raw text format & parsing
- Each record spans **3 lines** (tab-separated fields from spreadsheet):
  - **Line 1:** `[row#?] [AgentCompany - AgentName (AgentID)] [MemberID] [MemberName] [City] [State] [Phone] [Email] [Product] [EnrollAmt] [MonthlyAmt] [Paid]`
  - **Line 2:** `[Active/Inactive] [CreatedDate] [FirstBilling] [ActiveDate] [NextBilling] [HoldDate]`
  - **Line 3:** `[HoldReason] [empty] [LastTransactionType] [empty] [empty] [View]`
- Rows may start with an optional row number (bare integer) — skip it
- **Agent info parsing:** `Horizon Health Solutions LLC - Emily Cutler (807718)` → agentName="Emily Cutler", agentIdField="807718"
- **Date formats:** `3/16/2026` or `03/17/2026` (M/D/YYYY or MM/DD/YYYY)
- **Dollar amounts:** `$0.00`, `$139.98` format
- **Ignore fields:** email (just says "Email"), smoker (not in paste data), "View" link text
- Auto-parse on paste — same as chargebacks, records appear instantly
- **3-line joining:** detect that 3 consecutive lines form one record. A line starting with agent company info (or a row number followed by it) is a record start. The next 2 lines are continuation data.
- Handle missing/malformed fields gracefully — store as null, never crash (TERM-06)

### Field mapping from raw text
- Line 1 fields (after optional row number skip):
  - fields[0]: agent info string → parse agentName + agentIdField from pattern `Company - Name (ID)`
  - fields[1]: memberId
  - fields[2]: memberName
  - fields[3]: city
  - fields[4]: state
  - fields[5]: phone
  - fields[6]: email → **IGNORE**
  - fields[7]: product
  - fields[8]: enrollAmount → **IGNORE** (user doesn't need)
  - fields[9]: monthlyAmount → parse dollar amount
  - fields[10]: paid
- Line 2 fields:
  - fields[0]: active/inactive status → store in `inactive` boolean (Active=false, Inactive=true)
  - fields[1]: createdDate
  - fields[2]: firstBilling
  - fields[3]: activeDate
  - fields[4]: nextBilling
  - fields[5]: holdDate → stored as DATE only (TERM-02)
- Line 3 fields:
  - fields[0]: holdReason → stored as TEXT only (TERM-02)
  - fields[2]: lastTransactionType (e.g., "Sale")

### Consolidation rules
- **Consolidate by member_id** — multiple product rows for same member become 1 row
- Append products as comma-separated list (same as chargebacks)
- **Sum monthlyAmount** across products for the member total
- Use first row's values for all other fields (dates, city, state, phone, hold info)
- **1 consolidated DB record per member per batch**

### Preview table columns
- **Member Name** (editable)
- **Member ID** (read-only)
- **Product** (read-only — consolidated, comma-separated)
- **Monthly Amount** (editable — summed across products)
- **Hold Date** (editable — date input)
- **Assigned To** (editable — select from active reps)
- All columns editable except Product and Member ID

### Rep roster & distribution
- **Same rep roster** as chargebacks — reuse existing cs_rep_roster table and sidebar
- Same round-robin distribution with persistent counter
- `assigned_to` field needed on pending_terms table (schema change)
- No weekly ticker for pending terms

### Submit flow
- Same pattern as chargebacks: authFetch POST, batch_id via crypto.randomUUID()
- Clear textarea + success toast with record count after submit
- Stores raw_paste, submitted_by, submitted_at per TERM-05

### Claude's Discretion
- Exact regex for parsing agent info from company string
- How to detect record boundaries (3-line grouping logic)
- Error handling for malformed fields
- Whether to add assigned_to via migration or schema-only

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database schema
- `prisma/schema.prisma` — PendingTerm model with all field definitions, needs assigned_to field added
- `prisma/migrations/` — Existing migrations for reference

### Existing parser implementation (CLONE PATTERN)
- `apps/cs-dashboard/app/page.tsx` — Chargeback parser with consolidation, preview table, rep roster sidebar, round-robin. **This is the reference implementation to follow for pending terms.**

### API patterns
- `apps/ops-api/src/routes/index.ts` — Existing chargeback POST/GET/DELETE endpoints to mirror for pending terms

### Shared components
- `packages/ui/src/index.tsx` — PageShell, Card, EmptyState, Button, Input components
- `packages/ui/src/tokens.ts` — Design tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Chargeback parser functions (`parseChargebackText`, `consolidateByMember`, `assignRoundRobin`) — adapt pattern for pending terms
- Rep roster sidebar + CRUD handlers — already built, reuse directly
- `formatDollar` helper — reuse for monthly amounts
- `COMPACT_INPUT`, `TABLE_WRAP`, `SECTION_HEADING` style constants — reuse
- `ToastProvider` + `useToast` — already wrapped in SubmissionsTab

### Established Patterns
- 3-line record joining (similar to chargeback's 2-line joining but extended)
- Row number skip heuristic
- Field count detection for line grouping
- Editable preview table with inline inputs/selects
- authFetch POST with batch_id, rawPaste, records array

### Integration Points
- `apps/cs-dashboard/app/page.tsx` — Replace Pending Terms placeholder EmptyState in SubmissionsTab
- `apps/ops-api/src/routes/index.ts` — Add POST /api/pending-terms, GET /api/pending-terms, DELETE /api/pending-terms/:id
- `prisma/schema.prisma` — Add assignedTo field to PendingTerm model
- New migration for assigned_to field

</code_context>

<specifics>
## Specific Ideas

- Raw text format example (3 lines per record, 7 rows = 3 members):
  ```
  Horizon Health Solutions LLC - Emily Cutler (807718)	686810081	Ashton Young	Ontario	CA	(840) 699-7837	Email	Compass Care Navigator+ - Add-on	$0.00	$0.00	1
  Active	3/16/2026	3/16/2026	3/17/2026	4/14/2026	03/17/2026
  Pending Agent Approval for Refund of Product and EF (first 30 days only)		Sale			View
  ```
- Agent info parsed from: `Horizon Health Solutions LLC - Emily Cutler (807718)` → agentName="Emily Cutler", agentIdField="807718"
- Consolidation example: Ashton Young has 2 products → 1 row with "Compass Care Navigator+ - Add-on, Complete Care Max", monthly=$139.98

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-pending-terms-parser*
*Context gathered: 2026-03-17*
