# Project Research Summary

**Project:** v2.2 Chargeback Batch Review & Payroll Agent Tabs
**Domain:** Internal ops platform — payroll management and chargeback workflows
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

This is an enhancement to an existing internal ops platform that manages sales payroll, chargebacks, and agent performance tracking. Both features in scope — batch chargeback review and payroll agent tab navigation — are additive UI and workflow improvements built entirely on primitives already present in the codebase. No new dependencies are required, no schema migrations are needed, and no new architectural patterns are introduced. The recommended approach is composition of existing components and extraction of shared logic rather than greenfield development.

The recommended build order is payroll agent tabs first (pure UI refactor, zero API changes, lower risk) followed by batch chargeback review (one new read-only API endpoint, one new component, higher correctness requirements). The features are fully independent and can be parallelized if resources allow, but sequential delivery reduces coordination overhead and allows the team to validate the layout refactor before tackling the more critical chargeback workflow changes.

The key risk area is chargeback correctness: chargebacks directly trigger clawback creation which affects payroll. Batch submission multiplies the surface area for duplicate clawbacks, stale match data, and N+1 query problems. Every chargeback pitfall has a concrete prevention strategy, and all are addressable within the implementation phase without requiring architecture changes. Human review must remain mandatory before any batch submission.

## Key Findings

### Recommended Stack

No new dependencies are needed. The existing stack — Next.js 15, Express with asyncHandler/Zod/Prisma, React with inline CSSProperties, lucide-react for icons, Socket.IO via the shared provider, and the @ops/* shared packages — covers every requirement. The codebase has strong conventions against adding libraries (no table libraries, no form libraries, no query caches, no CSS-in-JS beyond inline styles), and both features are fully achievable within those constraints.

The two net-new backend touchpoints are: (1) a `GET /api/chargebacks/preview-match` endpoint that returns match status per memberId array without creating records, and (2) an optional `GET /api/payroll/agents/:id/periods` endpoint for future server-side pagination (not required for MVP — client-side slicing suffices). Both use existing Express/Zod/Prisma patterns.

**Core technologies:**
- Next.js 15 with inline CSSProperties: all UI — existing convention, no alternatives considered
- Express + asyncHandler + Zod: API validation and routing — existing pattern, extend only
- Prisma: database access — extend existing queries with `IN` clause batching and relation filtering
- Socket.IO via @ops/socket: real-time updates — extend with batch emission pattern to avoid N+1 dashboard refreshes
- @ops/ui (PageShell, ToastProvider, SkeletonCard, Button): shared UI primitives — use as-is
- React useState/useCallback/useMemo: all state management — no external state library

### Expected Features

**Must have (table stakes):**
- Multi-entry paste parsing with pre-submit review table — users paste carrier portal exports; batch is the natural extension of the existing single-paste flow
- Per-entry edit/remove before bulk submit — users need to correct parsed values before committing; existing `updateRecord()` pattern extends directly
- Matched agent display in review table — payroll staff must verify who gets clawed back before submission
- Agent tab sidebar in payroll — replace vertically-scrolled card list with left sidebar + content area layout
- Last 4 pay periods per agent with Load More — reduce visual clutter; client-side slice of existing data is sufficient for MVP

**Should have (differentiators):**
- Pre-submit match preview with MATCHED/MULTIPLE/UNMATCHED status badges — prevents bad chargebacks from entering the system; requires new preview endpoint
- Batch validation summary bar ("12 parsed, 10 matched, 1 unmatched") — instant confidence signal above the review table
- Agent period status indicators in sidebar — paid/unpaid badges next to agent names without clicking into each tab
- Round-robin assignment wired into batch review — already built for single-submission flow, needs wiring only

**Defer (v2+):**
- Partial product selection per chargeback entry in batch review — high complexity (N+1 lookups per batch entry); only meaningful for MATCHED entries
- Agent sidebar search/filter — only needed at 15+ agents; add based on roster growth
- Server-side period pagination — optimize only after measuring whether client-side slicing is insufficient

### Architecture Approach

Both features follow established codebase patterns and require minimal structural changes. Batch chargeback review adds a preview step between parse and submit using a `SubmitPhase` state machine ("input" → "review" → "submitting" → "done") and a new `ChargebackReviewTable` component. The existing `CSSubmissions.tsx` orchestrates this flow. Payroll agent tabs replace the vertical `AgentCard` scroll list with a flex layout (240px sidebar + content area) controlled by `selectedAgent` state; the existing `agentData` Map and `sortedAgents` array feed the sidebar without any data-layer changes.

**Major components:**
1. `ChargebackReviewTable` (new, `cs/ChargebackReviewTable.tsx`) — pre-submit review table showing match status, agent name, amounts, product toggles, and row removal
2. `AgentSidebar` (new, `payroll/AgentSidebar.tsx`) — left sidebar listing agents with sale counts and status indicators, click handler for selection
3. `CSSubmissions.tsx` (modified) — add SubmitPhase state machine, preview-match API call on parse, render ChargebackReviewTable in review phase
4. `PayrollPeriods.tsx` (modified) — replace AgentCard scroll list with AgentSidebar + single AgentCard for selected agent, add visiblePeriods Map state
5. `GET /api/chargebacks/preview-match` (new endpoint) — read-only memberId lookup returning match status array; reuses extracted `matchMemberIdToSale()` helper

### Critical Pitfalls

1. **Batch clawback duplicate on same-sale** — Two entries matching the same memberId each create a separate clawback because the dedupe guard runs per chargeback-id, not per sale. Prevention: pre-flight batch-level dedupe check in the review table UI and in the API endpoint; surface a warning for intra-batch collisions; API must reject duplicate saleIds within a single batch request.

2. **Consolidation destroying row identity before review** — Calling `consolidateByMember()` before the review table merges rows users need to see individually. Prevention: parse to `ParsedRow[]` and present unconsolidated in review; consolidation (if any) happens only at submit time after user confirmation.

3. **Socket.IO N+1 refresh storm** — A batch of 15 chargebacks fires 15 `alert_created` socket events, causing 15 consecutive payroll dashboard re-fetches. Prevention: collect all created alerts, emit one `alerts_batch_created` event with full list after all records are created (mirrors existing `emitCSChanged` pattern).

4. **Stale match data submitted** — Review table shows match status from parse time; by submit time the matched sale may have changed. Prevention: review table match info is informational only; server re-runs matching at submission time; never trust client-provided `matchedSaleId`; add a "Matches as of HH:MM" timestamp with a "Refresh matches" button if review sits open over 5 minutes.

5. **Agent tab state loss on Socket.IO update** — Period lock or socket refresh can trigger the re-initialization path, resetting the `selectedAgent` tab. Prevention: store `selectedAgentId` in a `useRef` (survives re-renders); use a merge strategy for socket-triggered updates rather than replacing the entire dataset; extend the existing `initializedRef` guard to cover agent tab selection.

6. **N+1 queries in batch chargeback submission** — The current handler loops and runs one `prisma.sale.findMany()` per chargeback (40+ queries for 20 entries). Prevention: collect all unique memberIds, run a single `prisma.sale.findMany({ where: { memberId: { in: memberIds } } })`, build a lookup map, batch-update in a single transaction.

## Implications for Roadmap

Based on combined research, a two-phase delivery is recommended. The features are fully independent and can be parallelized, but sequential delivery is recommended to keep focus on correctness.

### Phase 1: Payroll Agent Tab Navigation

**Rationale:** Self-contained UI layout refactor with zero API changes, zero schema changes, and zero migration. All data is already available in the existing `agentData` Map and `sortedAgents` array. Lowest risk of the two features. Provides immediate UX improvement for payroll users. Completing this first lets the team validate the sidebar layout pattern before touching the more critical chargeback workflow.

**Delivers:** Left sidebar listing all agents, content area showing the selected agent's last 4 pay periods, Load More button revealing additional periods, paid/unpaid status indicators in the sidebar.

**Addresses (from FEATURES.md):** Agent tab sidebar (table stakes), last 4 pay periods per agent (table stakes), Load More pagination (table stakes), agent period status indicators in sidebar (differentiator).

**Avoids (from PITFALLS.md):** Agent tab state loss on socket update — implement `useRef` guard from the start rather than as a patch. Client-side slicing avoids the fetch-all endpoint conflict pitfall entirely since no new endpoint is introduced.

**Components:** New `AgentSidebar`, modified `PayrollPeriods.tsx`. `AgentCard` and `WeekSection` remain unchanged.

**Research flag:** Not needed. Standard React layout refactor with well-understood patterns already present in the codebase.

### Phase 2: Batch Chargeback Review

**Rationale:** Requires one new API endpoint and correctness guarantees around clawback creation. Slightly higher complexity. The chargeback workflow is higher-stakes (directly affects payroll) and demands careful testing of edge cases: duplicate detection, partial failures, socket batching, and stale match data. Coming after Phase 1 lets the team give it undivided attention.

**Delivers:** Pre-submit review table with MATCHED/MULTIPLE/UNMATCHED status badges, per-row editing (amounts, rep assignment), row removal, batch validation summary bar, round-robin assignment wired into review table, bulk submit of confirmed entries only.

**Addresses (from FEATURES.md):** Multi-entry paste parsing with review table (table stakes), per-entry edit/remove (table stakes), matched agent display (table stakes), match preview with status badges (differentiator), batch validation summary bar (differentiator), round-robin assignment in batch review (differentiator).

**Avoids (from PITFALLS.md):** Consolidation before review (present `ParsedRow[]` unconsolidated), batch clawback duplicate (pre-flight dedupe check in UI and API), N+1 match queries (single `IN` clause and batch transaction), socket N+1 refresh (single `alerts_batch_created` event), stale match data (server re-validates at submit time).

**API changes:** Extract `matchMemberIdToSale()` helper from POST handler; add `GET /api/chargebacks/preview-match`; update POST handler to batch queries and use single transaction; add `records.max(100)` Zod validation.

**Research flag:** Not needed for standard implementation. The batch clawback dedupe logic warrants careful manual testing before merge — flag for QA attention, not deeper research.

### Phase Ordering Rationale

- Phase 1 first because it has zero backend changes and zero correctness risk; validating the layout refactor independently removes one variable when debugging Phase 2.
- Phase 2 second because it requires the only new API endpoint and has the highest correctness requirements; isolation lets the team focus on edge-case testing.
- Both features are independent (different files, different workflows, no shared state) — teams with bandwidth can run them in parallel with no coordination risk.
- Deferring partial product selection in batch review (requires N+1 per-entry sale lookups) and server-side period pagination (current data volume does not justify the complexity) is strongly recommended.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (Payroll Agent Tabs):** Pure UI layout refactor using the existing component hierarchy and data. Well-understood React pattern. No external integrations.
- **Phase 2 (Batch Chargeback Review):** All patterns are documented in codebase analysis. The new endpoint follows established Express/Zod/Prisma conventions. No external APIs or niche domain knowledge required.

Phases likely needing deeper attention during implementation (not research, but QA):
- **Phase 2, clawback dedupe logic:** Requires careful edge-case testing (same memberId twice in batch, MULTIPLE match status, period lock during batch processing). Flag for a dedicated QA session before merge.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on direct codebase analysis; no external sources needed — all decisions are constraint-driven by existing conventions |
| Features | HIGH | Based on direct analysis of existing components and current user workflow; requirements are concrete, not speculative |
| Architecture | HIGH | Component boundaries and data flow derived from reading actual source files; implementation patterns reference specific line ranges |
| Pitfalls | HIGH | All pitfalls identified from direct inspection of existing code paths (chargeback POST handler loop, alert emission pattern, payroll state management) |

**Overall confidence:** HIGH

### Gaps to Address

- **Batch size limit:** No upper bound is currently enforced on batch chargeback submission. PITFALLS.md recommends `records.max(100)` in Zod validation. Confirm the expected maximum paste size with product owners before finalizing.
- **`memberId` index on Sale table:** PITFALLS.md flags an unindexed `memberId` lookup as a performance trap for 10+ entries against 1000+ sales. Verify the index exists before deploying Phase 2 using `EXPLAIN ANALYZE` on the preview-match query during QA.
- **Socket.IO `alerts_batch_created` receiver:** The payroll dashboard and any other listeners must be updated to handle the new batch event alongside (or replacing) the per-item `alert_created` event. Ensure all listeners are updated atomically with the emitter change.

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis — `apps/ops-api/src/routes/chargebacks.ts` (submission handler, auto-match loop, alert creation)
- Direct codebase analysis — `apps/ops-api/src/routes/payroll.ts` (fetch-all endpoint, clawback creation flow)
- Direct codebase analysis — `apps/ops-api/src/services/alerts.ts` (dedupe guard, per-alert socket emission)
- Direct codebase analysis — `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` (parser, consolidation, round-robin, submit flow)
- Direct codebase analysis — `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (agent grouping, useMemo, initializedRef state guard)
- Direct codebase analysis — `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` (component interface, week sections)
- Direct codebase analysis — `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` (AgentData, AgentPeriodData types)
- Direct codebase analysis — `packages/ui/src/index.tsx` (PageShell, NavItem, UI primitives)
- Project constraints — `CLAUDE.md` (stack conventions, anti-patterns, known gotchas)
- Project constraints — `.planning/PROJECT.md` (milestone scope, validated requirements, key decisions)

### Secondary (MEDIUM confidence)

- Prisma documentation patterns (relation filtering, `IN` clause batching, `$transaction`) — applied to agent-scoped period queries and batch chargeback match optimization

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
