-- Check-in HOTEL escrow positions + append-only event log for reconstruction.
-- Canonical escrow is guest_address + amount_raw (never CheckedIn). Do NOT store room_number here.

BEGIN;

-- ---------------------------------------------------------------------------
-- check_in_events — idempotent ingest of CheckedIn / CheckedOut (reorg-safe)
-- ---------------------------------------------------------------------------

CREATE TABLE check_in_events (
  tx_hash text NOT NULL,
  log_index integer NOT NULL CHECK (log_index >= 0),
  block_number numeric(78,0) NOT NULL CHECK (block_number >= 0),
  block_hash text NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('CheckedIn', 'CheckedOut')),
  guest_address text NOT NULL,
  amount_raw numeric(78,0) NOT NULL CHECK (amount_raw > 0),
  check_in_timestamp bigint,
  unlock_timestamp bigint,
  checkout_timestamp bigint,
  nonce numeric(78,0),
  eligibility_signer_epoch numeric(78,0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tx_hash, log_index),
  CONSTRAINT check_in_events_tx_hash_lc CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT check_in_events_block_hash_lc CHECK (block_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT check_in_events_guest_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT check_in_events_checked_in_shape CHECK (
    event_kind <> 'CheckedIn'
    OR (
      check_in_timestamp IS NOT NULL
      AND unlock_timestamp IS NOT NULL
      AND checkout_timestamp IS NULL
      AND nonce IS NOT NULL
      AND eligibility_signer_epoch IS NOT NULL
    )
  ),
  CONSTRAINT check_in_events_checked_out_shape CHECK (
    event_kind <> 'CheckedOut'
    OR (
      checkout_timestamp IS NOT NULL
      AND check_in_timestamp IS NULL
      AND unlock_timestamp IS NULL
      AND nonce IS NULL
      AND eligibility_signer_epoch IS NULL
    )
  )
);

CREATE INDEX check_in_events_block_log_idx
  ON check_in_events (block_number, log_index);

CREATE INDEX check_in_events_guest_idx
  ON check_in_events (guest_address);

CREATE OR REPLACE FUNCTION check_in_events_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.tx_hash := lower(trim(NEW.tx_hash));
  NEW.block_hash := lower(trim(NEW.block_hash));
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_in_events_normalize
  BEFORE INSERT OR UPDATE ON check_in_events
  FOR EACH ROW EXECUTE FUNCTION check_in_events_normalize();

-- ---------------------------------------------------------------------------
-- check_in_positions — derived escrow; keep closed rows for history
-- ---------------------------------------------------------------------------

CREATE TABLE check_in_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_address text NOT NULL,
  amount_raw numeric(78,0) NOT NULL CHECK (amount_raw > 0),
  check_in_timestamp bigint NOT NULL CHECK (check_in_timestamp >= 0),
  unlock_timestamp bigint NOT NULL CHECK (unlock_timestamp >= check_in_timestamp),
  check_in_block numeric(78,0) NOT NULL CHECK (check_in_block >= 0),
  checkout_block numeric(78,0) CHECK (checkout_block IS NULL OR checkout_block >= check_in_block),
  check_in_tx_hash text NOT NULL,
  check_in_log_index integer NOT NULL CHECK (check_in_log_index >= 0),
  checkout_tx_hash text,
  checkout_log_index integer CHECK (checkout_log_index IS NULL OR checkout_log_index >= 0),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_in_positions_guest_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT check_in_positions_check_in_tx_lc CHECK (check_in_tx_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT check_in_positions_checkout_tx_lc CHECK (
    checkout_tx_hash IS NULL OR checkout_tx_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT check_in_positions_checkout_pair CHECK (
    (withdrawn_at IS NULL AND checkout_block IS NULL AND checkout_tx_hash IS NULL AND checkout_log_index IS NULL)
    OR (withdrawn_at IS NOT NULL AND checkout_block IS NOT NULL AND checkout_tx_hash IS NOT NULL AND checkout_log_index IS NOT NULL)
  ),
  CONSTRAINT check_in_positions_check_in_event_uniq UNIQUE (check_in_tx_hash, check_in_log_index),
  CONSTRAINT check_in_positions_checkout_event_uniq UNIQUE (checkout_tx_hash, checkout_log_index)
);

-- At most one unwithdrawn escrow position per guest
CREATE UNIQUE INDEX check_in_positions_one_unwithdrawn
  ON check_in_positions (guest_address)
  WHERE withdrawn_at IS NULL;

CREATE INDEX check_in_positions_unwithdrawn_idx
  ON check_in_positions (guest_address)
  WHERE withdrawn_at IS NULL;

CREATE INDEX check_in_positions_open_at_block_idx
  ON check_in_positions (check_in_block, checkout_block);

CREATE OR REPLACE FUNCTION check_in_positions_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  NEW.check_in_tx_hash := lower(trim(NEW.check_in_tx_hash));
  IF NEW.checkout_tx_hash IS NOT NULL THEN
    NEW.checkout_tx_hash := lower(trim(NEW.checkout_tx_hash));
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_in_positions_normalize
  BEFORE INSERT OR UPDATE ON check_in_positions
  FOR EACH ROW EXECUTE FUNCTION check_in_positions_normalize();

COMMIT;
