# HOTEL100 Check-In — Production Deployment & Verification Gate

## 1. Verdict

`BLOCKED — CHECK-IN PRODUCTION DEPLOYMENT PLAN NOT SAFE`

Primary hard blockers (cannot invent production values):

1. **All RoomService constructor production inputs unresolved** (no local `.env`; `.env.example` blanks)
2. **Eligibility Signer not provisioned** — separation cannot be proven against real production addresses
3. **Room Service production FeeCollector / financial-reader factories absent** — indexer poll loop exists, but 15-minute collect/finalize cannot be started in production without inventing writer/collector wiring

Local/simulation work and code fixes from this gate (EOA public filter + worker indexer loop) are recorded below. No production broadcast, DB mutation, env mutation, or feature enable occurred.

## 2. UTC timestamp

- Gate start: `2026-09-19T16:25:42Z`
- Gate final: `2026-09-19T16:32:00Z` (approx.; validation completed after)

## 3. Branch / HEAD / git state

- Branch: `main`
- HEAD: `e3c049fbf6dd1f697ae4e4befbaee9e2c65240d6`
- Implementation remains **uncommitted** (dirty working tree)
- Prior audits present:
  - `audit/hotel100-check-in-current-state-audit.md`
  - `audit/hotel100-check-in-implementation.md`
- No deployment already occurred (no production broadcast evidence; `ROOMSERVICE_ADDRESS` unset)
- Gate H UI intact; check-in UI is additive inside Your Stay / operational metric only

## 4. Validation results

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test:contracts` | PASS (46) |
| `pnpm --filter @hotel100/domain test` | PASS (33) |
| `pnpm --filter @hotel100/config test` | PASS (17) |
| `pnpm --filter @hotel100/web test` | PASS (40) — includes EOA Top 100 + fail-closed regressions |
| `pnpm --filter @hotel100/worker exec vitest run --testTimeout=20000` | PASS (42) |
| `pnpm --filter @hotel100/web build` | PASS |
| `forge script script/DeployRoomServiceSimulation.s.sol --use ../.solc/solc-0.8.28` | PASS (local simulation; **no `--broadcast`**) |

## 5. Constructor args

Exact signature (`contracts/src/RoomService.sol`):

```solidity
constructor(
  address hotelToken_,
  address ponsFeeEscrow_,
  address initialOwner_,
  address initialEntitlementSigner_,
  address initialEligibilitySigner_
)
```

| Arg | Production source | Status |
| --- | --- | --- |
| `hotelToken_` | `HOTEL_TOKEN_ADDRESS` | **MISSING** |
| `ponsFeeEscrow_` | `PONS_FEE_ESCROW_ADDRESS` | **MISSING** |
| `initialOwner_` | `HOTEL_DEPLOYER_OWNER_ADDRESS` | **MISSING** |
| `initialEntitlementSigner_` | `HOTEL_ENTITLEMENT_SIGNER_ADDRESS` | **MISSING** |
| `initialEligibilitySigner_` | `HOTEL_ELIGIBILITY_SIGNER_ADDRESS` | **MISSING** |

Local `.env` file: **absent**. Values not invented.

## 6. Production address/config readiness

| Key | Ready? |
| --- | --- |
| `HOTEL_RPC_URL` | No |
| `HOTEL_TOKEN_ADDRESS` | No |
| `PONS_FEE_ESCROW_ADDRESS` | No |
| `ROOMSERVICE_ADDRESS` | No (post-deploy) |
| `HOTEL_DEPLOYER_OWNER_ADDRESS` | No |
| `HOTEL_ENTITLEMENT_SIGNER_ADDRESS` | No |
| `HOTEL_ELIGIBILITY_SIGNER_ADDRESS` | No |
| `HOTEL_WORKER_WRITER_ADDRESS` | No |
| `HOTEL_ELIGIBILITY_SIGNER_PRIVATE_KEY` | No (server secret; name only) |
| `HOTEL_CHECKIN_ENABLED` | Present default `false` in `.env.example` |
| `DATABASE_URL` | No |

Config validation already rejects eligibility↔entitlement/deployer/worker collisions when addresses are supplied (`packages/config/src/validate.ts`).

## 7. Signer separation proof

**BLOCKED — cannot prove.**

- No production public addresses provisioned.
- Code/config **requires** distinct eligibility signer when check-in enabled; forbidden to equal entitlement / deployer / worker.
- Contract constructor also requires a non-zero distinct eligibility signer address at deploy time.
- Private keys: **not printed**; entitlement/eligibility private key env names exist in `.env.example` as comments only.

## 8. Contract build + verification readiness

- solc: `0.8.28` via `../.solc/solc-0.8.28`
- Optimizer: `true`, `optimizer_runs = 200` (`contracts/foundry.toml`)
- Artifact: `contracts/out/RoomService.sol/RoomService.json`
- Constructor ABI: five `address` inputs in order listed in §5
- Intended post-deploy verification (future gate):
  1. `forge verify-contract` / explorer source verify against same solc + optimizer settings
  2. Read `hotelToken`, `ponsFeeEscrow`, `owner`, `entitlementSigner`, `eligibilitySigner`, `CHECK_IN_DURATION`
  3. Confirm bytecode matches local artifact

## 9. Deployment simulation

Command (no broadcast):

```bash
cd contracts && forge script script/DeployRoomServiceSimulation.s.sol --use ../.solc/solc-0.8.28 -vv
```

Result: **PASS** on ephemeral local addresses only.

Verified in simulation logs:

- constructor does not revert
- owner / entitlement / eligibility set as expected (local)
- `CHECK_IN_DURATION == 3600`
- `checkInsPaused == false` at deploy
- no runtime multiplier setter in ABI/surface
- checkout path is not `whenNotPaused` / not gated by `checkInsPaused` (code review + Foundry `test_checkOut_whileCheckInsPaused`)

**Not** a production-config fork simulation — production RPC/addresses unresolved.

## 10. Migration safety

File: `supabase/migrations/20260919164000_check_in_escrow.sql`

- Additive: creates `check_in_events`, `check_in_positions`, indexes, normalize triggers
- No `DROP` / `TRUNCATE` / destructive rewrite of Room Service tables
- Idempotent ingest key: `(tx_hash, log_index)` PK on events; unique check-in/checkout event refs on positions
- One unwithdrawn position per guest (partial unique index)
- Compatible with existing holders / guest_entitlements / service_rounds
- Local apply: covered by PGlite tests via `applyHotelMigrations`

Future production command (do **not** run in this gate):

```bash
# Prefer project’s Supabase migration apply / packages/db migrate against production DATABASE_URL
# Exact operator command depends on hosted Supabase CLI workflow; migration file name:
# supabase/migrations/20260919164000_check_in_escrow.sql
```

Rollback preference: leave tables in place; disable feature flag + pause new check-ins. Do not DROP as first response.

## 11. Exclusion verification

| Path | Mechanism |
| --- | --- |
| Worker Top 100 / rewards | `buildExclusionSet` includes `roomServiceAddress` + burns + protocol addrs; EOA filter via `eth_getCode` |
| Public Top 100 | `buildPublicExclusionSet` includes RoomService from `hotel_deployment.room_service_address` + `excluded_addresses` + burns; **plus** live `eth_getCode` filter (this gate) |
| Post-deploy step | After deploy: upsert RoomService into `excluded_addresses` **and** `hotel_deployment.room_service_address` **and** set `ROOMSERVICE_ADDRESS` / indexer config |

Documented post-deploy exclusion is **required and explicit** (config + DB). Manual omission would be unsafe — listed in handoff §20.

## 12. EOA consistency

**PASS after fix in this gate.**

- Worker: `filterEligibleHolders` / `isEligibleEoaAtSnapshot` (`eth_getCode` at snapshot block)
- Authorize API: rejects non-EOA via `getCode`
- Public state (fixed): live ranking filters via `getCode`; **fail-closed / syncing** if live and RPC/`getCode` unavailable
- Regression tests:
  - contract wallet with huge balance excluded from public Top 100
  - live hotel without `getCode` → withhold / syncing

## 13. Worker/runtime plan

| Concern | Status |
| --- | --- |
| Entrypoint | `apps/worker/src/index.ts` via `pnpm --filter @hotel100/worker start` / `dev` |
| Indexer loop | **Wired this gate**: `onRestart` then `setInterval(WORKER_POLL_INTERVAL_MS)` → `runOnce` (includes transfer + `CheckedIn`/`CheckedOut` ingest) |
| Cadence | `WORKER_POLL_INTERVAL_MS` (60s); reconcile `HOLDER_RECONCILE_INTERVAL_MS` (300s) |
| Check-in events | Ingested inside `HotelIndexer.indexRange` when `db` + RoomService configured |
| Room Service 15-min rounds | **BLOCKED for production**: `tryWireRoomServiceWorker` returns null — no production `FeeCollector` / financial-reader factories (would need writer key + collect broadcast path). Tests cover pipeline in isolation. |
| Host/runtime | No Render/fly/Procfile manifests in repo — host TBD by operator |
| Required env (indexer) | `HOTEL_RPC_URL`, `HOTEL_TOKEN_ADDRESS`, `HOTEL_LAUNCH_BLOCK`, `DATABASE_URL`, plus RoomService/Pons for event ingest |
| Health | Per-tick console logs; errors caught without killing process |

Hard Gate J residual: **reward rounds not production-startable** until FeeCollector/financial reader factories + writer key are implemented/wired.

## 14. End-to-end check-in simulation

Covered by Foundry `RoomServiceCheckIn.t.sol` + web `check-in.test.ts` + worker escrow store tests (no production funds):

| Step | Evidence |
| --- | --- |
| Eligible path / auth bounds | web check-in authorize tests (Top 100, 10% min, wallet max, 2-min auth, flag off) |
| Exact approval + checkIn + events + stay | Foundry valid check-in |
| Effective ranking unchanged by escrow split | domain tests + worker escrow attribution |
| RoomService excluded | public/worker exclusion + coherence |
| 1.5x active weight | domain `rewardWeight` + `allocate-weight.test.ts` |
| Early checkout reverts; unlock checkout; full return | Foundry lock/checkout tests |
| Checkout while check-ins paused | Foundry |

## 15. Reward snapshot simulation

| Case | Proof |
| --- | --- |
| Standard 1.0x / active 1.5x pro-rata + dust | `apps/worker/src/check-in/allocate-weight.test.ts` |
| Outside Top 100 → 0 | domain `rewardWeight` tests |
| Expired unwithdrawn → 1.0x | domain stay phase + rewardWeight |
| Idempotent finalization | `room-service.test.ts` restart-safe / already-finalized |
| Contract exclusion at snapshot | room-service pipeline EOA exclusion test |

## 16. Sync/failure simulation

| Scenario | Behavior |
| --- | --- |
| Escrow > RoomService HOTEL balance | public + worker fail-closed / syncing (`escrowCoherentWithRoomServiceBalance`) |
| Live public ranking without RPC | withhold / syncing (this gate) |
| Stale index | existing `PUBLIC_STALE_THRESHOLD_MS` syncing |
| Checkout after API lag | frontend `readStayFromContract` + onchain `checkOut` (DB not required) |
| Missed reward catch-up | worker pipeline catch-up + idempotent finalize tests |

## 17. Feature flag verification

- Default `HOTEL_CHECKIN_ENABLED=false`
- Authorize returns `check_in_disabled` when false (`check-in.test.ts`)
- UI: CHECK IN CTA gated by `snapshot.checkInEnabled`; checkout path remains for expired stays when present
- Production flag **not enabled** in this gate

## 18. Exact deployment order

1. Freeze/record current production config snapshot (read-only)
2. Provision distinct Eligibility Signer EOA (public + server private key storage)
3. Apply DB migration `20260919164000_check_in_escrow.sql`
4. Deploy updated `RoomService` with five constructor args (chain 4663)
5. Verify source/bytecode
6. Record deployed RoomService address
7. Seed exclusions: `excluded_addresses` + `hotel_deployment.room_service_address` + env `ROOMSERVICE_ADDRESS` / `HOTEL_MANUAL_EXCLUSIONS` as needed
8. Update web/worker/server RoomService + token + RPC config
9. Configure Eligibility Signer address + private signing secret (server only)
10. Wire/start worker indexer loop (`pnpm --filter @hotel100/worker start`) — **after** FeeCollector factories exist, also start Room Service finalize path
11. Keep `HOTEL_CHECKIN_ENABLED=false`
12. Post-deploy read-only checks (§20)
13. Separate controlled canary broadcast gate (single check-in)
14. Verify ingest / ranking / reward
15. Only then `HOTEL_CHECKIN_ENABLED=true`

## 19. Rollback / disable plan

If problems after deploy:

1. Set `HOTEL_CHECKIN_ENABLED=false` immediately
2. Owner may `pauseCheckIns()` onchain (blocks **new** check-ins only)
3. **Never** pause checkout; locks continue; guests withdraw after unlock via `checkOut`
4. Keep reward claims available (`pauseClaims` is separate and should not be used to “fix” check-in)
5. Keep indexer running to ingest `CheckedOut` / maintain coherence
6. Preserve DB event/position history
7. Do **not** DROP migration tables as first response

Cannot roll back: already-deployed contract bytecode, already-escrowed HOTEL (must wait unlock + checkout).

## 20. Exact controlled-broadcast handoff

### Contract

```bash
# After production addresses are provisioned — FUTURE GATE ONLY
cd contracts
forge create src/RoomService.sol:RoomService \
  --use ../.solc/solc-0.8.28 \
  --rpc-url "$HOTEL_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --constructor-args \
    "$HOTEL_TOKEN_ADDRESS" \
    "$PONS_FEE_ESCROW_ADDRESS" \
    "$HOTEL_DEPLOYER_OWNER_ADDRESS" \
    "$HOTEL_ENTITLEMENT_SIGNER_ADDRESS" \
    "$HOTEL_ELIGIBILITY_SIGNER_ADDRESS"
# Or forge script with --broadcast only in an explicit broadcast gate
```

- Chain ID: `4663`
- Expected deployer: `HOTEL_DEPLOYER_OWNER_ADDRESS`
- Post-deploy reads: owner, both signers, `CHECK_IN_DURATION==3600`, token/escrow immutables

### Migration

- Apply `supabase/migrations/20260919164000_check_in_escrow.sql`
- Expect tables: `check_in_events`, `check_in_positions`

### Config (by runtime)

| Env | Web | Worker | Notes |
| --- | --- | --- | --- |
| `ROOMSERVICE_ADDRESS` | ✓ | ✓ | After deploy |
| `HOTEL_TOKEN_ADDRESS` | ✓ | ✓ | |
| `HOTEL_RPC_URL` | ✓ | ✓ | Required for public EOA filter when live |
| `HOTEL_ELIGIBILITY_SIGNER_ADDRESS` | ✓ | | |
| `HOTEL_ELIGIBILITY_SIGNER_PRIVATE_KEY` | ✓ (server) | | Secret name only |
| `HOTEL_ENTITLEMENT_SIGNER_*` | ✓ | | Distinct |
| `HOTEL_CHECKIN_ENABLED` | ✓ | | Stay `false` until canary |
| `DATABASE_URL` | ✓ | ✓ | |
| `HOTEL_WORKER_WRITER_*` | | ✓ | For future FeeCollector |

### Worker

```bash
pnpm --filter @hotel100/worker start
# Requires RPC + token + launch block + DATABASE_URL
# Indexer loop: WORKER_POLL_INTERVAL_MS
# Room Service finalize: BLOCKED until production FeeCollector/financial-reader factories exist
```

### Post-deploy verification checklist

- [ ] Bytecode present on 4663
- [ ] Source verified
- [ ] Owner / entitlement / eligibility correct and distinct
- [ ] `CHECK_IN_DURATION == 3600`
- [ ] RoomService excluded in DB + config
- [ ] Worker indexer live; `checkInEventsApplied` healthy
- [ ] Public API coherent with RPC EOA filter
- [ ] `HOTEL_CHECKIN_ENABLED=false`

## 21. Remaining blockers

1. Provision all production constructor addresses (token, Pons fee escrow, owner, entitlement signer, eligibility signer)
2. Prove eligibility signer separation with real public addresses
3. Implement/wire production `FeeCollector` + financial-reader factories (and writer key handling) so Room Service rounds run in the worker process
4. Provision RPC + DATABASE_URL + post-deploy RoomService address / exclusion seeds
5. Host/runtime manifest for worker (none in repo today)
6. Explicit future broadcast gate (this gate must not broadcast)

## 22. Confirmation

- No production broadcast
- No production DB mutation
- No production env mutation
- No feature enable (`HOTEL_CHECKIN_ENABLED` remains off by default)
- No secrets printed
