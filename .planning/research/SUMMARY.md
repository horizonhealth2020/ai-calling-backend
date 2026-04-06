# Project Research Summary

**Project:** Ops Platform v2.1 — Payroll Card Overhaul & Carryover System
**Domain:** Internal payroll management — agent commission tracking, period management, print formatting
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

This milestone is a focused improvement to the existing payroll subsystem with no new dependencies required. All 10 features map to changes in existing files using established patterns: Prisma migrations for schema additions, Express route hooks for carryover logic, React component refactoring for card restructuring, and template string edits for print enhancements. The recommended approach is to sequence work in dependency order — deliver unblocked quick wins first, then the carryover system with its schema migration, and finally the large UI restructure once the data shape is stable.

The highest-risk feature is the fronted/hold auto-carryover system. It introduces cross-period data dependencies that interact with clawbacks, mark-paid logic, and period status toggling. The primary structural challenge is that PayrollEntry requires a non-nullable `saleId` FK, but carryover is an agent-level concept with no natural sale to attach to. This must be resolved before Phase 3 implementation — either via a sentinel $0 sale per agent or by making `saleId` nullable. Additionally, carryover must be idempotent: payroll staff routinely unlock and re-lock periods, and duplicate carryover entries would silently corrupt agent net amounts.

The card restructure (agent-level collapsible cards with week-by-week entries) is the largest UI change, touching roughly 800 lines of the 1,800-line PayrollPeriods.tsx component. It should come last, after carryover logic stabilizes, to avoid double-refactoring. The print template lives outside the React component tree as a template literal, meaning it must be updated in the same phase as screen layout changes or the two will diverge.

## Key Findings

### Recommended Stack

No new libraries or packages are required for this milestone. Every feature maps to the existing stack. Prisma handles the two schema additions; Express routes and Zod schemas handle the carryover endpoint and bonus label patch; all UI work uses React with inline CSSProperties. The print system continues to use the `window.open` + template literal pattern. The only infrastructure change is one Prisma migration.

**Core technologies:**
- Next.js 15 / React 18: Dashboard UI — no change, all features are component refactors using existing patterns
- Express 4 + Zod 3: API layer — extend existing PATCH endpoints and Zod schemas only; new carryover service function added
- Prisma 5 + PostgreSQL: Data layer — one migration adding `bonusLabel` (String, nullable) and `isCarryover` (Boolean, default false) to PayrollEntry
- Luxon 3: Date math for next-period calculation in carryover service — already used for `getSundayWeekRange`
- Socket.IO 4: Real-time push after carryover entries are created — already wired to payroll:updated event

### Expected Features

**Must have (table stakes):**
- Zero-value validation bug fix — staff cannot zero out bonus/fronted/hold once set; blocks daily payroll workflow
- Fronted displayed as positive — negative display confuses readers; net formula unchanged, display-only change
- Net column removed from print card sale rows — per-sale net is misleading when bonus/fronted/hold are agent-level
- Approved pill on half-commission deals in print view — payroll needs visibility on which half-commission overrides were approved
- Addon name formatting cleanup — long addon names with parenthetical details overflow print table cells
- ACA editable in Products tab — ACA_PL products exist in DB but are excluded from Products UI type maps; staff cannot configure flat commissions

**Should have (differentiators):**
- Fronted/hold auto-carryover between pay periods — eliminates error-prone manual re-entry each period; highest complexity feature
- Editable bonus label — distinguishes "Bonus" from "Hold Payout" on pay cards; auto-set by carryover, manually editable otherwise
- Bonus/fronted/hold inputs moved to agent-level only — per-sale inputs imply wrong semantics; agent card header is correct home
- Payroll cards restructured as agent-level collapsible cards — week-by-week grouping inside collapsible agent sections

**Defer (v2+):**
- Carryover reversal automation — cascading audit complexity; manual adjustment covers the need
- Carryover chain tracking (linked-list provenance) — bonusLabel + audit log is sufficient for current requirements
- Custom print templates — internal tool does not need a configurable template editor

### Architecture Approach

The system follows a service-layer pattern: business logic lives in `payroll.ts` service, exposed via Express routes, consumed by a single large React dashboard component. The carryover feature is best implemented as a new `processCarryover(periodId)` service function called as a hook inside the existing `PATCH /payroll/periods/:id/status` route on LOCKED transitions, wrapped in a Prisma transaction for atomicity. Agent-level grouping in the UI is achieved via a `useMemo` reduce over period entries, using the existing expand/collapse state pattern already present for period cards. The print template must be updated in lockstep with card restructuring because it is separate template literal code, not React.

**Major components:**
1. `payroll.ts` service — Commission calc, period management, entry upsert; new `processCarryover()` added here with idempotency guard
2. `payroll.ts` routes — CRUD endpoints, status transitions; carryover hook on LOCKED transition and bonus label patch extension
3. `PayrollPeriods.tsx` — Full payroll UI targeting agent grouping refactor, input relocation, and print template updates; sub-components extracted before restructuring
4. `PayrollProducts.tsx` — Product CRUD; extend TYPE_LABELS and TYPE_COLORS maps to include ACA_PL
5. Prisma schema + migration — Add `bonusLabel` String? and `isCarryover` Boolean to PayrollEntry

### Critical Pitfalls

1. **Carryover duplication on period re-lock** — Add `isCarryover` boolean flag to PayrollEntry; check for existing carryover entries before creating new ones on each LOCKED transition. Without idempotency, agents receive double holds or double bonus payouts with no visible indicator.
2. **Agent with no sales in next period blocks carryover** — PayrollEntry has non-nullable `saleId` with unique constraint on `(payrollPeriodId, saleId)`. Carryover for salesless agents fails unless: (A) sentinel $0 sale is created, or (B) `saleId` is made nullable. Choose one approach before Phase 3 begins; mixing creates inconsistent data.
3. **Zero-value bug is client-side, not API-side** — Zod schema correctly allows `.min(0)`. The bug is a falsy check in the save handler (`if (value)` excludes `0`). Fix: use `value !== undefined` and always include zero-value fields in the PATCH body.
4. **PeriodCard refactor regressions** — The 1,800-line component has interleaved concerns: period rendering, sale editing, bonus/fronted/hold inputs, mark paid, print, status requests, chargeback alerts. Extract AgentCard, SaleRow, AgentSummary before restructuring. Test with manual checklist: sale editing, mark paid, print, chargeback alerts, status change requests.
5. **Print template diverges from screen layout** — Print HTML is separate template literal code. If card restructure and print updates are in different phases, they will diverge silently. Always update print in the same phase as screen layout changes.

## Implications for Roadmap

Based on combined research, the feature dependency graph and risk profile suggest four phases:

### Phase 1: Quick Fixes
**Rationale:** All six items are independent, require no migration, touch only display and validation logic, and unblock daily payroll workflow immediately.
**Delivers:** Fully functional current payroll workflow without display bugs or blocked inputs.
**Addresses:** Zero-value validation bug, fronted positive display, net column removed from print, approved pill on print, addon name formatting, fronted label clarity.
**Avoids:** Zero-value client-side falsy pitfall — fix requires `value !== undefined` check in save handler, not a Zod or API change.

### Phase 2: ACA Product Configuration
**Rationale:** Independent of carryover and card restructure. Medium effort contained to PayrollProducts.tsx and type maps. Best completed before the larger refactors to avoid merge conflicts on type map additions.
**Delivers:** Staff can view and configure ACA_PL products and their flat commissions via the Products tab.
**Addresses:** ACA_PL missing from TYPE_LABELS, TYPE_COLORS, product form field conditionals.
**Avoids:** Pitfall 8 — search entire codebase for all ProductType hardcodes before declaring done, not just PayrollProducts.tsx.

### Phase 3: Agent-Level Adjustments + Carryover System
**Rationale:** Carryover depends on agent-level input structure being finalized first (bonus/fronted/hold on agent header only). Bonus label field uses the same migration. Isolating this from the card restructure keeps the blast radius small and allows the carryover data shape to stabilize before the UI is rebuilt around it.
**Delivers:** Fronted/hold amounts auto-carry to next period on lock; bonus label field distinguishes payout types; per-sale adjustment inputs removed.
**Uses:** Prisma migration (bonusLabel, isCarryover), new `processCarryover()` service, PATCH entry bonus label extension, Socket.IO payroll:updated emission.
**Implements:** Carryover as period-lock hook with Prisma transaction, idempotency via isCarryover flag, sentinel sale or nullable saleId for agents without sales.
**Avoids:** Pitfall 1 (duplication on re-lock), Pitfall 3 (no-sale agents), Pitfall 5 (clawback orphaning hold entries on CLAWBACK_APPLIED status).

### Phase 4: Payroll Card Restructure
**Rationale:** Depends on Phase 3 being complete so new agent-level collapsible cards can correctly display carryover metadata and bonusLabel. Restructuring before carryover is stable risks building the card layout twice. This is the largest UI refactor.
**Delivers:** Agent-level collapsible cards with week-by-week sale grouping; print template aligned to new layout; formatAddonName shared utility used by both screen and print.
**Uses:** React useMemo groupBy pattern, existing ChevronDown expand/collapse, formatAddonName shared utility.
**Implements:** AgentCard, SaleRow, AgentSummary sub-components extracted first, then PeriodCard restructured to compose them.
**Avoids:** Pitfall 4 (1,800-line component regression — extract first, restructure second), Pitfall 6 (print template divergence — update print in this same phase), Pitfall 9 (addon formatting inconsistency — shared utility covers both screen and print).

### Phase Ordering Rationale

- Quick fixes first: all six are independent with no schema changes; unblock payroll staff with zero regression risk
- ACA second: independent of everything; completing before larger refactors avoids merge conflicts on type maps
- Carryover third: schema migration and service logic isolated from UI restructure; idempotency and saleId issues are easier to test without simultaneous UI churn
- Card restructure last: built on stable carryover data; print template updated in same phase; sub-component extraction reduces regression risk significantly

### Research Flags

Phases with standard patterns (research-phase not needed):
- **Phase 1:** All fixes are display/validation changes with clear root causes identified from direct codebase analysis
- **Phase 2:** ACA product type addition follows the existing ProductCard CRUD pattern exactly
- **Phase 4:** Expand/collapse pattern and agent groupBy are established React patterns already present in the codebase

Phases likely needing deeper design decisions during planning:
- **Phase 3 (Carryover):** The `saleId` nullability decision requires auditing all downstream code paths that assume `saleId` is non-null before choosing between sentinel sale vs nullable saleId. The clawback interaction with orphaned hold entries also needs a concrete policy resolution before implementation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Directly verified against package.json, schema.prisma, and all source files. No inference — no new dependencies means no compatibility uncertainty. |
| Features | HIGH | Features derived from direct codebase analysis of PayrollPeriods.tsx, PayrollProducts.tsx, and payroll service. Bug root causes confirmed with line-level references. |
| Architecture | HIGH | Carryover pattern, groupBy approach, and print template structure all directly verified in source. Edge cases identified with concrete mitigation options. |
| Pitfalls | HIGH | All pitfalls grounded in specific code locations (line numbers cited). No speculation — schema constraints and operator behavior verified directly. |

**Overall confidence:** HIGH

### Gaps to Address

- **saleId nullable vs sentinel sale:** Both options for handling agents with no sales in the next period are viable. The choice affects migration scope and downstream code assumptions. Requires auditing all `entry.saleId` and `entry.sale` references before Phase 3 planning to make a firm decision.
- **Carryover UI indicators:** Research describes the data flow for carryover but does not prescribe the exact UI treatment for indicating a carryover entry on the pay card (badge, label, icon, or tooltip). This is a design decision for Phase 3 planning.
- **Fronted positive display treatment:** The fronted-as-positive change (Phase 1) needs a specific label and visual treatment decided upfront to avoid the mental model mismatch where readers might expect fronted to add to net. Recommendation: use `$200.00 (advanced, deducted from net)` with a distinct color.
- **Carryover with pre-paid entries in next period:** If an agent's entries in the next period are already PAID when carryover runs, the carryover amounts cannot be applied without first un-paying. This edge case needs a policy decision before Phase 3 implementation.

## Sources

### Primary (HIGH confidence)

- `prisma/schema.prisma` — PayrollEntry model, ProductType enum, saleId uniqueness constraint
- `apps/ops-api/src/services/payroll.ts` — Commission calculation, getSundayWeekRange, upsertPayrollEntryForSale
- `apps/ops-api/src/routes/payroll.ts` — PATCH endpoints, Zod schemas, period status toggle, net formula (line 206), PATCH handler `??` operator (lines 186-214)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — 1,800-line component, print template strings, expand/collapse state pattern
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` — Product type maps, CRUD pattern
- `package.json`, `apps/ops-api/package.json`, `apps/ops-dashboard/package.json` — Dependency versions confirmed

### Secondary (MEDIUM confidence)

- `.planning/PROJECT.md` — Project scope and milestone description

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
