-- CreateTable
CREATE TABLE "core_product_fallbacks" (
    "id" TEXT NOT NULL,
    "core_product_id" TEXT NOT NULL,
    "fallback_product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_product_fallbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_product_fallbacks_core_product_id_fallback_product_id_key" ON "core_product_fallbacks"("core_product_id", "fallback_product_id");

-- AddForeignKey
ALTER TABLE "core_product_fallbacks" ADD CONSTRAINT "core_product_fallbacks_core_product_id_fkey" FOREIGN KEY ("core_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_product_fallbacks" ADD CONSTRAINT "core_product_fallbacks_fallback_product_id_fkey" FOREIGN KEY ("fallback_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single fallback data to join table
INSERT INTO "core_product_fallbacks" ("id", "core_product_id", "fallback_product_id", "created_at")
SELECT gen_random_uuid()::text, "id", "fallback_bundle_addon_id", NOW()
FROM "products"
WHERE "fallback_bundle_addon_id" IS NOT NULL;

-- Drop old column
ALTER TABLE "products" DROP COLUMN "fallback_bundle_addon_id";
