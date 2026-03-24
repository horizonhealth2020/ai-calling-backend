# Phase 24: Chargeback Automation & Data Archival - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 24-chargeback-automation-data-archival
**Areas discussed:** Sale matching strategy, Clawback amounts & timing, Archive table design, Archive UI

---

## Sale Matching Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Exact memberId match | Match chargeback.memberId to sale.memberId. Simple, deterministic. | ✓ |
| Multi-field fallback | Try memberId first, then fuzzy match on name/company. | |
| Score-based ranking | Score multiple fields and pick highest match. | |

**User's choice:** Exact memberId match
**Notes:** None

### Multi-match handling

| Option | Description | Selected |
|--------|-------------|----------|
| Flag for manual review | Mark as multiple matches, let CS pick. | ✓ |
| Pick most recent sale | Auto-select most recently created match. | |
| Create clawbacks for all | Apply clawback to every match. | |

**User's choice:** Flag for manual review
**Notes:** User added requirement for dedupe guard — if a chargeback is manually entered or converted from CS board, system should flag if clawback already exists for that chargeback/sale combo in agent payroll. Prevents double-deducting.

---

## Clawback Amounts & Timing

### Amount

| Option | Description | Selected |
|--------|-------------|----------|
| Full chargeback amount | Use chargebackAmount from submission. | |
| Agent's commission portion | Look up original commission and claw back that amount. | ✓ |
| Configurable per case | Default to full, let approver edit. | |

**User's choice:** Agent's commission portion only
**Notes:** Requires looking up the original sale's commission/payout to calculate the correct amount.

### Period

| Option | Description | Selected |
|--------|-------------|----------|
| Current open period | Apply to whatever period is currently OPEN. | |
| Same period as original sale | Retroactively place in sale's original period. | |
| Let approver choose | Keep existing alert approval UX with period selection. | ✓ |

**User's choice:** Let approver choose period
**Notes:** Aligns with existing alert approval UX.

---

## Archive Table Design

### Tables

| Option | Description | Selected |
|--------|-------------|----------|
| Call audits | call_audits — high volume with AI scoring data. | ✓ |
| Call logs | convoso_call_logs — raw call metadata. | ✓ |
| Audit log | app_audit_log — system action trail. | ✓ |
| All three | Archive all high-volume tables. | ✓ |

**User's choice:** All three tables

### Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel archive tables | Identical schema with _archive suffix. | ✓ |
| Soft-delete with archived flag | Add archivedAt column. | |
| Separate database/schema | Different PostgreSQL schema. | |

**User's choice:** Parallel archive tables

### Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 90 days | 3 months of active data. | ✓ |
| 30 days | Aggressive, only last month active. | |
| Admin chooses date range | Custom date range each time. | |

**User's choice:** 90 days

---

## Archive UI

### Location

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Data' tab | Dedicated tab in owner dashboard sidebar. | |
| Inside Config tab | Add section within existing Config tab. | ✓ |
| Standalone admin page | Separate page, SUPER_ADMIN only. | |

**User's choice:** Inside Config tab

### Confirmation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline confirmation with count | Show record count with confirm/cancel. | ✓ |
| Modal dialog with details | Modal showing date range, count, space savings. | |
| Type-to-confirm | Require typing 'ARCHIVE' like GitHub. | |

**User's choice:** Inline confirmation with count

---

## Claude's Discretion

- Migration strategy for archive tables
- Socket.IO event for auto-clawbacks
- Archive stats display format in Config tab
- Visual flagging of unmatched chargebacks

## Deferred Ideas

None
