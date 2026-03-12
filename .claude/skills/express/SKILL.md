All 6 files created at `C:/Users/javer/.claude/skills/express/`:

- **SKILL.md** — Quick start, middleware chain, new route checklist, related skills
- **references/routes.md** — `asyncHandler`, `zodErr`, flat route structure, middleware ordering
- **references/services.md** — `logAudit` patterns, payroll service, error throwing conventions
- **references/database.md** — Prisma singleton, select projections, upsert patterns, N+1 prevention, transactions
- **references/auth.md** — `requireAuth`/`requireRole` internals, token flow, CORS config, SUPER_ADMIN bypass
- **references/errors.md** — Global error handler, exposable errors, `zodErr`, frontend status code display

All examples are drawn from actual codebase code (`asyncHandler` at `routes/index.ts:22`, `zodErr` at `routes/index.ts:13`, middleware at `middleware/auth.ts`, etc.), not generic Express boilerplate.