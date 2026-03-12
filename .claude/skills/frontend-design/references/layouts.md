# Layouts Reference

## Contents
- Page Shell Structure
- Content Layout Patterns
- Grid & Column Patterns
- Spacing Scale
- WARNING: Hardcoded Pixel Layouts

---

## Page Shell Structure

Every dashboard page wraps content in `PageShell` from `@ops/ui`. Never replicate the background or font-stack manually.

```tsx
import { PageShell } from "@ops/ui";

export default function Page() {
  return (
    <PageShell title="Manager Dashboard">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        {/* page content */}
      </div>
    </PageShell>
  );
}
```

`PageShell` provides:
- `background: linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)`
- `fontFamily: "'Inter', -apple-system, ..."`
- `minHeight: "100vh"`
- `color: "#e2e8f0"`

---

## Content Layout Patterns

### Single-Column Dashboard

```tsx
<div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
  <div style={CARD}>
    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Section Title</h2>
    {/* content */}
  </div>
  <div style={CARD}>
    {/* content */}
  </div>
</div>
```

### Two-Column Split

```tsx
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
  <div style={CARD}>{/* left */}</div>
  <div style={CARD}>{/* right */}</div>
</div>
```

### KPI Summary Row (owner-dashboard pattern)

```tsx
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
  {stats.map(s => (
    <div key={s.label} style={{ ...CARD, padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{s.value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
    </div>
  ))}
</div>
```

### Table + Side Panel

```tsx
<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
  <div style={CARD}>{/* table */}</div>
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={CARD}>{/* filters */}</div>
    <div style={CARD}>{/* actions */}</div>
  </div>
</div>
```

---

## Grid & Column Patterns

| Layout | Template | Use Case |
|--------|----------|----------|
| Single column | `"1fr"` | Forms, detail views |
| Two equal | `"1fr 1fr"` | Side-by-side cards |
| Main + sidebar | `"2fr 1fr"` | Table + filter panel |
| KPI row | `"repeat(auto-fit, minmax(180px, 1fr))"` | Stats overview |
| Form fields | `"1fr 1fr"` with `gap: 16` | Two-column form |

Always use CSS Grid for multi-column layouts — no floats, no absolute positioning.

---

## Spacing Scale

This project uses a loose 8px base scale. Common values:

```
4px   — tight inline spacing (icon gap, badge padding)
8px   — small gaps (button groups, inline chips)
12px  — compact card padding, row gaps
16px  — standard gap between form fields
20px  — compact card padding (KPI tiles)
24px  — standard card padding, page horizontal padding
32px  — section spacing, vertical page padding
40px  — large section gaps
```

Use `gap` on flex/grid containers rather than `margin` on children — it keeps spacing intent explicit.

---

## WARNING: Hardcoded Pixel Layouts

**The Problem:**

```tsx
// BAD — magic numbers, breaks at other viewport sizes
<div style={{ width: 847, marginLeft: 253 }}>
```

**Why This Breaks:**
1. Dashboard panels collapse or overflow on smaller laptop screens
2. Side panels with hardcoded widths create horizontal scroll at 1280px
3. Impossible to read intent — why 847? why 253?

**The Fix:**

```tsx
// GOOD — grid with proportional columns
<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
```

**Responsive note:** These dashboards target desktop operators (1280px+). `auto-fit` grid columns are sufficient — full mobile breakpoints are not required.
