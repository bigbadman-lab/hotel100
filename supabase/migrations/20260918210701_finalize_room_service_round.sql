-- Gate D: atomic Room Service finalization RPC
-- ONE transaction; advisory lock; sequential; immutable once written.
-- Failed calls leave no partial allocations (PL/pgSQL errors abort the xact).

BEGIN;

-- Fixed advisory lock key for HOTEL Service finalization (namespace constant).
-- pg_advisory_xact_lock releases automatically at transaction end.
CREATE OR REPLACE FUNCTION hotel_finalize_advisory_lock_key()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 872014001::bigint;
$$;

/**
 * finalize_room_service_round
 *
 * Atomically finalizes Service N with allocations and monotonic entitlement updates.
 *
 * p_allocations JSON array elements:
 *   { "guest_address": "0x...", "guest_balance_raw": "<int>", "allocation_wei": "<int>" }
 *
 * Duplicate finalization of the same service_number => exception (blocked).
 * Non-sequential service_number => exception.
 * Allocation sum > pool => exception.
 * On any error, the surrounding transaction rolls back (no partial rows).
 */
CREATE OR REPLACE FUNCTION finalize_room_service_round(
  p_service_number bigint,
  p_boundary_timestamp bigint,
  p_financial_read_block numeric,
  p_service_pool_wei numeric,
  p_total_eligible_balance_raw numeric,
  p_contract_balance_wei numeric,
  p_total_room_service_claimed_wei numeric,
  p_unallocated_wei_before numeric,
  p_allocations jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_finalized bigint;
  v_total_allocated numeric(78,0) := 0;
  v_dust numeric(78,0);
  v_total_received numeric(78,0);
  v_elem jsonb;
  v_guest text;
  v_balance numeric(78,0);
  v_alloc numeric(78,0);
  v_alloc_count integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hotel_finalize_advisory_lock_key());

  IF p_service_number IS NULL OR p_service_number < 0 THEN
    RAISE EXCEPTION 'invalid_service_number' USING ERRCODE = '22023';
  END IF;

  IF p_boundary_timestamp IS NULL OR p_boundary_timestamp <> p_service_number * 900 THEN
    RAISE EXCEPTION 'boundary_timestamp_mismatch: expected %, got %',
      p_service_number * 900, p_boundary_timestamp
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM service_rounds WHERE service_number = p_service_number) THEN
    RAISE EXCEPTION 'service_round_already_finalized: %', p_service_number
      USING ERRCODE = '23505';
  END IF;

  SELECT MAX(service_number) INTO v_max_finalized FROM service_rounds;

  IF v_max_finalized IS NULL THEN
    -- First finalized Service may be any service_number (first Service after open).
    NULL;
  ELSIF p_service_number <> v_max_finalized + 1 THEN
    RAISE EXCEPTION 'non_sequential_service_finalization: next required %, got %',
      v_max_finalized + 1, p_service_number
      USING ERRCODE = '23514';
  END IF;

  IF p_service_pool_wei IS NULL OR p_service_pool_wei < 0
     OR p_total_eligible_balance_raw IS NULL OR p_total_eligible_balance_raw < 0
     OR p_contract_balance_wei IS NULL OR p_contract_balance_wei < 0
     OR p_total_room_service_claimed_wei IS NULL OR p_total_room_service_claimed_wei < 0
     OR p_unallocated_wei_before IS NULL OR p_unallocated_wei_before < 0
     OR p_financial_read_block IS NULL OR p_financial_read_block < 0 THEN
    RAISE EXCEPTION 'invalid_numeric_financial_input' USING ERRCODE = '22023';
  END IF;

  v_total_received := p_contract_balance_wei + p_total_room_service_claimed_wei;

  IF jsonb_typeof(p_allocations) <> 'array' THEN
    RAISE EXCEPTION 'allocations_must_be_json_array' USING ERRCODE = '22023';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    v_guest := hotel_require_address(v_elem ->> 'guest_address');
    v_balance := (v_elem ->> 'guest_balance_raw')::numeric(78,0);
    v_alloc := (v_elem ->> 'allocation_wei')::numeric(78,0);

    IF v_balance IS NULL OR v_balance < 0 OR v_alloc IS NULL OR v_alloc < 0 THEN
      RAISE EXCEPTION 'invalid_allocation_row' USING ERRCODE = '22023';
    END IF;

    v_total_allocated := v_total_allocated + v_alloc;
    v_alloc_count := v_alloc_count + 1;
  END LOOP;

  IF v_total_allocated > p_service_pool_wei THEN
    RAISE EXCEPTION 'allocations_exceed_service_pool' USING ERRCODE = '23514';
  END IF;

  v_dust := p_service_pool_wei - v_total_allocated;

  INSERT INTO service_rounds (
    service_number,
    boundary_timestamp,
    status,
    financial_read_block,
    service_pool_wei,
    total_eligible_balance_raw,
    total_allocated_wei,
    dust_wei,
    contract_balance_wei,
    total_room_service_claimed_wei,
    total_received_wei,
    unallocated_wei_before
  ) VALUES (
    p_service_number,
    p_boundary_timestamp,
    'finalized',
    p_financial_read_block,
    p_service_pool_wei,
    p_total_eligible_balance_raw,
    v_total_allocated,
    v_dust,
    p_contract_balance_wei,
    p_total_room_service_claimed_wei,
    v_total_received,
    p_unallocated_wei_before
  );

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    v_guest := hotel_require_address(v_elem ->> 'guest_address');
    v_balance := (v_elem ->> 'guest_balance_raw')::numeric(78,0);
    v_alloc := (v_elem ->> 'allocation_wei')::numeric(78,0);

    INSERT INTO service_allocations (
      service_number, guest_address, guest_balance_raw, allocation_wei
    ) VALUES (
      p_service_number, v_guest, v_balance, v_alloc
    );

    INSERT INTO guest_entitlements (guest_address, cumulative_earned_wei)
    VALUES (v_guest, v_alloc)
    ON CONFLICT (guest_address) DO UPDATE
      SET cumulative_earned_wei = guest_entitlements.cumulative_earned_wei + EXCLUDED.cumulative_earned_wei,
          updated_at = now();

    IF v_alloc > 0 THEN
      INSERT INTO public_activity (event_class, guest_address, payload)
      VALUES (
        'room-service-arrived',
        v_guest,
        jsonb_build_object(
          'service_number', p_service_number,
          'allocation_wei', v_alloc::text,
          'financial_read_block', p_financial_read_block::text
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'service_number', p_service_number,
    'status', 'finalized',
    'financial_read_block', p_financial_read_block,
    'total_allocated_wei', v_total_allocated,
    'dust_wei', v_dust,
    'allocation_count', v_alloc_count,
    'total_received_wei', v_total_received
  );
END;
$$;

COMMENT ON FUNCTION finalize_room_service_round IS
  'Atomic HOTEL Room Service finalization. Uses pg_advisory_xact_lock; finalized rounds immutable; no partial allocations on failure.';

COMMIT;
