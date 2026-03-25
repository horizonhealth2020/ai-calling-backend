---
phase: 25-file-structure-cleanup
plan: 01
subsystem: morgan
tags: [file-structure, relocation, morgan]
dependency_graph:
  requires: []
  provides: [apps/morgan/]
  affects: [package.json]
tech_stack:
  added: []
  patterns: [git-mv-history-preservation]
key_files:
  created: [apps/morgan/]
  modified: [package.json]
decisions:
  - id: D-04-honored
    summary: "No apps/morgan/package.json created; Morgan deps stay in root package.json"
metrics:
  duration: 103s
  completed: "2026-03-25T14:08:42Z"
  tasks_completed: 1
  tasks_total: 1
  tests_passing: 90
  test_suites: 7
---

# Phase 25 Plan 01: Morgan File Relocation Summary

Relocated all Morgan voice service files from repo root into apps/morgan/ using git mv to preserve blame history, updated package.json scripts to reference new paths -- 90 tests pass, zero behavior change.

## What Was Done

### Task 1: Move Morgan files to apps/morgan/ and update package.json

**Commit:** `fc05e21`

Moved 5 source files, 7 test files, and 1 jest config from repository root to `apps/morgan/` using `git mv` (preserving full git blame history). Updated `package.json` fields:

- `main`: `index.js` -> `apps/morgan/index.js`
- `start`: `node index.js` -> `node apps/morgan/index.js`
- `test`: `jest` -> `jest --config apps/morgan/jest.config.js`
- `test:watch`: `jest --watch` -> `jest --config apps/morgan/jest.config.js --watch`
- `test:coverage`: `jest --coverage` -> `jest --config apps/morgan/jest.config.js --coverage`

No Morgan source code was modified. All `./` relative requires between siblings and `../` requires from `__tests__/` remain valid because all files moved together.

**Files moved:**
- `index.js` -> `apps/morgan/index.js`
- `voiceGateway.js` -> `apps/morgan/voiceGateway.js`
- `morganToggle.js` -> `apps/morgan/morganToggle.js`
- `timeUtils.js` -> `apps/morgan/timeUtils.js`
- `rateLimitState.js` -> `apps/morgan/rateLimitState.js`
- `jest.config.js` -> `apps/morgan/jest.config.js`
- `__tests__/` -> `apps/morgan/__tests__/` (7 test files)

## Verification Results

- All 7 test suites pass (90 tests)
- No `.js` files remain at repo root
- `package.json` main and scripts point to `apps/morgan/`
- No `apps/morgan/package.json` exists (per decision D-04)
- Git detects all moves as renames (100% similarity)

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | fc05e21 | Relocate Morgan voice service to apps/morgan/ |

## Self-Check: PASSED

- FOUND: apps/morgan/index.js
- FOUND: apps/morgan/voiceGateway.js
- FOUND: apps/morgan/jest.config.js
- FOUND: .planning/phases/25-file-structure-cleanup/25-01-SUMMARY.md
- FOUND: commit fc05e21
