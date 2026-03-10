import { prisma } from "../packages/db/src/client";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const users = [
    ["Juan A", "juan.a@horizon.com", "SUPER_ADMIN"],
    ["Nick D", "nick.d@horizon.com", "MANAGER"],
    ["Mike F", "mike.f@horizon.com", "OWNER_VIEW"],
    ["Payroll User", "payroll@example.com", "PAYROLL"],
  ] as const;

  for (const [name, email, role] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role },
      create: { name, email, role, passwordHash, active: true },
    });
  }

  const [a1, a2, a3] = await Promise.all([
    prisma.agent.upsert({ where: { email: "amy.agent@example.com" }, update: {}, create: { name: "Amy Agent", email: "amy.agent@example.com", displayOrder: 1 } }),
    prisma.agent.upsert({ where: { email: "bob.agent@example.com" }, update: {}, create: { name: "Bob Agent", email: "bob.agent@example.com", displayOrder: 2 } }),
    prisma.agent.upsert({ where: { email: "cara.agent@example.com" }, update: {}, create: { name: "Cara Agent", email: "cara.agent@example.com", displayOrder: 3 } }),
  ]);

  const lead = await prisma.leadSource.upsert({
    where: { name: "Facebook" },
    update: {},
    create: { name: "Facebook", costPerLead: 40, effectiveDate: new Date(), notes: "Primary channel" },
  });

  const product = await prisma.product.upsert({ where: { name: "Medicare Advantage" }, update: {}, create: { name: "Medicare Advantage" } });
  await prisma.payoutRule.create({ data: { productId: product.id, payoutAmount: 120, effectiveDate: new Date(), notes: "Default" } }).catch(() => null);

  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "nick.d@example.com" } });
  const sale = await prisma.sale.create({
    data: {
      saleDate: new Date(),
      agentId: a1.id,
      memberName: "John Sample",
      memberId: "M1001",
      carrier: "Aetna",
      productId: product.id,
      premium: 80,
      effectiveDate: new Date(),
      leadSourceId: lead.id,
      enteredByUserId: manager.id,
      status: "APPROVED",
    },
  });

  const period = await prisma.payrollPeriod.create({
    data: { weekStart: new Date(), weekEnd: new Date(), quarterLabel: "Q1", year: new Date().getFullYear() },
  });

  await prisma.payrollEntry.create({
    data: { payrollPeriodId: period.id, saleId: sale.id, agentId: a1.id, payoutAmount: 120, netAmount: 120, status: "READY" },
  });

  await prisma.clawback.create({
    data: { saleId: sale.id, agentId: a1.id, matchedBy: "member_id", matchedValue: "M1001", amount: 120, status: "MATCHED" },
  });

  console.log("Seed complete", { agents: [a1.name, a2.name, a3.name] });
}

main().finally(() => prisma.$disconnect());
