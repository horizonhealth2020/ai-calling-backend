# Phase 29: Dashboard Fixes & Cost Tracking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 29-dashboard-fixes-cost-tracking
**Areas discussed:** CS Resolved Log layout, Cost tracking states, Read-only Products view

---

## CS Resolved Log Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Unified table | Single table mixing chargebacks and pending terms with filterable Type column | ✓ |
| Separate sections | Two distinct tables, one for chargebacks and one for pending terms | |

**User's choice:** Unified table (Claude's recommendation accepted)
**Notes:** Columns: Type, Agent, Member, Resolution Date, Resolved By, Resolution Note, Original Amount. Sorted by resolution date, most recent first. Notes inline with expand-on-click for long content.

---

## Cost Tracking States

| Option | Description | Selected |
|--------|-------------|----------|
| Dash for unconfigured, zero for no data | Show "—" when Convoso not configured, "$0.00" when configured but no data, lead spend for zero-sales agents | ✓ |
| Hide cost columns when unconfigured | Remove columns entirely when no Convoso token | |

**User's choice:** Dash for unconfigured, zero for no data (Claude's recommendation accepted)
**Notes:** Zero-sales agents show total lead spend with "—" for cost per sale to avoid divide-by-zero.

---

## Read-Only Products View

| Option | Description | Selected |
|--------|-------------|----------|
| Simplified table with commission info | Product Name, Type, Commission Rate, Bundle Config — no CRUD buttons | ✓ |
| Product names only | Minimal list with just names and types | |

**User's choice:** Simplified table with commission info (Claude's recommendation accepted)
**Notes:** Gives managers visibility into commission structure without ability to change anything.

---

## Claude's Discretion

- ConvosoCallLog field mapping from API response
- CS Resolved Log API endpoint design (unified vs separate fetches)
- Notes truncation threshold and expand interaction
- Convoso API field name verification approach

## Deferred Ideas

None — discussion stayed within phase scope
