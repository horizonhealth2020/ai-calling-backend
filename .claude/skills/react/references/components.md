# Components Reference

## Contents
- Component Structure
- PageShell (Shared Layout)
- Style Constants Pattern
- Conditional Rendering
- Anti-Patterns

---

## Component Structure

All dashboard pages follow this layout:

```
"use client"              ← required — all pages are client components
imports                   ← @ops/auth/client, @ops/ui, react
style constants           ← INP, CARD, BTN, LBL defined at module level
type definitions          ← interfaces for API response shapes
sub-components            ← small display/edit components before the page
default export Page()     ← single large page component with all state
```

---

## PageShell (Shared Layout)

Every dashboard page wraps content in `PageShell` from `@ops/ui`:

```typescript
import { PageShell } from "@ops/ui";

export default function Page() {
  return (
    <PageShell title="Manager Dashboard">
      {/* your content */}
    </PageShell>
  );
}
```

`PageShell` provides: dark gradient background (`#0a0a0f` → `#111827`), centered max-width container (1280px), header with gradient title text, and the Horizon Health branding. Never recreate this manually.

---

## Style Constants Pattern

Define all styles as module-level constants, never inline object literals in JSX.

```typescript
// GOOD — defined once, referenced by name, stable identity
const CARD: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.6))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: 24,
};
const LBL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#64748b",
  marginBottom: 6, display: "block",
  textTransform: "uppercase", letterSpacing: "0.05em",
};
const INP: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, fontSize: 14, width: "100%",
  boxSizing: "border-box", color: "#e2e8f0", outline: "none",
};
```

For variant styles (button colors), use a function:

```typescript
const BTN = (color = "#3b82f6"): React.CSSProperties => ({
  padding: "10px 20px",
  background: color === "#3b82f6"
    ? "linear-gradient(135deg, #3b82f6, #6366f1)"
    : color === "#059669"
    ? "linear-gradient(135deg, #059669, #10b981)"
    : color,
  color: "white", border: "none", borderRadius: 8,
  fontWeight: 700, cursor: "pointer", fontSize: 13,
  boxShadow: `0 2px 8px ${color}30`,
});
// Usage: <button style={BTN()} /> or <button style={BTN("#059669")} />
```

---

## Tab Navigation Pattern

```typescript
function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 20px", border: "none", borderRadius: 8,
    cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s",
    background: active ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "transparent",
    color: active ? "#ffffff" : "#64748b",
    boxShadow: active ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
  };
}

// Usage
const [tab, setTab] = useState<"sales" | "agents" | "config">("sales");

<div style={{ display: "flex", gap: 4 }}>
  {(["sales", "agents", "config"] as const).map(t => (
    <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>
      {t.charAt(0).toUpperCase() + t.slice(1)}
    </button>
  ))}
</div>
```

---

## Conditional Rendering

Loading state pattern used across all pages:

```typescript
if (loading) return (
  <PageShell title="Dashboard">
    <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>Loading...</div>
  </PageShell>
);
```

Inline conditional for messages:

```typescript
{msg && (
  <div style={{
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

### WARNING: Inline Object Props

**The Problem:**

```typescript
// BAD — new object reference on every render, breaks React.memo
<div style={{ padding: 24, background: "rgba(30,41,59,0.5)" }}>
```

**Why This Breaks:** Inline object literals are recreated on every render. If the component is wrapped in `React.memo` or passes this as a prop, referential equality checks always fail, preventing memoization.

**The Fix:** Define as module-level constant. See Style Constants Pattern above.

### WARNING: No `"use client"` Directive

All dashboard pages use browser APIs (`localStorage`, `window.location`) and React hooks. Omitting `"use client"` causes a Next.js build error. Every page file must start with `"use client"`.

See the **nextjs** skill for Server Component vs Client Component guidance.
