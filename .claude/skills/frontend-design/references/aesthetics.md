# Aesthetics Reference

## Contents
- Typography
- Color System
- Glassmorphism Tokens
- Background & Surface Hierarchy
- Gradient Accent System

---

## Typography

`PageShell` sets the global font stack — never override it per-component.

```typescript
// packages/ui/src/index.tsx — PageShell root
fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
```

**Type scale used across dashboards:**

| Role | fontSize | fontWeight | color | Notes |
|------|----------|------------|-------|-------|
| Page title | 28px | 700 | gradient clip | Via PageShell header |
| Section heading | 16–18px | 700 | `#e2e8f0` | Inside CARD |
| Body / input | 14px | 400 | `#e2e8f0` | Standard content |
| Label | 11px | 700 | `#64748b` | `uppercase`, `letterSpacing: "0.05em"` |
| Table header | 11px | 800 | `#64748b` | `uppercase`, `letterSpacing: "0.08em"` |
| Muted / placeholder | 13px | 400 | `#475569` | Disabled, empty states |

**Gradient heading** (from PageShell):

```typescript
const TITLE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  background: "linear-gradient(135deg, #f1f5f9, #94a3b8)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};
```

---

## Color System

No CSS variables — tokens are literal values repeated across dashboards. Keep these exact values for consistency.

### Base Palette

```
Blue accent:   #3b82f6   — primary actions, links
Indigo:        #6366f1   — gradient end, secondary accent
Purple:        #8b5cf6   — logo, decorative gradients
Green:         #10b981   — success, payroll approved
Green dark:    #059669   — gradient start for green buttons
Amber:         #fbbf24   — locked periods, warnings
Red:           #ef4444   — errors, destructive actions
Red dark:      #dc2626   — gradient end for danger buttons
```

### Text Hierarchy

```
#e2e8f0   — primary text (slate-200)
#94a3b8   — secondary text (slate-400)
#64748b   — muted / labels (slate-500)
#475569   — dim / disabled (slate-600)
```

### Semantic Color Usage

```typescript
// Status badge pattern
const statusColor = (status: string) => ({
  approved: "#10b981",
  pending:  "#fbbf24",
  locked:   "#64748b",
  rejected: "#ef4444",
}[status] ?? "#64748b");
```

---

## Glassmorphism Tokens

These exact values create the layered depth effect. Deviation breaks visual cohesion.

```typescript
// Input / form fields
background: "rgba(15,23,42,0.6)"      // slate-900 at 60%
border:     "1px solid rgba(255,255,255,0.08)"

// Card surface
background: "linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.6))"
border:     "1px solid rgba(255,255,255,0.06)"
backdropFilter: "blur(10px)"

// Elevated card / modal (more prominent)
background: "linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))"
border:     "1px solid rgba(255,255,255,0.1)"
```

---

## Background & Surface Hierarchy

```
Page background (PageShell):
  linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)

Card surface (elevation 1):
  rgba(30,41,59,0.5) → rgba(15,23,42,0.6)  +  blur(10px)

Input surface (recessed):
  rgba(15,23,42,0.6)  — darker than card, no blur

Table row hover (subtle):
  rgba(255,255,255,0.02)
```

Think of it as: page → card → input, each getting darker/more opaque.

---

## Gradient Accent System

Gradients always run at **135deg**. Direction is consistent across the entire product.

```typescript
// Primary action (blue → indigo)
"linear-gradient(135deg, #3b82f6, #6366f1)"

// Success (green)
"linear-gradient(135deg, #059669, #10b981)"

// Danger (red)
"linear-gradient(135deg, #ef4444, #dc2626)"

// Page title text
"linear-gradient(135deg, #f1f5f9, #94a3b8)"

// Logo / brand mark
"linear-gradient(135deg, #3b82f6, #8b5cf6)"
```

Never use flat colors for primary buttons — the gradient is what makes the design distinctive.
