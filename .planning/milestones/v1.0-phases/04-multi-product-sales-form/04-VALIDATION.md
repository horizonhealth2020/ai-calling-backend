---
phase: 4
slug: multi-product-sales-form
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (ops-api only); no component test infra for Next.js apps |
| **Config file** | `apps/ops-api/jest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Visual inspection — load manager dashboard, verify form renders correctly
- **After every plan wave:** Submit a test sale with blank carrier, selected product, selected lead source, addon products checked
- **Before `/gsd:verify-work`:** Full manual walkthrough of sales entry flow + `npm test` green
- **Max feedback latency:** 10 seconds (Jest), instant (visual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SALE-02 | manual | Visual: CORE-only dropdown, blank default | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | SALE-02 | manual | Visual: addon picker shows ADDON/AD_D sorted | N/A | ⬜ pending |
| 04-01-03 | 01 | 1 | SALE-02 | manual | Visual: lead source blank default | N/A | ⬜ pending |
| 04-01-04 | 01 | 1 | SALE-03 | manual | Visual: payment type CC/ACH (no changes) | N/A | ⬜ pending |
| 04-01-05 | 01 | 1 | SALE-04 | manual | Visual: enrollment fee input (no changes) | N/A | ⬜ pending |
| 04-01-06 | 01 | 1 | SALE-02 | unit | `npm test` (carrier schema) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Optionally add carrier-optional test to ops-api Jest suite

*Existing infrastructure covers most phase requirements. All primary requirements are frontend UI changes with no component test framework available.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Product dropdown shows CORE products only with blank default | SALE-02 | No React component test infra in manager-dashboard | Load form, verify dropdown starts blank, only shows CORE products |
| Addon picker shows ADDON/AD_D sorted | SALE-02 | No React component test infra | Load form, check addon list shows ADDON first then AD_D, alphabetical within |
| Lead source starts blank | SALE-02 | No React component test infra | Load form, verify lead source dropdown starts with placeholder |
| Field order matches spec | SALE-02 | Visual layout verification | Compare field order to CONTEXT.md spec |
| Carrier field is optional | SALE-02 | Cross-stack (frontend + backend) | Submit sale with blank carrier, verify 200 response |
| Multi-product sale creates correct payroll entries | SALE-02 | End-to-end data flow | Submit sale with addons, check payroll entries in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
