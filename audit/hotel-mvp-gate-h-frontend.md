# Gate H — Public HOTEL UI

**UTC timestamp:** `2026-09-18T23:08:41Z`  
**Gate:** H — Public HOTEL100 UI (reopened; visual implementation unchanged)  
**Spec reference:** frozen MVP §§7–8, 21–23; `design/hotel100/HOTEL100_FRONTEND_DESIGN_SPEC.md`  
**Design plan:** `audit/hotel100-frontend-design-implementation-plan.md` — **PASS — FRONTEND IMPLEMENTATION MAY BEGIN**  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| Pre-HEAD | `8bbb8c0b367a111521c3f555ac75ac69bf5d0217` |
| Final HEAD | `8bbb8c0b367a111521c3f555ac75ac69bf5d0217` (no commit made) |
| Working-tree state | Dirty — Gate H UI and this correction are uncommitted |

`HOTEL_LIVE` was not set. No production launch was performed.

---

## What this correction closed

The accepted façade is unchanged. Two production gaps are closed:

1. Production no longer paints 100 vacant rooms just because it had no public read. It calls `GET /api/hotel/state`.
2. `broadcastPreparedClaim => { broadcast: "none" }` is gone. A connected wallet can submit `claimRoomService` after an explicit confirmation. Tests mock that wallet. This session did not broadcast.

---

## Public API

**Route:** `GET /api/hotel/state`  
Optional query: `wallet` (lowercase `0x` + 40 hex). Invalid wallet returns `400`.  
Cache: `private, no-store`.  
Missing or blank `DATABASE_URL` returns `503` `{ error: "database_unconfigured" }`. There is no in-memory store and no fixture fallback.  
Production HTTP is rejected the same way as the entitlement routes. Read failures return `503` without a stack trace or connection string.

The handler is `handlePublicHotelState` in `apps/web/src/hotel/public-state.ts`. Ranking is only `rankEligibleHolders`, `roomAssignmentForRank`, and `findRankHundredHolder` from `@hotel100/domain`. Move-up amounts use `additionalNeededToBeatTarget` via the existing stay presenters. React does not rank and does not compute Room Service allocations.

Response fields used by the homepage:

- `lastIndexedBlock`, `lastIndexedAtMs`, `freshnessMs`, `syncing`, `publicStatus`
- rooms 1–100: room number, rank, lowercase wallet, raw HOTEL balance, checked-in since, best room ever, when those stay rows exist
- lobby ranks 101–108 (the queue the UI already shows)
- `room100ThresholdRaw` from the rank-100 holder
- connected-wallet stay when `wallet` is present and the index is current
- public activity, newest first, capped at `PUBLIC_ACTIVITY_LIMIT` (50)
- Room Service: `roomServiceDelayed`, `nextServiceBoundaryUnixSeconds`, `secondsUntilNextService`
- market price, cap, and liquidity stay null; token address is included only if `hotel_deployment.hotel_token_address` is set

### DB tables read

| Table | Use |
|------|-----|
| `system_state` | live flag, canary status, delayed/stuck flags, indexed block, indexed time |
| `holders` | positive raw balances |
| `excluded_addresses` | dropped before domain ranking, with canonical burn addresses |
| `guest_stays` | checked-in since, best room, not-checked-in |
| `room_history` | best room ever when a stay row does not have it |
| `guest_entitlements` | finalized cumulative earned, for the requested wallet only |
| `room_service_claims` | confirmed claims only (`tx_hash` is not null), subtracted from earned for display |
| `public_activity` | the seven public event classes, limit 50 |
| `hotel_deployment` | `hotel_token_address` only |

Not read, and not returned: `auth_nonces`, `operational_incidents`, `worker_write_audit`, signer keys, worker error text, failed claims, deployment notes.

Display claimable is indexed earned minus the highest confirmed claim cumulative. The signed entitlement still comes only from Gate G after wallet proof. Unconfirmed claim rows do not reduce the displayed amount.

### Freshness

If the hotel is not live, the API returns `HOTEL CHECK-IN OPENS SOON` and empty rooms even if holder rows exist.

If the hotel is live and any of the following is true, `syncing` is true, room and lobby occupants are omitted, the Room 100 threshold is null, and the connected stay is not served:

- `last_indexed_at` is null, or more than 30 seconds old (`PUBLIC_STALE_THRESHOLD_MS`)
- `last_indexed_block` is null
- `operational_status` is `INDEXING_GAP` or `HOTEL SYNCING`
- stored `public_status` is `HOTEL SYNCING`

The client then sets `lastIndexedAtMs` to null, so the existing header shows **HOTEL SYNCING** instead of stale occupancy. A missing database does the same fail-closed snapshot. It does not load fixture holders.

`collection_stuck` is presented only as Room Service delayed, and only when the index is current. Incident text is not exposed.

---

## Production claim path

`apps/web/src/hotel/claim.ts`.

Supported wallet surface, unchanged framework: EIP-1193 `window.ethereum`. That covers desktop extensions and mobile in-app browsers that inject this provider. Methods: `eth_requestAccounts`, `personal_sign`, `eth_chainId`, `wallet_switchEthereumChain`, `eth_estimateGas`, `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`. No WalletConnect, no relayer, no private key in frontend code.

Flow:

1. Zero claimable returns before any request. The button stays disabled.
2. Missing `ROOMSERVICE_ADDRESS` returns `unconfigured` and does not prompt the wallet. Production disables the button.
3. Gate G challenge and entitlement run only after that, using the connected account as the guest.
4. Chain must be Robinhood Chain `4663` (`0x1237`). Otherwise the wallet is asked to switch. If it is still wrong, nothing is sent.
5. `from` is the connected account. `to` is the configured Room Service address. Value is zero. Calldata is `claimRoomService(uint256,uint256,uint256,bytes)`, matching `RoomService.sol`. No delegated recipient.
6. `eth_estimateGas` simulates when the provider supports it; `eth_call` is the fallback. A revert is not submitted.
7. `eth_sendTransaction` is the explicit confirmation. The user pays gas.
8. The UI refreshes public state only after a success receipt. Claimable is not reduced locally before that. A wallet rejection (`4001`) changes only the note.

---

## Tests

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web test` | **PASS** — 33 tests |
| `pnpm exec biome check apps/web/src` | **PASS** |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `pnpm --filter @hotel100/web build` | **PASS** — route `ƒ /api/hotel/state` |
| Production broadcast | **NONE** |

`src/hotel-public-state.test.ts` (PGlite, no production credentials):

- canonical read of persisted holder balances through domain ranking
- Room #1 is the Penthouse; Rooms #2–#100 map to ranks 2–100
- lobby ranks 101–108 and the Room #100 threshold match `findRankHundredHolder` / `additionalNeededToBeatTarget`
- stale index and `INDEXING_GAP` return `HOTEL SYNCING` with no occupants
- public activity omits payload secrets, nonces, incidents, worker audit, deployment notes, and unconfirmed claims
- production JSON never contains the fixture wallet
- missing `DATABASE_URL` is `503`; the client snapshot is syncing, not fixture holders

`src/claim.test.ts` mocks the provider. Global `fetch` is asserted unused, so no RPC runs:

- claim uses the authenticated account as `from`
- calldata selector and args match `claimRoomService(uint256,uint256,uint256,bytes)`
- wrong chain prompts `wallet_switchEthereumChain` to `0x1237` and does not send
- absent Room Service address fails closed
- zero claimable does not call the provider or the entitlement API
- a mocked success receipt asks the UI to refresh and does not change claimable locally
- a rejected wallet transaction does not refresh and does not change claimable
- no 32-byte key in `claim.ts`

Viewport checks, layout unchanged, production path now shows syncing when the API is absent:

| Viewport | File | Result |
|----------|------|--------|
| 1440 | `audit/gate-h-screenshots/desktop-1440-production-sync.png` | `HOTEL SYNCING`, vacant, claim not offered |
| 1024 | `audit/gate-h-screenshots/tablet-1024-production-sync.png` | Same state, Room Service below the hotel |
| 390 | `audit/gate-h-screenshots/mobile-390-production-sync.png` | Stacked hotel, 11 columns, syncing banner |
| 1440 fixture | `audit/gate-h-screenshots/desktop-1440-fixture-recheck.png` | Accepted fixture hotel still renders, Room 47, `+31,440` |

Earlier accepted fixture screenshots remain in the same folder.

---

## Remaining fixture-only behavior

Still only `?preview=fixture`, and only when `NODE_ENV !== "production"` and `HOTEL_LIVE` is not true:

- occupied preview rooms, lobby, activity lines, and sample market figures
- connected preview guest, lobby guest, former guest (`?stay=lobby` / `?stay=former`)

`next build` / `next start` do not serve that preview. The production poll uses `/api/hotel/state` only.

---

## What a reviewer sees

At 1440px the page is still a hotel, not a dashboard. Room #1 is the Penthouse. Rooms #2–#100 are the fixed 11×9 façade. With no database, the banner is `HOTEL SYNCING` and every room is vacant because the index is not current, not because holders were invented. With a fresh live index, those rooms come from Postgres.

---

## Components

Unchanged visually: `HotelHeader`, `HotelOperationalState`, `YourStayPanel`, `HotelFacade`, `LobbyQueue`, `RoomServicePanel`, `LiveActivity`, `HotelMarketStrip`, `HotelApp`.

Checked-in since and best room render as `—` when the canonical row does not have them. That avoids inventing a stay time.

---

## Motion

Unchanged. `diffHotelMotion` still compares only the latest two snapshots. Reduced motion still removes the emphasis.

---

## Design deviations

- No photographic key fob or flanking trees. No separate image assets were provided.
- Market price, cap, and liquidity stay em dashes. Fixture market figures are preview-only.
- No third-party wallet kit. Connect and claim use the injected provider documented above.
- Live EOA bytecode filtering stays in the indexer. The public read drops `excluded_addresses` and burn addresses, then ranks with the domain function. It does not call `eth_getCode`.

No frozen financial rule was bent.

---

## Unresolved production inputs

- `HOTEL_LIVE` remains unset / false
- `DATABASE_URL`, `ROOMSERVICE_ADDRESS`, token address, RPC, domain, and entitlement signer stay empty until configured
- market price source is still absent

Absent database or Room Service address fails closed. Neither was invented.

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**
- Production broadcasts performed: **NONE**
- Production claim signatures performed: **NONE**
- Gate I **not started**

---

## Next recommended action

Proceed to **Gate I — Deployment + prediction + HoodLock tooling** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
