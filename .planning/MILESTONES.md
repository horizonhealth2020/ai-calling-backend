# Milestones

## v1.8 Lead Source Timing Analytics (Shipped: 2026-03-30)

**Phases completed:** 1 phase, 5 plans, 8 tasks
**Timeline:** 2026-03-26 → 2026-03-30
**Requirements:** 25/25 satisfied
**UAT:** 10/10 passed
**Stats:** 13 files changed, +954 / -22 lines

**Key accomplishments:**

- Luxon-based DST-correct Convoso timestamp parsing with IANA timezone database replacing month-based DST approximation
- Lead timing analytics API: heatmap, sparklines, and recommendation endpoints with timezone-aware aggregation
- Four React components: heatmap grid with diverging color scale, best source recommendation card, sparklines table with inline SVG polylines, and collapsible section wrapper
- Dashboard integration: Performance Tracker rename, Today column, call count ticker badges, timing analytics on Manager and Owner views
- Commission fallback guard: half commission when primary addon IS available but missing from sale

---

## v1.7 Dashboard Fixes & Cost Tracking (Shipped: 2026-03-26)

**Phases completed:** 1 phase, 4 plans, 6 tasks
**Timeline:** 2026-03-25 → 2026-03-26 (2 days)
**Requirements:** 14/14 satisfied
**Stats:** 18 files changed, +624 / -154 lines

**Key accomplishments:**

- Premium column in Manager Agent Sales now shows core + addon total per row, matching payroll and sales board totals
- Lead source create form includes Buffer (seconds) field with POST API Zod validation
- Manager Config Products section converted to read-only reference table (no CRUD)
- Convoso KPI poller writes individual call records to ConvosoCallLog with dedup, backfill for delayed recordings, and proper response parsing
- Lead Spend and Cost/Sale columns in Manager Tracker and Owner Dashboard with three-state display logic (not configured / no data / has data)
- CS Resolved Log audit tab for OWNER_VIEW/SUPER_ADMIN with unified chargeback + pending term table, type/date/agent filtering
- Per-agent auditEnabledAt timestamp for granular call audit eligibility control
- AI call audit model updated to Claude Sonnet 4.6, auto-enqueue on server boot, configurable duration settings

---

## v1.6 Pre-Launch Stabilization (Shipped: 2026-03-25)

**Phases completed:** 4 phases, 10 plans, 16 tasks
**Timeline:** 2026-03-25 (1 day)
**Requirements:** 15/15 satisfied
**Stats:** 117 files changed, +6,632 / -2,154 lines, 47 commits

**Key accomplishments:**

- Relocated Morgan voice service to apps/morgan/ with zero behavior change — professional monorepo structure
- Removed all dead code: unused imports, unreferenced exports, commented-out code blocks, unused dependencies across all apps and packages
- Hardened API error handling: asyncHandler audit, full Zod validation on all req.body/params/query, Prisma error handling (503 for connection failures), Socket.IO try/catch on all 10 emit functions
- Eliminated all explicit `any` types from application code (~183 occurrences), added explicit return types to all shared package exports
- Verified API response shapes match dashboard inline types across 4 key endpoints

---

## v1.5 Platform Cleanup & Remaining Features (Shipped: 2026-03-24)

**Phases completed:** 4 phases, 8 plans, 15 tasks
**Timeline:** 2026-03-23 → 2026-03-24 (2 days)
**Requirements:** 20/20 satisfied

**Key accomplishments:**

- Split 2750-line monolith route file into 17 domain modules with shared helpers (zero behavior change)
- Owner dashboard CS payroll totals with Socket.IO real-time updates
- Agent-grouped detailed CSV export matching print card layout for payroll staff
- AI scoring dashboard with aggregate KPIs, per-agent breakdown, and weekly trends
- Chargeback auto-matching to sales with commission-based clawback creation and dedupe guard
- Data archival system for 3 high-volume log tables with batch operations, restore, and admin UI

---

## v1.3 Dashboard Consolidation & Uniform Date Ranges (Shipped: 2026-03-23)

**Phases completed:** 1 phases, 10 plans, 19 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] Fixed tsconfig.json path resolution for Next.js
- Configurable DateRangeFilter with KPI_PRESETS, exported decodeTokenPayload, and server last_week date range support
- Owner dashboard (1,957 lines) decomposed into 4 self-contained sub-tab components with SUPER_ADMIN-gated Users tab and real-time socket KPI updates
- Uniform date range filtering wired into all 4 dashboard tabs and 5 server endpoints with KPI_PRESETS and shared context persistence
- Added error logging to sales board refresh(), diagnosed CORS as root cause — Railway ALLOWED_ORIGINS needed sales board production URL

---

## v1.2 Platform Polish & Integration (Shipped: 2026-03-19)

**Phases completed:** 1 phases, 8 plans, 12 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.1 Customer Service (Shipped: 2026-03-18)

**Phases completed:** 7 phases, 15 plans
**Timeline:** 2026-03-17 → 2026-03-18 (2 days)
**Requirements:** 40/40 satisfied
**Audit:** passed (40/40 requirements, 40/40 integration, 8/8 E2E flows)

**Key accomplishments:**

- Customer Service dashboard with two-tab layout (Submissions + Tracking)
- Chargeback paste-to-parse submission workflow with batch support and editable preview
- Pending terms paste-to-parse submission workflow with 3-line parser
- Rich tracking tables with KPI counters, filters, sort, search, and CSV export
- Resolution workflow with resolve/unresolve, status filtering, and live KPI updates
- Role-gated access: CUSTOMER_SERVICE (tracking-only), SUPER_ADMIN/OWNER_VIEW (full access)
- Shared formatDollar/formatDate utilities extracted to @ops/utils across all 6 dashboards

---

## v1.0 MVP (Shipped: 2026-03-17)

**Phases completed:** 10 phases, 31 plans, 13 tasks

**Key accomplishments:**

- (none recorded)

---
