# Domain Pitfalls: v1.7 Dashboard Fixes & Cost Tracking

**Domain:** Bug fixes, Convoso data flow repair, CS audit trail for existing Express/Prisma/Next.js insurance ops platform
**Researched:** 2026-03-25
**Overall confidence:** HIGH (based on direct codebase analysis of poller, routes, schema, and dashboard patterns)

---

## Critical Pitfalls

### P1: Convoso Call Log Persistence Creates Duplicate Records

**What goes wrong:** The poller runs every 10 minutes and fetches call logs from the Convoso API. It already uses `ProcessedConvosoCall` to deduplicate KPI aggregation. But if `ConvosoCallLog.createMany()` is added without proper deduplication, the same call record gets inserted every poll cycle. The Convoso API returns the same records on repeated requests (it is a log retrieval API, not a streaming API).

**Why it happens:** The `ProcessedConvosoCall` table tracks which Convoso call IDs have been processed for KPI purposes. The new `ConvosoCallLog` insert must respect the same deduplication or implement its own. The `ConvosoCallLog` model has no unique constraint on external Convoso call ID -- it only has the auto-generated `cuid` primary key.

**Consequences:** Thousands of duplicate call log records. Cost per sale calculations become wildly inflated (each call counted multiple times). Storage bloats rapidly. The `AgentCallKpi` aggregates remain correct (they have their own dedup), but any query joining `ConvosoCallLog` directly will return incorrect counts.

**Prevention:**
1. Add the `ConvosoCallLog.createMany()` AFTER the `ProcessedConvosoCall` dedup filter -- only insert calls from `newRaw` (the already-filtered set of new calls), not from `raw` (all fetched calls)
2. Consider adding a unique index on `ConvosoCallLog` for the Convoso-side call ID. This requires adding a `convosoCallId` column (external ID) to the model. Alternatively, use `skipDuplicates: true` with a compound unique on `(agentUser, callTimestamp, listId)`
3. If using the existing `ProcessedConvosoCall` filter, the insert must happen inside the same code path that marks calls as processed -- not in a separate step that could fail independently

**Detection:** Query `SELECT COUNT(*) FROM convoso_call_logs GROUP BY agent_user, call_timestamp HAVING COUNT(*) > 1` after deployment. Any duplicates indicate the dedup is broken.

---

### P2: Convoso API Field Mapping Mismatch

**What goes wrong:** The Convoso API returns JSON with field names like `call_length`, `user_id`, `recording_url`, `id`. The `ConvosoCallLog` model uses `callDurationSeconds`, `agentUser`, `recordingUrl`. If the field mapping is wrong -- e.g., `call_length` is in minutes not seconds, or `recording_url` vs `recordingUrl` vs `recording` -- the stored data is silently incorrect.

**Why it happens:** The Convoso API documentation is external and not version-locked. The existing code in `convosoCallLogs.ts` casts the response with `as ConvosoCallLog[]` (line 68 in `call-logs.ts`) without validating individual fields. The `extractConvosoResults()` function returns `Record<string, unknown>[]` -- no type safety on the actual field names.

**Consequences:** `callDurationSeconds` contains minutes (off by 60x), breaking tier classification. `agentUser` contains the wrong identifier, breaking agent matching. `recordingUrl` is null because the field name was wrong, breaking the call audit pipeline.

**Prevention:**
1. Log the first raw Convoso response when the poller runs to verify field names: `console.log(JSON.stringify(raw[0]))` during development
2. Add explicit field extraction with fallbacks: `callDurationSeconds: Number(r.call_length ?? r.call_duration ?? 0)`
3. The existing `classifyTier()` function treats `call_length` as seconds (thresholds at 30, 120, 300 seconds). Verify the Convoso API returns seconds, not minutes
4. Add a Zod schema to validate the mapped record before insertion -- catch mismatches at write time, not when dashboards display garbage data

**Detection:** After first poll cycle, spot-check 5 ConvosoCallLog records against the Convoso dashboard. Verify call durations and agent assignments match.

---

## Moderate Pitfalls

### P3: Resolved Log Tab Shows Stale Data After Unresolve

**What goes wrong:** The CS Resolved Log tab queries `WHERE resolvedAt IS NOT NULL`. When a record is unresolved (resolvedAt set back to null via the existing unresolve endpoint), it disappears from the resolved log. But if the resolved log tab is already loaded, the unresolved record remains visible until refresh. With Socket.IO, the main CS tracking tab updates in real-time on resolve/unresolve, but a new resolved log tab may not have its own Socket.IO listener.

**Why it happens:** The existing `emitCSChanged` event fires on resolve (`chargebacks.ts` line 148) but the resolved log tab is a new component that may not listen for this event.

**Prevention:**
1. Add a Socket.IO listener in the resolved log component that refetches data on `cs:changed` events (same pattern as CSTracking component)
2. Alternatively, accept manual refresh for the resolved log since it is an audit trail and OWNER_VIEW users do not typically need real-time updates of resolve/unresolve actions

**Detection:** Open resolved log in one browser tab, unresolve a record in another tab. If the first tab still shows the record, the listener is missing.

---

### P4: Lead Spend Display Shows Zero for Agents Without AgentCallKpi Records

**What goes wrong:** The "show agent lead spend with zero sales" feature intends to display cost data for agents who have calls but no conversions. But if the Convoso data flow fix (Feature 4) is not deployed first, there may be no `AgentCallKpi` records for any agents. The feature would show an empty table and appear broken.

**Why it happens:** `AgentCallKpi` records are created by the poller only when: (a) the poller is running, (b) the lead source has a `listId`, (c) the Convoso API returns data, and (d) the agent can be matched via email. If any of these conditions is unmet, agents have no KPI records and therefore no lead spend data.

**Prevention:**
1. Implement the Convoso data flow fix (Feature 4) before or simultaneously with the lead spend display
2. Handle the empty state gracefully: "No call data available. Ensure Convoso polling is enabled and lead sources have list IDs configured."
3. Do not show "$0.00 lead spend" when there is genuinely no data -- distinguish between "zero spend" and "no data"

---

### P5: Manager Config Products Removal Breaks Manager Workflow

**What goes wrong:** If the Manager Config tab's Products section is removed but managers currently use it to view product information (not just edit), they lose visibility into what products exist. They may need to reference product names, commission rates, or bundle rules while entering sales.

**Why it happens:** The Products section may serve a dual purpose: configuration (which belongs in Payroll) and reference (which managers need).

**Prevention:**
1. Before removing, verify with the PROJECT.md scope that managers should NOT see products at all, or if they need read-only access
2. If managers need product visibility, convert the section to read-only instead of removing it entirely
3. Check if the sales entry form already shows product information inline (it likely does via the product dropdown), making a separate Products reference section redundant

**Detection:** After removal, ask a manager user if they miss the Products section. If they do, add a read-only version back.

---

## Minor Pitfalls

### P6: Premium Column Fix May Show Different Totals Than Expected

**What goes wrong:** The Manager Agent Sales premium column currently shows core product premium only. When addon premiums are added, the per-row totals will be higher. Users accustomed to the old numbers may think there is a bug. The sales board already shows addon-inclusive premiums, so the Manager view will now match, but the change in numbers may cause confusion.

**Prevention:**
1. If possible, label the column "Total Premium" (not just "Premium") to signal it includes addons
2. Consider showing a tooltip or subtitle: "Includes addon premiums"
3. This is a cosmetic concern, not a technical one

---

### P7: Buffer Field Default Value Mismatch

**What goes wrong:** The database default for `callBufferSeconds` is 0 (schema line 114). If the create form uses a different default (e.g., leaving the field empty and passing `undefined`), Prisma will use the DB default. But if the Zod schema uses `.default(0)` and the form sends `0` explicitly, there is no mismatch. The pitfall is if someone adds `.optional()` without `.default(0)` and the form sends `undefined` -- Prisma handles it fine, but the behavior is implicit.

**Prevention:**
1. Use `z.number().int().min(0).default(0)` in the Zod schema (not `.optional()`)
2. Pre-populate the form field with `0` so users see the current default

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Quick fixes (Products, Buffer, Premium) | P5 (manager loses product visibility), P6 (premium numbers change), P7 (buffer default) | Verify manager needs, label column clearly, use explicit defaults |
| Convoso data flow fix | P1 (duplicate records), P2 (field mapping) | Use existing dedup filter, log raw response, add validation |
| Lead spend display | P4 (no data without poller running) | Deploy data flow fix first, handle empty state |
| CS Resolved Log | P3 (stale data after unresolve) | Add Socket.IO listener or accept manual refresh |

## Sources

- `apps/ops-api/src/workers/convosoKpiPoller.ts` -- Dedup logic via ProcessedConvosoCall (lines 57-78), newRaw filtering
- `apps/ops-api/src/services/convosoCallLogs.ts` -- Field casting with `as ConvosoCallLog[]` (no validation)
- `apps/ops-api/src/routes/chargebacks.ts:148` -- `emitCSChanged` on resolve
- `prisma/schema.prisma:457` -- ConvosoCallLog has no unique constraint on external call ID
- `prisma/schema.prisma:114` -- `callBufferSeconds Int @default(0)`

---
*Pitfalls research for: v1.7 Dashboard Fixes & Cost Tracking*
*Researched: 2026-03-25*
