# Phase 13: Pending Terms Parser - Research

**Researched:** 2026-03-17
**Domain:** Client-side text parsing, Prisma schema migration, Express REST API
**Confidence:** HIGH

## Summary

Phase 13 implements a pending terms parser that closely mirrors the existing chargeback parser (Phase 12). The chargeback implementation in `apps/cs-dashboard/app/page.tsx` is the canonical reference -- same textarea-to-preview-table-to-submit pattern, same rep roster sidebar, same round-robin distribution. The key difference is the raw text format: pending terms uses a **3-line-per-record** tab-separated format (vs chargebacks' 2-line joining), with field consolidation by `memberId` and monthly amount summation.

The PendingTerm Prisma model already exists with all required fields except `assignedTo`. A single schema addition + migration is needed. The API endpoints (POST/GET/DELETE) follow the identical pattern as chargebacks. All parser logic is client-side pure functions for instant preview.

**Primary recommendation:** Clone the chargeback parser structure exactly, adapting only the parsing logic (3-line joining, agent info regex, date format M/D/YYYY) and preview table columns. Reuse the existing rep roster sidebar and round-robin assignment without modification.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each record spans 3 lines (tab-separated fields from spreadsheet) with specific field mapping per line
- Line 1: agent info, memberId, memberName, city, state, phone, email (ignore), product, enrollAmount (ignore), monthlyAmount, paid
- Line 2: active/inactive status, createdDate, firstBilling, activeDate, nextBilling, holdDate (DATE only)
- Line 3: holdReason (TEXT only), lastTransactionType
- Agent info parsing: `Company - Name (ID)` pattern extracts agentName and agentIdField
- Date formats: M/D/YYYY or MM/DD/YYYY
- Dollar amounts: `$0.00` format
- Consolidate by member_id: multiple product rows become 1 row, products comma-separated, monthlyAmount summed
- 1 consolidated DB record per member per batch
- Preview table columns: Member Name (editable), Member ID (read-only), Product (read-only), Monthly Amount (editable), Hold Date (editable), Assigned To (editable select)
- Same rep roster as chargebacks (reuse cs_rep_roster table and sidebar)
- Same round-robin distribution with session-scoped counter reset on paste
- Submit flow: authFetch POST, batch_id via crypto.randomUUID(), clear + toast after submit
- No weekly ticker for pending terms
- Auto-parse on paste

### Claude's Discretion
- Exact regex for parsing agent info from company string
- How to detect record boundaries (3-line grouping logic)
- Error handling for malformed fields
- Whether to add assigned_to via migration or schema-only

### Deferred Ideas (OUT OF SCOPE)
None

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TERM-01 | User can paste raw pending terms text and parser extracts all specified fields | 3-line joining parser with tab-split field extraction; clone chargeback `parseChargebackText` pattern |
| TERM-02 | Parser correctly separates hold_date (date only) and hold_reason (text only) as two distinct fields | holdDate from Line 2 field[5] as DATE, holdReason from Line 3 field[0] as TEXT; schema already has `@db.Date` on holdDate |
| TERM-03 | Parsed records shown as editable preview cards before submission | Clone chargeback preview table with adjusted columns (Member Name, Member ID, Product, Monthly Amount, Hold Date, Assigned To) |
| TERM-04 | Bulk paste detects multiple records by agent name pattern, all sharing a batch_id | 3-line boundary detection using agent company pattern regex; batch_id via crypto.randomUUID() |
| TERM-05 | Confirmed records saved to pending_terms with raw_paste, submitted_by, submitted_at | POST /api/pending-terms endpoint using prisma.pendingTerm.createMany with Zod validation |
| TERM-06 | Parser handles missing/malformed fields gracefully -- blank values stored as null, never crash | Wrap each field parse in try/catch or null-coalescing; same pattern as chargeback's nullable fields |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | UI rendering (Next.js 15 app) | Already in use across all dashboard apps |
| Prisma | existing | ORM for pendingTerm model | Already configured, model exists |
| Express | existing | REST API routes | Already in ops-api |
| Zod | existing | Request validation | Already used for chargeback schema |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui | workspace | PageShell, Card, Button, EmptyState, baseThStyle, baseTdStyle, baseInputStyle, baseCardStyle | All UI components |
| @ops/auth/client | workspace | authFetch, captureTokenFromUrl | API calls with Bearer token |
| lucide-react | existing | Icons (X for remove) | Already imported in cs-dashboard |
| crypto | built-in | randomUUID() for batch_id | Browser built-in |

### Alternatives Considered
None -- this phase clones an established pattern with no design decisions remaining.

## Architecture Patterns

### Recommended Project Structure
```
apps/cs-dashboard/app/page.tsx     # Add pending terms parser alongside chargeback parser
apps/ops-api/src/routes/index.ts   # Add pending-terms endpoints
prisma/schema.prisma               # Add assignedTo to PendingTerm
prisma/migrations/                 # New migration for assigned_to column
```

### Pattern 1: 3-Line Record Joining
**What:** Group every 3 consecutive non-empty lines into a single record. Detect record start by matching the agent company pattern (e.g., `Company LLC - Name (ID)`) optionally preceded by a bare integer row number.
**When to use:** Always -- this is the raw text format.
**Example:**
```typescript
// Record boundary detection
function isRecordStart(line: string): boolean {
  const fields = line.split("\t");
  const first = fields[0].trim();
  // Skip optional row number prefix
  const candidate = /^\d+$/.test(first) ? (fields[1] || "").trim() : first;
  // Match "Company - Agent Name (ID)" pattern
  return /^.+\s-\s.+\(\d+\)$/.test(candidate);
}

// Join lines into 3-line groups
function joinThreeLineRecords(lines: string[]): string[][] {
  const groups: string[][] = [];
  let i = 0;
  while (i < lines.length) {
    if (isRecordStart(lines[i])) {
      groups.push([lines[i], lines[i + 1] || "", lines[i + 2] || ""]);
      i += 3;
    } else {
      i++; // skip orphan lines
    }
  }
  return groups;
}
```

### Pattern 2: Agent Info Regex Extraction
**What:** Extract agent name and ID from compound string like `Horizon Health Solutions LLC - Emily Cutler (807718)`
**Example:**
```typescript
function parseAgentInfo(raw: string): { agentName: string | null; agentIdField: string | null } {
  const match = raw.match(/^.+\s-\s(.+?)\s*\((\d+)\)$/);
  if (!match) return { agentName: null, agentIdField: null };
  return { agentName: match[1].trim(), agentIdField: match[2] };
}
```

### Pattern 3: M/D/YYYY Date Parsing
**What:** Parse dates in M/D/YYYY or MM/DD/YYYY format to ISO date string (YYYY-MM-DD).
**Example:**
```typescript
function parseMDYDate(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const m = match[1].padStart(2, "0");
  const d = match[2].padStart(2, "0");
  return `${match[3]}-${m}-${d}`;
}
```

### Pattern 4: Consolidation by Member ID (Clone from Chargebacks)
**What:** Group parsed rows by memberId, merge products as comma-separated list, sum monthlyAmount.
**Example:**
```typescript
function consolidateByMember(rows: ParsedPendingRow[]): ConsolidatedPendingRecord[] {
  const groups = new Map<string, ParsedPendingRow[]>();
  for (const row of rows) {
    const key = row.memberId ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return Array.from(groups.entries()).map(([, memberRows]) => ({
    ...memberRows[0], // first row's values for non-aggregated fields
    product: memberRows.map(r => r.product).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", "),
    monthlyAmount: memberRows.reduce((s, r) => s + (r.monthlyAmount ?? 0), 0),
    assignedTo: "",
  }));
}
```

### Anti-Patterns to Avoid
- **Parsing dates as DateTime with time component:** holdDate must use DATE-only storage (`@db.Date` in Prisma). Send as `YYYY-MM-DD` string without time suffix. Prisma handles the conversion.
- **Mixing holdDate and holdReason:** These come from different lines (line 2 vs line 3). Never concatenate or confuse them.
- **Crashing on malformed input:** Every field parse must return null on failure, never throw. TERM-06 is a hard requirement.
- **Building a separate rep roster:** Reuse the existing cs_rep_roster table and sidebar component code. Both chargebacks and pending terms share the same roster.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rep roster CRUD | New roster table/UI | Existing cs_rep_roster + sidebar code | Already built in Phase 12, shared by design |
| Round-robin assignment | New distribution logic | Existing `assignRoundRobin` function | Same session-scoped counter pattern |
| Toast notifications | Custom notification system | Existing `ToastProvider` + `useToast` | Already wrapped in SubmissionsTab |
| Dollar formatting | Custom formatter | Existing `formatDollar` helper | Already in page.tsx |
| UUID generation | Custom ID scheme | `crypto.randomUUID()` | Browser built-in, same as chargebacks |

**Key insight:** Phase 13 is ~80% clone of Phase 12. The only truly new code is the 3-line parser and the adjusted preview table columns.

## Common Pitfalls

### Pitfall 1: Off-by-one in 3-Line Grouping
**What goes wrong:** If empty lines or extra whitespace lines exist between records, the 3-line grouping shifts and misaligns fields.
**Why it happens:** Raw paste from spreadsheet may include blank lines between rows.
**How to avoid:** Filter out empty lines BEFORE grouping. Use `lines.filter(l => l.trim().length > 0)` first (same as chargeback parser).
**Warning signs:** Fields appearing in wrong columns in preview table.

### Pitfall 2: Row Number Prefix Confusion
**What goes wrong:** A bare integer at the start of line 1 is misinterpreted as data rather than a row number.
**Why it happens:** Some spreadsheet exports prepend row numbers.
**How to avoid:** Check if first tab-field is a bare integer AND second field matches the agent company pattern. If so, skip the first field. Same heuristic as chargebacks.

### Pitfall 3: DateTime vs Date-Only for holdDate
**What goes wrong:** Sending holdDate as a full ISO datetime string (e.g., `2026-03-17T00:00:00.000Z`) may cause timezone-shift issues where the date appears as the previous day.
**Why it happens:** JavaScript Date constructor applies timezone offsets.
**How to avoid:** Send holdDate as a plain `YYYY-MM-DD` string. On the API side, store directly into the `@db.Date` column. For the Prisma createMany, use `new Date(holdDate + "T00:00:00")` or pass the string directly (Prisma accepts date strings for Date fields).
**Warning signs:** Dates showing as one day off in the database or UI.

### Pitfall 4: Decimal Precision for monthlyAmount
**What goes wrong:** JavaScript floating point math causes values like `$139.98` to become `139.97999999999999`.
**Why it happens:** IEEE 754 floating point.
**How to avoid:** Parse dollar amounts as strings, use `parseFloat` only for display/summation, and send as numbers to the API. Prisma's `Decimal(12,2)` handles storage correctly. For summation during consolidation, round to 2 decimal places: `Math.round(sum * 100) / 100`.

### Pitfall 5: Missing assignedTo Column
**What goes wrong:** POST endpoint tries to write `assignedTo` but the column does not exist.
**Why it happens:** PendingTerm model currently lacks `assignedTo` field.
**How to avoid:** Add `assignedTo String? @map("assigned_to")` to PendingTerm model and create a migration BEFORE implementing the API endpoint.

## Code Examples

### Existing Chargeback POST Endpoint (Clone Pattern)
```typescript
// Source: apps/ops-api/src/routes/index.ts lines 1909-1958
const chargebackSchema = z.object({
  records: z.array(z.object({
    postedDate: z.string().nullable(),
    // ... fields ...
    assignedTo: z.string().nullable(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
});

router.post("/chargebacks", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = chargebackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { records, rawPaste, batchId } = parsed.data;
  const result = await prisma.chargebackSubmission.createMany({
    data: records.map((r) => ({
      // ... map fields ...
      submittedBy: req.user!.id,
      batchId,
      rawPaste,
    })),
  });
  return res.status(201).json({ count: result.count, batchId });
}));
```

### Pending Terms Zod Schema (New)
```typescript
const pendingTermSchema = z.object({
  records: z.array(z.object({
    agentName: z.string().nullable(),
    agentIdField: z.string().nullable(),
    memberId: z.string().nullable(),
    memberName: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    phone: z.string().nullable(),
    product: z.string().nullable(),
    monthlyAmount: z.number().nullable(),
    paid: z.string().nullable(),
    createdDate: z.string().nullable(),
    firstBilling: z.string().nullable(),
    activeDate: z.string().nullable(),
    nextBilling: z.string().nullable(),
    holdDate: z.string().nullable(),
    holdReason: z.string().nullable(),
    inactive: z.boolean().nullable(),
    lastTransactionType: z.string().nullable(),
    assignedTo: z.string().nullable(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
});
```

### Existing Placeholder to Replace
```typescript
// Source: apps/cs-dashboard/app/page.tsx lines 731-737
// This EmptyState placeholder gets replaced with actual parser UI:
<Card>
  <h3 style={SECTION_HEADING}>Pending Terms Submissions</h3>
  <EmptyState
    title="Paste Pending Terms Data"
    description="Paste raw pending terms text here to parse and submit records. This feature is coming in the next update."
  />
</Card>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A (new feature) | Client-side parsing with server-side persistence | Phase 12 established pattern | Parser logic is pure functions, no API round-trip for preview |

## Schema Change Required

The PendingTerm model needs `assignedTo` added:

```prisma
model PendingTerm {
  // ... existing fields ...
  assignedTo          String?   @map("assigned_to")  // NEW: add this field
  // ... rest of model ...
}
```

Migration SQL:
```sql
ALTER TABLE "pending_terms" ADD COLUMN "assigned_to" TEXT;
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service only) |
| Config file | jest.config.js (root) |
| Quick run command | `npm test -- helpers.test.js` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TERM-01 | Parser extracts all fields from 3-line format | unit | Manual verification via paste | No -- parser is client-side |
| TERM-02 | holdDate stored as DATE, holdReason as TEXT | manual-only | Check DB column types | N/A -- schema verified in Prisma |
| TERM-03 | Preview table shows editable records | manual-only | Visual verification | N/A -- UI component |
| TERM-04 | Bulk paste detects multiple records with batch_id | manual-only | Paste multi-record text | N/A -- client-side logic |
| TERM-05 | Records persist with raw_paste, submitted_by, submitted_at | manual-only | Submit and query DB | N/A -- API endpoint |
| TERM-06 | Malformed fields store as null, never crash | manual-only | Paste malformed data | N/A -- client-side error handling |

### Sampling Rate
- **Per task commit:** Manual paste test with sample data from CONTEXT.md
- **Per wave merge:** Full paste-to-submit workflow test
- **Phase gate:** Verify all 6 TERM requirements via manual test with real sample data

### Wave 0 Gaps
- No automated test infrastructure exists for cs-dashboard (frontend app)
- Jest tests only cover root Morgan service, not ops-api or dashboard apps
- All validation is manual verification for this phase

## Open Questions

1. **Date field storage for non-holdDate dates (createdDate, firstBilling, activeDate, nextBilling)**
   - What we know: These are `DateTime?` in Prisma (not `@db.Date`), parsed from M/D/YYYY strings
   - What's unclear: Whether these should also be DATE-only or full DateTime
   - Recommendation: Store as full DateTime with midnight UTC time component (consistent with existing DateTime fields). Only holdDate needs DATE-only per TERM-02.

## Sources

### Primary (HIGH confidence)
- `apps/cs-dashboard/app/page.tsx` -- Complete chargeback parser implementation (reference pattern)
- `prisma/schema.prisma` -- PendingTerm model definition (lines 514-547)
- `apps/ops-api/src/routes/index.ts` -- Chargeback API endpoints (lines 1907-1990)
- `13-CONTEXT.md` -- User decisions with field mapping, sample data, consolidation rules

### Secondary (MEDIUM confidence)
- None needed -- all patterns are internal codebase patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - clone of proven chargeback pattern with clear field mapping from CONTEXT.md
- Pitfalls: HIGH - identified from direct code inspection of existing implementation

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable internal patterns, no external dependency changes)
