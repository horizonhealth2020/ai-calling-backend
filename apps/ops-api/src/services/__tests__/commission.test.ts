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
  enrollFeeThreshold: null,
  requiredBundleAddonId: null,
  fallbackBundleAddonId: null,
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

// --- Commission Engine Tests ---
// Addons with bundledCommission === null fold into bundlePremium and earn the core rate.
// Addons with bundledCommission set earn their own rate separately.
// Bundle halving is controlled by BundleRequirement config (state-aware), not a legacy flag.

describe('calculateCommission', () => {

  // =============================================
  // COMM-01: Core + Compass VAB = full rate
  // =============================================
  describe('COMM-01: Core with Compass VAB earns full commission rate', () => {
    it('core (premium=100, commissionAbove=50%, threshold=50) + Compass VAB(10) = 55.00', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 100 + 10 = 110, rate = 50% (110 >= 50), commission = 55.00
      expect(calculateCommission(sale).commission).toBe(55.00);
    });
  });

  // =============================================
  // COMM-02: Core without addon — no halving unless bundleCtx says to
  // =============================================
  describe('COMM-02: Core without addon — halving controlled by bundle requirement config', () => {
    it('core alone with no bundle requirement configured = full commission (no halving)', () => {
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
      // 100 * 50% = 50, no bundleCtx = no halving
      expect(calculateCommission(sale).commission).toBe(50.00);
    });

    it('core alone with bundleCtx indicating missing addon = halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'TX',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
        }),
        addons: [],
      });
      const bundleCtx = {
        requiredAddonAvailable: false,
        fallbackAddonAvailable: false,
        halvingReason: 'Half commission - Compass VAB not bundled (TX)',
      };
      // 100 * 50% = 50, halved = 25
      expect(calculateCommission(sale, bundleCtx).commission).toBe(25.00);
    });

    it('commissionApproved=true bypasses halving even with bundleCtx', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        commissionApproved: true,
        memberState: 'TX',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
        }),
        addons: [],
      });
      const bundleCtx = {
        requiredAddonAvailable: false,
        fallbackAddonAvailable: false,
        halvingReason: 'Half commission - Compass VAB not bundled (TX)',
      };
      // 100 * 50% = 50, no halving because commissionApproved=true
      expect(calculateCommission(sale, bundleCtx).commission).toBe(50.00);
    });
  });

  // =============================================
  // COMM-04: Add-on premiums sum with core for threshold
  // =============================================
  describe('COMM-04: Add-on premiums sum with core for bundle threshold check', () => {
    it('core (100) + addon (60) + Compass VAB(10), threshold=150 -> above rate on 170', () => {
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
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 100 + 60 + 10 = 170 (VAB included), rate = 50% (170 >= 150)
      // commission = 170 * 0.50 = 85.00
      expect(calculateCommission(sale).commission).toBe(85.00);
    });

    it('core (100) + addon (60) + Compass VAB(10), threshold=200 -> below rate on 170', () => {
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
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 100 + 60 + 10 = 170 (VAB included), rate = 25% (170 < 200)
      // commission = 170 * 0.25 = 42.50
      expect(calculateCommission(sale).commission).toBe(42.50);
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
      expect(calculateCommission(sale).commission).toBe(24.00);
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
      expect(calculateCommission(sale).commission).toBe(0.00);
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
      expect(calculateCommission(sale).commission).toBe(17.50);
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
      expect(calculateCommission(sale).commission).toBe(0.00);
    });
  });

  // =============================================
  // COMM-07: Bundled AD&D uses bundledCommission
  // =============================================
  describe('COMM-07: Bundled AD&D uses bundled commission rate', () => {
    it('core + AD&D (premium=50, bundledCommission=70%) + Compass VAB(10)', () => {
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
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 100 + 10 = 110, rate = 50% -> 55
      // AD&D: 50 * 70% = 35
      // total = 90 (no halving, qualifier present)
      expect(calculateCommission(sale).commission).toBe(90.00);
    });

    it('core + AD&D without bundle requirement configured -> no halving', () => {
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
      // total = 85, no bundle requirement configured = no halving
      expect(calculateCommission(sale).commission).toBe(85.00);
    });

    it('core + AD&D with bundleCtx missing addon -> entire sale halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'TX',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
        }),
        addons: [
          makeAddon({ type: 'AD_D', name: 'AD&D Product', bundledCommission: new Decimal(70), standaloneCommission: new Decimal(35) }, 50),
        ],
      });
      const bundleCtx = {
        requiredAddonAvailable: false,
        fallbackAddonAvailable: false,
        halvingReason: 'Half commission - Compass VAB not bundled (TX)',
      };
      // core bundle: 100 * 50% = 50, AD&D: 50 * 70% = 35, total = 85, halved = 42.50
      expect(calculateCommission(sale, bundleCtx).commission).toBe(42.50);
    });
  });

  // =============================================
  // COMM-11: Rounding to 2 decimal places
  // =============================================
  describe('COMM-11: Commission rounded to 2 decimal places', () => {
    it('core (premium=33.33, commissionAbove=50%, threshold=0) + Compass VAB(10) = 21.67', () => {
      const sale = makeSale({
        premium: new Decimal(33.33),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(0),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 33.33 + 10 = 43.33, rate = 50% -> 21.665 -> rounded to 21.67
      expect(calculateCommission(sale).commission).toBe(21.67);
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
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 100 (core) + 20 (addon A) + 10 (VAB) = 130
      // rate = 50% (130 >= 50 threshold)
      // commission = 130 * 0.50 = 65.00 (no halving, qualifier present)
      expect(calculateCommission(sale).commission).toBe(65.00);
    });
  });

  // =============================================
  // Compass VAB premium inclusion in bundle total
  // =============================================
  describe('Compass VAB premium in bundle', () => {
    it('VAB addon premium=15 folds into bundle total (bundledCommission=null)', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 15),
        ],
      });
      // bundlePremium = 100 + 15 = 115 (VAB folds in because bundledCommission=null)
      // commission = 115 * 0.50 = 57.50
      expect(calculateCommission(sale).commission).toBe(57.50);
    });
  });

  // =============================================
  // No special state exemptions — halving controlled by bundle requirement config
  // =============================================
  describe('No state exemptions', () => {
    it('memberState=FL with bundle requirement and missing addon gets halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'FL',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
        }),
        addons: [],
      });
      const bundleCtx = {
        requiredAddonAvailable: false,
        fallbackAddonAvailable: false,
        halvingReason: 'Half commission - Compass VAB not bundled (FL)',
      };
      // 100 * 50% = 50, halved = 25
      expect(calculateCommission(sale, bundleCtx).commission).toBe(25.00);
    });

    it('memberState=FL with no bundle requirement configured = no halving', () => {
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
      // No bundleCtx = no halving
      expect(calculateCommission(sale).commission).toBe(50.00);
    });
  });

  // =============================================
  // COMM-08: Enrollment fee below threshold halves commission
  // =============================================
  describe('COMM-08: Enrollment fee below threshold halves commission', () => {
    it('COMM-08a: core sale + Compass VAB(10) + enrollmentFee=80 (< $99) -> commission halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: new Decimal(80),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, enrollmentFee 80 < 99 threshold -> halved = 27.50
      expect(calculateCommission(sale).commission).toBe(27.50);
    });

    it('COMM-08b: core sale + Compass VAB(10) + enrollmentFee=99 (== $99) -> NOT halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: new Decimal(99),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, enrollmentFee 99 >= 99 threshold -> NOT halved = 55
      expect(calculateCommission(sale).commission).toBe(55.00);
    });

    it('COMM-08c: core sale + Compass VAB(10) + enrollmentFee=50 + commissionApproved=true -> NOT halved', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: new Decimal(50),
        commissionApproved: true,
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, enrollmentFee 50 < 99 but commissionApproved -> NOT halved = 55
      expect(calculateCommission(sale).commission).toBe(55.00);
    });

    it('COMM-08d: standalone addon + enrollmentFee=40 (< $50 default) -> commission halved', () => {
      const sale = makeSale({
        premium: new Decimal(80),
        enrollmentFee: new Decimal(40),
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
      // 80 * 30% = 24, enrollmentFee 40 < 50 default threshold -> halved = 12
      expect(calculateCommission(sale).commission).toBe(12.00);
    });

    it('COMM-08e: standalone addon + enrollmentFee=40 + custom enrollFeeThreshold=30 -> NOT halved (40 >= 30)', () => {
      const sale = makeSale({
        premium: new Decimal(80),
        enrollmentFee: new Decimal(40),
        product: makeProduct({
          type: 'ADDON',
          name: 'Standalone Addon',
          standaloneCommission: new Decimal(30),
          enrollFeeThreshold: new Decimal(30),
          premiumThreshold: null,
          commissionAbove: null,
          commissionBelow: null,
        }),
        addons: [],
      });
      // 80 * 30% = 24, enrollmentFee 40 >= 30 custom threshold -> NOT halved = 24
      expect(calculateCommission(sale).commission).toBe(24.00);
    });

    it('COMM-08f: standalone addon + enrollmentFee=20 + custom enrollFeeThreshold=30 -> halved (20 < 30)', () => {
      const sale = makeSale({
        premium: new Decimal(80),
        enrollmentFee: new Decimal(20),
        product: makeProduct({
          type: 'ADDON',
          name: 'Standalone Addon',
          standaloneCommission: new Decimal(30),
          enrollFeeThreshold: new Decimal(30),
          premiumThreshold: null,
          commissionAbove: null,
          commissionBelow: null,
        }),
        addons: [],
      });
      // 80 * 30% = 24, enrollmentFee 20 < 30 custom threshold -> halved = 12
      expect(calculateCommission(sale).commission).toBe(12.00);
    });

    it('COMM-08g: core sale + Compass VAB(10) + enrollmentFee=null -> no effect, commission unchanged', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: null,
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, null enrollmentFee -> no fee effect = 55
      expect(calculateCommission(sale).commission).toBe(55.00);
    });
  });

  // =============================================
  // COMM-09: $125 enrollment fee adds $10 bonus
  // =============================================
  describe('COMM-09: $125 enrollment fee adds $10 bonus', () => {
    // Note: bonus triggers for fee >= $125 (not just exactly $125) per user decision

    it('COMM-09a: core sale + Compass VAB(10) + enrollmentFee=125 -> commission=55 + bonus=10 = 65.00', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: new Decimal(125),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, fee 125 >= 125 -> +$10 bonus, fee >= 99 -> no halving
      // total = 55 + 10 = 65
      expect(calculateCommission(sale).commission).toBe(65.00);
    });

    it('COMM-09b: core sale + Compass VAB(10) + enrollmentFee=150 -> commission=55 + bonus=10 = 65.00', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: new Decimal(150),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, fee 150 >= 125 -> +$10 bonus, fee >= 99 -> no halving
      // total = 55 + 10 = 65
      expect(calculateCommission(sale).commission).toBe(65.00);
    });

    it('COMM-09c: core sale + Compass VAB(10) + enrollmentFee=124 -> NO bonus, commission=55.00', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: new Decimal(124),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, fee 124 < 125 -> no bonus, fee >= 99 -> no halving
      // total = 55
      expect(calculateCommission(sale).commission).toBe(55.00);
    });

    it('COMM-09d: core sale + Compass VAB(10) + enrollmentFee=80 -> halving but no bonus, commission=27.50', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        enrollmentFee: new Decimal(80),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110, rate = 50% -> 55, fee 80 < 99 -> halved = 27.50, fee < 125 -> no bonus
      // total = 27.50
      expect(calculateCommission(sale).commission).toBe(27.50);
    });

    it('COMM-09e: standalone addon + enrollmentFee=125 -> commission=24 + bonus=10 = 34.00', () => {
      const sale = makeSale({
        premium: new Decimal(80),
        enrollmentFee: new Decimal(125),
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
      // 80 * 30% = 24, fee 125 >= 125 -> +$10 bonus, fee >= 50 -> no halving
      // total = 24 + 10 = 34
      expect(calculateCommission(sale).commission).toBe(34.00);
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
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 110 >= 50 threshold, commissionAbove is null -> rate=0 -> commission=0
      expect(calculateCommission(sale).commission).toBe(0.00);
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
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      // bundlePremium = 100 + 10 = 110, rate = 50% -> 55, AD&D: null bundledCommission -> 0
      // total = 55
      expect(calculateCommission(sale).commission).toBe(55.00);
    });
  });

  // =============================================
  // Return type verification
  // =============================================
  describe('calculateCommission return type', () => {
    it('returns object with commission and halvingReason', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          premiumThreshold: new Decimal(50),
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB',  }, 10),
        ],
      });
      const result = calculateCommission(sale);
      expect(result).toHaveProperty('commission');
      expect(result).toHaveProperty('halvingReason');
      expect(typeof result.commission).toBe('number');
      expect(result.halvingReason).toBeNull();
    });
  });

  // =============================================
  // State-aware bundle commission
  // =============================================
  describe('state-aware bundle commission', () => {
    it('full commission when required addon present and available in state', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'TX',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Compass VAB', id: 'addon-vab',  }, 10),
        ],
      });
      // bundleCtx says required addon is available, bundlePremium = 110, rate = 50% -> 55
      const bundleCtx = { requiredAddonAvailable: true, fallbackAddonAvailable: false, halvingReason: null };
      const result = calculateCommission(sale, bundleCtx);
      expect(result.commission).toBe(55.00);
      expect(result.halvingReason).toBeNull();
    });

    it('half commission when required addon not in sale for state', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'FL',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
        }),
        addons: [],
      });
      // bundleCtx says neither required nor fallback available
      // bundlePremium = 100 (no addons), rate = 50% -> 50, halved = 25
      const bundleCtx = {
        requiredAddonAvailable: false,
        fallbackAddonAvailable: false,
        halvingReason: 'Half commission - Compass VAB not bundled (FL)',
      };
      const result = calculateCommission(sale, bundleCtx);
      expect(result.commission).toBe(25.00);
      expect(result.halvingReason).toBe('Half commission - Compass VAB not bundled (FL)');
    });

    it('full commission when fallback addon present', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'FL',
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
          fallbackBundleAddonId: 'addon-better',
        }),
        addons: [
          makeAddon({ type: 'ADDON', name: 'Better Addon', id: 'addon-better',  }, 10),
        ],
      });
      // bundleCtx says fallback is available, bundlePremium = 110, rate = 50% -> 55
      const bundleCtx = { requiredAddonAvailable: false, fallbackAddonAvailable: true, halvingReason: null };
      const result = calculateCommission(sale, bundleCtx);
      expect(result.commission).toBe(55.00);
      expect(result.halvingReason).toBeNull();
    });

    it('commissionApproved bypasses state halving', () => {
      const sale = makeSale({
        premium: new Decimal(100),
        memberState: 'FL',
        commissionApproved: true,
        product: makeProduct({
          type: 'CORE',
          commissionAbove: new Decimal(50),
          commissionBelow: new Decimal(25),
          premiumThreshold: new Decimal(50),
          requiredBundleAddonId: 'addon-vab',
        }),
        addons: [],
      });
      // bundleCtx says both unavailable, but commissionApproved=true
      // bundlePremium = 100, rate = 50% -> 50, no halving
      const bundleCtx = {
        requiredAddonAvailable: false,
        fallbackAddonAvailable: false,
        halvingReason: 'Half commission - Compass VAB not bundled (FL)',
      };
      const result = calculateCommission(sale, bundleCtx);
      expect(result.commission).toBe(50.00);
      // halvingReason should be null since halving was bypassed
      expect(result.halvingReason).toBeNull();
    });

    it('null bundleCtx means no bundle requirement — no halving', () => {
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
      // No bundleCtx (undefined) -> no bundle requirement configured -> no halving
      const result = calculateCommission(sale);
      expect(result.commission).toBe(50.00);
      expect(result.halvingReason).toBeNull();
    });
  });
});
