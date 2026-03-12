All 5 skill files created at `~/.claude/skills/node/`:

- **SKILL.md** — Quick overview with startup, async handler, logging, and cron patterns
- **references/patterns.md** — `asyncHandler` wrapper, concurrency/queue management, environment guards, audit logging, blocking-event-loop warning
- **references/types.md** — CommonJS vs ESM split, `esModuleInterop`, Express Request augmentation, `@ops/types` usage, `process.env` typing
- **references/modules.md** — Workspace resolution, path aliases (`@ops/*`), package boundaries, checklist for adding new packages, cross-package import warning
- **references/errors.md** — Global error handler, unhandled rejection safety, startup failure pattern, common runtime errors (missing middleware, raw Zod errors, CORS), silent-error warning

All examples are drawn directly from the actual codebase (`index.js`, `ops-api/src/index.ts`, `middleware/auth.ts`, `services/audit.ts`).