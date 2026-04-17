/**
 * UAT-004 investigation — READ-ONLY queries
 * Diagnosing why "unresolve" apparently zeroed out Donna Zarembski's paycard row.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const SALE_ID = "cmo38322700184ihnsjrw63i6";
  const MEMBER_ID = "686941683";

  console.log("=".repeat(80));
  console.log("UAT-004 INVESTIGATION — Donna Zarembski");
  console.log("=".repeat(80));

  // --- 0. Confirm chargeback_submissions column names (schema drift check) ---
  console.log("\n--- chargeback_submissions columns (from information_schema) ---");
  const cbCols = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_name = 'chargeback_submissions'
     ORDER BY ordinal_position;`,
  );
  console.table(cbCols);

  // --- 1. The sale ---
  console.log("\n--- SALE ---");
  const sale = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, agent_id, member_name, member_id, status, created_at
     FROM sales WHERE id = $1;`,
    SALE_ID,
  );
  console.table(sale);

  // --- 2. Any chargeback submissions for this member (use member_id — safer) ---
  console.log("\n--- CHARGEBACK_SUBMISSIONS for this member_id ---");
  const cbs = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM chargeback_submissions
     WHERE member_id = $1 OR matched_sale_id = $2
     ORDER BY created_at DESC LIMIT 10;`,
    MEMBER_ID,
    SALE_ID,
  );
  console.table(cbs);

  const cbIds = cbs.map((c) => c.id as string);

  // --- 3. Payroll entries for this sale ---
  console.log("\n--- PAYROLL_ENTRIES for this sale ---");
  const entries = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, sale_id, payroll_period_id, agent_id, status,
            payout_amount, net_amount, adjustment_amount, bonus_amount,
            fronted_amount, hold_amount, created_at, updated_at
     FROM payroll_entries
     WHERE sale_id = $1
     ORDER BY created_at;`,
    SALE_ID,
  );
  console.table(entries);

  // --- 4. Clawbacks for this sale or linked to these submissions ---
  console.log("\n--- CLAWBACKS for this sale OR these submissions ---");
  const clawbacks = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, sale_id, agent_id, matched_by, matched_value, amount, status,
            applied_payroll_period_id, notes, created_at, updated_at
     FROM clawbacks
     WHERE sale_id = $1
        OR (array_length($2::text[], 1) > 0 AND matched_value = ANY($2::text[]))
     ORDER BY created_at;`,
    SALE_ID,
    cbIds,
  );
  console.table(clawbacks);

  // --- 5. Payroll alerts for these submissions ---
  if (cbIds.length > 0) {
    console.log("\n--- PAYROLL_ALERTS for these submissions ---");
    const alerts = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, chargeback_submission_id, type, clawback_id, status,
              agent_id, agent_name, customer_name, amount,
              approved_at, approved_by, cleared_at, cleared_by, created_at
       FROM payroll_alerts
       WHERE chargeback_submission_id = ANY($1::text[])
       ORDER BY created_at;`,
      cbIds,
    );
    console.table(alerts);
  }

  // --- 6. Audit log — very recent entries touching ChargebackSubmission ---
  console.log("\n--- AUDIT LOG (last 30 chargeback/clawback/payroll events) ---");
  const audits = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT created_at, action, entity_type, entity_id, actor_user_id,
            substring(metadata::text, 1, 300) AS metadata_preview
     FROM app_audit_log
     WHERE entity_type IN ('ChargebackSubmission', 'Clawback', 'PayrollEntry', 'PayrollAlert', 'Sale')
        OR action ILIKE '%chargeback%'
        OR action ILIKE '%clawback%'
     ORDER BY created_at DESC LIMIT 30;`,
  );
  console.table(audits);

  // --- 7. Audit log SPECIFIC to this sale + submissions ---
  console.log("\n--- AUDIT LOG for THIS sale + submissions ---");
  const scopedIds = [SALE_ID, ...cbIds];
  const specificAudits = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT created_at, action, entity_type, entity_id, actor_user_id,
            substring(metadata::text, 1, 500) AS metadata_preview
     FROM app_audit_log
     WHERE entity_id = ANY($1::text[])
     ORDER BY created_at;`,
    scopedIds,
  );
  console.table(specificAudits);
}

main()
  .catch((err) => {
    console.error("Investigation failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
