# Phase 32: Phone Number Data Pipeline - Research

**Researched:** 2026-03-30
**Domain:** Full-stack data pipeline (Prisma migration, Express API, React dashboard)
**Confidence:** HIGH

## Summary

This phase adds a nullable `leadPhone` field to two existing models (ConvosoCallLog and Sale), captures phone numbers from the Convoso API during polling, exposes them through existing API endpoints, and displays them in two dashboard tables with a formatted phone input on the sales edit form.

The implementation is straightforward because every integration point already exists -- the Convoso poller already maps API fields to DB columns, the call audits and sales APIs already return the relevant models, and the dashboard tables already render column arrays. The phone number field from Convoso is confirmed as `phone_number` (found in `apps/ops-api/src/routes/call-logs.ts` line 19 as a known pass-through parameter).

**Primary recommendation:** Add `leadPhone String?` to both Prisma models in a single migration, capture `phone_number` from the Convoso raw response in the poller, add the field to API schemas/responses, and insert a Phone column into both dashboard tables. Use a shared `formatPhone()` utility for display formatting.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Display phone numbers as formatted `(XXX) XXX-XXXX` pattern. Raw digits stored in DB, formatted on display.
- **D-02:** ManagerAudits table: Phone column goes immediately to the right of the Agent column (Date, Agent, **Phone**, Outcome, Score, Summary, Actions)
- **D-03:** ManagerSales table: Phone column goes immediately to the right of Lead Source column (Date, Member, Carrier, Product, Lead Source, **Phone**, Premium, Status, Edit, Delete)
- **D-04:** Formatted phone input field on the sales edit form -- not free text. Should accept digits and auto-format to `(XXX) XXX-XXXX` pattern. Optional field (nullable), consistent with other optional fields like `memberState`.

### Claude's Discretion
- Phone number formatting utility function placement (inline helper vs shared util)
- Convoso API field name for phone number (RESOLVED: `phone_number` -- confirmed in call-logs.ts)
- Phone column width and truncation behavior

### Deferred Ideas (OUT OF SCOPE)
- **Today filter on Performance Tracker agent performance** -- Add a "Today" option to the date range filter on the agent performance/tracker view. Belongs in a separate phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PHONE-01 | ConvosoCallLog model has nullable `leadPhone` field with Prisma migration | Prisma schema at L473-495 shows exact insertion point; PendingTerm model `phone` field confirms naming convention |
| PHONE-02 | Sale model has nullable `leadPhone` field (same migration) | Sale model at L189-232 shows insertion point after `memberState`; same migration file |
| PHONE-03 | Convoso poller captures `phone_number` from API response into `leadPhone` | Poller at `convosoKpiPoller.ts` L99-127 shows field mapping pattern; `phone_number` confirmed as Convoso field name |
| PHONE-04 | Call audits API includes `convosoCallLog.leadPhone` in list response | Call audits list endpoint (L41-46) currently does NOT include convosoCallLog relation -- must add `include` with `select: { leadPhone: true }` |
| PHONE-05 | ManagerAudits table displays Phone column from call log data | Table headers at L234 are a string array; insert "Phone" after "Agent" at index 2 |
| PHONE-06 | Sales API Zod schema accepts optional `leadPhone` on POST/PATCH | POST schema (L14-31) and PATCH schema (L265-282) need `leadPhone: z.string().optional()` |
| PHONE-07 | ManagerSales table displays Phone column from sale data | Table headers at ManagerSales.tsx L408 are a string array; insert "Phone" after "Lead Source" |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (existing) | Database schema + migration | Already manages all models; `leadPhone String?` follows established nullable field pattern |
| Zod | (existing) | API request validation | Already validates all sales routes; `z.string().optional()` is the nullable string pattern |
| Express | (existing) | API routing | All endpoints already exist; just adding fields to existing queries |
| React | (existing) | Dashboard components | Inline CSSProperties pattern; no new dependencies needed |

### Supporting
No new libraries needed. Everything uses existing project infrastructure.

## Architecture Patterns

### Pattern 1: Prisma Nullable Field Addition
**What:** Add `leadPhone String? @map("lead_phone")` to both ConvosoCallLog and Sale models
**When to use:** Adding optional data to existing models
**Example:**
```prisma
// In ConvosoCallLog model (after leadSourceId field)
leadPhone           String?  @map("lead_phone")

// In Sale model (after memberState field)
leadPhone           String?  @map("lead_phone")
```
**Source:** Existing pattern from `memberState String? @map("member_state")` in Sale model and `phone String?` in PendingTerm model.

### Pattern 2: Convoso Field Extraction in Poller
**What:** Extract `phone_number` from raw Convoso response and map to `leadPhone`
**When to use:** Adding new fields from Convoso API data
**Example:**
```typescript
// In convosoKpiPoller.ts, inside callLogRecords map (around L100-127)
return {
  agentUser: userId,
  listId: leadSource.listId!,
  // ... existing fields ...
  leadPhone: (() => {
    const ph = r.phone_number ?? r.caller_id;
    return ph ? String(ph) : null;
  })(),
  // ... rest of existing fields ...
};
```
**Source:** Same pattern as `recordingUrl` extraction at L106-114 of convosoKpiPoller.ts.

### Pattern 3: Call Audits API Include Pattern
**What:** The call audits LIST endpoint currently does NOT include the convosoCallLog relation. Must add it.
**Critical finding:** Looking at `call-audits.ts` L41-46:
```typescript
// CURRENT (no convosoCallLog in list endpoint)
const audits = await prisma.callAudit.findMany({
  where,
  include: { agent: { select: { id: true, name: true } } },
  orderBy: { callDate: "desc" },
});

// NEEDS TO BECOME:
const audits = await prisma.callAudit.findMany({
  where,
  include: {
    agent: { select: { id: true, name: true } },
    convosoCallLog: { select: { leadPhone: true } },
  },
  orderBy: { callDate: "desc" },
});
```
The GET by ID endpoint (L52-61) already includes convosoCallLog but needs `leadPhone` added to its select.

### Pattern 4: Dashboard Table Column Insertion
**What:** Insert a column into existing table header and body arrays
**Example for ManagerAudits (L233-234):**
```typescript
// CURRENT:
{["Date", "Agent", "Outcome", "Score", "Summary", "Actions"].map(...)}
// BECOMES:
{["Date", "Agent", "Phone", "Outcome", "Score", "Summary", "Actions"].map(...)}
```
The expanded detail row uses `colSpan={6}` which must become `colSpan={7}`.

### Pattern 5: Phone Formatting Utility
**What:** Format raw digits to `(XXX) XXX-XXXX`
**Recommendation (Claude's Discretion):** Place as an inline helper function at the top of each component that uses it. Both ManagerAudits and ManagerSales need it, but since there is no existing shared utils for display formatting in the dashboard (formatDate and formatDollar come from `@ops/utils`), a cleaner approach is to add `formatPhone` to `@ops/utils`.
```typescript
// In packages/utils (or inline helper)
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw; // Return as-is if not a standard US number
}
```

### Pattern 6: Formatted Phone Input (Sales Edit Form)
**What:** Auto-formatting input that strips non-digits and formats as user types
**Example:**
```typescript
<input
  className="input-focus"
  style={{ ...baseInputStyle, width: 160 }}
  placeholder="(555) 123-4567"
  value={editForm.leadPhone ?? ""}
  onChange={e => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    const formatted = formatPhone(digits);
    setEditForm((f: Record<string, any>) => ({ ...f, leadPhone: digits }));
    // Store raw digits, display formatted
  }}
/>
```
**Source:** Pattern follows `memberState` input at ManagerSales.tsx L576, with added formatting logic.

### Anti-Patterns to Avoid
- **Storing formatted phone numbers in DB:** Store raw digits only. Format on display.
- **Adding phone to CallAudit model directly:** Phone comes from ConvosoCallLog via the existing relation. Do not duplicate data.
- **Forgetting colSpan updates:** Both ManagerAudits and ManagerSales have expanded detail rows with `colSpan` that must increase by 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone formatting | Complex regex formatter | Simple `formatPhone()` helper | US-only format, 10-digit assumption is safe for this use case |
| Input masking | Full input-mask library | Simple onChange handler with digit stripping | Only one phone input in the entire app; a library is overkill |

## Common Pitfalls

### Pitfall 1: Call Audits List Missing ConvosoCallLog
**What goes wrong:** The `/api/call-audits` GET endpoint does NOT include the convosoCallLog relation currently. Adding a Phone column to ManagerAudits without updating the API will show empty cells for ALL audits.
**Why it happens:** The list endpoint only includes `agent` relation; convosoCallLog is only included in the single-item GET endpoint.
**How to avoid:** Add `convosoCallLog: { select: { leadPhone: true } }` to the `include` in the list endpoint.
**Warning signs:** Phone column shows empty for all audits even though data exists.

### Pitfall 2: Convoso Phone Field Fallback
**What goes wrong:** Convoso might return phone data under different field names depending on call type.
**Why it happens:** The API has multiple fields: `phone_number`, `caller_id`, `number_dialed`.
**How to avoid:** Use `r.phone_number ?? r.caller_id ?? null` as fallback chain.
**Warning signs:** Some call logs have phone data while others from different lead sources don't.

### Pitfall 3: ColSpan Mismatch After Adding Column
**What goes wrong:** Expanded detail rows (edit form, audit details) render with wrong width.
**Why it happens:** Hard-coded `colSpan` values don't account for new column.
**How to avoid:** Search for all `colSpan` values in both ManagerAudits and ManagerSales and increment by 1.
**Warning signs:** Expanded rows don't stretch full width of table.

### Pitfall 4: Sales GET Response Already Includes All Fields
**What goes wrong:** Thinking you need to modify the sales API to include leadPhone.
**Why it happens:** The GET /sales endpoint uses `include: { agent: true, ... }` which returns ALL Sale fields by default. Adding `leadPhone` to the Prisma model is sufficient -- it will automatically be included in responses.
**How to avoid:** Verify that GET /sales uses model-level include (it does at L216-225). Only the Zod schema for POST/PATCH needs updating.

### Pitfall 5: Edit Form Not Loading leadPhone
**What goes wrong:** When editing a sale, the phone field is empty even though the sale has a leadPhone value.
**Why it happens:** The `startEdit()` function manually builds `original` from the sale response (L169-185). Must add `leadPhone` to this mapping.
**How to avoid:** Add `leadPhone: sale.leadPhone || ""` to the original object in `startEdit()`.

## Code Examples

### Migration File
```prisma
-- AlterTable
ALTER TABLE "convoso_call_logs" ADD COLUMN "lead_phone" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "lead_phone" TEXT;
```

### Poller Field Capture (convosoKpiPoller.ts)
```typescript
// Inside callLogRecords map, add to return object:
leadPhone: (() => {
  const ph = r.phone_number ?? r.caller_id;
  return ph ? String(ph) : null;
})(),
```

### Call Audits API Update (call-audits.ts)
```typescript
// Line 41-46: Add convosoCallLog to include
const audits = await prisma.callAudit.findMany({
  where,
  include: {
    agent: { select: { id: true, name: true } },
    convosoCallLog: { select: { leadPhone: true } },
  },
  orderBy: { callDate: "desc" },
});
```

### ManagerAudits Phone Cell
```typescript
// After Agent cell, before Outcome cell:
<td style={baseTdStyle}>
  {a.convosoCallLog?.leadPhone
    ? formatPhone(a.convosoCallLog.leadPhone)
    : <span style={{ color: colors.textMuted }}>&mdash;</span>}
</td>
```

### ManagerSales Phone Cell
```typescript
// After Lead Source cell, before Premium cell:
<td style={baseTdStyle}>
  {s.leadPhone
    ? formatPhone(s.leadPhone)
    : <span style={{ color: colors.textMuted }}>&mdash;</span>}
</td>
```

### Phone Column Width Recommendation (Claude's Discretion)
Phone numbers in `(XXX) XXX-XXXX` format are exactly 14 characters. A column width of ~130px is sufficient. No truncation needed -- the format is fixed-width.

## State of the Art

No technology changes relevant to this phase. All patterns follow established project conventions.

## Open Questions

1. **Convoso phone_number field presence**
   - What we know: `phone_number` is a documented Convoso API field used in `call-logs.ts` pass-through params
   - What's unclear: Whether every call log response actually includes this field, or only certain call types
   - Recommendation: Use `r.phone_number ?? r.caller_id ?? null` fallback chain; null is safe since the field is nullable

2. **Phone number length variations**
   - What we know: User sample shows US format `(818) 437-4820` (10 digits)
   - What's unclear: Whether Convoso ever returns 11-digit (with country code) or international numbers
   - Recommendation: Handle 10-digit and 11-digit (strip leading 1) in `formatPhone()`; return raw string for anything else

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing, for Morgan service + ops-api services) |
| Config file | `apps/ops-api/jest.config.ts` and `apps/morgan/jest.config.js` |
| Quick run command | `npm run test:ops` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHONE-01 | ConvosoCallLog has leadPhone field | migration | `npm run db:migrate` (verify migration applies) | N/A - migration file |
| PHONE-02 | Sale has leadPhone field | migration | `npm run db:migrate` (verify migration applies) | N/A - migration file |
| PHONE-03 | Poller captures phone_number | manual | Verify via Convoso poll cycle logs | N/A - manual verification |
| PHONE-04 | Call audits API returns leadPhone | manual | `curl` against running API | N/A - manual |
| PHONE-05 | ManagerAudits shows Phone column | manual | Visual inspection | N/A - manual |
| PHONE-06 | Sales API accepts leadPhone | manual | `curl` POST/PATCH with leadPhone field | N/A - manual |
| PHONE-07 | ManagerSales shows Phone column | manual | Visual inspection | N/A - manual |

### Sampling Rate
- **Per task commit:** `npm run test:ops` (existing ops-api tests should not regress)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual verification of phone display in both tables

### Wave 0 Gaps
None -- this phase involves adding fields to existing infrastructure. No new test files needed. Existing tests in `apps/ops-api/src/services/__tests__/` cover payroll/status-change logic and should not be affected. Manual verification against a running instance is the primary validation method for UI changes.

## Sources

### Primary (HIGH confidence)
- `apps/ops-api/src/routes/call-logs.ts` L18-19 -- Confirms `phone_number` as Convoso API field name
- `apps/ops-api/src/workers/convosoKpiPoller.ts` -- Confirmed field mapping pattern for ConvosoCallLog
- `apps/ops-api/src/routes/call-audits.ts` L41-46 -- Confirmed list endpoint does NOT include convosoCallLog
- `prisma/schema.prisma` L473-495, L189-232 -- Current model definitions
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` L234 -- Current table column structure
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` L408 -- Current table column structure

### Secondary (MEDIUM confidence)
- Convoso API `phone_number` field behavior -- confirmed as pass-through param in existing code, but response presence per call type not verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; all changes follow existing patterns
- Architecture: HIGH - Every integration point has been read and confirmed
- Pitfalls: HIGH - Identified from actual code review (especially the missing convosoCallLog include)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- no external dependency changes expected)
