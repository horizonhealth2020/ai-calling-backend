# Phase 32: Phone Number Data Pipeline - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Add lead phone numbers from Convoso call data to the call audit and agent sales views. New nullable `leadPhone` field on ConvosoCallLog and Sale models, captured from Convoso API response, exposed through call audits and sales API endpoints, and displayed in ManagerAudits and ManagerSales table components.

</domain>

<decisions>
## Implementation Decisions

### Phone Display Format
- **D-01:** Display phone numbers as formatted `(XXX) XXX-XXXX` pattern (matching the sample member record format `(818) 437-4820`). Raw digits stored in DB, formatted on display.

### Column Placement
- **D-02:** ManagerAudits table: Phone column goes immediately to the right of the Agent column (Date, Agent, **Phone**, Outcome, Score, Summary, Actions)
- **D-03:** ManagerSales table: Phone column goes immediately to the right of Lead Source column (Date, Member, Carrier, Product, Lead Source, **Phone**, Premium, Status, Edit, Delete)

### Phone Input on Sales Form
- **D-04:** Formatted phone input field on the sales edit form — not free text. Should accept digits and auto-format to `(XXX) XXX-XXXX` pattern. Optional field (nullable), consistent with other optional fields like `memberState`.

### Claude's Discretion
- Phone number formatting utility function placement (inline helper vs shared util)
- Convoso API field name for phone number (determine during research — likely `phone_number`, `caller_id`, or `member_phone` from the call log response)
- Phone column width and truncation behavior

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Convoso Integration
- `apps/ops-api/src/workers/convosoKpiPoller.ts` — Poller that fetches Convoso call logs; phone field must be captured here
- `apps/ops-api/src/services/convosoCallLogs.ts` — Convoso API service; check response format for phone fields

### Data Models
- `prisma/schema.prisma` — ConvosoCallLog (L473-495) and Sale (L189-232) models need leadPhone field

### API Routes
- `apps/ops-api/src/routes/sales.ts` — POST/PATCH Zod schemas need leadPhone; call audits endpoint needs to include it
- `apps/ops-api/src/routes/call-audits.ts` — Call audits API already includes convosoCallLog in response

### Dashboard Components
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` — Call audits table; add Phone column after Agent
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` — Sales table and edit form; add Phone column after Lead Source, add formatted input to edit form

### Reference Pattern
- `PendingTerm` model in schema.prisma (L635) — Already has a `phone` field, use as reference for field naming convention

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- PendingTerm model already has `phone` field — naming convention reference
- Convoso poller already maps API fields to DB columns — same pattern for phone
- ManagerSales edit form has optional field pattern (memberState) — same for phone input
- Inline CSSProperties styling pattern with constant objects (INP, CARD, etc.)

### Established Patterns
- Convoso API wraps results as `{ data: { results: [...] } }` — phone field is nested inside each result
- Convoso `call_date` is Pacific time — no impact on phone field but be aware when reading poller
- Zod schemas in sales.ts use `z.string().optional()` for nullable string fields
- Table columns use inline styles with fixed widths

### Integration Points
- Prisma migration adds `leadPhone` to both ConvosoCallLog and Sale
- convosoKpiPoller.ts maps Convoso response fields to ConvosoCallLog create data
- call-audits.ts GET includes `convosoCallLog` relation — add `leadPhone` to select
- sales.ts POST/PATCH Zod schemas — add `leadPhone: z.string().optional()`
- ManagerAudits.tsx table header/row arrays — insert Phone after Agent
- ManagerSales.tsx table header/row arrays + edit form — insert Phone column and input

</code_context>

<specifics>
## Specific Ideas

### Sample Member Record Format (from user)
The phone number format matches this real member record pattern:
```
Member
ID: 685389782
Carol T Allen
5138 Mount Royal Dr
Los Angeles CA 90041
(818) 437-4820
```

Phone displays as `(818) 437-4820` — parenthesized area code, space, exchange-subscriber with hyphen.

</specifics>

<deferred>
## Deferred Ideas

- **Today filter on Performance Tracker agent performance** — Add a "Today" option to the date range filter on the agent performance/tracker view. Belongs in a separate phase (UI enhancement, not data pipeline).

</deferred>

---

*Phase: 32-phone-number-data-pipeline*
*Context gathered: 2026-03-30*
