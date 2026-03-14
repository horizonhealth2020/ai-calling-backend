-- Add isBundleQualifier column to products
ALTER TABLE "products" ADD COLUMN "is_bundle_qualifier" BOOLEAN NOT NULL DEFAULT false;

-- Flag existing Compass VAB product(s) as bundle qualifiers
UPDATE "products" SET "is_bundle_qualifier" = true
WHERE LOWER("name") LIKE '%compass%' AND LOWER("name") LIKE '%vab%';
