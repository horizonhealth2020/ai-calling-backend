---
phase: 25-file-structure-cleanup
plan: 02
subsystem: documentation
tags: [file-structure, cleanup, documentation, consolidation]
dependency_graph:
  requires: [25-01]
  provides: [clean-repo-root, updated-docs]
  affects: [README.md, CLAUDE.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - README.md
    - CLAUDE.md
  deleted:
    - FIXES.md
    - ISSUES.md
    - TESTING.md
    - docs/railway-deploy.md
decisions:
  - Consolidated all useful content from 4 stale doc files into README.md sections
  - Updated CLAUDE.md Apps table from 6 standalone apps to 4 current apps
  - payroll-dashboard directory not git-tracked (empty) and locked by Windows -- cosmetic only
metrics:
  duration: 4m 38s
  completed: "2026-03-25T14:16:09Z"
  tasks: 3
  files_modified: 2
  files_deleted: 4
---

# Phase 25 Plan 02: Stale Files and Docs Cleanup Summary

Deleted orphaned doc files (FIXES.md, ISSUES.md, TESTING.md, docs/railway-deploy.md), rewrote README.md with consolidated content reflecting the current 4-app monorepo structure, and updated CLAUDE.md to remove all stale references to deleted standalone apps.

## Tasks Completed

### Task 1: Delete stale directory and files, consolidate docs into README.md
**Commit:** 84fc08e

- Deleted FIXES.md, ISSUES.md, TESTING.md, docs/railway-deploy.md via `git rm`
- Rewrote README.md with 14 sections: architecture diagram (updated Mermaid), role-based access, sale lifecycle, monorepo layout, service responsibilities, shared auth, environment variables, local development, Morgan tests, Morgan known issues, Railway deployment (updated service table), Railway networking, DNS follow-up, crash prevention
- Updated Mermaid flowchart: removed 5 standalone dashboard nodes, added single ops-dashboard node
- Removed all references to auth-portal, manager-dashboard, payroll-dashboard, owner-dashboard
- Note: `apps/payroll-dashboard/` directory is empty and not git-tracked; Windows file lock prevented removal but it has no content or git presence

### Task 2: Update CLAUDE.md to reflect current repository structure
**Commit:** 7719274

- Replaced 6-app table with 4 current apps (ops-api, ops-dashboard, sales-board, morgan)
- Removed stale dev commands: auth:dev, payroll:dev, manager:dev, owner:dev
- Added dashboard:dev command for ops-dashboard
- Updated Morgan location from "repo root (index.js)" to "apps/morgan/ (apps/morgan/index.js)"
- Updated port assignments from 5 legacy ports to 4 current ports
- Updated Docker description from "5 frontends" to current services
- Updated test description from "root Morgan service" to "Morgan service at apps/morgan/"

### Task 3: Final stale reference sweep across entire repo
**Commit:** None (verification-only task -- no changes needed)

- Ran comprehensive grep for payroll-dashboard, auth-portal, manager-dashboard, owner-dashboard across all source/config files
- All matches were in excluded directories (.planning/, .claude/, package-lock.json) -- no source file references remain
- Verified no FIXES.md, ISSUES.md, TESTING.md, or docs/ references in CLAUDE.md or README.md
- Verified root directory contains only CLAUDE.md and README.md (no stale .js or .md files)
- All 90 Morgan tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Windows file lock on apps/payroll-dashboard/**
- **Found during:** Task 1
- **Issue:** Empty `apps/payroll-dashboard/` directory locked by Windows process, preventing `rm -rf`
- **Resolution:** Directory has zero files and zero git-tracked content. Skipped deletion -- it is purely cosmetic and will be removed on next clean checkout or by the user closing the locking process
- **Impact:** None -- directory is empty and not in git history

## Verification Results

- FIXES.md, ISSUES.md, TESTING.md deleted: PASS
- docs/ directory deleted: PASS
- README.md contains "apps/morgan/": PASS
- README.md contains "Morgan Known Issues": PASS
- README.md contains "Morgan Tests": PASS
- README.md contains "Crash Prevention": PASS
- README.md contains "ops-dashboard": PASS
- README.md has 0 payroll-dashboard references: PASS
- README.md has 0 auth-portal/manager-dashboard/owner-dashboard references: PASS
- CLAUDE.md contains "apps/morgan/": PASS
- CLAUDE.md has 0 payroll-dashboard references: PASS
- CLAUDE.md has 0 auth-portal references: PASS
- CLAUDE.md contains "dashboard:dev": PASS
- CLAUDE.md has 0 auth:dev references: PASS
- npm test: 90 tests passed, 0 failed
- Root .md files: exactly CLAUDE.md and README.md
- Root .js files: none
