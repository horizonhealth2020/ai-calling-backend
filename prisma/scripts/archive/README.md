# Archived Scripts

This directory contains scripts that were built for a specific purpose but are
no longer needed in active ops. They are preserved here for historical context
and in case the underlying conditions recur.

## backfill-audit-log.ts

**Archived:** 2026-04-14 (v2.9.1 Phase 70)
**Original phase:** 60-data-integrity (v2.8)

**Why archived:**
This script was built to backfill `AppAuditLog` entries for historical Sales,
ChargebackSubmissions, and PendingTerms so the owner activity feed would have
pre-deploy data. In practice, the application went live and the activity feed
organically populated from real events within weeks. Owners did not need (or
request) historical backfill.

**When you might revive it:**

- A future migration or fresh environment needs historical activity context
- The `AppAuditLog` table is truncated and events need reconstruction from source records
- You launch a new production environment and want it seeded with retroactive activity

**How to revive:**

1. `git mv prisma/scripts/archive/backfill-audit-log.ts prisma/scripts/backfill-audit-log.ts`
2. Review the script against the current `AppAuditLog` schema — it was correct at Phase 60 time; check for schema drift before running
3. The original script has no dry-run mode. Before running against production, add one following the pattern in `prisma/scripts/cleanup-orphaned-clawbacks.ts` (default = dry-run, `--execute` required for real inserts)
4. Run dry-run against production first, review output, then `--execute`

**Cross-references:**

- Phase 60 summary: `.paul/phases/60-data-integrity/60-01-SUMMARY.md`
- Phase 70 summary: `.paul/phases/70-test-ops-hygiene/70-01-SUMMARY.md`

---

## On the cleanup-orphaned-clawbacks.ts sibling

Note that `prisma/scripts/cleanup-orphaned-clawbacks.ts` is NOT archived — it
remains in the active scripts directory with the Phase 70 dry-run safety
additions. When Phase 70 ran the dry-run against production, zero orphans were
found (database was already clean), so no destructive run was needed. The
script remains available in case orphans ever re-appear.
