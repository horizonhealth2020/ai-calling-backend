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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 10 | First milestone — established discuss→plan→execute→verify cycle |

### Cumulative Quality

| Milestone | Tests | Coverage | Gap Closures |
|-----------|-------|----------|-------------|
| v1.0 | 7 (reporting) + existing Morgan tests | Reporting service only | 1 (config form validation) |

### Top Lessons (Verified Across Milestones)

1. Fix the critical path first — everything downstream is blocked until it works
2. Pure functions with TDD for business logic, manual verification for UI
