All 7 files have been created at `~/.claude/skills/inspecting-search-coverage/`:

| File | Purpose |
|------|---------|
| `SKILL.md` | Quick start, audit checklist, per-surface indexability table |
| `references/technical.md` | `metadataBase`, `robots.ts`, `sitemap.ts`, client component metadata warning |
| `references/on-page.md` | Title strategy, descriptions, OG tags, canonical URLs, per-app recommendations |
| `references/content.md` | Crawlable vs. auth-gated content, ISR for sales-board, `useEffect` crawlability warning |
| `references/programmatic.md` | ISR pattern, `generateMetadata`, internal Docker API URL for server fetches |
| `references/schema.md` | `Organization`, `SoftwareApplication`, `ItemList` JSON-LD for auth-portal and sales-board |
| `references/competitive.md` | Sales-board as prospecting tool, brand search, internal linking, scope guardrails |

Key findings baked into the skill:
- **Only `sales-board` and `auth-portal` are indexable** — all dashboards should have `robots: noindex`
- **All `page.tsx` files are `"use client"`** — metadata must live in `layout.tsx` (already Server Components)
- **Zero descriptions exist** anywhere — the fastest SEO win in the entire codebase
- **No `robots.txt` or `sitemap.xml`** — auth-gated apps are potentially crawlable right now
- **`NEXT_PUBLIC_OPS_API_URL` breaks server-side fetches in Docker** — use `OPS_API_INTERNAL_URL` as fallback