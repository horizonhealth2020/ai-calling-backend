---
phase: 32-phone-number-data-pipeline
plan: 01
subsystem: data-pipeline
tags: [prisma, convoso, api, phone-number]
dependency_graph:
  requires: []
  provides: [leadPhone-schema, leadPhone-poller, leadPhone-api]
  affects: [convoso_call_logs, sales]
tech_stack:
  added: []
  patterns: [IIFE-extraction, prisma-select-include]
key_files:
  created:
    - prisma/migrations/20260330_add_lead_phone/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/workers/convosoKpiPoller.ts
    - apps/ops-api/src/routes/call-audits.ts
    - apps/ops-api/src/routes/sales.ts
decisions:
  - Used IIFE pattern for phone extraction matching existing recordingUrl/callDurationSeconds style
  - Fallback chain: phone_number then caller_id from Convoso response
metrics:
  duration: 146s
  completed: 2026-03-30T15:33:09Z
---

# Phase 32 Plan 01: Lead Phone Data Pipeline Summary

Nullable leadPhone field added to ConvosoCallLog and Sale models with Convoso poller extraction and API exposure across call audits and sales endpoints.

## What Was Done

### Task 1: Prisma Schema and Migration
- Added `leadPhone String? @map("lead_phone")` to ConvosoCallLog model (after createdAt)
- Added `leadPhone String? @map("lead_phone")` to Sale model (after memberState)
- Created migration `20260330_add_lead_phone` with ALTER TABLE statements for both tables
- Regenerated Prisma client

### Task 2: Poller and API Route Updates
- **convosoKpiPoller.ts**: Added leadPhone extraction using IIFE pattern (`r.phone_number ?? r.caller_id`), consistent with existing recordingUrl and callDurationSeconds extraction
- **call-audits.ts**: GET list endpoint now includes `convosoCallLog: { select: { leadPhone: true } }`; GET by ID endpoint includes `leadPhone: true` in existing convosoCallLog select
- **sales.ts**: POST schema includes `leadPhone: z.string().optional()`; PATCH schema includes `leadPhone: z.string().nullable().optional()`; both handlers pass leadPhone through via spread patterns

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation: zero errors in modified files (pre-existing errors in unrelated files out of scope)
- Prisma client regenerated successfully with new leadPhone fields
- grep confirms leadPhone present in all 5 modified/created files

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 6b596b1 | Add leadPhone field to ConvosoCallLog and Sale models |
| 2 | 5132cf9 | Capture leadPhone in poller and expose via API routes |

## Self-Check: PASSED

All 6 files verified present. Both commits (6b596b1, 5132cf9) confirmed in git log.
