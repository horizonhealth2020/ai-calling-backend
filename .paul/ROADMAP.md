# Roadmap: ai-calling-backend

## Overview

A sales operations platform evolving from initial setup through full role-based dashboards — enabling managers, payroll staff, customer service, and owners to track sales, commissions, chargebacks, and agent performance across an 18-person team.

## Milestones

| Version | Name | Phases | Status | Completed |
|---------|------|--------|--------|-----------|
| v2.2 | Chargeback Batch Review & Payroll Agent Tabs | 44-47 | Shipped | 2026-04-09 |
| v2.3 | Parser & Payroll Fixes | 48 | Shipped | 2026-04-09 |
| v2.4 | Payroll & Chargeback Fixes | 49 | Shipped | 2026-04-09 |

## Active Milestone: v2.4 Payroll & Chargeback Fixes

**Goal:** Fix payroll chargeback deduction logic, add print color coding, and expand batch parser to handle new tab-separated format.
**Status:** Complete
**Progress:** [██████████] 100%

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 49 | Payroll & Chargeback Fixes | 1 | Complete | 2026-04-09 |

## Phase Details

### Phase 49: Payroll & Chargeback Fixes

**Goal:** Fix chargeback net deduction logic, add print view status colors, and support new tab-separated chargeback batch parser format.
**Depends on:** Phase 48 (v2.3 complete)
**Research:** Unlikely (internal patterns, known code)

**Scope:**
- Chargeback net deduction — closed week: deduct from net; open week: zero out commission
- Print view status colors — ACH green, chargeback orange/red in printed payroll cards
- Chargeback batch parser — new tab-separated format (policy ID + name columns)

**Plans:**
- [x] 49-01: Net deduction fix, print status colors, simple batch parser

---

## Completed Milestones

### v2.3 Parser & Payroll Fixes (Shipped 2026-04-09)

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 48 | Parser & Payroll Quick Fixes | 1 | Complete | 2026-04-09 |

---
*Roadmap created: 2026-04-09*
*Last updated: 2026-04-09 — v2.4 shipped*
