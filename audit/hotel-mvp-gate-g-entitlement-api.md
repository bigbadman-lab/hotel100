# Gate G — Entitlement API + wallet proof

**UTC timestamp:** `2026-09-18T21:59:03Z`  
**Gate:** G — Entitlement API + wallet proof  
**Spec reference:** `HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md` (FROZEN) §§15–16, Gate G  
**Production broadcasts performed:** `NONE`  
**Production signatures performed:** `NONE`

---

## Verdict

**PASS**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| Pre-HEAD | `aa796f57be93602d31cf085396c454a5b0628a4c` |
| Final HEAD | `aa796f57be93602d31cf085396c454a5b0628a4c` (no commit made) |
| Working-tree state | Dirty — Gate G entitlement API uncommitted |

---

## API endpoints

Both routes are Node.js, `force-dynamic`, and return `Cache-Control: private, no-store`.

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/entitlement/challenge` | Issue a SIWE-style challenge for one wallet |
| `POST` | `/api/entitlement` | Verify the wallet proof and, only if a delta is claimable, return an EIP-712 claim signature |

Challenge body: `{ wallet }`.  
Proof body: `{ message, signature }`.

Authenticated success body:

- `cumulativeFinalizedEarnedWei`
- `alreadyClaimedWei`
- `claimableDeltaWei`
- `signerEpoch`
- `deadline` (unix seconds) and `signature` only when `claimableDeltaWei > 0`
- otherwise `deadline: null` and `signature: null`

No frontend, claim UI, or production launch was added.

---

## Challenge / auth flow

Challenges are stored in `auth_nonces`.

- Wallet-bound to the requested address (canonical lowercase).
- Domain-bound to configured `HOTEL_DOMAIN`. The request host is not used as the domain. An empty or missing domain fails closed. No production domain is invented.
- Chain-bound to Robinhood Chain `4663` (`HOTEL_CHAIN_ID`). The column check and the consume predicate both require `4663`.
- Expires at issued time + `ENTITLEMENT_CHALLENGE_TTL_SECONDS` (300). At that exact instant the nonce is no longer consumable.
- Single-use via `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now RETURNING`. A second concurrent caller updates zero rows.
- Wallet proof is EIP-191 `personal_sign` recovery. The recovered address must equal the address inside the issued message.
- Invalid signatures, the wrong wallet, the wrong domain, and the wrong chain return before consume, so they do not burn the attempted nonce or any other nonce.

---

## EIP-712 construction

Matches `RoomService.sol` `EIP712("RoomService", "1")` and the type string:

`RoomServiceClaim(address guest,uint256 cumulativeEntitlement,uint256 deadline,uint256 signerEpoch)`

Domain fields:

- `name = RoomService`
- `version = 1`
- `chainId = 4663`
- `verifyingContract = configured ROOMSERVICE_ADDRESS`

`guest` is the authenticated wallet.  
`cumulativeEntitlement` is the finalized Postgres cumulative, not the claimable delta.  
`deadline` is issuance time + `ENTITLEMENT_SIGNATURE_VALIDITY_SECONDS` (86400).  
`signerEpoch` is the current onchain `signerEpoch()`. An older epoch is not what gets signed.

The signer is the configured entitlement-signer EOA. The key is `HOTEL_ENTITLEMENT_SIGNER_PRIVATE_KEY` only. It is not part of `HotelConfig`, not logged, not returned, and not written to any table. If the derived address is the worker writer or deployer/owner, signing is refused.

---

## Onchain reconciliation

Before a signature, at the same logical read:

1. `guest_entitlements.cumulative_earned_wei` — canonical finalized earnings. Missing row means `0`. This table is not a second ledger; the API does not insert earnings.
2. `MAX(room_service_claims.cumulative_entitlement_wei)` — consistency check only. The API does not insert claims.
3. `roomServiceClaimed(guest)`, `signerEpoch()`, and `entitlementSigner()` from the configured RoomService address.

Fail closed, with no signature, when:

- onchain claimed is greater than finalized earned
- indexed claim cumulative is greater than finalized earned
- onchain `entitlementSigner()` is not the configured signer
- chain or database reads fail

Claimable delta is `earned - onchainClaimed`. The signed cumulative is `earned`, which is never below the onchain claimed amount. A zero delta returns status only.

Chain access is `eth_call` / `readContract` only. There is no broadcast.

---

## Rate limiting

Postgres table `entitlement_rate_limits`. No Redis and no extra service.

Fixed 60-second window, atomic upsert:

- wallet: 30 requests
- IP: 120 requests (`x-forwarded-for` first hop, else `x-real-ip`, else `unknown`)

Either bucket returning over its max yields `429`. This table is coordination only, not financial state.

---

## HTTPS / cache behavior

Production (`NODE_ENV=production`) requires HTTPS, including when the URL host is localhost. `x-forwarded-proto: http` is rejected.

Development allows HTTP only when the request URL hostname is `localhost`, `127.0.0.1`, or `::1`. Any other development HTTP host is rejected. That exception is not applied in production.

Entitlement responses set:

- `Cache-Control: private, no-store`
- `CDN-Cache-Control: no-store`
- `Pragma: no-cache`

---

## Database runtime

`loadEntitlementDeps` requires `DATABASE_URL` and opens a `pg` pool. A blank URL throws `database_unconfigured`. There is no in-memory store. Tests use PGlite through the same SQL executor interface. The connection string is not logged.

---

## Files changed

**Added**

- `apps/web/src/entitlement/` — challenge, transport, rate limit, EIP-712, reconcile, store, chain reader, handlers, production loader
- `apps/web/src/app/api/entitlement/challenge/route.ts`
- `apps/web/src/app/api/entitlement/route.ts`
- `apps/web/src/entitlement.test.ts`
- `supabase/migrations/20260918214200_entitlement_rate_limits.sql`
- `audit/hotel-mvp-gate-g-entitlement-api.md`

**Modified**

- `apps/web/package.json` — `viem`, `pg`, test deps
- `apps/web/next.config.ts` — `serverExternalPackages: ["pg"]`
- `pnpm-lock.yaml`

---

## Tests / checks

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web test` | **PASS** — 14 tests |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `biome check apps/web/src` | **PASS** |
| Production broadcast | **NONE** |
| Production signature | **NONE** |

Covered: wallet/domain/chain binding, exact 5-minute expiry, single-use, concurrent consume, invalid signature, wrong wallet, wrong domain, wrong chain, production HTTP rejected (including localhost), development localhost allowed, private/no-store headers, wallet rate limit, IP rate limit, finalized-only cumulative, onchain claimed reconciliation, claimed above DB earnings fails closed, current signer epoch, EIP-712 recovery matches the configured signer, 24-hour deadline, old epoch does not verify, zero claimable returns no signature, private key absent from logs/responses/nonce rows, empty `DATABASE_URL` has no memory fallback.

Local tests sign with public Anvil keys only. No production key is present.

---

## Unresolved production configuration

Do not invent:

- `HOTEL_DOMAIN`
- `DATABASE_URL` / Supabase credentials
- `HOTEL_RPC_URL`
- `ROOMSERVICE_ADDRESS`
- `HOTEL_ENTITLEMENT_SIGNER_ADDRESS`
- `HOTEL_ENTITLEMENT_SIGNER_PRIVATE_KEY` (runtime secret only)
- deployer/owner and worker writer addresses
- token, launch, and open configuration from earlier gates

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**
- Production broadcasts performed: **NONE**
- Production signatures performed: **NONE**
- Secrets printed / committed: **NONE**
- Gate H (public HOTEL UI) **not started**

---

## Next recommended action

Proceed to **Gate H — Public HOTEL UI** only after human acknowledgment of this PASS.

---

## Verdict (repeat)

**PASS**
