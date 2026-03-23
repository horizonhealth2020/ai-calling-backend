# Milestones

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
