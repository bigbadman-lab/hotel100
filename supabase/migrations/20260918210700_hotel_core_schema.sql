-- Gate D: HOTEL100 canonical Postgres schema
-- uint256-compatible fields => numeric(78,0)
-- addresses => lowercase 0x + 40 hex
-- Production addresses / deployment values are NOT invented (nullable until configured).

BEGIN;

-- Prefer pgcrypto when available (Supabase). PGlite may lack it — provide fallback.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

DO $$
BEGIN
  PERFORM gen_random_uuid();
EXCEPTION
  WHEN undefined_function THEN
    CREATE OR REPLACE FUNCTION gen_random_uuid()
    RETURNS uuid
    LANGUAGE sql
    VOLATILE
    AS $fn$
      SELECT uuid_in(
        overlay(
          overlay(md5(random()::text || clock_timestamp()::text) placing '4' from 13)
          placing 'a' from 17
        )::cstring
      );
    $fn$;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION hotel_require_address(p_addr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(trim(p_addr));
BEGIN
  IF v IS NULL OR v !~ '^0x[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'invalid_address: %', p_addr USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION hotel_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- excluded_addresses
-- ---------------------------------------------------------------------------

CREATE TABLE excluded_addresses (
  address text PRIMARY KEY,
  reason text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'system', 'burn', 'protocol')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT excluded_addresses_lc CHECK (address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION excluded_addresses_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.address := hotel_require_address(NEW.address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_excluded_addresses_normalize
  BEFORE INSERT OR UPDATE OF address ON excluded_addresses
  FOR EACH ROW EXECUTE FUNCTION excluded_addresses_normalize();

-- ---------------------------------------------------------------------------
-- hotel_deployment
-- ---------------------------------------------------------------------------

CREATE TABLE hotel_deployment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL DEFAULT 4663 CHECK (chain_id = 4663),
  hotel_token_address text,
  room_service_address text,
  pons_fee_escrow_address text,
  hoodlock_address text,
  deployer_owner_address text,
  entitlement_signer_address text,
  worker_writer_address text,
  hotel_launch_block numeric(78,0),
  hotel_open_block numeric(78,0),
  hotel_open_timestamp bigint,
  hotel_live boolean NOT NULL DEFAULT false,
  live_canary_status text NOT NULL DEFAULT 'LIVE — CANARY PENDING',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_deployment_token_lc CHECK (
    hotel_token_address IS NULL OR hotel_token_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT hotel_deployment_rs_lc CHECK (
    room_service_address IS NULL OR room_service_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT hotel_deployment_escrow_lc CHECK (
    pons_fee_escrow_address IS NULL OR pons_fee_escrow_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT hotel_deployment_hoodlock_lc CHECK (
    hoodlock_address IS NULL OR hoodlock_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT hotel_deployment_deployer_lc CHECK (
    deployer_owner_address IS NULL OR deployer_owner_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT hotel_deployment_signer_lc CHECK (
    entitlement_signer_address IS NULL OR entitlement_signer_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT hotel_deployment_writer_lc CHECK (
    worker_writer_address IS NULL OR worker_writer_address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION hotel_deployment_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hotel_token_address IS NOT NULL THEN
    NEW.hotel_token_address := hotel_require_address(NEW.hotel_token_address);
  END IF;
  IF NEW.room_service_address IS NOT NULL THEN
    NEW.room_service_address := hotel_require_address(NEW.room_service_address);
  END IF;
  IF NEW.pons_fee_escrow_address IS NOT NULL THEN
    NEW.pons_fee_escrow_address := hotel_require_address(NEW.pons_fee_escrow_address);
  END IF;
  IF NEW.hoodlock_address IS NOT NULL THEN
    NEW.hoodlock_address := hotel_require_address(NEW.hoodlock_address);
  END IF;
  IF NEW.deployer_owner_address IS NOT NULL THEN
    NEW.deployer_owner_address := hotel_require_address(NEW.deployer_owner_address);
  END IF;
  IF NEW.entitlement_signer_address IS NOT NULL THEN
    NEW.entitlement_signer_address := hotel_require_address(NEW.entitlement_signer_address);
  END IF;
  IF NEW.worker_writer_address IS NOT NULL THEN
    NEW.worker_writer_address := hotel_require_address(NEW.worker_writer_address);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hotel_deployment_normalize
  BEFORE INSERT OR UPDATE ON hotel_deployment
  FOR EACH ROW EXECUTE FUNCTION hotel_deployment_normalize();

CREATE TRIGGER trg_hotel_deployment_updated_at
  BEFORE UPDATE ON hotel_deployment
  FOR EACH ROW EXECUTE FUNCTION hotel_touch_updated_at();

-- ---------------------------------------------------------------------------
-- system_state (singleton)
-- ---------------------------------------------------------------------------

CREATE TABLE system_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hotel_live boolean NOT NULL DEFAULT false,
  public_status text NOT NULL DEFAULT 'HOTEL CHECK-IN OPENS SOON',
  operational_status text NOT NULL DEFAULT 'OK',
  live_canary_status text NOT NULL DEFAULT 'LIVE — CANARY PENDING',
  room_service_delayed boolean NOT NULL DEFAULT false,
  collection_stuck boolean NOT NULL DEFAULT false,
  last_indexed_block numeric(78,0),
  last_reconciled_block numeric(78,0),
  event_cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_indexed_at timestamptz,
  hotel_launch_block numeric(78,0),
  hotel_open_block numeric(78,0),
  hotel_open_timestamp bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_system_state_updated_at
  BEFORE UPDATE ON system_state
  FOR EACH ROW EXECUTE FUNCTION hotel_touch_updated_at();

INSERT INTO system_state (id) VALUES (1);

-- ---------------------------------------------------------------------------
-- holders / checkpoints / transfers
-- ---------------------------------------------------------------------------

CREATE TABLE holders (
  address text PRIMARY KEY,
  balance_raw numeric(78,0) NOT NULL DEFAULT 0 CHECK (balance_raw >= 0),
  last_seen_block numeric(78,0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holders_address_lc CHECK (address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION holders_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.address := hotel_require_address(NEW.address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_holders_normalize
  BEFORE INSERT OR UPDATE OF address ON holders
  FOR EACH ROW EXECUTE FUNCTION holders_normalize();

CREATE TRIGGER trg_holders_updated_at
  BEFORE UPDATE ON holders
  FOR EACH ROW EXECUTE FUNCTION hotel_touch_updated_at();

CREATE TABLE holder_balance_checkpoints (
  id bigserial PRIMARY KEY,
  address text NOT NULL,
  block_number numeric(78,0) NOT NULL,
  balance_raw numeric(78,0) NOT NULL CHECK (balance_raw >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holder_balance_checkpoints_address_lc CHECK (address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT holder_balance_checkpoints_uniq UNIQUE (address, block_number)
);

CREATE OR REPLACE FUNCTION holder_balance_checkpoints_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.address := hotel_require_address(NEW.address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_holder_balance_checkpoints_normalize
  BEFORE INSERT OR UPDATE OF address ON holder_balance_checkpoints
  FOR EACH ROW EXECUTE FUNCTION holder_balance_checkpoints_normalize();

CREATE TABLE processed_transfer_logs (
  tx_hash text NOT NULL,
  log_index integer NOT NULL CHECK (log_index >= 0),
  block_number numeric(78,0) NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  value_raw numeric(78,0) NOT NULL CHECK (value_raw >= 0),
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tx_hash, log_index),
  CONSTRAINT processed_transfer_logs_tx_hash_lc CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT processed_transfer_logs_from_lc CHECK (from_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT processed_transfer_logs_to_lc CHECK (to_address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION processed_transfer_logs_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.tx_hash := lower(trim(NEW.tx_hash));
  IF NEW.tx_hash !~ '^0x[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_tx_hash: %', NEW.tx_hash USING ERRCODE = '22023';
  END IF;
  NEW.from_address := hotel_require_address(NEW.from_address);
  NEW.to_address := hotel_require_address(NEW.to_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_processed_transfer_logs_normalize
  BEFORE INSERT OR UPDATE ON processed_transfer_logs
  FOR EACH ROW EXECUTE FUNCTION processed_transfer_logs_normalize();

-- ---------------------------------------------------------------------------
-- Guest stays / room history / moves
-- ---------------------------------------------------------------------------

CREATE TABLE guest_stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_address text NOT NULL,
  room_number integer CHECK (room_number IS NULL OR (room_number >= 1 AND room_number <= 100)),
  rank integer NOT NULL CHECK (rank >= 1),
  checked_in_at timestamptz NOT NULL,
  checked_out_at timestamptz,
  best_room_ever integer CHECK (
    best_room_ever IS NULL OR (best_room_ever >= 1 AND best_room_ever <= 100)
  ),
  is_active boolean NOT NULL DEFAULT true,
  not_checked_in boolean NOT NULL DEFAULT false,
  open_block numeric(78,0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_stays_address_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT guest_stays_checkout_after_checkin CHECK (
    checked_out_at IS NULL OR checked_out_at >= checked_in_at
  )
);

CREATE INDEX guest_stays_guest_active_idx ON guest_stays (guest_address) WHERE is_active;

CREATE OR REPLACE FUNCTION guest_stays_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guest_stays_normalize
  BEFORE INSERT OR UPDATE OF guest_address ON guest_stays
  FOR EACH ROW EXECUTE FUNCTION guest_stays_normalize();

CREATE TABLE room_history (
  id bigserial PRIMARY KEY,
  guest_address text NOT NULL,
  room_number integer NOT NULL CHECK (room_number >= 1 AND room_number <= 100),
  rank integer NOT NULL CHECK (rank >= 1),
  occupied_from timestamptz NOT NULL,
  occupied_to timestamptz,
  block_from numeric(78,0),
  block_to numeric(78,0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_history_address_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION room_history_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_room_history_normalize
  BEFORE INSERT OR UPDATE OF guest_address ON room_history
  FOR EACH ROW EXECUTE FUNCTION room_history_normalize();

CREATE TABLE room_move_events (
  id bigserial PRIMARY KEY,
  guest_address text NOT NULL,
  from_room integer CHECK (from_room IS NULL OR (from_room >= 1 AND from_room <= 100)),
  to_room integer CHECK (to_room IS NULL OR (to_room >= 1 AND to_room <= 100)),
  from_rank integer,
  to_rank integer,
  move_kind text NOT NULL CHECK (
    move_kind IN ('check-in', 'stay-end', 'upgrade', 'downgrade', 'penthouse-changed')
  ),
  block_number numeric(78,0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_move_events_address_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION room_move_events_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_room_move_events_normalize
  BEFORE INSERT OR UPDATE OF guest_address ON room_move_events
  FOR EACH ROW EXECUTE FUNCTION room_move_events_normalize();

-- ---------------------------------------------------------------------------
-- Service rounds / allocations / entitlements / claims
-- ---------------------------------------------------------------------------

CREATE TABLE service_rounds (
  service_number bigint PRIMARY KEY CHECK (service_number >= 0),
  boundary_timestamp bigint NOT NULL CHECK (boundary_timestamp >= 0),
  status text NOT NULL CHECK (status IN ('finalized')),
  financial_read_block numeric(78,0) NOT NULL,
  service_pool_wei numeric(78,0) NOT NULL CHECK (service_pool_wei >= 0),
  total_eligible_balance_raw numeric(78,0) NOT NULL CHECK (total_eligible_balance_raw >= 0),
  total_allocated_wei numeric(78,0) NOT NULL CHECK (total_allocated_wei >= 0),
  dust_wei numeric(78,0) NOT NULL CHECK (dust_wei >= 0),
  contract_balance_wei numeric(78,0) NOT NULL CHECK (contract_balance_wei >= 0),
  total_room_service_claimed_wei numeric(78,0) NOT NULL CHECK (total_room_service_claimed_wei >= 0),
  total_received_wei numeric(78,0) NOT NULL CHECK (total_received_wei >= 0),
  unallocated_wei_before numeric(78,0) NOT NULL CHECK (unallocated_wei_before >= 0),
  finalized_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_rounds_boundary_matches_number CHECK (
    boundary_timestamp = service_number * 900
  ),
  CONSTRAINT service_rounds_allocation_lte_pool CHECK (
    total_allocated_wei <= service_pool_wei
  ),
  CONSTRAINT service_rounds_dust_consistent CHECK (
    dust_wei = service_pool_wei - total_allocated_wei
  ),
  CONSTRAINT service_rounds_received_invariant CHECK (
    total_received_wei = contract_balance_wei + total_room_service_claimed_wei
  )
);

CREATE TABLE service_allocations (
  service_number bigint NOT NULL REFERENCES service_rounds(service_number) ON DELETE RESTRICT,
  guest_address text NOT NULL,
  guest_balance_raw numeric(78,0) NOT NULL CHECK (guest_balance_raw >= 0),
  allocation_wei numeric(78,0) NOT NULL CHECK (allocation_wei >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_number, guest_address),
  CONSTRAINT service_allocations_address_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION service_allocations_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_service_allocations_normalize
  BEFORE INSERT OR UPDATE OF guest_address ON service_allocations
  FOR EACH ROW EXECUTE FUNCTION service_allocations_normalize();

CREATE OR REPLACE FUNCTION service_rounds_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'service_round_immutable: finalized Service rounds cannot be modified'
    USING ERRCODE = '25006';
END;
$$;

CREATE TRIGGER trg_service_rounds_immutable_update
  BEFORE UPDATE ON service_rounds
  FOR EACH ROW EXECUTE FUNCTION service_rounds_immutable();

CREATE TRIGGER trg_service_rounds_immutable_delete
  BEFORE DELETE ON service_rounds
  FOR EACH ROW EXECUTE FUNCTION service_rounds_immutable();

CREATE OR REPLACE FUNCTION service_allocations_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'service_allocation_immutable: finalized allocations cannot be modified'
    USING ERRCODE = '25006';
END;
$$;

CREATE TRIGGER trg_service_allocations_immutable_update
  BEFORE UPDATE ON service_allocations
  FOR EACH ROW EXECUTE FUNCTION service_allocations_immutable();

CREATE TRIGGER trg_service_allocations_immutable_delete
  BEFORE DELETE ON service_allocations
  FOR EACH ROW EXECUTE FUNCTION service_allocations_immutable();

CREATE TABLE guest_entitlements (
  guest_address text PRIMARY KEY,
  cumulative_earned_wei numeric(78,0) NOT NULL DEFAULT 0 CHECK (cumulative_earned_wei >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_entitlements_address_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION guest_entitlements_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guest_entitlements_normalize
  BEFORE INSERT OR UPDATE OF guest_address ON guest_entitlements
  FOR EACH ROW EXECUTE FUNCTION guest_entitlements_normalize();

CREATE OR REPLACE FUNCTION guest_entitlements_monotonic()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cumulative_earned_wei < OLD.cumulative_earned_wei THEN
    RAISE EXCEPTION 'guest_entitlement_non_monotonic: cumulative earned cannot decrease'
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guest_entitlements_monotonic
  BEFORE UPDATE ON guest_entitlements
  FOR EACH ROW EXECUTE FUNCTION guest_entitlements_monotonic();

CREATE TABLE room_service_claims (
  id bigserial PRIMARY KEY,
  guest_address text NOT NULL,
  cumulative_entitlement_wei numeric(78,0) NOT NULL CHECK (cumulative_entitlement_wei >= 0),
  payout_wei numeric(78,0) NOT NULL CHECK (payout_wei >= 0),
  signer_epoch numeric(78,0) NOT NULL,
  tx_hash text,
  block_number numeric(78,0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_service_claims_address_lc CHECK (guest_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT room_service_claims_tx_hash_lc CHECK (
    tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'
  )
);

CREATE OR REPLACE FUNCTION room_service_claims_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.guest_address := hotel_require_address(NEW.guest_address);
  IF NEW.tx_hash IS NOT NULL THEN
    NEW.tx_hash := lower(trim(NEW.tx_hash));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_room_service_claims_normalize
  BEFORE INSERT OR UPDATE ON room_service_claims
  FOR EACH ROW EXECUTE FUNCTION room_service_claims_normalize();

-- ---------------------------------------------------------------------------
-- Public activity
-- ---------------------------------------------------------------------------

CREATE TABLE public_activity (
  id bigserial PRIMARY KEY,
  event_class text NOT NULL CHECK (
    event_class IN (
      'check-in',
      'stay-end',
      'upgrade',
      'downgrade',
      'penthouse-changed',
      'room-service-arrived',
      'room-service-claimed'
    )
  ),
  guest_address text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_activity_address_lc CHECK (
    guest_address IS NULL OR guest_address ~ '^0x[0-9a-f]{40}$'
  )
);

CREATE INDEX public_activity_occurred_at_idx ON public_activity (occurred_at DESC);

CREATE OR REPLACE FUNCTION public_activity_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.guest_address IS NOT NULL THEN
    NEW.guest_address := hotel_require_address(NEW.guest_address);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_public_activity_normalize
  BEFORE INSERT OR UPDATE OF guest_address ON public_activity
  FOR EACH ROW EXECUTE FUNCTION public_activity_normalize();

-- ---------------------------------------------------------------------------
-- Auth nonces (SIWE-style challenges — Gate G)
-- ---------------------------------------------------------------------------

CREATE TABLE auth_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nonce text NOT NULL UNIQUE,
  domain text NOT NULL,
  chain_id integer NOT NULL DEFAULT 4663 CHECK (chain_id = 4663),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_nonces_address_lc CHECK (wallet_address ~ '^0x[0-9a-f]{40}$')
);

CREATE OR REPLACE FUNCTION auth_nonces_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.wallet_address := hotel_require_address(NEW.wallet_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_nonces_normalize
  BEFORE INSERT OR UPDATE OF wallet_address ON auth_nonces
  FOR EACH ROW EXECUTE FUNCTION auth_nonces_normalize();

-- ---------------------------------------------------------------------------
-- Config versions + change audit (no secrets)
-- ---------------------------------------------------------------------------

CREATE TABLE config_versions (
  id bigserial PRIMARY KEY,
  version_label text NOT NULL,
  config_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE config_change_audit (
  id bigserial PRIMARY KEY,
  config_version_id bigint REFERENCES config_versions(id),
  change_summary text NOT NULL,
  changed_keys text[] NOT NULL DEFAULT '{}',
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Operational incidents / worker write audit / deployment audits
-- ---------------------------------------------------------------------------

CREATE TABLE operational_incidents (
  id bigserial PRIMARY KEY,
  incident_kind text NOT NULL CHECK (
    incident_kind IN (
      'INDEXING_GAP',
      'ROOM_SERVICE_DELAYED',
      'STUCK',
      'REORG',
      'CONFIG',
      'OTHER'
    )
  ),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'acknowledged')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE worker_write_audit (
  id bigserial PRIMARY KEY,
  write_kind text NOT NULL CHECK (
    write_kind IN ('collectRoomService', 'other')
  ),
  phase text NOT NULL CHECK (
    phase IN ('simulate', 'broadcast', 'verify_receipt', 'failed', 'skipped')
  ),
  success boolean,
  tx_hash text,
  block_number numeric(78,0),
  error_code text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_write_audit_tx_hash_lc CHECK (
    tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'
  )
);

CREATE TABLE deployment_audits (
  id bigserial PRIMARY KEY,
  gate_name text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('PASS', 'BLOCKED')),
  git_head text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
