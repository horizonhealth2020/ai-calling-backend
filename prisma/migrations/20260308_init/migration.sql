-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'OWNER_VIEW', 'MANAGER', 'PAYROLL', 'SERVICE', 'ADMIN');
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'LOCKED', 'FINALIZED');
CREATE TYPE "PayrollEntryStatus" AS ENUM ('PENDING', 'READY', 'PAID', 'ZEROED_OUT', 'CLAWBACK_APPLIED');
CREATE TYPE "SaleStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ClawbackStatus" AS ENUM ('OPEN', 'MATCHED', 'DEDUCTED', 'ZEROED');
CREATE TYPE "ProductType" AS ENUM ('CORE', 'ADDON', 'AD_D');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "password_hash" TEXT NOT NULL,
    "roles" "UserRole"[] NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "user_id" TEXT,
    "extension" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "list_id" TEXT,
    "cost_per_lead" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "type" "ProductType" NOT NULL DEFAULT 'CORE',
    "premium_threshold" DECIMAL(12,2),
    "commission_below" DECIMAL(5,2),
    "commission_above" DECIMAL(5,2),
    "bundled_commission" DECIMAL(5,2),
    "standalone_commission" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "agent_id" TEXT NOT NULL,
    "member_name" TEXT NOT NULL,
    "member_id" TEXT,
    "carrier" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "premium" DECIMAL(12,2) NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "lead_source_id" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "entered_by_user_id" TEXT NOT NULL,
    "payroll_status" "PayrollEntryStatus" NOT NULL DEFAULT 'PENDING',
    "clawback_status" "ClawbackStatus" NOT NULL DEFAULT 'OPEN',
    "enrollment_fee" DECIMAL(10,2),
    "commission_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "call_audits" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "call_date" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "coaching_notes" TEXT,
    "reviewer_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "call_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "week_end" TIMESTAMP(3) NOT NULL,
    "quarter_label" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payout_rules" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "payout_amount" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payout_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_entries" (
    "id" TEXT NOT NULL,
    "payroll_period_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "payout_amount" DECIMAL(12,2) NOT NULL,
    "adjustment_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "status" "PayrollEntryStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_addons" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sale_addons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clawbacks" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "matched_by" TEXT NOT NULL,
    "matched_value" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "ClawbackStatus" NOT NULL DEFAULT 'MATCHED',
    "applied_payroll_period_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clawbacks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_board_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_board_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_audit_log" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");
CREATE UNIQUE INDEX "lead_sources_name_key" ON "lead_sources"("name");
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");
CREATE INDEX "sales_sale_date_idx" ON "sales"("sale_date");
CREATE INDEX "sales_member_id_idx" ON "sales"("member_id");
CREATE INDEX "payout_rules_product_id_effective_date_idx" ON "payout_rules"("product_id", "effective_date");
CREATE UNIQUE INDEX "payroll_entries_payroll_period_id_sale_id_key" ON "payroll_entries"("payroll_period_id", "sale_id");
CREATE UNIQUE INDEX "sale_addons_sale_id_product_id_key" ON "sale_addons"("sale_id", "product_id");
CREATE UNIQUE INDEX "sales_board_settings_key_key" ON "sales_board_settings"("key");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_entered_by_user_id_fkey" FOREIGN KEY ("entered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_audits" ADD CONSTRAINT "call_audits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_audits" ADD CONSTRAINT "call_audits_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payout_rules" ADD CONSTRAINT "payout_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_addons" ADD CONSTRAINT "sale_addons_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_addons" ADD CONSTRAINT "sale_addons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clawbacks" ADD CONSTRAINT "clawbacks_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clawbacks" ADD CONSTRAINT "clawbacks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clawbacks" ADD CONSTRAINT "clawbacks_applied_payroll_period_id_fkey" FOREIGN KEY ("applied_payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
