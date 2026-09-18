-- Gate E persistence: block hash on processed transfers for reorg audit/rewind safety.

BEGIN;

ALTER TABLE processed_transfer_logs
  ADD COLUMN IF NOT EXISTS block_hash text;

ALTER TABLE processed_transfer_logs
  DROP CONSTRAINT IF EXISTS processed_transfer_logs_block_hash_lc;

ALTER TABLE processed_transfer_logs
  ADD CONSTRAINT processed_transfer_logs_block_hash_lc
  CHECK (block_hash IS NULL OR block_hash ~ '^0x[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION processed_transfer_logs_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.tx_hash := lower(trim(NEW.tx_hash));
  IF NEW.tx_hash !~ '^0x[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_tx_hash: %', NEW.tx_hash USING ERRCODE = '22023';
  END IF;
  NEW.from_address := hotel_require_address(NEW.from_address);
  NEW.to_address := hotel_require_address(NEW.to_address);
  IF NEW.block_hash IS NOT NULL THEN
    NEW.block_hash := lower(trim(NEW.block_hash));
    IF NEW.block_hash !~ '^0x[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'invalid_block_hash: %', NEW.block_hash USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
