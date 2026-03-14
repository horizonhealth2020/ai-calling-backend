---
status: diagnosed
trigger: "manager dashboard sales entry form only allows adding 1 product at a time, preventing bundle testing"
created: 2026-03-14T00:00:00Z
updated: 2026-03-14T00:00:00Z
---

## Current Focus

hypothesis: UI has no manual addon selection controls; addons only populate via receipt parsing
test: n/a - confirmed by code reading
expecting: n/a
next_action: return diagnosis

## Symptoms

expected: Manager dashboard sales entry form supports adding multiple products/addons to a single sale for bundle testing
actual: Form only has a single "Product" dropdown (core product); no way to manually add addon products
errors: n/a (functional gap, not a runtime error)
reproduction: Open manager dashboard > Sales Entry tab > observe only one Product dropdown
started: Always - addon UI was never built for manual entry

## Eliminated

(none needed - root cause confirmed on first pass)

## Evidence

- timestamp: 2026-03-14
  checked: prisma/schema.prisma - SaleAddon model
  found: SaleAddon model exists (lines 260-272) with saleId + productId + premium. Sale has `addons SaleAddon[]` relation.
  implication: Schema fully supports addons per sale

- timestamp: 2026-03-14
  checked: ops-api POST /sales route (lines 279-319)
  found: API accepts `addonProductIds: z.array(z.string()).default([])` in request body. Creates SaleAddon records via nested `addons.create` on sale creation.
  implication: API fully supports addon submission

- timestamp: 2026-03-14
  checked: manager-dashboard form state (line 636)
  found: Form state includes `addonProductIds: [] as string[]` - the field exists in state
  implication: Form state is wired for addons but nothing populates it manually

- timestamp: 2026-03-14
  checked: manager-dashboard form UI (lines 984-988)
  found: Only ONE Product dropdown exists (`form.productId`). No UI for selecting addon products. No multi-select, no "add addon" button, no addon checkboxes.
  implication: This is the root cause - no manual addon selection UI

- timestamp: 2026-03-14
  checked: Receipt parser addon flow (lines 716-722)
  found: Receipt parser DOES extract addons from pasted text and populates `form.addonProductIds`. The parsed receipt info card (lines 1037-1053) shows matched addons with dropdowns to correct matches.
  implication: Addon flow only works via receipt paste, not manual entry

- timestamp: 2026-03-14
  checked: submitSale function (lines 733-762)
  found: `body: JSON.stringify({ ...form })` sends entire form including `addonProductIds` to API
  implication: Submission pipeline is complete - just needs the UI to populate the array

## Resolution

root_cause: The manager dashboard sales entry form has no manual addon selection UI. The form state (`addonProductIds: []`) and API (`addonProductIds` param) both support addons, but the only way to populate addon IDs is through the receipt paste parser. There are no checkboxes, multi-select, or "add addon" controls for manual addon selection.
fix: (not applied - diagnosis only)
verification: (n/a)
files_changed: []
