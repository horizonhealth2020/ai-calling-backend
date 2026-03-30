# Phase 32: Phone Number Data Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 32-phone-number-data-pipeline
**Areas discussed:** Phone display format, Column placement, Phone input format

---

## Phone Display Format

| Option | Description | Selected |
|--------|-------------|----------|
| Raw digits | Display as stored (e.g., 8184374820) | |
| Formatted | Display as (XXX) XXX-XXXX | ✓ |
| Click-to-call | Formatted with tel: link | |

**User's choice:** Formatted `(XXX) XXX-XXXX` — matches sample member record format
**Notes:** User provided a real member record showing `(818) 437-4820` as the expected format

---

## Column Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Right of Agent (Audits) / Right of Lead Source (Sales) | Specific placement in each table | ✓ |
| End of table | Append as last data column | |
| In expanded details only | Show only when row is expanded | |

**User's choice:** Right of Agent on ManagerAudits, right of Lead Source on ManagerSales
**Notes:** User specified exact placement for both tables in one response

---

## Phone Input on Sales Form

| Option | Description | Selected |
|--------|-------------|----------|
| Free text | Unformatted string input | |
| Formatted input | Auto-format to (XXX) XXX-XXXX as user types | ✓ |
| Validated strict | Reject non-phone strings | |

**User's choice:** Formatted phone input with auto-formatting
**Notes:** User confirmed "formatted phone input" — consistent with how phone appears in member records

---

## Claude's Discretion

- Phone formatting utility placement
- Convoso API field name discovery
- Column width decisions

## Deferred Ideas

- Today filter on Performance Tracker agent performance view (separate phase — UI enhancement)
