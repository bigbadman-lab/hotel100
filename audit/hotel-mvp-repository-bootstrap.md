# Gate A — Repository Bootstrap + Implementation-Plan Audit

**UTC timestamp:** `2026-09-18T20:51:48Z`  
**Gate:** A — Repository bootstrap + implementation-plan audit  
**Spec reference:** `HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md` (FROZEN)  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS — REPOSITORY BOOTSTRAPPED; IMPLEMENTATION MAY BEGIN**

---

## Repository state

| Field | Value |
|------|--------|
| Repository root path | `/Users/alexattinger/Desktop/hotel100` |
| Branch | `main` |
| Initial / bootstrap HEAD | `N/A` — git repository initialized; **no commits yet** |
| Working-tree state | Clean of secrets; all bootstrap files untracked (greenfield, pre-first-commit) |
| `.env` present | No (only `.env.example` with key names) |
| Secrets printed / committed | No |

---

## Bootstrap checklist (Gate A)

| Requirement | Status |
|-------------|--------|
| Confirm working directory appropriate for new project | Done — greenfield `hotel100` workspace |
| Initialize git repository | Done — existing empty `main` repo reused |
| Solidity contracts workspace | Done — `contracts/` (Foundry) |
| Web frontend | Done — `apps/web/` (Next.js App Router) |
| One worker/indexer service | Done — `apps/worker/` |
| Shared TypeScript / domain logic | Done — `packages/domain`, `packages/config` |
| Supabase / Postgres migrations | Done — `supabase/migrations`, `supabase/functions` |
| Deployment / simulation tooling | Done — `scripts/` (dry-run placeholder only) |
| Audit reports directory | Done — `audit/` |
| Package management / build tooling | Done — pnpm workspaces |
| Solidity tooling | Done — Foundry + forge-std + solc 0.8.28 |
| Test tooling | Done — Vitest (TS) + `forge test` (Solidity) |
| Lint / typecheck / format | Done — Biome + TypeScript |
| `.gitignore` | Done |
| Safe example env (key names only) | Done — `.env.example` |
| Architecture documented; unresolved production config identified | Done (this report) |

---

## Chosen architecture (maps to frozen spec)

Minimal monorepo — **no Redis, no queues, no extra microservices**.

```
hotel100/
├── apps/
│   ├── web/          # Public HOTEL UI (Gate H); entitlement API route handlers (Gate G)
│   └── worker/       # Single indexer + Room Service worker (Gates E/F)
├── packages/
│   ├── domain/       # Ranking, eligibility, Service math (Gate B+)
│   └── config/       # Typed config + production validation (Gate B+)
├── contracts/        # Foundry — RoomService.sol (Gate C)
├── supabase/         # Migrations + DB functions (Gate D)
├── scripts/          # Deploy/simulate/verify tooling (Gate I) — dry-run by default
├── audit/            # Gate audit reports
├── .env.example      # Config key names only
└── HOTEL_MVP_MASTER_CURSOR_IMPLEMENTATION_PROMPT.md
```

**Why this maps to the frozen specification**

- One worker service satisfies §17 (no Redis/queues/microservices).
- Entitlement API lives under `apps/web` route handlers (HTTPS app) rather than a second backend.
- Shared `packages/domain` prevents duplicated financial formulas (§31).
- `packages/config` owns production config validation and three-wallet role separation (§15, §26).
- Foundry `contracts/` owns non-upgradeable `RoomService.sol` (§12–14).
- `supabase/` owns `numeric(78,0)` schema + atomic finalization RPC (§20).
- `scripts/` owns deterministic prediction / HoodLock simulation / safety gates with **no default broadcast** (§0.4, §25–26).

---

## Tooling choices

| Concern | Choice | Version / notes |
|---------|--------|-----------------|
| Package manager | **pnpm** workspaces | `10.30.3` (`packageManager` field) |
| Runtime | **Node.js** | Local: `v24.10.0`; engines: `>=20`; `.nvmrc` = `20` |
| Language | **TypeScript** | `5.9.x` |
| Solidity framework | **Foundry** (`forge` / `cast`) | Foundry `1.8.1`; solc `0.8.28` |
| forge-std | Vendored under `contracts/lib/forge-std` | Installed via GitHub tarball (reproducible bootstrap) |
| Frontend | **Next.js** (App Router) + React 19 | `@hotel100/web` |
| Worker / indexer runtime | **Node.js + TypeScript** via `tsx` | `@hotel100/worker` |
| Shared packages | `@hotel100/domain`, `@hotel100/config` | Workspace protocol |
| Database | **Supabase / Postgres** | `supabase/config.toml` + migrations placeholder |
| TS tests | **Vitest** | `3.2.x` |
| Contract tests | **`forge test`** | Bootstrap sanity test PASS |
| Lint / format | **Biome** | `2.5.x` |
| Deployment tooling | `scripts/` + Foundry `contracts/script/` | Placeholders only; no production broadcast |

**Local solc note:** First-run Foundry svm download from `binaries.soliditylang.org` was blocked in this environment. Bootstrap uses `scripts/install-solc.sh` (GitHub Solidity release binary → `.solc/`, gitignored) and `pnpm test:contracts` with `--use ../.solc/solc-0.8.28`.

---

## Config strategy

- All unresolved production values are **named keys** in `.env.example` and typed placeholders in `@hotel100/config`.
- Defaults that are frozen constants may be hardcoded in domain (e.g. chain id `4663`, rooms `100`, interval `900`).
- **Never invent** production addresses, salts, RPC URLs, wallet EOAs, Supabase credentials, or token metadata.
- `HOTEL_LIVE` defaults to `false`.
- Secret key names appear only as commented placeholders in `.env.example`; deployer/owner private key must not live in backend infrastructure (§15).

---

## Unresolved production configuration inputs

Do not invent; fill only when known / authorized:

- Brand / domain values
- Final token metadata (name, symbol, address)
- Pons V2 production addresses (factory, router, fee escrow) if not yet canonical
- HoodLock production address
- Deployer + RoomService owner EOA
- Entitlement signer EOA (must be distinct)
- Worker writer EOA (must be distinct from both)
- RPC URLs
- Supabase URL / keys / `DATABASE_URL`
- Entitlement signer private-key source (runtime secret store only)
- Launch salt + deterministic Pons launch config inputs
- Manually excluded production addresses
- `HOTEL_LAUNCH_BLOCK`, `HOTEL_OPEN_BLOCK`, `HOTEL_OPEN_TIMESTAMP`
- Live activation flag (`HOTEL_LIVE`)
- Any deployment-specific IDs / project refs

---

## Checks / tests run (Gate A)

| Check | Result |
|-------|--------|
| `pnpm install` | PASS |
| `pnpm --filter @hotel100/domain test` | PASS (1 test) |
| `pnpm --filter @hotel100/{domain,config,worker,web,scripts} typecheck` | PASS |
| `pnpm test:contracts` / `forge test` | PASS (`BootstrapSanityTest::test_frozenConstants`) |
| `biome check` (packages, worker, web/src, scripts) | PASS |
| Production broadcast | **NONE** |

---

## Proposed implementation phases (post–Gate A)

| Gate | Scope | Audit output |
|------|--------|--------------|
| **B** | Canonical config + shared domain logic | `audit/hotel-mvp-gate-b-domain-config.md` |
| **C** | `RoomService.sol` + tests | `audit/hotel-mvp-gate-c-roomservice-contract.md` |
| **D** | Database schema + atomic finalization RPC | `audit/hotel-mvp-gate-d-database.md` |
| **E** | Indexer + reconciliation | `audit/hotel-mvp-gate-e-indexer.md` |
| **F** | Room Service worker | `audit/hotel-mvp-gate-f-room-service-worker.md` |
| **G** | Entitlement API | `audit/hotel-mvp-gate-g-entitlement-api.md` |
| **H** | Public HOTEL UI | `audit/hotel-mvp-gate-h-frontend.md` |
| **I** | Deployment + prediction + HoodLock tooling (no broadcast) | `audit/hotel-mvp-gate-i-deployment-tooling.md` |
| **J** | Live activation + canary **state support** only | `audit/hotel-mvp-gate-j-activation-canary-state.md` |
| **K** | Full verification / completion report | `audit/hotel-mvp-implementation-completion.md` |

---

## Risk areas

1. **External protocol surfaces** — Pons V2 Fee Escrow / launch APIs and HoodLock interfaces are not vendored; Gate I must bind to real interfaces without inventing addresses.
2. **Deterministic launch ordering** — RoomService must deploy with predicted `$HOTEL` address before launch; mismatch tooling must hard-`BLOCKED` (§3).
3. **Financial invariants** — Integer wei math, one-block-tag financial reads, `balance + totalClaimed` invariant, atomic DB finalization require early shared domain + DB tests (Gates B/D/F).
4. **Three-wallet separation** — Config validation must fail closed if signer/writer collide with deployer/owner (§15, §30).
5. **Environment / solc bootstrap** — Developers need `pnpm install:solc` (or working Foundry svm network) before `forge test`.
6. **No first git commit yet** — Operator should create an initial commit when ready; Gate A did not commit (and did not commit secrets).

---

## Explicit safety statements

- REAL HOTEL PRODUCTION LAUNCH PERFORMED: **NO**
- Production Pons launch / opening buy / HoodLock / owner transfer / signer rotation / live activation: **NOT PERFORMED**
- Irreversible chain actions: **NONE**
- Secrets in audit or git: **NONE**

---

## Next recommended action

Proceed to **Gate B — Canonical config + shared domain logic** only after human acknowledgment of this PASS.

Do not begin Gate B in the same automated step as Gate A unless explicitly instructed.

---

## Verdict (repeat)

**PASS — REPOSITORY BOOTSTRAPPED; IMPLEMENTATION MAY BEGIN**
