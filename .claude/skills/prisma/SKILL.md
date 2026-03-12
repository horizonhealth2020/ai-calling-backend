3 files written to `~/.claude/skills/prisma/`:

- **SKILL.md** — quick-reference with singleton import, common query patterns, soft-delete pattern, and links to related skills
- **references/patterns.md** — client singleton rationale, select/include patterns, compound upsert, `DECIMAL` vs `Float` warning, Prisma error codes (P2002/P2025/P2003), N+1 anti-pattern, and hard-delete anti-pattern
- **references/workflows.md** — step-by-step checklists for adding models, adding fields, running migrations with a feedback loop, idempotent seeding (with `upsert`-vs-`deleteMany` WARNING), and writing service functions with the `upsertPayrollEntryForSale` pattern as a real example