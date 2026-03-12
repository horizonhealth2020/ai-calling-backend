# Performance Reference

## Contents
- Avoid Inline Object Props
- useCallback for Stable References
- useMemo for Expensive Derivations
- React.memo for Pure Sub-Components
- Code Splitting
- Anti-Patterns

---

## Current Performance Profile

These are internal dashboards with small datasets (dozens of agents, hundreds of sales). The biggest performance risk is not render performance — it's **re-fetch overhead** (no caching layer) and **bundle size** (Next.js code splitting handles this automatically per page).

Only optimize after profiling. The patterns below prevent common mistakes.

---

## Avoid Inline Object Props

The most common performance mistake in this codebase. Module-level style constants have stable identity across renders; inline objects do not:

```typescript
// BAD — new object reference every render
<div style={{ padding: 24, background: "rgba(30,41,59,0.5)", borderRadius: 12 }}>

// GOOD — same reference, React skips reconciliation
const CARD: React.CSSProperties = {
  padding: 24,
  background: "rgba(30,41,59,0.5)",
  borderRadius: 12,
};
<div style={CARD}>
```

This matters most when passing styles as props to sub-components that are wrapped in `React.memo`.

---

## useCallback for Stable Function References

Use `useCallback` when:
1. A function is passed to a `React.memo` child (prevents re-render on every parent render)
2. A function is in a `useEffect` dependency array (prevents infinite loops)

```typescript
// Without useCallback — fetchData recreated every render, triggers useEffect on every render
const fetchData = (r: Range) => { ... };
useEffect(() => { fetchData(range); }, [range, fetchData]); // infinite loop

// With useCallback — stable reference
const fetchData = useCallback((r: Range) => {
  setLoading(true);
  authFetch(`${API}/api/summary?range=${r}`)
    .then(res => res.ok ? res.json() : null)
    .then(setSummary)
    .catch(() => {})
    .finally(() => setLoading(false));
}, []); // empty deps: function body doesn't close over any state

useEffect(() => { fetchData(range); }, [range, fetchData]); // runs only when range changes
```

Do NOT add `useCallback` to every function. Only use it when you have a concrete reason (dep array, memo child).

---

## useMemo for Expensive Derivations

Use `useMemo` for computations that:
- Run on large arrays (100+ items)
- Create lookup maps from arrays

```typescript
// Lookup map — O(1) access vs O(n) find on every render
const agentMap = useMemo(
  () => Object.fromEntries(agents.map(a => [a.id, a.name])),
  [agents]
);

// Filtered/sorted list
const filteredSales = useMemo(
  () => sales
    .filter(s => !agentFilter || s.agentId === agentFilter)
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()),
  [sales, agentFilter]
);
```

Do NOT use `useMemo` for simple property access or trivial computations — the overhead of the memo itself exceeds the savings.

---

## React.memo for Pure Sub-Components

Wrap row/card components that render in lists:

```typescript
const AgentRow = React.memo(function AgentRow({
  agent,
  onSave,
  onDelete,
}: {
  agent: Agent;
  onSave: (id: string, data: Partial<Agent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  // ...
});
```

**Only effective when:** Parent uses `useCallback` for `onSave`/`onDelete`. If the callbacks are recreated on every parent render, `React.memo` does nothing — the props still change.

```typescript
// Parent must stabilize callbacks
const handleSave = useCallback(async (id: string, data: Partial<Agent>) => {
  const res = await authFetch(`${API}/api/agents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.ok) {
    authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : agents).then(setAgents).catch(() => {});
  }
}, [agents]); // agents in deps because used in .catch fallback
```

---

## Code Splitting

Next.js automatically code-splits at the page level. No `React.lazy` needed for page routes.

Use dynamic imports for heavy components loaded conditionally:

```typescript
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./HeavyChart"), {
  loading: () => <div style={{ color: "#64748b" }}>Loading chart...</div>,
  ssr: false, // if it uses browser APIs
});

// Only loads HeavyChart bundle when tab === "charts"
{tab === "charts" && <HeavyChart data={sales} />}
```

---

## Anti-Patterns

### WARNING: useMemo/useCallback Everywhere

**The Problem:**

```typescript
// BAD — wrapping trivial operations
const title = useMemo(() => `Dashboard - ${agentName}`, [agentName]);
const handleClick = useCallback(() => setTab("agents"), []);
```

**Why This Breaks:** Memoization has overhead. For trivial computations, `useMemo` is slower than just recomputing. The code also becomes harder to read.

**Rule of thumb:** Profile first. Add `useMemo`/`useCallback` only when React DevTools profiler shows the component renders unnecessarily or the computation shows up as a bottleneck.

### WARNING: Deriving State from Server Data in useEffect

```typescript
// BAD — re-derives on every sale change, could be computed during render
useEffect(() => {
  setWeeklyTotal(sales.reduce((sum, s) => sum + s.premium, 0));
}, [sales]);

// GOOD — computed in render, zero overhead
const weeklyTotal = sales.reduce((sum, s) => sum + s.premium, 0);
// Or with memo if sales is large:
const weeklyTotal = useMemo(() => sales.reduce((sum, s) => sum + s.premium, 0), [sales]);
```
