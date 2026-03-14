import { calculateCommission } from '../payroll';
import type { Product, Sale, SaleAddon } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// --- Test Helpers ---

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
  isBundleQualifier: false,
  enrollFeeThreshold: null,
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

type SaleWithProduct = Sale & { product: Product; addons: (SaleAddon & { product: Product })[] };

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
  status: 'SUBMITTED',
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

// --- Placeholder Tests (will be filled out in Plan 02) ---

describe('calculateCommission', () => {
  describe('test infrastructure', () => {
    it('can create mock sale objects', () => {
      const sale = makeSale();
      expect(sale.product.type).toBe('CORE');
      expect(sale.addons).toHaveLength(0);
    });

    it('can create mock addons', () => {
      const addon = makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10);
      expect(addon.product.isBundleQualifier).toBe(true);
      expect(Number(addon.premium)).toBe(10);
    });
  });
});
