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

// --- Commission Engine Tests ---

describe('calculateCommission', () => {

  // =============================================
  // COMM-01: Core + Compass VAB = full rate
  // =============================================
  describe('COMM-01: Core with Compass VAB earns full commission rate', () => {
    it('core (premium=100, commissionAbove=50%, threshold=50) + Compass VAB = 50.00', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      expect(calculateCommission(sale)).toBe(50.00);
    });
  });

  // =============================================
  // COMM-02: Core without Compass VAB = half rate
  // =============================================
  describe('COMM-02: Core without Compass VAB earns half commission rate', () => {
    it('core (premium=100, commissionAbove=50%, threshold=50) alone = 25.00 (halved)', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [],
      });
      // 100 * 50% = 50, halved = 25
      expect(calculateCommission(sale)).toBe(25.00);
    });

    it('commissionApproved=true bypasses halving, commission = 50.00', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        commissionApproved: true,
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [],
      });
      // 100 * 50% = 50, no halving because commissionApproved=true
      expect(calculateCommission(sale)).toBe(50.00);
    });
  });

  // =============================================
  // COMM-04: Add-on premiums sum with core for threshold
  // =============================================
  describe('COMM-04: Add-on premiums sum with core for bundle threshold check', () => {
    it('core (100) + addon (60) + Compass VAB, threshold=150 -> above rate on 160', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(150),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Regular Addon', standaloneCommission: new Decimal(30) }, 60),
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      // bundlePremium = 100 + 60 = 160 (VAB excluded), rate = 50% (160 >= 150)
      // commission = 160 * 0.50 = 80.00
      expect(calculateCommission(sale)).toBe(80.00);
    });

    it('core (100) + addon (60) + Compass VAB, threshold=200 -> below rate on 160', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(200),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Regular Addon', standaloneCommission: new Decimal(30) }, 60),
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      // bundlePremium = 100 + 60 = 160 (VAB excluded), rate = 25% (160 < 200)
      // commission = 160 * 0.25 = 40.00
      expect(calculateCommission(sale)).toBe(40.00);
    });
  });

  // =============================================
  // COMM-05: Standalone addon uses standaloneCommission
  // =============================================
  describe('COMM-05: Standalone add-on products use standalone commission rate', () => {
    it('standalone addon (premium=80, standaloneCommission=30%) = 24.00', () => {
      const sale = makeSale({
        premium: new Decimal(80),
        product: makeProduct({
          type: 'ADDON',
          name: 'Standalone Addon',
          standaloneCommission: new Decimal(30),
          premiumThreshold: null,
          commissionAbove: null,
          commissionBelow: null,
        }),
        addons: [],
      });
      // 80 * 30% = 24.00
      expect(calculateCommission(sale)).toBe(24.00);
    });

    it('standalone addon with null standaloneCommission = 0.00', () => {
      const sale = makeSale({
        premium: new Decimal(80),
        product: makeProduct({
          type: 'ADDON',
          name: 'Standalone Addon',
          standaloneCommission: null,
          premiumThreshold: null,
          commissionAbove: null,
          commissionBelow: null,
        }),
        addons: [],
      });
      expect(calculateCommission(sale)).toBe(0.00);
    });
  });

  // =============================================
  // COMM-06: Standalone AD&D uses standaloneCommission
  // =============================================
  describe('COMM-06: Standalone AD&D uses standalone commission rate', () => {
    it('standalone AD&D (premium=50, standaloneCommission=35%) = 17.50', () => {
      const sale = makeSale({
        premium: new Decimal(50),
        product: makeProduct({
          type: 'AD_D',
          name: 'AD&D Product',
          standaloneCommission: new Decimal(35),
          premiumThreshold: null,
          commissionAbove: null,
          commissionBelow: null,
        }),
        addons: [],
      });
      // 50 * 35% = 17.50
      expect(calculateCommission(sale)).toBe(17.50);
    });

    it('standalone AD&D with null standaloneCommission = 0.00', () => {
      const sale = makeSale({
        premium: new Decimal(50),
        product: makeProduct({
          type: 'AD_D',
          name: 'AD&D Product',
          standaloneCommission: null,
          premiumThreshold: null,
          commissionAbove: null,
          commissionBelow: null,
        }),
        addons: [],
      });
      expect(calculateCommission(sale)).toBe(0.00);
    });
  });

  // =============================================
  // COMM-07: Bundled AD&D uses bundledCommission
  // =============================================
  describe('COMM-07: Bundled AD&D uses bundled commission rate', () => {
    it('core + AD&D (premium=50, bundledCommission=70%) + Compass VAB', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'AD_D', name: 'AD&D Product', bundledCommission: new Decimal(70), standaloneCommission: new Decimal(35) }, 50),
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      // core bundle: 100 * 50% = 50
      // AD&D: 50 * 70% = 35
      // total = 85 (no halving, qualifier present)
      expect(calculateCommission(sale)).toBe(85.00);
    });

    it('core + AD&D without Compass VAB -> entire sale halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'AD_D', name: 'AD&D Product', bundledCommission: new Decimal(70), standaloneCommission: new Decimal(35) }, 50),
        ],
      });
      // core bundle: 100 * 50% = 50
      // AD&D: 50 * 70% = 35
      // total = 85, halved (no qualifier) = 42.50
      expect(calculateCommission(sale)).toBe(42.50);
    });
  });

  // =============================================
  // COMM-11: Rounding to 2 decimal places
  // =============================================
  describe('COMM-11: Commission rounded to 2 decimal places', () => {
    it('core (premium=33.33, commissionAbove=50%, threshold=0) + Compass VAB = 16.67', () => {
      const sale = makeSale({
        premium: new Decimal(33.33),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(0),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      // 33.33 * 0.50 = 16.665 -> rounded to 16.67
      expect(calculateCommission(sale)).toBe(16.67);
    });
  });

  // =============================================
  // Addon premium sourcing: each addon uses its own premium
  // =============================================
  describe('Addon premium sourcing', () => {
    it('each addon uses its own SaleAddon.premium, not sale.premium', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Addon A', standaloneCommission: new Decimal(30) }, 20),
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      // bundlePremium = 100 (core) + 20 (addon A) = 120 (VAB excluded)
      // rate = 50% (120 >= 50 threshold)
      // commission = 120 * 0.50 = 60.00 (no halving, qualifier present)
      expect(calculateCommission(sale)).toBe(60.00);
    });
  });

  // =============================================
  // Compass VAB premium exclusion from bundle total
  // =============================================
  describe('Compass VAB premium exclusion', () => {
    it('VAB addon premium=15 does NOT inflate bundle total', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 15),
        ],
      });
      // bundlePremium = 100 only (VAB 15 excluded)
      // commission = 100 * 0.50 = 50.00
      expect(calculateCommission(sale)).toBe(50.00);
    });
  });

  // =============================================
  // FL exemption removed
  // =============================================
  describe('FL exemption removed', () => {
    it('memberState=FL with no Compass VAB still gets halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'FL',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [],
      });
      // 100 * 50% = 50, halved = 25 (FL is NOT exempt)
      expect(calculateCommission(sale)).toBe(25.00);
    });
  });

  // =============================================
  // Null commission rate handling
  // =============================================
  describe('Null commission rates', () => {
    it('null commissionAbove produces $0 for core above threshold', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: null,
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      // 100 >= 50 threshold, commissionAbove is null -> rate=0 -> commission=0
      expect(calculateCommission(sale)).toBe(0.00);
    });

    it('null bundledCommission on AD&D produces $0 for bundled AD&D', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'AD_D', name: 'AD&D', bundledCommission: null, standaloneCommission: new Decimal(35) }, 50),
          makeAddon({ type: 'ADDON', name: 'Compass VAB', isBundleQualifier: true }, 10),
        ],
      });
      // core: 100 * 50% = 50, AD&D: null bundledCommission -> 0
      // total = 50
      expect(calculateCommission(sale)).toBe(50.00);
    });
  });
});
