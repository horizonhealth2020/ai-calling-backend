# Phase 9: UI/UX Polish - Research

**Researched:** 2026-03-16
**Domain:** React inline styling, form validation patterns, design system consolidation
**Confidence:** HIGH

## Summary

Phase 9 is a pure polish phase with no new features. The work centers on three areas: (1) adding client-side form validation with inline per-field errors, (2) migrating local style constants from each dashboard page to shared `@ops/ui` components and tokens, and (3) adding loading skeletons, empty states, and consistent hover/focus behavior across all dashboards.

The existing `@ops/ui` package already has a rich component library (Button, Card, Input, Skeleton, EmptyState, Badge, StatCard, TabNav, Toast, Tooltip) and a complete token system (colors, spacing, radius, shadows, typography, motion). The gap is adoption -- dashboards still define local CARD, INP, BTN, TH, TD constants instead of using shared components. The Input component already supports `error` prop for inline validation display. The design system CSS infrastructure (theme.css, animations.css, responsive.css) provides hover classes (`btn-hover`, `input-focus`, `row-hover`, `hover-lift`, `hover-glow-primary`) that need consistent application.

**Primary recommendation:** Work dashboard-by-dashboard. For each: replace local style constants with @ops/ui components, add form validation state management, wire Skeleton/EmptyState components, and ensure all interactive elements use the shared CSS hover/focus classes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Inline per-field errors: red border on invalid field + red error text below the field
- Validation triggers on submit only -- no on-blur or real-time validation
- Existing alert bar above form stays for API-level errors (500s, network failures)
- Inline errors for client-side field validation only (required fields, format, range)
- Submit button always enabled -- clicking with errors triggers validation display and shows inline errors
- Migrate local style constants (CARD, INP, BTN, etc.) to shared @ops/ui tokens and components
- All dashboards treated equally: manager, payroll, owner, auth-portal
- All input types (text, dropdown, date picker) share the same base style
- Labels positioned above inputs (stacked layout) across all forms
- Add Skeleton loading placeholders from @ops/ui where loading states are blank or spinner-only
- Standardize hover/focus states across all interactive elements using motion tokens from @ops/ui
- Use EmptyState component from @ops/ui for no-data scenarios
- Desktop-only for v1 -- no responsive/mobile optimization
- Use ui-ux-pro-max skill for targeted fixes -- audit and fix specific issues
- Do not redesign from scratch -- targeted improvements only
- Keep current dark glassmorphism theme depth as-is
- Unify button styles via shared Button component from @ops/ui with primary/secondary/danger variants
- Standardize table styling: consistent row height, hover color, header styling, border treatment

### Claude's Discretion
- Exact skeleton layout per dashboard (which sections get skeletons)
- Specific contrast/spacing fixes identified during ui-ux-pro-max audit
- Whether to create a shared Table component or just align table style constants
- Typography hierarchy adjustments within the existing token system
- Error message wording for each validation rule

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UIUX-01 | All forms have proper input validation with clear error messages | Input component already has `error` prop; validation state pattern documented; submit-only trigger per user decision |
| UIUX-02 | Form layouts are consistent and polished across all dashboards | @ops/ui components (Button, Card, Input) exist but need wider adoption; local style constants (INP, CARD, BTN, TH, TD) need replacement |
| UIUX-03 | UI/UX changes follow ui-ux-pro-max design guidance | Skill available at `.claude/skills/ui-ux-pro-max/`; use for targeted audit of contrast, spacing, visual hierarchy |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @ops/ui | local | Design system: tokens, components, CSS | Already the project's design system package |
| React | 18+ | Component framework | Already in use across all dashboards |
| lucide-react | latest | Icon library | Already used in all dashboards |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui/tokens | local | colors, spacing, radius, shadows, typography, motion | Every style reference |
| @ops/ui/components | local | Button, Card, Input, Skeleton, EmptyState, etc. | Replace local style constants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom validation | react-hook-form | Overkill for simple submit-only validation; adds dependency |
| Inline CSSProperties | CSS modules | Breaks established project pattern; not worth migration cost |

**Installation:**
No new dependencies needed. All components exist in `@ops/ui`.

## Architecture Patterns

### Recommended Project Structure
```
packages/ui/src/
  tokens.ts              # Design tokens (exists)
  components/
    Button.tsx           # Shared button (exists)
    Card.tsx             # Shared card (exists)
    Input.tsx            # Shared input with error prop (exists)
    Select.tsx           # NEW: Shared select matching Input style
    Skeleton.tsx         # Loading skeletons (exists)
    EmptyState.tsx       # Empty state (exists)
    Table.tsx            # NEW or style constants only (Claude's discretion)
    index.ts             # Barrel exports (exists)
  theme.css              # CSS custom properties (exists)
  responsive.css         # Hover/focus classes (exists)
  animations.css         # Keyframe animations (exists)
```

### Pattern 1: Submit-Only Form Validation
**What:** Client-side validation triggered on form submit, with per-field error state
**When to use:** Every form across all dashboards
**Example:**
```typescript
// Validation state alongside form state
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

function validateForm(): boolean {
  const errors: Record<string, string> = {};
  if (!agentId) errors.agentId = "Agent is required";
  if (!productId) errors.productId = "Product is required";
  if (!saleDate) errors.saleDate = "Sale date is required";
  if (!status) errors.status = "Status is required";
  if (premium !== undefined && premium < 0) errors.premium = "Premium must be zero or greater";
  setFieldErrors(errors);
  return Object.keys(errors).length === 0;
}

async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  if (!validateForm()) return;
  // proceed with API call...
  // API errors still go to alert bar (setMsg pattern)
}

// In JSX - use Input component's error prop
<Input
  label="Agent"
  value={agentId}
  error={fieldErrors.agentId}
  onChange={...}
/>
```

### Pattern 2: Select Component with Error Support
**What:** A shared Select component matching Input's style and error display
**When to use:** All dropdowns (agent, product, status, period selectors)
**Example:**
```typescript
// New component needed in @ops/ui
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Select({ label, error, icon, style, children, ...rest }: SelectProps) {
  const selectStyle: React.CSSProperties = {
    ...baseInputStyle,
    borderColor: error ? colors.danger : undefined,
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,...")`, // chevron
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
    boxSizing: "border-box",
    ...style,
  };
  // Same wrapper/label/error layout as Input
}
```

### Pattern 3: Local Style Constant Migration
**What:** Replace local CARD/INP/BTN/TH/TD constants with shared @ops/ui components or tokens
**When to use:** Every dashboard page
**Example:**
```typescript
// BEFORE (in manager-dashboard page.tsx):
const CARD: React.CSSProperties = {
  background: colors.bgSurface,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: radius.xl,
  padding: spacing[6],
};
// Usage: <div style={CARD}>...</div>

// AFTER:
import { Card } from "@ops/ui";
// Usage: <Card>...</Card>

// BEFORE:
const INP: React.CSSProperties = { ...baseInputStyle, boxSizing: "border-box" };
// Usage: <input style={INP} />

// AFTER:
import { Input } from "@ops/ui";
// Usage: <Input label="Field Name" error={fieldErrors.fieldName} />
```

### Pattern 4: Table Style Consolidation
**What:** Export shared table style constants from @ops/ui tokens (or a Table component)
**When to use:** All table views across dashboards
**Example:**
```typescript
// In tokens.ts - add shared table styles
export const baseThStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  whiteSpace: "nowrap",
};

export const baseTdStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: colors.textSecondary,
  borderBottom: `1px solid ${colors.borderSubtle}`,
};
```

### Anti-Patterns to Avoid
- **Defining local style constants that duplicate @ops/ui tokens:** Every dashboard has its own CARD, INP, TH, TD. Migrate to shared components/tokens.
- **Using `alert()` for user feedback:** Manager dashboard uses `alert()` in several edit/delete handlers. These should use the existing `setMsg` pattern or Toast.
- **Inconsistent loading states:** Manager dashboard uses raw div pulses; payroll/owner use SkeletonCard. Standardize on SkeletonCard/SkeletonTable.
- **Hardcoded color values:** Some dashboards use raw hex/rgba instead of token references. Always use `colors.*` tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation display | Custom error rendering per field | `<Input error={...}>` component | Already built, handles red border + error text |
| Loading skeletons | Pulsing div placeholders | `<SkeletonCard>`, `<SkeletonTable>`, `<SkeletonLine>` | Already in @ops/ui with shimmer animation |
| Empty states | Inline "No data" text | `<EmptyState>` component | Consistent styling, supports icon + action button |
| Button variants | Per-dashboard BTN_PRIMARY, BTN_DANGER, etc. | `<Button variant="primary\|danger\|secondary">` | Already supports primary/secondary/ghost/danger/success |
| Toast notifications | alert() calls | `useToast()` from ToastProvider | Already in @ops/ui, auto-dismissing, typed |
| Hover/focus effects | Inline onMouseEnter/onMouseLeave | CSS classes: `btn-hover`, `input-focus`, `row-hover` | Can't do :hover in inline styles; classes already exist |

**Key insight:** The @ops/ui package already contains nearly everything needed. The work is adoption and consistency, not creation.

## Common Pitfalls

### Pitfall 1: Breaking Existing Functionality During Style Migration
**What goes wrong:** Replacing local styles with shared components changes DOM structure, breaking event handlers or layout assumptions.
**Why it happens:** Local style constants are just CSS objects on divs. Shared components add wrapper elements, class names, and different prop APIs.
**How to avoid:** Migrate one component at a time. Test each form submission and interaction after migration. Keep the same state management; only change rendering.
**Warning signs:** Form submissions stop working; layout breaks; click handlers no longer fire.

### Pitfall 2: Select/Dropdown Elements Not Matching Input Style
**What goes wrong:** Native `<select>` elements ignore many CSS properties (background, border-radius on options). They look different from `<input>` elements.
**Why it happens:** Browser default styling overrides for select elements vary across platforms.
**How to avoid:** Style the select element itself (works for the closed state). Use `appearance: none` and a custom chevron SVG. Accept that the dropdown options list uses browser defaults -- this is fine for desktop internal tools.
**Warning signs:** Select elements look visually different from text inputs in the same form.

### Pitfall 3: Validation State Not Clearing on Successful Submit
**What goes wrong:** Red error borders persist after a successful form submission.
**Why it happens:** `setFieldErrors({})` is not called on the success path, or the form reset doesn't clear error state.
**How to avoid:** Clear field errors at the start of handleSubmit (before validation) or on successful API response. Pattern: `setFieldErrors({})` in the success handler alongside form field reset.
**Warning signs:** Submit a valid form, errors from previous attempt still visible.

### Pitfall 4: Large Page.tsx Files Become Hard to Navigate
**What goes wrong:** Manager dashboard is 2727 lines, payroll is 2808 lines. Adding validation state and error handling makes them even larger.
**Why it happens:** Single-file component pattern with all tabs, forms, and tables in one file.
**How to avoid:** Extract validation logic into a `useFormValidation` hook or keep validation functions at module scope. Do NOT refactor file structure (out of scope) -- just keep new code organized near the form it validates.
**Warning signs:** Validation code scattered across the file instead of grouped near form handler.

### Pitfall 5: Forgetting to Apply row-hover Class to Table Rows
**What goes wrong:** Some tables have hover effects, others don't. Inconsistent interaction feedback.
**Why it happens:** `className="row-hover"` must be manually added to every `<tr>` element. Easy to miss.
**How to avoid:** When standardizing table styles, always apply `className="row-hover"` to all data rows (not header rows). Search for all `<tr>` in dashboards and verify.
**Warning signs:** Hover over table rows -- some highlight, some don't.

## Code Examples

### Existing Input Component with Error Display
```typescript
// Source: packages/ui/src/components/Input.tsx (already exists)
<Input
  label="Member Name"
  value={memberName}
  error={fieldErrors.memberName}
  onChange={e => setMemberName(e.target.value)}
/>
// Renders: label above, input with red border if error, red error text below
```

### Existing Button Component Variants
```typescript
// Source: packages/ui/src/components/Button.tsx (already exists)
<Button variant="primary" loading={submitting}>Submit Sale</Button>
<Button variant="danger" size="sm" icon={<Trash2 size={14} />}>Delete</Button>
<Button variant="secondary" onClick={onCancel}>Cancel</Button>
<Button variant="ghost" size="sm">Edit</Button>
```

### Existing Skeleton Loading
```typescript
// Source: packages/ui/src/components/Skeleton.tsx (already exists)
// Replace manager dashboard's raw pulsing divs:
import { SkeletonCard, SkeletonTable } from "@ops/ui";

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[1, 2, 3].map(i => <SkeletonCard key={i} height={140} />)}
    </div>
  );
}
```

### Form Validation Pattern (to implement)
```typescript
// Simple validation hook pattern for manager dashboard sales form
function validateSaleForm(form: {
  agentId: string; productId: string; saleDate: string;
  status: string; premium: number; memberName: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.agentId) errors.agentId = "Select an agent";
  if (!form.productId) errors.productId = "Select a product";
  if (!form.saleDate) errors.saleDate = "Enter a sale date";
  if (!form.status) errors.status = "Select a status";
  if (!form.memberName.trim()) errors.memberName = "Enter member name";
  if (form.premium < 0) errors.premium = "Premium cannot be negative";
  return errors;
}
```

### Hover Class Application Pattern
```typescript
// Table rows should use row-hover class
<tr className="row-hover" style={{ cursor: "pointer" }}>
  <td style={baseTdStyle}>...</td>
</tr>

// Buttons already get btn-hover from Button component
// Input fields already get input-focus from Input component
```

## Current State Audit

### Dashboard-by-Dashboard Gap Analysis

| Dashboard | Local Styles | Uses @ops/ui Components | Skeletons | EmptyState | Validation |
|-----------|-------------|------------------------|-----------|------------|------------|
| manager | INP, CARD, TH, TD, SUBMIT_BTN, ICON_BTN, DANGER_BTN, SUCCESS_BTN, CANCEL_BTN + 10 more | PageShell, Badge, AnimatedNumber, EmptyState, ProgressRing | Raw pulsing divs | Partial | None (uses alert()) |
| payroll | CARD, CARD_SM, INP, BTN_PRIMARY, BTN_SUCCESS, BTN_DANGER, BTN_GHOST, BTN_WARNING, BTN_ICON, TH, TD + variants | PageShell, Badge, AnimatedNumber, SkeletonCard | SkeletonCard | None | None |
| owner | CARD, TH, TD, INP | PageShell, StatCard, Badge, AnimatedNumber, EmptyState, SkeletonCard, SkeletonTable, ToastProvider, Button | SkeletonCard + SkeletonTable | Yes | Partial (uses Button loading) |
| auth-portal | CARD, FORM_CARD, INPUT_WRAP, INPUT_ICON, INPUT, INPUT_PASSWORD + 10 more | Token imports only (no components) | None | None | Basic (setError string) |
| sales-board | No local style constants | PageShell, Badge, AnimatedNumber, EmptyState, ProgressRing + token imports | SkeletonCard | Yes | N/A (read-only) |

### Key Observations
1. **Owner dashboard is closest to target state** -- already uses Button, StatCard, EmptyState, Skeleton components
2. **Auth-portal has the most work** -- uses only token imports, no shared components, many local style constants
3. **Manager dashboard has the most forms** -- sales entry, config management, edit forms all need validation
4. **Payroll dashboard has the most button variants** -- 6 local button styles that should become Button component variants
5. **Sales board is already well-polished** -- read-only, uses shared components, has EmptyState. Minimal work needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local CARD/INP/BTN constants | @ops/ui Card/Input/Button components | Components already exist | Need migration, not creation |
| alert() for errors | Toast or inline msg pattern | ToastProvider already exists | Replace alert() calls |
| Raw pulsing div loading | SkeletonCard/SkeletonTable | Skeleton components exist | Replace in manager dashboard |

**Deprecated/outdated:**
- Local style constants (CARD, INP, BTN, TH, TD) in dashboard pages -- should reference @ops/ui tokens or use @ops/ui components

## Open Questions

1. **Shared Table component vs. exported style constants?**
   - What we know: All dashboards define their own TH/TD styles. They are nearly identical. A Table component could enforce row-hover and consistent column alignment.
   - What's unclear: Tables in this codebase have varying column structures and interactive elements (editable cells, action buttons). A component may be too rigid.
   - Recommendation: Export `baseThStyle` and `baseTdStyle` from tokens.ts (simple and flexible). A full Table component is optional -- Claude's discretion per CONTEXT.md.

2. **Auth-portal login form validation scope**
   - What we know: Auth-portal has a login form with email + password. Currently shows a single error string.
   - What's unclear: Should validation be per-field (empty email, empty password as separate messages) or keep single error string for the simple 2-field form?
   - Recommendation: Per-field validation for consistency with other dashboards. Email: "Enter your email", Password: "Enter your password".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root + ops-api service tests) |
| Config file | `jest.config.ts` (root), `apps/ops-api/jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern=<file>` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UIUX-01 | Forms show validation errors on submit | manual-only | Visual verification in browser | N/A |
| UIUX-02 | Form layouts consistent across dashboards | manual-only | Visual verification in browser | N/A |
| UIUX-03 | UI follows design guidance | manual-only | Visual verification in browser | N/A |

**Justification for manual-only:** All three requirements are UI rendering concerns. The project uses no component testing framework (no React Testing Library, no Storybook, no Cypress). Adding one would be out of scope for a polish phase. Validation logic functions (pure) could theoretically be unit tested, but the requirements are about visual output.

### Sampling Rate
- **Per task commit:** Visual check in browser -- load each dashboard, verify forms, submit with empty fields, check error display
- **Per wave merge:** Full walkthrough of all 4 dashboards confirming: validation errors appear, styles consistent, skeletons render, empty states display
- **Phase gate:** All dashboards visually verified before `/gsd:verify-work`

### Wave 0 Gaps
None -- no automated test infrastructure needed for visual UI polish. Validation logic is simple enough to verify by inspection.

## Sources

### Primary (HIGH confidence)
- `packages/ui/src/tokens.ts` -- design token system, base styles (read directly)
- `packages/ui/src/components/*.tsx` -- all 13 components inspected (read directly)
- `packages/ui/src/theme.css` -- CSS custom properties for dark/light themes (read directly)
- `packages/ui/src/responsive.css` -- hover/focus/interaction CSS classes (read directly)
- `packages/ui/src/animations.css` -- keyframe animations and utility classes (read directly)
- `apps/*/app/page.tsx` -- all 5 dashboard pages inspected for current state (read directly)
- `.claude/skills/ui-ux-pro-max/SKILL.md` -- design audit skill reference (read directly)
- `.planning/codebase/CONVENTIONS.md` -- project coding conventions (read directly)

### Secondary (MEDIUM confidence)
- None needed -- all findings based on direct codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components exist in codebase, directly inspected
- Architecture: HIGH -- patterns derived from existing code and user decisions
- Pitfalls: HIGH -- identified from actual code gaps found during audit

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- internal project, no external dependency changes)
