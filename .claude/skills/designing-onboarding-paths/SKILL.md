All 7 files created at `C:/Users/javer/.claude/skills/designing-onboarding-paths/`:

**SKILL.md** — quick reference with 3 working code patterns, key concepts table, and links to all references.

**references/**:
- `activation-onboarding.md` — the implicit 5-step activation sequence (SUPER_ADMIN → MANAGER → first sale), setup completeness check pattern, empty state upgrade approach, and a WARNING against fetching setup state in `useEffect`
- `engagement-adoption.md` — role-based feature discovery, manager/payroll setup nudge banners, tab-order-as-progressive-disclosure, cross-dashboard deep links, and a WARNING against showing empty tabs
- `in-app-guidance.md` — inline hint text pattern, status message convention (always include HTTP status code), loading skeleton pattern, error state handling, and a WARNING against silent form resets
- `product-analytics.md` — documents the absence of client analytics, maps the activation funnel against current `logAudit()` gaps, shows how to query `app_audit_log` for metrics, and warns against adding a client analytics library before server-side coverage is complete
- `roadmap-experiments.md` — no feature flags (and why), a 10-step onboarding rollout checklist, 5 incremental slices ordered by risk, Prisma schema for onboarding state, and a WARNING against using `NEXT_PUBLIC_*` env vars as runtime feature flags
- `feedback-insights.md` — audit log as user insight, lightweight in-app feedback via `logAudit()` (no new table), error boundary pattern, and a process for acting on feedback