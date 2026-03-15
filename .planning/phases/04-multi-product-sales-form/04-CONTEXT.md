# Phase 4: Multi-Product Sales Form - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Manager dashboard sales form supports multiple products per sale, payment type selection, and enrollment fee entry. The addon picker and payment type selector already exist from Phases 2-3. This phase focuses on UX fixes to the form: type-filtered product lists, field reordering, blank default selections, and making carrier optional. No new commission logic — that's Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Form layout
- Keep the flat 2-column grid layout (left: form fields, right: receipt parser + addon picker)
- No collapsible sections or tabs — all fields visible at once, scroll if needed
- Core Product dropdown stays in left column; addon checkboxes stay in right column

### Field order (reorder for natural flow)
- Row 1: Agent | Member Name
- Row 2: Member ID | Member State
- Row 3: Sale Date | Effective Date
- Row 4: Product | Lead Source
- Row 5: Carrier | Status
- Row 6: Premium | Enrollment Fee
- Row 7: Notes | (empty or spans full width)
- Row 8: Payment Type (full width)
- Row 9: Submit button (full width)

### Default selections
- Product dropdown: Start blank with "Select product..." placeholder (currently auto-selects first product)
- Lead Source dropdown: Start blank with "Select lead source..." placeholder (currently auto-selects first)
- Agent dropdown: Already blank — no change needed

### Carrier field
- Make carrier NOT required (remove `required` attribute)
- Keep as a free-text input, just optional now

### Addon picker filtering and ordering
- Only show ADDON and AD_D type products in the addon checkboxes (no CORE products)
- Sort order: ADDON type first (alphabetical), then AD_D type at bottom (alphabetical)
- Core products only appear in the main Product dropdown

### Payment type
- Keep CC and ACH only — do NOT add Check/Other payment types
- Check/Other deferred again — not currently used by the business

### Enrollment fee threshold display
- No threshold display next to enrollment fee input — managers already know the products
- Phase 5 will add commission preview which covers this

### Product info display
- No product type badges or commission rate hints on the form
- Keep the form clean — Phase 5 handles commission visibility

### Claude's Discretion
- Whether to add form validation for blank product/lead source (prevent submit without selection vs allow)
- Stagger animation class assignments for reordered fields
- Any minor styling adjustments needed for the new field order

</decisions>

<specifics>
## Specific Ideas

- "Product dropdown auto selects a product, change to blank selection at start just like the agent dropdown is set up. Same for lead source."
- "Make carrier a non-locked submission" (remove required)
- "Move effective date selection right below sale date"
- Addon picker already works — just needs type filtering and sort order fix

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `blankForm()` in page.tsx (line 632): Returns initial form state — currently sets `productId: ""` but `useEffect` overrides to `p[0]?.id`. Fix: remove the override
- `addonPremiums` state (line 640): Already tracks per-addon premium amounts as `Record<string, string>`
- `submitSale()` (line 735): Already sends `addonProductIds`, `addonPremiums`, `paymentType`, `enrollmentFee` to API
- Receipt parser `handleParse()` (line 713): Auto-fills products, addons, enrollment fee, payment type from pasted receipt

### Established Patterns
- Form uses 2-column CSS grid: `gridTemplateColumns: "1fr 1fr"` with `gap: 14`
- Full-width fields use `gridColumn: "1/-1"`
- Fields use `animate-fade-in-up stagger-N` classes for entrance animations
- Dropdowns include `<option value="" disabled>Select...</option>` for blank state (already done for Agent)
- Inline `React.CSSProperties` constants (INP, LBL, SUBMIT_BTN)

### Integration Points
- Product dropdown `useEffect` sets initial productId to `p[0]?.id` (line 675) — must change to empty string
- Lead source init on same line: `leadSourceId: ls[0]?.id` — must change to empty string
- Addon picker section filters products for checkbox display — needs type filter added
- API POST /api/sales accepts all fields already — no backend changes needed for form reorder

</code_context>

<deferred>
## Deferred Ideas

- Check and Other payment types — deferred again, not currently used by business
- Enrollment fee threshold display — Phase 5 commission preview will cover this
- Product type badges on form — Phase 5 or Phase 9

</deferred>

---

*Phase: 04-multi-product-sales-form*
*Context gathered: 2026-03-15*
