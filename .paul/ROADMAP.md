# Roadmap: ai-calling-backend

## Overview

A sales operations platform evolving from initial setup through full role-based dashboards — enabling managers, payroll staff, customer service, and owners to track sales, commissions, chargebacks, and agent performance across an 18-person team.

## Milestones

| Version | Name | Phases | Status | Completed |
|---------|------|--------|--------|-----------|
| v2.2 | Chargeback Batch Review & Payroll Agent Tabs | 44-47 | Shipped | 2026-04-09 |
| v2.3 | Parser & Payroll Fixes | 48 | Shipped | 2026-04-09 |
| v2.4 | Payroll & Chargeback Fixes | 49 | Shipped | 2026-04-09 |
| v2.5 | Professional Polish | 50-52 | Shipped | 2026-04-10 |
| v2.6 | Payroll Accuracy & Product Colors | 53-54 | Shipped | 2026-04-10 |
| v2.7 | Analytics & Command Center | 55-59 | Shipped | 2026-04-10 |
| v2.8 | Hardening & Bulk Operations | 60-64 | Shipped | 2026-04-13 |
| v2.9 | CS Accountability & Outreach Tracking | 65-68 | In Progress | - |

## Active Milestone: v2.9 CS Accountability & Outreach Tracking

**Goal:** Move CS from "did they resolve it?" to "how effectively did they work it?" — giving managers measurable insight into each CS agent's outreach effort and performance.
**Status:** In Progress
**Progress:** [█████░░░░░] 50%

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 65 | Outreach Data Model | 1 | Complete | 2026-04-13 |
| 66 | Outreach Logging UI | 1 | Complete | 2026-04-13 |
| 67 | 48-Hour Stale Alerts | 1 | Planning | - |
| 68 | CS Analytics Upgrade | TBD | Not started | - |

## Phase Details

### Phase 65: Outreach Data Model

**Goal:** Create ContactAttempt table to track call/email/text outreach per chargeback and pending term, plus expand resolution outcomes from binary resolved to SAVED/CANCELLED/NO_CONTACT.
**Depends on:** v2.8 complete
**Research:** Likely — verify current Chargeback/PendingTerm schema for additive migration

**Scope:**
- ContactAttempt model: type (CALL/EMAIL/TEXT), notes, timestamp, linked to Chargeback or PendingTerm, linked to ServiceAgent
- Resolution outcome expansion: SAVED, CANCELLED, NO_CONTACT on both Chargeback and PendingTerm
- Prisma migration (additive only — no breaking changes)
- API endpoints for CRUD on contact attempts

**Plans:**
- [x] 65-01: ContactAttempt model + API + 3-call resolution gate

### Phase 66: Outreach Logging UI

**Goal:** Add contact attempt logging UI to CS chargeback and pending term cards — Log Call/Email/Text buttons with notes, attempt timeline showing progress (1/3, 2/3, 3/3), and enriched resolution outcomes.
**Depends on:** Phase 65 (data model available)
**Research:** Unlikely (consuming Phase 65 API)

**Scope:**
- "Log Call" / "Log Email" / "Log Text" buttons on CS tracking cards
- Notes field per attempt
- Attempt timeline visualization (1/3, 2/3, 3/3 with timestamps)
- Enriched resolution selector (SAVED/CANCELLED/NO_CONTACT replaces binary resolve)
- Backward-compatible: existing resolved records still display correctly

**Skills:** frontend-design

**Plans:**
- [x] 66-01: Outreach logging workspace + gate override UI + bypassReason on record

### Phase 67: 48-Hour Stale Alerts

**Goal:** Alert CS agents when chargebacks or pending terms have been sitting unworked for 48+ hours. Per-agent visibility on their own dashboard, auto-clears on attempt or resolution.
**Depends on:** Phase 66 (logging UI in place so agents can act on alerts)
**Research:** Unlikely (timestamp comparison, existing alert patterns from Phase 62)

**Scope:**
- Stale detection: chargebacks/pending terms with no contact attempts and unresolved >48h
- Alert badge/section on CS agent's personal dashboard
- Auto-clear when agent logs an attempt or resolves the item
- Count of stale items as KPI

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 68: CS Analytics Upgrade

**Goal:** Replace shallow resolution metrics with actionable outreach analytics — average attempts before resolution, time-to-resolution, outreach response rate, per-agent comparison, and save rate correlation.
**Depends on:** Phase 67 (all outreach data flowing)
**Research:** Likely — design metric aggregation queries

**Scope:**
- New metrics: avg contact attempts before resolution, time-to-resolution, outreach response rate
- Per-agent breakdown: attempts-per-agent, who's making calls vs just closing
- Agent comparison leaderboard for outreach effort
- Nice-to-have: save rate correlation (3 attempts vs 1)
- Fold into existing CS analytics tab (CSAnalytics.tsx)

**Skills:** analytics-tracking, support-analytics-reporter

**Plans:**
- [ ] TBD (defined during /paul:plan)

---

## Completed Milestone: v2.8 Hardening & Bulk Operations

**Goal:** Make the platform reliable, testable, and efficient at scale — fix data integrity gaps, add test safety nets, improve performance, and enable bulk workflows.
**Status:** Shipped
**Progress:** [██████████] 100%

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 60 | Data Integrity | 1 | Complete | 2026-04-13 |
| 61 | API Test Coverage | 1 | Complete | 2026-04-13 |
| 62 | Caching Layer | 1 | Complete | 2026-04-13 |
| 63 | Bulk Operations | 1 | Complete | 2026-04-13 |
| 64 | Polish & Exports | 2 | Complete | 2026-04-13 |

## Phase Details

### Phase 60: Data Integrity

**Goal:** Scan and fix orphaned Clawback/PayrollEntry records from the broken chargeback delete flow, plus backfill audit log entries for historical sales so the activity feed has pre-deploy data.
**Depends on:** v2.7 complete
**Research:** Unlikely (known data patterns, one-time scripts)

**Scope:**
- One-time migration script to find and clean orphaned Clawback + zeroed PayrollEntry records
- Recalculate commission for affected sales via upsertPayrollEntryForSale
- Activity feed backfill script: generate audit log entries from existing Sale/Clawback records

**Skills:** database-architect

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 61: API Test Coverage

**Goal:** Add Jest integration tests for the highest-risk API paths — commission calculation, chargeback flow (create/apply/delete), payroll calculations, cross-period logic, and sale status changes.
**Depends on:** Phase 60 (clean data state)
**Research:** Likely — verify Jest + Prisma test database setup pattern

**Scope:**
- Jest test infrastructure for ops-api (test database, setup/teardown)
- Commission engine tests (bundle rules, fee thresholds, ACA flat, AD&D)
- Chargeback flow tests (create, match, apply in-period, apply cross-period, delete + cleanup)
- Payroll calculation tests (upsert, carryover, cross-period negative entries)
- Sale status change tests (RAN→DEAD commission zeroing, approval workflow)

**Skills:** jest, backend-dev-guidelines, e2e-testing-patterns

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 62: Caching Layer

**Goal:** Add in-memory caching for heavy aggregation endpoints (command center, trends, tracker) with automatic invalidation when data changes via Socket.IO events.
**Depends on:** Phase 61 (tests validate correctness before adding cache)
**Research:** Likely — evaluate caching strategy (node-cache vs Map vs Redis)

**Scope:**
- Cache wrapper for aggregation endpoints (command center, trends, tracker summary, owner summary)
- Socket.IO event-driven invalidation (sale created/updated/deleted, chargeback, payroll mutation)
- Cache TTL configuration
- Cache bypass for development

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 63: Bulk Operations

**Goal:** Enable multi-select sales for batch status changes and batch commission approvals — reducing repetitive clicks for managers processing multiple sales.
**Depends on:** Phase 62 (cache handles burst invalidation from bulk mutations)
**Research:** Unlikely (existing UI patterns, ConfirmModal available)

**Scope:**
- Multi-select checkbox UI on manager sales list
- Batch status change API endpoint (RAN→DEAD/DECLINED for multiple sales)
- Batch commission approval API endpoint
- ConfirmModal with summary of affected sales before execution
- Socket.IO broadcast for bulk updates

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 64: Polish & Exports

**Goal:** Expand CSV export to views missing it and eliminate implicit `any` types in ops-api route files.
**Depends on:** Phase 63 (bulk ops complete)
**Research:** Unlikely (mechanical work)

**Scope:**
- CSV export: owner command center leaderboard, owner trends charts, CS analytics drill-down, payroll periods view
- TypeScript `any` cleanup: eliminate implicit `any` in all ops-api route files
- Type-check pass to verify no regressions

**Skills:** typescript-expert

**Plans:**
- [ ] TBD (defined during /paul:plan)

---

## Active Milestone: v2.5 Professional Polish

**Goal:** Elevate the platform from functional to professional-grade — proper interaction states, consistent design tokens, and accessibility foundations.
**Status:** In Progress
**Progress:** [██████████] 100%

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 50 | Shared UI Hardening | 1 | Complete | 2026-04-09 |
| 51 | Dashboard Interaction Fixes | 2 | Complete | 2026-04-10 |
| 52 | Visual Consistency Pass | 2 | Complete | 2026-04-10 |

## Phase Details

### Phase 50: Shared UI Hardening

**Goal:** Build foundational UI primitives — focus rings, disabled states, confirm modal component, loading button states, ARIA labels on shared @ops/ui components.
**Depends on:** Phase 49 (v2.4 complete)
**Research:** Unlikely (internal component patterns, known code)

**Scope:**
- Focus/keyboard states (`:focus-visible` styling on all interactive elements)
- Disabled state styling (distinct appearance beyond opacity 0.6)
- Confirm modal component (themed dark glassmorphism replacement for `window.confirm()`)
- Loading button states (visual feedback during API calls)
- ARIA labels on shared @ops/ui components

**Skills:** design-taste-frontend, ui-ux-pro-max, frontend-developer

**Plans:**
- [x] 50-01: Disabled states, ConfirmModal, ARIA attributes

### Phase 51: Dashboard Interaction Fixes

**Goal:** Replace browser-native dialogs, add save feedback, debounce inputs, surface errors, and add confirmations for destructive actions across all dashboards.
**Depends on:** Phase 50 (shared components available)
**Research:** Unlikely (consuming Phase 50 components)

**Scope:**
- Replace `window.confirm()` with themed modal across payroll, manager, CS dashboards
- Save feedback/toasts on all mutation operations
- Debounce filter/search inputs (CS tracking, payroll sidebar, owner date range)
- Error surfacing (replace silent catch blocks with visible feedback)
- Consistent error clearing on manager sales entry form
- Confirmation for resolve/unapprove actions

**Skills:** form-cro, high-end-visual-design, react-patterns

**Plans:**
- [x] 51-01: Replace window.confirm with ConfirmModal (9 replaced + 5 new confirmations)
- [x] 51-02: Error surfacing (toast feedback), debounce search inputs, form error clearing

### Phase 52: Visual Consistency Pass

**Goal:** Migrate hardcoded colors to design tokens, add responsive grids, CSS transitions, typography tokens, and touch-friendly navigation.
**Depends on:** Phase 51 (interactions stable)
**Research:** Unlikely (extracting existing values into tokens)

**Scope:**
- Design token migration (~50+ hardcoded rgba/hex → centralized constants)
- Responsive KPI grids (replace hardcoded 4-column with breakpoint-aware)
- CSS transitions (filter panel show/hide, note expansion)
- Typography tokens (replace hardcoded fontSize with scale constants)
- Touch-friendly sidebar navigation

**Skills:** redesign-existing-projects, frontend-design

**Plans:**
- [x] 52-01: Semantic color tokens, responsive grids, touch nav
- [x] 52-02: Bulk migration — hex, rgba, fontSize to design tokens

---

## Active Milestone: v2.6 Payroll Accuracy & Product Colors

**Goal:** Fix commission display accuracy for ACH-deferred sales and add product type color coding for visual differentiation.
**Status:** In Progress
**Progress:** [██████████] 100%

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 53 | Payroll Sidebar Commission Fix | 1 | Complete | 2026-04-10 |
| 54 | Product Type Color Coding | 1 | Complete | 2026-04-10 |

## Phase Details

### Phase 53: Payroll Sidebar Commission Fix

**Goal:** Fix ACH deferral impact on sidebar commission totals — show current Friday period commission so managers see accurate at-a-glance totals.
**Depends on:** Phase 52 (v2.5 complete)
**Research:** Unlikely (internal payroll period logic, known code)

**Scope:**
- AgentSidebar commission totals skewed by ACH payment deferral
- Show commission for current Friday's payroll period (not inflated by deferred entries)

**Plans:**
- [x] 53-01: Date-based currentPeriodId selection (ACH deferral fix)

### Phase 54: Product Type Color Coding

**Goal:** Add visual differentiation by product type — ACA=purple, Core=blue, Add-ons=green, AD&D=current — across Products tab and payroll entry pills.
**Depends on:** Phase 53 (sidebar fix complete)
**Research:** Unlikely (product type field exists, color tokens available)

**Scope:**
- Product type color mapping using semanticColors tokens
- Apply to Products tab (PayrollProducts.tsx)
- Apply to payroll entry pills/badges (WeekSection.tsx, PayrollPeriods.tsx)

**Plans:**
- [x] 54-01: ACA=purple, Core=blue, Add-ons=green, AD&D=amber

---

## Active Milestone: v2.7 Analytics & Command Center

**Goal:** Transform the owner dashboard into a real-time command center, upgrade manager tracker with unsurfaced call data, add CS analytics for owner visibility, and standardize remaining fontSize values.
**Status:** Shipped
**Progress:** [██████████] 100%

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 55 | fontSize Standardization | 1 | Complete | 2026-04-10 |
| 56 | Manager Tracker Upgrade | 1 | Complete | 2026-04-10 |
| 57 | Owner Command Center | 3 | Complete | 2026-04-10 |
| 58 | Owner Trends Tab | 1 | Complete | 2026-04-10 |
| 59 | CS Analytics Tab | 1 | Complete | 2026-04-10 |

## Phase Details

### Phase 55: fontSize Standardization

**Goal:** Migrate 97 remaining non-exact fontSize values to nearest tokens or document as intentional exceptions.
**Depends on:** Phase 54 (v2.6 complete)
**Research:** Unlikely (mechanical, same pattern as Phase 52)

**Scope:**
- fontSize: 12 (59 instances) — decide: new token at 12, or round to sm (13)
- fontSize: 10 (17 instances) — decide: new token at 10, or round to xs (11)
- fontSize: 15, 20, 9 (21 instances) — case-by-case

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 56: Manager Tracker Upgrade

**Goal:** Surface unsurfaced call data in the manager tracker — call quality tier breakdown, agent KPI trends, conversion eligibility, longest call metric.
**Depends on:** Phase 55 (fontSize stable)
**Research:** Likely — verify AgentCallKpi historical snapshot API availability

**Scope:**
- Call quality tier breakdown per agent (callsByTier JSON → visual distribution)
- Agent KPI 30-day trend sparklines from historical snapshots
- Conversion eligibility flag display
- Longest call metric per agent

**Skills:** analytics-tracking, design-taste-frontend

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 57: Owner Command Center

**Goal:** Replace the generic Overview tab with a real-time command center answering "how is my office doing RIGHT NOW?" — today's pulse, weekly money view, agent leaderboard, activity feed.
**Depends on:** Phase 56 (manager patterns established)
**Research:** Likely — need new API endpoints for today's pulse aggregation

**Scope:**
- Today's Pulse: sales today, active agents, calls today (tier breakdown), best agent
- This Week vs Last Week: premium, commission owed Friday, chargebacks, lead spend ROI
- Agent Leaderboard: ranked live with calls, close rate, cost per sale
- Activity Feed: last 10 events via Socket.IO

**Skills:** kpi-dashboard-design, business-analyst, design-taste-frontend, frontend-design

**Plans:**
- [ ] TBD (defined during /paul:plan)

### Phase 58: Owner Trends Tab

**Goal:** Replace generic KPIs tab with historical trend analysis — agent KPI trends, revenue trends, lead source effectiveness, call quality trends.
**Depends on:** Phase 57 (command center patterns established)
**Research:** Likely — need historical aggregation endpoints

**Scope:**
- Agent KPI trend charts from AgentCallKpi snapshots (30-day)
- Revenue trend: weekly/monthly premium, commission, chargeback totals
- Lead source effectiveness: conversion rate + cost per acquisition by source
- Call quality trends: callsByTier distribution over time

**Skills:** business-analyst, analytics-tracking, revops

**Plans:**
- [x] 58-01: Recharts Trends tab — revenue, agent KPI, lead source, call quality charts

### Phase 59: CS Analytics Tab

**Goal:** Add owner/admin-only analytics tab to CS dashboard replacing resolved log — rep performance, chargeback resolution patterns, pending term categories with drill-down.
**Depends on:** Phase 58 (analytics patterns established)
**Research:** Likely — need rep aggregation endpoint

**Scope:**
- Rep performance aggregate: submissions per rep, resolution rate, turnaround time
- Chargeback resolution patterns: reversal vs matched vs void distribution
- Pending term categories: holdReason distribution, resolution type breakdown
- Drill-down: click rep → individual activity detail
- Restricted to OWNER_VIEW + SUPER_ADMIN roles

**Skills:** support-analytics-reporter, redesign-existing-projects

**Plans:**
- [x] 59-01: CS Analytics tab — rep performance, chargeback patterns, pending term categories, drill-down, CSV export

---

## Completed Milestones

### v2.7 Analytics & Command Center (Shipped 2026-04-10)

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 55 | fontSize Standardization | 1 | Complete | 2026-04-10 |
| 56 | Manager Tracker Upgrade | 1 | Complete | 2026-04-10 |
| 57 | Owner Command Center | 3 | Complete | 2026-04-10 |
| 58 | Owner Trends Tab | 1 | Complete | 2026-04-10 |
| 59 | CS Analytics Tab | 1 | Complete | 2026-04-10 |


### v2.6 Payroll Accuracy & Product Colors (Shipped 2026-04-10)

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 53 | Payroll Sidebar Commission Fix | 1 | Complete | 2026-04-10 |
| 54 | Product Type Color Coding | 1 | Complete | 2026-04-10 |

### v2.5 Professional Polish (Shipped 2026-04-10)

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 50 | Shared UI Hardening | 1 | Complete | 2026-04-09 |
| 51 | Dashboard Interaction Fixes | 2 | Complete | 2026-04-10 |
| 52 | Visual Consistency Pass | 2 | Complete | 2026-04-10 |



### v2.4 Payroll & Chargeback Fixes (Shipped 2026-04-09)

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 49 | Payroll & Chargeback Fixes | 1 | Complete | 2026-04-09 |

### v2.3 Parser & Payroll Fixes (Shipped 2026-04-09)

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 48 | Parser & Payroll Quick Fixes | 1 | Complete | 2026-04-09 |

---
*Roadmap created: 2026-04-09*
*Last updated: 2026-04-13 — Phase 66 complete*
