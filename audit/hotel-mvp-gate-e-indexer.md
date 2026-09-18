# Gate E — HOTEL Token Indexer + Holder Reconciliation

**UTC timestamp:** `2026-09-18T21:28:14Z`  
**Gate:** E — Indexer + reconciliation (**reopened** for production Postgres persistence)  
**Spec reference:** `HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md` (FROZEN) §§4–7, 17–18  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| Pre-HEAD (this reopen) | `fb8e04546fd99cbacb8f33a63231c7c79e3936e8` |
| Final HEAD | `fb8e04546fd99cbacb8f33a63231c7c79e3936e8` (no commit made) |
| Working-tree state | Dirty — Gate E indexer + Postgres persistence uncommitted |

---

## Persistence gap closed (reopen)

Previous Gate E used **only** an in-memory `IndexerStore`, which could not survive real worker restarts.

**Now:**

| Concern | Implementation |
|---------|----------------|
| Production persistence | `createPostgresIndexerStore` → Gate D tables |
| Transfers | `processed_transfer_logs` PK `(tx_hash, log_index)` + `block_hash` |
| Balances | `holders.balance_raw` (`numeric(78,0)`) |
| Cursor | `system_state.last_indexed_block`, `last_reconciled_block`, `last_indexed_at`, `event_cursor` JSON (`lastTxHash`, `lastLogIndex`, `lastBlockHash`) |
| Sync / incidents | `system_state.public_status`, `operational_status`, `operational_incidents` |
| Public stay events | `room_move_events` (post-open only) |
| Unit tests | `createMemoryIndexerStore` **only** when `allowMemoryForTests: true` |
| Store selection | `selectIndexerStore` — **refuses silent memory fallback** when `DATABASE_URL` is set without an executor |

Worker restart restores cursor/balances/logs from Postgres rather than empty memory.

---

## Scope completed (full Gate E)

| Requirement | Status |
|-------------|--------|
| Index `$HOTEL` `Transfer` from exact `HOTEL_LAUNCH_BLOCK` | Done |
| Persist `(tx_hash, log_index)` idempotently | Done (memory + Postgres) |
| Maintain `last_indexed_block`, event cursor, `last_reconciled_block` | Done + **DB-backed** |
| Reconstruct balances from transfers (integer raw units) | Done |
| Lowercase address normalization | Done |
| Snapshot-block EOA eligibility | Done |
| Config-driven exclusions (no invented production addresses) | Done |
| Live state = **1 confirmation**; no mempool | Done |
| Reorg → silent correction; **persisted** rewind | Done (`deleteTransfersAtOrAfter`) |
| Gap fail-closed; cursor not advanced past hole; **survives restart** | Done |
| Stale >30s → `HOTEL SYNCING` | Done |
| Pre-open balances only; no public stays | Done |
| Ranking via `@hotel100/domain` only | Done |
| Postgres persistence across restarts | Done |

### Explicitly not in Gate E

- Room Service financial finalization (Gate F)  
- Pons collection writes  
- Entitlement API / frontend / production deployment  

---

## Indexer / reconciliation architecture

```
apps/worker/src/
  rpc/           # ChainReader (viem + mock)
  indexer/
    engine.ts           # HotelIndexer
    memory-store.ts     # tests only
    postgres-store.ts   # production Supabase/Postgres
    store-selection.ts  # fail-closed store selection
    sql.ts              # SqlExecutor interface
    balances / eligibility / ranking-state / stale / types
```

**Postgres mapping**

- `processed_transfer_logs` ← transfers (+ `block_hash` via migration `20260918212300_…`)
- `holders` ← canonical balances  
- `system_state` ← cursor + public/operational status  
- `operational_incidents` ← gap/reorg/mismatch  
- `room_move_events` ← post-open public stay events  

---

## Confirmation / reorg / gap (unchanged semantics)

- Live head: `latest - LIVE_CONFIRMATIONS` (1)  
- Reorg: hash mismatch → delete transfers at/after block → rebuild balances → rewind cursor (persisted)  
- Gap: missing block hash → `HOTEL SYNCING` → do not advance past hole → restart reloads cursor before hole and re-detects  

---

## Files changed (persistence reopen + prior Gate E)

**Migrations**

- `supabase/migrations/20260918212300_indexer_transfer_block_hash.sql`

**Worker**

- `apps/worker/src/indexer/postgres-store.ts` (**new**)
- `apps/worker/src/indexer/store-selection.ts` (**new**)
- `apps/worker/src/indexer/sql.ts` (**new**)
- `apps/worker/src/indexer/{engine,memory-store,balances,stale,types,index}.ts` (async store)
- `apps/worker/src/postgres-store.integration.test.ts` (**new**)
- `apps/worker/src/indexer.test.ts`
- `apps/worker/src/rpc/*`
- `apps/worker/src/index.ts` — requires `DATABASE_URL` for production path; no memory fallback
- `apps/worker/package.json` — `@hotel100/db`, PGlite (dev)

**DB package**

- `packages/db/package.json` — export + PGlite dependency for migration helper consumers

**Audit**

- `audit/hotel-mvp-gate-e-indexer.md` (this file, updated)

---

## Tests / checks run

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/worker test` | **PASS** — 21 tests (15 unit + 6 Postgres/PGlite integration) |
| `pnpm --filter @hotel100/worker typecheck` | **PASS** |
| `pnpm --filter @hotel100/db test` | **PASS** — 12 Gate D tests still green |
| Production broadcast | **NONE** |

### Persistence integration coverage

- Process transfers → destroy store → new store restores cursor/balances/logs  
- Duplicate `(tx_hash, log_index)` idempotent after restart  
- Reorg rewind persisted across restart  
- `last_indexed_block` + `last_reconciled_block` survive restart  
- Gap cannot be bypassed by restart  
- `selectIndexerStore` refuses silent memory fallback when DB URL expected  

---

## Unresolved production RPC / config inputs

Do **not** invent:

- `HOTEL_RPC_URL`, `HOTEL_TOKEN_ADDRESS`, launch/open blocks  
- `DATABASE_URL` / Supabase credentials  
- Protocol exclusion addresses  
- Process wiring of a live `pg` pool/executor (entrypoint documents required injection; PGlite proves the store)

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**  
- Production broadcasts performed: **NONE**  
- Secrets printed / committed: **NONE**  
- Gate F **not started**

---

## Next recommended action

Proceed to **Gate F — Room Service worker** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
