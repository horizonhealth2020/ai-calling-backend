Skill files written to `~/.claude/skills/prioritizing-roadmap-bets/`:

**SKILL.md** — scoring formula (Impact / (Effort + Risk)), surface map of high/medium/low risk areas across all 6 apps, quick-start patterns.

**references/**:
- `activation-onboarding.md` — role-to-dashboard activation flow, config completeness gate (agents + lead sources + products must exist), missing onboarding infrastructure warning with a code fix
- `engagement-adoption.md` — adoption by role surface via audit log, high-engagement features to protect (receipt parser, leaderboard refresh, payroll period workflow), low-adoption features worth cutting (Audits tab placeholder, approval edge cases)
- `in-app-guidance.md` — inline hint patterns using the existing `CSSProperties` system, enrollment fee warning before submission, commission approval state badge, anti-patterns (modal overload, swallowed errors)
- `product-analytics.md` — audit log as primary analytics source, `logEvent` structured logging, available metrics without schema changes, critical gaps (no view tracking, ephemeral logs)
- `roadmap-experiments.md` — SUPER_ADMIN-first rollout pattern, `NEXT_PUBLIC_` env var as build-time toggle, database row as runtime feature gate, before/after audit log comparison as poor-man's A/B test
- `feedback-insights.md` — implicit feedback via edit ratios, Zod validation error logging, clawback data as product signal, commission approval backlog as friction signal, triage decision tree for financial vs non-financial fixes