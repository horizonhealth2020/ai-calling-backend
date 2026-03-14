# Ops Platform — Payroll & Usability Overhaul

## What This Is

A sales operations platform with role-based dashboards for managers, payroll staff, owners, and agents. A single sale entry from the manager dashboard must cascade correctly across all dashboards — agent tracker, sales board, payroll cards, and owner KPIs. The platform currently has broken sales flow, buggy payroll logic, and UI usability gaps that prevent daily use.

## Core Value

A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ JWT authentication with role-based access control (6 roles) — existing
- ✓ Auth portal with login, password change, role-based redirect — existing
- ✓ Manager dashboard with sales entry form and agent tracker — existing (buggy)
- ✓ Payroll dashboard with periods, commission view, clawbacks, exports — existing (buggy)
- ✓ Sales board with public leaderboard — existing
- ✓ Owner dashboard with KPI summary — existing (incomplete)
- ✓ Product management (CORE, ADD_ON, AD_D categories) with commission rates and thresholds — existing
- ✓ Prisma/PostgreSQL data layer with migrations — existing
- ✓ Socket.IO real-time updates across dashboards — existing
- ✓ Audit logging for sensitive operations — existing
- ✓ Docker and Railway deployment — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Fix sales entry internal server error on manager dashboard
- [ ] Sales entry supports multiple products per sale
- [ ] Sale cascades to agent tracker (manager dashboard)
- [ ] Sale cascades to sales board leaderboard
- [ ] Sale cascades to payroll card for correct agent
- [ ] Sale cascades to owner dashboard KPIs
- [ ] Commission calculation: Core products require Compass VAB bundle for full commission, else half
- [ ] Commission calculation: Add-on/AD&D products get half commission unless bundled with core product
- [ ] Commission calculation: Enrollment fee below threshold triggers half commission
- [ ] Commission calculation: $125 enrollment fee triggers $10 bonus
- [ ] Week-in-arrears payroll: sale date maps to following Sun-Sat pay period
- [ ] ACH sales paid a further week in arrears (two weeks delay)
- [ ] Payroll paycards are scrollable
- [ ] Forms & inputs overhaul across all dashboards
- [ ] Agent performance reporting: per-agent sales, commission earned, cost-per-sale
- [ ] Period summary reporting: weekly/monthly totals, export-ready payroll reports
- [ ] Overall UI/UX polish and usability improvements

### Out of Scope

- Morgan voice service changes — separate workload, not part of this initiative
- Mobile app — web-first, mobile later
- New role types — current 6 roles are sufficient
- Real-time chat — not needed for operations workflow

## Context

This is a brownfield project with an existing monorepo containing 5 Next.js dashboards, an Express API, and shared packages. The core sales-to-payroll flow is broken (internal server error on sales entry), making it impossible to test downstream payroll calculations. The payroll service (`apps/ops-api/src/services/payroll.ts`) has existing commission logic but the product bundling rules (Compass VAB requirement, add-on bundling) and ACH delay logic need to be verified and corrected.

**Commission Rules Summary:**
- **Core products:** Full commission rate if bundled with Compass VAB product; half commission if not bundled
- **Add-on products:** Half commission from set rate unless bundled with a core product (then full? — needs clarification during implementation)
- **AD&D products:** Half commission from set rate unless bundled with a core product
- **Enrollment fee:** Below product threshold → half commission; exactly $125 → +$10 bonus
- **Payment method:** ACH sales are paid one additional week in arrears

**Pay Period:** Sunday to Saturday, paid one week in arrears. A sale on 3/12/2026 (Thursday) goes into the 3/15–3/21 pay period. ACH sales from that date go into 3/22–3/28 instead.

## Constraints

- **Tech stack**: Must use existing stack — Next.js 15, Express, Prisma, PostgreSQL, Socket.IO
- **Styling**: Inline React.CSSProperties with dark glassmorphism theme — no Tailwind, no CSS files
- **Architecture**: Monorepo workspace structure with @ops/* shared packages must be preserved
- **Deployment**: Must remain compatible with both Railway and Docker deployment

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix sales entry first | Everything downstream depends on working sales flow | — Pending |
| Multi-product sales | Products are created in payroll, each sale can include multiple products | — Pending |
| Product-based commission tiers | Commission rates determined by product type and bundling rules | — Pending |
| Sun-Sat pay weeks with arrears | Industry standard for this business; ACH gets extra week delay | — Pending |
| Full overhaul scope | Fix bugs + polish UI + add reporting — not just a patch job | — Pending |

---
*Last updated: 2026-03-14 after initialization*
