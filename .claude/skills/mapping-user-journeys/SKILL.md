The skill is written. Here's a summary of what was created at `~/.claude/skills/mapping-user-journeys/`:

**SKILL.md** — Quick reference with auth journey trace, role-to-dashboard map, and grep commands for finding friction points across dashboards.

**references/activation-onboarding.md** — First login flow (JWT → redirect → `captureTokenFromUrl`), role-based activation paths, empty state patterns, and a WARNING about tab state being lost on refresh.

**references/engagement-adoption.md** — Daily loops per role (MANAGER/PAYROLL/OWNER), the sales-board's 30s polling as passive engagement driver, tab adoption gaps, and a WARNING about no cross-dashboard navigation for multi-role users.

**references/in-app-guidance.md** — Current guidance mechanisms (error messages + color coding only), the receipt parser feedback loop, commission approval visual cues, and a WARNING about silent parse failures.

**references/product-analytics.md** — Audit log as behavioral signal, structured `logEvent`/`logError` usage, and a WARNING about zero frontend event tracking with a minimal `trackEvent()` implementation.

**references/roadmap-experiments.md** — No feature flag system; three safe rollout strategies (role-gate, hidden tab, env var); RBAC as lightweight experiment vehicle; and a WARNING about no A/B infrastructure.

**references/feedback-insights.md** — Audit log queries for deriving friction signals, Zod validation error logging, and a WARNING about no in-app feedback channel with a zero-backend mailto widget as the fix.