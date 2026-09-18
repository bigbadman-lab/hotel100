# HOTEL100 frontend design implementation plan

**UTC timestamp:** `2026-09-18T22:10:00Z`  
**Branch:** `main`  
**HEAD:** `8bbb8c0b367a111521c3f555ac75ac69bf5d0217`  
**Working tree:** clean at plan time (Gate H not started)  
**Inputs read:** `HOTEL100_FRONTEND_DESIGN_SPEC.md`, `HOTEL100_DESKTOP_PROTOTYPE.html`, `HOTEL100_DESKTOP_MOCKUP.png`, frozen MVP spec §§7–8, 21–23, Gate H

## Current frontend

- Next.js 15 App Router, React 19, one route (`app/page.tsx`) with placeholder copy.
- No global stylesheet, no font loader, no wallet kit, no public rooms API.
- Gate G entitlement routes exist (`POST /api/entitlement/challenge`, `POST /api/entitlement`).
- Domain package already has ranking, `additionalNeededToBeatTarget`, Service-time, stale status, and poll interval.
- Tests: Vitest. No screenshot runner yet. Browser tools are not wired into this session; viewport checks will use headless Chrome if present.

## Conflict check

No conflict between the frozen financial rules and the design direction. The façade is rank display, not a second ledger. Movement math stays in `@hotel100/domain`. React will not compute Room Service allocations.

## Files to change

- `apps/web/src/app/layout.tsx`, `page.tsx`
- `apps/web/src/app/globals.css` (new)
- `apps/web/package.json` only if a test renderer is required (prefer `react-dom/server`, already present)

## Components to create

`HotelHeader`, `YourStayPanel`, `HotelFacade` (includes `Penthouse`, `HotelRoom`, entrance, selected-room strip), `RoomServicePanel`, `LobbyQueue`, `LiveActivity`, `HotelMarketStrip`, `HotelOperationalState`, plus `HotelApp`.

## Data adapters

- Production adapter: `HOTEL_LIVE` stays false. All 100 rooms vacant. Status `HOTEL CHECK-IN OPENS SOON`. Market figures null. No invented holders.
- Fixture adapter: dev/test only (`preview=fixture` and not production and not live). Never selected when `HOTEL_LIVE` is true or `NODE_ENV=production`.
- Public indexed rooms/activity/market HTTP API: **not implemented**. Remaining backend gap, not filled with production fixtures.
- Claim: Gate G challenge + EIP-712 payload shaped for `claimRoomService`. Broadcast function returns none.

## Visual / responsive / tests

Desktop three-column shell from the prototype, palette from the spec, stone façade with fixed 11×9 rooms. Tablet drops Room Service to full width. Mobile stacks header, Your Stay, façade, selected room, Room Service, lobby, activity, market. Motion is state diffs only, with `prefers-reduced-motion`. Tests cover geometry, domain movement, stale/sync, fixture guard, motion silence on large diffs, and no claim broadcast.

## Verdict

**PASS — FRONTEND IMPLEMENTATION MAY BEGIN**
