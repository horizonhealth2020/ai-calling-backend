-- AlterTable
ALTER TABLE "products" ADD COLUMN "required_bundle_addon_id" TEXT,
ADD COLUMN "fallback_bundle_addon_id" TEXT;

-- AlterTable
ALTER TABLE "payroll_entries" ADD COLUMN "halving_reason" TEXT;

-- CreateTable
CREATE TABLE "product_state_availability" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "state_code" VARCHAR(2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_state_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_state_availability_product_id_state_code_key" ON "product_state_availability"("product_id", "state_code");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_required_bundle_addon_id_fkey" FOREIGN KEY ("required_bundle_addon_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_fallback_bundle_addon_id_fkey" FOREIGN KEY ("fallback_bundle_addon_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_state_availability" ADD CONSTRAINT "product_state_availability_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
