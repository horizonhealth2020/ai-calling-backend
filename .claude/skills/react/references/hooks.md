# Hooks Reference

## Contents
- Core Patterns
- useCallback + useEffect for Parameterized Fetching
- Local Edit State Pattern
- Anti-Patterns

---

## Core Patterns

This codebase uses only React built-ins: `useState`, `useEffect`, `useCallback`. No custom hooks exist yet — logic lives directly in page components.

### Mount Fetch (Single Load)

```typescript
useEffect(() => {
  captureTokenFromUrl(); // always first — captures JWT from redirect URL
  Promise.all([
    authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : []).catch(() => []),
    authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
  ]).then(([agents, products]) => {
    setAgents(agents);
    setProducts(products);
    setLoading(false);
  });
}, []); // empty deps = run once on mount
```

`captureTokenFromUrl()` must be the first call — it extracts `?session_token=` from the URL and persists it to localStorage. Miss it and every `authFetch` call will 401.

### useCallback + useEffect for Parameterized Fetching

Use this when fetch depends on a reactive value (range, tab, filter):

```typescript
const fetchData = useCallback((r: Range) => {
  setLoading(true);
  Promise.all([
    authFetch(`${API}/api/owner/summary?range=${r}`).then(res => res.ok ? res.json() : null).catch(() => null),
    authFetch(`${API}/api/tracker/summary?range=${r}`).then(res => res.ok ? res.json() : []).catch(() => []),
  ]).then(([summary, tracker]) => {
    setSummary(summary);
    setTracker(tracker);
    setLoading(false);
  });
}, []); // no deps needed if only uses params

useEffect(() => { fetchData(range); }, [range, fetchData]);
```

**Why `useCallback`:** Without it, `fetchData` is recreated on every render, making `useEffect`'s `[range, fetchData]` dep array unstable and causing an infinite loop.

### Local Edit State in Sub-Components

```typescript
function AgentRow({ agent, onSave, onDelete }: {
  agent: Agent;
  onSave: (id: string, data: Partial<Agent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({
    name: agent.name,
    email: agent.email ?? "",
    extension: agent.extension ?? "",
  });
  const [saving, setSaving] = useState(false);

  if (!edit) return <ViewMode onEdit={() => setEdit(true)} onDelete={() => onDelete(agent.id)} />;

  return (
    <EditMode
      draft={draft}
      saving={saving}
      onChange={field => setDraft(x => ({ ...x, ...field }))}
      onSave={async () => {
        setSaving(true);
        await onSave(agent.id, draft);
        setEdit(false);
        setSaving(false);
      }}
      onCancel={() => setEdit(false)}
    />
  );
}
```

---

## Anti-Patterns

### WARNING: Missing Dependency in useEffect

**The Problem:**

```typescript
// BAD - range used inside but not in deps
useEffect(() => {
  authFetch(`${API}/api/summary?range=${range}`).then(...);
}, []); // stale closure — always uses initial range value
```

**Why This Breaks:**
1. When `range` changes, the effect does NOT re-run — user sees stale data
2. ESLint's `react-hooks/exhaustive-deps` rule catches this, but only if enabled

**The Fix:**

```typescript
// GOOD - use useCallback pattern when dep is also used in fetchData
const fetchData = useCallback((r: Range) => {
  authFetch(`${API}/api/summary?range=${r}`).then(...);
}, []);

useEffect(() => { fetchData(range); }, [range, fetchData]);
```

### WARNING: Calling captureTokenFromUrl() Outside useEffect

**The Problem:**

```typescript
// BAD - runs during SSR, crashes on server (no window)
captureTokenFromUrl(); // top-level in component body
```

**Why This Breaks:** `captureTokenFromUrl` accesses `window.location` — undefined during Next.js SSR. Causes a hydration error or build crash.

**The Fix:** Always call inside `useEffect(() => { captureTokenFromUrl(); }, [])`.

---

## When to Extract a Custom Hook

Extract when the same fetch + state pattern appears in 3+ components. Current codebase doesn't have this yet — resist the urge to abstract prematurely.

Candidate pattern for extraction when ready:

```typescript
function useApiData<T>(path: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authFetch(`${API}${path}`)
      .then(r => r.ok ? r.json() : fallback)
      .catch(() => fallback)
      .then(d => { setData(d); setLoading(false); });
  }, [path]);
  return { data, loading };
}
```
