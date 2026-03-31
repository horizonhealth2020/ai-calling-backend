-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'ACA_PL';

-- AlterTable
ALTER TABLE "products" ADD COLUMN "flat_commission" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "member_count" INTEGER,
ADD COLUMN "aca_covering_sale_id" TEXT;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_aca_covering_sale_id_fkey" FOREIGN KEY ("aca_covering_sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
