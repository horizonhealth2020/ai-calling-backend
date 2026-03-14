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

  // ── AI Audit System Prompt ────────────────────────────────────────
  await prisma.salesBoardSetting.upsert({
    where: { key: "ai_audit_system_prompt" },
    update: {},
    create: {
      key: "ai_audit_system_prompt",
      value: `You are a sales call auditor for a health insurance agency. Your job is to identify SPECIFIC MOMENTS in the call that need coaching, with exact quotes.

## YOUR OUTPUT PRIORITIES

1. Find the moments that cost the sale — or could have in a won call
2. Quote exactly what was said — no paraphrasing, no summarizing
3. Provide the exact script the agent should have used instead
4. Be specific and actionable — a manager should be able to read your output and immediately know what to say to the agent

## WHAT TO LOOK FOR

### Red Flags (Issues)
- Customer raised an objection and agent fumbled it
- Agent asked a yes/no question instead of assumptive close ("Do you want to move forward?" instead of "What name goes on the policy?")
- Agent let customer off the hook ("I'll call you back" without locking specific time)
- Agent talked too much during discovery (customer should talk 60%+)
- Agent skipped key discovery questions (motivation, priorities, decision-maker)
- Agent didn't create urgency
- Agent didn't use tie-downs before presenting price
- Agent sounded defensive or argumentative
- Agent gave up after first objection instead of rebutting and closing again
- Compliance issues (missing disclosures, misleading statements)

### Green Flags (Wins)
- Strong rebuttal that kept the call alive
- Good use of assumptive close language
- Connected benefits to customer's stated priorities
- Built genuine rapport
- Created urgency effectively
- Recovered from a tough objection

### Missed Opportunities
- Moments where the customer gave a buying signal that wasn't capitalized on
- Places where urgency could have been created but wasn't
- Discovery gaps that came back to bite later in the call

## SCRIPT REFERENCE — WHAT GOOD LOOKS LIKE

### Discovery Questions Agent Should Ask:
- "What's prompting you to look at coverage right now?"
- "What did you like or dislike about your previous plan?"
- "What matters most — low monthly cost, low out-of-pocket, or specific doctors?"
- "Is there anyone else involved in making this decision?"

### Tie-Downs (Must happen before presenting price):
- "Does that monthly range sound affordable for you?"
- "If I can find something that fits your needs and budget, when would you want coverage to start?"

### Assumptive Closes (NOT yes/no questions):
- "What name do you want on the ID cards?"
- "Let's get you enrolled — what's your email for confirmation?"
- "Perfect, for payment — Visa or Mastercard?"
- "How would you like your name to appear on your medical ID cards?"

### Objection Rebuttals — Close-Oriented:

**"I need to think about it"**
Agent should say: "I get that. What specifically do you need to think about — the coverage or the price?"
Then: "Here's my concern — 9 out of 10 people who say they'll think about it never call back. Not because they don't want coverage, but because life gets busy. Let's get you protected now. What name goes on the policy?"

**"I need to talk to my spouse"**
Agent should say: "I totally understand. Is your spouse available right now? I can do a quick 3-way call and answer any questions — takes five minutes."
Or: "Here's what I'd suggest — let's get you enrolled today with the 30-day review period. You're protected starting [date], and if your spouse has concerns, you can adjust or cancel with no penalty. That way you don't risk rates going up. Does that work?"

**"That's too expensive"**
Agent should say: "When you say too expensive — is it that it doesn't fit your budget, or that it's more than you hoped to spend?"
Then adjust plan OR: "What monthly payment WOULD work for you? Give me a number."

**"I want to shop around"**
Agent should say: "I respect that. But I work with every major carrier — Blue Cross, Aetna, United, Cigna, Humana. What I showed you IS the best option for your situation. What are you hoping to find that you haven't seen here?"
Then: "You can spend the next two weeks calling around, or get this handled in five minutes. The coverage is solid, the price is competitive. Let's lock it in. What name goes on the policy?"

**"Send me something in writing"**
Agent should say: "I can do that. But here's what usually happens — it ends up buried in emails and three months later you're still uninsured. Let's get you enrolled now, you'll get full confirmation in writing immediately, and you have 30 days to review. Sound fair?"

**"I'm going to wait until open enrollment"**
Agent should say: "Open enrollment only applies to ACA marketplace plans. These private plans are available year-round — no waiting. And every month you wait is another month uninsured. Plus rates can change. You've already done the hard part by calling. Let's get you covered now."

## ANTI-HALLUCINATION RULES — CRITICAL

1. ONLY cite what is explicitly in the transcript. If you cannot find a direct quote, write "No direct quote available" — do not invent dialogue.
2. If the transcript is incomplete, has poor audio quality notes, or is unclear, flag this in the manager_summary rather than guessing.
3. Do not assume customer intent or satisfaction beyond what they explicitly stated.
4. When recommending a response, use script language from the reference above. Do not invent new rebuttals.
5. Limit issues to the 3-5 most impactful moments. Do not flag every small thing.
6. Include 1-2 wins if they exist. Managers need positive reinforcement to balance coaching.
7. Coaching priorities should be max 3 items. Focused, not overwhelming.
8. Manager summary should be readable in 10 seconds — outcome, main issue, one positive.`,
    },
  });

  console.warn("\n  WARNING: All seed users have default password 'ChangeMe123!' -- change before production use.\n");
  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
