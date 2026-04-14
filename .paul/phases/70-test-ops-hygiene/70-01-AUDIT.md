# Enterprise Plan Audit Report

**Plan:** `.paul/phases/70-test-ops-hygiene/70-01-PLAN.md`
**Audited:** 2026-04-14
**Verdict:** Conditionally acceptable → **enterprise-ready after applied upgrades**

---

## 1. Executive Verdict

The plan handles a cleanup task with real production destructive ops + a test mock fix + an archive move. The plan structure is correct — checkpoint:human-action for prod work, dry-run pattern for safety, JSON audit logging for reconstruction. However, several gaps around the destructive execution itself needed hardening: the default flag behavior was destructive-first, there was no independent post-run verification of idempotence, no environment marker to catch wrong-target-DB accidents, and no data restore path verification before the irreversible step.

After applying 2 must-have and 2 strongly-recommended upgrades, the plan is **enterprise-ready**. Destructive ops are now safety-first by default with documented restore path.

## 2. What Is Solid

- **Dry-run pattern for destructive script** — correct approach for data deletion tooling
- **JSON audit logs for both modes** — supports post-incident reconstruction
- **Logs directory gitignored** — prevents prod data leaking to repo
- **`git mv` for archive** — preserves blame/history for archived script
- **Scope discipline** — test fix is "only add what's called," not preemptive mock completion
- **Human-action checkpoint** — correctly used (Claude cannot touch prod)
- **Explicit abort path** — user can halt if dry-run reveals anything unexpected
- **Atomic transactions preserved** — each clawback deletion is its own transaction, isolated failures don't cascade

## 3. Enterprise Gaps Identified

1. **Destructive default.** The original plan preserved Phase 60's "run without flags = real execution" for backward compatibility. But nobody has *ever* run this script in production — Phase 70 is the first execution. "Backward compatibility" was therefore not a real constraint, just an inherited assumption. Fat-finger risk: typing the command without `--dry-run` means instant destruction. SOC 2 lens: destructive ops should be opt-in, not opt-out.

2. **No data restore path verified.** The script irreversibly deletes production rows. The plan had no step requiring the user to confirm a restore capability exists (Railway PITR or manual pg_dump) before the destructive run. If something goes wrong mid-run or post-run, there was no documented recovery path.

3. **No independent post-run verification.** The plan relied on self-reported summary counts ("deleted 6 clawbacks"). But if 2 of 8 silently failed, that's 6 reported vs. 2 remaining — the summary alone cannot prove the database is actually clean. Idempotence verification (re-run dry-run post-execute, expect 0 orphans) is the independent proof.

4. **No environment marker in script output.** If a user runs the script with a dev-shaped env var accidentally pointing at prod (or vice versa), there's no visual prompt to catch it. Production data destruction should always be preceded by an explicit "Target: <db>" line that the user can scan.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Destructive default invites fat-finger accidents | AC-3 rewritten; Task 2 action + verify | Dry-run is now default; `--execute` flag required for real deletions; mutually exclusive flag combo rejected with exit code 2 |
| 2 | No data restore path verified before destructive run | Added AC-9; Task 3 instructions Step 0 | User must confirm Railway PITR covers last 48h OR has taken manual pg_dump before --execute run |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 3 | No post-run idempotence verification | Added AC-8; Task 3 instructions Step 4 | User must run dry-run AGAIN after --execute; expected 0 orphans proves the real run actually cleaned everything |
| 4 | No environment marker | Added AC-7; Task 2 action (env marker code) | Script prints sanitized "Target DB: host/dbname" on startup so user can visually confirm target before mutations |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Rollback triage beyond "stop and tell me" | Relies on human judgment at dry-run review time — acceptable for a phase this small |
| 2 | Redundant gitignore pre-check in script | Already covered in Task 2 verify step 6. Additional check would be belt-and-suspenders with low marginal benefit. |
| 3 | Production credentials setup documentation | User's infrastructure — out of scope for a hygiene phase |
| 4 | Scope creep prevention in test mock fix beyond "only add what's needed" | Relies on disciplined execution — acceptable judgment call |

## 5. Audit & Compliance Readiness

**After applied upgrades:**

- **Defensible audit evidence:** Yes — JSON audit logs for both dry-run and execute preserve full pre-deletion state. Post-cleanup verification dry-run provides independent proof of clean state.
- **Silent failure prevention:** Yes — idempotence verification catches any silently failed deletions. Environment marker catches wrong-target-DB accidents.
- **Post-incident reconstruction:** Yes — Railway PITR or manual pg_dump provides restore capability (user must confirm before --execute). JSON logs provide forensic detail.
- **Ownership and accountability:** User explicitly runs the destructive command with `--execute`, preventing automated accidents. Checkpoint captures all paste-back evidence for the plan record.

**Remaining audit gaps:** None that would fail a SOC 2 review for a hygiene phase of this scope.

## 6. Final Release Bar

**Must be true before ship:**
- auditQueue tests pass (171/171 ops-api after Task 1)
- Cleanup script: `--dry-run` default verified, `--execute` required, mutually exclusive rejected
- Environment marker visible before any queries
- Data restore path confirmed by user before any `--execute` run
- Real cleanup completed with zero errors
- Post-cleanup verification dry-run reports 0 orphans (idempotence proof)
- Backfill script archived via `git mv` with documented rationale
- STATE.md deferred-issues list reflects current state

**Remaining risk if shipped as-is after applying upgrades:**
- If the production dataset contains unexpected data shapes (e.g., a clawback with orphan status but data a user still needs), the dry-run review is the sole human gate. Mitigated by the explicit abort path + JSON log for review.
- If Railway's PITR window is shorter than assumed (48h), the restore guarantee weakens. User must verify actual window, not assume.

**Would I sign my name to this system?** Yes, with the applied upgrades. The destructive ops are now safety-first with a documented restore path.

---

**Summary:** Applied 2 must-have + 2 strongly-recommended upgrades. Deferred 4 items with justification.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
