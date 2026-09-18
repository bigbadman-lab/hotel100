-- HOTEL MVP canonical tables land in Gate D.
-- Placeholder migration so the supabase/migrations path is initialized.
-- Table list (frozen spec §20): hotel_deployment, system_state, holders,
-- holder_balance_checkpoints, processed_transfer_logs, guest_stays,
-- room_history, room_move_events, service_rounds, service_allocations,
-- guest_entitlements, room_service_claims, public_activity,
-- excluded_addresses, auth_nonces, config_versions, config_change_audit,
-- operational_incidents, worker_write_audit, deployment_audits.
-- Financial/raw integer fields: numeric(78,0). Addresses: lowercase.

SELECT 1;
