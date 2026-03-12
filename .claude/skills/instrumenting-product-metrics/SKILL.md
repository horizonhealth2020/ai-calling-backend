All 7 files written to `C:/Users/javer/.claude/skills/instrumenting-product-metrics/`:

**SKILL.md** — Quick reference covering the two tracking surfaces (`logAudit` + `logEvent`), common patterns for extending instrumentation, and links to all reference files.

**references/**
- `activation-onboarding.md` — 6-stage activation funnel, the two missing audit events (sale creation, period finalization), and a checklist to fix them
- `engagement-adoption.md` — Engagement signals from existing DB state, receipt parser adoption measurement, weekly active manager query, CSV export tracking
- `in-app-guidance.md` — Empty state patterns (matching existing sales-board style), inline help text, error message standards, contextual banners
- `product-analytics.md` — Core metrics by role, AppAuditLog query patterns, WARNING about no aggregation layer, full metrics endpoint blueprint
- `roadmap-experiments.md` — Three experiment patterns (RBAC-gate, env-var flag, DB flag), shadow-mode rollout for payroll calc changes, before/after measurement pattern
- `feedback-insights.md` — Audit log as friction signal, error patterns as UX indicators, clawback dispute detection, minimal feedback collection route

Key findings grounded in the actual codebase: sale creation has no `logAudit` call (blocking funnel measurement), the receipt parser's adoption is unmeasurable without a `source` field on the audit event, and all analytics currently runs against the OLTP database with no aggregation layer.