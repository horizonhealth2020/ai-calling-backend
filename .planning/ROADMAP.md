# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish & Integration** — Phase 18 (shipped 2026-03-19)
- ✅ **v1.3 Dashboard Consolidation & Uniform Date Ranges** — Phase 19 (shipped 2026-03-23)
- ✅ **v1.4 State-Aware Bundle Requirements** — Phase 20 (shipped 2026-03-23)
- ✅ **v1.5 Platform Cleanup & Remaining Features** — Phases 21-24 (shipped 2026-03-24)
- [ ] **v1.6 Pre-Launch Stabilization** — Phases 25-28

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

<details>
<summary>✅ v1.1 Customer Service (Phases 11-17) — SHIPPED 2026-03-18</summary>

- [x] Phase 11: Foundation & Dashboard Shell (2/2 plans) — completed 2026-03-17
- [x] Phase 12: Chargeback Parser (3/3 plans) — completed 2026-03-17
- [x] Phase 13: Pending Terms Parser (2/2 plans) — completed 2026-03-17
- [x] Phase 14: Tracking Tables (2/2 plans) — completed 2026-03-18
- [x] Phase 15: Resolution & Polish (4/4 plans) — completed 2026-03-18
- [x] Phase 16: Auth & Permission Tightening (1/1 plan) — completed 2026-03-18
- [x] Phase 17: Documentation & Permission Cleanup (1/1 plan) — completed 2026-03-18

</details>

<details>
<summary>✅ v1.2 Platform Polish & Integration (Phase 18) — SHIPPED 2026-03-19</summary>

- [x] Phase 18: Platform Polish & Integration (8/8 plans) — completed 2026-03-19

</details>

<details>
<summary>✅ v1.3 Dashboard Consolidation & Uniform Date Ranges (Phase 19) — SHIPPED 2026-03-23</summary>

- [x] Phase 19: Dashboard Consolidation & Uniform Date Ranges (10/10 plans) — completed 2026-03-23

</details>

<details>
<summary>✅ v1.4 State-Aware Bundle Requirements (Phase 20) — SHIPPED 2026-03-23</summary>

- [x] Phase 20: State-Aware Bundle Requirements (5/5 plans) — completed 2026-03-23

</details>

<details>
<summary>✅ v1.5 Platform Cleanup & Remaining Features (Phases 21-24) — SHIPPED 2026-03-24</summary>

- [x] Phase 21: Route File Splitting (1/1 plan) — completed 2026-03-24
- [x] Phase 22: Owner & Payroll Enhancements (2/2 plans) — completed 2026-03-24
- [x] Phase 23: AI Scoring Dashboard (1/1 plan) — completed 2026-03-24
- [x] Phase 24: Chargeback Automation & Data Archival (4/4 plans) — completed 2026-03-24

</details>

### v1.6 Pre-Launch Stabilization (Phases 25-28)

- [x] **Phase 25: File Structure Cleanup** - Relocate Morgan, delete stale apps, clean orphaned files and docs
- [ ] **Phase 26: Dead Code Removal** - Eliminate unused imports, functions, commented code, and dependencies
- [ ] **Phase 27: Error Handling & Robustness** - Harden async handlers, validation, DB errors, and Socket.IO
- [ ] **Phase 28: Type Safety Audit** - Eliminate `any` types, align response types, annotate package exports

## Phase Details

### Phase 25: File Structure Cleanup
**Goal**: The repository has a professional, navigable structure with no stale or misplaced files
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: FS-01, FS-02, FS-03, FS-04
**Success Criteria** (what must be TRUE):
  1. Morgan voice service runs from `apps/morgan/` and all existing deployment configs (Docker, Railway) work without changes to Morgan behavior
  2. `apps/payroll-dashboard/` directory no longer exists and no references to it remain in workspace configs or Docker files
  3. No orphaned config files, scripts, or leftover artifacts from previous milestones exist at the repo root (beyond expected monorepo root files)
  4. FIXES.md, ISSUES.md, TESTING.md, and docs/ are gone -- any useful content lives in README.md
**Plans**: 2 plans
Plans:
- [x] 25-01-PLAN.md — Relocate Morgan voice service to apps/morgan/ and update package.json scripts
- [x] 25-02-PLAN.md — Delete stale apps/docs, consolidate into README, update CLAUDE.md

### Phase 26: Dead Code Removal
**Goal**: Every import, function, component, and dependency in the codebase is actively used
**Depends on**: Phase 25 (file structure must be final before auditing code)
**Requirements**: DC-01, DC-02, DC-03, DC-04
**Success Criteria** (what must be TRUE):
  1. No unused imports exist across any app or package (verified by linter or manual audit)
  2. Every exported function and component has at least one call site in the codebase
  3. No commented-out code blocks remain (comments explaining "why" are fine; disabled code is not)
  4. Every dependency in every package.json is imported somewhere in that package's source code
**Plans**: 2 plans
Plans:
- [x] 26-01-PLAN.md — Remove unused imports and commented-out code blocks across all source files
- [ ] 26-02-PLAN.md — Remove unreferenced exports/functions and unused dependencies from package.json files

### Phase 27: Error Handling & Robustness
**Goal**: The API handles bad input, connection failures, and edge cases without crashing or leaking errors
**Depends on**: Phase 26 (dead code removed so audit scope is accurate)
**Requirements**: EH-01, EH-02, EH-03, EH-04
**Success Criteria** (what must be TRUE):
  1. Every async route handler in ops-api is wrapped with `asyncHandler()` or equivalent -- an unhandled rejection in any handler returns a 500 JSON error, not a crash
  2. Every API endpoint that reads from `req.body`, `req.params`, or `req.query` validates input through a Zod schema before use -- no raw property access on unvalidated request data
  3. Database operations that could fail on connection loss or timeout return user-friendly error responses instead of raw Prisma errors
  4. Every Socket.IO event handler has a try/catch wrapper so a single malformed event does not disconnect the client
**Plans**: 2 plans
Plans:
- [ ] 25-01-PLAN.md — Relocate Morgan voice service to apps/morgan/ and update package.json scripts
- [ ] 25-02-PLAN.md — Delete stale apps/docs, consolidate into README, update CLAUDE.md

### Phase 28: Type Safety Audit
**Goal**: The codebase has strict type safety with no implicit `any` leaking through application code
**Depends on**: Phase 27 (error handling changes may introduce new types)
**Requirements**: TS-01, TS-02, TS-03
**Success Criteria** (what must be TRUE):
  1. A search for explicit `any` type annotations in application code (excluding node_modules and third-party type stubs) returns zero results
  2. API response objects returned from route handlers match their documented/typed shapes -- no extra fields, no missing fields
  3. Every export from `@ops/auth`, `@ops/types`, `@ops/utils`, `@ops/ui`, and `@ops/db` has an explicit TypeScript type annotation on its signature
**Plans**: 2 plans
Plans:
- [ ] 25-01-PLAN.md — Relocate Morgan voice service to apps/morgan/ and update package.json scripts
- [ ] 25-02-PLAN.md — Delete stale apps/docs, consolidate into README, update CLAUDE.md

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
| 11. Foundation & Dashboard Shell | v1.1 | 2/2 | Complete | 2026-03-17 |
| 12. Chargeback Parser | v1.1 | 3/3 | Complete | 2026-03-17 |
| 13. Pending Terms Parser | v1.1 | 2/2 | Complete | 2026-03-17 |
| 14. Tracking Tables | v1.1 | 2/2 | Complete | 2026-03-18 |
| 15. Resolution & Polish | v1.1 | 4/4 | Complete | 2026-03-18 |
| 16. Auth & Permission Tightening | v1.1 | 1/1 | Complete | 2026-03-18 |
| 17. Documentation & Permission Cleanup | v1.1 | 1/1 | Complete | 2026-03-18 |
| 18. Platform Polish & Integration | v1.2 | 8/8 | Complete | 2026-03-19 |
| 19. Dashboard Consolidation & Uniform Date Ranges | v1.3 | 10/10 | Complete | 2026-03-23 |
| 20. State-Aware Bundle Requirements | v1.4 | 5/5 | Complete | 2026-03-23 |
| 21. Route File Splitting | v1.5 | 1/1 | Complete | 2026-03-24 |
| 22. Owner & Payroll Enhancements | v1.5 | 2/2 | Complete | 2026-03-24 |
| 23. AI Scoring Dashboard | v1.5 | 1/1 | Complete | 2026-03-24 |
| 24. Chargeback Automation & Data Archival | v1.5 | 4/4 | Complete | 2026-03-24 |
| 25. File Structure Cleanup | v1.6 | 2/2 | Complete    | 2026-03-25 |
| 26. Dead Code Removal | v1.6 | 1/2 | In progress | - |
| 27. Error Handling & Robustness | v1.6 | 0/? | Not started | - |
| 28. Type Safety Audit | v1.6 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-14*
*v1.0 shipped: 2026-03-17*
*v1.1 shipped: 2026-03-18*
*v1.2 shipped: 2026-03-19*
*v1.3 shipped: 2026-03-23*
*v1.4 shipped: 2026-03-23*
*v1.5 shipped: 2026-03-24*
*v1.6 roadmap created: 2026-03-25*
