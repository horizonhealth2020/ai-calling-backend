import { calculateCommission } from '../payroll';
import type { Product, Sale, SaleAddon } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// --- Test Helpers (mirrored from commission.test.ts) ---

type SaleWithProduct = Sale & { product: Product; addons: (SaleAddon & { product: Product })[] };

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  name: 'Test Product',
  active: true,
  type: 'CORE',
  premiumThreshold: new Decimal(50),
  commissionBelow: new Decimal(25),
  commissionAbove: new Decimal(50),
  bundledCommission: null,
  standaloneCommission: null,
  enrollFeeThreshold: null,
  flatCommission: null,
  requiredBundleAddonId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeAddon = (productOverrides: Partial<Product> = {}, premium: number = 0): SaleAddon & { product: Product } => ({
  id: 'addon-' + Math.random().toString(36).slice(2, 8),
  saleId: 'sale-1',
  productId: productOverrides.id ?? 'addon-prod-1',
  premium: premium > 0 ? new Decimal(premium) : null,
  createdAt: new Date(),
  product: makeProduct({
    id: 'addon-prod-1',
    name: 'Test Addon',
    type: 'ADDON',
    premiumThreshold: null,
    commissionBelow: null,
    commissionAbove: null,
    ...productOverrides,
  }),
});

const makeSale = (overrides: Partial<SaleWithProduct> = {}): SaleWithProduct => ({
  id: 'sale-1',
  saleDate: new Date('2026-03-10T12:00:00Z'),
  agentId: 'agent-1',
  memberName: 'Test Member',
  memberId: null,
  carrier: 'Test Carrier',
  productId: 'prod-1',
  premium: new Decimal(100),
  effectiveDate: new Date('2026-03-15T12:00:00Z'),
  leadSourceId: 'lead-1',
  status: 'RAN',
  notes: null,
  enteredByUserId: 'user-1',
  payrollStatus: 'PENDING',
  clawbackStatus: 'OPEN',
  createdAt: new Date(),
  updatedAt: new Date(),
  enrollmentFee: null,
  commissionApproved: false,
  paymentType: null,
  recordingUrl: null,
  convosoLeadId: null,
  callDuration: null,
  callDateTime: null,
  memberState: null,
  product: makeProduct(),
  addons: [],
  ...overrides,
} as SaleWithProduct);

// Inline the gating logic for unit testing (mirrors payroll.ts line 204)
const gatedCommission = (sale: SaleWithProduct) =>
  sale.status === 'RAN' ? calculateCommission(sale).commission : 0;

// --- Status-based Commission Gating Tests ---

describe('Status-based commission gating', () => {
  // NOTE: handleCommissionZeroing and upsertPayrollEntryForSale require full Prisma
  // mocking (findMany, upsert, update) which the project does not have set up.
  // The following tests verify the gating PATTERN as a pure function, which mirrors
  // the actual gate at payroll.ts line 204: sale.status === 'RAN' ? calculateCommission(sale) : 0

  describe('gated commission calculation', () => {
    it('generates normal commission for RAN sales', () => {
      const sale = makeSale({ status: 'RAN' as any });
      expect(gatedCommission(sale)).toBeGreaterThan(0);
    });

    it('generates $0 for DECLINED sales', () => {
      const sale = makeSale({ status: 'DECLINED' as any });
      expect(gatedCommission(sale)).toBe(0);
    });

    it('generates $0 for DEAD sales', () => {
      const sale = makeSale({ status: 'DEAD' as any });
      expect(gatedCommission(sale)).toBe(0);
    });

    it('zeroes commission when status is not RAN regardless of product config', () => {
      // A sale that would earn high commission if RAN
      const sale = makeSale({
        status: 'DECLINED' as any,
        premium: new Decimal(200),
        product: makeProduct({ commissionAbove: new Decimal(100) }),
        addons: [makeAddon({ name: 'Compass VAB' })],
      });
      expect(calculateCommission(sale).commission).toBeGreaterThan(0); // proves calc would give commission
      expect(gatedCommission(sale)).toBe(0); // but gating blocks it
    });

    it('RAN sale with same config earns commission', () => {
      const sale = makeSale({
        status: 'RAN' as any,
        premium: new Decimal(200),
        product: makeProduct({ commissionAbove: new Decimal(100) }),
        addons: [makeAddon({ name: 'Compass VAB' })],
      });
      expect(gatedCommission(sale)).toBeGreaterThan(0);
    });

    it('DEAD sale creates $0 even with high premium and bundle', () => {
      const sale = makeSale({
        status: 'DEAD' as any,
        premium: new Decimal(500),
        product: makeProduct({ commissionAbove: new Decimal(200) }),
        addons: [makeAddon({ name: 'Compass VAB' })],
      });
      expect(gatedCommission(sale)).toBe(0);
    });
  });

  // Integration-test territory: The following behaviors require full Prisma mocking
  // (prisma.payrollEntry.findMany, update, upsert) to test meaningfully:
  // - handleCommissionZeroing zeroes OPEN entries and applies clawbacks for finalized periods
  // - upsertPayrollEntryForSale creates payroll entries with $0 for non-RAN sales
  // These should be covered by integration/E2E tests when DB test infrastructure is added.
});
