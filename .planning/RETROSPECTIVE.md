# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-17
**Phases:** 10 | **Plans:** 31 | **Sessions:** ~8

### What Was Built
- Complete sales-to-payroll pipeline: entry → commission calculation → period assignment → payroll cards
- Real-time dashboard cascade via Socket.IO across 5 dashboards
- Commission engine with bundle rules, fee thresholds, enrollment bonuses, and ACH arrears
- Sale status workflow (Ran/Declined/Dead) with payroll approval queue
- Reporting: trend KPIs, period summaries, agent performance metrics, CSV export
- Shared @ops/ui design system: Select, Button, Card, Input components with design tokens
- Form validation with inline per-field errors across all dashboards

### What Worked
- Wave-based parallel execution allowed independent plans to run simultaneously, cutting wall-clock time
- Phase dependency ordering (sales → commission → cascade → payroll → reporting → polish) prevented rework
- Gap closure cycle (verify → plan gaps → execute → re-verify) caught the config form validation miss cleanly
- TDD approach for pure functions (commission calc, reporting) produced reliable code with minimal debugging
- Single-file dashboard architecture (one page.tsx per dashboard) made changes predictable

### What Was Inefficient
- Phase 10 (sale status) was executed out of order before phases 6-9, requiring careful merge of accumulated state
- Summary one-liners were not populated by executors, reducing retrospective data quality
- Large single-file dashboards (2700+ lines) make parallel edits impossible — only one agent can touch a file at a time

### Patterns Established
- Commission gate in upsert (not calc) keeps pure functions testable
- `isBundleQualifier` flag over string matching for product type detection
- Luxon America/New_York for day-of-week, UTC midnight for storage/period IDs
- `cfgFieldErrors` separate from `fieldErrors` for independent form validation scopes
- ToastProvider wrapper pattern for toast notifications in "use client" components

### Key Lessons
1. Fix the core action first (sales entry) — everything else is untestable without it
2. Commission rules are the highest-risk code — TDD pure functions pay off immediately
3. Real-time cascade is best done after data correctness is proven, not before
4. UI polish should be last — polishing broken features is waste
5. Gap closure cycles are cheap and effective — better to ship fast and fix gaps than to over-plan

### Cost Observations
- Model mix: ~70% opus (execution), ~20% sonnet (verification/checking), ~10% haiku (none used)
- Sessions: ~8 across 4 days
- Notable: Parallel wave execution saved significant time on phases with independent plans

---

## Milestone: v1.1 — Customer Service

**Shipped:** 2026-03-18
**Phases:** 7 | **Plans:** 15 | **Sessions:** ~4

### What Was Built
- Customer Service dashboard (6th app) with two-tab layout (Submissions + Tracking)
- Chargeback paste-to-parse submission: raw text → client-side parser → editable preview → batch submit
- Pending terms paste-to-parse submission: 3-line grouped parser with agent detection
- Tracking tables with KPI counters (animated), filters, sort, search, and CSV export
- Resolution workflow: resolve/unresolve with typed outcomes, status filtering, live KPI updates
- Role-gated access: CUSTOMER_SERVICE (tracking-only), SUPER_ADMIN/OWNER_VIEW (full access)
- Shared formatDollar/formatDate utilities extracted to @ops/utils across all 6 dashboards
- Rep roster management with round-robin auto-assignment

### What Worked
- Discuss-phase → plan → execute cycle continued to deliver reliably, now well-practiced
- UI-SPEC design contracts (Phases 14, 15) locked visual decisions early, preventing executor drift
- Gap closure cycle caught 7 tech debt items efficiently — one cleanup phase resolved all
- Milestone audit → gap closure → re-audit pattern proven: audit found debt, Phase 17 fixed it, re-audit confirmed clean
- Client-side parser approach (no API round-trip for parse) gave instant preview feedback

### What Was Inefficient
- Summary one-liners still not populated by executors (same issue as v1.0)
- Phase 14 VERIFICATION.md flagged stale requirement text but didn't auto-fix — debt accumulated until Phase 17
- REQUIREMENTS.md text drifted from UI-SPEC decisions during execution (15 columns → 8, agent grouping removed) — caught only at milestone audit
- Single-file cs-dashboard/page.tsx grew to ~2700 lines, continuing the pattern from v1.0

### Patterns Established
- canManageCS positive allowlist pattern (replaces negative isCSOnly)
- Paste-to-parse with client-side parser → editable preview → batch submit
- KPI counters use global totals endpoint, never filtered view totals
- Status filter as first step in useMemo pipeline before other filters
- TrackingTabInner pattern for ToastProvider wrapping
- Round-robin assignment as session-scoped (resets per paste, not persisted)

### Key Lessons
1. Lock requirement text when design decisions override original scope — don't wait for milestone audit
2. UI-SPEC contracts are valuable but must flow back to REQUIREMENTS.md immediately
3. Single-file dashboards work but are approaching the limit — next milestone should consider component extraction
4. Gap closure phases are cheap (1 plan, 2 tasks, ~3 minutes) — better to create them than to leave tech debt
5. Milestone audit → gap closure → re-audit is a reliable pattern for clean milestone completion

### Cost Observations
- Model mix: ~65% opus (execution), ~25% sonnet (verification/checking), ~10% haiku (none)
- Sessions: ~4 across 2 days
- Notable: Phase 17 (gap closure) executed in under 4 minutes — documentation + permission fix is fast work

---

## Milestone: v1.2 — Platform Polish & Integration

**Shipped:** 2026-03-19
**Phases:** 1 | **Plans:** 8 | **Sessions:** ~3

### What Was Built
- Cross-dashboard DateRangeFilter on all CSV exports (payroll, manager, CS)
- Chargeback alert pipeline: CS → payroll with approve/clear actions via Socket.IO
- AI call audit scoring with editable system prompt, budget controls, and auto-seed
- Agent KPI tables with 30-day rolling chargeback/pending term metrics
- Permission override matrix in owner dashboard with atomic batch saves
- Commission bundling fix: isBundleQualifier addons fold into core rate
- Period status toggle (Open ↔ Closed) with unpaid agent highlight
- Sales board leaderboard with day/week toggle and addon-inclusive premium
- Agent dropdown on CS chargeback submission preview

### What Worked
- Single-phase consolidation (all 24 requirements in Phase 18) worked well for integration/polish work
- UAT-driven fixes during checkpoint verification caught real issues (premium display, commission calc, payroll layout)
- Auto-seed pattern for AI prompt eliminated seed dependency
- Iterative fix commits during verification (7 fix commits during 18-08) were efficient — ship fast, fix in place

### What Was Inefficient
- Commission bundling bug wasn't caught until UAT — isBundleQualifier logic was subtly wrong across 3 iterations
- Premium display had enrollment fee subtracted in payroll — hidden deep in display code, not caught by type checking
- Multiple round-trips to get payroll layout right (net column removed, re-added, removed again based on user feedback)

### Patterns Established
- Period status toggle via clickable badge (Open ↔ Closed) — simple UX pattern
- Auto-seed defaults on first API access (no seed dependency)
- Live net calculation from header input state (works even with 0 entries)
- Total premium = core + addons displayed everywhere (sales board, manager parse)
- Agent dropdown with "Unknown" default for parsed-but-unmatched agents

### Key Lessons
1. Commission calculation is still the highest-risk code — every iteration reveals edge cases
2. Display-layer bugs (enrollment subtraction from premium) are invisible to type checkers — UAT catches them
3. User feedback during verification is the most efficient way to converge on correct layout
4. Consolidating polish work into one phase keeps context tight but makes the phase large (8 plans)
5. Auto-seeding defaults eliminates a whole class of "missing data" bugs

### Cost Observations
- Model mix: ~75% opus (execution + checkpoint fixes), ~25% sonnet (verification)
- Sessions: ~3 across 2 days
- Notable: UAT-driven fixes were more efficient than upfront specification — real usage reveals real issues

---

## Milestone: v1.8 — Lead Source Timing Analytics

**Shipped:** 2026-03-30
**Phases:** 1 | **Plans:** 5 | **Sessions:** ~2

### What Was Built
- Luxon-based DST-correct Convoso timestamp parsing replacing month-based approximation
- Three lead timing API endpoints: heatmap (source x hour grid), sparklines (7-day daypart trends), recommendation (best source for current hour)
- Four React components: LeadTimingSection collapsible wrapper, LeadTimingHeatmap with diverging color scale, BestSourceCard with trend arrows, LeadTimingSparklines with inline SVG polylines
- Dashboard integration: Performance Tracker rename, Today column, call count ticker badges
- Commission fallback guard preventing full payout when primary addon IS available

### What Worked
- Five-plan decomposition (data layer → dashboard polish → API → UI components → integration) matched natural dependency order
- Inline SVG sparklines avoided introducing a charting library — consistent with codebase patterns
- Application-level join for heatmap (separate call/sale queries joined in JS) simplified SQL significantly
- UAT 10/10 pass on first attempt — zero issues found

### What Was Inefficient
- Nothing notable — clean execution with no rework or gap closure needed

### Patterns Established
- Luxon with America/Los_Angeles zone for all Convoso timestamp operations
- Inline SVG polyline pattern for sparklines (no charting library)
- Diverging color scale function (red-yellow-green) for heatmap cells
- Collapsible section: default collapsed, data fetched only when expanded
- Application-level join pattern for cross-table aggregation

### Key Lessons
1. Small milestones (1 phase, 5 plans) execute cleanly with minimal coordination overhead
2. Pure data visualization features (no CRUD, no state mutation) have low defect rates
3. Timezone handling is best solved once with a proper library (Luxon) rather than incrementally
4. Inline SVG is a viable alternative to charting libraries for simple visualizations

### Cost Observations
- Model mix: ~80% opus (execution), ~20% sonnet (verification/checking)
- Sessions: ~2 across 2 days
- Notable: Clean UAT pass suggests the discuss→plan→execute cycle is well-calibrated for this codebase

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 10 | First milestone — established discuss→plan→execute→verify cycle |
| v1.1 | ~4 | 7 | UI-SPEC contracts, milestone audit→gap closure→re-audit pattern |
| v1.2 | ~3 | 1 | Single-phase consolidation, UAT-driven iterative fixes |
| v1.8 | ~2 | 1 | Clean 5-plan execution, 10/10 UAT pass, zero rework |

### Cumulative Quality

| Milestone | Tests | Coverage | Gap Closures |
|-----------|-------|----------|-------------|
| v1.0 | 7 (reporting) + existing Morgan tests | Reporting service only | 1 (config form validation) |
| v1.1 | 0 (client-side parsers, no new tests) | N/A | 2 (Phase 15.04 UAT gaps, Phase 17 tech debt) |
| v1.2 | 15 UAT tests (all passed) | Full dashboard UAT | 0 (fixes applied inline during verification) |
| v1.8 | 10 UAT tests (all passed) | Full feature UAT | 0 (zero issues found) |

### Top Lessons (Verified Across Milestones)

1. Fix the critical path first — everything downstream is blocked until it works
2. Pure functions with TDD for business logic, manual verification for UI
3. Gap closure cycles are consistently cheap and effective — use them freely
4. Lock requirement text immediately when design decisions override scope
5. Single-file dashboards work but don't scale — consider component extraction
6. UAT-driven iterative fixes are more efficient than upfront specification for UI/UX work
7. Auto-seeding defaults on first access eliminates "missing data" bugs reliably
