3 files written to `~/.claude/skills/postgresql/`:

**SKILL.md** — Quick reference covering Docker healthcheck config, financial decimal columns, the Prisma singleton pattern, and the audit logging pattern.

**references/patterns.md** — Deep patterns covering:
- PostgreSQL-native enums via Prisma
- Composite unique constraints + upsert pattern
- JSONB for audit metadata
- `Decimal(12,2)` enforcement (with explanation of why `Float` corrupts financial data)
- `adjustmentAmount` negative-allowed rationale
- Index strategy for date-range queries
- 3 anti-patterns with full WARNING format: bare `depends_on`, missing cascade policies, and raw SQL aggregations bypassing Decimal types

**references/workflows.md** — Step-by-step workflows covering:
- Dev migration loop with iterative validation
- Local Docker setup and connection string formats
- 10-step checklist for adding a new table
- Safe vs. unsafe schema changes (nullable vs. non-nullable, column rename trap)
- Connection troubleshooting for the most common failures (`ECONNRESET`, out-of-sync client, migration conflicts)