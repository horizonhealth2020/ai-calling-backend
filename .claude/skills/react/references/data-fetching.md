# Data Fetching Reference

## Contents
- WARNING: Missing Professional Data Fetching Solution
- authFetch (Project Standard)
- Parallel Fetching on Mount
- Parameterized Fetching
- Post-Mutation Refetch
- Error Handling
- Anti-Patterns

---

## WARNING: Missing Professional Data Fetching Solution

**Detected:** No `@tanstack/react-query`, `swr`, or equivalent in dependencies.

**Current approach:** Manual `useEffect` + `useState` + `authFetch`. This works for the current scale but has real costs:
- No caching — every page mount hits the API
- No deduplication — same endpoint fetched multiple times if two components mount
- No retry logic — transient failures require a full page reload
- Manual loading/error state in every component

**When this becomes painful:** Adding pagination, background refresh, or optimistic updates will require significant boilerplate.

**Recommended fix when needed:**

```bash
npm install @tanstack/react-query --workspace=apps/manager-dashboard
```

Until then, follow the patterns below consistently. Do NOT introduce react-query in one dashboard — it creates inconsistency. Migrate all dashboards together or stick with the current pattern.

---

## authFetch (Project Standard)

ALWAYS use `authFetch` for authenticated endpoints. Never use raw `fetch`.

```typescript
import { authFetch, captureTokenFromUrl } from "@ops/auth/client";

const API = process.env.NEXT_PUBLIC_OPS_API_URL;
```

`authFetch` automatically:
- Injects `Authorization: Bearer <token>` header
- Enforces 30-second timeout (throws "Request timed out after 30 seconds")
- Refreshes token if within 15 minutes of expiry

Use raw `fetch` ONLY for the login endpoint (no token exists yet):

```typescript
// auth-portal only — no token available at login time
const res = await fetch("/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

---

## Parallel Fetching on Mount

Load all required data in parallel with `Promise.all`:

```typescript
useEffect(() => {
  captureTokenFromUrl(); // MUST be first call on every page mount
  Promise.all([
    authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : []).catch(() => []),
    authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
    authFetch(`${API}/api/lead-sources`).then(r => r.ok ? r.json() : []).catch(() => []),
    authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).catch(() => []),
  ]).then(([agents, products, leadSources, sales]) => {
    setAgents(agents);
    setProducts(products);
    setLeadSources(leadSources);
    setSales(sales);
    setLoading(false);
  });
}, []);
```

The `.catch(() => [])` per-request means one failed endpoint doesn't block the rest from rendering.

---

## Parameterized Fetching

When fetch depends on a reactive value (range selector, active tab):

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
}, []);

useEffect(() => { fetchData(range); }, [range, fetchData]);
```

---

## Post-Mutation Refetch

After a successful write, refetch affected data:

```typescript
async function submitSale(e: FormEvent) {
  e.preventDefault();
  setMsg("");
  try {
    const res = await authFetch(`${API}/api/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, premium: Number(form.premium) }),
    });
    if (res.ok) {
      setMsg("Sale submitted successfully");
      // Refetch data that changed
      authFetch(`${API}/api/tracker/summary`).then(r => r.ok ? r.json() : []).then(setTracker).catch(() => {});
      authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).then(setSales).catch(() => {});
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
    }
  } catch (e: any) {
    setMsg(`Error: Unable to reach API server — ${e.message ?? "network error"}`);
  }
}
```

---

## Error Handling

Three error sources to handle:

| Source | Pattern |
|--------|---------|
| API error response | `const err = await res.json().catch(() => ({})); setMsg(err.error ?? \`Request failed (${res.status})\`)` |
| Network / timeout | `catch (e: any) { setMsg(\`Unable to reach API — ${e.message}\`) }` |
| Invalid JSON body | `.catch(() => ({}))` after `res.json()` |

Always show the HTTP status code. `Request failed (502)` is debuggable; `Request failed` is not.

---

## Anti-Patterns

### WARNING: useEffect for Data Fetching Without authFetch

**The Problem:**

```typescript
// BAD — skips token injection, no timeout, returns 401
useEffect(() => {
  fetch(`${API}/api/agents`).then(r => r.json()).then(setAgents);
}, []);
```

**Why This Breaks:** Raw `fetch` sends no `Authorization` header. The ops-api `requireAuth` middleware rejects it with 401. The `.then(r => r.json())` then tries to parse `{"error":"Unauthorized"}` as an array and crashes.

**The Fix:** Always use `authFetch` from `@ops/auth/client`.

### WARNING: Sequential Fetches for Independent Data

**The Problem:**

```typescript
// BAD — 3 sequential round trips instead of 1 parallel batch
const agents = await authFetch(`${API}/api/agents`).then(r => r.json());
const products = await authFetch(`${API}/api/products`).then(r => r.json());
const sales = await authFetch(`${API}/api/sales`).then(r => r.json());
```

**Why This Breaks:** Each request waits for the previous. 3 × 200ms = 600ms page load vs 200ms with `Promise.all`.

**The Fix:** Use `Promise.all` with all independent requests.
