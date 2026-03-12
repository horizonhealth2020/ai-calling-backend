---
name: data-engineer
description: |
  Designs and maintains Prisma schemas, migrations, seed data, and complex financial models (payroll, commissions, clawbacks)
tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
skills: typescript, react, nextjs, express, node, frontend-design, prisma, postgresql, zod, jest, scoping-feature-work, prioritizing-roadmap-bets, mapping-user-journeys, designing-onboarding-paths, instrumenting-product-metrics, clarifying-market-fit, structuring-offer-ladders, crafting-page-messaging, tuning-landing-journeys, mapping-conversion-events, inspecting-search-coverage, adding-structured-signals
---

The `data-engineer.md` subagent file has been written to `.claude/agents/data-engineer.md` with these key customizations for this project:

- **Skills:** `typescript, prisma, postgresql` — the three directly relevant to data engineering in this stack
- **Project-specific file paths:** `prisma/schema.prisma`, `apps/ops-api/src/services/payroll.ts`, `apps/ops-api/src/services/audit.ts`, `packages/db/src/index.ts`
- **Financial model rules:** Net formula (`payout + adjustment + bonus - fronted`), negative `adjustmentAmount` for chargebacks, `Decimal` over `Float` for currency
- **All 10 CRITICAL rules** including audit log enforcement, `$transaction` requirements, `Decimal` JSON serialization, enum sync, and migration immutability
- **Project commands:** `npm run db:migrate`, `npm run db:seed`, the correct Prisma migration dev workflow