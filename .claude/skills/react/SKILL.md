All 7 files created. Here's a summary:

---

**Generated skill files in `.claude/skills/react/`:**

| File | Content |
|------|---------|
| `SKILL.md` | Quick start with real code from the codebase, key concepts table, common patterns |
| `references/hooks.md` | Mount fetch, `useCallback`+`useEffect` pattern, local edit state, anti-patterns with explanations |
| `references/components.md` | `PageShell`, style constants pattern, tab navigation, conditional rendering, anti-patterns |
| `references/data-fetching.md` | **WARNING** about missing react-query, `authFetch` usage, parallel fetch, post-mutation refetch |
| `references/state.md` | State categories, form state management, derived state, anti-patterns |
| `references/forms.md` | **WARNING** about missing react-hook-form, controlled inputs, FormData pattern for login, number coercion |
| `references/performance.md` | Inline object props problem, `useCallback`/`useMemo` guidance, `React.memo`, code splitting |

Key highlights specific to this codebase:
- All examples use real patterns from `manager-dashboard`, `owner-dashboard`, and `auth-portal`
- Documents the `authFetch` + `captureTokenFromUrl()` requirement
- Warns about missing `@tanstack/react-query` and `react-hook-form` with migration guidance
- Captures the inline `CSSProperties` style constant pattern with the dark glassmorphism theme