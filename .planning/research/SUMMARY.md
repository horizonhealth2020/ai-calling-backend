# Project Research Summary

**Project:** Ops Platform v2.1 — Chargeback Processing, Payroll Layout & Dashboard Polish
**Domain:** Internal sales operations platform — incremental iteration
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

This is a tightly scoped internal ops platform milestone (v2.1) built on a mature, validated stack. The research is grounded entirely in direct codebase analysis — not documentation hunting — because the codebase itself is the primary source of truth. Every feature in v2.1 is an extension or refinement of something already built: CSV upload extends an existing paste-to-parse flow, the payroll sidebar restructures an existing period-first layout, ACA editing adds form fields to an existing read-only view, and the remaining four changes are configuration tweaks. Zero new npm packages are required.

The recommended approach is to build in three phases ordered by risk and independence: quick fixes first (four independent, low-risk changes that each touch one file), then CSV batch processing (medium complexity with a new client-side UI path), then ACA product editing and the payroll sidebar redesign (the two features that require the most structural change). This order lets the team ship four improvements immediately while the larger changes are in flight, and it avoids blocking work on the highest-risk item (the 91K PayrollPeriods.tsx refactor).

The primary risk is financial data correctness. Two pitfalls are categorized as critical: (1) the enrollment fee $0 default, which if applied to the commission engine rather than just the UI badge will silently halve commission for every historical sale without an enrollment fee, and (2) partial CSV batch failures, where a mid-loop failure leaves orphaned payroll alerts. Both risks are fully preventable through surgical scoping of the enrollment fee fix and Prisma transaction wrapping for the CSV batch. All pitfalls identified have direct code references and concrete prevention steps.

## Key Findings

### Recommended Stack

The existing stack is sufficient for all six v2.1 features without any additions. The codebase has a documented philosophy of preferring inline implementations over external dependencies (inline SVG sparklines instead of a chart library, paste-to-parse instead of a file upload library). This philosophy holds for v2.1: the CSV upload uses the browser FileReader API and a custom `parseCSVLine()` function rather than PapaParse, and the payroll sidebar uses `useState` and CSS flexbox rather than a component library.

**Core technologies (unchanged for v2.1):**
- Next.js 15.3.9: Dashboard framework — sufficient for all new components
- React 18.3.1: UI components — `useState` handles all new state needs
- Express 4.19.2: API server — existing endpoints accept all required payloads
- Prisma 5.20.0: ORM — `$transaction` needed for CSV batch safety
- Zod 3.23.8: Input validation — schema extensions needed for ACA_PL fields
- Browser FileReader API: CSV file reading — no install, all modern browsers

### Expected Features

Research produced a clear four-phase MVP definition with each feature categorized by user value and implementation cost.

**Must have (table stakes):**
- CSV upload for batch chargebacks — natural extension of existing paste-to-parse workflow; users already deal with carrier CSV reports
- Pre-submit review table with match badges — batch operations require visual confirmation before commit; 50-row batches cannot be undone easily
- Enrollment fee defaults to $0 — fixes inconsistent half-commission badge behavior; deterministic behavior is a correctness requirement
- Call audit rolling window (last 30 audits) — time-based default shows nothing on slow days; count-based is predictably useful

**Should have (competitive advantage):**
- Payroll agent sidebar redesign — master-detail pattern makes per-agent payroll review dramatically faster for payroll staff
- ACA product editable in payroll Products tab — removes developer intervention for flat commission rate changes
- Performance tracker sections start expanded — removes a friction click from every page load for analytics staff
- Sparkline data fix — analytics section is present but silently broken; fixes trust in the feature

**Defer to v2.2+:**
- Drag-and-drop column mapping for CSV — generic mapper adds significant complexity for a single-format carrier report
- Full-text transcript search — requires indexing infrastructure; existing filters are sufficient
- Real-time sidebar totals via Socket.IO — navigation aid does not need live updates; adds re-render complexity

### Architecture Approach

All six features integrate into the existing three-layer architecture (ops-dashboard -> ops-api -> Prisma/PostgreSQL) with no new services, no schema migrations, and no new shared packages. The CSV upload is purely a new client-side input path feeding an existing API endpoint. The payroll redesign is a client-side data pivot from period-first to agent-first grouping using data already returned by the existing endpoint. The four quick fixes each touch a single file at a specific line.

**Major components and their changes:**
1. `CSSubmissions.tsx` — add CSV upload UI path alongside existing paste; feeds same `POST /chargebacks` endpoint
2. `PayrollPeriods.tsx` — major refactor (91K file); extract agent sidebar, pivot from period-first to agent-first rendering
3. `PayrollProducts.tsx` — add ACA_PL edit fields (`flatCommission`, addon qualifier toggles)
4. `payroll.ts` (service) — three-line fix: treat null `enrollmentFee` as $0 in `applyEnrollmentFee()` only
5. `call-audits.ts` (API route) — remove 24h time window default; rely on existing count-based `take: 30`
6. `LeadTimingSection.tsx` / `LeadTimingSparklines.tsx` — one-line expanded default + sparkline data pipeline fix

### Critical Pitfalls

1. **CSV partial batch failures** — Wrap entire CSV batch in Prisma `$transaction`; validate all rows client-side before submit; generate deterministic batchId from file hash to prevent re-upload duplicates. The existing `createMany` + alert loop pattern is not atomic.

2. **Enrollment fee $0 causes commission regression** — The fix must be scoped exclusively to the UI badge display and the form default. Do NOT change `applyEnrollmentFee()` in `payroll.ts` to treat null as $0 — this would halve commission on every historical sale without an enrollment fee. The payroll UI already correctly guards with `enrollmentFee !== null &&` checks.

3. **ACA flatCommission retroactive corruption** — When `flatCommission` changes, any future recalculation of existing payroll entries uses the new rate. Add a warning dialog ("This affects future recalculations only") and log the change via `logAudit`. Snapshot deferral is acceptable for v2.1.

4. **Payroll sidebar empty states** — Agents with zero payroll entries produce a blank right panel that looks broken. Show "No payroll entries yet" empty state; filter to active agents by default; add visual indicators in sidebar for agents with/without entries.

5. **Sparkline date key format mismatch** — Prisma raw queries return PostgreSQL `date` type with unpredictable serialization. Fix by using `TO_CHAR(timestamp, 'YYYY-MM-DD') AS day` in the SQL rather than `::date`, guaranteeing consistent string format on both ends.

## Implications for Roadmap

Based on research, the dependency graph and risk profile suggest a four-phase structure. Phase 1 items are all independent and can be executed in parallel by multiple developers.

### Phase 1: Quick Fixes
**Rationale:** Four independent changes with zero dependencies on each other or on later phases. Each is one to eight lines in a single file. High value-to-effort ratio — ship immediately to reduce backlog pressure and validate the deployment pipeline before larger changes land.
**Delivers:** Correct enrollment fee behavior, consistent audit density, visible analytics sections, working sparklines.
**Addresses:** Enrollment fee $0 default, audit rolling window, tracker expanded state, sparkline data fix.
**Avoids:** Pitfall 2 (commission regression) by scoping the enrollment fee fix to UI only; Pitfall 7 (sparkline date mismatch) by applying `TO_CHAR` SQL fix.

### Phase 2: CSV Batch Chargeback Processing
**Rationale:** Medium-complexity feature with clear client-side scope. Does not depend on Phase 1. The primary input risk (partial batch failures) has a known prevention (Prisma transaction). Ships after Phase 1 to have a clean baseline, but does not need to wait for Phases 3 or 4.
**Delivers:** File-based chargeback submission with pre-submit review, match badges, row editing, and batch safety.
**Addresses:** CSV batch upload (table stakes), pre-submit review with match indicators (table stakes).
**Avoids:** Pitfall 1 (partial batch) via transaction wrapping and client-side validation; Pitfall 5 (CSV parsing edge cases) via BOM stripping and quoted-field handling; Pitfall 10 (browser memory) via row cap.
**Note on library decision:** PITFALLS.md recommends PapaParse for robustness; STACK.md recommends against it for consistency with codebase conventions. Resolve during implementation by inspecting an actual carrier CSV export. If the format is confirmed tab-delimited, the custom parser suffices.

### Phase 3: ACA Product Editing
**Rationale:** Self-contained extension of existing product CRUD. Does not depend on Phase 1 or 2. Moderate complexity — UI form additions with matching Zod schema changes. Ships separately from the payroll sidebar to isolate risks.
**Delivers:** Editable `flatCommission` and addon qualifier configuration for ACA_PL products without developer intervention.
**Addresses:** ACA product editable (should have).
**Avoids:** Pitfall 3 (retroactive commission corruption) via warning dialog and audit log; Pitfall 8 (circular addon dependencies) via type-conditional field visibility and server-side validation.

### Phase 4: Payroll Agent Sidebar Redesign
**Rationale:** Largest change in the milestone (91K file refactor, 300-500 lines changed). Ships last to avoid blocking other work and to have a stable base. Independent of all other phases but benefits from a fully tested deployment pipeline.
**Delivers:** Agent-first payroll navigation with sidebar, per-agent historical view, last 4 pay cards, and "Load More" pagination.
**Addresses:** Payroll agent sidebar (should have, high user value for payroll staff).
**Avoids:** Pitfall 4 (empty state chaos) via empty state components and active agent filtering; Pitfall 9 (sort order inconsistency) via `displayOrder` then alphabetical sort; Pitfall 12 (unbounded load more) via 20-period hard cap.

### Phase Ordering Rationale

- Phase 1 before everything: zero dependencies, immediate wins, validates deployment
- Phase 2 before Phase 3/4: CSV processing has external user impact (CS staff) vs internal payroll staff; higher urgency
- Phase 3 before Phase 4: ACA editing is scoped and lower risk; completes before the largest change goes in
- Phase 4 last: highest structural change, largest single file modification, benefits from stable prior phases

### Research Flags

Phases with well-documented patterns (skip deeper research-phase):
- **Phase 1:** All four changes are trivial code modifications with exact line references in research. No additional research needed.
- **Phase 3:** Extends existing product CRUD with known patterns. Zod schema additions are standard.

Phases that may benefit from targeted investigation during planning:
- **Phase 2 (CSV parsing decision):** Resolve the PapaParse vs custom parser conflict. Obtain one actual carrier chargeback CSV export to inspect headers, encoding, and quoting before committing to implementation approach.
- **Phase 4 (PayrollPeriods.tsx refactor):** The file is 91K. Before writing code, map the exact component boundaries to extract. Identify which sub-components (`AgentPayCard`, period accordion) can be reused versus replaced.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All conclusions from direct `package.json` and dependency analysis. No external docs needed — existing stack is definitively sufficient. |
| Features | HIGH | All features derived from direct code inspection of existing flows. User expectations are grounded in the current product, not speculation. |
| Architecture | HIGH | Component boundaries, data flow, and file-level change estimates all from direct code analysis. Line numbers cited for key changes. |
| Pitfalls | HIGH | All pitfalls identified from actual code patterns with specific file and line references. No hypothetical scenarios. |

**Overall confidence:** HIGH

### Gaps to Address

- **CSV parser library decision:** STACK.md (no library) and PITFALLS.md (use PapaParse) give conflicting recommendations. Resolution requires a real carrier CSV sample. If the format is truly tab-delimited, a custom parser suffices; if it is standard RFC 4180 CSV with encoding variation, add PapaParse and document the exception.

- **Enrollment fee fix scope:** Research confirmed the fix must NOT touch `applyEnrollmentFee()` in `payroll.ts`. The exact location of the UI badge bug needs verification during implementation — likely `PayrollPeriods.tsx:1505` and the commission preview endpoint.

- **Sparkline root cause:** The `TO_CHAR` SQL fix addresses the probable cause (date key format mismatch from Prisma raw query). If sparklines remain broken after that fix, inspect the actual API response format in the running environment before further debugging.

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` — existing paste-to-parse chargeback flow and parser
- `apps/ops-api/src/routes/chargebacks.ts` — batch chargeback API contract, `createMany` + alert loop
- `apps/ops-api/src/routes/call-audits.ts` — 24h default window at lines 44-52
- `apps/ops-api/src/routes/products.ts` — product CRUD Zod schemas
- `apps/ops-api/src/routes/lead-timing.ts` — sparkline 7-day series query with date casting
- `apps/ops-api/src/services/payroll.ts` — commission engine, `applyEnrollmentFee()` at lines 55-84
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — 91K agent card component, enrollment fee guards at line 1505, agent grouping at line 1701+
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` — product management UI (no ACA_PL fields currently)
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx` — collapsed default at line 75
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSparklines.tsx` — sparkline rendering
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` — audit display
- `prisma/schema.prisma` — Product model, ChargebackSubmission, CallAudit
- `apps/ops-api/src/services/__tests__/commission.test.ts` — COMM-08 enrollment fee test cases
- `apps/ops-dashboard/package.json` — current dependency list

### Secondary (project decision history)
- Inline SVG sparklines chosen over charting library — establishes no-external-library precedent for v2.1
- Paste-to-parse chosen over file upload middleware — establishes client-side parsing precedent for CSV upload

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
