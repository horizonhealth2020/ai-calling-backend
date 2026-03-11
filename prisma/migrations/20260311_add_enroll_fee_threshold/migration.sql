-- AlterTable
ALTER TABLE "products" ADD COLUMN "enroll_fee_threshold" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "payment_type" TEXT;
