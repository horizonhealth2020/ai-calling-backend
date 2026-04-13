# Phase 60: Data Integrity — Context

**Created:** 2026-04-13
**Status:** Ready for /paul:plan

## Goals

1. Clean up ~8 orphaned Clawback/PayrollEntry records left by the broken chargeback delete (fixed in commit 27c5335), restoring correct commission for affected sales
2. Backfill activity feed with historical Sale/Chargeback/PendingTerm entries so the feed has data before the deploy date

## Approach

- Single plan, two one-time scripts (run via `npx tsx`)
- Scripts live in `prisma/scripts/` (same pattern as seed)
- Both scripts are idempotent (safe to run twice without double-inserting)
- Run against production DB via `DATABASE_URL`
- No permanent endpoints or migrations needed

### Script 1: Orphan Cleanup

- Find Clawback records where the linked ChargebackSubmission no longer exists
- Delete those Clawbacks + their ClawbackProducts
- Find PayrollEntries with status ZEROED_OUT_IN_PERIOD or CLAWBACK_CROSS_PERIOD where no Clawback exists for that sale
- Delete those entries
- Recalculate commission for each affected sale via upsertPayrollEntryForSale
- Log everything it touches (sale ID, agent, amounts restored)

### Script 2: Activity Feed Backfill

- Read existing Sale records → generate CREATE audit log entries with sale's createdAt timestamp
- Read existing Clawback records → generate chargeback audit entries
- Read existing PendingTerm records → generate pending term audit entries
- Use correct timestamps from source records (not current time)
- Skip if audit entry already exists for that entity (idempotent)

## Constraints

- ~8 orphaned records expected (small batch, no dry-run needed)
- Scripts must use the existing Prisma client and payroll service functions
- Log output should clearly show what was cleaned/created for verification

## Open Questions

None — scope is clear.

---

*This file persists across /clear so you can take a break if needed.*
