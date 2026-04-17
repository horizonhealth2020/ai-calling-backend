/**
 * Diagnose the 500 error on Approve Recovery.
 * READ-ONLY: inspects current state of the PENDING RECOVERY alert + its Clawback for Donna Zarembski.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(80));
  console.log("APPROVE RECOVERY 500 DIAGNOSIS — Donna Zarembski");
  console.log("=".repeat(80));

  const MEMBER_ID = "686941683";

  // 1. Find all PENDING RECOVERY alerts for this member
  console.log("\n--- PENDING RECOVERY alerts for Donna ---");
  const alerts = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT pa.id, pa.chargeback_submission_id, pa.type, pa.clawback_id, pa.status,
            pa.agent_id, pa.agent_name, pa.amount, pa.created_at,
            cs.member_id, cs.matched_sale_id, cs.resolution_type, cs.resolved_at
     FROM payroll_alerts pa
     JOIN chargeback_submissions cs ON cs.id = pa.chargeback_submission_id
     WHERE pa.type = 'RECOVERY' AND pa.status = 'PENDING'
       AND cs.member_id = $1
     ORDER BY pa.created_at DESC;`,
    MEMBER_ID,
  );
  console.table(alerts);

  const clawbackIds = alerts.map((a) => a.clawback_id as string).filter(Boolean);

  // 2. The underlying Clawback(s)
  if (clawbackIds.length > 0) {
    console.log("\n--- CLAWBACKS referenced by the PENDING RECOVERY alert(s) ---");
    const clawbacks = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT c.id, c.sale_id, c.agent_id, c.matched_by, c.matched_value,
              c.amount, c.status, c.applied_payroll_period_id,
              pp.status AS period_status, pp.week_start, pp.week_end,
              s.status AS sale_status, s.member_name
       FROM clawbacks c
       LEFT JOIN payroll_periods pp ON pp.id = c.applied_payroll_period_id
       LEFT JOIN sales s ON s.id = c.sale_id
       WHERE c.id = ANY($1::text[]);`,
      clawbackIds,
    );
    console.table(clawbacks);

    // 3. Payroll entries for the Clawback's sale
    const saleIds = clawbacks.map((c) => c.sale_id as string).filter(Boolean);
    if (saleIds.length > 0) {
      console.log("\n--- PAYROLL_ENTRIES for the Clawback's sale ---");
      const entries = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT pe.id, pe.sale_id, pe.payroll_period_id, pe.status,
                pe.payout_amount, pe.net_amount, pe.adjustment_amount,
                pp.status AS period_status
         FROM payroll_entries pe
         LEFT JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
         WHERE pe.sale_id = ANY($1::text[])
         ORDER BY pe.created_at;`,
        saleIds,
      );
      console.table(entries);

      // 4. ClawbackProduct rows
      console.log("\n--- CLAWBACK_PRODUCTS for these Clawbacks ---");
      const products = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT cp.clawback_id, cp.product_id, cp.amount, p.name AS product_name
         FROM clawback_products cp
         LEFT JOIN products p ON p.id = cp.product_id
         WHERE cp.clawback_id = ANY($1::text[]);`,
        clawbackIds,
      );
      console.table(products);
    }
  }

  // 5. Most recent audit entries touching the alert / clawback
  if (alerts.length > 0 || clawbackIds.length > 0) {
    const allIds = [...alerts.map((a) => a.id as string), ...clawbackIds];
    console.log("\n--- RECENT AUDIT LOG for these alert(s) + Clawback(s) ---");
    const audits = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT created_at, action, entity_type, entity_id, actor_user_id,
              substring(metadata::text, 1, 400) AS metadata_preview
       FROM app_audit_log
       WHERE entity_id = ANY($1::text[])
       ORDER BY created_at DESC LIMIT 20;`,
      allIds,
    );
    console.table(audits);
  }

  // 6. Most recent errors in audit log (if any)
  console.log("\n--- RECENT audit entries (last 15 chargeback/alert events across all) ---");
  const recent = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT created_at, action, entity_type, entity_id,
            substring(metadata::text, 1, 300) AS metadata_preview
     FROM app_audit_log
     WHERE entity_type IN ('ChargebackSubmission', 'PayrollAlert', 'Clawback', 'PayrollEntry')
        OR action ILIKE '%chargeback%'
        OR action ILIKE '%recover%'
        OR action ILIKE '%alert%'
     ORDER BY created_at DESC LIMIT 15;`,
  );
  console.table(recent);
}

main()
  .catch((err) => {
    console.error("Diagnosis failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
