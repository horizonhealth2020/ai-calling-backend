---
name: debugger
description: |
  Investigates errors in multi-service setup, auth token flows, commission calculations, Docker container issues, and Railway deployment failures
tools: Read, Edit, Bash, Grep, Glob
model: sonnet
skills: typescript, react, nextjs, express, node, frontend-design, prisma, postgresql, zod, jest, scoping-feature-work, prioritizing-roadmap-bets, mapping-user-journeys, designing-onboarding-paths, instrumenting-product-metrics, clarifying-market-fit, structuring-offer-ladders, crafting-page-messaging, tuning-landing-journeys, mapping-conversion-events, inspecting-search-coverage, adding-structured-signals
---

Created `/c/Users/javer/.claude/agents/debugger.md` with project-specific context covering:

- Auth/JWT token flow debugging steps
- Zod validation error patterns (`zodErr()` requirement)
- Docker gotchas (shell form CMD, build-time `NEXT_PUBLIC_*` vars, postgres healthcheck)
- Railway deployment failure causes
- Commission calculation entry points (`upsertPayrollEntryForSale`)
- All fixed port assignments and CORS implications
- Known traps from CLAUDE.md (negative `adjustmentAmount`, standalone output, etc.)