-- Backfill null payment_type to 'CC' for existing sales
UPDATE sales SET payment_type = 'CC' WHERE payment_type IS NULL;
