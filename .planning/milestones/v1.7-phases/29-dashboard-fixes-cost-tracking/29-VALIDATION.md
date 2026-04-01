---
phase: 29
slug: dashboard-fixes-cost-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After wave completion:** Manual verification of affected dashboard views
- **Integration checks:** Verify Convoso poller writes to ConvosoCallLog after DATA-01 task

---

## Validation Architecture

### Bug Fixes (FIX-01, FIX-02, FIX-03)
- **FIX-01:** Grep ManagerSales.tsx line 422 area for addon premium summation pattern
- **FIX-02:** Grep ManagerConfig.tsx for callBufferSeconds in create form section
- **FIX-03:** Grep agents.ts POST route for callBufferSeconds in Zod schema

### Config Cleanup (CFG-01, CFG-02)
- **CFG-01:** Verify no add/edit/delete buttons in Products section of ManagerConfig
- **CFG-02:** Verify Products table renders product name, type, commission rates, bundle config

### Data Flow (DATA-01, DATA-02)
- **DATA-01:** Grep convosoKpiPoller.ts for `convosoCallLog.createMany` or equivalent
- **DATA-02:** Verify dedup via ProcessedConvosoCall check before ConvosoCallLog insert

### Cost Display (DATA-03, DATA-04, DATA-05)
- **DATA-03/04:** Verify tracker/summary API returns cost data when ConvosoCallLog has records
- **DATA-05:** Verify agents with zero sales appear in tracker with lead spend displayed

### CS Resolved Log (CS-01, CS-02, CS-03, CS-04)
- **CS-01:** Verify role gating with requireRole("OWNER_VIEW", "SUPER_ADMIN")
- **CS-02/03:** Verify API endpoint queries both ChargebackSubmission and PendingTermSubmission with resolution fields
- **CS-04:** Verify filter params (type, dateRange, agent) accepted by API endpoint
