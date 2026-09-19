# Gate H — Phase A structure port

**UTC timestamp:** `2026-09-19T14:14:00Z`  
**Gate:** H — Public HOTEL UI (Phase A only: Lovable DOM/component structure)  
**Spec / handoff:** `design/hotel100/HOTEL100-Production-UI-Handoff.md` §§1–16, 18–20  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS — PHASE A STRUCTURE PORTED; CSS PORT NOT STARTED**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| HEAD | `eab9af1515695c432923daa4bc426440027cf464` |
| Working-tree state | Dirty — Phase A UI structure uncommitted; no commit/push performed |
| Touched for this phase | `apps/web/src/hotel/components/HotelView.tsx`, `icons.tsx` (new), `HotelApp.tsx`, `format.ts`, `hotel.test.tsx`, this report |

Backend, contracts, database, worker, and indexer were not modified.

---

## Scope completed (Phase A)

Ported the approved Lovable DOM/class-name contract into the production React tree while keeping production data and behaviour:

| Surface | Structure adopted |
|---------|-------------------|
| Shell | `.hotel-shell` → header → `.hotel-main` / `.hotel-grid` → activity → market → footer → lobby sheet |
| Header | `.hotel-header`, brand bell/logo/tagline, LIVE pill, next-service clock, wallet button |
| Your Stay | `.hotel-panel.hotel-stay` with empty / wallet card / room / balance / movement / facts / fob |
| Façade | `.hotel-facade` building: pediment, parapet, penthouse, 10×`.hotel-row` windows, entrance, plinth, 22-tree hedge, selected-room foot |
| Room Service | `.hotel-panel.hotel-service` amount/state/claim/note/facts/quote |
| Live Activity | icon map + relative time from canonical activity timestamps |
| Market | `$HOTEL` / MC / LIQ / Holders; null figures → **Not published**; trade disabled |
| Lobby | footer **Enter the Lobby** → `.hotel-lobby` sheet for ranks #101+ |

Façade geometry constants updated to the approved layout: **10 columns**, top storey **9** windows (rooms 2–10), nine further storeys of 10 → **99** standard rooms + penthouse.

---

## Production logic retained

- Canonical `GET /api/hotel/state` poll via existing `HotelApp` / `production-client` (fail-closed; no fixture substitution in production).
- Ranking → room mapping unchanged (still domain-driven upstream; UI only displays slots).
- Occupancy, balances, move-up amounts, check-in duration, best room, holders.
- Room Service WAITING / ARRIVING / DELAYED / NONE from real cycle timing (`isRoomServiceArriving` / `secondsUntilNextService`).
- Claim path unchanged: wallet connect, chain 4663, EIP-712 entitlement, simulation, send, receipt, refresh-after-confirm (`claim.ts` / `HotelApp.onClaim`).
- Stale → `HOTEL SYNCING` banner via `HotelOperationalState`; pre-live → check-in-opens messaging.
- Lobby #101+ from snapshot; gap to Room 100 computed with `additionalNeededToBeatTarget` when Room 100 is occupied.
- Motion cue hooks preserved (`hotel-facade--service`, `motion-light`, `motion-takeover`, `motion-checkin`).
- Last service ETH left as **—** (no invented figure). Market nulls render **Not published**.

## Explicitly not ported

- Full prototype CSS (`§17`) — deferred to a later phase; new `hotel-*` classes are largely unstyled until then.
- `hotel-fixture.ts`, local 900s countdown, local wallet toggle, local `claimed` boolean, “Prototype only — no transaction is broadcast.”
- Backend / contracts / DB / worker / indexer.

---

## Tests

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web exec vitest run src/hotel.test.tsx src/claim.test.ts src/entitlement.test.ts src/hotel-public-state.test.ts` | **PASS** — 34 tests |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `pnpm exec biome check apps/web/src/hotel apps/web/src/hotel.test.tsx` | **PASS** |
| Production broadcast | **NONE** |

Targeted structure assertions in `hotel.test.tsx`:

- 99 `data-room` windows; ascending order; penthouse plaque; `is-connected` on the guest room.
- Lovable nodes present: `hotel-facade--service`, pediment, penthouse plaque, entrance plaque, plinth, 22 hedge trees, ≥10 rows.
- No prototype-only claim/wallet copy in façade markup.
- Existing movement / sync / claim-prepare / public-state / entitlement suites still green.

---

## Follow-on (out of Phase A)

- Port §17 CSS into `globals.css` (cascade order preserved) and register/display fonts if any gap remains.
- Visual regression at 1440 / 1024 / 390 against approved screenshots; overflow checks.
- Confirm `prefers-reduced-motion` once service-warmth CSS is live.

---

## Notes for reviewers

The page shell and component markup now match the Lovable handoff; production state plumbing is unchanged. Visual appearance will not yet match the approved screenshots until the CSS phase lands, because Phase A intentionally did not port styles.
