# Domain Pitfalls

**Domain:** Sales/payroll ops platform v2.1 feature additions
**Researched:** 2026-04-06

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or payroll inaccuracies.

### Pitfall 1: CSV Chargeback Upload — Partial Batch Failures Without Transaction Safety

**What goes wrong:** A CSV with 50 chargeback rows processes 30 successfully, then row 31 fails validation or matching. The user sees a partial import with no clear indication of which rows succeeded and which failed. Worse, if the batch creates payroll alerts for the first 30 rows before failing, those alerts are now orphaned from incomplete batch context.

**Why it happens:** The existing `POST /chargebacks` endpoint uses `createMany` for records, then loops through created records for matching and alert creation. A CSV upload amplifies this pattern -- a 200-row CSV hitting the loop-based matching (one query per row) creates N+1 query patterns and sequential `createAlertFromChargeback` calls. Any failure mid-loop leaves the database in a partial state.

**Consequences:** Payroll staff see partial chargeback data. Alerts fire for some chargebacks but not others. Re-uploading the CSV creates duplicates for the rows that already succeeded. Users lose trust in batch operations.

**Prevention:**
1. Wrap the entire CSV batch in a Prisma `$transaction` so it is all-or-nothing.
2. Separate validation from persistence: parse and validate ALL rows client-side, show a pre-submit review table, then send only validated records.
3. Add a dedupe guard on CSV upload -- hash the CSV content or use a unique batch identifier so re-uploads are idempotent.
4. The existing `batchId` field is already a UUID generated per paste. For CSV, generate a deterministic batch ID from the file hash to prevent re-upload duplicates.

**Detection:** Chargeback count in tracking table does not match the row count the user expected from their CSV.

### Pitfall 2: Enrollment Fee $0 Default — Triggering Half-Commission on Every Sale Without a Fee

**What goes wrong:** Changing `enrollmentFee` from `null` to `0` when missing fundamentally changes commission behavior. The current code at `payroll.ts:56` has an explicit early return: `if (enrollmentFee === null || enrollmentFee === undefined) return { finalCommission: commission, enrollmentBonus: 0, feeHalvingReason: null }`. Changing null to 0 means EVERY sale that previously had no enrollment fee now hits the `fee < halfThreshold` check at line 79, which would HALVE commission for all of them (unless `commissionApproved` is true).

**Why it happens:** The intent is to fix the UI showing a "half commission" badge when enrollment fee is missing (null). But the fix location matters enormously. Defaulting at the database/API level changes commission calculations. Defaulting only at the UI display level fixes the badge without affecting payroll.

**Consequences:** Every historical sale without an enrollment fee gets half commission on recalculation. Payroll entries are wrong. Agents are underpaid. Reversing the change requires identifying which sales legitimately had $0 fees vs which had missing fees.

**Prevention:**
1. Do NOT change the database column default or the `enrollmentFee ?? null` patterns in `sales.ts`.
2. The fix should be scoped to exactly TWO places: (a) the payroll UI half-commission badge check at `PayrollPeriods.tsx:1505` should treat null as "no fee, not half commission" (currently correct -- `enrollmentFee !== null && Number(...) < 99`), and (b) the approve button visibility, which also correctly guards on `!== null`.
3. If the actual bug is the commission preview showing a half-commission badge when enrollment fee is empty on the entry form, fix the preview endpoint to treat empty/null enrollment fee as "skip fee check" not "fee is $0".
4. Add a test case: `COMM-null-fee: sale with enrollmentFee=null should NOT trigger halving`.

**Detection:** Payroll totals drop dramatically after deployment. Half-commission badges appear on sales that never had enrollment fee issues.

### Pitfall 3: ACA Product Edit — Changing flatCommission Retroactively Corrupts Existing Payroll

**What goes wrong:** Making `flatCommission` editable in the Products tab means someone changes it from $15/member to $20/member. Existing payroll entries for ACA_PL sales were calculated at the old rate. The product table stores the current rate, not a historical snapshot. If any payroll recalculation is triggered (sale edit, status change, period reopen), existing ACA entries recalculate at the new rate.

**Why it happens:** The commission engine at `payroll.ts:106` reads `sale.product.flatCommission` at calculation time, not the rate that was in effect when the sale was made. This is fine for percentage-based products (rates rarely change), but flat commission products are more likely to have rate adjustments.

**Consequences:** Historical payroll entries silently change amounts when recalculated. Agent pay for past periods becomes inaccurate. Audit trail shows the payroll entry was "updated" but the reason is obscured.

**Prevention:**
1. When saving a flat commission change, log the old and new values in the audit log via `logAudit`.
2. Add a confirmation dialog: "This product has X active payroll entries. Changing the rate will NOT retroactively change existing payroll entries, but any future recalculations will use the new rate."
3. Consider snapshotting `flatCommission` on the `PayrollEntry` or storing it as a field on the sale at creation time. For v2.1, the warning dialog is sufficient -- snapshot can be deferred.
4. The `PATCH /products/:id` endpoint already exists and supports all fields. The ACA edit is purely a UI task -- no new API work needed.

**Detection:** Payroll entry amounts change after a product edit + unrelated sale update in the same period.

### Pitfall 4: Payroll Agent Card Redesign — Sidebar With All Agents Creates Empty State Chaos

**What goes wrong:** A sidebar listing ALL agents includes agents with zero payroll entries for any period. Clicking an agent with no entries shows a blank right panel. With "last 4 pay cards + load more," an agent who just started has 0-1 cards, making the layout look broken. Worse, the `allAgents` variable at `PayrollPeriods.tsx:1514` already injects empty arrays for agents not in the period -- this pattern needs to extend to the sidebar.

**Why it happens:** The redesign changes from "one card per period containing all agents" to "one sidebar listing agents, one panel showing per-agent history." Agents without entries are a normal state (new hires, inactive agents still in the list), but the UI does not account for it.

**Consequences:** Users think the system is broken when clicking an agent shows nothing. The "load more" button logic breaks when there are fewer than 4 entries.

**Prevention:**
1. Show "No payroll entries yet" empty state with the agent's start date if available.
2. For the "last 4 pay cards" query, use a single API call: `GET /payroll/agent/:agentId/history?limit=4&offset=0`. Return periods even if they have zero entries for this agent (so the user sees the period existed).
3. In the sidebar, show a visual indicator for agents with entries vs without (dot, badge count, or grayed name).
4. Filter sidebar to active agents by default, with a toggle to show inactive agents.
5. Handle the edge case: an agent exists in the sidebar but has entries only as part of `ServicePayrollEntry` (service agents), not `PayrollEntry`. These are different tables -- do not mix them.

**Detection:** QA clicks through every agent in the sidebar. At least one will have no entries.

## Moderate Pitfalls

### Pitfall 5: CSV Parsing — Column Header Mismatches and Encoding Issues

**What goes wrong:** The chargeback CSV from the carrier may have different column headers than expected (e.g., "Chargeback Amt" vs "chargebackAmount"), BOM characters in the first byte, Windows line endings, or quoted fields containing commas. The existing paste-to-parse parser in `CSSubmissions.tsx` handles tab-delimited carrier data with a custom parser. CSV is a different format requiring different parsing logic.

**Why it happens:** CSV is not a single format -- it is a family of formats. Excel exports UTF-8 with BOM. Google Sheets exports UTF-8 without BOM. Carrier reports may be ISO-8859-1. Column order varies between report versions.

**Prevention:**
1. Use a battle-tested CSV parser library (Papa Parse is the standard for browser-side CSV). Do not write a custom parser.
2. Show a column mapping step in the pre-submit review: detect headers automatically, let the user confirm or remap columns.
3. Strip BOM (`\uFEFF`) from the first byte.
4. Validate that required columns exist before processing. Required: at minimum `chargebackAmount`, `memberId` (for matching).
5. Show the raw parsed preview table BEFORE any matching logic runs, so users can catch parsing errors visually.

**Detection:** First real CSV upload from a carrier report will reveal mismatches. Test with an actual carrier export, not a manually created CSV.

### Pitfall 6: Rolling Window (Last 30 Audits) — Count-Based vs Time-Based Query Semantics

**What goes wrong:** "Last 30 audits" means different things: (a) the 30 most recent audit records, or (b) audits from the last 30 calendar days. The current code at `call-audits.ts:49` defaults to `24 * 60 * 60 * 1000` (24 hours) when no date range or cursor is specified. Changing this to "last 30 audits" (count-based) is different from "last 30 days" (time-based). A count-based approach with cursor pagination already exists -- the `limit` parameter defaults to 25.

**Why it happens:** The requirement says "last 30 audits instead of last 24 hours." This is a change from time-based to count-based default windowing. The cursor pagination already supports count-based loading (take: limit + 1), so the fix is trivial: remove the 24-hour default when no cursor is present, and change the default limit from 25 to 30.

**Prevention:**
1. Simply remove the `else if (!cursor)` block at line 48-52 that sets a 24-hour window. Let the query use no date filter on initial load, relying on `take: limit + 1` (change default to 30).
2. The cursor pagination already handles "load more" correctly.
3. Keep the date range filter working -- if a user selects "Last Week," the date filter should still apply on top of the count limit.
4. Do NOT change the database query to `ORDER BY createdAt` instead of `callDate` -- the existing dual-field ordering (`callDate DESC, updatedAt DESC`) is intentional (D-09 in the code comments).

**Detection:** After the change, verify that selecting a date range still works correctly alongside the count-based default.

### Pitfall 7: Sparkline Data — Date Key Format Mismatch Between PostgreSQL and JavaScript

**What goes wrong:** The sparkline query at `lead-timing.ts:153` casts `call_timestamp` to `::date`, which returns a PostgreSQL `date` type. When Prisma serializes this to JavaScript, the format depends on the Prisma version and PostgreSQL driver. It may come as `"2026-04-06"` (string) or `2026-04-06T00:00:00.000Z` (Date object). The client-side code at line 203 uses `String(r.day)` to build lookup keys, while the 7-day series at line 213 uses `d.toISOString().slice(0, 10)` which produces `"2026-04-06"`. If `String(r.day)` produces `"Sun Apr 06 2026 ..."` (from a Date object), the keys never match and sparklines show all zeros.

**Why it happens:** Prisma raw queries (`$queryRaw`) return database types as-is. PostgreSQL `date` type serialization is not guaranteed to match JavaScript date string formatting. The mismatch is environment-dependent -- it may work in local dev with one Prisma version and fail in production with another.

**Prevention:**
1. In the SQL query, explicitly cast the date to a string format: `TO_CHAR((...), 'YYYY-MM-DD') AS day` instead of `::date AS day`. This guarantees the format regardless of Prisma/driver behavior.
2. On the client side, normalize the day key: `const dayKey = typeof r.day === 'string' ? r.day.slice(0, 10) : new Date(r.day).toISOString().slice(0, 10)`.
3. Add a log line in the sparkline endpoint to verify the day format during development: `console.log('sparkline day sample:', calls[0]?.day, typeof calls[0]?.day)`.

**Detection:** Sparklines render as flat zero lines even when there is clearly call/sale data for the period. Check the Network tab -- if the API returns data with mismatched day formats, this is the cause.

### Pitfall 8: ACA Addon Qualifier Rules — Circular Product Dependencies

**What goes wrong:** Making ACA product addon qualifier rules editable in the Products tab means someone could set Product A's required bundle addon to Product B, and Product B's required bundle addon to Product A. The `resolveBundleRequirement` function at `payroll.ts:226` would loop or produce nonsensical results. Additionally, setting an ACA_PL product as a `requiredBundleAddonId` target creates a cross-type dependency that the commission engine does not handle.

**Why it happens:** The Products tab allows setting `requiredBundleAddonId` and `fallbackAddonIds` on any product. There is no validation preventing circular references or cross-type misconfigurations.

**Prevention:**
1. In the `PATCH /products/:id` endpoint, validate that `requiredBundleAddonId` is not the product itself and is not a product that already requires the current product as its addon.
2. Only allow ADDON type products as `requiredBundleAddonId` targets -- not CORE, AD_D, or ACA_PL.
3. For ACA_PL products, the edit form should only show `flatCommission` and `name` -- not bundle requirement fields (ACA_PL uses a completely different commission path that ignores bundle requirements).
4. The UI should conditionally show/hide fields based on product type selection.

**Detection:** Product configuration looks normal but commission calculations produce unexpected results or errors.

## Minor Pitfalls

### Pitfall 9: Payroll Sidebar — Agent Sort Order Inconsistency

**What goes wrong:** The current payroll display at `PayrollPeriods.tsx:1508-1516` groups entries by agent name using a Map, then adds missing agents from `allAgents`. Map iteration order is insertion order, so agents appear in the order their first payroll entry was created, not alphabetical. The new sidebar needs a consistent sort -- alphabetical by name or by `displayOrder` field on the Agent model.

**Prevention:** Sort sidebar agents by `displayOrder` (existing field, default 0) then alphabetically by name. Use `allAgents.sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name))`.

### Pitfall 10: CSV Upload File Size and Browser Memory

**What goes wrong:** A CSV with 10,000 rows loaded entirely into browser memory for preview can freeze the tab. The existing paste-to-parse flow handles 10-50 rows at a time. CSV uploads could be orders of magnitude larger.

**Prevention:** Cap preview at 100 rows with a "showing first 100 of 5,432 rows" message. Parse the full file only on submit. Set a server-side max (e.g., 1000 rows per batch) with a clear error message. Add `express.json({ limit: '5mb' })` or equivalent on the upload route.

### Pitfall 11: Lead Source Analytics Start Expanded — Layout Shift on Load

**What goes wrong:** Performance tracker sections currently start collapsed. Changing them to start expanded means the heatmap and sparklines render immediately on page load, firing API calls before the user has scrolled down. If the data is slow to load, the section shows spinners that push content around.

**Prevention:** Use skeleton loaders (fixed-height placeholder blocks) to prevent layout shift. Consider lazy-loading the analytics data with `IntersectionObserver` so API calls only fire when the section scrolls into view, even though it starts visually expanded.

### Pitfall 12: Payroll History "Load More" — Unbounded Query Growth

**What goes wrong:** "Last 4 pay cards + load more" without a maximum creates unbounded queries for agents with 52+ weeks of history. Each "load more" fetches 4 more periods, eventually loading hundreds of payroll entries.

**Prevention:** Set a hard cap (e.g., 20 periods maximum). Show a "View older periods" link to the full payroll tab with a date range filter rather than loading indefinitely.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| CSV chargeback upload | Partial batch failures (Pitfall 1), column mapping (Pitfall 5) | Transaction wrapping, Papa Parse library, pre-submit review table |
| ACA product edit | Retroactive commission change (Pitfall 3), circular deps (Pitfall 8) | Audit log + warning dialog, type-conditional field visibility |
| Enrollment fee $0 default | Commission regression (Pitfall 2) | UI-only fix, do NOT change database defaults or payroll engine |
| Payroll agent card redesign | Empty state (Pitfall 4), sort order (Pitfall 9), load more bounds (Pitfall 12) | Empty state component, sorted sidebar, capped pagination |
| Call audit rolling window | Query semantics confusion (Pitfall 6) | Remove 24h default, rely on existing count-based pagination |
| Performance tracker polish | Sparkline data mismatch (Pitfall 7), layout shift (Pitfall 11) | TO_CHAR in SQL, skeleton loaders |

## Sources

- Direct codebase analysis of `apps/ops-api/src/services/payroll.ts` (commission engine)
- Direct codebase analysis of `apps/ops-api/src/routes/chargebacks.ts` (batch creation pattern)
- Direct codebase analysis of `apps/ops-api/src/routes/call-audits.ts` (24h default window)
- Direct codebase analysis of `apps/ops-api/src/routes/lead-timing.ts` (sparkline date handling)
- Direct codebase analysis of `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (enrollment fee checks, agent grouping)
- Direct codebase analysis of `prisma/schema.prisma` (Product model, ACA_PL type, flatCommission field)
- Confidence: HIGH -- all pitfalls identified from actual code patterns, not hypothetical scenarios
