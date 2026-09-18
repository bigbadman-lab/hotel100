# Gate C — RoomService.sol + Contract Tests

**UTC timestamp:** `2026-09-18T21:05:14Z`  
**Gate:** C — RoomService.sol + contract tests  
**Spec reference:** `HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md` (FROZEN) §§12–14  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| Pre-HEAD | `c966fa1b2135978db12ac0d51949ae150001767c` |
| Final HEAD | `c966fa1b2135978db12ac0d51949ae150001767c` (no commit made in Gate C) |
| Working-tree state | Dirty — Gate C contract sources, OZ vendor, and tests uncommitted |

---

## Scope completed

Non-upgradeable `RoomService.sol` implemented exactly to frozen V1 shape:

| Item | Status |
|------|--------|
| Constructor `(hotelToken_, ponsFeeEscrow_, initialOwner_, initialEntitlementSigner_)` | Done |
| Immutable `hotelToken`, `ponsFeeEscrow` | Done |
| Mutable `entitlementSigner`, `signerEpoch` (initial **1**), `roomServiceClaimed`, `totalRoomServiceClaimed` | Done |
| EIP-712 `RoomServiceClaim(address,uint256,uint256,uint256)` | Done |
| Cumulative self-claim only; payout = cumulative − claimed[msg.sender] | Done |
| ETH only to `msg.sender`; no delegated recipient / relayer / partial / minimum | Done |
| Nothing claimable ⇒ revert; insufficient balance ⇒ revert | Done |
| ReentrancyGuard + Pausable + Ownable2Step | Done (OZ v5.4.0) |
| Signer rotation increments epoch (invalidates old sigs) | Done |
| Ownership renunciation disabled | Done |
| Permissionless `collectRoomService()` | Done |
| **No** ETH withdrawal / token rescue / execute / delegatecall / upgrade/proxy | Confirmed by design + ABI absence tests |

Owner powers limited to: `pauseClaims`, `unpauseClaims`, `rotateEntitlementSigner`, two-step ownership transfer.

---

## Files changed

**Added**

- `contracts/src/RoomService.sol`
- `contracts/src/interfaces/IPonsFeeEscrow.sol`
- `contracts/test/RoomService.t.sol`
- `contracts/test/mocks/MockPonsFeeEscrow.sol`
- `contracts/test/mocks/ReentrantClaimAttacker.sol`
- `contracts/lib/openzeppelin-contracts/` (vendored **v5.4.0** — EIP712, ECDSA, ReentrancyGuard, Pausable, Ownable2Step)
- `audit/hotel-mvp-gate-c-roomservice-contract.md` (this report)

**Modified**

- `contracts/remappings.txt` — `@openzeppelin/contracts/` remapping

---

## Tests / checks run

| Check | Result |
|-------|--------|
| `forge test --use ../.solc/solc-0.8.28` | **PASS** — 28 tests (27 RoomService + 1 BootstrapSanity) |
| Production broadcast | **NONE** |

### RoomService invariant coverage

- Constructor validation (zero hotel / escrow / owner / signer)
- Immutables + `signerEpoch == 1` initially
- Valid cumulative self-claim
- Exact claimed delta + `totalRoomServiceClaimed`
- Replay / no-delta rejection
- Lower cumulative entitlement rejection
- Wrong guest / wrong signer / expired / wrong epoch
- Signer rotation increments epoch + invalidates old signatures
- Pause / unpause
- Insufficient ETH
- Reentrancy protection
- Permissionless positive-fee collect-all
- Zero-fee collection no-op
- Renounce ownership disabled
- Two-step ownership transfer
- Absence of withdraw / token rescue / execute / upgrade selectors

---

## Unresolved external-interface assumptions

### Pons V2 Fee Escrow (Gate C mock only)

No production Pons V2 Fee Escrow ABI or address exists in this greenfield repo yet.

**Gate C assumption** (`IPonsFeeEscrow` + `MockPonsFeeEscrow`):

1. `balanceOf(address account) → uint256` — claimable fee balance for `account` (wei)
2. `claim() → uint256` — claims **all** of `msg.sender`’s balance and sends ETH to `msg.sender`

`RoomService.collectRoomService()`:

1. reads `balanceOf(address(this))`
2. if zero → safe no-op
3. if positive → calls `claim()`
4. ETH lands in RoomService via `receive()`

**Must bind the real production Pons V2 escrow interface later (Gate I)** without inventing a production address. If the live API differs (e.g. different claim method name, `claimFor(account)`, pull vs push), adapt only the escrow adapter / call site — **do not** change the economic invariant that RoomService is the direct creator-fee recipient.

### Unresolved production inputs (not invented)

- Production `hotelToken` / `ponsFeeEscrow` / owner / entitlement signer addresses
- Pons V2 factory/router/escrow production addresses
- Any on-chain deployment / broadcast

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**
- Production broadcasts performed: **NONE**
- Secrets printed / committed: **NONE**
- Gate D (database) **not started**

---

## Next recommended action

Proceed to **Gate D — Database schema + financial finalization RPC** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
