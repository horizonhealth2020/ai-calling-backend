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

## Completed Milestones

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
*Last updated: 2026-04-10 — v2.5 shipped*
