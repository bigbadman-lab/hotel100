# Gate D — Database Schema + Atomic Room Service Finalization RPC

**UTC timestamp:** `2026-09-18T21:13:39Z`  
**Gate:** D — Database schema + financial finalization RPC  
**Spec reference:** `HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md` (FROZEN) §20  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| Pre-HEAD | `febaa07ca357be7ba8022c47ccfc5d43ff550833` |
| Final HEAD | `febaa07ca357be7ba8022c47ccfc5d43ff550833` (no commit made in Gate D) |
| Working-tree state | Dirty — Gate D migrations + `@hotel100/db` tests uncommitted |

---

## Scope completed

Canonical HOTEL100 Supabase/Postgres persistence layer:

| Table | Present |
|-------|---------|
| `hotel_deployment` | Yes |
| `system_state` | Yes (singleton) |
| `holders` | Yes |
| `holder_balance_checkpoints` | Yes |
| `processed_transfer_logs` | Yes — PK `(tx_hash, log_index)` |
| `guest_stays` | Yes |
| `room_history` | Yes |
| `room_move_events` | Yes |
| `service_rounds` | Yes — finalized-only inserts via RPC |
| `service_allocations` | Yes |
| `guest_entitlements` | Yes — monotonic cumulative earned |
| `room_service_claims` | Yes |
| `public_activity` | Yes |
| `excluded_addresses` | Yes |
| `auth_nonces` | Yes |
| `config_versions` | Yes |
| `config_change_audit` | Yes |
| `operational_incidents` | Yes |
| `worker_write_audit` | Yes |
| `deployment_audits` | Yes |

**Naming adaptations:** none — all frozen table names used as specified.

### Requirements mapped

| Requirement | Implementation |
|-------------|----------------|
| `numeric(78,0)` for uint256-compatible fields | Schema CHECKs + column types |
| Lowercase addresses | CHECK `^0x[0-9a-f]{40}$` + BEFORE INSERT/UPDATE normalize triggers |
| Unique transfer identity | `PRIMARY KEY (tx_hash, log_index)` |
| Finalized rounds immutable | UPDATE/DELETE triggers raise `service_round_immutable` / `service_allocation_immutable` |
| Sequential finalization | `finalize_room_service_round` requires `service_number = max+1` (first free) |
| Atomic finalization RPC | `finalize_room_service_round(...)` single PL/pgSQL function |
| Advisory locking | `pg_advisory_xact_lock(872014001)` |
| Failed finalization ⇒ no partials | Exception aborts transaction; verified in tests |
| Monotonic entitlements | Trigger + RPC upsert adds only |
| Canonical financial-read block | `service_rounds.financial_read_block` |
| Launch/open block + timestamp | `hotel_deployment` + `system_state` columns |
| Public/operational states | `system_state.public_status`, `operational_status`, delay/stuck flags, canary status |
| Excluded addresses | `excluded_addresses` |
| Safe audit tables | config / incidents / worker writes / deployment audits (**no secrets**) |

### Not in Gate D (deferred)

- Indexer, worker, entitlement API, frontend — **not implemented**

---

## Migrations / functions created

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260918210700_hotel_core_schema.sql` | Canonical tables, normalize triggers, immutability, monotonic entitlements |
| `supabase/migrations/20260918210701_finalize_room_service_round.sql` | `hotel_finalize_advisory_lock_key()`, `finalize_room_service_round(...)` |
| Removed `supabase/migrations/00000000000000_bootstrap_placeholder.sql` | Replaced by real schema |

**RPC:** `finalize_room_service_round(service_number, boundary_timestamp, financial_read_block, service_pool_wei, total_eligible_balance_raw, contract_balance_wei, total_room_service_claimed_wei, unallocated_wei_before, allocations jsonb)`

---

## Files changed

**Added**

- `supabase/migrations/20260918210700_hotel_core_schema.sql`
- `supabase/migrations/20260918210701_finalize_room_service_round.sql`
- `packages/db/` (`package.json`, `tsconfig.json`, `README.md`, `src/migrate.ts`, `src/index.ts`, `src/gate-d.test.ts`)
- `audit/hotel-mvp-gate-d-database.md` (this report)

**Modified**

- `pnpm-lock.yaml` (adds `@electric-sql/pglite` for Gate D tests)

**Deleted**

- `supabase/migrations/00000000000000_bootstrap_placeholder.sql`

---

## Tests / checks run

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/db test` | **PASS** — 12 tests (PGlite applies real migrations) |
| `pnpm --filter @hotel100/db typecheck` | **PASS** |
| Production broadcast | **NONE** |

### Invariants covered

- All canonical tables exist after migration
- `numeric(78,0)` + uint256-scale insert
- Lowercase address normalization / invalid reject
- Unique `(tx_hash, log_index)`
- Atomic finalize + `financial_read_block` recorded
- Duplicate finalization blocked
- Sequential round enforcement
- Rollback on error ⇒ zero partial allocations/entitlements
- Finalized round/allocation immutability
- Monotonic entitlement updates
- Concurrent finalize attempts ⇒ exactly one winner
- Launch/open metadata + exclusions without inventing production addresses

---

## Unresolved assumptions

1. **Supabase project / `DATABASE_URL` / credentials** remain unresolved configuration inputs — not invented.
2. **`pgcrypto`:** migration enables it when available (Supabase). PGlite lacks `pgcrypto`; migration installs a SQL fallback `gen_random_uuid()` for local invariant tests only.
3. **First Service number** after HOTEL open is chosen by the future worker from domain math; DB allows any first `service_number`, then enforces strict `+1` sequencing.
4. **Pons collection / indexer writers** are not implemented here; `worker_write_audit` schema is ready for Gate F.
5. No live Supabase `db push` was performed in this gate (no production project linked).

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**
- Production broadcasts performed: **NONE**
- Secrets printed / committed: **NONE**
- Gate E (indexer) **not started**

---

## Next recommended action

Proceed to **Gate E — Indexer + reconciliation** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
