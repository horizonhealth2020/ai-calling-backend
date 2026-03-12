# Motion Reference

## Contents
- Motion Philosophy
- CSS Transitions (No Animation Library)
- Hover States
- Loading States
- Page-Level Transitions
- WARNING: JavaScript Animations

---

## Motion Philosophy

No animation library is installed (no Framer Motion, no Motion, no GSAP). All animation is CSS `transition` and `opacity` via inline styles. This is intentional — the dashboards are operational tools, not marketing pages. Motion should signal state changes, not impress.

**Rules:**
- Transitions: `150–200ms ease` for micro-interactions, `300ms ease` for panel entrances
- Never animate layout properties (`width`, `height`, `top`) — use `opacity` + `transform`
- Never block user interaction waiting for animation to finish

---

## CSS Transitions (No Animation Library)

Apply transitions via the `style` prop combined with React state:

```tsx
// Fade-in on mount pattern
const [visible, setVisible] = useState(false);
useEffect(() => { setVisible(true); }, []);

<div style={{
  opacity: visible ? 1 : 0,
  transform: visible ? "translateY(0)" : "translateY(8px)",
  transition: "opacity 300ms ease, transform 300ms ease",
}}>
  {/* content */}
</div>
```

```tsx
// Conditional panel slide-in
<div style={{
  maxHeight: expanded ? 400 : 0,
  overflow: "hidden",
  transition: "max-height 250ms ease",
}}>
  {/* expandable content */}
</div>
```

---

## Hover States

Use `onMouseEnter`/`onMouseLeave` to toggle style — there is no CSS hover pseudo-class available in inline styles.

```tsx
// Table row hover
const [hovered, setHovered] = useState<string | null>(null);

<tr
  style={{
    background: hovered === row.id ? "rgba(255,255,255,0.02)" : "transparent",
    transition: "background 0.15s",
    cursor: "pointer",
  }}
  onMouseEnter={() => setHovered(row.id)}
  onMouseLeave={() => setHovered(null)}
>
```

```tsx
// Button hover glow intensify (direct DOM mutation — ok for performance on simple elements)
<button
  style={BTN()}
  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.4)")}
  onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(59,130,246,0.2)")}
>
  Save
</button>
```

Direct DOM style mutation in event handlers (`e.currentTarget.style.X`) is acceptable for hover-only effects where the value doesn't need to reflect in React state. For anything more complex, use state.

---

## Loading States

```tsx
// Inline loading text — no spinner library needed
{loading ? (
  <div style={{ color: "#64748b", padding: 32, textAlign: "center", fontSize: 14 }}>
    Loading...
  </div>
) : (
  <table>...</table>
)}
```

```tsx
// Button loading state (disable + dim)
<button
  style={{ ...BTN(), opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}
  disabled={saving}
  onClick={handleSave}
>
  {saving ? "Saving..." : "Save"}
</button>
```

```tsx
// Pulsing skeleton (CSS animation via keyframes — requires a <style> tag or global CSS)
// AVOID this pattern — use text "Loading..." instead, consistent with existing dashboards
```

---

## Page-Level Transitions

Next.js App Router handles page transitions. These dashboards do not implement custom page transitions — the instantaneous switch is intentional for operational speed. Do not add page transition wrappers.

---

## WARNING: JavaScript Animations

### WARNING: requestAnimationFrame / setInterval for Animation

**The Problem:**

```tsx
// BAD — JS animation loop
useEffect(() => {
  const id = setInterval(() => setProgress(p => p + 1), 16);
  return () => clearInterval(id);
}, []);
```

**Why This Breaks:**
1. Runs on main thread, competes with React rendering
2. Not synchronized with browser paint cycle — causes jank
3. `setInterval` in a React effect is a memory leak if the component unmounts before cleanup fires

**The Fix:**

```tsx
// GOOD — CSS transition handles the animation
<div style={{
  width: `${progress}%`,
  transition: "width 300ms ease",
  height: 4,
  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
  borderRadius: 2,
}} />
// Update `progress` in state however you like — CSS handles the visual interpolation
```
