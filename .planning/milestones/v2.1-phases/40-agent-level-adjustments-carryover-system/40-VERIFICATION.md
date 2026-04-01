---
phase: 40-agent-level-adjustments-carryover-system
verified: 2026-04-01T00:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification: false
---

# Phase 40: Agent-Level Adjustments + Carryover System — Verification Report

**Phase Goal:** Move bonus/fronted/hold to agent-period level, implement carryover on period lock, fix net formula (fronted additive), fix approval button logic, fix print pill positioning, and provide editable carryover labels with zero-sales agent card support.
**Verified:** 2026-04-01
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Net formula is `Commission + Bonus + Fronted - Hold` everywhere | ✓ VERIFIED | `payroll.ts:355` `+ bonus + fronted - hold`; `routes/payroll.ts:225` `+ bonus + fronted - hold`; `PayrollPeriods.tsx:908` `+ headerFronted - headerHold`; print net `agentGross + agentBonus + agentFronted - agentHold` at line 1413 |
| 2 | Approve button appears when halvingReason exists and commissionApproved is false | ✓ VERIFIED | `PayrollPeriods.tsx:289` `const needsApproval = !!entry.halvingReason && !entry.sale?.commissionApproved` |
| 3 | Unapprove button appears when halvingReason exists and commissionApproved is true | ✓ VERIFIED | `PayrollPeriods.tsx:290` `const isApproved = !!entry.halvingReason && !!entry.sale?.commissionApproved` |
| 4 | Print pills appear LEFT of commission amount | ✓ VERIFIED | `PayrollPeriods.tsx:1459` `${commFlagHtml}$${Number(e.payoutAmount).toFixed(2)}` — pill before dollar sign |
| 5 | Approved sales show green Approved pill in print view after approval | ✓ VERIFIED | `PayrollPeriods.tsx:1440-1442` `if (e.halvingReason && e.sale?.commissionApproved)` pushes `pill-approved` class |
| 6 | AgentPeriodAdjustment table exists with unique agent+period constraint | ✓ VERIFIED | `schema.prisma:682-702` `model AgentPeriodAdjustment` with `@@unique([agentId, payrollPeriodId])` and `@@map("agent_period_adjustments")` |
| 7 | Entry-level values are migrated to new table and zeroed out | ✓ VERIFIED | `migration.sql:32-53` contains `INSERT INTO agent_period_adjustments … FROM payroll_entries` and `UPDATE payroll_entries SET bonus_amount = 0` |
| 8 | Locking a period creates hold in next period equal to fronted amount | ✓ VERIFIED | `carryover.ts:51-53` `carryHold += Number(adj.frontedAmount)` — tested in CARRY-02 test |
| 9 | If agent net is negative on lock, the negative amount also carries as hold | ✓ VERIFIED | `carryover.ts:55-57` `if (agentNet < 0) carryHold += Math.abs(agentNet)` — tested in CARRY-03 test |
| 10 | Carryover adds to existing hold (does not overwrite) | ✓ VERIFIED | `carryover.ts:73` `holdAmount: { increment: carryHold }` — tested in CARRY-07 test |
| 11 | Locking the same period twice does not duplicate carryover | ✓ VERIFIED | `carryover.ts:20` `if (period.carryoverExecuted) return { carried: 0, skipped: true }` — tested in CARRY-06 test |
| 12 | AgentPeriodAdjustment values are editable via PATCH endpoint | ✓ VERIFIED | `routes/payroll.ts:247` `router.patch("/payroll/adjustments/:id"` with Zod validation for bonusAmount, frontedAmount, holdAmount, bonusLabel, holdLabel |
| 13 | Bonus/hold labels show carryover source and are editable inline | ✓ VERIFIED | `PayrollPeriods.tsx:199-243` `function EditableLabel` with click-to-edit, `role="button"`, `tabIndex={0}`, carryover color props |
| 14 | "Carried from prev week" text appears below inputs when from carryover | ✓ VERIFIED | `PayrollPeriods.tsx:245-252` `function CarryoverHint` renders `"Carried from prev week"` — used at lines 852 and ~900 |
| 15 | Agent cards appear even with zero sales if agentAdjustment exists | ✓ VERIFIED | `PayrollPeriods.tsx:1660-1666` iterates `p.agentAdjustments` to populate `byAgent` map for zero-sales agents |
| 16 | halvingReason is preserved on entries even after commission approval | ✓ VERIFIED | `payroll.ts:177-179` bundle check has no `!sale.commissionApproved` guard; `applyEnrollmentFee` returns `feeHalvingReason` unconditionally at line 80; halving gated at line 206 `(combinedReason && !sale.commissionApproved)` |

**Score:** 16/16 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | AgentPeriodAdjustment model + carryoverExecuted on PayrollPeriod | ✓ VERIFIED | Model at line 682 with all required fields, `@@unique([agentId, payrollPeriodId])`, `@@map("agent_period_adjustments")`; `carryoverExecuted` on PayrollPeriod at line 279 |
| `prisma/migrations/20260401000000_add_agent_period_adjustments/migration.sql` | Creates table + data migration + zero-out | ✓ VERIFIED | `CREATE TABLE "agent_period_adjustments"`, unique index, FK constraints, data INSERT, zero-out UPDATE all present |
| `apps/ops-api/src/services/payroll.ts` | Fixed net formula + halvingReason preservation | ✓ VERIFIED | Line 355: `+ bonus + fronted - hold`; halvingReason always collected, halving gated at line 206 |
| `apps/ops-api/src/services/carryover.ts` | executeCarryover with idempotent logic | ✓ VERIFIED | Exports `executeCarryover`, 89 lines, substantive implementation with all carryover logic |
| `apps/ops-api/src/services/__tests__/carryover.test.ts` | 6 test cases for CARRY-02/03/06/07 | ✓ VERIFIED | 174 lines, 6 describe blocks with spec ID banners: CARRY-02, CARRY-03, CARRY-06, CARRY-07, plus 2 additional cases |
| `apps/ops-api/src/routes/payroll.ts` | Period lock triggers carryover + adjustment CRUD endpoints | ✓ VERIFIED | `executeCarryover` imported at line 6; called at lines 47-55 on LOCKED status; GET/PATCH/POST adjustment routes at lines 237-311 |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` | EditableLabel, CarryoverHint, zero-sales cards, adjustment-backed inputs | ✓ VERIFIED | All components present: EditableLabel (line 199), CarryoverHint (line 245), AgentAdjustment type (line 36), handleHeaderBlur patching adjustments endpoint (line 710+), byAgent agentAdjustments loop (line 1661) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `prisma/schema.prisma` | `agent_period_adjustments` table | `prisma migrate` | ✓ WIRED | Migration file exists with `CREATE TABLE`, unique index on `(agent_id, payroll_period_id)` |
| `apps/ops-api/src/services/payroll.ts` | net formula | `calculateCommission` / `upsertPayrollEntryForSale` | ✓ WIRED | Line 355: `payoutAmount + adjustment + bonus + fronted - hold` uses `+ fronted` |
| `apps/ops-api/src/routes/payroll.ts` | `apps/ops-api/src/services/carryover.ts` | `import executeCarryover` + call on LOCKED | ✓ WIRED | Import at line 6; `if (parsed.data.status === "LOCKED")` with `executeCarryover(pp.data.id)` at lines 47-49 |
| `apps/ops-api/src/services/carryover.ts` | `prisma.agentPeriodAdjustment` | `upsert` with increment | ✓ WIRED | Line 62: `prisma.agentPeriodAdjustment.upsert` with `update: { holdAmount: { increment: carryHold } }` |
| `PayrollPeriods.tsx` | `/api/payroll/adjustments/:id` | `authFetch PATCH on adjustment blur/save` | ✓ WIRED | Lines 725 and 737: `authFetch(\`${API}/api/payroll/adjustments\`` for POST (new) and `authFetch(\`${API}/api/payroll/adjustments/${adjustment.id}\`` for PATCH |
| `PayrollPeriods.tsx byAgent map` | `period.agentAdjustments` | merge agents from adjustments | ✓ WIRED | Lines 1661-1665: `for (const adj of p.agentAdjustments)` adds agents to byAgent |
| `GET /payroll/periods` | `agentAdjustments` in response | Prisma include | ✓ WIRED | `routes/payroll.ts:14-16` includes `agentAdjustments` with agent name |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CARRY-01 | 40-01-PLAN | Bonus/fronted/hold stored at agent+period level (new AgentPeriodAdjustment table) | ✓ SATISFIED | `schema.prisma` AgentPeriodAdjustment model + migration; entry-level fields zeroed out in data migration |
| NET-01 | 40-01-PLAN | Net formula: Commission + Bonus + Fronted - Hold | ✓ SATISFIED | 4 locations corrected: `payroll.ts:355`, `routes/payroll.ts:225`, dashboard `liveNet:908`, print `agentNet:1413` |
| FIX-06 | 40-01-PLAN | Approve/Unapprove button based on halvingReason (not enrollment fee threshold) | ✓ SATISFIED | `PayrollPeriods.tsx:289-290` uses `!!entry.halvingReason`; period-level filter at line 1648 uses same pattern |
| FIX-07 | 40-01-PLAN | Print view pills positioned left of commission amount | ✓ SATISFIED | `PayrollPeriods.tsx:1459` `${commFlagHtml}$${Number(e.payoutAmount).toFixed(2)}` |
| FIX-08 | 40-01-PLAN | Approved sales show green Approved pill in print view | ✓ SATISFIED | `PayrollPeriods.tsx:1440-1442` halvingReason + commissionApproved check pushes `pill-approved` |
| CARRY-02 | 40-02-PLAN | Fronted auto-carries as hold in next period on lock | ✓ SATISFIED | `carryover.ts:52`; CARRY-02 test passes |
| CARRY-03 | 40-02-PLAN | Negative net carries as hold in next period | ✓ SATISFIED | `carryover.ts:55-57`; CARRY-03 test passes |
| CARRY-04 | 40-02-PLAN | Carryover amounts editable via PATCH endpoint | ✓ SATISFIED | `routes/payroll.ts:247` PATCH `/payroll/adjustments/:id` with Zod validation |
| CARRY-05 | 40-03-PLAN | Bonus/hold labels show carryover source, editable inline | ✓ SATISFIED | `EditableLabel` component with `carryoverColor` prop at lines 822/873; green for bonus (`C.success`), orange for hold (`C.warning`) |
| CARRY-06 | 40-02-PLAN | Carryover idempotent — no duplicates on re-lock | ✓ SATISFIED | `carryover.ts:20` checks `period.carryoverExecuted`; CARRY-06 test verifies early return |
| CARRY-07 | 40-02-PLAN | Carryover adds to existing values (does not overwrite) | ✓ SATISFIED | `carryover.ts:73` `holdAmount: { increment: carryHold }`; CARRY-07 test verifies |
| CARRY-08 | 40-03-PLAN | Agent cards appear with zero sales if carryover exists | ✓ SATISFIED | `PayrollPeriods.tsx:1660-1666` adds agents from `agentAdjustments` into `byAgent` map |
| CARRY-09 | 40-03-PLAN | "Carried from prev week" hint text below carryover inputs | ✓ SATISFIED | `CarryoverHint` component at line 245; renders text; used at line 852 with `show={!!adjustment?.bonusFromCarryover && Number(headerBonus) > 0}` |

All 13 requirements across all 3 plans: ✓ SATISFIED (13/13)

---

## Anti-Patterns Found

No blocker or warning-level anti-patterns found in phase-modified files.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `apps/ops-api/src/services/payroll.ts` | `upsertPayrollEntryForSale` reads entry-level `bonusAmount/frontedAmount/holdAmount` to preserve net | Info | Intentional design: entry-level fields are zeroed post-migration so these values will be 0; agent-level values live in `AgentPeriodAdjustment`. No functional impact. |
| `apps/ops-api/src/services/carryover.ts` | `(period as any).entries` cast | Info | `entries` not included in Prisma `PayrollPeriod` type but added via `include` at runtime. Type cast is a minor compromise, not a functional issue. |

---

## Human Verification Required

The following items were user-verified during Phase 40 execution (documented in 40-03-SUMMARY.md Task 2):

1. **Net formula (fronted additive)** — Verified: fronted adds to net, not subtracts.
2. **Approval buttons (halvingReason-based)** — Verified: Approve/Unapprove buttons appear based on halvingReason.
3. **Print view pills (left of commission)** — Verified: pills appear left of commission amount.
4. **Carryover flow** — Verified: fronted carries as hold on period lock.
5. **Editable labels** — Verified: click-to-edit with keyboard save.
6. **Zero-sales agent cards** — Verified: cards appear for agents with carryover but no sales.
7. **Idempotency** — Verified: lock/unlock does not duplicate carryover.

No outstanding human verification items remain.

---

## Gaps Summary

No gaps. All 16 observable truths verified, all 7 required artifacts confirmed substantive and wired, all 7 key links confirmed connected, all 13 requirement IDs satisfied. Phase goal achieved in full.

---

_Verified: 2026-04-01_
_Verifier: Claude (gsd-verifier)_
