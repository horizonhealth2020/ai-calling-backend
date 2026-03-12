# Patterns Reference

## Contents
- New Page Checklist
- DO / DON'T Pairs
- Anti-Patterns: Generic AI Aesthetics
- WARNING: Tailwind in This Codebase
- WARNING: External Component Libraries

---

## New Page Checklist

When adding a new dashboard page, copy this checklist:

```
- [ ] Import PageShell from @ops/ui
- [ ] Define CARD, INP, LBL, BTN constants at module level (not inside component)
- [ ] Use authFetch for all API calls, captureTokenFromUrl() on mount
- [ ] Set NEXT_PUBLIC_OPS_API_URL via process.env (never hardcode)
- [ ] Error messages include status code: `err.error ?? \`Request failed (${res.status})\``
- [ ] No Tailwind classes, no CSS modules, no globals.css imports
- [ ] Loading state rendered while data fetches
- [ ] Table rows have TH + TD constants with consistent padding/border
```

---

## DO / DON'T Pairs

### Gradient Direction

```typescript
// DO — always 135deg
background: "linear-gradient(135deg, #3b82f6, #6366f1)"

// DON'T — other angles break visual cohesion
background: "linear-gradient(to right, #3b82f6, #6366f1)"
background: "linear-gradient(90deg, #3b82f6, #6366f1)"
```

### Glass Surface Opacity

```typescript
// DO — use established opacity values
background: "rgba(15,23,42,0.6)"      // inputs
background: "rgba(30,41,59,0.5)"      // card gradient start

// DON'T — arbitrary opacity invents a new layer
background: "rgba(15,23,42,0.3)"      // too transparent, unreadable
background: "rgba(15,23,42,0.95)"     // opaque, loses glassmorphism effect
```

### Border Opacity

```typescript
// DO — subtle borders that suggest depth
border: "1px solid rgba(255,255,255,0.06)"   // cards
border: "1px solid rgba(255,255,255,0.08)"   // inputs (slightly more visible)

// DON'T — solid or high-opacity borders are harsh on dark backgrounds
border: "1px solid #334155"
border: "1px solid rgba(255,255,255,0.3)"
```

### Color for State

```typescript
// DO — use semantic color mapping
const color = { approved: "#10b981", pending: "#fbbf24", locked: "#64748b" }[status];

// DON'T — invent new status colors
const color = status === "approved" ? "#22c55e" : "#eab308";  // wrong green, wrong yellow
```

### Empty States

```tsx
// DO — simple muted text, consistent with table context
{rows.length === 0 && (
  <tr><td colSpan={5} style={{ ...TD, color: "#475569", textAlign: "center", padding: 32 }}>
    No records found.
  </td></tr>
)}

// DON'T — elaborate illustrated empty states (out of character for ops tool)
```

---

## Anti-Patterns: Generic AI Aesthetics

AVOID these patterns that produce unmemorable, interchangeable dashboards:

**1. Neon glow overload**
```typescript
// BAD — every element competing for attention
boxShadow: "0 0 30px rgba(59,130,246,0.8), 0 0 60px rgba(99,102,241,0.5)"
```
Use: `boxShadow: "0 2px 8px rgba(59,130,246,0.2)"` — a single, restrained shadow.

**2. Purple-as-primary**
This codebase uses blue (`#3b82f6`) as primary. Purple (`#8b5cf6`) is decorative/brand only. Don't flip them.

**3. Blurred everything**
`backdropFilter: blur()` is on cards — not on inputs, buttons, or table rows. Adding blur to every element creates visual mud.

**4. Rounded corners on tables**
Tables are `borderCollapse: "collapse"` with flat edges. The CARD wrapper provides the rounded container. Don't add `borderRadius` to `<table>` or individual `<tr>`.

**5. Animated gradients**
`background-size: 200%` + `animation: gradient-shift` looks like a template. Static gradients are intentional here.

---

## WARNING: Tailwind in This Codebase

**The Problem:**

```tsx
// BAD — Tailwind is not installed or configured
<div className="bg-slate-900/60 rounded-xl p-6 backdrop-blur-md border border-white/5">
```

**Why This Breaks:**
1. Tailwind is not in any dashboard's dependencies — classes produce no output
2. Mixing class-based and inline-style approaches makes the codebase inconsistent
3. `bg-slate-900/60` silently produces nothing, leaving unstyled elements

**The Fix:** Use inline `React.CSSProperties` constants as shown throughout this skill.

---

## WARNING: External Component Libraries

**The Problem:**

```tsx
// BAD — no component library is installed
import { Button, Card, Table } from "@shadcn/ui";
import { Modal } from "@radix-ui/react-dialog";
```

**Why This Breaks:**
1. None of these packages are in `apps/*/package.json`
2. shadcn/ui components bring their own CSS variables that conflict with the glassmorphism system
3. Radix components render unstyled by default and require CSS that doesn't exist here

**The Fix:** Build components from HTML primitives + `React.CSSProperties`. The existing dashboards demonstrate every common pattern (modal-like panels, dropdowns, data tables) using this approach.

For React patterns, see the **react** skill.
