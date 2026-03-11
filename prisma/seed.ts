import { prisma } from "../packages/db/src/client";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  // ── Users ──────────────────────────────────────────────────────────
  const users: [string, string, string[]][] = [
    ["Juan A", "juan.a@horizon.com", ["SUPER_ADMIN"]],
    ["Nick D", "nick.d@horizon.com", ["MANAGER"]],
    ["Mike F", "mike.f@horizon.com", ["OWNER_VIEW"]],
    ["Payroll User", "payroll@example.com", ["PAYROLL"]],
  ];

  for (const [name, email, roles] of users) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, roles, passwordHash, active: true },
    });
  }

  // ── Agents ─────────────────────────────────────────────────────────
  const agents: [string, string, number][] = [
    ["Amy Agent", "amy.agent@example.com", 1],
    ["Bob Agent", "bob.agent@example.com", 2],
    ["Cara Agent", "cara.agent@example.com", 3],
    ["David Agent", "david.agent@example.com", 4],
    ["Elena Agent", "elena.agent@example.com", 5],
  ];

  for (const [name, email, displayOrder] of agents) {
    await prisma.agent.upsert({
      where: { email },
      update: {},
      create: { name, email, displayOrder },
    });
  }

  // ── Lead Sources ───────────────────────────────────────────────────
  const leadSources: [string, number, string?][] = [
    ["Facebook", 40, "Primary social channel"],
    ["Google Ads", 55, "Search campaigns"],
    ["Direct Mail", 25, "Postcards and flyers"],
    ["Referral", 0, "Agent and member referrals"],
    ["TV Ads", 75, "Television commercials"],
  ];

  for (const [name, costPerLead, notes] of leadSources) {
    await prisma.leadSource.upsert({
      where: { name },
      update: {},
      create: { name, costPerLead, effectiveDate: new Date(), notes },
    });
  }

  // ── Products ───────────────────────────────────────────────────────
  // Core products
  await prisma.product.upsert({
    where: { name: "Medicare Advantage" },
    update: {},
    create: {
      name: "Medicare Advantage", type: "CORE",
      premiumThreshold: 300, commissionBelow: 25, commissionAbove: 30,
      notes: "Primary MA plan",
    },
  });

  await prisma.product.upsert({
    where: { name: "Medicare Supplement" },
    update: {},
    create: {
      name: "Medicare Supplement", type: "CORE",
      premiumThreshold: 250, commissionBelow: 20, commissionAbove: 28,
      notes: "Medigap plans",
    },
  });

  await prisma.product.upsert({
    where: { name: "Part D Prescription" },
    update: {},
    create: {
      name: "Part D Prescription", type: "CORE",
      premiumThreshold: 150, commissionBelow: 15, commissionAbove: 22,
    },
  });

  // Add-on products
  await prisma.product.upsert({
    where: { name: "Compass VAB" },
    update: {},
    create: {
      name: "Compass VAB", type: "ADDON",
      bundledCommission: 30, standaloneCommission: 30,
      notes: "Vision, Hearing, Dental add-on",
    },
  });

  await prisma.product.upsert({
    where: { name: "Hospital Indemnity" },
    update: {},
    create: {
      name: "Hospital Indemnity", type: "ADDON",
      bundledCommission: 25, standaloneCommission: 25,
    },
  });

  // AD&D products
  await prisma.product.upsert({
    where: { name: "AD&D $125K" },
    update: {},
    create: {
      name: "AD&D $125K", type: "AD_D",
      bundledCommission: 70, standaloneCommission: 35,
      notes: "Accidental Death & Dismemberment 125K",
    },
  });

  await prisma.product.upsert({
    where: { name: "AD&D $250K" },
    update: {},
    create: {
      name: "AD&D $250K", type: "AD_D",
      bundledCommission: 70, standaloneCommission: 35,
      notes: "Accidental Death & Dismemberment 250K",
    },
  });

  console.warn("\n  WARNING: All seed users have default password 'ChangeMe123!' -- change before production use.\n");
  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
