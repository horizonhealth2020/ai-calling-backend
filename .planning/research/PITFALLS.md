# Domain Pitfalls: State-Aware Bundle Commission Requirements

**Domain:** Adding state-aware bundle commission logic to existing commission engine
**Researched:** 2026-03-23
**Applies to:** v1.4 milestone -- modifying a working commission engine, adding state-dependent product availability, and configurable bundle requirements with fallback logic
**Overall confidence:** HIGH (based on direct codebase analysis of payroll.ts, routes, schema, tests, and UI)

## Critical Pitfalls

Mistakes that cause incorrect payroll calculations, data corruption, or production regressions.

### P1: Commission Preview Diverges from Actual Calculation

**What goes wrong:** The `/sales/preview` endpoint (routes/index.ts line 440-496) builds a `mockSale` object that does NOT include `memberState`. When state-aware logic is added to `calculateCommission()`, the preview will show different results than the actual sale submission because the mock lacks the state field. The preview schema (line 441-451) does not accept `memberState`.

**Why it happens:** The preview route was built before state awareness existed. It constructs `mockSale as any` (line 473), bypassing TypeScript type checking entirely. There is no compile-time enforcement that the mock matches the real Sale type.

**Consequences:** Agents see one commission amount in preview, get paid a different amount. Destroys trust in the preview feature -- the same preview that was carefully built in v1.0 (phase 5) specifically to prevent payroll disputes.

**Prevention:**
1. Add `memberState` to the preview Zod schema alongside `productId`, `premium`, etc.
2. Pass `memberState` through to the mockSale object so `calculateCommission()` receives it
3. Write a test that explicitly verifies preview and actual calculation produce identical results for the same inputs across multiple states
4. Consider replacing the `as any` cast with a proper type -- the `SaleWithProduct` type should be the contract

**Detection:** Compare preview responses to actual payroll entries for the same sale parameters. Any delta is a bug. Automate this as a test.

**Phase:** Must be addressed in the SAME phase that modifies `calculateCommission()`. Not a follow-up. The preview and the engine must change in lockstep.

---

### P2: Existing Sales Without memberState Get Wrong Commission on Recalculation

**What goes wrong:** The system recalculates commission in multiple places: `upsertPayrollEntryForSale()` (line 220), `handleSaleEditApproval()` (line 277), and sale status changes. Existing sales have `memberState: null` (the field is nullable: `String? @map("member_state") @db.VarChar(2)` in schema.prisma line 176). If the new logic treats null state as "no required addon available in this state" and halves commission, every recalculated legacy sale gets its payout cut.

**Why it happens:** `memberState` has been nullable since the v1.0 migration (migration `20260312_add_member_state`). The commission engine currently ignores it entirely -- `calculateCommission()` never reads `sale.memberState`. New state-aware logic must treat `null` as "legacy behavior, apply current rules unchanged."

**Consequences:** Agents in OPEN payroll periods see their commission drop on existing sales. Finalized periods trigger clawback adjustments via `handleCommissionZeroing()`. Payroll chaos for sales already entered and potentially already paid.

**Prevention:**
1. Define explicit fallback: `memberState === null || memberState === undefined` means "skip state-aware addon check, apply only the existing `qualifierExists` logic"
2. Write backward-compatibility tests FIRST: take every existing test in `commission.test.ts` (all 20+ test cases), verify they produce identical results after the engine change
3. Run a pre-deploy check: query `SELECT COUNT(*) FROM sales WHERE member_state IS NULL AND payroll_status != 'PAID'` to know how many at-risk records exist
4. The state-aware code path should be an ADDITIONAL check that only activates when `memberState` is non-null

**Detection:** Run the full test suite after any change to `calculateCommission()`. All existing tests must pass unchanged. If any existing test needs modification, that is a regression signal.

**Phase:** Must be the FIRST thing validated in the commission engine modification phase. Gate everything else on this.

---

### P3: Double Halving -- Bundle Qualifier Missing AND State-Required Addon Missing

**What goes wrong:** The current engine halves commission when `!qualifierExists && !sale.commissionApproved` (payroll.ts line 162). The v1.4 requirement adds another condition: "half commission when required addon missing." If both conditions apply independently, commission gets halved twice (quartered), which is not the business intent.

**Why it happens:** Two independent halving rules operating on the same `totalCommission` variable. The original halving at line 162 and a new state-based halving can stack if implemented as separate `if` blocks.

**Consequences:** Agent gets 25% of expected commission instead of 50%. This is a silent financial error -- no exception, no warning, just a wrong number that flows through payroll and gets paid out.

**Prevention:**
1. Clarify the business rule BEFORE coding: The state-aware addon requirement likely REPLACES the existing `isBundleQualifier` check, not adds to it. The intent is: "For state X, addon Y is the required bundle qualifier. If addon Y is unavailable in that state, use fallback addon Z instead."
2. Implementation approach: the state config determines WHICH product serves as the bundle qualifier for that state. The existing `qualifierExists` check at line 106 then checks if THAT state-appropriate product is present in the sale. One halving path, not two.
3. Write explicit test: `sale in state where primary addon unavailable, no fallback present -> should be halved ONCE, not twice`
4. Write another test: `sale in state where primary addon unavailable, fallback present -> should be full commission`

**Detection:** Any test where commission is less than 50% of the base rate (excluding enrollment fee halving) without explicit double-penalty intent is suspicious. Add an assertion that the halving penalty is applied at most once per sale.

**Phase:** Must be resolved in requirements/design before any code changes. This is a business rule clarification, not a coding task.

---

### P4: State-Availability Config Table Empty in Production

**What goes wrong:** A new config table (or Product model extension) maps which addon products are available per state and which is the required addon. If this config is empty or incomplete after migration, the commission engine has no data to determine required addons. Depending on implementation: either ALL sales get full commission (ignoring requirements) or ALL sales get half (no valid addon found for any state).

**Why it happens:** The config is new. There is no migration that seeds it. The Prisma seed script (`prisma/seed.ts`) handles users and products but has no state-availability data. Developers test with manually entered config data; production deploys with empty tables.

**Consequences:** First production deploy either overpays or underpays every agent. No middle ground. The error is silent -- commission amounts look plausible, just wrong.

**Prevention:**
1. Migration must include default config data for all states where the business currently operates (not all 50 -- just the ones with active sales)
2. Commission engine must have an explicit fallback when config is missing for a state: default to current behavior (existing `qualifierExists` check, no state filtering)
3. Add an admin-visible config completeness indicator: "12 of 50 states configured" in the Products tab
4. Config UI must be built AND populated BEFORE the commission engine reads from it -- phase ordering is critical

**Detection:** On startup or first commission calc for a state with no config, log a warning: `"No bundle requirement config for state XX, using default qualifier logic"`. This makes missing config visible in production logs.

**Phase:** Config table + seed data + config UI must be completed BEFORE commission engine changes are deployed. This determines phase ordering.

---

### P5: Sale Edit Flow Breaks When memberState Changes

**What goes wrong:** `handleSaleEditApproval()` (line 277-328) recalculates commission and manages clawback adjustments for finalized periods. If a sale edit changes `memberState` from a state where the required addon was present (full commission) to one where it is not (half commission), the clawback logic must correctly compute the delta. But `memberState` changes have a unique property: unlike changing the product or premium, changing the state can flip the commission from full to half even though the sale's products haven't changed.

**Why it happens:** The edit flow was built for product/premium/agent changes. It calculates `oldPayout` from the existing entry (line 295-296) and `newPayout` from recalculation. This works correctly for state changes too, BUT only if `memberState` is actually persisted before recalculation. The edit route (line 555-662) applies changes field-by-field -- if `memberState` is updated in the database BEFORE `upsertPayrollEntryForSale()` is called, it works. If the order is wrong, the recalculation uses the old state.

**Consequences:** Incorrect clawback amounts. Agent overpaid or underpaid when state is corrected on an existing sale. Finalized period integrity compromised.

**Prevention:**
1. Ensure `memberState` is included in the SaleEditRequest `changes` JSON so the audit trail captures it
2. Verify the field-update-then-recalculate ordering in the edit route handles `memberState` correctly
3. Test the full flow: sale created with state A (full commission), edited to state B (half commission), verify clawback equals exactly the difference
4. Test the reverse: state B (half) edited to state A (full), verify the adjustment is positive

**Detection:** Audit log should show `memberState` in the changes record. If an edit changes `memberState` but the audit log does not record it, the field is not being tracked.

**Phase:** Same phase as commission engine changes. The edit flow touches the same code path.

## Moderate Pitfalls

### P6: Commission Preview Performance with Config Lookups

**What goes wrong:** The commission preview is called on every product/addon/premium change in the sales form (ManagerEntry.tsx triggers preview via `useEffect`). Adding a database lookup for state-availability config on every preview request adds latency. If the config query is not optimized, preview becomes sluggish and the UX degrades.

**Prevention:**
1. Cache state-availability config in memory with a short TTL (60 seconds) -- the config changes rarely (admin action only)
2. Or: load all products with their state config in a single query when the form mounts, send the relevant config as part of the preview request body (client already has the data)
3. The preview endpoint already fetches product data (lines 455-461); extend that single query to include state config via a Prisma `include` or join

**Phase:** Address during commission engine modification. Not a separate optimization phase.

---

### P7: The `commissionApproved` Override Scope Becomes Ambiguous

**What goes wrong:** Currently, `commissionApproved: true` bypasses TWO halving checks: bundle qualifier halving (line 162) and enrollment fee halving (line 69). With state-aware logic, does `commissionApproved` also bypass the state-required addon check? If yes, managers can override any state restriction. If no, the override is less powerful than before and managers will be confused when "Approve Full Commission" does not actually approve full commission.

**Why it happens:** `commissionApproved` was a simple binary override. Adding a third halving condition without extending the override creates an inconsistency.

**Consequences:** Manager approves full commission, agent still gets half because the state-required addon is missing. Manager files a bug report. Payroll staff cannot explain the discrepancy.

**Prevention:**
1. Decide explicitly: `commissionApproved` bypasses ALL halving (bundle + state + enrollment fee). This is consistent with the current "override" mental model.
2. If the business wants granular control (approve bundle halving but not state halving), that requires a different field -- do NOT overload `commissionApproved` with partial behavior.
3. Current behavior is clearly "approve = bypass all halving." Maintain that pattern.
4. Update the commission preview to reflect the override correctly for state-aware scenarios.

**Phase:** Must be decided before commission engine changes. Document the decision in the plan.

---

### P8: Fallback Addon Creates Confusing Commission Differences Across States

**What goes wrong:** The requirement says "fallback addon for unavailable states." If state X cannot get addon A (primary), use addon B (fallback). But addon A and addon B may have different premiums and commission rates. Two identical-looking sales in different states pay different amounts, and neither the agent nor the payroll staff can easily see why.

**Prevention:**
1. Commission preview must show WHICH addon is required and whether primary or fallback is being used
2. The sales form should indicate when a primary addon is unavailable: gray it out, show a label like "Not available in [STATE]", auto-suggest the fallback
3. Payroll entry display should include a note: "Commission based on fallback addon (primary unavailable in FL)"
4. If possible, primary and fallback addons should have the same commission impact -- this is a business decision, not a code decision

**Phase:** UI phase, after commission engine logic is complete. But the data model must support storing which addon was used for qualification.

---

### P9: Socket.IO Does Not Propagate Config Changes

**What goes wrong:** If an admin changes the state-availability config (adds a new product for a state, changes the fallback), connected clients do not learn about it. The sales entry form may show stale addon options. The commission preview may calculate based on old config data (if cached client-side or in the preview endpoint memory cache).

**Prevention:**
1. Emit a `config-changed` event via Socket.IO when state-availability rules are modified
2. The sales form should re-fetch available products when the `memberState` field changes, not rely on a stale initial product list
3. If using server-side caching (P6), invalidate the cache when config changes

**Phase:** Address during the config UI phase. Low priority if config changes are rare (admin-only action).

---

### P10: Payroll CSV Export Missing State Context

**What goes wrong:** Current CSV exports include sale details but not `memberState` or which bundle requirement applied. When payroll staff review exported data offline, they cannot verify why a commission was full vs. half. Dispute resolution requires going back to the dashboard.

**Prevention:** Add `memberState` and bundle qualification status to all CSV export queries that include sale data. Check: payroll export, sales export, agent summary export.

**Phase:** Same milestone, but can be a later phase. Not blocking.

## Minor Pitfalls

### P11: State Validation Accepts Invalid State Codes

**What goes wrong:** Current Zod validation for `memberState` is just `z.string().max(2)` (routes line 335) and `.optional()`. This accepts "ZZ", "99", "XX", empty string, single character. No validation against actual US state codes.

**Prevention:** Use `z.string().length(2).regex(/^[A-Z]{2}$/).optional()` at minimum. For strict validation, use a Zod enum with the 50 state codes plus DC and territories if applicable. Since the state config table will define which states are configured, validation can reference that list.

**Phase:** Quick fix, include in the first phase alongside schema changes.

---

### P12: Paste-to-Parse May Extract Wrong State

**What goes wrong:** The parser in ManagerEntry.tsx (lines 195-199) extracts `memberState` from address patterns: `/,\s*([A-Z]{2})\s+\d{5}/` (state before ZIP code). If the pasted text has multiple addresses (company address + member address), it may grab the wrong one. The fallback regex `/\b([A-Z]{2})\s+\d{5}/` is even looser.

**Prevention:** Test the parser with real paste samples containing multiple state+ZIP patterns. Consider making the state field required and prominent in the form so agents verify the parsed value rather than trusting auto-fill blindly.

**Phase:** Minor, address during UI phase. The field is already editable so agents can correct it.

---

### P13: Test Helper Defaults Hide State-Aware Bugs

**What goes wrong:** The test helper `makeSale()` in commission.test.ts (line 69) defaults `memberState: null`. This is correct for backward-compatibility tests. But if developers add state-aware tests and forget to set `memberState`, tests pass because null triggers the fallback behavior, not because the state logic works correctly.

**Prevention:** Add a dedicated `describe` block for state-aware scenarios where `memberState` is ALWAYS explicitly set. Consider a separate `makeStateSale()` helper that requires `memberState` as a non-optional parameter.

**Phase:** Concurrent with commission engine changes. Part of the test update.

---

### P14: FL Exemption Test Suggests Abandoned State Logic

**What goes wrong:** The existing test suite (commission.test.ts lines 372-388) has an "FL exemption removed" test that explicitly verifies Florida sales are NOT exempt from halving. This suggests there WAS a previous FL exemption that was removed. The v1.4 state-aware logic is essentially re-introducing state-specific behavior. If the new logic accidentally re-creates the FL exemption (or any other state-specific override that was intentionally removed), it reintroduces a bug.

**Prevention:**
1. Review the "FL exemption removed" test and understand WHY it was removed
2. Ensure the new state-aware config does not unintentionally give any state an exemption from the bundle qualifier requirement -- it should only control WHICH addon qualifies, not WHETHER one is required
3. Keep the "FL exemption removed" test as a regression guard

**Phase:** During commission engine modification. The existing test is your canary.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Business rule clarification | P3 (double halving), P7 (commissionApproved scope) | Resolve before ANY code changes. These are design decisions, not implementation details. |
| Schema migration + config table | P4 (empty config in production), P11 (state validation) | Migration seeds default data; engine falls back gracefully on empty config |
| Commission engine modification | P1 (preview divergence), P2 (legacy sale regression), P3 (double halving), P14 (FL exemption) | Write backward-compatibility tests FIRST, update preview in same PR, single halving path |
| Config UI (Products tab) | P4 (config completeness), P9 (stale client config) | Completeness indicator, Socket.IO event on config change |
| Sales entry form (state field) | P8 (fallback confusion), P12 (parser wrong state) | Show which addon is required per state, validate parsed state |
| Sale editing | P5 (state change clawback), P7 (approval override scope) | Test full edit-recalc-clawback flow with state changes |
| Payroll display + exports | P10 (missing state in CSV), P8 (agents confused by different rates) | Add state column to exports, show qualification reason in payroll entries |
| Commission preview | P1 (preview divergence), P6 (performance) | Add memberState to preview schema and mock, cache config lookups |

## Sources

- `apps/ops-api/src/services/payroll.ts` -- commission engine: `calculateCommission()` (line 94-188), `upsertPayrollEntryForSale()` (line 220-264), `handleSaleEditApproval()` (line 277-328)
- `apps/ops-api/src/routes/index.ts` -- preview endpoint (line 440-496), sale creation (line 320-437), sale editing (line 555-662), memberState validation (line 335, 562)
- `prisma/schema.prisma` -- Product model (line 127-148), Sale model with `memberState` (line 150-191), PayrollEntry model (line 257-279)
- `apps/ops-api/src/services/__tests__/commission.test.ts` -- all 20+ test cases including FL exemption removed test (line 372-388), test helper defaults (line 44-73)
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` -- paste parser state extraction (line 195-199), form fields (line 240-246), preview trigger
- `.planning/PROJECT.md` -- v1.4 requirements, existing feature inventory, key decisions

---
*Research completed: 2026-03-23*
