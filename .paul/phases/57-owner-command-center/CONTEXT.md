# Phase 57 Context

**Generated:** 2026-04-10
**Status:** Ready for /paul:plan

## Goals

1. Replace the generic Owner Overview tab with a "Command Center" — the cockpit of the office
2. Must work on phone (at home) and desktop (at office) equally well
3. Every metric answers a question and suggests action — no generic KPIs
4. Real-time activity feed showing CS and manager actions
5. Premium, wow-factor design — this should feel professionally built, not like a template

## Layout Design

### Hero Section (top)
- **Total Premium** — giant animated number, THE headline metric
- **Total Sales** — secondary headline alongside premium
- Both driven by **period selector** (today/week/last week/30 days)
- Delta vs prior period with up/down arrow + percentage

### Stat Cards Row (4 cards)
- **This Week Premium** — dollar amount, vs last week comparison
- **Commission Owed Friday** — from arrears period, what's going out the door
- **Chargebacks** — count + dollar amount + trend indicator. Red border pulse when trending up
- **Lead ROI** — cost per sale this week vs last week

### Condensed Agent Leaderboard
Tighter version of manager tracker, same data minus noise:

| Column | Notes |
|--------|-------|
| Rank | Top 3 with icons |
| Agent | Name |
| Calls | Count |
| Avg | m:ss — single best call quality number |
| Sales | Count |
| Premium | Dollar |
| Cost/Sale | Efficiency metric |
| ● | Quality dot: green (mostly engaged/deep), amber (mixed), red (mostly short). Hover for detail |

Dropped from manager tracker: Longest, Lead Spend, Quality bar (replaced by dot)

### Live Activity Feed
- Last 10 events, newest on top, streaming via Socket.IO
- Timestamp + actor + action + details

**Included events:**
- Sale entered (manager)
- Sale status changed (manager)
- Chargeback/pending term submitted (CS)
- Chargeback resolved/unresolved (CS)

**Excluded events:**
- Period closed/paid (payroll noise)
- Payroll adjustments, commission approvals (payroll noise)

## Phone Layout
- Hero stacks: premium on top, sales below
- Stat cards: 2x2 grid
- Leaderboard: horizontal scroll or condensed to rank/agent/sales/premium
- Activity feed: full width, scrollable

## Approach

### Plan Split (3 plans)
- **Plan 01:** API endpoints — today's pulse aggregation, activity feed event data, condensed tracker summary
- **Plan 02:** Command Center UI — hero section, stat cards, condensed leaderboard, period selector
- **Plan 03:** Live activity feed component + Socket.IO event listener + real-time updates

### Technical Notes
- Reuse existing Socket.IO infrastructure (layout-level provider)
- Activity feed needs a new API endpoint for recent events (from AppAuditLog or a new lightweight event table)
- Commission owed Friday = sum of arrears period payroll entries
- Chargebacks trending = compare this week count vs last week count
- Quality dot: compute from agentMetrics.callsByTier — ratio of (engaged+deep) / total

### Skills to Load During Planning
| Skill | Purpose |
|-------|---------|
| design-taste-frontend | Anti-generic dashboard rules, interaction states |
| high-end-visual-design | Premium feel, micro-interactions |
| kpi-dashboard-design | Metric hierarchy, executive dashboard patterns |
| mobile-design | Phone-first responsive layout |
| frontend-design | Component architecture for data-dense views |
| business-analyst | Actionable KPI framework |
| ui-ux-pro-max | Accessibility, touch targets |
| redesign-existing-projects | Upgrade existing tab without breaking |

## Open Questions
- Activity feed data source: AppAuditLog table has action/entity/metadata — can we query it for recent events, or do we need a new lightweight events table?
- Commission owed Friday: is there a single API call that returns the arrears period total, or do we need to compute from payroll entries?
- Chargebacks trending: compare current week vs prior week from existing /chargebacks/totals endpoint?

---
*Context for /paul:plan consumption*
