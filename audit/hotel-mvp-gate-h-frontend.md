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

Unchanged outside the building: `HotelHeader`, `HotelOperationalState`, `YourStayPanel`, `LobbyQueue`, `RoomServicePanel`, `LiveActivity`, `HotelMarketStrip`.

`HotelFacade`, the penthouse, standard rooms, the entrance, and `SelectedRoomSummary` were restyled in the façade refactor below. Checked-in since and best room still render as `—` when the canonical row does not have them.

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

## Façade Refactor

Targeted visual pass only. Backend, ranking, API contracts, Room Service economics, wallet flow, and page layout were not changed. Room #1 stays the Penthouse. Rooms #2–#100 stay a fixed 11×9 grid in DOM order.

### Files changed

- `apps/web/src/hotel/components/HotelView.tsx` — façade, penthouse, room windows, entrance, selected-room summary markup
- `apps/web/src/app/globals.css` — elevation, windows, entrance, reduced-motion, 1024/390 façade rules
- `apps/web/src/hotel.test.tsx` — asserts vacant rooms no longer stamp `VAC` on the façade

### Visual changes

- Standard rooms are recessed four-pane windows in a continuous stone wall: stone mullions, dark green glazing, a small room number on the sill. No wallet text in a room.
- `VAC` is gone from the façade. Vacant windows are unlit. Occupied windows are warmer and brighter, not a strong glow. `VACANT` remains only in the selected-room summary and other copy outside the elevation.
- The connected guest’s room keeps a muted-gold frame and a slightly warmer interior. Selection is a cream outline on the window, with the existing summary below the building.
- The Penthouse is the top floor under a parapet and dentil cornice: wider three-light suite, `PENTHOUSE`, `01`, shortened wallet, and HOTEL balance. No reward multiplier.
- Side pilasters, floor joints, and a stone plinth tie the roof, suite, window wall, and entrance into one elevation.
- The entrance is centred in the wall: engraved `HOTEL100`, dark double doors, sitting above the lobby panel. It is not a room.

### Responsive impact

- 1440: the elevation is the centrepiece. Windows read as glazing, Room 47 is the gold window, rooms 96–100 are dark.
- 1024: the same building stays intact; Room Service remains below the hotel.
- 390: the full 11×9 façade stacks with the rest of the page. No list fallback. Room numbers stay on the sills; the selected-room summary carries the full detail. No page-level horizontal scroll (`overflow-x: hidden` on `body`, grid columns `minmax(0, 1fr)`).

### Tests / checks

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web test` | **PASS** — 33 tests |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `pnpm exec biome check apps/web/src` | **PASS** |
| `pnpm --filter @hotel100/web build` | **PASS** |
| Production broadcasts | **NONE** |

### Screenshots

| Viewport | Path |
|----------|------|
| 1440 | `audit/gate-h-screenshots/facade-1440.png` |
| 1024 | `audit/gate-h-screenshots/facade-1024.png` |
| 390 | `audit/gate-h-screenshots/facade-390.png` |

Fixture preview, so occupied and vacant windows are both visible. Not production data.

### Design deviations

- Mullions are a simple four-pane cross, not moulded joinery.
- The cornice is a CSS parapet and dentil strip, not a modelled roof.
- On a 390px window the panes are small; the room number and the selected-room summary are the readable labels.

---

## Room Number Clarity Pass

Targeted visual pass only. The façade refactor stays. Backend logic, API behavior, ranking, wallet flow, room mapping, and page layout were not changed. Room #1 stays the Penthouse. Rooms #2–#100 stay a fixed 11×9 grid in DOM order. `VAC` stays off the façade. No production broadcast.

### Files changed

- `apps/web/src/hotel/components/HotelView.tsx` — Penthouse identity and the per-window plaque
- `apps/web/src/app/globals.css` — plaque, number, and Penthouse room-number styles, including the 820px and 520px sizes

### Exact room-number treatment

Each standard room is a column: recessed four-pane glazing, then a dedicated plaque directly beneath it. The plaque is the full width of that window, centred, with a 3px gap so the number never overlaps the glass.

- Background: recessed stone, `linear-gradient(180deg, #4a3f30, #2c261c)`, inset shadow
- Number: cream `#f4ecd8`, IBM Plex Mono, weight 500, centred
- Format: `padStart(2, "0")` — `02` … `99`, and `100`
- Desktop and 1024: 12px, letter-spacing `0.04em`, plaque min-height 14px
- Connected guest only: the number uses muted gold `#f0c877`, and that plaque alone gets a 1px gold inset. The gold window frame and warmer interior are unchanged
- Selected room: cream outline on the glazing only. Detail stays in the selected-room summary. No tooltip
- Vacant and occupied rooms use the same plaque. Readability does not depend on occupancy

Gold is not used on every room.

### Penthouse number treatment

`PENTHOUSE` stays centred above the three-light suite. Directly under that glass, a matching dark plaque reads `ROOM` (8px mono, stone `#d7c7a6`) and `01` (15px Newsreader, cream `#f4ecd8`). `01` is the room number, not a decorative counter. If the connected guest holds the Penthouse, `01` uses the same muted gold as the connected standard room. The shortened wallet and HOTEL balance stay below that plaque.

### Responsive behavior

- 1440: 12px cream numbers on dark plaques, immediately readable. Penthouse plaque reads `ROOM 01`. Measured `scrollWidth` equals `clientWidth` (1440). Glazing-to-plaque gap is 3px. Room `100` does not overflow its plaque.
- 1024: same plaque treatment and 12px type. `scrollWidth` equals `clientWidth` (1024).
- 390: plaques stay. Padding and type step down rather than hiding numbers: plaque min-height 11px, numbers 8px, letter-spacing 0, Penthouse `01` at 12px. Room `100` does not overflow its plaque. No overlap. `scrollWidth` equals `clientWidth` (390). No page-level horizontal scroll.

### Screenshots

Fixture preview (`?preview=fixture`), so occupied and vacant rooms are both visible. Not production data.

| Viewport | Path |
|----------|------|
| 1440 | `audit/gate-h-screenshots/numbers-1440.png` |
| 1024 | `audit/gate-h-screenshots/numbers-1024.png` |
| 390 | `audit/gate-h-screenshots/numbers-390.png` |

### Tests / checks

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web test` | **PASS** — 33 tests |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `pnpm exec biome check apps/web/src` | **PASS** |
| `pnpm --filter @hotel100/web build` | **PASS** |
| Production broadcasts | **NONE** |

---

## Logo asset preparation

Canonical logo path: `apps/web/public/brand/hotel100-logo.png` (public URL `/brand/hotel100-logo.png`).

The PNG is supplied manually by the human operator. No image was generated or substituted. `.gitignore` does not exclude that path. `apps/web/public/brand/.gitkeep` keeps the empty directory until the file is copied.

The header still showed the temporary bell mark and the `HOTEL100` wordmark at the end of this step. The following section replaces that mark.

Production broadcasts: **NONE**

---

## Header Logo Integration

The supplied PNG is now the header mark. The temporary bell icon is gone. Backend, ranking, wallet, façade, Room Service, activity, and market data were not changed.

### Asset path

`apps/web/public/brand/hotel100-logo.png` served as `/brand/hotel100-logo.png`. Intrinsic size 2172×724. The file was not regenerated, recolored, cropped, or substituted.

### Files changed

- `apps/web/src/hotel/components/HotelView.tsx` — header uses `next/image` for the logo
- `apps/web/src/app/globals.css` — logo size only; the bell frame styles are removed

### Rendered treatment

The logo sits immediately left of the existing `HOTEL100` wordmark, with the tagline, live/sync state, service countdown, and wallet button unchanged. No border, shadow, glow, or background card was added. The image keeps its 3:1 ratio.

Because the wordmark already says HOTEL100, the image is decorative: `alt=""` and `aria-hidden="true"`. It is not announced as a second “HOTEL100 logo”.

### Final rendered dimensions

| Viewport | Rendered size |
|----------|----------------|
| 1440 | 108×36 px |
| 390 | 90×30 px |

Desktop height is 36px, inside the 32–38px range. Mobile height is 30px, inside the 28–32px range. Measured ratio is 3.000, so it is not stretched. Gap to the wordmark is the existing 12px brand gap.

### Responsive behavior

Above 820px the logo is 36px tall. At 820px and below, including 390px, it is 30px tall. Width follows the asset ratio.

### Screenshot

`audit/gate-h-screenshots/header-1440.png`

### Tests / checks

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web test` | **PASS** — 33 tests |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `pnpm exec biome check apps/web/src` | **PASS** |
| `pnpm --filter @hotel100/web build` | **PASS** |
| Production broadcasts | **NONE** |

---

## Next recommended action

Proceed to **Gate I — Deployment + prediction + HoodLock tooling** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
