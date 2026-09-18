# HOTEL100 — FRONTEND IMPLEMENTATION CURSOR PROMPT

## Purpose

Implement the HOTEL100 MVP frontend from a **frozen visual handoff**.

This prompt is intended for the frontend implementation gate of the greenfield HOTEL monorepo.

Do not redesign the interface.

Do not reinterpret the hotel façade into a generic leaderboard/dashboard.

---

# Required design inputs

Before making frontend changes, locate and read:

1. `HOTEL100_FRONTEND_DESIGN_SPEC.md`
2. `HOTEL100_DESKTOP_PROTOTYPE.html`
3. `HOTEL100_DESKTOP_MOCKUP.png`
4. the frozen HOTEL MVP master implementation specification already present in the project/audit context

Treat them as source-of-truth inputs.

Priority:

1. frozen product/security/financial specification = behavior/economics;
2. frontend design spec = visual rules;
3. HTML prototype = layout + interaction reference;
4. PNG mockup = visual mood + architectural reference.

If any conflict materially affects a frozen financial/security invariant:

`BLOCKED`

Do not improvise around it.

---

# First step — read-only frontend audit

Before changing frontend code, inspect:

- current web app framework/version;
- routing;
- global styles;
- font strategy;
- wallet connection UI;
- existing HOTEL APIs/types;
- ranking/room data interfaces;
- Room Service data interfaces;
- activity data;
- market data;
- live/sync operational state;
- current tests;
- screenshot/e2e capability.

Write:

`audit/hotel100-frontend-design-implementation-plan.md`

Include:

- current HEAD;
- branch;
- working-tree status;
- files to change;
- components to create;
- data adapters required;
- any backend endpoints not yet available;
- whether temporary local fixtures are required;
- visual implementation plan;
- responsive plan;
- test plan;
- explicit verdict.

Verdict:

`PASS — FRONTEND IMPLEMENTATION MAY BEGIN`

or:

`BLOCKED — FRONTEND IMPLEMENTATION REQUIRES REVIEW`

Do not proceed from BLOCKED.

---

# Core objective

Create a production-quality homepage where the **front façade of HOTEL100 is the primary interface**.

The site must look much closer to the supplied architectural mockup than to a generic crypto dashboard.

The building is not decorative background art.

It is an interactive representation of rooms #1–#100.

---

# Required component structure

Use repo conventions, but logical components should include equivalents of:

- `HotelHeader`
- `YourStayPanel`
- `HotelFacade`
- `Penthouse`
- `HotelRoom`
- `SelectedRoomSummary`
- `RoomServicePanel`
- `LiveActivity`
- `HotelMarketStrip`
- `HotelOperationalState`

Keep presentation and domain calculations separate.

Ranking and exact movement math must come from canonical shared logic, not be reimplemented loosely inside React components.

---

# Façade implementation

## Rank mapping

- #1 = Penthouse
- #2–#100 = main façade
- 99 standard room positions
- use 11 columns × 9 rows for desktop building geometry

Physical room positions are fixed.

Holder data occupies those positions according to live rank.

Do not dynamically reorder DOM room geometry in a way that changes the architectural numbering.

## Room interaction

Each room is focusable/selectable.

Selecting a room shows:

- room number;
- shortened occupant wallet;
- balance;
- `YOU` when applicable.

Occupied/vacant/you/selected states must visually match the design spec.

## Own room

Connected user's current room must be immediately recognizable through restrained gold treatment.

No animation gimmicks.

## Penthouse

Architecturally distinct.

Do not imply economic bonus.

---

# Desktop layout

At large widths:

left:
`Your Stay`

centre:
interactive `HotelFacade`

right:
`Room Service`

Below:

`Live Activity`

Then:

compact token market strip.

No large hero.

No dominant chart.

No dashboard tile explosion.

---

# Responsive requirements

Preserve the actual building concept.

At tablet:
- allow Room Service to drop below main two columns if required.

At mobile:
- Your Stay
- hotel
- Room Service
- activity
- market

The 11-column room geometry may compress but must remain recognizable.

No page-level horizontal scroll.

---

# Fonts

Use the design spec.

Preferred:

- editorial serif: `Newsreader`
- body: `Inter`
- data: `IBM Plex Mono`

Use framework-native font loading.

Avoid layout shift.

---

# Tokens

Create canonical CSS variables/design tokens from the exact palette in `HOTEL100_FRONTEND_DESIGN_SPEC.md`.

Do not substitute a different aesthetic palette.

---

# Functional states

Implement UI support for:

- HOTEL CHECK-IN OPENS SOON
- live
- LIVE — CANARY PENDING
- PASS — MVP LIVE where surfaced
- HOTEL SYNCING
- ROOM SERVICE ARRIVING
- ROOM SERVICE DELAYED
- disconnected
- checked-in guest
- lobby guest
- zero-balance former guest
- occupied
- vacant
- selected
- user's room
- Penthouse.

Use real backend state if available.

If a backend endpoint is not yet implemented, use a clearly isolated typed fixture/adapter for visual development only.

Never let fixture data leak into production-live mode.

---

# Polling + live behavior

Honor frozen MVP behavior:

- approximately 2-second live polling;
- confirmed/indexed room state only;
- no mempool movement;
- >30-second stale ranking state => HOTEL SYNCING;
- reorg corrections update silently.

Do not implement financial truth in the frontend.

---

# Room Service UI

Use exact HOTEL language:

`ROOM SERVICE`

Not:

- Rewards
- Yield
- Earnings Program

Connected guest should see:

- cumulative claimable/waiting amount;
- claim action;
- next Service countdown.

At countdown boundary:

`ROOM SERVICE ARRIVING`

On worker/finalization delay:

`ROOM SERVICE DELAYED`

Do not expose low-level worker error detail publicly.

---

# Exact movement requirement

Display exact raw-unit-derived amount needed to:

- move up one room when checked in;
- check into Room 100 when in lobby.

Consume canonical shared ranking/movement calculation.

Do not estimate this in UI.

---

# Visual QA

Before declaring PASS:

1. run web lint/typecheck/tests;
2. build production frontend;
3. run viewport checks at minimum:
   - 1440px desktop
   - 1024px tablet
   - 390px mobile
4. capture screenshots if repo tooling supports it;
5. compare against:
   - `HOTEL100_DESKTOP_MOCKUP.png`
   - `HOTEL100_DESKTOP_PROTOTYPE.html`
   - design spec
6. specifically verify that the result reads visually as a hotel façade, not a dashboard.

If screenshot tooling is absent, add a lightweight standard screenshot/e2e workflow only if appropriate for the existing web stack.

Do not introduce large infrastructure solely for screenshot comparison.

---

# Acceptance checklist

PASS requires:

- architectural hotel façade visible immediately;
- all 100 room positions represented;
- #1 clearly Penthouse;
- #2–#100 mapped consistently;
- connected user's room visually obvious;
- vacant room state;
- selected room interaction;
- exact movement requirement;
- Your Stay panel;
- Room Service panel;
- 15-minute countdown presentation;
- activity;
- market strip;
- responsive implementation;
- keyboard/accessibility basics;
- reduced-motion handling;
- syncing/delayed/arriving states;
- no generic crypto-dashboard redesign;
- no fabricated production data;
- no production broadcast or launch action.

---

# Audit report

When complete, write:

`audit/hotel100-frontend-implementation.md`

Include:

- UTC timestamp;
- branch;
- pre-HEAD;
- final HEAD if committed;
- files changed;
- screenshots/viewport checks performed;
- tests;
- lint;
- typecheck;
- build result;
- states implemented;
- any fixture-backed states;
- remaining backend integration points;
- design deviations and exact reasons;
- production broadcasts performed: `NONE`;
- verdict.

Verdict:

`PASS — HOTEL100 FRONTEND DESIGN IMPLEMENTED`

or:

`BLOCKED — HOTEL100 FRONTEND DESIGN INCOMPLETE`

The report must be saved as Markdown for download/upload back into ChatGPT.
