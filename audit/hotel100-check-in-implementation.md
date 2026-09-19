# HOTEL100 Check-In Implementation

## 1. Verdict

`PASS — CHECK-IN IMPLEMENTED; READY FOR DEPLOYMENT / PRODUCTION GATE`

Simulation and local tests only. No production broadcast, no production env mutation, no push.

## 2. UTC timestamp

- Preflight: `2026-09-19T15:36:47Z`
- Final: `2026-09-19T15:58:27Z`

## 3. Branch / pre-HEAD / final HEAD

- Branch: `main`
- Pre-HEAD: `e3c049fbf6dd1f697ae4e4befbaee9e2c65240d6`
- Final HEAD: `e3c049fbf6dd1f697ae4e4befbaee9e2c65240d6` (uncommitted implementation)

## 4. Pre-existing git state

```
?? audit/hotel100-check-in-current-state-audit.md
```

Unrelated work preserved. Gate H UI structure/CSS not redesigned; check-in controls added inside `YourStayPanel` / operational metric only.

## 5. Files changed

### Created

- `packages/domain/src/check-in.ts`
- `contracts/test/RoomServiceCheckIn.t.sol`
- `contracts/test/mocks/MockHotelToken.sol`
- `supabase/migrations/20260919164000_check_in_escrow.sql`
- `apps/worker/src/check-in/*`
- `apps/web/src/check-in/*`
- `apps/web/src/app/api/check-in/challenge/route.ts`
- `apps/web/src/app/api/check-in/authorize/route.ts`
- `apps/web/src/hotel/check-in-tx.ts`
- `apps/web/src/check-in.test.ts`
- `audit/hotel100-check-in-implementation.md`

### Modified (high level)

- `contracts/src/RoomService.sol` + claim tests constructor
- `packages/domain` constants/exports/tests
- `packages/config` (`HOTEL_CHECKIN_ENABLED`, eligibility signer)
- `apps/worker` indexer, ranking, Room Service allocation/pipeline, RPC check-in logs
- `apps/web` public state/DTO, YourStayPanel, HotelApp, page, globals CSS
- `.env.example`

## 6. Contract changes

Extended `RoomService.sol` with:

- HOTEL escrow stays (`amount`, `checkInTimestamp`, `unlockTimestamp`)
- `CHECK_IN_DURATION = 3600` (immutable)
- Separate `eligibilitySigner` + `eligibilitySignerEpoch`
- EIP-712 `CheckInAuthorization` (guest, min/max, deadline, nonce, epoch)
- `checkIn` / `checkOut` (checkout cannot be paused)
- `pauseCheckIns` / `unpauseCheckIns` (new check-ins only)
- `recoverSurplusHotel` constrained by `totalGuestEscrowLiability`
- Events: `CheckedIn`, `CheckedOut`, `EligibilitySignerRotated`, `CheckInsPaused`/`Unpaused`, `SurplusHotelRecovered`
- Constructor now requires eligibility signer (5th arg)

## 7. Domain/ranking changes

- `effectiveHotelBalance`, `checkInMinimum` (10% ceil), `rewardWeight` (1.5x active via bps), stay phase helpers
- `holdersWithEffectiveEscrowBalance` + `escrowCoherentWithRoomServiceBalance`
- Ranking still balance DESC + address ASC; callers pass effective balance

## 8. Indexer/database changes

- Migration: `check_in_events` + `check_in_positions` (no room number as escrow state)
- Worker ingests `CheckedIn` / `CheckedOut` idempotently
- Direct HOTEL transfers to RoomService are not attributed
- Coherence fail-closed when unwithdrawn escrow exceeds RoomService HOTEL balance

## 9. Reward worker changes

- Snapshot uses `rewardWeight()` (active escrow 1.5x; expired unwithdrawn 1.0x; non-Top100 0)
- `allocateServicePool` pro-rata on reward weight
- Historical reconstruction via escrow open-at-block helpers

## 10. Eligibility auth changes

- `/api/check-in/challenge` + `/api/check-in/authorize`
- Ownership SIWE-style challenge → Top 100 by effective balance → EOA → no open stay
- `minAmount = 10% effective`, `maxAmount = walletHeld`, 2-minute EIP-712 auth
- Dedicated eligibility signer key (forbidden to equal entitlement/deployer/worker)

## 11. Public API changes

- Effective-balance ranking + RoomService exclusion
- Connected `checkIn` DTO fields + `activeCheckedInTop100Count` + `checkInEnabled`
- Fail-closed / syncing preserved on incoherent escrow backing

## 12. Frontend changes

- `YourStayPanel`: amount input, exact approve, CHECK IN, active countdown, Lobby pause copy, STAY COMPLETE / CHECK OUT
- Hotel-level `X / 100 ROOMS CHECKED IN`
- Tx path mirrors claim UX; checkout uses contract `getStay` fallback when API lags
- No façade redesign

## 13. Feature flag/config changes

- `HOTEL_CHECKIN_ENABLED` default `false`
- `HOTEL_ELIGIBILITY_SIGNER_ADDRESS` (+ private key server-side)
- When flag off: no CTA / no authorize issuance; checkout still available when a stay exists

## 14. Tests added/updated

- Domain check-in math + escrow merge/coherence
- Foundry: 17 check-in tests + updated RoomService claim suite (46 total contract tests)
- Web check-in auth API tests
- Worker escrow ingest + weighted allocate tests
- Config flag / eligibility signer validation tests

## 15. Validation commands + results

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test:contracts` | PASS (46) |
| `pnpm --filter @hotel100/domain test` | PASS (33) |
| `pnpm --filter @hotel100/config test` | PASS (17) |
| `pnpm --filter @hotel100/web test` | PASS (38) |
| `pnpm --filter @hotel100/worker exec vitest run --testTimeout=20000` | PASS (42) |
| `pnpm --filter @hotel100/web build` | PASS |

Note: default worker `pnpm test` can flake on 5s timeouts under parallel migration load; same suites pass with `--testTimeout=20000`.

## 16. Security invariants checked

- Escrow attribution only via `CheckedIn`/`CheckedOut` (not raw transfers)
- Effective ranking includes unwithdrawn escrow; RoomService never ranks
- Checkout available while check-ins paused; no admin guest withdrawal
- Surplus recovery cannot reduce below liability
- Separate eligibility vs entitlement signers
- Nonce consumed only after stay-already-active check; transfer failure reverts whole tx
- Feature flag defaults off

## 17. Known limitations

- Contract not deployed; production addresses/signers unset
- Worker loop still not auto-started (documented; do not silently enable)
- Public EOA filtering strengthened via exclusions + authorize path; full `eth_getCode` on every public ranking row remains worker-strength at authorize/snapshot time
- Default Vitest 5s timeout tight for PGlite + new migration under parallel load

## 18. Production prerequisites

1. Deploy updated `RoomService` (new constructor arg: eligibility signer)
2. Apply migration `20260919164000_check_in_escrow.sql`
3. Seed RoomService into `excluded_addresses` / config
4. Configure distinct eligibility signer address + private key
5. Set `ROOMSERVICE_ADDRESS`, token address, RPC
6. Run indexer + Room Service worker processes on required cadence
7. Enable `HOTEL_CHECKIN_ENABLED=true` only after an explicit production gate

## 19. Exact deployment/config steps still required

- Broadcast/deploy RoomService bytecode with eligibility signer
- Rotate/update env: `HOTEL_ELIGIBILITY_SIGNER_*`, `HOTEL_CHECKIN_ENABLED`
- Confirm worker commands/cron for transfer indexing + check-in event ingest + financial snapshots
- Production verification gate (not this phase)

## 20. Confirmation

- No production broadcast
- No production env mutation
- No push (unless explicitly requested later)
- `HOTEL_CHECKIN_ENABLED` remains default off
