All 7 files have been created at `.claude/skills/clarifying-market-fit/`:

```
SKILL.md
references/
  conversion-optimization.md
  content-copy.md
  distribution.md
  measurement-testing.md
  growth-engineering.md
  strategy-monetization.md
```

Key decisions made for this codebase:

- **No external marketing surfaces exist** — the platform is entirely internal (Horizon Health ops staff). "Market fit" was reframed as role-to-surface alignment: every `AppRole` reaches the right dashboard with copy that confirms their job.
- **Grounded in actual files** — all examples reference real paths (`apps/auth-portal/app/landing/page.tsx`, `apps/sales-board/app/page.tsx`, etc.) and real data models (`PayrollEntry`, `Sale`, `AppRole`).
- **Three WARNING sections** for real gaps: no analytics library, no activation notification system, no commission rate management UI.
- **Sales board called out** as the only unauthenticated surface — the one place with actual external growth potential.
- **Net amount formula** (`payout + adjustment + bonus - fronted`) documented in strategy-monetization since it's the core financial value delivered by the platform.