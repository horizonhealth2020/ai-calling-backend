---
phase: 19-dashboard-consolidation-uniform-date-ranges
plan: 06
subsystem: dashboard, manager
tags: [manager-migration, sub-tabs, shared-state, socket, sales-entry, agent-tracker, call-audits, config]

requires:
  - phase: 19-01
    provides: ops-dashboard app shell, SocketProvider, DateRangeContext, PageShell
  - phase: 19-02
    provides: auth middleware, decodeTokenPayload
provides:
  - Manager dashboard tab at /manager with 5 sub-tabs
  - Shared state orchestration (agents, products, leadSources) at page level
  - Cross-tab refresh on sale creation and status changes
  - Socket sale:changed real-time updates for tracker and sales list
affects: [19-08]

tech-stack:
  added: []
  patterns: [orchestrator-with-shared-state-props, socket-event-at-page-level, cross-tab-refresh-callbacks]

key-files:
  created:
    - apps/ops-dashboard/app/(dashboard)/manager/page.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerConfig.tsx
  modified: []

key-decisions:
  - "Shared state at orchestrator level: agents, products, leadSources fetched once in page.tsx and passed as props to all sub-tabs"
  - "Socket sale:changed handled at page level to update both tracker and sales list simultaneously"
  - "Audits socket events (new_audit, audit_status, processing_started, processing_failed) handled within ManagerAudits component using socket prop"
  - "ToastProvider wraps inner component for toast notifications in sales editing"
  - "Config CRUD uses setAgents/setLeadSources for immediate local state updates plus refreshProducts callback for product changes"

requirements-completed: [MIG-04]

duration: 10min
completed: 2026-03-19
---

# Phase 19 Plan 06: Manager Dashboard Migration Summary

Migrated the Manager dashboard (2,702 lines, 5 sub-tabs with deeply shared state) from standalone app into unified ops-dashboard at /manager with cross-tab refresh and real-time socket updates.

## What Was Built

### Task 1: Extract Manager Sub-tab Components (311bd90)
- **ManagerEntry.tsx**: Sales entry form with receipt parser, commission preview, addon product selection, payment type radio, all form validation -- the core business operation
- **ManagerTracker.tsx**: Agent performance table with podium rankings, call counts, date range filter, CSV export, real-time highlight glow on new sales
- **ManagerSales.tsx**: Sales list grouped by agent with day-of-week filter pills, inline edit expansion with diff preview, status change dropdown with payroll approval flow, delete with confirmation
- **ManagerAudits.tsx**: Call audit table with expand/collapse details showing coaching priorities, issues with agent/customer quotes, wins, missed opportunities, transcript toggle, recording player, audit editing (score, outcome, manager summary) -- subscribes to processing_started, audit_status, new_audit, processing_failed socket events
- **ManagerConfig.tsx**: CRUD management for agents (add/edit/delete/reactivate), lead sources (add/edit/delete with cost-per-lead and call buffer), products (edit with type-specific commission fields: core threshold/below/above, addon bundled/standalone/enrollFee)

### Task 2: Create Manager Page Orchestrator (9405046)
- Orchestrator page.tsx loads agents, products, leadSources, tracker, salesList on mount
- Subscribes to socket sale:changed at page level -- patches tracker (increment salesCount/premiumTotal) and salesList (prepend new sale) in real-time
- Cross-tab refresh: onSaleCreated triggers tracker + sales reload; onSalesChanged triggers tracker reload
- Config callbacks pass setAgents/setLeadSources for local state mutation + refreshProducts for server re-fetch
- PageShell sidebar with 5 nav items matching original: Sales Entry, Agent Tracker, Agent Sales, Call Audits, Config
- Real-time highlight state (highlightedSaleIds, highlightedAgentNames) propagated to Tracker and Sales tabs

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- All 6 component files created in apps/ops-dashboard/app/(dashboard)/manager/
- Each component contains "use client" directive
- All authFetch imports from @ops/auth/client present
- PageShell imported and used in page.tsx with 5 nav items
- useSocketContext from @/lib/SocketProvider used for socket access
- Shared state (agents, products, leadSources) loaded via useCallback + useEffect
- Socket sale:changed subscription at orchestrator level
- All fetch URLs from original page.tsx distributed across the 6 files

## Self-Check: PASSED
