# Roadmap: ai-calling-backend

## Overview

A sales operations platform evolving from initial setup through full role-based dashboards — enabling managers, payroll staff, customer service, and owners to track sales, commissions, chargebacks, and agent performance across an 18-person team.

## Milestones

| Version | Name | Phases | Status | Completed |
|---------|------|--------|--------|-----------|
| v2.2 | Chargeback Batch Review & Payroll Agent Tabs | 44-47 | Shipped | 2026-04-09 |
| v2.3 | Parser & Payroll Fixes | 48 | Shipped | 2026-04-09 |

## Active Milestone: v2.3 Parser & Payroll Fixes

**Goal:** Fix receipt parser product misclassification, add ACH payroll row highlighting, and add sale date to standalone ACA entry.
**Status:** Complete
**Progress:** [██████████] 100%

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 48 | Parser & Payroll Quick Fixes | 1 | Complete | 2026-04-09 |

## Phase Details

### Phase 48: Parser & Payroll Quick Fixes

**Goal:** Fix three production issues — receipt parser addon detection, ACH payroll row highlighting, and standalone ACA sale date field.
**Depends on:** Phase 47 (v2.2 complete)
**Research:** Unlikely (internal patterns, known code)

**Scope:**
- Fix "Add on" (no hyphen) not matching addon regex in receipt parser
- Add green highlight for ACH-shifted payroll rows
- Add sale date field to standalone ACA entry form

**Plans:**
- [x] 48-01: Fix parser addon detection, ACH row highlight, ACA sale date

---
*Roadmap created: 2026-04-09*
*Last updated: 2026-04-09*
