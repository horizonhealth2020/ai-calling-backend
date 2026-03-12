# Forms Reference

## Contents
- WARNING: Missing Form Library
- Standard Form Pattern
- Field Binding
- Submission Handler
- Error Display
- Number Coercion
- Anti-Patterns

---

## WARNING: Missing Form Library

**Detected:** No `react-hook-form`, `formik`, or validation library in frontend dependencies.

**Impact:** All forms use manual `useState` + inline validation. This is workable at the current scale but:
- No field-level validation before submit
- No dirty state tracking (can't warn on unsaved changes)
- Re-renders entire form on every keystroke (not a problem now, but will be)

**When to add:** If any form exceeds ~10 fields or needs field-level error messages, add `react-hook-form` + see the **zod** skill for schema validation.

---

## Standard Form Pattern

```typescript
const [form, setForm] = useState({
  agentId: "",
  productId: "",
  premium: "",
  saleDate: new Date().toISOString().slice(0, 10),
});
const [msg, setMsg] = useState("");
const [submitting, setSubmitting] = useState(false);

async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  setMsg("");
  setSubmitting(true);
  try {
    const res = await authFetch(`${API}/api/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        premium: Number(form.premium), // coerce strings to numbers
        enrollmentFee: form.enrollmentFee ? Number(form.enrollmentFee) : null,
      }),
    });
    if (res.ok) {
      setMsg("Sale submitted successfully");
      setForm(f => ({ ...f, premium: "", enrollmentFee: "" })); // reset variable fields
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
    }
  } catch (e: any) {
    setMsg(`Error: Unable to reach API server — ${e.message ?? "network error"}`);
  } finally {
    setSubmitting(false);
  }
}
```

---

## Field Binding

All inputs bind with `value` + `onChange`:

```typescript
// Text input
<input
  style={INP}
  value={form.agentId}
  onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}
/>

// Select
<select
  style={INP}
  value={form.productId}
  onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
>
  {products.map(p => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ))}
</select>

// Date
<input
  type="date"
  style={INP}
  value={form.saleDate}
  onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))}
/>

// Number (store as string, coerce on submit)
<input
  type="number"
  style={INP}
  value={form.premium}
  placeholder="0.00"
  step="0.01"
  onChange={e => setForm(f => ({ ...f, premium: e.target.value }))}
/>
```

---

## Login Form (FormData Pattern)

Auth-portal uses `FormData` instead of controlled state — valid for simple login forms:

```typescript
async function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setError("");
  setLoading(true);

  const data = new FormData(e.currentTarget);
  const email = (data.get("email") as string).trim();
  const password = data.get("password") as string;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Invalid credentials. Please try again.");
      return;
    }
    const body = await res.json();
    if (body.redirect) window.location.href = body.redirect;
  } catch {
    setError("Network error. Please check your connection and try again.");
  } finally {
    setLoading(false);
  }
}

// In JSX — use name attributes, no value binding needed
<form onSubmit={handleSubmit}>
  <input name="email" type="email" required />
  <input name="password" type="password" required />
  <button type="submit" disabled={loading}>Sign In</button>
</form>
```

Use `FormData` only for unauthenticated forms with 2-3 fields. Use controlled state for all other forms.

---

## Number Coercion

The API expects numbers, forms store strings. Coerce on submit:

```typescript
body: JSON.stringify({
  premium: Number(form.premium),           // always number
  enrollmentFee: form.enrollmentFee        // optional number
    ? Number(form.enrollmentFee)
    : null,                                // null if empty string
  adjustmentAmount: Number(form.adjustmentAmount), // may be negative — DO NOT add .min(0)
})
```

See the **zod** skill — the API validates these with `.min(0)` (except `adjustmentAmount`).

---

## Error Display

```typescript
// After the form submit button
{msg && (
  <div style={{
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 8,
    background: msg.startsWith("Error") ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
    border: `1px solid ${msg.startsWith("Error") ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
    color: msg.startsWith("Error") ? "#f87171" : "#34d399",
    fontSize: 13,
  }}>
    {msg}
  </div>
)}
```

---

## Anti-Patterns

### WARNING: Ignoring HTTP Status in Error Handling

```typescript
// BAD — loses the status code, impossible to debug 502s from Railway
setMsg("Failed to submit sale");

// GOOD — always include status code
setMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
```

### WARNING: Not Resetting Form After Submit

After a successful form submission, reset the variable fields (keep reference selections like `agentId`):

```typescript
if (res.ok) {
  setMsg("Sale submitted");
  setForm(f => ({ ...f, premium: "", enrollmentFee: "", notes: "" }));
  // Keep agentId, productId, leadSourceId — user likely submitting multiple sales
}
```
