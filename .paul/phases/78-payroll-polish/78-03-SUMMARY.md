---
phase: 78-payroll-polish
plan: 03
subsystem: ui
tags: [react, payroll, prisma, print, typescript, notes]

requires:
  - phase: 78-02
    provides: Phase 78 fronted formula (net formula liveNet fix cascades here)

provides:
  - Server-side unapprove gate (OPEN periods only)
  - AgentPeriodAdjustment.notes field + POST endpoint + week note box UI
  - ACH print row: full green row (print-color-adjust: exact + td coverage)
  - Unapprove button: hidden on LOCKED/FINALIZED periods (client + server)
  - CS payroll print: agent name on same line as "Customer Service Payroll", per-agent cards
  - PayrollService.tsx: Total green, agent name bold+centered
  - memberId sort: pre-existing at WeekSection line 666 (no change needed)

affects: payroll-periods, payroll-print, cs-payroll, agent-card

tech-stack:
  added: []
  patterns:
    - "Browser print strips backgrounds — print-color-adjust: exact required on both tr and td"
    - "CS print restructured to per-agent cards: each agent owns their own header+table block"
    - "SMALL_INP (not baseInputStyle) is the correct compact input style in WeekSection"

key-files:
  created:
    - prisma/migrations/20260416000002_agent_period_adjustment_notes/migration.sql
  modified:
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollService.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - prisma/schema.prisma

key-decisions:
  - "Unapprove blocked server-side (logAudit on blocked attempt) + client-side hidden — defense in depth"
  - "Notes endpoint: POST /api/payroll/adjustments/notes with upsert (composite key) — not PATCH/:id pattern"
  - "ACH print: print-color-adjust: exact on both tr and td — tr-only is stripped by Chrome"
  - "CS print: per-agent card layout (name top-right of header line) — not shared table across agents"
  - "liveNet formula in WeekSection fixed to Phase 78 (fronted deducts) — discovered bonus fix"
  - "PATCH /payroll/entries/:id net formula also fixed to Phase 78 (was still Phase 71)"

patterns-established:
  - "Per-agent print cards: each agent gets own header block + page-break separator"
  - "Print-specific background: must target both tr AND td with print-color-adjust: exact"

duration: ~45min
started: 2026-04-16T00:00:00Z
completed: 2026-04-16T00:00:00Z
---

# Phase 78 Plan 03: Payroll Polish + Print + Notes

**Unapprove gated to OPEN periods (server+client), week note box (schema+API+UI), ACH full-row green in print, CS payroll print per-agent cards with name on header line, Total green + name bold in service table.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~45 min |
| Tasks | 4 auto + 1 checkpoint |
| Files modified | 6 |
| Tests | 186/186 pass |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Unapprove only for OPEN periods | Pass | Server gate (400 + logAudit) + client hidden |
| AC-2: Agent card sorted by memberId ASC | Pass | Pre-existing at WeekSection:666 — no change needed |
| AC-3: ACH print row green | Pass | `print-color-adjust: exact` on tr+td; verified by user |
| AC-4: Week note box saves + print behavior | Pass | SMALL_INP fix needed (baseInputStyle undefined) |
| AC-5: CS payroll card cosmetics | Pass | Per-agent cards; name right of header; Total green |

## Accomplishments

- **Defense in depth for unapprove**: server returns 400 with logAudit when period isn't OPEN; client hides button. Prevents API bypass.
- **Week note box**: AgentPeriodAdjustment.notes schema field, migration, POST endpoint with upsert, textarea in WeekSection that saves on blur and hides on print when empty.
- **ACH print fix**: `print-color-adjust: exact` on both `tr[data-ach="true"]` AND `tr[data-ach="true"] td` — browser print mode strips `tr` backgrounds without this.
- **CS print restructured**: Each agent gets their own card with "Customer Service Payroll ... [Name]" on the header line and per-agent totals. Page breaks between agents.
- **Phase 78 liveNet formula fix**: WeekSection live net display still used Phase 71 formula (fronted additive). Fixed to deduct fronted. Also fixed `PATCH /payroll/entries/:id` route which had same bug.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modified | Added `notes String?` to AgentPeriodAdjustment |
| `prisma/migrations/.../migration.sql` | Created | `ALTER TABLE agent_period_adjustments ADD COLUMN notes TEXT` |
| `apps/ops-api/src/routes/sales.ts` | Modified | Server-side unapprove gate (period status check) |
| `apps/ops-api/src/routes/payroll.ts` | Modified | POST /payroll/adjustments/notes; GET explicit select; PATCH entries net formula Phase 78 |
| `apps/ops-dashboard/.../WeekSection.tsx` | Modified | Unapprove gate, data-ach print, note textarea, liveNet formula, print CSS |
| `apps/ops-dashboard/.../PayrollService.tsx` | Modified | Total green, agent name bold+centered |
| `apps/ops-dashboard/.../PayrollPeriods.tsx` | Modified | CS print restructured to per-agent cards with name on header line |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| SMALL_INP not baseInputStyle in WeekSection | baseInputStyle not imported; SMALL_INP is the local compact input style | Runtime error fixed during verify |
| print-color-adjust: exact on tr AND td | Browser print strips background-color on tr alone without -webkit-print-color-adjust | Full row green in print |
| Per-agent CS print cards | "Name same line as Customer Service Payroll" — flex header with name right-aligned | Each agent gets own printout with page break |
| liveNet Phase 78 fix | WeekSection was still showing Phase 71 formula (fronted additive); incorrect live preview | Bonus fix in same file |
| PATCH /payroll/entries/:id net formula | Same Phase 71 bug in manual entry adjustment route | Bonus fix ensuring consistency |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| No-op (pre-existing) | 1 | memberId sort already done |
| Scope addition | 2 | liveNet formula + PATCH entries formula Phase 78 fix |
| Runtime bug caught in verify | 1 | baseInputStyle → SMALL_INP |
| Post-checkpoint refinement | 2 | ACH full row fix + CS print name layout |

### Scope Additions

**liveNet formula in WeekSection**: Still used Phase 71 formula (fronted additive). Fixed as part of Task 2 since we were already in the file.

**PATCH /payroll/entries/:id**: Same Phase 71 bug. Fixed as part of Task 1 payroll.ts edits.

## Next Phase Readiness

**Ready:** Phase 78 complete. All 3 plans unified. v3.1 milestone ready for complete-milestone ceremony.

**Concerns:**
- `npm run db:migrate` still needs to be run to apply AgentPeriodAdjustment.notes column
- UI smoke tests (note box, ACH print, unapprove gating) were verified by user checkpoint
- tsc verify from ops-dashboard deferred (same as Phase 75+76 condition)

**Blockers:** None — milestone completion next.

---
*Phase: 78-payroll-polish, Plan: 03*
*Completed: 2026-04-16*
