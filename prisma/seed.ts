import { prisma } from "../packages/db/src/client";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
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

  await prisma.agent.upsert({ where: { email: "amy.agent@example.com" }, update: {}, create: { name: "Amy Agent", email: "amy.agent@example.com", displayOrder: 1 } });
  await prisma.agent.upsert({ where: { email: "bob.agent@example.com" }, update: {}, create: { name: "Bob Agent", email: "bob.agent@example.com", displayOrder: 2 } });
  await prisma.agent.upsert({ where: { email: "cara.agent@example.com" }, update: {}, create: { name: "Cara Agent", email: "cara.agent@example.com", displayOrder: 3 } });

  await prisma.leadSource.upsert({
    where: { name: "Facebook" },
    update: {},
    create: { name: "Facebook", costPerLead: 40, effectiveDate: new Date(), notes: "Primary channel" },
  });

  await prisma.product.upsert({ where: { name: "Medicare Advantage" }, update: {}, create: { name: "Medicare Advantage" } });

  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
