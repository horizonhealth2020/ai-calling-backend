-- CreateTable
CREATE TABLE "clawback_products" (
    "id" TEXT NOT NULL,
    "clawback_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clawback_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clawback_products_clawback_id_product_id_key" ON "clawback_products"("clawback_id", "product_id");

-- AddForeignKey
ALTER TABLE "clawback_products" ADD CONSTRAINT "clawback_products_clawback_id_fkey" FOREIGN KEY ("clawback_id") REFERENCES "clawbacks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clawback_products" ADD CONSTRAINT "clawback_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
