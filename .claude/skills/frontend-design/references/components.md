# Components Reference

## Contents
- Standard Component Constants
- Data Tables
- Status Badges & Indicators
- Form Groups
- WARNING: Inline Object Anti-Pattern

---

## Standard Component Constants

Define all style constants at **module level**, typed as `React.CSSProperties`. This is the project's single styling convention — there is no component library.

```typescript
// Full set of constants for a typical dashboard page
const CARD: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.6))",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: 24,
  backdropFilter: "blur(10px)",
};

const INP: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  color: "#e2e8f0",
  outline: "none",
};

const LBL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 6,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// BTN is a factory for variant support
const BTN = (bg = "linear-gradient(135deg, #3b82f6, #6366f1)"): React.CSSProperties => ({
  padding: "10px 22px",
  background: bg,
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
  boxShadow: "0 2px 8px rgba(59,130,246,0.2)",
});
```

---

## Data Tables

Tables are the primary data display surface. Always use TH + TD constants for consistency.

```typescript
const TH: React.CSSProperties = {
  padding: "12px 18px",
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  textAlign: "left",
};

const TD: React.CSSProperties = {
  padding: "12px 18px",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
  fontSize: 14,
  color: "#e2e8f0",
};
```

Usage:

```tsx
<div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <thead>
      <tr>
        <th style={TH}>Agent</th>
        <th style={TH}>Sales</th>
        <th style={{ ...TH, textAlign: "right" }}>Amount</th>
      </tr>
    </thead>
    <tbody>
      {rows.map(row => (
        <tr key={row.id} style={{ transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
          onMouseLeave={e => (e.currentTarget.style.background = "")}>
          <td style={TD}>{row.agent}</td>
          <td style={TD}>{row.sales}</td>
          <td style={{ ...TD, textAlign: "right" }}>${row.amount.toFixed(2)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Status Badges & Indicators

```typescript
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: "#10b981",
    pending:  "#fbbf24",
    locked:   "#64748b",
    rejected: "#ef4444",
  };
  const color = colors[status] ?? "#64748b";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: `${color}22`,   // 13% opacity background
      color,
      border: `1px solid ${color}44`,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}>
      {status}
    </span>
  );
}
```

---

## Form Groups

Pair `LBL` + `INP` with consistent spacing:

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
  <div>
    <label style={LBL}>Agent Name</label>
    <input style={INP} value={name} onChange={e => setName(e.target.value)} />
  </div>
  <div>
    <label style={LBL}>Product</label>
    <select style={INP}>
      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  </div>
  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
    <button style={BTN()} onClick={handleSave}>Save</button>
    <button style={BTN("linear-gradient(135deg, #ef4444, #dc2626)")} onClick={handleDelete}>Delete</button>
  </div>
</div>
```

---

## WARNING: Inline Object Anti-Pattern

**The Problem:**

```tsx
// BAD — new object reference on every render
<div style={{ background: "rgba(15,23,42,0.6)", borderRadius: 8, padding: 24 }}>
```

**Why This Breaks:**
1. React creates a new object reference each render, defeating any memoization on child components
2. Repeated magic values scattered through JSX make global theme changes require grep-and-replace
3. Style inconsistencies creep in when the same "card" is written slightly differently in 10 places

**The Fix:**

```tsx
// GOOD — define once at module level, reference everywhere
const CARD: React.CSSProperties = { background: "rgba(15,23,42,0.6)", borderRadius: 8, padding: 24 };
<div style={CARD}>
```

**Spreading for overrides is fine:**

```tsx
// GOOD — base constant + targeted override
<div style={{ ...CARD, padding: 16 }}>
```
