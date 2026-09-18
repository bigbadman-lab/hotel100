# Gate B — Canonical Config + Shared Domain Logic

**UTC timestamp:** `2026-09-18T21:00:22Z`  
**Gate:** B — Canonical config + shared domain logic  
**Spec reference:** `HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md` (FROZEN)  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| Pre-HEAD | `9c99cfcf0d7c60202d91a704cf0a6b4f1493cfcc` |
| Final HEAD | `9c99cfcf0d7c60202d91a704cf0a6b4f1493cfcc` (no commit made in Gate B) |
| Working-tree state | Dirty — Gate B domain/config changes uncommitted |

---

## Scope completed

Implemented frozen HOTEL100 config/domain layer only (no `RoomService.sol`, no Gate C+):

| Requirement | Location |
|-------------|----------|
| Canonical frozen constants | `packages/domain/src/constants.ts` |
| Lowercase address normalization | `packages/domain/src/address.ts` |
| Deterministic numeric-address comparison | `packages/domain/src/address.ts` |
| Holder ranking (balance DESC, address ASC) | `packages/domain/src/ranking.ts` |
| Exact move-up / check-in required-balance math | `packages/domain/src/required-balance.ts` |
| 900s UTC Service boundary math + first Service after open | `packages/domain/src/service-time.ts` |
| Confirmation / stale / catch-up policy constants | `packages/domain/src/constants.ts` |
| Public / operational / canary status enums | `packages/domain/src/status.ts` |
| Integer-only financial primitives | `packages/domain/src/financial.ts` |
| Typed config schema | `packages/config/src/schema.ts` |
| Production config validation | `packages/config/src/validate.ts` |
| Exact 3-wallet production model | `packages/config/src/validate.ts` |

### 3-wallet model (enforced)

- Deployer + RoomService owner: **same EOA slot** (`deployerOwnerAddress`)
- Entitlement signer: **must be distinct** from deployer/owner
- Worker writer: **must be distinct** from deployer/owner **and** entitlement signer
- Zero / invalid addresses rejected

### Required-balance formula (enforced)

- If `userAddress < targetAddress` (numeric) → `requiredBalance = targetBalance`
- Else → `requiredBalance = targetBalance + 1` raw unit
- `additionalNeeded = max(requiredBalance - userBalance, 0)`

### First Service boundary (enforced)

- `firstBoundary = floor(openTs / 900) * 900 + 900`  
  ⇒ always **strictly after** `HOTEL_OPEN_TIMESTAMP`, including exact-boundary opens

Unresolved production values remain optional config inputs — **not invented**.

---

## Files changed

**Modified**

- `packages/domain/src/index.ts`
- `packages/domain/src/index.test.ts`
- `packages/config/src/index.ts`
- `packages/config/package.json` (depends on `@hotel100/domain`)
- `pnpm-lock.yaml`

**Added**

- `packages/domain/src/constants.ts`
- `packages/domain/src/address.ts`
- `packages/domain/src/financial.ts`
- `packages/domain/src/ranking.ts`
- `packages/domain/src/required-balance.ts`
- `packages/domain/src/service-time.ts`
- `packages/domain/src/status.ts`
- `packages/config/src/schema.ts`
- `packages/config/src/validate.ts`
- `packages/config/src/index.test.ts`
- `audit/hotel-mvp-gate-b-domain-config.md` (this report)

---

## Tests / checks run

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/domain test` | **PASS** — 24 tests |
| `pnpm --filter @hotel100/config test` | **PASS** — 13 tests |
| `pnpm --filter @hotel100/domain typecheck` | **PASS** |
| `pnpm --filter @hotel100/config typecheck` | **PASS** |
| `pnpm --filter @hotel100/worker typecheck` | **PASS** |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `biome check packages/domain packages/config` | **PASS** |
| Production broadcast | **NONE** |

### Invariants covered by tests

- Tie-breaking: equal balance → lower numeric address ranks higher
- Address ordering: numeric `bigint`, not checksum lexicographic
- Move-up: lower address / higher address / exact same address / zero additional / +1 raw unit / room #100 threshold
- Service timing: exact boundary, just before, just after; first Service strictly after open
- Confirmation / stale constants: 1 / 2 / 1 confirmations; >30s stale
- Financial: integer `floorDiv`, pro-rata floor, `balance + claimed`, claim delta
- 3-wallet: distinct OK; signer=deployer BLOCKED; writer=deployer BLOCKED; writer=signer BLOCKED; zero/invalid BLOCKED
- Config: unresolved inputs reported; env does not invent addresses; chain id must be `4663`

---

## Unresolved production inputs (intentionally unset)

Do not invent:

- `HOTEL_RPC_URL`, `HOTEL_DOMAIN`, `HOTEL_BRAND_NAME`
- Token metadata / `HOTEL_TOKEN_ADDRESS`
- Pons V2 addresses, `PONS_LAUNCH_SALT`
- `HOODLOCK_ADDRESS`, `ROOMSERVICE_ADDRESS`
- `HOTEL_DEPLOYER_OWNER_ADDRESS`, `HOTEL_ENTITLEMENT_SIGNER_ADDRESS`, `HOTEL_WORKER_WRITER_ADDRESS`
- Supabase / `DATABASE_URL`
- `HOTEL_LAUNCH_BLOCK`, `HOTEL_OPEN_BLOCK`, `HOTEL_OPEN_TIMESTAMP`
- `HOTEL_MANUAL_EXCLUSIONS`
- Secret key material (never in config package)

Fixture addresses in unit tests are **local test doubles only**, not production values.

---

## Invariants verified (Gate B)

- Frozen chain id `4663`, rooms `100`, Service interval `900` UTC
- Ranking + tie-break + required-balance +1 raw-unit rule
- First Service boundary strictly after open timestamp
- Confirmation policy constants available for later gates
- Status strings for pre-live / syncing / delayed / arriving / canary
- Integer-only wei/raw math helpers
- Production 3-wallet validation fail-closed on role collision

---

## Unresolved issues

None for Gate B scope.

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**
- Production broadcasts performed: **NONE**
- Secrets printed / committed: **NONE**
- Gate C (`RoomService.sol`) **not started**

---

## Next recommended action

Proceed to **Gate C — RoomService.sol** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
