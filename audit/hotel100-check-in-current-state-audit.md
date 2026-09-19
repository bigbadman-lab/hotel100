# HOTEL100 Check-In Feature — Current State Audit

## 1. Verdict

**PASS — CURRENT STATE MAPPED; READY FOR CHECK-IN RULE LOCK**

---

## 2. Audit metadata

| Field | Value |
|------|--------|
| UTC timestamp | `2026-09-19T15:03:28Z` |
| Repo root | `/Users/alexattinger/Desktop/hotel100` |
| Branch | `main` |
| HEAD SHA | `e3c049fbf6dd1f697ae4e4befbaee9e2c65240d6` (`feat: port approved HOTEL100 production UI`) |
| `git status --short` | *(empty — clean working tree)* |
| Package manager | `pnpm@10.30.3` (workspace: `apps/*`, `packages/*`, `scripts`) |
| Frontend | Next.js 15 App Router (`apps/web`), React 19 |
| Worker | Node/tsx (`apps/worker`) — indexer + Room Service pipeline (loop **not** auto-started) |
| Contracts | Foundry, Solidity **0.8.28** (`contracts/`) |
| Database | Postgres / Supabase migrations under `supabase/migrations/` |
| Domain | `@hotel100/domain` (`packages/domain`) |
| Config | `@hotel100/config` (`packages/config`) |
| DB helpers | `@hotel100/db` (`packages/db`) |

**Confirmations**

- No implementation changes were made by this audit (only this report file created).
- No production broadcasts were performed.
- No commits or pushes were made by this audit.
- No secrets were printed (env **names** only).
- Audit performed against HEAD `e3c049f` with a clean working tree.

---

## 3. Executive architecture summary

Today HOTEL100 works as:

```text
ERC-20 Transfer logs (chain)
  → worker indexer → holders.balance_raw (Postgres)
  → filter burns + excluded_addresses (+ EOA eth_getCode on worker path)
  → rankEligibleHolders (balance DESC, address ASC)
  → roomAssignmentForRank (#1 Penthouse, #2–#100 rooms, #101+ Lobby)
  → GET /api/hotel/state → HotelApp poll (2s) → HotelView façade / Your Stay
```

Room Service is a **separate ETH claim path**:

```text
Pons creator fees → Pons Fee Escrow → RoomService.collectRoomService()
  → worker finalizes 15-min UTC rounds → guest_entitlements (cumulative wei)
  → guest EIP-712 entitlement → RoomService.claimRoomService()
```

**There is no on-chain HOTEL check-in / escrow / lock today.**  
“Checked in” in the UI means **ranking into rooms 1–100** (wallet HOTEL balance), not depositing into `RoomService.sol`.

`RoomService.sol` holds **ETH** for claims; it must not become a Top 100 HOTEL holder. Worker exclusions + EOA filters already aim to keep protocol contracts out of ranking; public API relies on `excluded_addresses` (weaker than worker EOA gate).

---

## 4. Architecture / file map

| Concern | Path | Responsibility | Key exports / symbols | Upstream | Downstream |
|---------|------|----------------|----------------------|----------|------------|
| Page shell | `apps/web/src/app/page.tsx` | Mode/live/scenario → `HotelApp` | `HomePage` | env, config | HotelApp |
| Orchestrator | `apps/web/src/hotel/HotelApp.tsx` | Poll, wallet override, claim, motion | `HotelApp` | production-client, claim, present | HotelView |
| UI components | `apps/web/src/hotel/components/HotelView.tsx` | Header, Your Stay, façade, Room Service, activity, market, lobby | `HotelHeader`, `YourStayPanel`, `HotelFacade`, `RoomServicePanel`, `LiveActivity`, `HotelMarketStrip`, `LobbySheet`, `SelectedRoomFoot` | types, format | HotelApp |
| Icons | `apps/web/src/hotel/components/icons.tsx` | Lovable SVG icons | Bell, Clock, etc. | — | HotelView |
| Presenters | `apps/web/src/hotel/present.ts` | Header status, stay views, service panel state | `presentHeaderStatus`, `presentCheckedInStay`, `presentLobbyStay`, `roomServicePanelState`, `connectedRoom` | `@hotel100/domain` | HotelApp, public-state |
| Public API | `apps/web/src/hotel/public-state.ts` | Canonical hotel DTO from DB | `handlePublicHotelState`, `readCanonicalHotelState` | domain ranking, SQL | `/api/hotel/state` |
| Route | `apps/web/src/app/api/hotel/state/route.ts` | HTTP entry | GET handler | public-state | browser |
| Client fetch | `apps/web/src/hotel/production-client.ts` | Fail-closed production snapshot | `fetchProductionSnapshot`, `failClosedProductionSnapshot` | public DTO | HotelApp |
| Claim | `apps/web/src/hotel/claim.ts` | Challenge → sign → simulate → send → receipt | `prepareRoomServiceClaim`, `executeRoomServiceClaim`, `claimUiAfterSubmit` | entitlement APIs | HotelApp |
| Entitlement | `apps/web/src/entitlement/*` | Nonces, EIP-712 sign, rate limits | challenge/entitlement handlers | DB, signer | claim UI |
| Domain ranking | `packages/domain/src/ranking.ts` | Sort + room map | `rankEligibleHolders`, `roomAssignmentForRank`, `findRankHundredHolder` | address, constants | web, worker |
| Domain finance | `packages/domain/src/financial.ts` | Pro-rata floor | `proRataAllocationWei` | — | worker allocate |
| Domain time | `packages/domain/src/service-time.ts` | 900s UTC boundaries | `nextServiceBoundary…`, `isExactServiceBoundary` | constants | web present, worker |
| Constants | `packages/domain/src/constants.ts` | Rooms, intervals, chain, HoodLock mins | `HOTEL_ROOM_COUNT`, `ROOM_SERVICE_INTERVAL_SECONDS`, `ROOM_POLL_INTERVAL_MS`, `HOTEL_CHAIN_ID` | — | everywhere |
| Indexer | `apps/worker/src/indexer/*` | Transfers → balances, reorg, exclusions | `HotelIndexer`, `buildExclusionSet`, `filterEligibleHolders` | RPC, Postgres | holders table |
| RS worker | `apps/worker/src/room-service/*` | Collect, snapshot, allocate, finalize | `RoomServiceWorker`, `allocateServicePool` | domain, chain, SQL | entitlements |
| Worker entry | `apps/worker/src/index.ts` | Boot (idle / no auto-loop) | `main` | config | — |
| Contract | `contracts/src/RoomService.sol` | ETH collect + cumulative claim | `claimRoomService`, `collectRoomService` | OZ Ownable2Step, EIP712 | worker, web |
| Schema | `supabase/migrations/20260918210700_hotel_core_schema.sql` | Core tables | SQL | — | web/worker |
| Finalize RPC | `supabase/migrations/20260918210701_finalize_room_service_round.sql` | Atomic round write | `finalize_room_service_round` | — | worker |
| Config | `packages/config` | Env parse / validate | `hotelConfigFromEnv` | `.env` | web, worker |
| Styles | `apps/web/src/app/globals.css` | Gate H Lovable CSS (canonical UI) | — | — | page |

---

## 5. Top 100 / room ownership findings

### “Wallet X occupies Room Y” — data flow

1. **Source of balances:** Indexed ERC-20 `Transfer` events on `HOTEL_TOKEN_ADDRESS` from `HOTEL_LAUNCH_BLOCK`, applied in `apps/worker/src/indexer/balances.ts` → persisted in `holders.balance_raw`.
2. **Not** live `balanceOf` RPC for the public hotel page. Public API reads `holders` only.
3. **What counts:** Positive `balance_raw` after exclusions. Ranking uses **wallet-held HOTEL only** (no escrowed/checked-in balance concept).
4. **Exclusions**
   - Always: `BURN_ADDRESSES` (`0x0…0`, `0x…dead`) in domain constants.
   - Worker: `buildExclusionSet` also adds configured `roomServiceAddress`, `hoodLockAddress`, Pons factory/router/fee escrow, `HOTEL_MANUAL_EXCLUSIONS`.
   - Worker eligibility: `eth_getCode(address, snapshotBlock)` must be empty (EOA).
   - Public API: burns ∪ rows in `excluded_addresses` only — **no** `eth_getCode` on the read path.
5. **LPs / contracts / treasury:** Not specially named beyond exclusion set + EOA filter on worker. Contracts fail EOA check on worker path; public path depends on `excluded_addresses` seed.
6. **Ties:** Deterministic — `balanceRaw` DESC, then **numeric address ASC** (`compareHoldersForRanking` in `packages/domain/src/ranking.ts`).
7. **Rooms #1–#100:** `roomAssignmentForRank(rank)` — rank N → room N for 1–100; rank ≥101 → lobby. Penthouse is **rank/room 1** (presentation + assignment; same mapping function).
8. **Lose/change room:** When indexed balances change and re-rank moves the wallet. Stay metadata (`guest_stays`) is separate and under-written.
9. **UI freshness:** `ROOM_POLL_INTERVAL_MS = 2000`. Indexer freshness gate: `PUBLIC_STALE_THRESHOLD_MS = 30000` → withhold occupancy / `HOTEL SYNCING`.
10. **Persisted vs derived:** Current occupancy is **dynamically derived** from ranked balances. `guest_stays` / `room_history` store timestamps / best room / history — not the live leaderboard.
11. **Caching:** API responds `private, no-store`. Client polls; no long-lived occupancy cache beyond React state.
12. **Economic ownership separate from wallet balance?** **No.** Only `holders.balance_raw`.
13. **If HOTEL moved into an escrow contract today:** Wallet balance drops → rank falls / room lost. Escrow contract would appear in `holders` if it receives transfers; worker would exclude it if configured + non-EOA; public API ranks it unless present in `excluded_addresses`.
14. **Code that must understand escrowed balances later:**  
    `rankEligibleHolders` inputs (or a pre-aggregation that adds escrowed HOTEL per guest), worker `filterEligibleHolders` / snapshot rebuild, `allocateServicePool` balances, public `readRankedHolders`, and exclusion of the escrow contract address (already intended via `roomServiceAddress` / protocol exclusions).

---

## 6. Room Service findings

### Contract: **exists**

| Item | Detail |
|------|--------|
| Path | `contracts/src/RoomService.sol` |
| Solidity | `^0.8.28` |
| Inheritance | `Ownable2Step`, `EIP712("RoomService","1")`, `ReentrancyGuard`, `Pausable` |
| Immutables | `hotelToken`, `ponsFeeEscrow` |
| Storage | `entitlementSigner`, `signerEpoch`, `roomServiceClaimed`, `totalRoomServiceClaimed` |
| External | `claimRoomService(cumulative, deadline, epoch, signature)`, `collectRoomService()`, `pauseClaims` / `unpauseClaims`, `rotateEntitlementSigner`, `DOMAIN_SEPARATOR` |
| Access | Claims when not paused; collect permissionless; owner pause/signer; `renounceOwnership` disabled |
| Assets | **ETH** in / out for claims; HOTEL address stored but **not** escrowed for stays |
| Events | `RoomServiceClaimed`, `RoomServiceCollected`, `EntitlementSignerRotated` |
| Upgradeability | **None** (non-proxy) |
| Tests | `contracts/test/RoomService.t.sol`, `BootstrapSanity.t.sol` |
| Deploy scripts | Placeholder only (`contracts/script/ScriptPlaceholder.sol`) — no production broadcast helpers |

**No** HOTEL deposit / check-in / checkout / multiplier in the contract.

### Distribution economics (worker + domain)

| Question | Current answer |
|----------|----------------|
| Assets distributed | **ETH** (creator fees via Pons Fee Escrow) |
| Funding | Pons fee escrow → `collectRoomService()` |
| Incoming recognition | Escrow `balanceOf(RoomService)` + `claim()`; then contract ETH balance − already claimed |
| Push vs claim | Worker **finalizes entitlements** (DB cumulative); guests **claim** on-chain |
| Interval | **900 seconds** UTC (`ROOM_SERVICE_INTERVAL_SECONDS`) |
| Snapshot | Financial block ≤ boundary with confirmations (`selectFinancialSnapshotBlock`) |
| Eligible population | Top ≤100 ranked eligible EOAs at snapshot (balances reconstructed ≤ snapshot) |
| Balance source | Indexed transfers rebuild at snapshot block |
| Share | `floor(pool * guestBalance / totalEligible)`; dust unassigned |
| Duplicate payouts | Cumulative claim invariant + DB finalize advisory lock / round uniqueness |
| No rewards / empty pool | Allocations zero; claim path “nothing claimable” |
| Fewer than 100 holders | Allocate over however many ranks 1…N ≤ 100 |
| Boundary balance change | Snapshot block freezes eligibility for that service number |
| Production deps | RPC, DB, RoomService + Pons escrow addresses, worker writer key, entitlement signer, `HOTEL_LIVE` / open params |

### Worker run (intended)

1. Trigger: designed around `WORKER_POLL_INTERVAL_MS` / service schedule — **`apps/worker/src/index.ts` currently does not auto-start the loop** (“Loop not auto-started. No production broadcast.”).
2. Entrypoint when run: `RoomServiceWorker` in `apps/worker/src/room-service/pipeline.ts`.
3. Due services: `dueServiceNumbers` (catch-up capped by `SERVICE_CATCHUP_MAX`).
4. Collect fees (simulate → broadcast → receipt).
5. Snapshot balances → filter → rank → `allocateServicePool`.
6. `finalize_room_service_round` SQL: rounds, allocations, cumulative `guest_entitlements`, activity.
7. Idempotency: service number uniqueness + finalize RPC.
8. Failures: delayed / collection_stuck flags on `system_state` (operational).

**Weighting today:** pure balance pro-rata — **no** 1.0x / 1.5x tiers. Any check-in boost would change `allocateServicePool` / snapshot guest weights.

---

## 7. Contract readiness (Phase F)

| Item | Status |
|------|--------|
| Directory | `contracts/` Foundry |
| solc | 0.8.28 |
| Tests | Forge (`pnpm test:contracts`) |
| Deploy | Placeholder; addresses via env (`ROOMSERVICE_ADDRESS`, etc.) — **do not invent** |
| ABI in web | **Inline** fragments in `claim.ts` / entitlement chain helpers (not auto-synced from `out/`) |
| Chain | Robinhood Chain **4663** (`HOTEL_CHAIN_ID`) |
| Related config names | `HOTEL_TOKEN_ADDRESS`, `PONS_*`, `HOODLOCK_*`, `ROOMSERVICE_*`, role EOAs |
| HoodLock | Config + domain constants (`HOODLOCK_MIN_DURATION_SECONDS = 604800`) — **no HoodLock contract in `contracts/src`** |
| Safety gates | Worker idle without RPC/DB/addresses; claim simulates before send; entitlement rate limits |

Adding check-in escrow likely means **extending `RoomService.sol` or a sibling contract**, regenerating/updating inline ABIs, env address validation, and Foundry tests — deployment still gated by existing launch process.

---

## 8. Data / indexer findings

### Relevant tables

`holders`, `excluded_addresses`, `processed_transfer_logs`, `system_state`, `hotel_deployment`, `guest_stays`, `room_history`, `room_move_events`, `guest_entitlements`, `room_service_claims`, `service_rounds`, `service_allocations`, `public_activity`, `auth_nonces`, entitlement rate limits.

### Natural ingestion for future `CheckedIn` / `StayExtended` / `CheckedOut`

| Future event | Natural sinks |
|--------------|---------------|
| CheckedIn | Indexer/event handler → `guest_stays` activate, `room_history` open, `room_move_events` + `public_activity` (`check-in` class already exists) |
| StayExtended | Update unlock timestamp / escrow amount columns (**new columns needed**) + optional activity |
| CheckedOut | Close stay/history; `stay-end` move + activity |

**Gap:** Worker today only partially writes stay history (`room_move_events` via post-open sync). `guest_stays` / `room_history` / `public_activity` check-in rows are **schema-ready, under-written**. On-chain check-in events do not exist yet — would be a new log type processed like transfers.

---

## 9. Frontend integration findings

Canonical UI after Gate H Lovable port (`HotelView` + `globals.css`). **Do not redesign.**

| Future UI need | Own in | Already available? | Needs new API/field? |
|----------------|--------|--------------------|----------------------|
| Eligible to check in | `YourStayPanel` (`checked_in` / room occupant) | Rank/room known | Escrow eligibility rules |
| CHECK IN CTA | `YourStayPanel` (beside `.hotel-movement`) | Wallet connect + claim UX patterns | Tx builders + API |
| Locked amount / boost | `YourStayPanel` facts / movement | Claimable ETH pattern | Escrow balance, multiplier |
| Lock / unlock countdown | `HotelHeader` clock **or** Your Stay facts | Service countdown pattern | Unlock timestamp |
| CHECK OUT CTA | `YourStayPanel` when unlocked | — | Checkout tx + state |
| Hotel-level % checked in | Optional strip below façade / market — **avoid hero clutter** | — | Aggregate from API |
| Activity | `LiveActivity` | Kinds include check-in / stay-end icons | Bridge indexer → `public_activity` |

**Polling:** `ROOM_POLL_INTERVAL_MS = 2000` already.  
**Loading/errors:** Fail-closed snapshot + claim notes.  
**Reuse for txs:** EIP-1193 flow in `claim.ts` (chain 4663, simulate, send, receipt, refresh-after-confirm).

Selected-room foot (`SelectedRoomFoot`) should stay **read-only**; CTAs belong in Your Stay / Room Service panels.

---

## 10. Existing tests / gaps

| Suite | Protects |
|-------|----------|
| `packages/domain/src/index.test.ts` | Ranking, ties, rooms, pro-rata, service time, constants |
| `apps/web/src/hotel.test.tsx` | Façade geometry, sync/pre-live presenters, claim prepare |
| `apps/web/src/hotel-public-state.test.ts` | Canonical API ranking/lobby/stale/fixture exclusion |
| `apps/web/src/claim.test.ts` | 4663, simulate/send/receipt semantics (mocked) |
| `apps/web/src/entitlement.test.ts` | Nonces, EIP-712, rate limits |
| `apps/worker/src/indexer.test.ts` | Transfers, reorg, EOA, exclusions |
| `apps/worker/src/room-service.test.ts` | Snapshot/allocate/finalize behaviour |
| `contracts/test/RoomService.t.sol` | Claim/collect/pause |
| `packages/db/src/gate-d.test.ts` | Schema + finalize RPC |

**Gaps for check-in:** no escrow contract tests; no ranking-with-escrow tests; no guest_stays writer tests; no UI CTA tests; no HoodLock integration tests; public API vs worker EOA discrepancy not regression-tested as a first-class case.

---

## 11. Check-In impact matrix

| Area | Current implementation | Would check-in affect it? | Why | Likely future change |
|------|------------------------|---------------------------|-----|----------------------|
| HOTEL token contract | External ERC-20 | Indirect | Transfers into escrow | Possibly `approve` + transferFrom UX |
| RoomService contract | ETH fee collect + claim | **Yes** | Natural escrow / weight host | Deposit/lock/checkout (+ events) or sibling vault |
| Holder ranking | Wallet `balance_raw` only | **Yes** | Escrow would otherwise drop rank | Count escrowed HOTEL toward guest, exclude vault |
| Top 100 selection | `rankEligibleHolders` | **Yes** | Same | Weighted or dual-balance eligibility |
| Room assignment | Derived from rank | **Yes** | Occupancy follows ranking | Same function if balances adjusted upstream |
| Reward maths | Pure pro-rata by balance | **Yes** | 1.0x / 1.5x hypothesis | Weighted balances in `allocateServicePool` |
| Reward worker | Snapshot → allocate → finalize | **Yes** | Must see escrowed amounts at snapshot | Snapshot joins escrow state |
| Indexer | HOTEL transfers | **Yes** | Escrow transfers + future events | Event ingest + maybe balance attribution |
| Database | holders + stays + entitlements | **Yes** | Lock metadata | Tables/columns for lock amount/unlock |
| Frontend room state | Ranking stay kinds | **Yes** | CTAs / countdown | YourStayPanel + API fields |
| Wallet tx UX | Claim path only | **Yes** | Check-in/out txs | Reuse claim simulate/receipt pattern |
| Cron/scheduler | Worker loop not auto-started | Maybe | Ops maturity | Ensure RS + escrow maintenance scheduled |
| Tests | No escrow coverage | **Yes** | New behaviour | Domain + contract + API + UI tests |
| Deployment config | Env addresses | **Yes** | New/updated address | `ROOMSERVICE_*` / vault env + exclusions |

---

## 12. Rule-lock questions

Smallest useful set before implementation (repo does **not** lock these):

1. **Ranking:** Does room rank use `wallet HOTEL + escrowed HOTEL` for the guest, while excluding the escrow contract from ranking? (Code strongly suggests this **must** be true or rooms empty on check-in.)
2. **Eligibility:** Can only current Top 100 check in, or any positive holder?
3. **Rank change during lock:** If wallet+escrow falls out of Top 100 mid-stay, do they keep the boost, lose the room, force checkout, or stay locked without a room?
4. **Partial check-in / top-up / extend:** Allowed or single fixed deposit per stay?
5. **Multiplier:** Exact weight (e.g. 1.5x on escrowed only); do non-checked-in top-100 still earn 1.0x?
6. **Snapshot:** At service boundary, is weight based on escrow state at snapshot block, and how are mid-interval check-ins treated?
7. **Checkout:** Only after min lock (product said 1h; HoodLock config is **7 days** — different product?); no early exit?
8. **Emergency withdrawal:** Owner rescue of escrowed HOTEL? (Current RoomService has no token rescue path for guests’ HOTEL because none is held.)
9. **Public API EOA gap:** Will escrow/protocol addresses be **required** in `excluded_addresses` so public ranking cannot list the vault?
10. **Worker runtime:** Is production worker loop start a prerequisite before shipping check-in economics?

---

## 13. Risks / blockers (code-backed)

1. **Check-in without ranking attribution** would immediately eject users from rooms (balance leaves wallet).
2. **Public ranking lacks `eth_getCode`** — escrow/RoomService must be in `excluded_addresses` or it can appear as a holder on the website.
3. **`RoomService.sol` has no HOTEL escrow** — feature needs contract work, not config alone.
4. **Stay tables under-written** — Live Activity / checked-in duration may stay empty until writers exist.
5. **Worker loop not auto-started** — distribution/ops not fully “on” in `index.ts` as checked in.
6. **HoodLock vs 1h lock** — config encodes week-scale HoodLock; product 1h check-in may be a **different** mechanism; do not conflate without a rule lock.
7. **Inline ABIs** — easy to drift when extending RoomService.

None of these block **rule lock**; they block **safe implementation** until answers + design exist.

---

## 14. Recommended implementation sequence (high-level only)

1. Lock product rules (§12), especially ranking attribution + multiplier + lock duration.  
2. Spec contract escrow + events; Foundry tests; exclusion of vault address.  
3. Domain: weighted eligibility / allocation helpers (pure).  
4. Indexer/API: attribute escrowed balances; expose lock fields on stay DTO.  
5. Worker snapshot uses weighted balances; stay writers for activity.  
6. Frontend: Your Stay CTAs + countdown using existing claim UX patterns — **no visual redesign**.  
7. Tests across domain → contract → API → UI; then ops (worker loop, exclusions seed).

---

## 15. Files changed by this audit

Exactly:

`audit/hotel100-check-in-current-state-audit.md`

---

## Validation

| Check | Result |
|-------|--------|
| `git status --short` after report | Only this new audit file untracked (pre-audit tree was clean) |
| Implementation edits | None |
| Commits / pushes | None |
| Deployments / broadcasts | None |
| Secrets printed | None |
| Side-effecting commands | Skipped (no forge test / DB mutate / live RPC required); exploration was static file reads + `git` / `ls` / masked `.env.example` |
