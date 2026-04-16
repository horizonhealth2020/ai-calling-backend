---
phase: 79-chargeback-gate-and-display
topic: CS-chargeback premature paycard application + cross-period display + MyQueue rep-linkage regression
depth: standard
confidence: HIGH
created: 2026-04-16
updated: 2026-04-16
---

# Discovery: Chargeback Approval Gate + Paycard Display + MyQueue Rep Linkage

**Recommendation:** Split into two phases (79 + 80). Phase 79 = chargeback approval gate + paycard display (5 fixes, one backend file + three frontend files + one shared util). Phase 80 = MyQueue rep-linkage reconciliation (data + UX + optional name-drift auto-resolve). No schema changes. Forward-only.

**Confidence:** HIGH — every bug located in code with exact line citations; no inference required. Fixes are local, non-cascading, and preserve existing alert-approval pipeline contract.

## User-confirmed decisions (2026-04-16)

1. CLAWBACK_CROSS_PERIOD row → RED; ZEROED_OUT_IN_PERIOD stays YELLOW (keep visually distinct)
2. Negative format: leading minus (`-$76.04`), not accounting parens
3. Scope expansion: MyQueue rep-visibility fix claimed shipped in Phase 77 (v3.1) is NOT working in production — add as Phase 80

## Objective

Five reported/observed symptoms; determine root causes and a safe fix ordering:

1. CS-submitted chargebacks deduct from agent paycard **before** payroll approval
2. Cross-period chargeback from prior closed week not deducted from agent net total
3. Cross-period chargeback row shows `$76.04` (positive), should show `-$76.04`
4. Cross-period chargeback row highlighted peach/orange, user wants red
5. Not yet surfaced by user — possible Phase 71 formula residue in `PayrollPeriods.tsx` sidebar net

## Scope

**Include:**
- Chargeback submission flow (`apps/ops-api/src/routes/chargebacks.ts`)
- Alert approval flow (`apps/ops-api/src/services/alerts.ts`)
- Paycard display (`apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx`, `PayrollPeriods.tsx`)
- Shared utility (`packages/utils/src/index.ts`)

**Exclude:**
- Schema changes (no migration needed)
- Payroll-direct chargebacks (`source: "PAYROLL"`) — they ARE the approver, keep immediate-apply
- Historical data backfill — forward-only, existing Clawbacks remain untouched

## Findings

### Bug 1 — CS chargeback applies to paycard BEFORE approval (PRIMARY)

**Location:** `apps/ops-api/src/routes/chargebacks.ts:258-310`

**What happens today** (inside the POST /chargebacks transaction, regardless of `source`):
- For every `matchStatus === "MATCHED"` chargeback:
  - Creates a `Clawback` row (line 292-303) with `status: "ZEROED"` and `matchedBy: "member_id"` / `"member_name"`
  - Calls `applyChargebackToEntry(...)` (line 306-310) which **mutates the paycard** — zeroes the original entry in-period OR inserts a `CLAWBACK_CROSS_PERIOD` negative row cross-period

**Then, outside the tx** (line 396-405): if `source === "CS"`, creates a `PayrollAlert` with `status: "PENDING"`. But the paycard mutation has already committed.

**Approval at `alerts.ts:approveAlert`** (line 40-266) then tries to create a new Clawback, but the dedupe guard at line 173-203 finds the existing one (line 179-187 matches `matchedBy: "member_id"` / `"member_name"`) and just flips the alert `status: "APPROVED"` — no new paycard mutation occurs.

**Smoking-gun comment at `alerts.ts:156-158`:**
> `// 46-02: Also catch clawbacks created directly by the chargeback POST handler`
> `// (matchedBy "member_id" / "member_name"), which fire BEFORE any alert approval.`

The code is self-documenting this inversion. Alert approval is purely cosmetic for CS-submitted MATCHED chargebacks today.

**Source:** direct code read (2026-04-16). Fix is surgical — gate the Clawback+applyChargebackToEntry block inside the transaction on `source !== "CS"`.

---

### Bug 2 — `formatDollar` strips the sign

**Location:** `packages/utils/src/index.ts:2-7`

```ts
/** Format a number as $X,XXX.XX (always positive, 2 decimal places) */
export function formatDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US", {...});
}
```

The docstring explicitly says "always positive". `Math.abs(n)` swallows the sign. `formatDollar(-76.04)` → `"$76.04"`.

**Impact:** `WeekSection.tsx:411-414` renders the commission column using `formatDollar(netAmount)` when status is clawback. For Victoria's row, netAmount IS `-76.04` in the DB — it just renders without a minus. User sees `$76.04` (red text from `C.danger`, but no minus).

**Fix:** change `formatDollar` to preserve sign (render `-$76.04` or `($76.04)` accounting-style), OR explicitly prepend minus for negative values. Risk: ~40+ call sites across the dashboard — any that pre-abs'd the value (e.g. for "held" as positive display) could show an unwanted minus. Need a callsite audit OR introduce a new variant (`formatDollarSigned`) and migrate the specific clawback display first.

**Recommendation:** Introduce `formatDollarSigned(n)` that renders the sign; use it in WeekSection line 412 + any negative-expected surface. Keep `formatDollar` legacy behavior to avoid regressions.

---

### Bug 3 — Cross-period chargeback NOT deducted from agent net / subtotal

**Locations:**
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:328` — per-agent per-period `gross = active.reduce((s, e) => s + Number(e.payoutAmount), 0)`
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:428` — current-period sidebar `gross = activeEntries.reduce((s, e) => s + Number(e.payoutAmount), 0)`
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:432` — `net = gross + bonus + fronted - hold`  ← missing `+ entryAdj`, AND uses Phase 71 `+ fronted` (see Bug 5)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:886` — print-view `agentGross = reduce(payoutAmount)`
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:892` — print-view `agentNet = gross + bonus + fronted - hold + entryAdj` (correct in print, wrong on screen)
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx:968` — `liveNet = agentGross + bonus - fronted - hold` ← missing `+ entryAdj`
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx:1047` — `Subtotal` td renders `formatDollar(agentGross)` only

**Why Victoria's $76.04 is neither added nor deducted:**
- Her CLAWBACK_CROSS_PERIOD row has `payoutAmount: 0, adjustmentAmount: -76.04, netAmount: -76.04` (per `applyChargebackToEntry` at `services/payroll.ts:539-549`)
- `gross = reduce(payoutAmount)` → 0 contribution from Victoria → $679.11 (other 7 rows)
- `liveNet = gross + bonus - fronted - hold` → never pulls `adjustmentAmount` → Victoria's -$76.04 is **lost**
- Subtotal td displays `agentGross` → $679.11, matching image

**Inconsistency:** the print view (`PayrollPeriods.tsx:886-892`) DOES include `+ agentEntryAdj`. On-screen and sidebar do NOT. Entry-level adjustments drift between surfaces.

**Fix:** thread `entryAdj = reduce(adjustmentAmount)` into:
- `pd.entryAdj` passed to WeekSection
- `liveNet` formula in WeekSection adds `+ entryAdj`
- Optional: show Subtotal as two numbers (gross, adjustments) or a single net-like cell

---

### Bug 4 — Row highlight color (user wants red, currently orange)

**Location:** `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx:140-145`

```ts
const rowBg: React.CSSProperties = entry.status === "CLAWBACK_CROSS_PERIOD"
    ? { backgroundColor: "rgba(251,146,60,0.10)", borderLeft: "3px solid rgba(251,146,60,0.6)" }   // orange
    : entry.status === "ZEROED_OUT_IN_PERIOD"
    ? { backgroundColor: "rgba(234,179,8,0.10)", borderLeft: "3px solid rgba(234,179,8,0.6)" }      // yellow
    : entry.status === "CLAWBACK_APPLIED"
    ? { backgroundColor: colorAlpha(semanticColors.statusDead, 0.08), ... }                         // red-ish
```

Image-observed peach/orange matches rgba(251,146,60) = orange-400. User wants red. `CLAWBACK_APPLIED` ALREADY uses `semanticColors.statusDead` (red) — so there's precedent.

**Fix:** change CLAWBACK_CROSS_PERIOD to `colorAlpha(semanticColors.statusDead, 0.10)` — aligns with CLAWBACK_APPLIED tint. Keeps ZEROED_OUT_IN_PERIOD yellow for in-period case (distinct visual state).

**Open question (user input needed):** do cross-period and in-period chargebacks share the same visual treatment (both red), or does in-period stay yellow? Current code distinguishes them. Ask before applying.

---

### Bug 5 (not yet user-surfaced) — Phase 71 residue in sidebar net

**Location:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:432`

```ts
const net = gross + bonus + fronted - hold;
```

Phase 78 formula is `gross + bonus - fronted - hold` (fronted DEDUCTS, not adds). STATE.md records Phase 78-03 fixed WeekSection `liveNet` and PATCH /payroll/entries/:id, but `PayrollPeriods.tsx:432` (sidebar net) is NOT in that decision log. Print-view at line 892 also has `+ agentFronted` (Phase 71).

**Impact:** sidebar net total may still be showing Phase 71 semantics. Bonus scope for this phase — cheap to fix while we're touching this file.

**Verification before fix:** grep for ALL live net-formula sites and enumerate; align all to Phase 78.

## Comparison

N/A — this is root-cause analysis of bugs, not a library choice.

## Recommendation

**Single phase (79), 5 atomic fixes in dependency order:**

| Order | Bug | File | Risk |
|-------|-----|------|------|
| 1 | Gate clawback creation on `source !== "CS"` | `routes/chargebacks.ts:258-310` | Medium — changes clawback lifecycle; add regression test |
| 2 | `formatDollarSigned()` helper + swap in WeekSection:412 | `packages/utils/src/index.ts` + `WeekSection.tsx:412` | Low — additive helper |
| 3 | Thread `entryAdj` into agent card net/subtotal | `PayrollPeriods.tsx:326-333` + `WeekSection.tsx:968,1047` | Medium — touches all agent cards; verify with 7-case payroll test |
| 4 | Align net-formula sites to Phase 78 | `PayrollPeriods.tsx:432,892` | Low — mechanical |
| 5 | Change CLAWBACK_CROSS_PERIOD tint to red | `WeekSection.tsx:141` | Trivial — ask user first if yellow IN_PERIOD stays |

**Rationale:**
- Fix 1 is the functional/correctness bug — without it, the approval gate is theater
- Fixes 2-4 are the display-layer math (net, subtotal, sign display) — they together explain "Victoria's $76.04 isn't showing as -$76.04 and isn't deducted"
- Fix 5 is visual preference — confirm color choice with user before applying

**Caveats:**
- Fix 1 flips the happy-path for CS chargebacks. Need an integration test: CS submits → Clawback NOT created → Alert created → Approve → Clawback created + paycard mutates.
- Fix 2 needs a call-site audit for `formatDollar(-…)` where the minus was intentionally hidden (e.g., "Hold: $100" display of a positive hold amount that was passed as negative). Low likelihood but worth a grep.
- Fix 3 — the print view already does the right thing. On-screen drifts. Changing on-screen to match print is the correct direction.

## Open Questions

- Cross-period chargeback row color: red (match CLAWBACK_APPLIED) or keep orange (distinct)? — Impact: **LOW** (visual only, trivial one-line swap)
- Should in-period ZEROED_OUT_IN_PERIOD also go red, or stay yellow? — Impact: **LOW** (visual; current code distinguishes them)
- Should the subtotal/Net rows display entry-level adjustments as a separate "Adjustments" line, or collapse into a single Net figure? — Impact: **MEDIUM** (UX shape of agent card header)
- For `formatDollar` sign display: leading-minus (`-$76.04`) or accounting parens (`($76.04)`)? — Impact: **LOW** (pick one, stay consistent)

## Quality Report

**Sources consulted (all direct code reads, 2026-04-16):**
- `apps/ops-api/src/routes/chargebacks.ts:61-447` — POST /chargebacks handler (source-agnostic clawback creation)
- `apps/ops-api/src/services/alerts.ts:1-285` — full alert approval flow + dedupe guard
- `apps/ops-api/src/services/payroll.ts:466-551` — `applyChargebackToEntry` in-period vs cross-period branches
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx:140-145,411-414,596-597,876-877,964-973,1044-1048` — row rendering, subtotal, liveNet
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:326-333,427-432,886-892` — per-agent gross + entryAdj + sidebar net + print view
- `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx:152-158` — prop threading
- `packages/utils/src/index.ts:1-8` — `formatDollar` definition
- `prisma/schema.prisma:315-338,395-428,709-731` — PayrollEntry, Clawback, AgentPeriodAdjustment schemas
- `image.png` (repo root) — user-provided payroll screenshot showing Victoria Checkal row

**Verification:**
- Bug 1 premature application: Verified via `chargebacks.ts:292-310` + `alerts.ts:156-158` self-documenting comment + dedupe guard at `alerts.ts:173-203`
- Bug 2 sign-stripping: Verified via `formatDollar` definition — `Math.abs(n)` is explicit
- Bug 3 entryAdj omission: Verified via grep of net/gross formulas — `PayrollPeriods.tsx:432` + `WeekSection.tsx:968` lack `+ entryAdj`; print-view `:892` has it
- Bug 4 orange-not-red: Verified via `WeekSection.tsx:141` hex → rgba(251,146,60) = Tailwind orange-400
- Bug 5 Phase 71 residue: Verified via `PayrollPeriods.tsx:432,892` showing `+ fronted` (Phase 71) vs WeekSection `:968` using `- fronted` (Phase 78)

**Assumptions (not verified):**
- Victoria Checkal's sale is in a prior LOCKED period (making this a cross-period scenario). Alternative: she's in this OPEN week and got ZEROED_OUT_IN_PERIOD — in that case the peach row would be yellow, not orange. The image peach tint more closely matches orange-400 than yellow-500, supporting cross-period. SQL query against production can confirm Victoria's sale.payrollPeriodId status.
- Phase 71 residue at `PayrollPeriods.tsx:432` is still live, not superseded by a later patch I missed. Worth re-grepping all net formulas during planning.

---
*Discovery completed: 2026-04-16*
*Confidence: HIGH*
*Ready for: /paul:milestone (v3.2 scope) → /paul:plan 79-chargeback-gate-and-display*
