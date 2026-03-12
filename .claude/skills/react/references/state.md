# State Reference

## Contents
- State Categories in This Project
- Page-Level State
- Sub-Component Local State
- Derived State
- Anti-Patterns

---

## State Categories in This Project

| Category | Where Lives | Solution |
|----------|------------|----------|
| Server data (agents, sales, products) | Page component | `useState` + `authFetch` |
| UI state (tab, modal open, loading) | Page component or sub-component | `useState` |
| Form drafts | Page or sub-component | `useState` object |
| Auth token | `localStorage` | Managed by `@ops/auth/client` — never touch directly |

There is no global state library. No Redux, Zustand, or Context API. Each page component is self-contained.

---

## Page-Level State

Page components own all server data. Pattern:

```typescript
export default function Page() {
  // Server data
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // UI state
  const [tab, setTab] = useState<"sales" | "agents" | "config">("sales");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Form state
  const [form, setForm] = useState<SaleForm>({
    agentId: "", productId: "", leadSourceId: "", premium: "", saleDate: "",
  });
}
```

Initialize lists to `[]`, nullable objects to `null`. Never `undefined` for list state — it requires null checks everywhere.

---

## Form State Management

Forms use a single state object, updated with spread:

```typescript
const [form, setForm] = useState({
  agentId: "",
  productId: "",
  leadSourceId: "",
  premium: "",
  enrollmentFee: "",
  paymentType: "",
  saleDate: new Date().toISOString().slice(0, 10), // default to today
});

// Single field update
<input
  value={form.premium}
  onChange={e => setForm(f => ({ ...f, premium: e.target.value }))}
/>
```

**Why functional update `f => ({ ...f, ... })`:** Avoids stale closure when multiple state updates happen in the same event. Required when updating multiple fields in sequence.

Pre-populate select fields when reference data loads:

```typescript
.then(([agents, products, leadSources]) => {
  setAgents(agents);
  setProducts(products);
  setLeadSources(leadSources);
  // Pre-select first option so form is valid immediately
  setForm(f => ({
    ...f,
    agentId: agents[0]?.id ?? "",
    productId: products[0]?.id ?? "",
    leadSourceId: leadSources[0]?.id ?? "",
  }));
});
```

---

## Sub-Component Local State

Sub-components manage their own view/edit toggle and draft state. Parent never owns the draft:

```typescript
function AgentRow({ agent, onSave }: { agent: Agent; onSave: (id: string, d: Partial<Agent>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ name: agent.name, email: agent.email ?? "" });

  // draft is LOCAL — parent only sees the committed save via onSave callback
}
```

**Why this pattern:** Parent list doesn't re-render while user types in an edit field. Only re-renders on save.

---

## Derived State

NEVER store derived values in state. Compute during render:

```typescript
// BAD — derived state that must be kept in sync
const [totalPremium, setTotalPremium] = useState(0);
useEffect(() => {
  setTotalPremium(sales.reduce((sum, s) => sum + s.premium, 0));
}, [sales]);

// GOOD — computed during render, always correct
const totalPremium = sales.reduce((sum, s) => sum + s.premium, 0);
```

Derived values that are expensive to compute (large lists, complex aggregations) can use `useMemo`:

```typescript
const agentMap = useMemo(
  () => Object.fromEntries(agents.map(a => [a.id, a])),
  [agents]
);
```

---

## Anti-Patterns

### WARNING: Prop Drilling Past 3 Levels

**The Problem:** This codebase uses large page components. When sub-components need data from 4+ levels up, it gets brittle.

**Current state:** Not yet a problem — most sub-components are one level deep (page → row component).

**The Fix when it becomes a problem:** React Context for dashboard-wide values (current user, roles). Not needed today — resist premature abstraction.

### WARNING: State for Server Data That Should Be Refetched

**The Problem:**

```typescript
// BAD — optimistically updating local state without confirming server state
const handleDelete = (id: string) => {
  setAgents(prev => prev.filter(a => a.id !== id)); // remove from UI immediately
  authFetch(`${API}/api/agents/${id}`, { method: "DELETE" }); // fire and forget
};
```

**Why This Breaks:** If the DELETE fails, the UI shows the item as deleted but it still exists in the database. The user sees stale data until they refresh.

**The Fix:** Await the request, then refetch on success:

```typescript
const handleDelete = async (id: string) => {
  const res = await authFetch(`${API}/api/agents/${id}`, { method: "DELETE" });
  if (res.ok) {
    authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : agents).then(setAgents).catch(() => {});
  } else {
    setMsg(`Error: Request failed (${res.status})`);
  }
};
```
