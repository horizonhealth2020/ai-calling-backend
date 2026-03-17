# Phase 12: Chargeback Parser - Research

**Researched:** 2026-03-17
**Domain:** Tab-separated text parsing, form UI, Express REST API, Prisma mutations
**Confidence:** HIGH

## Summary

Phase 12 builds a paste-to-parse-to-submit workflow for chargeback data. Users paste tab-separated spreadsheet rows into a textarea, the client parses them instantly, consolidates rows by member, and displays an editable preview table. On submit, consolidated records are sent to a new API endpoint that persists them to the existing `chargeback_submissions` table (with a new `assigned_to` field) and a new `cs_rep_roster` table for round-robin distribution. A weekly total ticker card displays the running sum of submitted chargebacks.

The existing codebase provides all infrastructure needed: the `ChargebackSubmission` Prisma model exists (needs `assigned_to` added), the `cs-dashboard` app has a placeholder `SubmissionsTab` ready to replace, and `@ops/ui` provides `Card`, `Button`, `Input`, `Select`, `StatCard`, `ToastProvider`/`useToast`, `EmptyState`, and design tokens. The API follows established patterns with `asyncHandler`, Zod validation, and `zodErr`.

**Primary recommendation:** Implement all parsing logic client-side (pure function, no API call for parsing), send consolidated records to a single `POST /api/chargebacks` endpoint, and use a separate CRUD set for the rep roster.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Raw input is tab-separated text copied from a spreadsheet (Excel/Google Sheets)
- Auto-parse on paste -- no "Parse" button needed, records appear instantly
- Field mapping from raw text uses specific tab-separated positions (posted_date, type, payee_id, payee_name, payout_percent, chargeback_amount, total_amount, transaction_description, product, member_company, member_id, member_agent_company, member_agent_id)
- Key columns (user priority): posted_date, total_amount, member_company, product
- Consolidate rows by member before preview -- multiple rows for same member become 1 row
- Sum both chargeback_amount and total_amount across rows for the same member
- Append products as comma-separated list
- 1 consolidated DB record per member per batch (not separate rows per product)
- Preview table columns: Posted Date, Type, Member Company, Products (consolidated), Chargeback Amount (summed), Total (summed), Assigned To (from rep roster)
- raw_paste stores the original pasted text for the entire batch
- After successful submission: clear textarea + show success toast with record count
- Rep roster: collapsible sidebar panel, persistent in database (new cs_rep_roster table), name + active/inactive toggle, round-robin distribution to active reps
- assigned_to field added to chargeback_submissions (stores rep name)
- Weekly total ticker: Sunday-Saturday, large red dollar total + record count + week date range, above the preview table
- Fetched from API: sums chargeback_amount for records with submitted_at in current Sun-Sat window

### Claude's Discretion
- Exact parser regex/logic for splitting tab-separated fields
- How to handle malformed or partial rows during parsing
- Collapsible sidebar implementation (CSS transition approach)
- Round-robin tracking mechanism (last-assigned index)
- 30-day cleanup implementation (cron vs on-access pruning)
- Date picker component choice for posted_date editing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHBK-01 | User can paste raw chargeback text and parser extracts all specified fields | Client-side tab-split parser with regex for amounts and dates; field mapping documented in CONTEXT.md |
| CHBK-02 | Parser extracts chargeback_amount from parenthesized dollar pattern as negative decimal | Regex `\(\$[\d,]+\.\d{2}\)` strips parens/dollar/commas, negates; store as Decimal(12,2) |
| CHBK-03 | Parsed records shown as editable preview cards before submission | Editable table rows using existing inline-style patterns; all fields editable via inputs |
| CHBK-04 | User can manually set posted_date via date picker and override type field | Native HTML `<input type="date">` styled with baseInputStyle; type as text input or Select |
| CHBK-05 | Bulk paste detects and parses multiple records, all sharing a batch_id | Split on newlines, parse each row, consolidate by member_id, generate batch_id client-side (cuid or uuid) |
| CHBK-06 | Confirmed records saved to chargeback_submissions with raw_paste, submitted_by, submitted_at | POST /api/chargebacks with Zod validation; Prisma createMany; submitted_by from req.user.id |

</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.3.9 | cs-dashboard app framework | Already configured in workspace |
| React | 18.3.1 | UI components | Already configured |
| Express | (ops-api) | REST API routes | Already configured |
| Prisma | (workspace) | Database ORM | Already configured with ChargebackSubmission model |
| Zod | (ops-api) | Request validation | Already used for all API routes |
| lucide-react | 0.577.0 | Icons | Already in cs-dashboard deps |
| @ops/ui | workspace | Card, Button, Input, Select, StatCard, Toast, EmptyState | All components needed exist |
| @ops/auth | workspace | authFetch, captureTokenFromUrl | Already wired in cs-dashboard |

### Supporting (No New Dependencies Needed)
| Library | Purpose | Notes |
|---------|---------|-------|
| Native `<input type="date">` | Date picker for posted_date | No external date picker library needed; dark theme will need minimal styling |
| `crypto.randomUUID()` | batch_id generation | Available in all modern browsers and Node.js 19+; alternatively use `cuid()` already in Prisma |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native date input | react-datepicker | Adds dependency; native is sufficient for simple date selection |
| Client-side parsing | Server-side parsing endpoint | Unnecessary network round-trip; parsing is deterministic string manipulation |
| Custom UUID | Prisma cuid() default | batch_id must be generated client-side before submit to group records; use `crypto.randomUUID()` |

## Architecture Patterns

### Component Structure (within cs-dashboard/app/page.tsx)
```
SubmissionsTab (replaces placeholder)
  ChargebackSection
    WeeklyTicker (StatCard-like, fetches GET /api/chargebacks/weekly-total)
    PasteArea (textarea with onPaste handler)
    PreviewTable (editable consolidated rows)
    SubmitBar (submit button + record count)
  RepRosterSidebar (collapsible panel)
    RosterList (active/inactive toggles)
    AddRepForm (input + button)
```

### Pattern 1: Client-Side Tab Parser
**What:** Pure function that takes raw text, splits by newline, splits each line by tab, maps positions to fields, consolidates by member_id.
**When to use:** On every paste event into the textarea.
**Example:**
```typescript
// Field positions from the raw tab-separated data
interface ParsedRow {
  postedDate: string | null;
  type: string | null;
  payeeId: string | null;
  payeeName: string | null;
  payoutPercent: number | null;
  chargebackAmount: number | null;  // negative
  totalAmount: number | null;
  transactionDescription: string | null;
  product: string | null;
  memberCompany: string | null;
  memberId: string | null;
  memberAgentCompany: string | null;
  memberAgentId: string | null;
}

function parseChargebackAmount(raw: string): number | null {
  // Match ($582.00) pattern -> -582.00
  const match = raw.match(/\(\$([\d,]+\.\d{2})\)/);
  if (!match) return null;
  return -parseFloat(match[1].replace(/,/g, ""));
}

function parseDollarAmount(raw: string): number | null {
  // Match $393.98 pattern -> 393.98
  const match = raw.match(/\$?([\d,]+\.\d{2})/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ""));
}

function parsePercent(raw: string): number | null {
  // Match 50% -> 50
  const match = raw.match(/([\d.]+)%/);
  if (!match) return null;
  return parseFloat(match[1]);
}
```

### Pattern 2: Member Consolidation
**What:** Group parsed rows by member_id, sum amounts, concatenate products.
**When to use:** After parsing all rows, before rendering preview.
**Example:**
```typescript
interface ConsolidatedRecord {
  postedDate: string | null;
  type: string | null;
  memberCompany: string;
  memberId: string;
  products: string;  // comma-separated
  chargebackAmount: number;  // summed
  totalAmount: number;  // summed
  assignedTo: string;  // from rep roster round-robin
  // ... other fields from first row of the group
}

function consolidateByMember(rows: ParsedRow[]): ConsolidatedRecord[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const key = row.memberId ?? row.memberCompany ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return Array.from(groups.entries()).map(([_, memberRows]) => ({
    postedDate: memberRows[0].postedDate,
    type: memberRows[0].type,
    memberCompany: memberRows[0].memberCompany ?? "",
    memberId: memberRows[0].memberId ?? "",
    products: memberRows.map(r => r.product).filter(Boolean).join(", "),
    chargebackAmount: memberRows.reduce((s, r) => s + (r.chargebackAmount ?? 0), 0),
    totalAmount: memberRows.reduce((s, r) => s + (r.totalAmount ?? 0), 0),
    assignedTo: "",  // filled by round-robin
  }));
}
```

### Pattern 3: Round-Robin Assignment
**What:** Distribute consolidated records across active reps in order.
**When to use:** After consolidation, before preview render.
**Example:**
```typescript
function assignRoundRobin(
  records: ConsolidatedRecord[],
  activeReps: string[],
  lastIndex: number
): { records: ConsolidatedRecord[]; nextIndex: number } {
  if (activeReps.length === 0) return { records, nextIndex: lastIndex };
  let idx = lastIndex;
  const assigned = records.map(r => {
    idx = (idx + 1) % activeReps.length;
    return { ...r, assignedTo: activeReps[idx] };
  });
  return { records: assigned, nextIndex: idx };
}
```

### Pattern 4: API Route Structure (follows existing ops-api pattern)
**What:** Express routes with asyncHandler, Zod validation, requireAuth, requireRole.
**Endpoints needed:**
```
POST   /api/chargebacks                 - Submit consolidated records
GET    /api/chargebacks/weekly-total     - Weekly sum for ticker
GET    /api/cs-rep-roster               - List all reps
POST   /api/cs-rep-roster               - Add rep
PATCH  /api/cs-rep-roster/:id           - Toggle active/inactive
DELETE /api/cs-rep-roster/:id           - Remove rep
```

### Anti-Patterns to Avoid
- **Sending raw text to API for server-side parsing:** Parsing is a UI concern -- parse client-side so users see instant preview and can edit before submit.
- **Creating one DB record per raw row:** User specified 1 consolidated record per member per batch. Do NOT store individual product rows.
- **Hardcoding rep rotation state in frontend:** Track last-assigned index per session only (no need to persist rotation state -- it resets per paste).
- **Using Prisma `create` in a loop:** Use `createMany` for the batch insert of consolidated records.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom notification system | `ToastProvider` + `useToast` from @ops/ui | Already built, tested, themed |
| Date input | Custom date picker component | Native `<input type="date">` with baseInputStyle | Sufficient for simple date selection |
| Form buttons | Raw button elements | `Button` from @ops/ui (variant, loading, icon props) | Consistent styling, loading states built in |
| Table header/cell styling | Custom styles | `baseThStyle` / `baseTdStyle` from @ops/ui tokens | Consistent with all other tables in platform |
| Card containers | Custom div styling | `Card` from @ops/ui | Consistent border, background, radius |
| Stat display | Custom ticker component | Customize based on `StatCard` pattern from @ops/ui | Existing pattern for large number display |
| Batch ID generation | Custom ID scheme | `crypto.randomUUID()` | Standard, collision-resistant |

## Common Pitfalls

### Pitfall 1: Tab-Separated Field Position Drift
**What goes wrong:** The raw data has inconsistent tab positions -- some rows start with a line number, some don't. The example shows `2    22-Feb-26` (row 2 starts with "2" then tab).
**Why it happens:** Spreadsheet exports may include row numbers as the first column.
**How to avoid:** Detect if the first field is a bare integer (row number) and skip it. Use a heuristic: if field[0] matches `/^\d+$/` and field[1] matches a date pattern, shift the array by 1.
**Warning signs:** Posted dates showing up as numbers, type field containing dates.

### Pitfall 2: Negative Decimal Storage
**What goes wrong:** Chargeback amounts stored as positive or with incorrect precision.
**Why it happens:** Forgetting to negate the parenthesized pattern, or floating-point arithmetic when summing.
**How to avoid:** Always strip `($...)` to negative. Use string-based decimal for Prisma (it accepts string for Decimal fields). The schema uses `Decimal(12,2)` -- send as string like "-582.00".
**Warning signs:** Positive values in chargeback_amount column.

### Pitfall 3: Date Format Parsing
**What goes wrong:** `22-Feb-26` parsed incorrectly (year 2026 vs 1926).
**Why it happens:** Two-digit year ambiguity.
**How to avoid:** Parse `DD-Mon-YY` format explicitly. Map month abbreviations. Assume 2000s for YY < 50, 1900s for >= 50 (standard convention). Store as ISO date string for the API.
**Warning signs:** Dates showing year 1926.

### Pitfall 4: Member Info Pipe Parsing
**What goes wrong:** Member company and member_id not extracted correctly from pipe-separated group.
**Why it happens:** The member info field is `Shatena Bates | 686501575 | SUM` -- need to split by pipe and trim.
**How to avoid:** Split the member info field by `|`, trim each part. Index 0 = member_company, index 1 = member_id.
**Warning signs:** Member company containing pipe characters or IDs.

### Pitfall 5: Wrapping cs-dashboard in ToastProvider
**What goes wrong:** `useToast()` throws "must be used inside ToastProvider".
**Why it happens:** The cs-dashboard page.tsx doesn't currently wrap in `ToastProvider`.
**How to avoid:** Wrap the SubmissionsTab (or the entire page) in `<ToastProvider>`. Check the manager-dashboard for the pattern -- it wraps the whole app content.
**Warning signs:** Runtime error on first toast call.

### Pitfall 6: Sunday-Saturday Week Boundary
**What goes wrong:** Weekly total shows wrong records because of timezone or week boundary mismatch.
**Why it happens:** The API uses UTC dates but users are in a specific timezone.
**How to avoid:** Reuse the `getSundayWeekRange` utility from `apps/ops-api/src/services/payroll.ts` for consistent week boundaries. The weekly-total endpoint should use the same logic.
**Warning signs:** Records from Sunday appearing in wrong week.

## Code Examples

### Textarea with Auto-Parse on Paste
```typescript
// Pattern from manager-dashboard: inline styles, state management
const TEXTAREA: React.CSSProperties = {
  ...baseInputStyle,
  minHeight: 120,
  resize: "vertical",
  fontFamily: typography.fontMono,
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};

function PasteArea({ onParsed }: { onParsed: (records: ConsolidatedRecord[]) => void }) {
  const [rawText, setRawText] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    if (text.trim()) {
      const rows = parseChargebackText(text);
      const consolidated = consolidateByMember(rows);
      onParsed(consolidated);
    } else {
      onParsed([]);
    }
  };

  return (
    <textarea
      style={TEXTAREA}
      placeholder="Paste chargeback data from spreadsheet here..."
      value={rawText}
      onChange={handleChange}
    />
  );
}
```

### API Route: POST /api/chargebacks (follows existing pattern)
```typescript
// Source: apps/ops-api/src/routes/index.ts pattern
const chargebackSchema = z.object({
  records: z.array(z.object({
    postedDate: z.string().nullable(),
    type: z.string().nullable(),
    payeeId: z.string().nullable(),
    payeeName: z.string().nullable(),
    payoutPercent: z.number().nullable(),
    chargebackAmount: z.number(),         // negative decimal
    totalAmount: z.number().nullable(),
    transactionDescription: z.string().nullable(),
    product: z.string().nullable(),
    memberCompany: z.string().nullable(),
    memberId: z.string().nullable(),
    memberAgentCompany: z.string().nullable(),
    memberAgentId: z.string().nullable(),
    assignedTo: z.string().nullable(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
});

router.post("/chargebacks", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"),
  asyncHandler(async (req, res) => {
    const parsed = chargebackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
    const { records, rawPaste, batchId } = parsed.data;
    const result = await prisma.chargebackSubmission.createMany({
      data: records.map(r => ({
        postedDate: r.postedDate ? new Date(r.postedDate) : null,
        type: r.type,
        payeeId: r.payeeId,
        payeeName: r.payeeName,
        payoutPercent: r.payoutPercent,
        chargebackAmount: r.chargebackAmount,
        totalAmount: r.totalAmount,
        transactionDescription: r.transactionDescription,
        product: r.product,
        memberCompany: r.memberCompany,
        memberId: r.memberId,
        memberAgentCompany: r.memberAgentCompany,
        memberAgentId: r.memberAgentId,
        assignedTo: r.assignedTo,
        submittedBy: req.user!.id,
        batchId,
        rawPaste,
      })),
    });
    return res.status(201).json({ count: result.count, batchId });
  })
);
```

### API Route: GET /api/chargebacks/weekly-total
```typescript
router.get("/chargebacks/weekly-total", requireAuth,
  asyncHandler(async (_req, res) => {
    const { weekStart, weekEnd } = getSundayWeekRange(new Date());
    // weekEnd from getSundayWeekRange is Saturday; need to add 1 day for exclusive upper bound
    const nextSunday = new Date(weekEnd);
    nextSunday.setDate(nextSunday.getDate() + 1);
    const result = await prisma.chargebackSubmission.aggregate({
      _sum: { chargebackAmount: true },
      _count: { id: true },
      where: {
        submittedAt: { gte: weekStart, lt: nextSunday },
      },
    });
    return res.json({
      total: result._sum.chargebackAmount ?? 0,
      count: result._count.id,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });
  })
);
```

### Schema Changes Needed
```prisma
// Add to ChargebackSubmission model:
assignedTo  String?  @map("assigned_to")

// New model:
model CsRepRoster {
  id        String   @id @default(cuid())
  name      String
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("cs_rep_roster")
}
```

### Collapsible Sidebar Panel
```typescript
// CSS transition approach for collapsible rep roster
const SIDEBAR_PANEL: React.CSSProperties = {
  overflow: "hidden",
  transition: `max-height ${motion.duration.normal} ${motion.easing.out}`,
  borderLeft: `1px solid ${colors.borderSubtle}`,
  background: colors.bgSurface,
};
// Toggle with maxHeight: collapsed ? 0 : 500 (or use a ref for measured height)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Complex date pickers | Native `<input type="date">` | Evergreen | No dependency needed for simple date selection |
| Server-side text parsing | Client-side parsing with instant preview | Standard practice | Better UX, no network latency for preview |
| Individual inserts | `prisma.createMany()` | Prisma 2.x+ | Single query for batch inserts |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service only) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- helpers.test.js` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHBK-01 | Parser extracts all fields from tab-separated text | unit | Manual validation -- parser is client-side in Next.js app, Jest covers root only | No -- manual |
| CHBK-02 | Parenthesized dollar pattern to negative decimal | unit | Manual validation -- client-side logic | No -- manual |
| CHBK-03 | Editable preview table renders parsed records | manual-only | Visual verification in browser | N/A |
| CHBK-04 | Date picker and type override work | manual-only | Visual verification in browser | N/A |
| CHBK-05 | Multiple rows parse with shared batch_id | unit | Manual validation -- client-side logic | No -- manual |
| CHBK-06 | Records persist to DB with raw_paste, submitted_by, submitted_at | integration | `curl -X POST` against running API or manual browser test | No -- manual |

### Sampling Rate
- **Per task commit:** Manual smoke test -- paste sample data, verify preview, submit, check DB
- **Per wave merge:** Full manual walkthrough of paste -> preview -> edit -> submit -> verify DB + weekly ticker
- **Phase gate:** All 6 requirements verified manually with sample data from CONTEXT.md

### Wave 0 Gaps
- No automated test infrastructure exists for cs-dashboard (Next.js app) or for the chargeback API endpoints
- The existing Jest setup only covers the root Morgan service
- Justification for manual-only: This phase is primarily UI + API CRUD -- the parser logic could be unit tested but would require adding Jest to the cs-dashboard workspace, which is out of scope for this phase

## Open Questions

1. **Tab field positions may vary across spreadsheet sources**
   - What we know: The CONTEXT.md example shows specific positions, but the first field may or may not include a row number
   - What's unclear: Whether all paste sources will have the exact same column order
   - Recommendation: Build the parser for the documented positions but add the row-number-skip heuristic. If field positions vary, this becomes a future enhancement.

2. **Round-robin state persistence**
   - What we know: Round-robin distributes across active reps
   - What's unclear: Whether the last-assigned index should persist across sessions/users
   - Recommendation: Keep it simple -- track last-assigned index in React state per session. It resets when the page reloads. This is sufficient for the use case (paste-then-submit workflow).

3. **30-day roster cleanup**
   - What we know: Roster records should be cleaned after 30 days
   - What's unclear: Whether this means inactive reps or all reps
   - Recommendation: Use on-access pruning in the GET /api/cs-rep-roster endpoint -- delete records where `updatedAt < 30 days ago AND active = false`. Simpler than a cron job and avoids infrastructure.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- ChargebackSubmission model fields verified directly
- `apps/cs-dashboard/app/page.tsx` -- Current placeholder SubmissionsTab structure
- `apps/ops-api/src/routes/index.ts` -- Route patterns (asyncHandler, zodErr, requireAuth, requireRole)
- `packages/ui/src/components/` -- All available UI components verified (Button, Card, Input, Select, StatCard, Toast, EmptyState)
- `packages/ui/src/tokens.ts` -- Design tokens (baseInputStyle, baseThStyle, baseTdStyle, colors, spacing)
- `apps/ops-api/src/services/payroll.ts` -- getSundayWeekRange utility for week boundaries
- `12-CONTEXT.md` -- User decisions on field mapping, consolidation logic, rep roster, ticker

### Secondary (MEDIUM confidence)
- `apps/manager-dashboard/app/page.tsx` -- Reference pattern for authFetch, tab state, inline styles, toast usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- follows established patterns from manager-dashboard and ops-api
- Pitfalls: HIGH -- based on direct analysis of sample data format and existing code patterns
- Parser logic: MEDIUM -- depends on consistency of real-world paste data matching the example format

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- no external dependencies or fast-moving libraries)
