# Phase 25: File Structure Cleanup - Research

**Researched:** 2026-03-25
**Domain:** Monorepo file organization, Node.js module relocation, deployment config updates
**Confidence:** HIGH

## Summary

Phase 25 is a pure file-move and cleanup phase with zero behavior changes. The core work is relocating the Morgan voice service from the repository root into `apps/morgan/`, deleting the stale `apps/payroll-dashboard/` empty directory, removing orphaned documentation files, and consolidating useful doc content into README.md.

The primary risk is breaking Morgan's Railway deployment or its test suite. Morgan is a plain Node.js/Express app using CommonJS `require()` with relative paths. Since all Morgan source files move together into `apps/morgan/`, internal require paths (`./voiceGateway`, `./morganToggle`, etc.) remain unchanged. Test files in `__tests__/` use `../` paths to reach source files; since `__tests__/` moves as a sibling inside `apps/morgan/`, these paths also remain unchanged. The deployment configs (`railway.toml`, `nixpacks.toml`, `package.json` scripts) need path updates.

**Primary recommendation:** Execute this as a sequence of atomic moves -- Morgan relocation first (with immediate test verification), then stale directory deletion, then doc consolidation. Each step is independently verifiable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Move all Morgan files (index.js, voiceGateway.js, morganToggle.js, timeUtils.js, rateLimitState.js) to `apps/morgan/`
- **D-02:** Update all relative require paths -- paths stay the same since files move together, but test paths change from `../` to `./` or stay relative within `apps/morgan/`
- **D-03:** Move `__tests__/` to `apps/morgan/__tests__/` with `jest.config.js` -- tests must update require paths from `../morganToggle` to `../morganToggle` (relative to new location)
- **D-04:** Keep Morgan dependencies in root `package.json` -- do NOT split into separate package.json. Railway runs `npm install` from root and Morgan is working successfully. Minimizing risk is the priority.
- **D-05:** `railway.toml` and `nixpacks.toml` stay at repo root -- update start command/paths to point to `apps/morgan/index.js` instead of `index.js`
- **D-06:** Delete `apps/payroll-dashboard/` -- empty directory, no files, no references anywhere. Superseded by unified `ops-dashboard` in v1.3.
- **D-07:** After Morgan files move out, root should contain only: package.json, package-lock.json, tsconfig.base.json, docker-compose.yml, Dockerfile.nextjs, railway.toml, nixpacks.toml, CLAUDE.md, README.md, prisma/, apps/, packages/, node_modules/, .planning/
- **D-08:** Merge useful content from FIXES.md, ISSUES.md, TESTING.md, and docs/railway-deploy.md into README.md
- **D-09:** Delete FIXES.md, ISSUES.md, TESTING.md, and docs/ directory after consolidation

### Claude's Discretion
- Exact README section structure and formatting -- Claude should make it clean and professional
- Whether Morgan require paths need any changes (if files all move together, relative paths within the Morgan codebase stay the same)
- How to handle the root `jest.config.js` -- move to `apps/morgan/` since it's Morgan's test config

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FS-01 | Morgan voice service files relocated to `apps/morgan/` with no behavior change | Morgan file inventory complete; require path analysis confirms no changes needed; deployment config updates identified |
| FS-02 | Stale standalone `payroll-dashboard` app deleted from `apps/` | Confirmed empty directory; references in README.md, CLAUDE.md, docs/railway-deploy.md identified for cleanup |
| FS-03 | Orphaned root files (beyond Morgan) identified and removed or relocated | Full root directory audit complete; orphan list identified |
| FS-04 | Stale docs (FIXES.md, ISSUES.md, TESTING.md, docs/) consolidated into README and deleted | Content audit of all 4 doc sources complete; consolidation strategy identified |
</phase_requirements>

## Standard Stack

Not applicable -- this phase involves no new libraries or dependencies. All work is file moves, deletions, and text edits.

## Architecture Patterns

### Current Root Directory (before cleanup)
```
.                           # Repository root
├── index.js                # Morgan entry point (MOVE)
├── voiceGateway.js         # Morgan Vapi logic (MOVE)
├── morganToggle.js         # Morgan enable/disable (MOVE)
├── timeUtils.js            # Morgan business hours (MOVE)
├── rateLimitState.js       # Morgan rate limiting (MOVE)
├── jest.config.js          # Morgan test config (MOVE)
├── __tests__/              # Morgan tests (MOVE)
├── FIXES.md                # Stale doc (DELETE after consolidation)
├── ISSUES.md               # Stale doc (DELETE after consolidation)
├── TESTING.md              # Stale doc (DELETE after consolidation)
├── docs/                   # Stale doc dir (DELETE after consolidation)
│   └── railway-deploy.md
├── .env                    # Local env (stays, gitignored)
├── .env.example            # Env template (stays)
├── .github/                # GH Actions workflows (stays)
├── .gitignore              # Git config (stays)
├── package.json            # Monorepo + Morgan deps (UPDATE scripts)
├── package-lock.json       # Lock file (stays)
├── tsconfig.base.json      # TS config (stays)
├── docker-compose.yml      # Docker orchestration (stays)
├── Dockerfile.nextjs       # Shared Next.js Dockerfile (stays)
├── railway.toml            # Railway config (UPDATE -- currently has no start cmd)
├── nixpacks.toml           # Nixpacks config (UPDATE -- currently has no start cmd)
├── CLAUDE.md               # AI instructions (UPDATE references)
├── README.md               # Project readme (UPDATE with consolidated docs)
├── prisma/                 # Database (stays)
├── apps/                   # App workspaces (stays)
│   ├── ops-api/
│   ├── ops-dashboard/
│   ├── payroll-dashboard/  # Empty directory (DELETE)
│   └── sales-board/
├── packages/               # Shared packages (stays)
└── .planning/              # Planning docs (stays)
```

### Target Root Directory (after cleanup)
```
.
├── package.json            # Monorepo + Morgan deps
├── package-lock.json
├── tsconfig.base.json
├── docker-compose.yml
├── Dockerfile.nextjs
├── railway.toml
├── nixpacks.toml
├── CLAUDE.md
├── README.md
├── .env.example
├── .env                    # gitignored
├── .gitignore
├── .github/
├── prisma/
├── apps/
│   ├── morgan/             # NEW location
│   │   ├── index.js
│   │   ├── voiceGateway.js
│   │   ├── morganToggle.js
│   │   ├── timeUtils.js
│   │   ├── rateLimitState.js
│   │   ├── jest.config.js
│   │   └── __tests__/
│   ├── ops-api/
│   ├── ops-dashboard/
│   └── sales-board/
├── packages/
└── .planning/
```

### Pattern: Morgan Require Path Analysis (CRITICAL)

**Source files -- internal requires (NO CHANGE NEEDED):**
All Morgan source files use `./` relative requires to sibling files. Since all files move together into the same directory, these paths are unchanged:
```javascript
// index.js -- these all stay exactly the same
const { startOutboundCall } = require("./voiceGateway");
const { isMorganEnabled } = require("./morganToggle");
const { isBusinessHours } = require("./timeUtils");
const { getLastVapi429At } = require("./rateLimitState");
```

**Test files -- mock/require paths (NO CHANGE NEEDED):**
Tests use `../` to reach sibling source files from `__tests__/`. Since `__tests__/` remains a direct child of the Morgan directory, these paths are unchanged:
```javascript
// __tests__/voiceGateway.test.js
jest.mock('../morganToggle', ...);    // still works
jest.mock('../rateLimitState', ...);  // still works
const voiceGateway = require('../voiceGateway');  // still works

// __tests__/morganToggle.test.js
const { isMorganEnabled } = require('../morganToggle');  // still works

// __tests__/timeUtils.test.js
const { isBusinessHours } = require('../timeUtils');  // still works

// __tests__/rateLimitState.test.js
const { setLastVapi429At, getLastVapi429At } = require('../rateLimitState');  // still works
```

**Test files with no external requires (NO CHANGE):**
- `helpers.test.js` -- self-contained, copies functions inline
- `integration.test.js` -- placeholder tests, no requires
- `queueProcessor.test.js` -- self-contained simulation

### Pattern: Jest Config Relocation

Current `jest.config.js` at root:
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '*.js',                  // Collects from root .js files
    '!jest.config.js',
    '!coverage/**',
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  testTimeout: 10000,
  verbose: true,
};
```

When moved to `apps/morgan/jest.config.js`, this config works as-is because:
- `*.js` will now collect from `apps/morgan/*.js` (the Morgan source files)
- `**/__tests__/**/*.test.js` will find `apps/morgan/__tests__/*.test.js`
- `testEnvironment: 'node'` is correct for Morgan

**Update needed in root `package.json`:**
```json
{
  "scripts": {
    "start": "node apps/morgan/index.js",
    "test": "jest --config apps/morgan/jest.config.js",
    "test:watch": "jest --config apps/morgan/jest.config.js --watch",
    "test:coverage": "jest --config apps/morgan/jest.config.js --coverage"
  }
}
```

Also update `"main"` field from `"index.js"` to `"apps/morgan/index.js"`.

### Pattern: Deployment Config Updates

**railway.toml** -- Currently only has build secrets config, no start command. Railway likely uses `package.json` `start` script. Updating `package.json` `start` script is sufficient.

**nixpacks.toml** -- Currently only has build secrets config. Same situation -- relies on `package.json` `start` script.

**docker-compose.yml** -- Does NOT have a Morgan service defined. Only has `postgres`, `ops-api`, `ops-dashboard`, and `sales-board`. No changes needed for Morgan.

**GitHub Actions workflows** -- Two workflows (`morgan-pull-leads-now.yml`, `morgan-pull-yesterday-leads.yml`) use HTTP curl to hit Railway URL endpoints. These do NOT reference local file paths, so no changes needed.

### Anti-Patterns to Avoid
- **Creating `apps/morgan/package.json`:** Decision D-04 explicitly forbids this. Morgan deps stay in root package.json.
- **Changing Morgan source code behavior:** Zero behavior changes. Only file locations and config paths change.
- **Removing `.env.example` from root:** This stays -- it documents all env vars including Morgan's.
- **Moving `.github/` workflows:** These are repository-level, not Morgan-specific.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File moves | Manual copy-paste-delete | `git mv` | Preserves git history for all moved files |
| Reference finding | Manual search | `grep -r` across codebase | Catches all stale references in CLAUDE.md, README.md, etc. |

**Key insight:** Use `git mv` for all file moves to preserve blame history. This is a one-command operation per file that handles both the filesystem move and the git staging.

## Common Pitfalls

### Pitfall 1: Breaking Railway Deployment
**What goes wrong:** Morgan fails to start on Railway after the move because the start command still points to `node index.js` at root.
**Why it happens:** Railway uses `package.json` `start` script or railway.toml config. If either still references the old path, deployment fails.
**How to avoid:** Update `package.json` `"start"` script to `"node apps/morgan/index.js"`. Verify railway.toml and nixpacks.toml don't override it.
**Warning signs:** `MODULE_NOT_FOUND` error for `./index.js` in Railway logs.

### Pitfall 2: Jest Can't Find Tests After Move
**What goes wrong:** `npm test` returns 0 tests found.
**Why it happens:** Jest config at root no longer matches test file locations. The `--config` flag must point to the new config location.
**How to avoid:** Update all test scripts in package.json to use `--config apps/morgan/jest.config.js`.
**Warning signs:** "No tests found" or wrong working directory in Jest output.

### Pitfall 3: Stale References in Documentation
**What goes wrong:** CLAUDE.md, README.md, or other docs still reference `index.js` at root, `apps/payroll-dashboard`, or deleted docs.
**Why it happens:** Documentation references are easy to miss since they don't cause runtime errors.
**How to avoid:** After all moves/deletes, grep the entire repo for: `payroll-dashboard`, `root index.js`, `FIXES.md`, `ISSUES.md`, `TESTING.md`, `docs/railway-deploy`. Update all matches.
**Warning signs:** References to non-existent files or directories.

### Pitfall 4: npm Workspaces Glob Matches Morgan
**What goes wrong:** npm treats `apps/morgan/` as a workspace because of `"workspaces": ["apps/*"]` in root package.json, but Morgan has no package.json.
**Why it happens:** The glob `apps/*` matches all directories under apps.
**How to avoid:** This is actually fine -- npm workspaces only activates for directories that contain a `package.json`. Since Morgan will NOT have its own package.json (per D-04), npm will simply ignore it as a workspace. Verified: npm workspaces documentation confirms this behavior.
**Warning signs:** None expected, but verify with `npm ls --workspaces` after the move.

### Pitfall 5: Git History Loss
**What goes wrong:** File moves done with plain `mv` + `git add` instead of `git mv`, causing git to see delete + create instead of rename.
**Why it happens:** Developer uses filesystem commands instead of git commands.
**How to avoid:** Use `git mv source destination` for every file move.
**Warning signs:** `git status` shows files as "deleted" and "new file" instead of "renamed".

### Pitfall 6: README Payroll-Dashboard References
**What goes wrong:** README.md still lists payroll-dashboard in the monorepo layout, service responsibilities, and Railway deployment tables.
**Why it happens:** Multiple sections of README reference payroll-dashboard.
**How to avoid:** Found 3 specific locations in README.md that reference payroll-dashboard (lines 180, 202, 271). Also update the Mermaid diagram if it references stale apps. Additionally, CLAUDE.md references payroll-dashboard in multiple places.
**Warning signs:** grep for `payroll-dashboard` returns hits in documentation files.

## Code Examples

### git mv Commands for Morgan Relocation
```bash
# Create target directory
mkdir -p apps/morgan

# Move all Morgan source files
git mv index.js apps/morgan/index.js
git mv voiceGateway.js apps/morgan/voiceGateway.js
git mv morganToggle.js apps/morgan/morganToggle.js
git mv timeUtils.js apps/morgan/timeUtils.js
git mv rateLimitState.js apps/morgan/rateLimitState.js

# Move test directory
git mv __tests__ apps/morgan/__tests__

# Move jest config
git mv jest.config.js apps/morgan/jest.config.js
```

### Updated package.json Scripts
```json
{
  "main": "apps/morgan/index.js",
  "scripts": {
    "start": "node apps/morgan/index.js",
    "test": "jest --config apps/morgan/jest.config.js",
    "test:watch": "jest --config apps/morgan/jest.config.js --watch",
    "test:coverage": "jest --config apps/morgan/jest.config.js --coverage"
  }
}
```

### Delete Stale Directory
```bash
# payroll-dashboard is empty, just remove the directory
rm -rf apps/payroll-dashboard
# or: git rm -r apps/payroll-dashboard (if tracked)
```

### Verification Commands
```bash
# Verify Morgan tests pass after move
npm test

# Verify no stale references remain
grep -r "payroll-dashboard" --include="*.{json,yml,yaml,toml,md,js,ts,tsx}" .
grep -rn "root index.js\|root \`index.js\`" --include="*.md" .

# Verify npm workspaces still work
npm ls --workspaces
```

## Inventory of Files to Move/Delete/Update

### Files to MOVE (git mv)
| File | From | To |
|------|------|----|
| index.js | `/` | `apps/morgan/` |
| voiceGateway.js | `/` | `apps/morgan/` |
| morganToggle.js | `/` | `apps/morgan/` |
| timeUtils.js | `/` | `apps/morgan/` |
| rateLimitState.js | `/` | `apps/morgan/` |
| jest.config.js | `/` | `apps/morgan/` |
| __tests__/ | `/` | `apps/morgan/` |

### Files to DELETE
| File/Dir | Reason |
|----------|--------|
| apps/payroll-dashboard/ | Empty stale directory |
| FIXES.md | Content consolidated into README |
| ISSUES.md | Content consolidated into README |
| TESTING.md | Content consolidated into README |
| docs/ | Directory + railway-deploy.md consolidated into README |

### Files to UPDATE
| File | What Changes |
|------|-------------|
| package.json | `main`, `start`, `test`, `test:watch`, `test:coverage` paths |
| README.md | Remove payroll-dashboard refs, add consolidated doc content, update monorepo layout, update Morgan location |
| CLAUDE.md | Update Morgan file references, remove payroll-dashboard references, update test commands, update monorepo layout |

### Files CONFIRMED No Changes Needed
| File | Why |
|------|-----|
| railway.toml | Only has `[build] secrets = []`, no start command -- relies on package.json |
| nixpacks.toml | Only has `[phases.build] secrets = []`, no start command -- relies on package.json |
| docker-compose.yml | No Morgan service defined; only ops-api, ops-dashboard, sales-board |
| Dockerfile.nextjs | Only used for Next.js apps, not Morgan |
| .github/workflows/*.yml | Use HTTP URLs to Railway, not local file paths |
| .gitignore | No Morgan-specific entries |
| tsconfig.base.json | TypeScript config for ops platform, not used by Morgan (plain JS) |
| .env.example | Documents env vars, not file paths |
| prisma/ | Database, unrelated to Morgan |
| packages/ | Shared packages, unrelated to Morgan |

## Stale References Audit

### "payroll-dashboard" references found in tracked files:
1. **CLAUDE.md** -- line mentioning `npm run payroll:dev` and port 3012 (these refer to the OLD standalone app, now superseded by ops-dashboard)
2. **README.md** -- monorepo layout tree (line 180), service responsibilities (line 202), Railway deployment table (line 271)
3. **docs/railway-deploy.md** -- service mapping table (being deleted anyway)
4. **FIXES.md** -- historical fix references (being deleted anyway)
5. **.planning/** files -- STATE.md, ROADMAP.md, REQUIREMENTS.md (planning docs, leave as-is -- they document history)

### CLAUDE.md Updates Needed
CLAUDE.md currently references:
- `npm run payroll:dev` in the commands table -- this script no longer exists in package.json (already removed)
- `payroll-dashboard | 3012` in the Apps table -- needs removal or update
- Morgan at `index.js` in root -- needs update to `apps/morgan/index.js`
- `__tests__/` in test commands -- needs update
- Monorepo layout description needs update

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (root, moving to `apps/morgan/jest.config.js`) |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FS-01 | Morgan tests pass from new location | unit | `npm test` (after config update) | Yes -- 7 test files in __tests__/ |
| FS-01 | Morgan entry point resolves | smoke | `node -e "require('./apps/morgan/index.js')"` -- but this starts the server, so just verify `node -c apps/morgan/index.js` for syntax | N/A -- manual verification |
| FS-02 | payroll-dashboard directory gone | smoke | `test ! -d apps/payroll-dashboard && echo PASS` | N/A -- filesystem check |
| FS-03 | No orphaned root files | smoke | `ls *.js *.md 2>/dev/null` should return only CLAUDE.md and README.md | N/A -- filesystem check |
| FS-04 | Stale docs deleted | smoke | `test ! -f FIXES.md && test ! -f ISSUES.md && test ! -f TESTING.md && test ! -d docs && echo PASS` | N/A -- filesystem check |

### Sampling Rate
- **Per task commit:** `npm test` (runs all 7 Morgan test files)
- **Per wave merge:** `npm test -- --coverage` + filesystem verification commands
- **Phase gate:** Full test suite green + zero stale references via grep

### Wave 0 Gaps
None -- existing Morgan test infrastructure (Jest 29 + 7 test files) covers FS-01 verification. Filesystem checks for FS-02/03/04 are trivial commands, not test files.

## Open Questions

1. **Railway watch paths**
   - What we know: README.md documents recommended watch paths for Morgan as `/index.js`, `/voiceGateway.js`, etc. at root. Railway may or may not have these configured.
   - What's unclear: Whether Railway is actually configured with watch paths (this is a Railway UI setting, not in repo config).
   - Recommendation: Document the updated watch paths in README but note this requires manual Railway UI update. This is a deployment ops task, not a code change.

2. **CLAUDE.md stale app references**
   - What we know: CLAUDE.md lists 6 apps including auth-portal, manager-dashboard, payroll-dashboard, owner-dashboard -- but the actual `apps/` directory now has ops-api, ops-dashboard, sales-board (3 apps + soon morgan).
   - What's unclear: Whether CLAUDE.md should be fully rewritten to match current state or just have Morgan/payroll refs updated.
   - Recommendation: Update CLAUDE.md to reflect current app structure. The old standalone dashboard apps (auth-portal, manager-dashboard, payroll-dashboard, owner-dashboard) were consolidated into ops-dashboard in v1.3. CLAUDE.md should reflect reality.

## Sources

### Primary (HIGH confidence)
- Direct filesystem inspection of all files in the repository root
- Direct reading of all Morgan source files and test files for require path analysis
- Direct reading of package.json, railway.toml, nixpacks.toml, docker-compose.yml
- Direct reading of all stale documentation files (FIXES.md, ISSUES.md, TESTING.md, docs/railway-deploy.md)
- grep results for `payroll-dashboard` across entire codebase

### Secondary (MEDIUM confidence)
- npm workspaces behavior with directories lacking package.json (based on npm documentation knowledge -- workspaces only activate for dirs with package.json)

## Metadata

**Confidence breakdown:**
- File inventory: HIGH -- direct filesystem inspection
- Require path analysis: HIGH -- read every source and test file
- Deployment config impact: HIGH -- read all config files, confirmed minimal changes
- Stale reference audit: HIGH -- grep across entire codebase
- npm workspaces interaction: MEDIUM -- based on npm docs knowledge, should verify

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- no external dependencies or version concerns)
