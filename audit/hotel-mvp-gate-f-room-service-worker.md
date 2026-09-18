# Gate F — Room Service Worker

**UTC timestamp:** `2026-09-18T21:40:27Z`  
**Gate:** F — Room Service worker  
**Spec reference:** `HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md` (FROZEN) §§6–11, 19  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| Pre-HEAD | `ea162d92df886102e3940acc3db1e05295f6597a` |
| Final HEAD | `ea162d92df886102e3940acc3db1e05295f6597a` (no commit made) |
| Working-tree state | Dirty — Gate F worker pipeline + production Postgres wiring uncommitted |

---

## Production runtime wiring

`createProductionRuntime({ databaseUrl })` opens a `pg` pool from `DATABASE_URL` and selects the Postgres `IndexerStore`.

- Empty / missing `DATABASE_URL` → idle. Memory store is not used.
- `DATABASE_URL` set without an executor → Postgres pool, never memory.
- Injected executor (PGlite in tests) still returns `mode: "postgres"`.
- Startup does not invent a Pons address. Collection stays idle until `ROOMSERVICE_ADDRESS` and `PONS_FEE_ESCROW_ADDRESS` are configured.

---

## Worker runtime architecture

Single `apps/worker` service. Indexer (Gate E) and Room Service (Gate F) share the Postgres store. No Redis, queues, or extra services.

```
apps/worker/src/
  runtime/production.ts     # DATABASE_URL → Postgres store
  runtime/pg-executor.ts    # pg Pool (connection string never logged)
  room-service/
    schedule.ts             # domain Service-time only
    snapshot.ts             # 2-confirmation block at/before boundary
    collection.ts           # simulate → broadcast → verify
    financial.ts            # one block tag; mixed reads rejected
    allocate.ts             # domain pro-rata, top 100
    finalize.ts             # calls finalize_room_service_round
    pipeline.ts             # sequential catch-up, DELAYED / STUCK
```

Indexer `finish()` no longer overwrites `ROOM SERVICE DELAYED`, so live indexing can continue while a Service is delayed.

---

## Scheduling / snapshot

Uses `@hotel100/domain` only (`firstServiceNumberAfterOpen`, `floorServiceBoundary`, `serviceNumberAtBoundary`, `boundaryTimestampForServiceNumber`, `SERVICE_CATCHUP_MAX`).

- Interval 900s, UTC.
- First Service is the first boundary strictly after `HOTEL_OPEN_TIMESTAMP`.
- Due Services are oldest-first, max 8 per run.
- `N+1` is not finalized if `N` fails.
- Snapshot = latest block with timestamp ≤ boundary and depth ≥ `FINANCIAL_CONFIRMATIONS` (2), via `indexableHead(tip, 2)`.
- Eligibility is `eth_getCode(wallet, snapshotBlock) == 0x` plus config exclusions.
- Balances are reconstructed from transfers with `blockNumber <= snapshotBlock`. Live rank is not used.

---

## Financial accounting

After a confirmed collection receipt:

1. Read RoomService balance and `totalRoomServiceClaimed` at that one block.
2. Reject the attempt if the two read blocks differ.
3. `totalReceivedWei = balance + totalClaimed` (domain).
4. `unallocatedWei = totalReceived - SUM(finalized allocations)` (domain).
5. Underflow throws and the Service is not finalized (`BLOCKED` for that attempt).
6. Top 100 snapshot guests: `floor(pool * balance / totalEligible)` (domain `proRataAllocationWei`).
7. No penthouse bonus, weighting, caps, or tiers.
8. Dust stays unallocated and is the next Service's pool when no new ETH arrives.
9. The whole allocation set is submitted to `finalize_room_service_round`. Application code does not reimplement the DB transaction.

---

## Pons adapter assumptions

No production Pons address or ABI is invented.

`FeeCollector` is the narrow adapter:

- `simulateCollect()`
- `broadcastCollect()`
- `verifyReceipt()` requiring `COLLECTION_CONFIRMATIONS` (1)

Failed simulation never broadcasts. Transient failures sleep ~2s, ~5s, ~10s, max 3 attempts. Economic invariant unchanged: RoomService is the direct creator-fee recipient; the adapter only collects into that contract.

---

## DB finalization integration

`submitServiceFinalization` calls Gate D `finalize_room_service_round(...)`.

- Duplicate finalization returns `alreadyFinalized` (restart-safe, no second round).
- Other RPC errors fail closed.
- Worker-write rows go to `worker_write_audit` (phase, success, tx hash, financial-read block, attempt, outcome). No keys or secret URLs are stored.
- Collection failure sets `public_status = ROOM SERVICE DELAYED` and `room_service_delayed`.
- Open delay older than `COLLECTION_STUCK_AFTER_MS` (30 minutes) sets `operational_status = STUCK`.
- A later successful collection clears delay/STUCK and finalizes (auto-recovery).

---

## Files changed

**Added**

- `apps/worker/src/runtime/pg-executor.ts`
- `apps/worker/src/runtime/production.ts`
- `apps/worker/src/room-service/` (schedule, snapshot, collection, financial, allocate, finalize, pipeline, index)
- `apps/worker/src/room-service.test.ts`
- `audit/hotel-mvp-gate-f-room-service-worker.md`

**Modified**

- `apps/worker/src/index.ts` — Postgres runtime; no memory fallback
- `apps/worker/src/indexer/engine.ts` — preserve `ROOM SERVICE DELAYED`
- `apps/worker/src/rpc/types.ts`, `viem-reader.ts`, `mock-reader.ts` — `getBlockTimestamp`
- `apps/worker/package.json` — `pg`
- `pnpm-lock.yaml`

---

## Tests / checks

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/worker test` | **PASS** — 37 tests |
| `pnpm --filter @hotel100/worker typecheck` | **PASS** |
| Production broadcast | **NONE** |

Covered: first Service after open, exact boundary, 2-confirmation snapshot, top-100 / contract exclusion, sequential stop, oldest-first, max 8, simulate-before-broadcast, no broadcast on failed sim, 1-confirmation receipt, retry delays, DELAYED, STUCK, auto-recovery, mixed-block rejection, underflow, pro-rata floor, no penthouse bonus, dust, idempotent resubmit, restart does not duplicate a finalized Service, Postgres runtime has no memory fallback, live balance writes continue while delayed.

---

## Unresolved production inputs

Do not invent:

- `DATABASE_URL` / Supabase credentials
- `HOTEL_RPC_URL`, token address, launch/open block and timestamp
- `ROOMSERVICE_ADDRESS`, `PONS_FEE_ESCROW_ADDRESS`, HoodLock / factory / router
- Real Pons V2 Fee Escrow ABI (Gate C mock interface still stands)
- Worker writer key — not stored; no broadcast in this gate

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**
- Production broadcasts performed: **NONE**
- Secrets printed / committed: **NONE**
- Gate G (entitlement API) **not started**

---

## Next recommended action

Proceed to **Gate G — Entitlement API** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
