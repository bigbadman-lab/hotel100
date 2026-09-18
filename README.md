# $HOTEL MVP

**100 rooms. No reservations.**

Greenfield monorepo for the frozen `$HOTEL` MVP specification.

## Workspace layout

| Path | Role |
|------|------|
| `contracts/` | Foundry (Solidity) — `RoomService.sol` in Gate C |
| `apps/web/` | Next.js public HOTEL UI (+ entitlement API routes in Gate G) |
| `apps/worker/` | Single indexer + Room Service worker (no Redis/queues) |
| `packages/domain/` | Shared ranking, eligibility, Service math |
| `packages/config/` | Typed config + production validation |
| `supabase/` | Postgres migrations + DB functions |
| `scripts/` | Deployment/simulation/verification (dry-run by default) |
| `audit/` | Gate audit reports |

## Tooling

- **Package manager:** pnpm workspaces
- **Runtime:** Node.js ≥20
- **Contracts:** Foundry (`forge` / `cast`)
- **Frontend:** Next.js (App Router) + React
- **Worker:** Node.js + TypeScript (`tsx`)
- **DB:** Supabase / Postgres
- **Tests:** Vitest (TS), `forge test` (Solidity)
- **Lint/format:** Biome

## Quick start

```bash
pnpm install
pnpm install:solc          # local solc 0.8.28 into .solc/ (gitignored)
pnpm --filter @hotel100/domain test
pnpm test:contracts
pnpm dev:web
```

Copy `.env.example` → `.env` and fill local values. Never invent production addresses or secrets.

## Safety

- No production broadcast from this repo by default.
- Real `$HOTEL` production launch is **not** authorized during implementation gates.
- Deployer/owner private keys must not live in backend infrastructure.

See `audit/hotel-mvp-repository-bootstrap.md` for Gate A details.
