# Gate H — Phase C responsive CSS (1024 / 390)

**UTC timestamp:** `2026-09-19T14:34:50Z`  
**Gate:** H — Public HOTEL UI (Phase C only: responsive CSS)  
**Spec / handoff:** `design/hotel100/HOTEL100-Production-UI-Handoff.md` §§13, 17 (responsive blocks)  
**Prior phases:** `audit/gate-h-port-a-structure.md`, `audit/gate-h-port-b-desktop-css.md`  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS — PHASE C RESPONSIVE CSS PORTED**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| HEAD | `eab9af1515695c432923daa4bc426440027cf464` |
| Working-tree state | Dirty — Phases A–C uncommitted; no commit/push |
| Phase C files | `apps/web/src/app/globals.css` (append only), `biome.json` (lint override), screenshots + this report |

Desktop Phase B rules were not redesigned. Production logic, ranking, wallet, claim, Room Service timing, stale/pre-live, backend, DB, worker, indexer, contracts, and fixtures were not changed.

---

## Responsive rules ported

Appended after Phase B desktop CSS, in handoff §17 source order:

| Block | Status |
|-------|--------|
| `@media (max-width: 1200px)` — tightened three-column | Ported |
| `@media (max-width: 880px)` — single-column stack | Ported |
| `@media (max-width: 560px)` — mobile base (header, façade, panels, activity, market, lobby) | Ported |
| `@media (max-width: 1200px)` — fob stack fix | Ported |
| `@media (max-width: 560px)` — penthouse holder / motto / areas | Ported |
| Mobile polish pass (390) — shell `0 8px 18px`, façade `8px 2px 0`, title `1.02rem`, holder compact, rhythm | Ported |
| `@media (max-width: 560px)` — window `32px`, glass `28×16`, numbers `0.45rem`, rows padding | Ported |
| `@media (max-width: 560px)` — fob motto `br` hide + centred wrap | Ported |
| `@media (max-width: 560px)` — claimable value `2.1rem` | Ported |

Duplicate desktop ETH overflow-guard base rules already present from Phase B were not re-appended. `prefers-reduced-motion` from Phase B remains intact.

**Biome:** `noInvalidGridAreas` disabled for `globals.css` so the approved two-row `grid-template-areas: "pavilion" "holder"` is not rewritten.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web test` | **PASS** — 34 tests |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `pnpm --filter @hotel100/web lint` | **PASS** |
| `pnpm --filter @hotel100/web build` | **PASS** |
| Local `next start` (`127.0.0.1:3010`) | **PASS** |
| Production broadcast | **NONE** |

### 1024px

| Metric | Result |
|--------|--------|
| Screenshot | `audit/gate-h-screenshots/phase-c-1024.png` |
| Overflow (`scrollWidth === clientWidth`) | **PASS** — **1024** |
| Grid | `228px 508px 228px` (three-column preserved) |
| Rooms | **99** `[data-room]` + Penthouse; order 2→100 ascending |
| Window / glass | `44px` / `38×22` |
| Reduced-motion rule present | **yes** |

### 390px

| Metric | Result |
|--------|--------|
| Screenshot | `audit/gate-h-screenshots/phase-c-390.png` |
| Overflow | **PASS** — **390** |
| Grid | single column `374px`; stack header → Your Stay → façade → Room Service → activity → market → footer/Lobby |
| Façade width | **374px** (~370 target) |
| Shell / façade padding | `0 8px 18px` / `8px 2px 0` |
| Window / glass / number | `32px` / `28×16` / `0.45rem` (7.2px) |
| Claim `min-height` | **46px** |
| Rooms | **99** + Penthouse; order unchanged |
| Reduced-motion rule present | **yes** |

---

## Responsive regressions

None observed relative to Phase A/B assumptions:

- No room pagination or room-list replacement.
- Connected-room highlight classes (`is-connected`) unchanged in markup.
- Desktop 1440 rules untouched above the Phase C append.

---

## Differences vs approved Lovable responsive target

Layout and breakpoint metrics match the handoff. Content still differs from the fixture prototype for production fail-closed reasons (same as Phase B):

- **HOTEL SYNCING** + vacant rooms / empty activity / **Not published** market.
- Operational banner under the header (production-only).

At 1024 the header tagline is hidden per the 1200px rule (approved). At 390 the full façade remains visible without horizontal scroll.

---

## Follow-on

None required for Gate H Phase C. Optional later: fixture-preview visual parity screenshots if a reviewer wants occupied-room responsive comps without changing production defaults.
