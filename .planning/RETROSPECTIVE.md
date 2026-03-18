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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 10 | First milestone — established discuss→plan→execute→verify cycle |
| v1.1 | ~4 | 7 | UI-SPEC contracts, milestone audit→gap closure→re-audit pattern |

### Cumulative Quality

| Milestone | Tests | Coverage | Gap Closures |
|-----------|-------|----------|-------------|
| v1.0 | 7 (reporting) + existing Morgan tests | Reporting service only | 1 (config form validation) |
| v1.1 | 0 (client-side parsers, no new tests) | N/A | 2 (Phase 15.04 UAT gaps, Phase 17 tech debt) |

### Top Lessons (Verified Across Milestones)

1. Fix the critical path first — everything downstream is blocked until it works
2. Pure functions with TDD for business logic, manual verification for UI
3. Gap closure cycles are consistently cheap and effective — use them freely
4. Lock requirement text immediately when design decisions override scope
5. Single-file dashboards work but don't scale — plan extraction before v1.2
