# Milestones

Completed milestone log for this project.

| Milestone | Completed | Duration | Stats |
|-----------|-----------|----------|-------|
| v3.1 CS + Payroll Gap Closure | 2026-04-16 | ~1 day | 2 phases, 4 plans, 15+ files |
| v3.0 Mobile-Friendly Dashboards | 2026-04-15 | ~2 days | 5 phases, 5 plans, 24 files |

---

## Note on pre-v3.0 milestones

MILESTONES.md was created at v3.0 closure. Prior milestones (v1.0 through v2.9.2) are recorded in:
- `.paul/ROADMAP.md` — per-milestone sections with phase tables
- `.paul/PROJECT.md` — "Validated (Shipped)" section with requirement-level detail
- Git tags (v1.0 through v2.2 only — later tags were skipped)

---

## ✅ v3.1 CS + Payroll Gap Closure

**Completed:** 2026-04-16
**Duration:** ~1 day (2026-04-16)

### Stats

| Metric | Value |
|--------|-------|
| Phases | 2 (77 CS Fixes, 78 Payroll Polish + Fronted Fix) |
| Plans | 4 (77-01, 78-01, 78-02, 78-03) |
| Files changed | ~15 unique (schema, migrations, API routes, dashboard components) |
| Tests | 186 passing (from 184 at v3.0 + 2 net new) |
| Audit rounds | 3 enterprise audits (one per 78-0x plan); avg 3.3 fixes applied |

### Key Accomplishments

- **CS rep identity fixed**: `User.csRepRosterId` FK links CUSTOMER_SERVICE logins to `CsRepRoster` entries — MyQueue and stale alerts now resolve the correct rep by DB lookup (not fragile name-string match). All 6 active CS reps can see their queues.
- **Submission-time soft dedupe**: Composite-key dedupe `(memberCompany, memberId, postedDate)` on POST /chargebacks and `(memberName, memberId, holdDate)` on POST /pending-terms — server-side, no DB index; batch returns `duplicates[]` array; 409 for single-record all-dupes.
- **Fronted formula corrected**: `Net = payout + adj + bonus - hold - fronted` (reversed Phase 71 carry-to-next-period semantics). Same-week deduction eliminates the multi-week double-hit. 9-case test suite locks the formula. carryover.ts D-09 removed; D-10 (negative-net carry) preserved.
- **Sale edit bugs fixed**: HTML `<input type="number">` returns strings; Zod z.number() rejected them — fixed with parseFloat coercion in saveEdit(). Per-addon premium inputs added to edit form. CHANGES display fixed (JSON.stringify vs String()).
- **Unapprove gated**: Server-side 400 + logAudit when period is LOCKED/FINALIZED; client hides button. Defense in depth.
- **Payroll week note box**: `AgentPeriodAdjustment.notes` schema field, migration, POST endpoint, textarea in WeekSection (blur-save, print-hidden when empty).
- **ACH full-row print green**: `print-color-adjust: exact` on both `tr[data-ach="true"]` and `tr[data-ach="true"] td` — browser print mode strips `tr` backgrounds without this flag.
- **CS payroll print per-agent cards**: Restructured from shared table to per-agent cards with agent name right-aligned on same line as "Customer Service Payroll"; page breaks between agents.
- **Phase 78 formula leaked to routes**: Discovered and fixed liveNet display in WeekSection + `PATCH /payroll/entries/:id` both still used Phase 71 formula (fronted additive). Fixed as bonus scope.

### Key Decisions

- CS rep identity resolved via DB lookup at request time (not JWT payload) — JWT is signed at login and won't carry new fields until session refresh
- TOCTOU window accepted for soft dedupe — CS reps paste manually at human pace; no DB index needed
- Fronted deduction is forward-only — existing locked/finalized entries retain Phase 71 semantics; OPEN periods at deployment have mixed semantics (documented)
- CS print restructured: per-agent card layout with name on header line (not table cell) — matches "top and center" UX intent
- print-color-adjust: exact is a permanent pattern for any table row background in print context

---

## v3.0 Mobile-Friendly Dashboards

**Completed:** 2026-04-15
**Duration:** ~2 days (2026-04-14 → 2026-04-15)

### Stats

| Metric | Value |
|--------|-------|
| Phases | 5 (72 Foundation, 73 Manager, 74 Payroll, 75 Owner, 76 CS) |
| Plans | 5 |
| Files changed | 24 unique (3 created in @ops/ui, 21 modified across ops-dashboard + @ops/ui) |
| Phase durations | 72: ~45min, 73: ~30min, 74: ~30min, 75: ~15min, 76: ~45min |
| Audit rounds | 5 enterprise audits; avg 4.2 fixes applied per plan |

### Key Accomplishments

- Unified breakpoint tokens + SSR/hydration-safe responsive hooks (`useBreakpoint`, `useIsMobile`, `useHasMounted`) shipped as @ops/ui primitives with explicit `mobileMax`/`tabletMin`/`tabletMax`/`desktopMin`/`wideMin` naming
- Accessible `MobileDrawer` primitive: focus trap, scroll-lock correctness, prefers-reduced-motion respect, required `ariaLabel` enforced at the TypeScript type level — zero new runtime deps
- Extended `responsive.css` utility library: `.touch-target`, `.bottom-sheet-base`, `.mobile-text-*`, `.stack-mobile-md`, `.responsive-table-no-label` escape valve for action cells + colspan rows
- Dashboard nav refactored to hamburger+drawer on mobile while preserving desktop hover-collapse behavior byte-for-byte
- Manager dashboard mobile: `ManagerEntry` stacked form with mobile-only mini Commission Preview above submit (halvingReason visibility rule), `ManagerSales` card-per-sale, `ManagerTracker` cards, `LeadTimingHeatmap` horizontal-scroll with textual swipe hint project-standard
- Payroll dashboard mobile: `AgentSidebar` → `MobileDrawer` (conditional mount, not CSS-hide); `WeekSection` + `AgentCard` responsive tables with 44px touch-target inputs; financial accuracy guaranteed structurally via git-diff (zero `computeNetAmount`/`formatDollar`/`Number()` modifications)
- Owner dashboard mobile: 4 surfaces retrofit (Overview, Trends, KPIs, Scoring) via attribute-only `className` + `data-label` edits; dual-responsive coexistence preserved existing `compact` prop state alongside CSS; Recharts untouched (ResponsiveContainer handles width)
- CS dashboard mobile: 5 files retrofit with 52 data-labels + 5 `responsive-table-no-label` + internal workspace flex-row stacking + inline safe-area submits; AC-4 structural guarantee via git-diff +/- parity grep (zero mutation-logic modifications to `resolveCb`/`resolvePt`/`logAttempt` handlers)
- All role-based dashboards (manager, payroll, owner, CS) usable at 375px without horizontal scroll, without iOS keyboard occlusion, with touch-friendly 44px targets

### Key Decisions

- Breakpoint tokens use explicit `Max`/`Min` suffixes — ambiguous `mobile`/`desktop` keys mixing max-width and min-width semantics were off-by-one bait for 4 downstream phases
- Responsive hooks expose `mounted` flag; consumers MUST gate viewport-dependent JSX on `mounted === true` — prevents React hydration mismatch between SSR (desktop default) and client first render on mobile
- Dialog components in @ops/ui require `ariaLabel` at the TypeScript type level — optional a11y props silently regress; compile-time enforcement scales
- Mobile responsiveness delivered via @ops/ui primitives + inline CSSProperties + `responsive.css` utilities — no Tailwind, no per-app CSS files; `responsive.css` is the one exception (design-system package)
- Submit buttons on mobile: INLINE + safe-area padding, NOT sticky/fixed — sticky occludes focused inputs when iOS soft keyboard opens
- Always inspect parent display mode before applying responsive utility classes — `.grid-mobile-1` is a no-op on `display: flex` parents; `.stack-mobile` is a no-op on `display: grid` parents (audit-discovered in Phase 73, reinforced Phase 76)
- When key info lives in a stacked-below sidebar on mobile, mirror it inline above the primary CTA — `ManagerEntry` mini Commission Preview pattern ensures `halvingReason` visibility before submit
- `.responsive-table-no-label` is the narrow exception to "no new responsive.css selectors" — action cells + colspan rows can't render the data-label prefix without breaking visually
- Horizontal-scroll affordance uses textual hint ("← swipe to see all X →") as project-wide standard for any wide data grid that can't sensibly stack
- Mutation-logic preservation proven via git-diff +/- parity grep — counting `+count == -count` for handler call signatures proves className-only additions (structural argument beats line-by-line inspection)
- "Visible before CTA on mobile" is a VERIFY-and-ASSERT claim via DOM-order precondition, not a relocation edit (Phase 76 audit catch — prevents inflating risk from zero-diff reorders)

### Lessons Reinforced

- Enterprise audits catch structural misframes before APPLY. Phase 76 caught two: workspace-outer already stacked (stack-mobile-md would be a no-op) and gate-override already above Save (no lift needed).
- Attribute-only retrofits on high-risk files (payroll, CS) produce provable safety via git-diff parity rather than defensive tests or rewrites.
- Hydration safety is a cross-cutting concern — one correct pattern in Phase 72 (`mounted` gate) cascades across all four consumer phases.

---

*Log created: 2026-04-15 at v3.0 milestone closure*
