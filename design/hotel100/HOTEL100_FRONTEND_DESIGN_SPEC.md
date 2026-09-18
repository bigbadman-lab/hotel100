# HOTEL100 Frontend Design Specification

## Status

**FROZEN DESIGN DIRECTION — desktop homepage reference**

This file defines the intended visual system and central façade behavior for the HOTEL100 MVP. It is a design implementation specification, not an invitation to reinterpret the product.

Primary visual reference:

`HOTEL100_DESKTOP_MOCKUP.png`

Functional/layout reference:

`HOTEL100_DESKTOP_PROTOTYPE.html`

If the static mockup and prototype differ in minor decorative details, preserve the **mockup's visual mood** and the **prototype's interaction/layout logic**.

---

# 1. Design thesis

HOTEL100 should feel like:

**an old luxury hotel operating board rebuilt as a modern onchain interface.**

It must **not** look like:

- a generic crypto dashboard;
- a DeFi analytics terminal;
- a card grid with hotel-themed labels;
- a casino;
- a neon Web3 landing page;
- glassmorphism;
- a SaaS admin panel.

The hotel façade is the product interface.

Users should understand immediately:

1. there are exactly 100 rooms;
2. room position is rank;
3. the Penthouse is rank #1;
4. their own room is visible and highlighted;
5. Room Service is a recurring hotel mechanic;
6. moving up means acquiring more HOTEL.

---

# 2. Desktop canvas

Reference desktop width:

`1440px`

Main content max width:

`1440px`

Page gutter at reference width:

`28px`

Header height:

`72px`

Main grid:

- left user panel: `220–260px`
- centre hotel: fluid, minimum `620px`
- right Room Service panel: `220–260px`
- gap: `22px`

The centre hotel must visually dominate.

Target visual ratio on desktop:

- hotel / façade: approximately 55–60% of perceived attention;
- side panels together: approximately 25–30%;
- remaining attention: header, activity, market strip.

---

# 3. Frozen palette

Use these as canonical initial tokens.

```css
--hotel-bg: #091B14;
--hotel-bg-2: #0D241B;
--hotel-panel: #10291F;
--hotel-panel-2: #132F24;
--hotel-stone: #D7C7A6;
--hotel-stone-dark: #C6B58F;
--hotel-cream: #F4ECD8;
--hotel-muted: #A9B1A4;
--hotel-line: #365447;
--hotel-glass: #17342A;
--hotel-glass-light: #21473A;
--hotel-gold: #D6A34C;
--hotel-gold-soft: #F0C877;
--hotel-danger: #C9796C;
```

Rules:

- dark green is the dominant field;
- cream is primary text;
- stone/beige defines the building;
- gold is sparse and signals selected/current/status moments;
- never use bright lime;
- no purple/blue Web3 gradients;
- no rainbow token styling;
- red only for operational/error state.

---

# 4. Typography

Recommended production typography:

Display / hotel identity:
- `Newsreader` or a similarly restrained editorial serif.
- Use for HOTEL100, PENTHOUSE, major room identity, Room Service amount.

Interface / body:
- `Inter` or equivalent clean grotesk.

Data / wallet / rank / countdown:
- `IBM Plex Mono` or equivalent neutral monospace.

Use Next.js local/font tooling where appropriate.

Do not use the serif everywhere.

Typography should feel restrained, not theatrical.

---

# 5. Shape language

Corner radii:

- primary panels: `6px`
- buttons: `4px`
- small controls: `4px`
- hotel windows: essentially square / `0–2px`

Borders:

- default `1px`
- selected own room: `2px`
- avoid thick decorative borders

Shadows:

- subtle depth only
- no neon glow
- own-room gold halo may be very soft and tightly contained

---

# 6. Header

Desktop header:

- 72px tall;
- icon + `HOTEL100` left;
- tagline beside it on wide desktop:
  `100 ROOMS. NO RESERVATIONS.`
- right side:
  - `● LIVE`
  - `SERVICE mm:ss`
  - wallet button

No full traditional navigation bar for MVP.

No giant hero.

The hotel starts immediately below the header.

Pre-live replaces LIVE state appropriately but keeps the same visual shell.

---

# 7. Central façade — core specification

## 7.1 Concept

The central UI must read as the **front elevation of a real hotel**.

It must not become a spreadsheet of holder rows.

Rooms are literal architectural windows/room apertures.

## 7.2 Room count geometry

Canonical representation:

- Room #1: separate Penthouse structure at the top.
- Rooms #2–#100: `99` windows.
- Grid: `11 columns × 9 rows = 99 rooms`.

This gives all 100 ranks a stable physical address in the building.

Rank order fills left-to-right, top-to-bottom beginning at Room 2.

Do not reorder rooms based on current occupants; the physical room positions are fixed.

Occupants move between fixed room positions.

## 7.3 Façade proportions

At 1440 reference width:

- centre panel width: approximately `800–850px` depending viewport;
- hotel-stage inner padding: `34–36px`;
- Penthouse width: approximately `70%` of central stage;
- main stone façade width: approximately `100%` of central stage after padding;
- entrance width: approximately `42%` of façade;
- entrance centered.

The façade should be wider than it is tall, but still clearly read as a substantial multi-floor hotel.

## 7.4 Room windows

Each room:

- equal width;
- near-square portrait ratio around `1 : 0.86`;
- consistent gaps;
- dark green glass;
- thin structural mullions;
- tiny room number in lower-left or lower-edge architectural position.

Desktop gap target:

`7px`

Window inner inset target:

`7px`

Room number:

- tiny;
- monospace;
- subordinate;
- always legible on focus/selection.

## 7.5 Occupied room

Occupied:

- dark green glass;
- subtle warm depth;
- may have very light warm interior illumination;
- no avatar;
- no profile picture;
- no giant wallet string in the window.

The façade itself stays visually clean.

Details appear in the selected-room information strip/panel.

## 7.6 Vacant room

Vacant:

- visibly darker / less illuminated;
- optional tiny `VAC` architectural label;
- must still retain room number;
- never disappear from building.

Vacancy means the room exists but currently has no eligible occupant.

## 7.7 Connected user's room

The connected user's room is the strongest room-level treatment.

Use:

- `2px` muted gold border;
- subtle contained gold halo;
- slightly brighter green glass;
- no flashing;
- no pulsing;
- no confetti.

The user must be able to locate their room immediately.

## 7.8 Selected room

Clicking/focusing a room selects it.

Selected treatment:

- cream or light-stone outline;
- persistent until another room is selected.

A selected room reveals beneath the building:

- room number;
- shortened wallet;
- HOTEL balance;
- `YOU` if connected user.

Do not overlay large tooltips on the façade.

## 7.9 Penthouse

Penthouse is architectural and distinct.

It sits above the main façade beneath a small roofline.

Content:

- `PENTHOUSE`
- `01`
- shortened wallet
- HOTEL balance

Penthouse status is prestige only.

**Do not show or imply an economic Room Service multiplier.**

Room Service remains pure pro rata by eligible snapshot balance.

## 7.10 Entrance

The entrance anchors the building visually.

It is not an interactive rank.

Use:

- centred portico / doorway;
- HOTEL100 engraving/sign;
- dark double doors;
- no fake room.

Entrance is atmospheric only.

---

# 8. Hotel controls

Above the façade:

`THE HOTEL`

Right-aligned compact jump controls:

- `TOP`
- `MY ROOM`
- `ROOM 100`

These are navigation helpers, not tabs.

On mobile, they may collapse or be simplified.

---

# 9. Your Stay panel

When checked in:

- `YOUR STAY`
- `ROOM 47`
- `RANK #47`
- balance
- exact HOTEL needed to move one room up
- checked-in duration
- best room ever

Movement requirement is high-priority.

Example:

`+31,440 HOTEL`
`TO MOVE INTO ROOM 46`

When in lobby:

- `YOU'RE IN THE LOBBY`
- current live rank
- balance
- Room #100 threshold
- exact HOTEL needed to check in
- best room ever
- prior Room Service waiting where applicable

When zero balance/former guest:

- `NOT CHECKED IN`
- history remains
- claimable Room Service remains visible.

---

# 10. Room Service panel

The phrase is always:

**ROOM SERVICE**

Never rename it to generic `Rewards`.

Primary states:

## Waiting

- amount in ETH
- `ROOM SERVICE WAITING`
- `CLAIM ROOM SERVICE`
- next Service countdown

## Nothing waiting

- `NO ROOM SERVICE WAITING`
- claim control disabled/absent
- countdown remains

## Boundary hit

- `ROOM SERVICE ARRIVING`

## Delayed

- `ROOM SERVICE DELAYED`
- reassuring but factual secondary copy
- do not expose worker internals

## STUCK operational condition

Public UI may continue to say `ROOM SERVICE DELAYED`.
Operational admin surfaces can show STUCK.

Countdown:

- monospace
- visually prominent
- not oversized relative to the hotel.

---

# 11. Activity

Place below the main three-column composition.

Title:

`LIVE ACTIVITY`

Show latest events, newest first.

Compact rows.

Types:

- check-in
- stay end
- upgrade
- downgrade
- Penthouse changed
- non-zero Room Service arrived
- successful Room Service claim

Failed claims are never public.

Do not make activity visually stronger than the hotel.

---

# 12. Market strip

Bottom-most compact section.

Purpose:

provide enough token context and trade access without turning HOTEL100 into a trading dashboard.

Possible fields:

- `$HOTEL`
- price
- market cap / FDV as canonical product decides
- liquidity
- holders
- contract copy
- buy/trade action

Keep one-row desktop treatment.

Charts are not required on the primary homepage MVP.

---

# 13. Motion

Motion should explain live occupancy.

Allowed:

- room/occupant transitions;
- subtle room highlight changes;
- smooth selected-room state;
- quiet Penthouse change emphasis;
- countdown transitions.

Recommended motion duration:

`180–400ms`

Avoid:

- confetti;
- bouncing;
- slot-machine effects;
- shaking;
- aggressive glowing;
- continuous ambient animation.

Respect `prefers-reduced-motion`.

---

# 14. Live data behavior

Frontend polls approximately every:

`2 seconds`

Show only confirmed/indexed state.

Never animate mempool/pending room changes.

If live ranking state is >30 seconds stale:

show:

`HOTEL SYNCING`

The building should remain visible, but stale state must be clearly marked and interactions that imply current certainty should be treated cautiously.

Reorg corrections update silently.

---

# 15. Responsive behavior

Desktop is the primary visual reference.

## Tablet

Below roughly `1100px`:

- Your Stay + Hotel remain principal;
- Room Service may move to a full-width row below;
- façade remains intact.

## Mobile

Below roughly `820px`:

Order:

1. header
2. Your Stay
3. hotel façade
4. Room Service
5. activity
6. market

The 11-column façade must remain recognizably architectural.

Do not replace it with a generic ranking list merely because viewport is narrow.

Room windows may become smaller; selected-room details appear below.

No page-level horizontal scroll.

---

# 16. Accessibility

- room windows must be actual focusable controls when interactive;
- each room has an accessible name;
- selected room state is conveyed beyond color;
- sufficient cream/green contrast;
- keyboard selection must work;
- focus treatment must remain visible;
- countdown changes should not spam screen readers every second;
- reduced motion supported.

---

# 17. States to implement visually

Frontend implementation must explicitly support:

- pre-live: `HOTEL CHECK-IN OPENS SOON`
- live
- `LIVE — CANARY PENDING`
- `PASS — MVP LIVE` where relevant
- HOTEL SYNCING
- ROOM SERVICE ARRIVING
- ROOM SERVICE DELAYED
- connected checked-in guest
- connected lobby guest
- connected zero-balance former guest
- disconnected visitor
- occupied room
- vacant room
- connected user's room
- selected room
- Penthouse
- Room #100 threshold.

---

# 18. Forbidden UI shortcuts

Do not:

- render the core hotel as a table;
- use 100 generic rounded cards;
- replace the hotel with a leaderboard;
- use generic dashboard component-library aesthetics;
- make the page bright green;
- use neon outlines;
- use blurred glass panels;
- put token price chart in the visual centre;
- show Room Service rewards beside every room;
- imply Penthouse has a reward multiplier;
- invent social profiles or avatars;
- hide most room positions behind pagination on desktop.

---

# 19. Source-of-truth hierarchy

When implementing:

1. frozen HOTEL MVP product/technical specification governs behavior and economics;
2. this file governs visual implementation;
3. `HOTEL100_DESKTOP_PROTOTYPE.html` governs layout/interaction intent;
4. `HOTEL100_DESKTOP_MOCKUP.png` governs mood and architectural feel.

If implementation cannot preserve both the frozen product behavior and this design direction, report the conflict instead of silently redesigning.

---

# 20. Visual acceptance test

At 1440px desktop width, a reviewer should be able to glance at the page for less than five seconds and correctly answer:

- this is a hotel;
- there are 100 ranked rooms;
- #1 is the Penthouse;
- the connected user's room is visually obvious;
- Room Service is a core recurring mechanic;
- the site is live and data-driven;
- the interface does not look like a generic crypto dashboard.

If those answers are not obvious, visual implementation is not complete.
