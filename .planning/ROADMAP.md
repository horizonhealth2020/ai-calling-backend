# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- [ ] **v1.1 Customer Service** — Phases 11-15

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-10) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Sales Entry Fix (3/3 plans) — completed 2026-03-14
- [x] Phase 2: Commission Engine Core (4/4 plans) — completed 2026-03-15
- [x] Phase 3: Commission Fees & Period Assignment (2/2 plans) — completed 2026-03-15
- [x] Phase 4: Multi-Product Sales Form (2/2 plans) — completed 2026-03-15
- [x] Phase 5: Commission Preview & Sale Editing (3/3 plans) — completed 2026-03-15
- [x] Phase 6: Dashboard Cascade (3/3 plans) — completed 2026-03-16
- [x] Phase 7: Payroll Management (2/2 plans) — completed 2026-03-16
- [x] Phase 8: Reporting (2/2 plans) — completed 2026-03-16
- [x] Phase 9: UI/UX Polish (4/4 plans) — completed 2026-03-17
- [x] Phase 10: Sale Status Payroll Logic (6/6 plans) — completed 2026-03-16

</details>

### v1.1 Customer Service (Phases 11-15)

- [x] **Phase 11: Foundation & Dashboard Shell** - Schema, role, app scaffold, auth redirect
- [x] **Phase 12: Chargeback Parser** - Paste raw text, parse fields, editable preview, batch submit (completed 2026-03-17)
- [x] **Phase 13: Pending Terms Parser** - Paste raw text, parse fields, editable preview, batch submit (completed 2026-03-17)
- [x] **Phase 14: Tracking Tables** - Chargeback + pending terms KPI bars, filterable/sortable/groupable tables, CSV export (completed 2026-03-18)
- [ ] **Phase 15: Resolution & Polish** - Mark resolved with notes, status filtering, date/dollar formatting, role gating, live updates

## Phase Details

### Phase 11: Foundation & Dashboard Shell
**Goal**: Database tables exist, new role works end-to-end, and the Customer Service dashboard loads with tab navigation
**Depends on**: Nothing (first v1.1 phase)
**Requirements**: SCHEMA-01, SCHEMA-02, ROLE-01, DASH-01, DASH-03
**Success Criteria** (what must be TRUE):
  1. Prisma schema has chargeback_submissions and pending_terms tables with all specified columns and migrations run cleanly
  2. A user with customer_service role can log in via auth portal and land on the Customer Service dashboard
  3. The Customer Service dashboard loads with a two-tab layout (Submissions / Tracking) visible in the nav
  4. The customer_service role exists in AppRole enum and is recognized by RBAC middleware
**Plans:** 2/2 plans complete
Plans:
- [x] 11-01-PLAN.md — Schema + role: Prisma models, migration SQL, AppRole type
- [x] 11-02-PLAN.md — Dashboard shell + auth wiring: cs-dashboard app, auth portal, env/config

### Phase 12: Chargeback Parser
**Goal**: Users can paste raw chargeback text and submit parsed records to the database
**Depends on**: Phase 11 (schema and dashboard shell must exist)
**Requirements**: CHBK-01, CHBK-02, CHBK-03, CHBK-04, CHBK-05, CHBK-06
**Success Criteria** (what must be TRUE):
  1. User pastes raw chargeback text into the Submissions tab and sees parsed records as editable preview cards
  2. Chargeback amounts extracted from parenthesized dollar patterns display as negative decimals
  3. User can set posted_date via date picker and override the type field before submitting
  4. Bulk paste of multiple records parses all records sharing a single batch_id
  5. Confirmed records persist to chargeback_submissions with raw_paste, submitted_by, and submitted_at populated
**Plans:** 3/3 plans complete
Plans:
- [x] 12-01-PLAN.md — Schema changes (assigned_to, CsRepRoster) + 6 API endpoints
- [x] 12-02-PLAN.md — Client-side parser + full Submissions tab UI
- [ ] 12-03-PLAN.md — Human verification of end-to-end flow

### Phase 13: Pending Terms Parser
**Goal**: Users can paste raw pending terms text and submit parsed records to the database
**Depends on**: Phase 11 (schema and dashboard shell must exist)
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05, TERM-06
**Success Criteria** (what must be TRUE):
  1. User pastes raw pending terms text into the Submissions tab and sees parsed records as editable preview cards
  2. hold_date is stored as DATE only and hold_reason as TEXT only -- two distinct fields never mixed
  3. Bulk paste detects multiple records by agent name pattern, all sharing a batch_id
  4. Missing or malformed fields store as null without crashing the parser or blocking submission
  5. Confirmed records persist to pending_terms with raw_paste, submitted_by, and submitted_at populated
**Plans:** 2/2 plans complete
Plans:
- [x] 13-01-PLAN.md — Schema (assignedTo field) + 3 API endpoints (POST/GET/DELETE)
- [x] 13-02-PLAN.md — Client-side 3-line parser + editable preview table UI

### Phase 14: Tracking Tables
**Goal**: Users can view, search, filter, sort, group, and export both chargeback and pending terms records
**Depends on**: Phase 12 (chargebacks), Phase 13 (pending terms)
**Requirements**: TRKC-01, TRKC-02, TRKC-03, TRKC-04, TRKC-05, TRKC-06, TRKT-01, TRKT-02, TRKT-03, TRKT-04, TRKT-05, TRKT-06, TRKT-07
**Success Criteria** (what must be TRUE):
  1. KPI counter bar shows Total Chargebacks (red), Total Recovered (green), Net Exposure (red/green), Records count with animated count-up
  2. Chargeback table displays 8 data columns (Date Posted, Member, Member ID, Product, Type, Total, Assigned To, Submitted) per locked decision in 14-CONTEXT.md, with chargeback_amount always rendered in red
  3. Chargeback table is filterable by date range, product, member company, member agent company, and chargeback amount range
  4. Chargeback table is searchable by payee name, member agent company, member ID, and member agent ID
  5. Summary bar shows total pending records, count by hold_reason category, and count of next_billing within 7 days highlighted as urgent/red
  6. Pending terms table displays 7 columns (Member Name, Member ID, Phone, Product, Hold Date, Next Billing, Assigned To) with color coding (hold_date red, next_billing green; hold_reason and active/first_billing not shown as columns per locked decision)
  7. agent_name and agent_id are stored in the database but never shown as visible table columns
  8. Pending terms table supports group-by-agent with collapsible sections using agent name as the group header
  9. CSV export button is visible only to owner and super_admin roles on both tables
**Plans:** 2/2 plans complete
Plans:
- [x] 14-01-PLAN.md — API totals endpoint + KPI bar + search/filter + sortable chargeback table + export button
- [x] 14-02-PLAN.md — Pending terms summary bar + grouped table + pending filters + CSV export wiring

### Phase 15: Resolution & Polish
**Goal**: Customer service staff can mark records as resolved, filter by status, and all formatting/role gating is consistent
**Depends on**: Phase 14 (tracking tables must exist)
**Requirements**: RESV-01, RESV-02, RESV-03, RESV-04, ROLE-02, ROLE-03, ROLE-04, DASH-02, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Customer service can click a resolve action on any chargeback or pending term record and enter a resolution note
  2. Resolved records display resolved status, resolved_by user, resolved_at timestamp, and the resolution note
  3. Both tracking tables default to showing open records and can toggle to show resolved or all records
  4. customer_service role sees only the Tracking tab; Submissions tab is hidden and its routes are blocked
  5. owner and super_admin roles see both Submissions and Tracking tabs
  6. All dates render as M/D/YYYY and all dollar amounts render with commas and 2 decimal places across the entire dashboard
  7. Counters, filters, and summary bars update without full page reload when data or filter state changes
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Sales Entry Fix | v1.0 | 3/3 | Complete | 2026-03-14 |
| 2. Commission Engine Core | v1.0 | 4/4 | Complete | 2026-03-15 |
| 3. Commission Fees & Period Assignment | v1.0 | 2/2 | Complete | 2026-03-15 |
| 4. Multi-Product Sales Form | v1.0 | 2/2 | Complete | 2026-03-15 |
| 5. Commission Preview & Sale Editing | v1.0 | 3/3 | Complete | 2026-03-15 |
| 6. Dashboard Cascade | v1.0 | 3/3 | Complete | 2026-03-16 |
| 7. Payroll Management | v1.0 | 2/2 | Complete | 2026-03-16 |
| 8. Reporting | v1.0 | 2/2 | Complete | 2026-03-16 |
| 9. UI/UX Polish | v1.0 | 4/4 | Complete | 2026-03-17 |
| 10. Sale Status Payroll Logic | v1.0 | 6/6 | Complete | 2026-03-16 |
| 11. Foundation & Dashboard Shell | v1.1 | Complete    | 2026-03-17 | 2026-03-17 |
| 12. Chargeback Parser | 3/3 | Complete    | 2026-03-17 | - |
| 13. Pending Terms Parser | v1.1 | Complete    | 2026-03-17 | 2026-03-17 |
| 14. Tracking Tables | v1.1 | 2/2 | Complete | 2026-03-18 |
| 15. Resolution & Polish | v1.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-14*
*v1.1 phases added: 2026-03-17*
