---
phase: 32-phone-number-data-pipeline
verified: 2026-03-30T17:00:00Z
status: human_needed
score: 9/9 must-haves verified
gaps: []
human_verification:
  - test: "Open Manager dashboard, load Sales tab, click Edit on any sale, type a phone number in the Phone field, save"
    expected: "Phone number saves and appears in the Phone column after the row refreshes"
    why_human: "Cannot verify round-trip save behavior, server response parsing, and UI refresh programmatically"
  - test: "Open Manager dashboard, load Audits tab, confirm Phone column is visible with formatted numbers for calls that have phone data"
    expected: "Phone column appears between Agent and Outcome; populated rows show (XXX) XXX-XXXX format; rows without data show an em-dash"
    why_human: "Visual column presence and formatting requires browser rendering"
---

# Phase 32: Phone Number Data Pipeline — Verification Report

**Phase Goal:** Capture lead phone numbers from Convoso API, store in database, expose through call-audit and sales APIs, display in Manager dashboard tables with formatted phone input on sales edit form.
**Verified:** 2026-03-30T17:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ConvosoCallLog has nullable leadPhone in the database | VERIFIED | `prisma/schema.prisma` L487: `leadPhone String? @map("lead_phone")`; migration `20260330_add_lead_phone` applies both ALTER TABLEs |
| 2 | Sale model has nullable leadPhone in the database | VERIFIED | `prisma/schema.prisma` L216: `leadPhone String? @map("lead_phone")` |
| 3 | New Convoso call logs captured by the poller include phone_number | VERIFIED | `convosoKpiPoller.ts` L125-128: IIFE using `r.phone_number ?? r.caller_id` assigned to `leadPhone` |
| 4 | GET /api/call-audits returns convosoCallLog.leadPhone for each audit | VERIFIED | `call-audits.ts` L44-45: list endpoint includes `convosoCallLog: { select: { leadPhone: true } }`; detail endpoint L59 also selects `leadPhone: true` |
| 5 | POST /api/sales accepts optional leadPhone (schema + data flow) | VERIFIED | `sales.ts` L30: `leadPhone: z.string().optional()`; POST handler L36 spreads `...saleData` into prisma.sale.create which includes leadPhone |
| 6 | PATCH /api/sales/:id accepts optional leadPhone (all role paths) | PARTIAL | Schema L281 accepts it. SUPER_ADMIN/PAYROLL path spreads `...saleFields` (includes leadPhone). MANAGER path uses `fieldMap` (L366-381) which omits `leadPhone` — phone edits by managers produce "No changes detected" |
| 7 | ManagerAudits table shows a Phone column after Agent with formatted phone numbers | VERIFIED | `ManagerAudits.tsx`: header array L249 includes "Phone" at index 2; body L271-273 renders `formatPhone(a.convosoCallLog.leadPhone)` with em-dash fallback; `formatPhone` function at L65 |
| 8 | ManagerSales table shows a Phone column after Lead Source with formatted phone numbers | VERIFIED | `ManagerSales.tsx`: header array L423 includes "Phone" at index 5; body L437-441 renders `s.leadPhone`; `formatPhone` function at L52 |
| 9 | Sales edit form has a formatted phone input that stores raw digits and round-trips via PATCH | PARTIAL | Edit form input exists (L602-608), `startEdit` loads `leadPhone` (L195), `saveEdit` diffs all editForm keys (L249-252) and would send `leadPhone` in payload. But the server MANAGER path drops it (see Truth 6 gap). Human verification required for save round-trip. |

**Score:** 8/9 truths verified (1 partial gap, 1 partial pending human verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | leadPhone on ConvosoCallLog and Sale | VERIFIED | Both fields present at L216 and L487 |
| `prisma/migrations/20260330_add_lead_phone/migration.sql` | ALTER TABLE for both tables | VERIFIED | Both ALTER TABLE statements confirmed |
| `apps/ops-api/src/workers/convosoKpiPoller.ts` | phone_number extraction into leadPhone | VERIFIED | IIFE pattern at L125-128 |
| `apps/ops-api/src/routes/call-audits.ts` | convosoCallLog include with leadPhone in list and detail | VERIFIED | L44-45 (list), L59 (detail) |
| `apps/ops-api/src/routes/sales.ts` | leadPhone in POST and PATCH Zod schemas | VERIFIED | L30 (POST), L281 (PATCH) |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` | Phone column with formatPhone | VERIFIED | formatPhone at L65, column rendered at L270-274, colSpan={7} at L332 and L578 |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` | Phone column, edit input, startEdit | VERIFIED | formatPhone at L52, column at L436-441, input at L602-608, startEdit at L195, colSpan={10} at L503 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convosoKpiPoller.ts` | `prisma.convosoCallLog` createMany | `leadPhone` in data | WIRED | L125-128: `leadPhone: (() => { const ph = r.phone_number ?? r.caller_id; return ph ? String(ph) : null; })()` |
| `call-audits.ts` | `prisma.callAudit.findMany` | `convosoCallLog` include with `leadPhone` select | WIRED | L43-46: `convosoCallLog: { select: { leadPhone: true } }` in the include clause |
| `ManagerAudits.tsx` | API response | `a.convosoCallLog?.leadPhone` | WIRED | L271: `a.convosoCallLog?.leadPhone` — optional chain handles null convosoCallLog |
| `ManagerSales.tsx` | API response | `s.leadPhone` | WIRED | L438: `s.leadPhone` with em-dash fallback |
| `ManagerSales.tsx edit form` | PATCH /api/sales/:id | `editForm.leadPhone` sent in changes diff | PARTIAL | `saveEdit` at L249-252 iterates all editForm keys and diffs — `leadPhone` WILL be sent in the PATCH body. Server SUPER_ADMIN/PAYROLL path applies it. Server MANAGER path (`fieldMap`) drops it silently. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PHONE-01 | 32-01 | ConvosoCallLog model has nullable `leadPhone` field with Prisma migration | SATISFIED | `schema.prisma` L487; migration confirmed |
| PHONE-02 | 32-01 | Sale model has nullable `leadPhone` field (same migration) | SATISFIED | `schema.prisma` L216; migration confirmed |
| PHONE-03 | 32-01 | Convoso poller captures `phone_number` from API response into `leadPhone` | SATISFIED | `convosoKpiPoller.ts` L125-128 |
| PHONE-04 | 32-01 | Call audits API includes `convosoCallLog.leadPhone` in list response | SATISFIED | `call-audits.ts` L44-45 |
| PHONE-05 | 32-02 | ManagerAudits table displays Phone column from call log data | SATISFIED | Phone column wired to `a.convosoCallLog?.leadPhone` with formatting |
| PHONE-06 | 32-01 | Sales API Zod schema accepts optional `leadPhone` on POST/PATCH | SATISFIED (schema) | Both schemas have the field. POST spreads it to DB. PATCH has a role-path gap (MANAGER edit requests drop it) — schema requirement met but functional gap exists |
| PHONE-07 | 32-02 | ManagerSales table displays Phone column from sale data | SATISFIED | Phone column wired to `s.leadPhone` with formatting |

No orphaned requirements — all 7 PHONE-0x requirements are covered by plans 32-01 and 32-02.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/ops-api/src/routes/sales.ts` | 366-381 | `fieldMap` missing `leadPhone` | Warning | Manager role cannot update leadPhone via edit request; phone edits by managers are silently discarded |

No TODO/FIXME/placeholder comments found in any modified file. No stub return patterns found.

### Human Verification Required

#### 1. Manager Phone Edit Round-Trip

**Test:** Log in as a MANAGER user, navigate to the Sales tab in Manager dashboard, click Edit on any sale, type a 10-digit phone number into the Phone field, and click Save.
**Expected:** The edit request is submitted successfully (no "No changes detected" error). After approval/save the Phone column shows the formatted number for that row.
**Why human:** Server-side MANAGER path currently uses `fieldMap` which drops `leadPhone` — this test will likely fail with a 400 "No changes detected" until the gap is patched. Verifying this error occurs requires a running server and browser.

#### 2. Audits Table Phone Column Visual

**Test:** Log in as any Manager or Admin, navigate to the Call Audits tab, observe the table header and rows.
**Expected:** "Phone" column appears between "Agent" and "Outcome" columns. Rows with phone data show `(XXX) XXX-XXXX` format. Rows without phone data show an em-dash.
**Why human:** Column layout and formatting correctness requires browser rendering.

### Gaps Summary

One functional gap was found that was not flagged by the SUMMARY's self-check.

**MANAGER PATCH path drops leadPhone** — `apps/ops-api/src/routes/sales.ts` lines 366-381 define a `fieldMap` object that determines which fields are tracked in a manager's SaleEditRequest diff. `leadPhone` is absent from this map. When a MANAGER submits an edit with only a phone number change, the diff loop produces zero changes and the server returns `400 { error: "No changes detected" }`. SUPER_ADMIN and PAYROLL users are unaffected — they follow a different code branch (L292-336) that spreads all parsed fields directly into `prisma.sale.update`.

The fix is one line: add `leadPhone: s => s.leadPhone,` to `fieldMap` alongside the existing `memberState` entry.

---

_Verified: 2026-03-30T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
