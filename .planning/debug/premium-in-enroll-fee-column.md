---
status: diagnosed
trigger: "premium values are being totaled in the enrollment fee column in the payroll dashboard"
created: 2026-03-14T00:00:00Z
updated: 2026-03-14T00:00:00Z
---

## Current Focus

hypothesis: EditableSaleRow edit mode maps premium input to the Enroll Fee column position
test: Traced td elements vs th headers in payroll table
expecting: Column 4 td should render enrollmentFee, but renders saleData.premium in edit mode
next_action: Return diagnosis

## Symptoms

expected: Enrollment fee column shows enrollment fee values
actual: Premium values appear in the enrollment fee column
errors: None (display logic issue, not a crash)
reproduction: Open payroll dashboard, click edit on any sale row — enrollment fee column shows premium value
started: After Phase 02 rewrite

## Eliminated

(none — first hypothesis confirmed)

## Evidence

- timestamp: 2026-03-14
  checked: Table headers in payroll dashboard (page.tsx line 1510-1519)
  found: Headers are Agent, Member, Product, Enroll Fee, Commission, Bonus, Fronted, Hold, Net, Actions
  implication: 4th data column should map to Enroll Fee

- timestamp: 2026-03-14
  checked: EditableSaleRow td elements (page.tsx lines 221-284)
  found: |
    td #1 (line 221) = Agent name
    td #2 (line 223) = Member name
    td #3 (line 239) = In view mode: product badges with premium subscript. In EDIT mode: carrier input
    td #4 (line 271) = In view mode: fee (enrollmentFee). In EDIT mode: saleData.premium input
  implication: Edit mode column 4 renders premium where enrollment fee header is

- timestamp: 2026-03-14
  checked: saleData state initialization (line 195-200)
  found: saleData has premium field but NO enrollmentFee field — enrollmentFee is not editable in the row at all
  implication: Users cannot edit enrollment fee inline; premium occupies enrollment fee column in edit mode

- timestamp: 2026-03-14
  checked: Sale update handler (page.tsx line 354-358)
  found: Sends premium from saleData.premium but never sends enrollmentFee updates
  implication: If user changes value in the "Enroll Fee" column during edit, they are actually changing the premium

## Resolution

root_cause: |
  In EditableSaleRow (payroll-dashboard/app/page.tsx), the edit mode column layout is misaligned:
  - Column 3 (Product header) renders a carrier input in edit mode instead of product info
  - Column 4 (Enroll Fee header) renders saleData.premium input instead of enrollment fee
  - The saleData state object does not include enrollmentFee, so it is not editable at all
  - This means premium values visually appear in the Enroll Fee column when editing, and users can accidentally modify premium thinking they are editing enrollment fee

fix: (not applied — diagnosis only)
verification: (not applicable)
files_changed: []
