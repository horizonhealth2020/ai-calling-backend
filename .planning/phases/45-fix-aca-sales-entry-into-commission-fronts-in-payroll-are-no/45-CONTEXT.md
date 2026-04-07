# Phase 45: Fix ACA Entry, Front Carryover, and CS Round Robin - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Three independent bug fixes across the ops platform:

1. **ACA sales entry into commission** — When a manager enters a regular sale with the ACA checkbox toggled, the parent sale and its addons are dropped from payroll; only an isolated ACA row appears. Also, the ACA commission cell renders verbose breakdown text (`$X × N members = $Y`) instead of a flat dollar sum like every other product.
2. **Fronts not carrying into following holds** — Fronts entered on the agent-period adjustment level are not reliably appearing as `Fronted Hold` on the next payroll period. Both the first-lock path AND the unlock/re-lock path must work.
3. **CS Submissions round robin advancing on page refresh** — `batchRoundRobinAssign` advances the persisted server-side cursor on every preview/parse call (page refresh, paste, rep change), not on actual submission. Reps that get previewed but not submitted are permanently skipped, producing uneven assignment.

Out of scope: any unrelated payroll, sales, or CS feature changes.

</domain>

<decisions>
## Implementation Decisions

### Bug 1: ACA sales entry into commission

- **D-01:** Manager entry flow used = single sale form with ACA checkbox toggled (NOT two separate sales). Selected: Complete Care Max as main product + Compass Care Navigator+ addon + ACA checkbox checked. Expected behavior: ONE entry showing the regular sale (Complete Care Max + addon) with an ACA badge/indicator and the ACA flat commission added on top. Actual behavior: only the ACA covering row persists in payroll; the parent regular sale and its addon are missing.
- **D-02:** Root cause investigation must cover both the API submission path ([apps/ops-api/src/routes/sales.ts](apps/ops-api/src/routes/sales.ts) ACA branch) AND the manager entry form to determine whether the parent sale is failing to persist, failing to create a PayrollEntry, or being created but linked incorrectly via `acaCoveringSaleId`.
- **D-03:** ACA commission display must render as a plain dollar sum (e.g., `$10.00`) identical to every other product row. Drop the `$X.XX × N members = $total` breakdown text.
- **D-04:** Display fix applies to BOTH the dashboard view and the printed payroll output.
- **D-05:** Bundled ACA + parent sale must show a single unified entry where applicable, not two disconnected rows. The parent sale's addons must be preserved and displayed.

### Bug 2: Fronts not carrying into following holds

- **D-06:** Plan must fix BOTH potential paths — unknown which one is failing in production:
  - **Path A (idempotency on re-lock):** [executeCarryover](apps/ops-api/src/services/carryover.ts#L20) skips when `period.carryoverExecuted === true`. The flag is never reset on unlock, so the lock → unlock → add front → re-lock workflow silently skips carryover.
  - **Path B (first lock):** Verify the first-lock path correctly carries fronts when an `agentPeriodAdjustment` row with `frontedAmount > 0` exists at lock time. No fix expected here unless investigation finds one.
- **D-07:** For Path A, on unlock the carryover state must be reversed before re-running:
  1. Reset `carryoverExecuted = false` on the unlocked period
  2. Reverse the previously-carried hold from the next period (decrement `holdAmount` by what was carried, clear `holdFromCarryover`/`holdLabel` if it zeros out)
  3. On re-lock, `executeCarryover` runs again from a clean slate
- **D-08:** Carryover continues to read from `AgentPeriodAdjustment.frontedAmount` (not `PayrollEntry.frontedAmount`). The dashboard already uses [POST/PATCH /payroll/adjustments](apps/ops-api/src/routes/payroll.ts#L337) exclusively ([WeekSection.tsx:529](apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx#L529)) so this is correct.
- **D-09:** Existing carryover semantics from Phase 40 are preserved: `D-09 carryHold += frontedAmount`, `D-10 negative net adds to carryHold`, `D-11 increment-based upsert`, `holdLabel = "Fronted Hold"`.

### Bug 3: CS Submissions round robin

- **D-10:** Round-robin cursor must advance ONLY on actual submission, not on preview/parse/refresh.
- **D-11:** Implementation approach = split server-side concerns:
  - **Preview path:** [GET /api/reps/batch-assign](apps/ops-api/src/routes/cs-reps.ts#L114) becomes a dry-run that returns deterministic assignments based on the current cursor WITHOUT advancing it. Add a `preview=true` query param OR introduce a new `/reps/batch-preview` endpoint — implementer's choice during planning.
  - **Submit path:** When the chargeback batch or pending-term batch is actually submitted to the DB, the submit endpoint advances the persisted cursor by the count of records actually inserted. Cursor advancement happens server-side inside the same transaction as the insert, so a failed submission rolls back the cursor too.
- **D-12:** `salesBoardSetting` keys (`cs_round_robin_chargeback_index`, `cs_round_robin_pending_term_index`) remain the storage location. Separate cursors per type (chargeback vs pending_term) is preserved.
- **D-13:** Client-side fallback in [CSSubmissions.tsx:442-447](apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx#L442-L447) (random offset local round-robin) stays as a last-resort fallback when the API fails.
- **D-14:** Manual override in the assignedTo dropdown ([line 868-869](apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx#L868-L869)) continues to work — preview gives suggested assignments, user can edit, submit persists whatever's in the row.
- **D-15:** No TTL/reservation system. Preview is purely a dry-run; cursor only moves on submit.

### Claude's Discretion

- Choice between adding a `preview` query param vs creating a separate preview endpoint for round-robin
- Exact mechanism for reversing prior carryover holds on unlock (direct decrement vs delete-and-recreate)
- Whether the ACA fix requires a schema/data migration for any sales already submitted with the broken flow
- UI/print template implementation details for the ACA display fix

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug 1 — ACA sales entry
- `apps/ops-api/src/routes/sales.ts` — Sales POST/PATCH route, ACA branch handling
- `apps/ops-api/src/services/payroll.ts` §calculateCommission L103-L112 — ACA flat commission formula
- `apps/ops-api/src/services/payroll.ts` §resolveBundleRequirement L218-L240 — ACA covering sale auto-satisfies bundle
- `apps/ops-api/src/services/payroll.ts` §upsertPayrollEntryForSale — Where PayrollEntry gets created from a Sale
- `apps/ops-dashboard/app/(dashboard)/manager/` — Manager sale entry form (find ACA checkbox handler)
- `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` — Dashboard commission cell rendering
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` — Print output for payroll
- `prisma/schema.prisma` — `Sale.acaCoveringSaleId` self-relation, `Sale.memberCount`, `Product.flatCommission`

### Bug 2 — Front carryover
- `apps/ops-api/src/services/carryover.ts` — `executeCarryover` full file
- `apps/ops-api/src/routes/payroll.ts` L34-L62 — PATCH `/payroll/periods/:id/status` (lock/unlock trigger)
- `apps/ops-api/src/routes/payroll.ts` L337-L393 — `/payroll/adjustments` POST/PATCH (front entry path)
- `apps/ops-api/src/services/__tests__/carryover.test.ts` — Existing carryover test coverage
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` L529-L723 — UI calls into adjustments endpoints
- `prisma/schema.prisma` — `PayrollPeriod.carryoverExecuted`, `AgentPeriodAdjustment.holdFromCarryover`, `holdLabel`, `carryoverSourcePeriodId`

### Bug 3 — CS round robin
- `apps/ops-api/src/services/repSync.ts` L80-L151 — `getNextRoundRobinRep` and `batchRoundRobinAssign`
- `apps/ops-api/src/routes/cs-reps.ts` L106-L125 — Round-robin endpoints
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` L433-L486 — `fetchBatchAssign`, `handleTextChange`, reps useEffect
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` (submit handlers) — Where chargeback and pending-term batches actually persist
- `prisma/schema.prisma` — `SalesBoardSetting`, `CsRepRoster`, `ChargebackSubmission`, `PendingTerm`

### Project context
- `CLAUDE.md` — Project conventions (inline CSSProperties, Zod via zodErr, async handlers, audit logging)
- `.planning/STATE.md` — Project decisions including Phase 40 carryover semantics, Phase 41 ACA_PL union

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `executeCarryover` already handles the increment + label logic correctly — only the trigger flow and idempotency need fixing
- `batchRoundRobinAssign` already exists and works — only needs to be split into preview vs commit modes
- `calculateCommission` already returns the correct dollar amount for ACA — display issue is purely a rendering layer concern in `AgentCard.tsx` / print template
- Phase 40's carryover infrastructure (`holdFromCarryover`, `holdLabel`, `carryoverSourcePeriodId`) gives us the metadata needed to safely reverse a prior carryover

### Established Patterns
- All routes use `asyncHandler` + Zod schemas with `zodErr()` wrapper
- Sensitive operations call `logAudit()` — unlock/relock and round-robin advancement should follow this pattern
- ACA flat commission is computed via `flatCommission × memberCount`, with `memberCount` defaulting to 1 ([payroll.ts:107](apps/ops-api/src/services/payroll.ts#L107))
- Manager entry uses inline CSSProperties — display fixes follow existing constant-object pattern (`CARD`, `BTN`, etc.)

### Integration Points
- Round-robin cursor advancement must happen inside the same Prisma transaction as the chargeback/pending-term insert so it rolls back atomically on failure
- Carryover unlock-reversal must run BEFORE the period status flips back to OPEN, inside the same PATCH handler
- ACA entry fix likely touches both the sale creation route AND the form submission payload — coordinate so that the parent sale + addons + ACA covering are persisted as a coherent unit

</code_context>

<specifics>
## Specific Ideas

- The user specifically wants the ACA entry to look "just like any other products" — flat number under the Commission column, no breakdown math text
- The user is OK with both Path A and Path B fixes for the front carryover bug ("just make sure both paths work") — investigation-led plan is appropriate
- The CS round-robin fix should be the cleanest version: server-side preview-vs-commit split, no TTL/reservation complexity

</specifics>

<deferred>
## Deferred Ideas

- Reservation-based round-robin with TTL cleanup — explicitly rejected as too complex
- Submit-time-only assignment with no preview UI — explicitly rejected; preview must remain so payroll can override before submitting
- Blocking unlock once carryover has run — explicitly rejected; payroll needs the ability to unlock to fix mistakes

</deferred>

---

*Phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no*
*Context gathered: 2026-04-07*
