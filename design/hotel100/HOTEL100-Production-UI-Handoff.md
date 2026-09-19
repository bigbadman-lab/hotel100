# HOTEL100 — Production UI Handoff

Approved visual prototype (Lovable, TanStack Start) → production port target: `bigbadman-lab/hotel100`, `apps/web`.
Locked at **1440px**, **1024px**, **390px**. This document is extraction only: nothing here changes the design, and nothing here replaces production logic.

**Authoring note on the stylesheet.** The prototype CSS was built in successive approved passes appended to the same file, so several selectors appear more than once. The *last* occurrence in source order is the approved value. Section 17 reproduces the stylesheet verbatim and in order so cascade order is preserved — port it as a whole block, do not cherry-pick individual rules.

---

## 1. Page structure

```text
.hotel-shell                                  (page shell, max-width 1448px, centred)
├── header.hotel-header                       HotelHeader
│   ├── .hotel-header__brand
│   │   ├── .hotel-header__bell  (BellIcon)
│   │   ├── img.hotel-header__logo            hotel100-logo3.png
│   │   └── .hotel-header__tagline            "100 rooms. No reservations."
│   └── .hotel-header__meta
│       ├── .hotel-pill[.hotel-pill--live]    ·dot· LIVE / operational state
│       ├── .hotel-header__rule
│       ├── .hotel-header__service            .hotel-label "Next service" + .hotel-header__clock
│       └── button.hotel-wallet-btn           wallet / "Connect Wallet"
├── main.hotel-main
│   ├── .hotel-grid                           300px | 1fr | 300px
│   │   ├── section.hotel-panel.hotel-stay            YourStayPanel
│   │   ├── section.hotel-facade                      HotelFacade
│   │   │   ├── .hotel-facade__sky
│   │   │   ├── .hotel-building
│   │   │   │   ├── .hotel-building__pediment > .hotel-building__finial
│   │   │   │   ├── .hotel-building__parapet  (cornice, logo, motto)
│   │   │   │   ├── .hotel-penthouse                  (pilasters, terrace, pavilion, holder)
│   │   │   │   ├── .hotel-rows                       10 × .hotel-row  (+ 2 tall pilasters)
│   │   │   │   ├── .hotel-entrance                   (wings, lamps, canopy, doors, plaque)
│   │   │   │   ├── .hotel-plinth                     2 steps
│   │   │   │   └── .hotel-hedge                      22 × .hotel-hedge__tree
│   │   │   └── .hotel-facade__foot            selected-room line OR quiet rule
│   │   └── section.hotel-panel.hotel-service         RoomServicePanel
│   ├── section.hotel-panel.hotel-activity            LiveActivity
│   └── section.hotel-panel.hotel-market              MarketStrip
├── footer.hotel-footer                        brand · sep · tag · "Enter the Lobby" · motto
└── LobbySheet (.hotel-lobby, overlay, rank #101+)
```

## 2. Desktop dimensions (1440px)

| Concern | Final value |
|---|---|
| Outer page max-width | `.hotel-shell { max-width: 1464px }` (base 1448px, overridden in the architectural pass) |
| Page padding | `0 20px 28px` (base `0 24px 28px`) |
| Header | flex row, `padding: 14px 4px 16px`, `gap: 24px`, 1px bottom border; logo/bell 30px → no fixed height |
| Main | `.hotel-main { padding-top: 18px; display: grid; gap: 16px }` |
| Main grid | `.hotel-grid { grid-template-columns: 268px minmax(0,1fr) 268px; gap: 20px; align-items: start }` |
| Side-panel width | 268px each |
| Hotel width | remaining `1fr` (~£ 1424 − 536 − 40 ≈ 848px); façade `padding: 8px 2px 0` at final pass, no border/radius, heavy drop shadow on `.hotel-building` |
| Façade proportion | driven by content: parapet + penthouse + 10 storeys + entrance + plinth + hedge |
| Penthouse | `.hotel-penthouse { grid-template-columns: 180px 1fr 180px; padding: 14px 28px 16px }`, `__suite { height: 84px }` |
| Standard rooms | `.hotel-rows { padding: 0 26px }`, `.hotel-row { display:flex; justify-content:space-between; padding: 6px 0 7px; gap: 12px }` |
| Window | `.hotel-window { width: 66px }`, `__glass { width: 56px; height: 30px }` |
| Entrance | `padding: 46px 24px 0`; doors `284 × 108`; canopy `height: 28px`; lamps `height: 92px`; dome `112 × 32` |
| Plinth / hedge | step `58%` wide × `9px`; hedge `height: 34px`, `padding: 0 6px` |
| Live Activity | rows `grid-template-columns: 50px 22px 1fr auto`, `padding: 9px 14px`-class rhythm, 1px separators, odd rows tinted 3% stone |
| Market strip | flex row, `gap: 16px`, gold top border `1px solid color-mix(in oklab, var(--hotel-gold) 18%, transparent)` |

## 3. Room geometry (Rooms #2–#100)

- **Columns:** 10 per floor. **Floors:** 10 rows.
- **Order strategy** (`buildRows`): filter `room >= 2`; row 1 = first **9** rooms (2–10); rows 2–10 = successive slices of 10. DOM order is ascending room number, top row first — the top floor is intentionally short by one because the Penthouse occupies rank #1.
- **Room element:** `button.hotel-window` — `width: 66px`, inline style `--lamp: (room % 5) / 10` for per-room lamp variation (deterministic, not random, never affects occupancy data).
- **Window internals (in order):** `.hotel-window__lintel`, `.hotel-window__glass` (containing `.hotel-window__curtain`, `.hotel-window__curtain--right`, `.hotel-window__mullion`, `.hotel-window__transom`), `.hotel-window__sill`, `.hotel-window__plaque > .hotel-window__number.hotel-mono` (room number, `padStart(2,"0")`).
- **Occupied:** `.is-occupied` — warm cream→gold glass gradient, curtains at low opacity, gold glow, `::after` lamp bloom; brightness varied by `nth-child(2n|7n|9n)`.
- **Vacant:** `.is-vacant` — `linear-gradient(180deg,#050f0b,#030907)` with inset shadow, no glow.
- **Connected:** `.is-connected` — muted-gold outline + glow on the glass (restrained, no pulse).
- **Selected/focus:** `.is-selected` — `outline: 1px solid var(--hotel-cream)`; native focus-visible ring retained.
- Production keeps its real rank→room mapping; only classes and DOM structure are adopted.

## 4. Penthouse construction

`.hotel-penthouse` is a 3-column grid `180px 1fr 180px` (mobile: `grid-template-areas: "pavilion" "holder"`).

- `.hotel-pilaster--left/--right` flank it.
- `.hotel-penthouse__terrace` with 4 × `.hotel-penthouse__baluster`.
- `.hotel-penthouse__pavilion`: `.hotel-penthouse__roof` (clip-path), `.hotel-penthouse__suite` (height 84px; `.hotel-penthouse__chandelier` + three `.hotel-penthouse__arch`, the middle one `--wide`), recess created by `.hotel-penthouse__suite::before` plus layered inset shadows on the pavilion (final polish pass).
- `button.hotel-penthouse__plaque` → `.hotel-penthouse__label` "Penthouse", `.hotel-penthouse__number` "Room 01" (lining numerals enforced so 01 never reads as OI). Gains `.is-connected` / `.is-selected` like a room.
- `.hotel-penthouse__holder`: `.hotel-penthouse__holderWallet` + `.hotel-penthouse__holderBalance` (mono), right-aligned on desktop, centred/static ≤560px.
- Roof/pediment relationship: `.hotel-building__pediment` (58% wide, with finial) sits above `.hotel-building__parapet` (repeating-gradient balustrade + cornice + 30px logo + motto), then the penthouse.

## 5. Entrance construction

5-column grid: wing · lamp · (canopy/doors/plaque) · lamp · wing; `padding: 46px 24px 0`.

- `.hotel-entrance__wing` ×2, each with 3 × `.hotel-entrance__bay` (arched warm ground-floor bays).
- `.hotel-entrance__canopy` — `height: 28px` (34px with the stone lip in the polish pass), `::after` cornice lip, `.hotel-entrance__dome` (112 × 32) and `.hotel-entrance__valance`.
- `.hotel-entrance__doors` — `284 × 108`, 2px stone border, warm radial lobby light from the bottom, `::before` cream light bar at the top; two `.hotel-entrance__door` 70 × 88 with gold glow and inset stone reveal.
- `.hotel-entrance__sign` — "HOTEL100", cream, `top: -27px`, `letter-spacing: .34em`, dark text-shadow, sits over the canopy (`z-index` above it).
- `.hotel-entrance__lamp` ×2 — 92px posts with gold lantern head and upward gold glow.
- `.hotel-entrance__plaque` — full-width stone plaque, "100 rooms. / No reservations."
- `.hotel-plinth` — two steps (`58%`/wider, 9px). `.hotel-hedge` — 22 low trees, 34px, `padding: 0 6px`, never overlapping clickable windows.

## 6. Color tokens (`:root`, oklch)

Base set (lines 68–82) and the warm-stone overrides from the architectural pass (later in `:root`, authoritative):

| Token | Base | Final override |
|---|---|---|
| `--hotel-bg` (page bg) | `oklch(0.214 0.041 162.4)` | — |
| `--hotel-bg-2` | `oklch(0.256 0.046 162.6)` | — |
| `--hotel-panel` | `oklch(0.278 0.045 162.8)` | — |
| `--hotel-panel-2` | `oklch(0.302 0.046 162.6)` | — |
| `--hotel-stone` | `oklch(0.835 0.047 88.3)` | `oklch(0.845 0.055 80.5)` |
| `--hotel-stone-dark` | `oklch(0.775 0.055 89.5)` | `oklch(0.775 0.062 79.5)` |
| `--hotel-cream` | `oklch(0.941 0.033 88.6)` | `oklch(0.948 0.038 84.5)` |
| `--hotel-muted` (secondary text) | `oklch(0.729 0.014 138.9)` | — |
| `--hotel-line` (borders/separators) | `oklch(0.406 0.043 160.5)` | — |
| `--hotel-glass` | `oklch(0.315 0.039 163.4)` | — |
| `--hotel-glass-light` | `oklch(0.394 0.048 162.8)` | — |
| `--hotel-gold` (muted gold / connected) | `oklch(0.746 0.117 78.6)` | `oklch(0.762 0.108 76.0)` |
| `--hotel-gold-soft` | `oklch(0.85 0.101 82.6)` | `oklch(0.872 0.092 80.0)` |
| `--hotel-window` (occupied light) | `oklch(0.836 0.111 76.4)` | `oklch(0.858 0.118 72.5)` |
| `--hotel-danger` | `oklch(0.646 0.093 25.5)` | — |

Other literals: vacant glass `#050f0b → #030907`; panel shadow `0 18px 40px -28px rgb(0 0 0 / .75)`; button fill `linear-gradient(180deg, var(--hotel-cream), var(--hotel-stone))` on `--hotel-bg` text. The shadcn semantic tokens (`--background`, `--primary`, …) alias these hotel tokens; keep that mapping or drop it if production has no shadcn layer.

## 7. Typography

```css
--font-display: "Cormorant Garamond", Georgia, serif;
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

Loaded from Google Fonts in the document head (Next: `next/font` or a `<link>` in `app/layout.tsx`):
`https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap`

- **Serif (display)** for titles, room numbers, plaques, wallet button, taglines, quotes; italic for mottos/sub-copy.
- **Sans (Inter)** for body/UI copy.
- **Mono (IBM Plex Mono)** for all data: wallets, balances, clocks, activity text — `.hotel-mono { font-feature-settings: "tnum" }`.
- **Lining numerals enforced** (`font-variant-numeric: lining-nums`) on all display numerals so "01" never reads as "OI".
- Uppercase + wide tracking for labels: `.hotel-label { font-size: .625rem; letter-spacing: .18em; text-transform: uppercase }`; pills `.68rem / .16em`.
- Major 1440 sizes: panel title `1.3rem / .3em / 500`; Your Stay room number `5rem`; balance `1.85rem`; service value `2.55rem` (fluid clamp, see §9); header clock `1.05rem`; wallet button `1.02rem`; entrance sign `.86rem / .34em`.
- Mobile overrides (≤560px): panel title `1.02rem / .2em`; service value `2.1rem`; room numbers `0.45rem`; holder text `0.62rem`.

## 8. Your Stay panel

`section.hotel-panel.hotel-stay` → `.hotel-panel__head > h2.hotel-panel__title` ("Your Stay").

Disconnected: `.hotel-stay__empty` with `__emptyLead` ("No key issued.", serif 1.5rem), `__emptyBody`, `button.hotel-btn.hotel-btn--ghost`.

Connected, in order:
1. `.hotel-walletcard` — `__label` (dot + "Connected wallet") and `__value` (mono wallet 1rem + 16px `__copy` icon), stone-tinted glass background, 1px line border.
2. `button.hotel-stay__room` — `.hotel-label` "Room", `.hotel-stay__roomNumber` (serif, 5rem, lining numerals), `.hotel-stay__rank` ("Rank #n"), 1px bottom separator.
3. `.hotel-stay__balance` — `__balanceValue` (mono 1.85rem) + `__balanceUnit` "HOTEL".
4. `.hotel-movement` — arrow-up icon + `__amount` (mono "n HOTEL") + `__caption` ("to Room n"); rendered only when a movement exists.
5. `dl.hotel-stay__facts` — two `.hotel-stay__fact` rows: clock icon + "Checked in" / duration; star icon + "Best room" / `#n`.
6. `.hotel-fob` — `__tag` (`__ring`, `__mark` "HOTEL100", `__sub` "Stay higher") and `p.hotel-fob__motto` "Same / guests. / Higher / rooms." split by `<br>` for the desktop four-line stack; ≤560px the `<br>`s are hidden and it wraps to two centred lines (`max-width: 22ch`, `letter-spacing: .16em`, `line-height: 1.7`).

## 9. Room Service panel

`section.hotel-panel.hotel-service`:
- `.hotel-panel__head--icon` with `.hotel-service__bell` + title "Room Service".
- `.hotel-service__lead` — italic serif "The pool awaits".
- `.hotel-service__amount.hotel-service__amount--{state}` (`waiting|arriving|delayed`) — desktop `padding: 26px 20px 20px`, `margin: 12px 14px 0`; contains `.hotel-service__value` (mono, gold-soft) with nested `.hotel-service__unit` "ETH" (`margin-left: 8px`) and `.hotel-service__state` (state label).
- **Overflow guard (final, approved):**
  ```css
  .hotel-service__amount { overflow: hidden; }
  .hotel-service__amount > * { max-width: 100%; }
  .hotel-service__value { font-size: clamp(1.6rem, 2.1vw, 2.45rem); }
  ```
- `button.hotel-btn.hotel-btn--claim` — full-width; disabled when not connected or already claimed; ≤560px `min-height: 46px`.
- `.hotel-service__note` — contextual caption (production: replace prototype copy with real transaction/claim guidance).
- `dl.hotel-service__facts` — "Next service" (mono countdown `mm:ss`) and "Last service" (mono ETH + `__factUnit`).
- `blockquote.hotel-service__quote` — "Same guests. / Bigger stays." + `<cite>HOTEL100</cite>`.

## 10. Header

Logo `hotel100-logo3.png` at `height: 30px` beside a 30px bell glyph; `.hotel-header__tagline` italic serif `.95rem` stone-75%. Right cluster `gap: 18px`: LIVE pill (dot + uppercase state), 1px 22px rule, "Next service" label + mono clock `1.05rem`, then `.hotel-wallet-btn` (serif 1.02rem, cream→stone gradient, dark text, 3px radius, brightness hover).
- **≤1200px:** tagline hidden, spacing tightened; header height unchanged.
- **≤560px:** header wraps to a compact two-line composition — 22px bell/logo, compacted pill and clock, wallet button `min-height: 44px`; identity, LIVE, next service and wallet all retained.

## 11. Live Activity

`section.hotel-panel.hotel-activity`:
- `.hotel-activity__head`: title (dot + "Live Activity"), `__sub` "Real-time hotel activity", `__all` ("All activity" + arrow).
- `ul.hotel-activity__list > li.hotel-activity__row`: `grid-template-columns: 50px 22px 1fr auto` — mono `hh:mm`, `.hotel-activity__icon.is-{kind}`, mono `__text`, `__ago` relative time.
- Icons by event kind: check-in→Key, upgrade→ArrowUp, downgrade→ArrowDown, room-service→Bell, penthouse→Crown, check-out→Door.
- Separators: 1px `--hotel-line` bottom border, none on last row; odd rows tinted 3% stone for contrast.
- **≤560px:** rows become a compact two-line treatment (icon + text on line 1, relative time + timestamp on line 2); fewer rows may be shown initially with "All activity" as the route to more.

## 12. HOTEL Market

`section.hotel-panel.hotel-market`: title (market icon + "Hotel Market"), `__rule`, `dl.hotel-market__figures` with four `.hotel-market__figure` (`$HOTEL`, `MC`, `LIQ`, `Holders`), then `button.hotel-btn.hotel-btn--trade`.
- `priceUsd`, `marketCapUsd`, `liquidityUsd` are `null` in the canonical state → rendered as `.hotel-market__unavailable` **"Not published"**. Never substitute a value.
- `Holders` is a real canonical figure (mono).
- `tradeUrl === null` → the trade button is `disabled` with `title="No trade destination is published by the hotel state API"`.
- Gold top border for contrast; `flex-wrap: wrap` ≤1200px; full vertical stack with full-width trade button ≤560px.

## 13. Responsive breakpoints

**≤1200px** — grid `228px minmax(0,1fr) 228px`, gap 14px; shell padding `0 16px 24px`; header tagline hidden; rows `padding: 0 14px`, row `5px 0 6px` / gap 6px; window 44px, glass 38 × 22; penthouse `116px 1fr 116px`, padding `12px 16px 14px`, suite 64px; entrance `padding: 34px 12px 0`, canopy/doors 156px wide, doors 86px tall; service value 2rem, amount `margin 12px 12px 0 / padding 18px 10px 14px`; market `gap 16px; flex-wrap: wrap`; activity rows `50px 22px 1fr auto / gap 10px / padding 9px 14px`; Your Stay fob stacks.

**≤880px** — `.hotel-grid { grid-template-columns: minmax(0,1fr); gap: 14px }` → single column in the approved stack order (header, Your Stay, façade, Room Service, Live Activity, Market, Lobby).

**≤560px** — shell padding `0 12px 20px`; façade `padding: 10px 6px 0`; rows `padding: 0 5px`, gap 3px; row `3px 0 4px`, gap 2px; window 30px, glass 26 × 15, transoms hidden; penthouse single column `grid-template-areas: "pavilion" "holder"`, suite 52px, arches 26/52px, holder forced `static` + centred; entrance `padding: 26px 6px 0`, canopy 108 × 20, doors 108 × 60, wings hidden; hedge 22px; panels compact, claim button 46px; activity two-line rows; market column-stacked `padding: 14px`; lobby sheet 96vw.

**390px polish (within ≤560px, final approved values)**
| Item | Value |
|---|---|
| Page top padding | `.hotel-main { padding-top: 10px; gap: 10px }` |
| Side padding | `.hotel-shell { padding: 0 8px 18px }` |
| Vertical stack gap | `.hotel-grid { gap: 10px }` |
| Façade width / padding | `.hotel-facade { padding: 8px 2px 0 }` → ~370px of 390 used; `scrollWidth` exactly 390 |
| Window / glass / number | `32px` / `28 × 16` / `0.45rem` |
| Rows padding | `.hotel-rows { padding: 0 8px }` |
| Penthouse holder card | `padding: 5px 10px; line-height: 1.15`; wallet & balance `0.62rem` |
| Room Service title | `.hotel-panel__title { font-size: 1.02rem; letter-spacing: .2em }` |
| Tagline wrapping | `.hotel-fob__motto br { display: none }`, `max-width: 22ch`, centred, `letter-spacing: .16em`, `line-height: 1.7` |
| Service value | `2.1rem` (still under the clamp guard) |

All 100 rooms (99 windows + Penthouse plaque) and 10 floors verified present at 1024 and 390; no horizontal overflow at any width.

## 14. Motion (complete, nothing new)

- **Room illumination / hover / selection:** CSS `transition` on colour, filter and box-shadow, `180ms ease`; windows do **not** animate continuously.
- **Connected-room emphasis:** static muted-gold outline + glow. No pulse, no flash.
- **Penthouse:** same transition model as rooms; no dedicated animation.
- **Room Service warmth** — the only keyframe animation, applied only while service is arriving:
  ```css
  @keyframes hotel-service-warmth {
    0%, 100% { box-shadow: 0 0 12px color-mix(in oklab, var(--hotel-gold) 26%, transparent); }
    50%      { box-shadow: 0 0 20px color-mix(in oklab, var(--hotel-gold) 42%, transparent); }
  }
  .hotel-facade--service .hotel-window.is-occupied .hotel-window__glass {
    animation: hotel-service-warmth 4s ease-in-out infinite;
  }
  ```
  `.hotel-facade--service` is applied when the countdown is ≤60s (prototype trigger — production drives it from real service timing).
- **Reduced motion:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
  ```
- No canvas, WebGL, per-room continuous animation, or heavy blur/filter stacks.

## 15. Accessibility

- Every room is a real `<button type="button">`; the Penthouse plaque is also a button. Keyboard tab order follows ascending room number.
- `aria-label` per room: `Room {n}, rank {rank}, occupied by {wallet}` / `Room {n}, vacant`; Penthouse: `Penthouse, Room 01, occupied by {wallet}` / `…, vacant`.
- Decorative architecture (`__sky`, pediment, parapet, pilasters, terrace, roof, suite, lintel, glass, curtains, sill, canopy, dome, lamps, bays, plinth, hedge) is `aria-hidden="true"`.
- Sections use `aria-labelledby` (`your-stay-heading`, `room-service-heading`, `activity-heading`, `market-heading`) and the façade uses `aria-label="HOTEL100 façade"`.
- Native `:focus-visible` rings retained; `.is-selected` adds a cream outline as a visible selection state distinct from focus.
- Touch targets ≤560px: claim button `min-height: 46px`, wallet button `min-height: 44px`. Room windows remain small by design (32px) — they are supplemented by the selected-room detail line and the Your Stay room control.
- Disabled trade button carries an explanatory `title`.

## 16. Assets

**Already in production repo**
- `apps/web/public/brand/hotel100-logo3.png` — canonical wordmark. Used twice: header (`height: 30px`) and building parapet (`height: 30px`). Do not rename, recolor, crop, distort, or add glow.

**Created for the prototype**
- `public/favicon.png` (64 × 64, derived from the logo) — port only if production lacks a favicon of equivalent provenance.
- `src/assets/hotel100-logo3.png` — a build-import copy of the canonical logo; **not** a new asset. In Next, import from the existing public path instead.

**Decorative elements implemented entirely in CSS (no assets needed)**
Pediment + finial, parapet balustrade and cornice, pilasters, stone floor bands, lintels, sills, mullions, transoms, curtains, window glass and lamp bloom, room-number plaques, penthouse roof/arches/chandelier/terrace balusters/recess, entrance canopy + dome + valance + doors + door glow + lobby light bar, exterior lamps, arched ground-floor bays, entrance plaque, two-step plinth, 22-tree hedge, all shadows and gradients, all icons (inline SVG in `icons.tsx`: Bell, Clock, Star, Copy, Ledger, Market, ArrowUp, ArrowDown, ArrowRight, Key, Crown, Door).

Fixture data is not an asset and must not be ported.

## 17. Exact CSS extraction

Verbatim `src/styles.css` from the approved prototype, in source order (cascade-critical). Logical sections in order of appearance: Tailwind/shadcn scaffolding → tokens/base → header → layout → panels (Your Stay, Room Service) → façade → penthouse → rooms → entrance → activity → market → lobby/footer → motion + reduced motion → refinement pass → architectural pass (warm-stone token overrides, façade/penthouse/rooms/entrance/landscaping/panels/lower-section) → final polish pass (entrance depth, penthouse recess, Room Service spacing) → responsive 1200 → 880 → 560 → 390 polish → ETH overflow guard.

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/*
 * Design system definition.
 *
 * The @theme inline block maps CSS custom properties to Tailwind utility
 * classes (e.g. --color-primary -> bg-primary, text-primary).
 *
 * The :root and .dark blocks define the actual color values using oklch.
 * All colors MUST use oklch format.
 *
 * To add a new semantic color:
 * 1. Add the variable to :root (light value) and .dark (dark value)
 * 2. Register it in @theme inline as --color-<name>: var(--<name>)
 */

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-ring-offset-background: var(--background);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.25rem;

  /* HOTEL100 frozen palette (design/hotel100/HOTEL100_FRONTEND_DESIGN_SPEC.md) */
  --hotel-bg: oklch(0.214 0.041 162.4);
  --hotel-bg-2: oklch(0.256 0.046 162.6);
  --hotel-panel: oklch(0.278 0.045 162.8);
  --hotel-panel-2: oklch(0.302 0.046 162.6);
  --hotel-stone: oklch(0.835 0.047 88.3);
  --hotel-stone-dark: oklch(0.775 0.055 89.5);
  --hotel-cream: oklch(0.941 0.033 88.6);
  --hotel-muted: oklch(0.729 0.014 138.9);
  --hotel-line: oklch(0.406 0.043 160.5);
  --hotel-glass: oklch(0.315 0.039 163.4);
  --hotel-glass-light: oklch(0.394 0.048 162.8);
  --hotel-gold: oklch(0.746 0.117 78.6);
  --hotel-gold-soft: oklch(0.85 0.101 82.6);
  --hotel-window: oklch(0.836 0.111 76.4);
  --hotel-danger: oklch(0.646 0.093 25.5);

  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  --background: var(--hotel-bg);
  --foreground: var(--hotel-cream);
  --card: var(--hotel-panel);
  --card-foreground: var(--hotel-cream);
  --popover: var(--hotel-panel);
  --popover-foreground: var(--hotel-cream);
  --primary: var(--hotel-gold);
  --primary-foreground: var(--hotel-bg);
  --secondary: var(--hotel-panel-2);
  --secondary-foreground: var(--hotel-cream);
  --muted: var(--hotel-panel-2);
  --muted-foreground: var(--hotel-muted);
  --accent: var(--hotel-glass-light);
  --accent-foreground: var(--hotel-cream);
  --destructive: var(--hotel-danger);
  --destructive-foreground: var(--hotel-cream);
  --border: var(--hotel-line);
  --input: var(--hotel-line);
  --ring: var(--hotel-gold);
  --chart-1: var(--hotel-gold);
  --chart-2: var(--hotel-stone);
  --chart-3: var(--hotel-glass-light);
  --chart-4: var(--hotel-cream);
  --chart-5: var(--hotel-muted);
  --sidebar: var(--hotel-panel);
  --sidebar-foreground: var(--hotel-cream);
  --sidebar-primary: var(--hotel-gold);
  --sidebar-primary-foreground: var(--hotel-bg);
  --sidebar-accent: var(--hotel-panel-2);
  --sidebar-accent-foreground: var(--hotel-cream);
  --sidebar-border: var(--hotel-line);
  --sidebar-ring: var(--hotel-gold);
}


.dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  --card: oklch(0.208 0.042 265.755);
  --card-foreground: oklch(0.984 0.003 247.858);
  --popover: oklch(0.208 0.042 265.755);
  --popover-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.929 0.013 255.508);
  --primary-foreground: oklch(0.208 0.042 265.755);
  --secondary: oklch(0.279 0.041 260.031);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.279 0.041 260.031);
  --muted-foreground: oklch(0.704 0.04 256.788);
  --accent: oklch(0.279 0.041 260.031);
  --accent-foreground: oklch(0.984 0.003 247.858);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.984 0.003 247.858);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.208 0.042 265.755);
  --sidebar-foreground: oklch(0.984 0.003 247.858);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.279 0.041 260.031);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.858);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.551 0.027 264.364);
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}

/* ==========================================================================
   HOTEL100 — desktop visual prototype (1440px first)
   Palette, proportions and hierarchy follow HOTEL100_DESKTOP_MOCKUP.png.
   ========================================================================== */

body {
  font-family: var(--font-sans);
  background:
    radial-gradient(1200px 700px at 50% -10%, var(--hotel-bg-2), transparent 70%),
    var(--hotel-bg);
}

.hotel-mono { font-family: var(--font-mono); font-feature-settings: "tnum"; }

.hotel-label {
  font-size: 0.625rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--hotel-muted);
}

.hotel-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--hotel-gold-soft);
  box-shadow: 0 0 6px color-mix(in oklab, var(--hotel-gold) 60%, transparent);
  display: inline-block;
}

.hotel-shell {
  width: 100%;
  max-width: 1448px;
  margin: 0 auto;
  padding: 0 24px 28px;
  color: var(--hotel-cream);
}

/* ---------- header ---------- */
.hotel-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
  padding: 14px 4px 16px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-line) 70%, transparent);
}
.hotel-header__brand { display: flex; align-items: center; gap: 14px; }
.hotel-header__bell { width: 30px; height: 30px; color: var(--hotel-stone); }
.hotel-header__bell svg { width: 100%; height: 100%; }
.hotel-header__logo { height: 30px; width: auto; object-fit: contain; }
.hotel-header__tagline {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.95rem;
  color: color-mix(in oklab, var(--hotel-stone) 75%, transparent);
}
.hotel-header__meta { display: flex; align-items: center; gap: 18px; }
.hotel-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border: 1px solid var(--hotel-line);
  border-radius: 999px;
  font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--hotel-cream);
  background: color-mix(in oklab, var(--hotel-panel) 80%, transparent);
}
.hotel-header__rule { width: 1px; height: 22px; background: var(--hotel-line); }
.hotel-header__service { display: flex; align-items: baseline; gap: 12px; }
.hotel-header__clock { font-size: 1.05rem; color: var(--hotel-cream); letter-spacing: 0.06em; }
.hotel-wallet-btn {
  font-family: var(--font-display);
  font-size: 1.02rem;
  padding: 9px 22px;
  color: var(--hotel-bg);
  background: linear-gradient(180deg, var(--hotel-cream), var(--hotel-stone));
  border: 1px solid var(--hotel-stone-dark);
  border-radius: 3px;
  transition: filter 180ms ease, transform 180ms ease;
}
.hotel-wallet-btn:hover { filter: brightness(1.05); }

/* ---------- layout ---------- */
.hotel-main { padding-top: 18px; display: grid; gap: 16px; }
.hotel-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

.hotel-panel {
  background: linear-gradient(180deg, var(--hotel-panel), var(--hotel-bg-2));
  border: 1px solid var(--hotel-line);
  border-radius: 4px;
  box-shadow: 0 18px 40px -28px rgb(0 0 0 / 0.75);
}
.hotel-panel__head {
  display: flex; align-items: center; gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-line) 70%, transparent);
}
.hotel-panel__title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--hotel-cream);
}

/* ---------- your stay ---------- */
.hotel-stay { padding-bottom: 18px; }
.hotel-walletcard {
  margin: 16px 20px 0;
  padding: 12px 14px;
  border: 1px solid var(--hotel-line);
  border-radius: 3px;
  background: color-mix(in oklab, var(--hotel-glass) 65%, transparent);
  display: grid; gap: 8px;
}
.hotel-walletcard__label {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--hotel-muted);
}
.hotel-walletcard__value {
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--font-mono); font-size: 1rem; color: var(--hotel-cream);
}
.hotel-walletcard__copy { width: 16px; height: 16px; color: var(--hotel-muted); }

.hotel-stay__room {
  display: grid; gap: 2px; text-align: left;
  padding: 18px 20px 16px;
  width: 100%;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-line) 60%, transparent);
}
.hotel-stay__roomNumber {
  font-family: var(--font-display);
  font-size: 4.4rem; line-height: 0.92;
  color: var(--hotel-cream);
}
.hotel-stay__rank { font-size: 0.8rem; color: var(--hotel-muted); }
.hotel-stay__balance { display: flex; align-items: baseline; gap: 8px; padding: 16px 20px 12px; }
.hotel-stay__balanceValue { font-size: 1.6rem; letter-spacing: 0.02em; color: var(--hotel-cream); }
.hotel-stay__balanceUnit { font-size: 0.7rem; letter-spacing: 0.18em; color: var(--hotel-muted); }

.hotel-movement {
  margin: 0 20px;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  border: 1px solid color-mix(in oklab, var(--hotel-gold) 32%, var(--hotel-line));
  border-radius: 3px;
  background: color-mix(in oklab, var(--hotel-glass) 55%, transparent);
}
.hotel-movement__icon { width: 20px; height: 20px; color: var(--hotel-gold-soft); }
.hotel-movement__icon svg { width: 100%; height: 100%; }
.hotel-movement__body { display: grid; }
.hotel-movement__amount { font-size: 1rem; color: var(--hotel-cream); }
.hotel-movement__caption {
  font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--hotel-muted);
}

.hotel-stay__facts { padding: 16px 20px 6px; display: grid; gap: 10px; }
.hotel-stay__fact {
  display: grid; grid-template-columns: 18px auto 1fr; align-items: center; gap: 10px;
  font-size: 0.88rem; color: var(--hotel-cream);
}
.hotel-stay__fact dt { color: var(--hotel-muted); }
.hotel-stay__fact dd { color: var(--hotel-cream); }
.hotel-stay__factIcon { width: 18px; height: 18px; color: var(--hotel-stone); }

.hotel-fob { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; padding: 18px 20px 4px; }
.hotel-fob__tag {
  position: relative;
  padding: 14px 10px 12px 24px;
  border: 1px solid var(--hotel-line);
  border-radius: 8px 14px 14px 8px;
  background: linear-gradient(140deg, var(--hotel-glass-light), var(--hotel-glass));
  text-align: center;
  box-shadow: inset 0 1px 0 color-mix(in oklab, var(--hotel-stone) 14%, transparent);
}
.hotel-fob__ring {
  position: absolute; left: 6px; top: 50%; transform: translateY(-50%);
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid color-mix(in oklab, var(--hotel-stone) 55%, transparent);
}
.hotel-fob__mark {
  display: block; font-family: var(--font-display);
  font-size: 0.82rem; letter-spacing: 0.14em; color: var(--hotel-cream);
}
.hotel-fob__sub {
  display: block; margin-top: 3px;
  font-size: 0.52rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--hotel-muted);
}
.hotel-fob__motto {
  font-family: var(--font-display);
  font-size: 0.78rem; letter-spacing: 0.2em; text-transform: uppercase;
  line-height: 1.5; color: var(--hotel-stone);
}

.hotel-stay__empty { padding: 24px 20px; display: grid; gap: 10px; }
.hotel-stay__emptyLead { font-family: var(--font-display); font-size: 1.5rem; color: var(--hotel-cream); }
.hotel-stay__emptyBody { font-size: 0.85rem; line-height: 1.6; color: var(--hotel-muted); }

/* ---------- buttons ---------- */
.hotel-btn {
  font-family: var(--font-display);
  letter-spacing: 0.1em;
  border-radius: 3px;
  transition: filter 180ms ease, border-color 180ms ease, color 180ms ease;
}
.hotel-btn--ghost {
  padding: 10px 16px; border: 1px solid var(--hotel-line); color: var(--hotel-cream);
  background: color-mix(in oklab, var(--hotel-glass) 60%, transparent);
}
.hotel-btn--ghost:hover { border-color: var(--hotel-gold); }
.hotel-btn--claim {
  margin: 14px 20px 0; padding: 14px 18px;
  display: block; width: calc(100% - 40px);
  font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--hotel-bg);
  background: linear-gradient(180deg, var(--hotel-cream), var(--hotel-stone));
  border: 1px solid var(--hotel-stone-dark);
}
.hotel-btn--claim:hover:not(:disabled) { filter: brightness(1.05); }
.hotel-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.hotel-btn__icon { width: 15px; height: 15px; }

/* ---------- room service ---------- */
.hotel-service { padding-bottom: 20px; }
.hotel-panel__head--icon { align-items: center; }
.hotel-service__bell { width: 26px; height: 26px; color: var(--hotel-stone); }
.hotel-service__bell svg { width: 100%; height: 100%; }
.hotel-service__lead {
  padding: 14px 20px 0; text-align: center;
  font-size: 0.68rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--hotel-muted);
}
.hotel-service__amount {
  margin: 12px 20px 0; padding: 22px 12px 18px;
  border: 1px solid var(--hotel-line); border-radius: 3px;
  background: color-mix(in oklab, var(--hotel-glass) 55%, transparent);
  text-align: center;
  transition: border-color 600ms ease, background-color 600ms ease;
}
.hotel-service__amount--arriving {
  border-color: color-mix(in oklab, var(--hotel-gold) 45%, var(--hotel-line));
  background: color-mix(in oklab, var(--hotel-gold) 8%, var(--hotel-glass));
}
.hotel-service__value { font-size: 2.1rem; letter-spacing: 0.01em; color: var(--hotel-cream); }
.hotel-service__unit { font-size: 1.1rem; margin-left: 10px; color: var(--hotel-stone); }
.hotel-service__state {
  display: block; margin-top: 10px;
  font-size: 0.68rem; letter-spacing: 0.26em; text-transform: uppercase; color: var(--hotel-stone);
}
.hotel-service__note { padding: 8px 20px 0; font-size: 0.68rem; color: var(--hotel-muted); text-align: center; }
.hotel-service__facts {
  margin: 16px 20px 0; padding-top: 14px;
  border-top: 1px solid color-mix(in oklab, var(--hotel-line) 60%, transparent);
  display: grid; gap: 14px;
}
.hotel-service__fact { display: grid; grid-template-columns: 26px 1fr; gap: 12px; align-items: center; }
.hotel-service__factIcon { width: 22px; height: 22px; color: var(--hotel-stone); }
.hotel-service__fact dt { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--hotel-muted); }
.hotel-service__fact dd { font-size: 1.35rem; color: var(--hotel-cream); }
.hotel-service__factUnit { font-size: 0.85rem; color: var(--hotel-stone); }
.hotel-service__quote {
  padding: 20px 20px 0; font-family: var(--font-display); font-style: italic;
  font-size: 1.1rem; line-height: 1.35; color: var(--hotel-stone);
}
.hotel-service__quote cite {
  display: block; margin-top: 8px;
  font-style: normal; font-size: 0.62rem; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--hotel-muted);
}

/* ---------- façade ---------- */
.hotel-facade {
  position: relative;
  border: 1px solid var(--hotel-line);
  border-radius: 4px;
  overflow: hidden;
  background:
    radial-gradient(70% 55% at 50% 12%, color-mix(in oklab, var(--hotel-gold) 7%, transparent), transparent 70%),
    linear-gradient(180deg, var(--hotel-bg-2), var(--hotel-bg));
  padding: 14px 14px 0;
}
.hotel-facade__sky {
  position: absolute; inset: 0;
  background: radial-gradient(60% 40% at 50% 0%, color-mix(in oklab, var(--hotel-glass-light) 45%, transparent), transparent 75%);
  pointer-events: none;
}

.hotel-building { position: relative; }

.hotel-building__pediment {
  position: relative;
  height: 34px;
  margin: 0 auto;
  width: 46%;
  background: linear-gradient(180deg, var(--hotel-stone-dark), color-mix(in oklab, var(--hotel-stone-dark) 55%, var(--hotel-bg)));
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
}
.hotel-building__finial {
  position: absolute; left: 50%; top: -9px; transform: translateX(-50%);
  width: 7px; height: 9px; border-radius: 3px 3px 0 0;
  background: var(--hotel-gold);
}
.hotel-building__parapet {
  display: grid; justify-items: center; gap: 4px;
  padding: 10px 0 12px;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone-dark) 40%, var(--hotel-bg)), color-mix(in oklab, var(--hotel-stone-dark) 18%, var(--hotel-bg)));
  border-top: 1px solid color-mix(in oklab, var(--hotel-stone) 35%, transparent);
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-stone) 22%, transparent);
}
.hotel-building__logo { height: 26px; width: auto; }
.hotel-building__motto {
  font-family: var(--font-display);
  font-size: 0.6rem; letter-spacing: 0.3em; text-transform: uppercase;
  color: color-mix(in oklab, var(--hotel-stone) 85%, transparent);
}

/* penthouse storey */
.hotel-penthouse {
  position: relative;
  display: grid;
  grid-template-columns: 150px 1fr 150px;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 14px;
  background:
    radial-gradient(60% 120% at 50% 40%, color-mix(in oklab, var(--hotel-window) 18%, transparent), transparent 75%),
    linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone-dark) 22%, var(--hotel-bg-2)), color-mix(in oklab, var(--hotel-stone-dark) 12%, var(--hotel-bg-2)));
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-stone) 20%, transparent);
}
.hotel-penthouse__plaque {
  text-align: left;
  padding: 10px 14px;
  border: 1px solid color-mix(in oklab, var(--hotel-gold) 34%, var(--hotel-line));
  border-radius: 3px;
  background: color-mix(in oklab, var(--hotel-bg) 72%, transparent);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.hotel-penthouse__plaque:hover,
.hotel-penthouse__plaque.is-selected {
  border-color: var(--hotel-gold);
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--hotel-gold) 45%, transparent);
}
.hotel-penthouse__label {
  display: block;
  font-size: 0.62rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--hotel-stone);
}
.hotel-penthouse__number {
  display: block; margin-top: 2px;
  font-family: var(--font-display); font-size: 1.7rem; line-height: 1; color: var(--hotel-cream);
}
.hotel-penthouse__suite {
  position: relative;
  height: 74px;
  display: flex; align-items: flex-end; justify-content: center; gap: 14px;
}
.hotel-penthouse__arch {
  width: 52px; height: 58px;
  border-radius: 26px 26px 2px 2px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 45%, transparent);
  background:
    linear-gradient(180deg, color-mix(in oklab, var(--hotel-window) 88%, transparent), color-mix(in oklab, var(--hotel-gold) 55%, var(--hotel-glass)));
  box-shadow: 0 0 22px color-mix(in oklab, var(--hotel-gold) 32%, transparent);
}
.hotel-penthouse__arch--wide { width: 96px; height: 68px; border-radius: 48px 48px 2px 2px; }
.hotel-penthouse__chandelier {
  position: absolute; left: 50%; top: 10px; transform: translateX(-50%);
  width: 26px; height: 26px; border-radius: 50%;
  background: radial-gradient(circle, var(--hotel-gold-soft), transparent 68%);
  filter: blur(0.4px);
}
.hotel-penthouse__holder {
  justify-self: end;
  display: grid; gap: 3px; text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--hotel-line); border-radius: 3px;
  background: color-mix(in oklab, var(--hotel-bg) 72%, transparent);
}
.hotel-penthouse__holderWallet { font-size: 0.72rem; color: var(--hotel-muted); }
.hotel-penthouse__holderBalance { font-size: 0.86rem; color: var(--hotel-cream); }

/* room rows */
.hotel-rows {
  display: grid; gap: 4px;
  padding: 10px 14px 6px;
  background:
    repeating-linear-gradient(180deg, transparent 0 58px, color-mix(in oklab, var(--hotel-stone) 6%, transparent) 58px 59px),
    linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone-dark) 16%, var(--hotel-bg-2)), color-mix(in oklab, var(--hotel-stone-dark) 9%, var(--hotel-bg)));
}
.hotel-row { display: flex; justify-content: space-between; gap: 6px; }

.hotel-window {
  position: relative;
  width: 52px;
  display: grid; gap: 3px; justify-items: center;
  padding: 3px 3px 2px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 22%, transparent);
  border-radius: 2px;
  background: color-mix(in oklab, var(--hotel-bg) 60%, transparent);
  transition: box-shadow 500ms ease, border-color 500ms ease, transform 200ms ease;
}
.hotel-window__glass {
  position: relative;
  width: 100%; height: 34px;
  border-radius: 1px;
  overflow: hidden;
  background: linear-gradient(180deg, var(--hotel-glass), color-mix(in oklab, var(--hotel-bg) 85%, black));
  transition: background 700ms ease, box-shadow 700ms ease;
}
.hotel-window__mullion {
  position: absolute; left: 50%; top: 0; bottom: 0; width: 1px;
  background: color-mix(in oklab, var(--hotel-bg) 70%, black);
}
.hotel-window__curtain {
  position: absolute; top: 0; bottom: 0; left: 0; width: 34%;
  background: linear-gradient(90deg, color-mix(in oklab, var(--hotel-cream) 55%, transparent), transparent);
  opacity: 0;
  transition: opacity 700ms ease;
}
.hotel-window__curtain--right { left: auto; right: 0; transform: scaleX(-1); }
.hotel-window__number {
  font-size: 0.56rem; letter-spacing: 0.08em;
  color: color-mix(in oklab, var(--hotel-stone) 78%, transparent);
}

.hotel-window.is-occupied .hotel-window__glass {
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-window) 92%, transparent), color-mix(in oklab, var(--hotel-gold) 62%, var(--hotel-glass)));
  box-shadow: 0 0 12px color-mix(in oklab, var(--hotel-gold) 26%, transparent);
}
.hotel-window.is-occupied .hotel-window__curtain { opacity: 0.55; }
.hotel-window.is-vacant .hotel-window__glass { background: linear-gradient(180deg, #06120d, #040c08); }
.hotel-window.is-vacant .hotel-window__number { color: color-mix(in oklab, var(--hotel-stone) 42%, transparent); }

.hotel-window:hover { border-color: color-mix(in oklab, var(--hotel-stone) 55%, transparent); }
.hotel-window.is-selected { border-color: var(--hotel-cream); }
.hotel-window.is-connected {
  border-color: var(--hotel-gold);
  box-shadow: 0 0 0 1px var(--hotel-gold), 0 0 18px color-mix(in oklab, var(--hotel-gold) 32%, transparent);
}
.hotel-window.is-connected .hotel-window__number { color: var(--hotel-gold-soft); }
.hotel-window:focus-visible { outline: 2px solid var(--hotel-gold-soft); outline-offset: 2px; }

/* entrance */
.hotel-entrance {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  justify-items: center;
  gap: 10px;
  padding: 10px 16px 0;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone-dark) 12%, var(--hotel-bg)), var(--hotel-bg));
}
.hotel-entrance__canopy {
  position: relative; grid-column: 2;
  width: 168px; height: 26px;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone) 50%, transparent), color-mix(in oklab, var(--hotel-stone-dark) 28%, transparent));
}
.hotel-entrance__dome {
  position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%);
  width: 76px; height: 30px; border-radius: 40px 40px 0 0;
  background: linear-gradient(180deg, var(--hotel-glass-light), color-mix(in oklab, var(--hotel-stone-dark) 40%, transparent));
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 30%, transparent);
}
.hotel-entrance__doors {
  grid-column: 2; grid-row: 2;
  position: relative;
  width: 168px; height: 82px;
  display: flex; gap: 4px; justify-content: center; align-items: flex-end;
  padding: 0 12px 0;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 34%, transparent);
  border-bottom: none;
  background: radial-gradient(70% 90% at 50% 100%, color-mix(in oklab, var(--hotel-gold) 26%, transparent), transparent 70%);
}
.hotel-entrance__sign {
  position: absolute; top: 6px; left: 0; right: 0; text-align: center;
  font-family: var(--font-display);
  font-size: 0.68rem; letter-spacing: 0.26em; color: var(--hotel-gold-soft);
}
.hotel-entrance__door {
  width: 44px; height: 54px;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-window) 78%, transparent), color-mix(in oklab, var(--hotel-gold) 48%, var(--hotel-glass)));
  box-shadow: 0 0 20px color-mix(in oklab, var(--hotel-gold) 26%, transparent);
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 30%, transparent);
}
.hotel-entrance__lamp {
  align-self: end; justify-self: end;
  width: 10px; height: 52px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--hotel-gold-soft) 0 12px, color-mix(in oklab, var(--hotel-line) 90%, transparent) 12px);
  box-shadow: 0 -6px 18px color-mix(in oklab, var(--hotel-gold) 30%, transparent);
}
.hotel-entrance__lamp--right { justify-self: start; }
.hotel-entrance__plaque {
  grid-column: 3; grid-row: 2; align-self: center; justify-self: center;
  padding: 10px 14px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 26%, transparent);
  border-radius: 2px;
  background: color-mix(in oklab, var(--hotel-bg) 70%, transparent);
  font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase; line-height: 1.7;
  color: var(--hotel-stone);
  text-align: center;
}

/* landscaping */
.hotel-hedge { display: flex; align-items: flex-end; justify-content: space-between; height: 34px; padding: 0 6px; }
.hotel-hedge__tree {
  width: 16px;
  height: calc(18px + (var(--i) % 4) * 6px);
  border-radius: 50% 50% 30% 30%;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-glass-light) 85%, black), #061410);
}

.hotel-facade__foot {
  padding: 12px 6px 14px;
  border-top: 1px solid color-mix(in oklab, var(--hotel-line) 60%, transparent);
  min-height: 48px;
}
.hotel-facade__hint { font-size: 0.75rem; color: var(--hotel-muted); text-align: center; }
.hotel-facade__selected {
  display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;
  font-size: 0.8rem; color: var(--hotel-cream);
}
.hotel-facade__selectedRoom {
  font-family: var(--font-display); font-size: 1rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--hotel-gold-soft);
}
.hotel-facade__selectedSep { width: 1px; height: 14px; background: var(--hotel-line); }
.hotel-facade__selectedVacant { color: var(--hotel-muted); letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.7rem; }

/* ---------- live activity ---------- */
.hotel-activity { padding: 0 0 8px; }
.hotel-activity__head {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-line) 60%, transparent);
}
.hotel-activity__title { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
.hotel-activity__sub {
  font-family: var(--font-display); font-style: italic; font-size: 0.85rem; color: var(--hotel-muted);
}
.hotel-activity__all {
  margin-left: auto; display: inline-flex; align-items: center; gap: 8px;
  font-size: 0.64rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--hotel-stone);
}
.hotel-activity__allIcon { width: 14px; height: 14px; }
.hotel-activity__list { display: grid; }
.hotel-activity__row {
  display: grid;
  grid-template-columns: 58px 26px 1fr auto;
  align-items: center; gap: 14px;
  padding: 10px 20px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-line) 34%, transparent);
}
.hotel-activity__row:last-child { border-bottom: none; }
.hotel-activity__time { font-size: 0.78rem; color: var(--hotel-muted); }
.hotel-activity__icon { width: 18px; height: 18px; color: var(--hotel-stone); }
.hotel-activity__icon.is-room-service,
.hotel-activity__icon.is-penthouse { color: var(--hotel-gold); }
.hotel-activity__icon svg { width: 100%; height: 100%; }
.hotel-activity__text { font-size: 0.84rem; color: var(--hotel-cream); }
.hotel-activity__ago { font-size: 0.72rem; color: var(--hotel-muted); }

/* ---------- market strip ---------- */
.hotel-market {
  display: flex; align-items: center; gap: 26px;
  padding: 14px 20px;
}
.hotel-market__title {
  display: inline-flex; align-items: center; gap: 12px;
  font-family: var(--font-display); font-size: 1.15rem;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--hotel-cream);
}
.hotel-market__icon { width: 20px; height: 20px; color: var(--hotel-stone); }
.hotel-market__rule { width: 1px; height: 22px; background: var(--hotel-line); }
.hotel-market__figures { display: flex; align-items: center; gap: 28px; }
.hotel-market__figure { display: flex; align-items: baseline; gap: 10px; }
.hotel-market__figure dt {
  font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--hotel-muted);
}
.hotel-market__figure dd { font-size: 0.95rem; color: var(--hotel-cream); }
.hotel-market__unavailable {
  font-size: 0.66rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--hotel-muted);
}
.hotel-btn--trade {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 9px 18px;
  border: 1px solid var(--hotel-line);
  color: var(--hotel-cream);
  background: color-mix(in oklab, var(--hotel-glass) 60%, transparent);
  font-size: 0.9rem;
}

/* ---------- footer ---------- */
.hotel-footer {
  display: flex; align-items: center; gap: 16px;
  padding: 18px 4px 0;
  font-size: 0.72rem; color: var(--hotel-muted);
}
.hotel-footer__brand { letter-spacing: 0.2em; text-transform: uppercase; color: var(--hotel-stone); }
.hotel-footer__sep { width: 1px; height: 12px; background: var(--hotel-line); }
.hotel-footer__tag { font-family: var(--font-display); font-style: italic; font-size: 0.85rem; }
.hotel-footer__lobby {
  margin-left: auto;
  font-size: 0.64rem; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--hotel-stone);
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-stone) 40%, transparent);
  padding-bottom: 2px;
}
.hotel-footer__lobby:hover { color: var(--hotel-gold-soft); }
.hotel-footer__motto { font-family: var(--font-display); font-style: italic; }

/* ---------- lobby ---------- */
.hotel-lobby { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
.hotel-lobby__scrim { position: absolute; inset: 0; background: rgb(3 10 7 / 0.72); cursor: pointer; }
.hotel-lobby__sheet {
  position: relative;
  width: min(900px, 94vw);
  margin-bottom: 24px;
  border: 1px solid var(--hotel-line); border-radius: 4px;
  background: linear-gradient(180deg, var(--hotel-panel), var(--hotel-bg-2));
  box-shadow: 0 30px 80px -40px black;
  padding-bottom: 12px;
}
.hotel-lobby__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 12px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-line) 60%, transparent);
}
.hotel-lobby__close {
  font-size: 0.64rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--hotel-stone);
}
.hotel-lobby__lead { padding: 14px 20px 6px; font-size: 0.82rem; color: var(--hotel-muted); }
.hotel-lobby__row {
  display: grid; grid-template-columns: 60px 1fr 1fr auto; gap: 16px; align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-line) 30%, transparent);
  font-size: 0.82rem; color: var(--hotel-cream);
}
.hotel-lobby__rank { color: var(--hotel-muted); }
.hotel-lobby__gap { font-size: 0.72rem; color: var(--hotel-stone); }

/* ---------- restrained motion ---------- */
@keyframes hotel-service-warmth {
  0%, 100% { box-shadow: 0 0 12px color-mix(in oklab, var(--hotel-gold) 26%, transparent); }
  50% { box-shadow: 0 0 20px color-mix(in oklab, var(--hotel-gold) 42%, transparent); }
}
.hotel-facade--service .hotel-window.is-occupied .hotel-window__glass {
  animation: hotel-service-warmth 4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

/* ---------- refinement pass: numerals, window calm, entrance, landscaping ---------- */
.hotel-penthouse__number,
.hotel-stay__roomNumber,
.hotel-building__motto,
.hotel-entrance__sign,
.hotel-footer__brand,
.hotel-fob__mark,
.hotel-panel__title,
.hotel-market__title,
.hotel-btn {
  font-variant-numeric: lining-nums;
  font-feature-settings: "lnum" 1;
}

/* calmer, more architectural windows */
.hotel-rows { padding: 12px 18px 8px; gap: 7px; }
.hotel-row { gap: 8px; }
.hotel-window {
  width: 50px;
  padding: 4px 4px 3px;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone-dark) 16%, var(--hotel-bg)), color-mix(in oklab, var(--hotel-stone-dark) 8%, var(--hotel-bg)));
  border-color: color-mix(in oklab, var(--hotel-stone) 16%, transparent);
}
.hotel-window__glass { height: 28px; }
.hotel-window.is-occupied .hotel-window__glass {
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-window) 62%, var(--hotel-glass)), color-mix(in oklab, var(--hotel-gold) 34%, var(--hotel-glass)));
  box-shadow: 0 0 9px color-mix(in oklab, var(--hotel-gold) 16%, transparent);
}
.hotel-window.is-occupied .hotel-window__curtain { opacity: 0.32; }
.hotel-window__number { font-size: 0.6rem; letter-spacing: 0.1em; }

/* penthouse windows read as tall arched suite glazing */
.hotel-penthouse__arch {
  position: relative;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-window) 72%, var(--hotel-glass)), color-mix(in oklab, var(--hotel-gold) 34%, var(--hotel-glass)));
  box-shadow: 0 0 16px color-mix(in oklab, var(--hotel-gold) 20%, transparent);
}
.hotel-penthouse__arch::after {
  content: "";
  position: absolute; left: 50%; top: 22%; bottom: 0; width: 1px;
  background: color-mix(in oklab, var(--hotel-bg) 60%, transparent);
}

/* entrance: one centred architectural anchor */
.hotel-entrance {
  grid-template-columns: 1fr auto 1fr;
  grid-template-rows: auto auto;
  align-items: end;
  padding: 14px 24px 0;
  row-gap: 0;
}
.hotel-entrance__canopy { grid-row: 1; width: 196px; height: 18px; border-radius: 3px 3px 0 0; }
.hotel-entrance__dome { width: 92px; height: 34px; }
.hotel-entrance__doors {
  grid-row: 2; width: 196px; height: 92px;
  border-color: color-mix(in oklab, var(--hotel-stone) 26%, transparent);
  background:
    radial-gradient(70% 90% at 50% 100%, color-mix(in oklab, var(--hotel-gold) 18%, transparent), transparent 72%),
    linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone-dark) 14%, transparent), transparent);
  padding-bottom: 0;
}
.hotel-entrance__door {
  width: 52px; height: 62px;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-window) 58%, var(--hotel-glass)), color-mix(in oklab, var(--hotel-gold) 28%, var(--hotel-glass)));
  box-shadow: 0 0 14px color-mix(in oklab, var(--hotel-gold) 18%, transparent);
}
.hotel-entrance__lamp { grid-row: 2; height: 62px; }
.hotel-entrance__plaque {
  grid-row: 2; grid-column: 3;
  align-self: end; justify-self: center;
  margin-bottom: 8px;
}
.hotel-entrance::before {
  content: "";
  grid-row: 2; grid-column: 1;
  align-self: end; justify-self: center;
  margin-bottom: 8px;
  width: 132px; height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--hotel-stone) 30%, transparent));
}

/* landscaping reads as a clipped hedge line with taller trees at the ends */
.hotel-hedge {
  height: 30px; padding: 0 10px; gap: 4px;
  border-top: 1px solid color-mix(in oklab, var(--hotel-line) 60%, transparent);
}
.hotel-hedge__tree { height: 18px; }
.hotel-hedge__tree:nth-child(3n) { height: 24px; }
.hotel-hedge__tree:nth-child(4n) { height: 14px; }
.hotel-hedge__tree:first-child,
.hotel-hedge__tree:last-child { height: 28px; width: 20px; }

/* room service column reads fuller at 1440 */
.hotel-service__quote { padding-top: 26px; }

/* entrance: centred lamp / doors / lamp with the plaque beneath */
.hotel-entrance::before { display: none; }
.hotel-entrance {
  grid-template-columns: auto auto auto;
  grid-template-rows: auto auto auto;
  justify-content: center;
  column-gap: 20px;
  padding: 34px 24px 0;
}
.hotel-entrance__canopy { grid-column: 2; grid-row: 1; justify-self: center; }
.hotel-entrance__doors { grid-column: 2; grid-row: 2; }
.hotel-entrance__lamp { grid-column: 1; grid-row: 2; justify-self: end; }
.hotel-entrance__lamp--right { grid-column: 3; grid-row: 2; justify-self: start; }
.hotel-entrance__plaque {
  grid-column: 1 / -1; grid-row: 3;
  justify-self: center; align-self: start;
  margin: 14px 0 0;
}
.hotel-hedge { margin-top: 10px; }
.hotel-hedge__tree {
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-glass-light) 100%, transparent), #07180f);
}

/* ==========================================================================
   Pass 3 — architectural depth, material richness, lighting, hierarchy
   (visual only; no structural or data changes)
   ========================================================================== */

/* --- wider, grander composition: the building dominates ------------------ */
.hotel-shell { max-width: 1464px; padding: 0 20px 28px; }
.hotel-grid { grid-template-columns: 268px minmax(0, 1fr) 268px; gap: 20px; }

.hotel-facade {
  border: none;
  border-radius: 0;
  overflow: visible;
  padding: 0;
  background:
    radial-gradient(90% 60% at 50% 4%, color-mix(in oklab, var(--hotel-gold) 6%, transparent), transparent 72%),
    radial-gradient(70% 45% at 50% 100%, color-mix(in oklab, var(--hotel-glass) 42%, transparent), transparent 75%);
}
.hotel-facade__sky {
  background:
    radial-gradient(75% 45% at 50% 0%, color-mix(in oklab, var(--hotel-glass-light) 36%, transparent), transparent 78%);
}
.hotel-building {
  filter: drop-shadow(0 40px 60px rgb(0 0 0 / 0.55));
}

/* --- crown ---------------------------------------------------------------- */
.hotel-building__pediment {
  width: 58%; height: 46px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 78%, var(--hotel-bg)),
    color-mix(in oklab, var(--hotel-stone-dark) 42%, var(--hotel-bg)));
}
.hotel-building__finial { height: 12px; width: 8px; }
.hotel-building__parapet {
  position: relative;
  padding: 12px 0 14px;
  background:
    repeating-linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 5%, transparent) 0 46px,
      transparent 46px 47px),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone-dark) 52%, var(--hotel-bg)),
      color-mix(in oklab, var(--hotel-stone-dark) 24%, var(--hotel-bg)));
  border-top: 1px solid color-mix(in oklab, var(--hotel-stone) 48%, transparent);
  box-shadow: inset 0 -6px 12px -6px rgb(0 0 0 / 0.55);
}
.hotel-building__cornice {
  position: absolute; left: 0; right: 0; bottom: -4px; height: 4px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 60%, transparent),
    color-mix(in oklab, var(--hotel-bg) 80%, black));
}
.hotel-building__logo { height: 30px; }
.hotel-building__motto { letter-spacing: 0.34em; }

/* --- shared pilaster ------------------------------------------------------ */
.hotel-pilaster {
  position: absolute; top: 0; bottom: 0; left: 0;
  width: 18px;
  background: linear-gradient(90deg,
    color-mix(in oklab, var(--hotel-stone) 26%, transparent),
    color-mix(in oklab, var(--hotel-stone) 9%, transparent) 55%,
    rgb(0 0 0 / 0.35));
  pointer-events: none;
}
.hotel-pilaster--right { left: auto; right: 0; transform: scaleX(-1); }

/* --- penthouse: a true top-floor pavilion -------------------------------- */
.hotel-penthouse {
  grid-template-columns: 180px minmax(0, 1fr) 180px;
  grid-template-areas: "terrace pavilion holder";
  align-items: end;
  gap: 18px;
  padding: 18px 28px 20px;
  background:
    radial-gradient(48% 130% at 50% 60%, color-mix(in oklab, var(--hotel-window) 16%, transparent), transparent 72%),
    repeating-linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 4%, transparent) 0 54px,
      transparent 54px 55px),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone-dark) 30%, var(--hotel-bg-2)),
      color-mix(in oklab, var(--hotel-stone-dark) 15%, var(--hotel-bg-2)));
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-stone) 28%, transparent);
  box-shadow: inset 0 -10px 18px -12px rgb(0 0 0 / 0.7);
}
.hotel-penthouse__terrace {
  grid-area: terrace;
  display: flex; align-items: flex-end; justify-content: space-between;
  height: 30px;
  border-bottom: 2px solid color-mix(in oklab, var(--hotel-stone) 34%, transparent);
  border-top: 1px solid color-mix(in oklab, var(--hotel-stone) 22%, transparent);
  padding: 0 6px;
}
.hotel-penthouse__baluster {
  width: 6px; height: 16px; border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 42%, transparent),
    color-mix(in oklab, var(--hotel-stone) 14%, transparent));
}
.hotel-penthouse__pavilion {
  grid-area: pavilion;
  position: relative;
  display: grid; justify-items: center; gap: 10px;
  padding: 26px 26px 16px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 32%, transparent);
  border-bottom: none;
  background:
    radial-gradient(70% 90% at 50% 75%, color-mix(in oklab, var(--hotel-gold) 12%, transparent), transparent 72%),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone) 16%, var(--hotel-bg-2)),
      color-mix(in oklab, var(--hotel-stone) 7%, var(--hotel-bg-2)));
  box-shadow: inset 0 1px 0 color-mix(in oklab, var(--hotel-stone) 28%, transparent);
}
.hotel-penthouse__roof {
  position: absolute; left: -1px; right: -1px; top: -20px; height: 22px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 62%, var(--hotel-bg)),
    color-mix(in oklab, var(--hotel-stone-dark) 34%, var(--hotel-bg)));
  clip-path: polygon(50% 0%, 100% 74%, 100% 100%, 0% 100%, 0% 74%);
}
.hotel-penthouse__suite { height: 96px; gap: 20px; }
.hotel-penthouse__arch {
  width: 62px; height: 76px;
  border-radius: 31px 31px 2px 2px;
  border-color: color-mix(in oklab, var(--hotel-stone) 52%, transparent);
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-window) 88%, var(--hotel-glass)),
    color-mix(in oklab, var(--hotel-gold) 52%, var(--hotel-glass)));
  box-shadow:
    0 0 26px color-mix(in oklab, var(--hotel-gold) 26%, transparent),
    inset 0 -8px 14px -8px color-mix(in oklab, var(--hotel-cream) 40%, transparent);
}
.hotel-penthouse__arch--wide { width: 116px; height: 88px; border-radius: 58px 58px 2px 2px; }
.hotel-penthouse__chandelier { top: 4px; width: 34px; height: 34px; }
.hotel-penthouse__plaque {
  display: grid; justify-items: center; gap: 2px;
  padding: 9px 22px;
  border-color: color-mix(in oklab, var(--hotel-gold) 44%, var(--hotel-line));
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-bg) 55%, transparent),
    color-mix(in oklab, var(--hotel-bg) 82%, black));
}
.hotel-penthouse__label { letter-spacing: 0.32em; color: var(--hotel-gold-soft); font-size: 0.66rem; }
.hotel-penthouse__number { font-size: 1.5rem; letter-spacing: 0.1em; }
.hotel-penthouse__holder {
  grid-area: holder; justify-self: stretch;
  align-self: end;
  text-align: right;
  border-color: color-mix(in oklab, var(--hotel-stone) 24%, transparent);
  background: color-mix(in oklab, var(--hotel-bg) 62%, transparent);
}

/* --- standard floors: stone bands, lintels, sills, plaques --------------- */
.hotel-rows {
  position: relative;
  gap: 0;
  padding: 0 30px;
  background:
    repeating-linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 4%, transparent) 0 62px,
      transparent 62px 63px),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone-dark) 24%, var(--hotel-bg-2)),
      color-mix(in oklab, var(--hotel-stone-dark) 13%, var(--hotel-bg)));
}
.hotel-row {
  gap: 10px;
  padding: 11px 0 12px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-stone) 13%, transparent);
  box-shadow: 0 6px 10px -8px rgb(0 0 0 / 0.65);
}
.hotel-row:nth-child(odd) { background: color-mix(in oklab, var(--hotel-stone) 2%, transparent); }
.hotel-row:last-of-type { border-bottom: none; }

.hotel-window {
  width: 64px;
  gap: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
.hotel-window__lintel {
  width: 100%; height: 5px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 46%, transparent),
    color-mix(in oklab, var(--hotel-stone) 16%, transparent));
}
.hotel-window__glass {
  width: 52px; height: 34px;
  border: 1px solid rgb(0 0 0 / 0.5);
  box-shadow: inset 0 2px 5px rgb(0 0 0 / 0.65);
}
.hotel-window__transom {
  position: absolute; left: 0; right: 0; top: 32%; height: 1px;
  background: rgb(0 0 0 / 0.45);
}
.hotel-window__sill {
  width: 100%; height: 4px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 52%, transparent),
    color-mix(in oklab, var(--hotel-bg) 70%, black));
  box-shadow: 0 2px 4px rgb(0 0 0 / 0.5);
}
.hotel-window__plaque {
  margin-top: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 26px; padding: 1px 5px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 22%, transparent);
  border-radius: 1px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 16%, transparent),
    color-mix(in oklab, var(--hotel-bg) 72%, transparent));
}
.hotel-window__number {
  font-size: 0.58rem; letter-spacing: 0.12em;
  color: color-mix(in oklab, var(--hotel-cream) 72%, transparent);
}

/* warm tungsten interiors, with restrained per-room variation */
.hotel-window.is-occupied .hotel-window__glass {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) calc(58% + var(--lamp, 0) * 22%), var(--hotel-window)),
    color-mix(in oklab, var(--hotel-gold) 74%, var(--hotel-glass)));
  box-shadow:
    inset 0 2px 5px rgb(0 0 0 / 0.35),
    0 0 14px color-mix(in oklab, var(--hotel-gold) calc(22% + var(--lamp, 0) * 14%), transparent);
}
.hotel-window.is-occupied .hotel-window__curtain { opacity: 0.4; }
.hotel-window.is-occupied .hotel-window__plaque {
  border-color: color-mix(in oklab, var(--hotel-stone) 34%, transparent);
}
.hotel-window.is-vacant .hotel-window__glass {
  background: linear-gradient(180deg, #050f0b, #030907);
  box-shadow: inset 0 3px 7px rgb(0 0 0 / 0.8);
}
.hotel-window.is-vacant .hotel-window__number { color: color-mix(in oklab, var(--hotel-stone) 40%, transparent); }

.hotel-window:hover .hotel-window__plaque { border-color: color-mix(in oklab, var(--hotel-cream) 55%, transparent); }
.hotel-window.is-selected { border: none; }
.hotel-window.is-selected .hotel-window__glass { outline: 1px solid var(--hotel-cream); }
.hotel-window.is-connected {
  border: none;
  box-shadow: none;
}
.hotel-window.is-connected .hotel-window__glass {
  outline: 1px solid var(--hotel-gold);
  box-shadow:
    inset 0 2px 5px rgb(0 0 0 / 0.3),
    0 0 20px color-mix(in oklab, var(--hotel-gold) 40%, transparent);
}
.hotel-window.is-connected .hotel-window__plaque {
  border-color: color-mix(in oklab, var(--hotel-gold) 65%, transparent);
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-gold) 26%, transparent),
    color-mix(in oklab, var(--hotel-bg) 70%, transparent));
}
.hotel-window.is-connected .hotel-window__number { color: var(--hotel-gold-soft); }

/* --- ground floor and entrance as the anchor ----------------------------- */
.hotel-entrance {
  padding: 44px 24px 0;
  background:
    radial-gradient(40% 120% at 50% 100%, color-mix(in oklab, var(--hotel-gold) 16%, transparent), transparent 72%),
    repeating-linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 5%, transparent) 0 70px,
      transparent 70px 71px),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone-dark) 22%, var(--hotel-bg)),
      color-mix(in oklab, var(--hotel-stone-dark) 10%, var(--hotel-bg)));
  border-top: 3px solid color-mix(in oklab, var(--hotel-stone) 30%, transparent);
}
.hotel-entrance__canopy {
  width: 268px; height: 22px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 64%, transparent),
    color-mix(in oklab, var(--hotel-stone-dark) 34%, transparent));
  box-shadow: 0 10px 22px -10px rgb(0 0 0 / 0.75);
}
.hotel-entrance__valance {
  position: absolute; left: 0; right: 0; top: 100%; height: 8px;
  background:
    repeating-linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 40%, transparent) 0 12px,
      transparent 12px 14px);
}
.hotel-entrance__dome { width: 128px; height: 44px; }
.hotel-entrance__doors {
  width: 268px; height: 116px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 36%, transparent);
  border-bottom: none;
  gap: 6px;
  background:
    radial-gradient(70% 95% at 50% 100%, color-mix(in oklab, var(--hotel-gold) 30%, transparent), transparent 72%),
    linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone) 14%, transparent), transparent);
}
.hotel-entrance__sign { top: 12px; font-size: 0.82rem; letter-spacing: 0.3em; }
.hotel-entrance__door {
  width: 66px; height: 84px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 62%, var(--hotel-window)),
    color-mix(in oklab, var(--hotel-gold) 62%, var(--hotel-glass)));
  box-shadow: 0 0 26px color-mix(in oklab, var(--hotel-gold) 30%, transparent);
}
.hotel-entrance__lamp {
  width: 12px; height: 84px;
  background: linear-gradient(180deg,
    var(--hotel-gold-soft) 0 16px,
    color-mix(in oklab, var(--hotel-line) 90%, transparent) 16px);
  box-shadow: 0 -10px 26px color-mix(in oklab, var(--hotel-gold) 34%, transparent);
}
.hotel-entrance__plaque {
  margin-top: 18px;
  letter-spacing: 0.2em;
  border-color: color-mix(in oklab, var(--hotel-stone) 34%, transparent);
}

/* plinth / steps */
.hotel-plinth { display: grid; justify-items: center; }
.hotel-plinth__step {
  width: 62%; height: 8px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 40%, transparent),
    color-mix(in oklab, var(--hotel-bg) 60%, black));
}
.hotel-plinth__step--wide {
  width: 100%; height: 12px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 30%, transparent),
    color-mix(in oklab, var(--hotel-bg) 70%, black));
}

/* landscaping */
.hotel-hedge {
  margin-top: 0; height: 40px; padding: 0 14px; gap: 6px;
  border-top: none;
  align-items: flex-end;
}
.hotel-hedge__tree {
  width: 18px; height: 16px;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-glass-light) 90%, transparent), #061410);
}
.hotel-hedge__tree:nth-child(3n) { height: 26px; border-radius: 50% 50% 24% 24%; }
.hotel-hedge__tree:nth-child(5n) { height: 12px; width: 24px; border-radius: 40% 40% 18% 18%; }
.hotel-hedge__tree:first-child,
.hotel-hedge__tree:last-child {
  height: 36px; width: 22px; border-radius: 52% 52% 20% 20%;
  background: linear-gradient(180deg, color-mix(in oklab, var(--hotel-glass-light) 105%, transparent), #05120d);
}

/* --- façade footer: no product copy ------------------------------------- */
.hotel-facade__foot { padding: 14px 6px 0; border-top: none; min-height: 42px; }
.hotel-facade__quiet { display: flex; justify-content: center; }
.hotel-facade__quietRule {
  width: 120px; height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--hotel-stone) 26%, transparent), transparent);
}

/* --- side panels read as hotel stationery ------------------------------- */
.hotel-panel {
  background:
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-panel) 92%, var(--hotel-stone)),
      var(--hotel-bg-2));
  border-color: color-mix(in oklab, var(--hotel-stone) 22%, transparent);
  box-shadow: 0 22px 46px -30px rgb(0 0 0 / 0.85), inset 0 1px 0 color-mix(in oklab, var(--hotel-stone) 14%, transparent);
}
.hotel-panel__head {
  padding: 18px 20px 12px;
  border-bottom: 1px solid color-mix(in oklab, var(--hotel-stone) 22%, transparent);
}
.hotel-panel__title { font-size: 1.24rem; letter-spacing: 0.26em; }
.hotel-panel__head::after {
  content: ""; position: absolute;
}
.hotel-stay__roomNumber { font-size: 5rem; color: var(--hotel-cream); }
.hotel-stay__rank { letter-spacing: 0.18em; text-transform: uppercase; font-size: 0.66rem; color: var(--hotel-stone); }
.hotel-stay__balanceValue { font-size: 1.85rem; color: var(--hotel-gold-soft); }
.hotel-service__value { font-size: 2.4rem; color: var(--hotel-gold-soft); }
.hotel-service__fact dd { font-size: 1.28rem; }
.hotel-walletcard, .hotel-movement, .hotel-service__amount {
  background:
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-glass) 80%, transparent),
      color-mix(in oklab, var(--hotel-bg) 55%, transparent));
  border-color: color-mix(in oklab, var(--hotel-stone) 20%, transparent);
}
.hotel-stay__facts { gap: 12px; }

/* --- lower sections lift off the background ----------------------------- */
.hotel-activity, .hotel-market {
  background:
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-panel) 96%, var(--hotel-stone)),
      var(--hotel-bg-2));
  border-color: color-mix(in oklab, var(--hotel-stone) 20%, transparent);
}
.hotel-activity__row:nth-child(odd) { background: color-mix(in oklab, var(--hotel-stone) 3%, transparent); }
.hotel-market { border-top: 1px solid color-mix(in oklab, var(--hotel-gold) 18%, transparent); }

/* --- header: more editorial, same height -------------------------------- */
.hotel-header { padding: 12px 4px 14px; border-bottom-color: color-mix(in oklab, var(--hotel-stone) 26%, transparent); }
.hotel-header__logo { height: 36px; }
.hotel-header__bell { width: 26px; height: 26px; color: color-mix(in oklab, var(--hotel-gold) 70%, var(--hotel-stone)); }
.hotel-header__tagline { letter-spacing: 0.02em; color: color-mix(in oklab, var(--hotel-stone) 68%, transparent); }
.hotel-header__meta { gap: 20px; }
.hotel-pill {
  border-color: color-mix(in oklab, var(--hotel-gold) 30%, var(--hotel-line));
  letter-spacing: 0.2em;
}
.hotel-header__clock { font-size: 1.15rem; letter-spacing: 0.1em; color: var(--hotel-gold-soft); }
.hotel-wallet-btn { padding: 8px 20px; letter-spacing: 0.08em; }

/* --- pass 3b: broaden and compress the storeys --------------------------- */
.hotel-row { padding: 6px 0 7px; gap: 12px; }
.hotel-window { width: 66px; }
.hotel-window__glass { width: 56px; height: 30px; }
.hotel-window__plaque { margin-top: 3px; padding: 0 5px; }
.hotel-rows { padding: 0 26px; }

/* deeper reveal so lit rooms read as interiors, not panels */
.hotel-window__mullion { width: 2px; background: rgb(0 0 0 / 0.55); }
.hotel-window__transom { height: 2px; top: 34%; background: rgb(0 0 0 / 0.5); }
.hotel-window.is-occupied .hotel-window__glass {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) calc(48% + var(--lamp, 0) * 20%), var(--hotel-window)),
    color-mix(in oklab, var(--hotel-gold) 86%, var(--hotel-glass)) 78%,
    color-mix(in oklab, var(--hotel-gold) 48%, var(--hotel-glass)));
}

.hotel-penthouse { padding: 14px 28px 16px; }
.hotel-penthouse__suite { height: 84px; }
.hotel-penthouse__pavilion { padding: 20px 26px 12px; }

.hotel-entrance { padding: 24px 24px 0; }
.hotel-entrance__doors { height: 104px; }
.hotel-hedge { height: 34px; }

/* --- pass 3c: ground-floor arcade wings flanking the entrance ------------ */
.hotel-entrance {
  grid-template-columns: minmax(0, 1fr) auto auto auto minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  justify-content: center;
  align-items: end;
  column-gap: 18px;
}
.hotel-entrance__canopy { grid-column: 3; grid-row: 1; }
.hotel-entrance__doors { grid-column: 3; grid-row: 2; }
.hotel-entrance__lamp { grid-column: 2; grid-row: 2; justify-self: end; }
.hotel-entrance__lamp--right { grid-column: 4; grid-row: 2; justify-self: start; }
.hotel-entrance__plaque { grid-column: 1 / -1; grid-row: 3; }
.hotel-entrance__wing {
  grid-column: 1; grid-row: 2;
  align-self: end; justify-self: stretch;
  display: flex; align-items: flex-end; justify-content: flex-end; gap: 22px;
  padding: 0 24px 16px 0;
}
.hotel-entrance__wing--right { grid-column: 5; justify-content: flex-start; padding: 0 0 16px 24px; }
.hotel-entrance__bay {
  width: 54px; height: 62px;
  border-radius: 27px 27px 2px 2px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 34%, transparent);
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 40%, var(--hotel-window)),
    color-mix(in oklab, var(--hotel-gold) 58%, var(--hotel-glass)));
  box-shadow: 0 0 20px color-mix(in oklab, var(--hotel-gold) 20%, transparent);
}

/* --- pass 3d: clear the entrance of the lowest storey -------------------- */
.hotel-rows { position: relative; z-index: 2; }
.hotel-entrance { padding-top: 46px; }
.hotel-entrance__dome { width: 112px; height: 32px; }
.hotel-entrance__sign {
  top: 14px;
  color: var(--hotel-gold-soft);
  text-shadow: 0 0 12px rgb(0 0 0 / 0.8);
}
.hotel-entrance__doors { padding-top: 6px; }

/* entrance wordmark sits on the canopy band, clear of the doors */
.hotel-entrance__canopy { height: 28px; z-index: 1; }
.hotel-entrance__doors { overflow: visible; padding-top: 0; }
.hotel-entrance__sign {
  top: -25px; z-index: 2;
  color: var(--hotel-bg);
  font-size: 0.8rem; letter-spacing: 0.32em;
  text-shadow: none;
}
.hotel-entrance__sign { color: color-mix(in oklab, var(--hotel-cream) 92%, transparent); text-shadow: 0 1px 2px rgb(0 0 0 / 0.7); }

/* ==========================================================================
   Pass 4 — boutique luxury polish (visual only; no structure/data changes)
   ========================================================================== */

/* --- 6. warmer limestone / antique stone, cooler night around it --------- */
:root {
  --hotel-stone: oklch(0.845 0.055 80.5);
  --hotel-stone-dark: oklch(0.775 0.062 79.5);
  --hotel-cream: oklch(0.948 0.038 84.5);
  --hotel-window: oklch(0.858 0.118 72.5);
  --hotel-gold: oklch(0.762 0.108 76.0);
  --hotel-gold-soft: oklch(0.872 0.092 80.0);
}

/* --- 5. roofline: layered pediment, dentils, deeper cornice -------------- */
.hotel-building__pediment {
  height: 52px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 86%, var(--hotel-bg)),
    color-mix(in oklab, var(--hotel-stone-dark) 46%, var(--hotel-bg)) 62%,
    color-mix(in oklab, var(--hotel-stone-dark) 28%, var(--hotel-bg)));
  filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.5));
}
.hotel-building__pediment::before {
  content: "";
  position: absolute; left: 12%; right: 12%; bottom: 7px; height: 2px;
  background: color-mix(in oklab, var(--hotel-bg) 55%, transparent);
}
.hotel-building__pediment::after {
  content: "";
  position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%);
  width: 22px; height: 12px; border-radius: 12px 12px 0 0;
  background: color-mix(in oklab, var(--hotel-gold) 46%, var(--hotel-bg));
  box-shadow: 0 0 14px color-mix(in oklab, var(--hotel-gold) 32%, transparent);
}
.hotel-building__parapet {
  padding: 14px 0 16px;
  border-top: 2px solid color-mix(in oklab, var(--hotel-stone) 58%, transparent);
}
.hotel-building__parapet::before {
  content: "";
  position: absolute; left: 0; right: 0; top: 0; height: 7px;
  background: repeating-linear-gradient(90deg,
    color-mix(in oklab, var(--hotel-stone) 34%, transparent) 0 6px,
    transparent 6px 13px);
  opacity: 0.55;
}
.hotel-building__cornice {
  bottom: -7px; height: 7px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 68%, transparent) 0 3px,
    color-mix(in oklab, var(--hotel-stone-dark) 32%, var(--hotel-bg)) 3px,
    color-mix(in oklab, var(--hotel-bg) 85%, black));
  box-shadow: 0 6px 12px -6px rgb(0 0 0 / 0.75);
}

/* --- 2. pilasters read as fluted stone ---------------------------------- */
.hotel-pilaster {
  width: 22px;
  background:
    repeating-linear-gradient(90deg,
      rgb(0 0 0 / 0.16) 0 1px, transparent 1px 6px),
    linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 32%, transparent),
      color-mix(in oklab, var(--hotel-stone) 11%, transparent) 58%,
      rgb(0 0 0 / 0.42));
}

/* --- 1. penthouse: prestigious through architecture --------------------- */
.hotel-penthouse {
  background:
    radial-gradient(46% 130% at 50% 62%, color-mix(in oklab, var(--hotel-window) 20%, transparent), transparent 72%),
    repeating-linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 5%, transparent) 0 54px,
      transparent 54px 55px),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone-dark) 34%, var(--hotel-bg-2)),
      color-mix(in oklab, var(--hotel-stone-dark) 16%, var(--hotel-bg-2)));
  border-bottom: 2px solid color-mix(in oklab, var(--hotel-stone) 34%, transparent);
}
.hotel-penthouse__pavilion {
  padding: 22px 30px 14px;
  border-color: color-mix(in oklab, var(--hotel-stone) 42%, transparent);
  background:
    radial-gradient(70% 90% at 50% 72%, color-mix(in oklab, var(--hotel-gold) 16%, transparent), transparent 72%),
    repeating-linear-gradient(180deg,
      transparent 0 13px, rgb(0 0 0 / 0.07) 13px 14px),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone) 22%, var(--hotel-bg-2)),
      color-mix(in oklab, var(--hotel-stone) 9%, var(--hotel-bg-2)));
  box-shadow:
    inset 0 1px 0 color-mix(in oklab, var(--hotel-stone) 38%, transparent),
    inset 6px 0 12px -10px rgb(0 0 0 / 0.6),
    inset -6px 0 12px -10px rgb(0 0 0 / 0.6);
}
.hotel-penthouse__pavilion::before,
.hotel-penthouse__pavilion::after {
  content: "";
  position: absolute; top: 14px; bottom: 0; width: 9px;
  background: linear-gradient(90deg,
    color-mix(in oklab, var(--hotel-stone) 36%, transparent),
    color-mix(in oklab, var(--hotel-stone) 10%, transparent) 60%,
    rgb(0 0 0 / 0.38));
  pointer-events: none;
}
.hotel-penthouse__pavilion::before { left: 6px; }
.hotel-penthouse__pavilion::after { right: 6px; transform: scaleX(-1); }
.hotel-penthouse__roof {
  top: -26px; height: 28px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 74%, var(--hotel-bg)),
    color-mix(in oklab, var(--hotel-stone-dark) 40%, var(--hotel-bg)) 70%,
    color-mix(in oklab, var(--hotel-stone-dark) 26%, var(--hotel-bg)));
  clip-path: polygon(50% 0%, 100% 64%, 100% 82%, 96% 82%, 96% 100%, 4% 100%, 4% 82%, 0% 82%, 0% 64%);
  filter: drop-shadow(0 5px 7px rgb(0 0 0 / 0.5));
}
.hotel-penthouse__arch {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 66%, var(--hotel-window)),
    color-mix(in oklab, var(--hotel-gold) 84%, var(--hotel-glass)) 72%,
    color-mix(in oklab, var(--hotel-gold) 52%, var(--hotel-glass)));
  box-shadow:
    0 0 30px color-mix(in oklab, var(--hotel-gold) 24%, transparent),
    inset 0 3px 6px rgb(0 0 0 / 0.3);
}
.hotel-penthouse__arch::before {
  content: "";
  position: absolute; left: -5px; right: -5px; top: -6px; height: 7px;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 62%, transparent),
    color-mix(in oklab, var(--hotel-stone) 22%, transparent));
}
.hotel-penthouse__plaque {
  position: relative;
  padding: 10px 26px;
  box-shadow:
    0 8px 18px -10px rgb(0 0 0 / 0.85),
    inset 0 1px 0 color-mix(in oklab, var(--hotel-gold) 22%, transparent);
}
.hotel-penthouse__plaque::before {
  content: "";
  position: absolute; inset: 3px;
  border: 1px solid color-mix(in oklab, var(--hotel-gold) 20%, transparent);
  pointer-events: none;
}
.hotel-penthouse__label { letter-spacing: 0.36em; }
.hotel-penthouse__number { font-size: 1.62rem; }
.hotel-penthouse__terrace {
  border-bottom-color: color-mix(in oklab, var(--hotel-stone) 44%, transparent);
}

/* --- 3. window character: inhabited, not uniform ------------------------- */
.hotel-window__lintel {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 56%, transparent),
    color-mix(in oklab, var(--hotel-stone) 18%, transparent));
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
}
.hotel-window__sill {
  height: 5px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 60%, transparent) 0 2px,
    color-mix(in oklab, var(--hotel-bg) 72%, black));
  box-shadow: 0 3px 5px rgb(0 0 0 / 0.55);
}
.hotel-window.is-occupied .hotel-window__glass::after {
  content: "";
  position: absolute; left: 50%; bottom: -2px; transform: translateX(-50%);
  width: 62%; height: 70%;
  background: radial-gradient(ellipse at 50% 100%,
    color-mix(in oklab, var(--hotel-cream) 62%, transparent), transparent 72%);
  pointer-events: none;
}
.hotel-window.is-occupied:nth-child(3n) .hotel-window__curtain { opacity: 0.58; }
.hotel-window.is-occupied:nth-child(3n) .hotel-window__curtain--right { opacity: 0.16; }
.hotel-window.is-occupied:nth-child(4n) .hotel-window__curtain { opacity: 0.2; }
.hotel-window.is-occupied:nth-child(5n) .hotel-window__curtain--right { opacity: 0.5; }
.hotel-window.is-occupied:nth-child(7n) .hotel-window__glass::after { opacity: 0.55; }
.hotel-window.is-occupied:nth-child(2n) .hotel-window__glass { filter: brightness(0.94); }
.hotel-window.is-occupied:nth-child(9n) .hotel-window__glass { filter: brightness(1.06); }
.hotel-window.is-vacant .hotel-window__glass {
  background: linear-gradient(180deg, #040d09, #020806);
  box-shadow: inset 0 4px 9px rgb(0 0 0 / 0.85);
}

/* --- 4. entrance: prestigious arrival ----------------------------------- */
.hotel-entrance {
  background:
    radial-gradient(42% 130% at 50% 100%, color-mix(in oklab, var(--hotel-gold) 20%, transparent), transparent 72%),
    repeating-linear-gradient(90deg,
      color-mix(in oklab, var(--hotel-stone) 6%, transparent) 0 70px,
      transparent 70px 71px),
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-stone-dark) 28%, var(--hotel-bg)),
      color-mix(in oklab, var(--hotel-stone-dark) 12%, var(--hotel-bg)));
  border-top: 4px solid color-mix(in oklab, var(--hotel-stone) 38%, transparent);
}
.hotel-entrance__canopy {
  width: 284px; height: 30px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 74%, transparent) 0 6px,
    color-mix(in oklab, var(--hotel-stone) 52%, transparent) 6px,
    color-mix(in oklab, var(--hotel-stone-dark) 30%, transparent));
  box-shadow: 0 14px 26px -12px rgb(0 0 0 / 0.8);
}
.hotel-entrance__dome {
  width: 118px; height: 36px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 30%, var(--hotel-glass-light)),
    color-mix(in oklab, var(--hotel-stone-dark) 44%, transparent));
  border-color: color-mix(in oklab, var(--hotel-stone) 42%, transparent);
}
.hotel-entrance__doors {
  width: 284px; height: 108px;
  border: 2px solid color-mix(in oklab, var(--hotel-stone) 44%, transparent);
  border-bottom: none;
  background:
    radial-gradient(72% 95% at 50% 100%, color-mix(in oklab, var(--hotel-gold) 36%, transparent), transparent 72%),
    linear-gradient(180deg, color-mix(in oklab, var(--hotel-stone) 18%, transparent), transparent);
}
.hotel-entrance__door {
  width: 70px; height: 88px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 46%, transparent);
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 72%, var(--hotel-window)),
    color-mix(in oklab, var(--hotel-gold) 70%, var(--hotel-glass)));
  box-shadow:
    0 0 34px color-mix(in oklab, var(--hotel-gold) 34%, transparent),
    inset 0 0 0 4px color-mix(in oklab, var(--hotel-stone) 20%, transparent);
}
.hotel-entrance__lamp {
  height: 92px;
  background: linear-gradient(180deg,
    var(--hotel-gold-soft) 0 18px,
    color-mix(in oklab, var(--hotel-stone) 26%, var(--hotel-line)) 18px);
  border-radius: 3px 3px 1px 1px;
  box-shadow: 0 -12px 30px color-mix(in oklab, var(--hotel-gold) 40%, transparent);
}
.hotel-entrance__sign {
  top: -27px;
  font-size: 0.86rem; letter-spacing: 0.34em;
}
.hotel-entrance__bay {
  border-color: color-mix(in oklab, var(--hotel-stone) 44%, transparent);
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 48%, var(--hotel-window)),
    color-mix(in oklab, var(--hotel-gold) 68%, var(--hotel-glass)));
}
.hotel-entrance__plaque {
  border-color: color-mix(in oklab, var(--hotel-stone) 42%, transparent);
  color: color-mix(in oklab, var(--hotel-cream) 82%, transparent);
  letter-spacing: 0.22em;
}

/* --- 10. landscaping integrated with the plinth -------------------------- */
.hotel-plinth__step { width: 58%; height: 9px; }
.hotel-hedge {
  height: 40px; padding: 0 18px; gap: 7px;
  background: linear-gradient(180deg, transparent, color-mix(in oklab, var(--hotel-bg) 60%, black));
}
.hotel-hedge__tree {
  width: 20px; height: 15px;
  border-radius: 46% 46% 16% 16%;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-glass-light) 92%, var(--hotel-stone)),
    #05120d);
  box-shadow: 0 -2px 8px color-mix(in oklab, var(--hotel-gold) 8%, transparent);
}
.hotel-hedge__tree:nth-child(3n) { height: 27px; border-radius: 52% 52% 20% 20%; }
.hotel-hedge__tree:nth-child(5n) { height: 11px; width: 26px; border-radius: 34% 34% 14% 14%; }
.hotel-hedge__tree:first-child,
.hotel-hedge__tree:last-child {
  height: 34px; width: 22px;
  border-radius: 8px 8px 2px 2px;
  background:
    linear-gradient(180deg,
      color-mix(in oklab, var(--hotel-glass-light) 100%, var(--hotel-stone)) 0 22px,
      color-mix(in oklab, var(--hotel-stone) 30%, var(--hotel-bg)) 22px);
}

/* --- 7/8. side panels: hotel stationery hierarchy ----------------------- */
.hotel-panel__title { font-size: 1.3rem; letter-spacing: 0.3em; font-weight: 500; }
.hotel-panel__head { padding: 20px 20px 13px; }
.hotel-panel__head::before {
  content: "";
  position: absolute; left: 20px; right: 20px; bottom: -1px; height: 1px;
  background: linear-gradient(90deg,
    color-mix(in oklab, var(--hotel-gold) 40%, transparent), transparent 70%);
}
.hotel-panel__head { position: relative; }
.hotel-walletcard__label,
.hotel-stay__fact dt,
.hotel-service__fact dt,
.hotel-movement__caption,
.hotel-service__lead {
  font-weight: 500;
  color: color-mix(in oklab, var(--hotel-stone) 82%, transparent);
}
.hotel-stay__fact { font-size: 0.9rem; }
.hotel-stay__fact dd { font-weight: 500; }
.hotel-stay__roomNumber { letter-spacing: 0.01em; }
.hotel-stay__balance { align-items: baseline; padding-top: 18px; }
.hotel-stay__balanceUnit { color: color-mix(in oklab, var(--hotel-stone) 80%, transparent); }
.hotel-walletcard__value { font-size: 0.95rem; }

.hotel-service__amount {
  position: relative;
  padding: 26px 12px 20px;
}
.hotel-service__amount::before {
  content: "";
  position: absolute; inset: 4px;
  border: 1px solid color-mix(in oklab, var(--hotel-stone) 14%, transparent);
  pointer-events: none;
}
.hotel-service__value { font-size: 2.55rem; letter-spacing: 0.005em; }
.hotel-service__unit { color: color-mix(in oklab, var(--hotel-stone) 88%, transparent); }
.hotel-service__state { letter-spacing: 0.3em; color: var(--hotel-gold-soft); }
.hotel-service__lead { letter-spacing: 0.28em; }
.hotel-btn--claim {
  padding: 15px 18px;
  letter-spacing: 0.2em;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 94%, var(--hotel-gold)),
    var(--hotel-stone));
  box-shadow: 0 10px 22px -14px rgb(0 0 0 / 0.9);
}
.hotel-service__quote { font-size: 1.14rem; }

/* --- 9. header identity presence (same height) -------------------------- */
.hotel-header__brand { gap: 12px; }
.hotel-header__logo { height: 40px; margin-left: -2px; }
.hotel-header__bell { width: 24px; height: 24px; }
.hotel-header__tagline { font-size: 0.92rem; }
.hotel-pill { padding: 5px 13px; font-size: 0.64rem; }
.hotel-header__clock { font-size: 1.12rem; }

/* --- pass 4b: tungsten interiors, not flat cream panes ------------------- */
.hotel-window.is-occupied .hotel-window__glass {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-gold) calc(58% + var(--lamp, 0) * 16%), var(--hotel-glass)),
    color-mix(in oklab, var(--hotel-window) 62%, var(--hotel-glass)) 46%,
    color-mix(in oklab, var(--hotel-gold) 44%, #0a1a12) 100%);
  box-shadow:
    inset 0 3px 6px rgb(0 0 0 / 0.5),
    0 0 12px color-mix(in oklab, var(--hotel-gold) calc(16% + var(--lamp, 0) * 10%), transparent);
}
.hotel-window.is-occupied .hotel-window__glass::after {
  width: 54%; height: 58%;
  background: radial-gradient(ellipse at 50% 100%,
    color-mix(in oklab, var(--hotel-cream) 34%, transparent), transparent 74%);
}
.hotel-window.is-occupied:nth-child(7n) .hotel-window__glass::after { opacity: 0.4; }
.hotel-window.is-occupied:nth-child(2n) .hotel-window__glass { filter: brightness(0.9); }
.hotel-window.is-occupied:nth-child(9n) .hotel-window__glass { filter: brightness(1.08); }
.hotel-window.is-occupied .hotel-window__curtain {
  background: linear-gradient(90deg, color-mix(in oklab, var(--hotel-cream) 40%, transparent), transparent);
}
.hotel-window__mullion { background: rgb(0 0 0 / 0.68); }
.hotel-window__transom { background: rgb(0 0 0 / 0.62); }

/* penthouse glazing: warm, not milky */
.hotel-penthouse__arch {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-gold) 74%, var(--hotel-glass)),
    color-mix(in oklab, var(--hotel-window) 66%, var(--hotel-glass)) 48%,
    color-mix(in oklab, var(--hotel-gold) 46%, #0a1a12));
}

/* entrance glazing: lobby light, restrained */
.hotel-entrance__door {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-gold) 78%, var(--hotel-glass)),
    color-mix(in oklab, var(--hotel-window) 70%, var(--hotel-glass)) 45%,
    color-mix(in oklab, var(--hotel-gold) 52%, #0a1a12));
}
.hotel-entrance__bay {
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-gold) 62%, var(--hotel-glass)),
    color-mix(in oklab, var(--hotel-gold) 38%, #0a1a12));
  box-shadow: 0 0 18px color-mix(in oklab, var(--hotel-gold) 16%, transparent);
}

/* ==========================================================================
   Pass 5 — final desktop polish (entrance, penthouse depth, service spacing)
   ========================================================================== */

/* --- entrance: clearer arrival anchor ----------------------------------- */
.hotel-entrance__canopy {
  height: 34px;
  box-shadow:
    0 12px 28px -12px rgb(0 0 0 / 0.85),
    inset 0 1px 0 color-mix(in oklab, var(--hotel-cream) 24%, transparent);
}
.hotel-entrance__canopy::after {
  content: "";
  position: absolute; left: -6px; right: -6px; bottom: -5px; height: 6px;
  border-radius: 0 0 3px 3px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-stone) 64%, transparent),
    color-mix(in oklab, var(--hotel-stone-dark) 30%, transparent));
  box-shadow: 0 6px 12px -4px rgb(0 0 0 / 0.65);
}
.hotel-entrance__valance {
  height: 10px;
  box-shadow: 0 4px 8px -2px rgb(0 0 0 / 0.55);
}

.hotel-entrance__doors {
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--hotel-stone) 28%, transparent),
    0 18px 34px -14px rgb(0 0 0 / 0.85),
    inset 0 18px 24px -16px color-mix(in oklab, var(--hotel-gold) 35%, transparent);
}
.hotel-entrance__doors::before {
  content: "";
  position: absolute; left: 8px; right: 8px; top: 0; height: 18px;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-cream) 38%, transparent),
    transparent);
  pointer-events: none;
}

.hotel-entrance__lamp { position: relative; }
.hotel-entrance__lamp {
  box-shadow:
    0 -14px 34px color-mix(in oklab, var(--hotel-gold) 42%, transparent),
    0 4px 10px rgb(0 0 0 / 0.45);
}
.hotel-entrance__lamp::before {
  content: "";
  position: absolute; left: 50%; top: -4px; transform: translateX(-50%);
  width: 22px; height: 8px;
  border-radius: 50%;
  background: color-mix(in oklab, var(--hotel-gold-soft) 55%, transparent);
  box-shadow: 0 -8px 20px color-mix(in oklab, var(--hotel-gold) 60%, transparent);
}

/* --- penthouse: a little more architectural recess ---------------------- */
.hotel-penthouse__pavilion {
  box-shadow:
    inset 0 14px 28px -16px rgb(0 0 0 / 0.65),
    inset 0 -10px 18px -14px rgb(0 0 0 / 0.45),
    0 10px 24px -10px rgb(0 0 0 / 0.55);
}
.hotel-penthouse__suite { position: relative; }
.hotel-penthouse__suite::before {
  content: "";
  position: absolute; inset: -8px -18px 0;
  background: linear-gradient(180deg,
    color-mix(in oklab, var(--hotel-bg) 78%, transparent),
    color-mix(in oklab, var(--hotel-bg) 92%, transparent));
  border-radius: 2px 2px 0 0;
  z-index: -1;
  box-shadow: inset 0 0 18px rgb(0 0 0 / 0.45);
}

/* --- room service: more horizontal breathing room ----------------------- */
.hotel-service__amount {
  padding: 26px 20px 20px;
}
.hotel-service__value {
  font-size: 2.45rem;
}

/* =========================================================
   Responsive adaptation — desktop design unchanged above.
   Breakpoints only; no change to room mapping or semantics.
   ========================================================= */

/* ---------- 1200px and below: tightened three-column ---------- */
@media (max-width: 1200px) {
  .hotel-shell { padding: 0 16px 24px; }
  .hotel-grid { grid-template-columns: 228px minmax(0, 1fr) 228px; gap: 14px; }

  .hotel-header { gap: 14px; }
  .hotel-header__tagline { display: none; }
  .hotel-header__meta { gap: 12px; }

  .hotel-building__logo { height: 24px; }
  .hotel-building__motto { font-size: 0.54rem; letter-spacing: 0.24em; }

  .hotel-rows { padding: 0 14px; }
  .hotel-row { padding: 5px 0 6px; gap: 6px; }
  .hotel-window { width: 44px; }
  .hotel-window__glass { width: 38px; height: 22px; }
  .hotel-window__plaque { padding: 0 3px; margin-top: 2px; }
  .hotel-window__number { font-size: 0.5rem; letter-spacing: 0.06em; }

  .hotel-penthouse { grid-template-columns: 116px 1fr 116px; padding: 12px 16px 14px; gap: 10px; }
  .hotel-penthouse__suite { height: 64px; gap: 12px; }
  .hotel-penthouse__arch { width: 40px; height: 48px; border-radius: 20px 20px 2px 2px; }
  .hotel-penthouse__arch--wide { width: 78px; height: 58px; border-radius: 40px 40px 2px 2px; }
  .hotel-penthouse__pavilion { padding: 14px 16px 10px; }
  .hotel-penthouse__number { font-size: 1.3rem; }
  .hotel-penthouse__holderWallet,
  .hotel-penthouse__holderBalance { font-size: 0.7rem; }

  .hotel-entrance { padding: 34px 12px 0; gap: 8px; }
  .hotel-entrance__canopy { width: 156px; }
  .hotel-entrance__doors { width: 156px; height: 86px; }
  .hotel-entrance__dome { width: 92px; height: 26px; }
  .hotel-entrance__door { width: 38px; height: 46px; }
  .hotel-entrance__lamp { height: 50px; }
  .hotel-entrance__sign { font-size: 0.68rem; letter-spacing: 0.22em; }
  .hotel-entrance__bay { width: 14px; height: 24px; }
  .hotel-hedge__tree { width: 16px; }

  .hotel-service__value { font-size: 2rem; }
  .hotel-service__amount { margin: 12px 12px 0; padding: 18px 10px 14px; }
  .hotel-market { gap: 16px; flex-wrap: wrap; }
  .hotel-market__figures { gap: 18px; flex-wrap: wrap; }
  .hotel-activity__row { grid-template-columns: 50px 22px 1fr auto; gap: 10px; padding: 9px 14px; }
}

/* ---------- 880px and below: stacked single column ---------- */
@media (max-width: 880px) {
  .hotel-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .hotel-main { padding-top: 14px; }
  .hotel-footer { flex-wrap: wrap; gap: 10px; row-gap: 6px; }
  .hotel-footer__lobby { margin-left: 0; }
}

/* ---------- 560px and below: 390px mobile ---------- */
@media (max-width: 560px) {
  .hotel-shell { padding: 0 12px 20px; }

  /* compact header: identity, LIVE, next service, wallet */
  .hotel-header { flex-wrap: wrap; gap: 8px; padding: 10px 0 10px; }
  .hotel-header__brand { gap: 8px; }
  .hotel-header__bell { width: 22px; height: 22px; }
  .hotel-header__logo { height: 22px; }
  .hotel-header__meta { gap: 8px; flex-wrap: wrap; width: 100%; justify-content: space-between; }
  .hotel-header__rule { display: none; }
  .hotel-header__service { gap: 8px; }
  .hotel-header__clock { font-size: 0.92rem; }
  .hotel-pill { padding: 5px 10px; font-size: 0.6rem; letter-spacing: 0.12em; }
  .hotel-wallet-btn { font-size: 0.9rem; padding: 10px 16px; min-height: 44px; }

  /* façade: complete building, proportionally scaled, no scroll, no crop */
  .hotel-facade { padding: 10px 6px 0; }
  .hotel-rows { padding: 0 5px; gap: 3px; }
  .hotel-row { padding: 3px 0 4px; gap: 2px; }
  .hotel-window { width: 30px; }
  .hotel-window__glass { width: 26px; height: 15px; }
  .hotel-window__lintel { height: 2px; }
  .hotel-window__sill { height: 2px; }
  .hotel-window__plaque { margin-top: 1px; padding: 0 1px; }
  .hotel-window__number { font-size: 0.42rem; letter-spacing: 0.01em; }
  .hotel-window__transom { display: none; }

  .hotel-building__pediment { height: 22px; }
  .hotel-building__parapet { padding: 7px 0 8px; }
  .hotel-building__logo { height: 18px; }
  .hotel-building__motto { font-size: 0.44rem; letter-spacing: 0.16em; }

  .hotel-penthouse {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: 8px;
    padding: 10px 10px 12px;
  }
  .hotel-penthouse__plaque { text-align: center; }
  .hotel-penthouse__holder { justify-self: center; text-align: center; }
  .hotel-penthouse__terrace { width: 100%; }
  .hotel-penthouse__suite { height: 52px; gap: 8px; }
  .hotel-penthouse__arch { width: 26px; height: 36px; border-radius: 13px 13px 2px 2px; }
  .hotel-penthouse__arch--wide { width: 52px; height: 44px; border-radius: 26px 26px 2px 2px; }
  .hotel-penthouse__pavilion { padding: 10px 10px 8px; }
  .hotel-penthouse__number { font-size: 1.15rem; }

  .hotel-entrance { padding: 26px 6px 0; gap: 4px; }
  .hotel-entrance__canopy { width: 108px; height: 20px; }
  .hotel-entrance__doors { width: 108px; height: 60px; }
  .hotel-entrance__dome { width: 64px; height: 20px; }
  .hotel-entrance__door { width: 26px; height: 32px; }
  .hotel-entrance__lamp { height: 34px; width: 7px; }
  .hotel-entrance__sign { font-size: 0.5rem; letter-spacing: 0.14em; top: 6px; }
  .hotel-entrance__wing, .hotel-entrance__bay { display: none; }
  .hotel-entrance__plaque { font-size: 0.5rem; padding: 7px 8px; letter-spacing: 0.1em; }
  .hotel-hedge { height: 22px; }
  .hotel-hedge__tree { width: 10px; }
  .hotel-facade__foot { padding: 10px 4px 0; }

  /* Your Stay / Room Service: compact stacked, no overflow */
  .hotel-panel { border-radius: 4px; }
  .hotel-stay__room { font-size: 3.2rem; }
  .hotel-service__amount { margin: 12px 14px 0; padding: 20px 14px 16px; }
  .hotel-service__value { font-size: 2.1rem; }
  .hotel-service__unit { font-size: 0.95rem; }
  .hotel-btn { min-height: 46px; }

  /* Live Activity: compact vertical rows */
  .hotel-activity__head { flex-wrap: wrap; gap: 8px; padding: 14px 14px 10px; }
  .hotel-activity__sub { display: none; }
  .hotel-activity__row {
    grid-template-columns: 20px minmax(0, 1fr) auto;
    grid-template-areas: "icon text ago" ". time time";
    gap: 4px 10px;
    padding: 10px 14px;
  }
  .hotel-activity__icon { grid-area: icon; }
  .hotel-activity__text { grid-area: text; font-size: 0.8rem; }
  .hotel-activity__ago { grid-area: ago; }
  .hotel-activity__time { grid-area: time; font-size: 0.68rem; }

  /* Market strip */
  .hotel-market { flex-direction: column; align-items: flex-start; gap: 10px; padding: 14px; }
  .hotel-market__rule { display: none; }
  .hotel-market__figures { flex-direction: column; align-items: flex-start; gap: 8px; width: 100%; }
  .hotel-btn--trade { margin-left: 0; width: 100%; justify-content: center; min-height: 44px; }

  /* Lobby sheet */
  .hotel-lobby__sheet { width: 96vw; margin-bottom: 12px; }
  .hotel-lobby__row { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 8px; padding: 9px 14px; font-size: 0.76rem; }
  .hotel-lobby__gap { grid-column: 1 / -1; }
}

/* responsive fixes: stacked fob + penthouse holder */
@media (max-width: 1200px) {
  .hotel-fob { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .hotel-fob__motto { text-align: left; }
}
@media (max-width: 560px) {
  .hotel-penthouse__holder { position: static; justify-self: center; margin: 0; right: auto; top: auto; }
  .hotel-building__motto { position: relative; z-index: 3; }
}

@media (max-width: 560px) {
  .hotel-penthouse { grid-template-areas: "pavilion" "holder"; }
  .hotel-penthouse__terrace { display: none; }
  .hotel-penthouse__holder { justify-self: center; text-align: center; max-width: 82%; }
}

/* Mobile polish pass (390px) */
@media (max-width: 560px) {
  .hotel-main { padding-top: 10px; gap: 10px; }
  .hotel-grid { gap: 10px; }
  .hotel-shell { padding: 0 8px 18px; }
  .hotel-facade { padding: 8px 2px 0; }
  .hotel-panel__title { font-size: 1.02rem; letter-spacing: 0.2em; }
  .hotel-penthouse__holder { padding: 5px 10px; line-height: 1.15; }
  .hotel-penthouse__holderWallet,
  .hotel-penthouse__holderBalance { font-size: 0.62rem; }
  .hotel-fob__motto {
    text-align: left;
    line-height: 1.5;
    letter-spacing: 0.14em;
    font-size: 0.62rem;
    max-width: 14ch;
  }
}

@media (max-width: 560px) {
  .hotel-window { width: 32px; }
  .hotel-window__glass { width: 28px; height: 16px; }
  .hotel-window__number { font-size: 0.45rem; }
  .hotel-rows { padding: 0 8px; }
}

@media (max-width: 560px) {
  .hotel-fob__motto br { display: none; }
  .hotel-fob__motto {
    max-width: 22ch;
    text-align: center;
    justify-self: center;
    letter-spacing: 0.16em;
    line-height: 1.7;
  }
}

/* claimable figure must never overflow its panel */
.hotel-service__amount { overflow: hidden; }
.hotel-service__amount > * { max-width: 100%; }
.hotel-service__value { font-size: clamp(1.6rem, 2.1vw, 2.45rem); }
.hotel-service__unit { margin-left: 8px; }
@media (max-width: 560px) {
  .hotel-service__value { font-size: 2.1rem; }
}
```

## 18. Component markup extraction

Final prototype components. Fixture imports and prototype-only state are marked; DOM structure and class names are the contract. Replace every `PRODUCTION DATA` point with the real canonical state.

### `src/routes/index.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { HotelHeader } from "@/components/hotel/HotelHeader";
import { YourStayPanel } from "@/components/hotel/YourStayPanel";
import { HotelFacade } from "@/components/hotel/HotelFacade";
import { RoomServicePanel } from "@/components/hotel/RoomServicePanel";
import { LiveActivity } from "@/components/hotel/LiveActivity";
import { MarketStrip } from "@/components/hotel/MarketStrip";
import { LobbySheet } from "@/components/hotel/LobbySheet";
import { buildActivity, connectedRoom, hotelFixture } from "@/lib/hotel-fixture";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HOTEL100 — 100 rooms. No reservations." },
      {
        name: "description",
        content:
          "HOTEL100 is a live onchain hotel: 100 fixed rooms, occupants set by $HOTEL holder rank, Room Service every 15 minutes.",
      },
      { property: "og:title", content: "HOTEL100 — 100 rooms. No reservations." },
      {
        property: "og:description",
        content:
          "A higher kind of stay. Penthouse at rank #1, Rooms 2–100 below, the Lobby beyond. Room Service every 15 minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HotelPrototype,
});

function HotelPrototype() {
  const snapshot = hotelFixture;
  const [connected, setConnected] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [seconds, setSeconds] = useState(snapshot.secondsToService);
  const [now, setNow] = useState(() => new Date("2026-01-01T14:20:00Z").getTime());

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 900 : s - 1));
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const events = useMemo(() => buildActivity(now), [now]);
  const serviceArriving = seconds <= 60;
  const roomServiceState = serviceArriving
    ? ("ROOM SERVICE ARRIVING" as const)
    : snapshot.roomServiceState;

  return (
    <div className="hotel-shell">
      <HotelHeader
        operationalState={snapshot.operationalState}
        secondsToService={seconds}
        connected={connected}
        wallet={snapshot.stay.wallet}
        onToggleWallet={() => setConnected((c) => !c)}
      />

      <main className="hotel-main">
        <div className="hotel-grid">
          <YourStayPanel
            stay={snapshot.stay}
            connected={connected}
            onConnect={() => setConnected(true)}
            onFocusRoom={() => setSelectedRoom(snapshot.stay.room)}
          />

          <HotelFacade
            rooms={snapshot.rooms}
            connectedRoom={connected ? connectedRoom : null}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            serviceArriving={serviceArriving}
          />

          <RoomServicePanel
            state={roomServiceState}
            claimableEth={snapshot.claimableEth}
            lastServiceEth={snapshot.lastServiceEth}
            secondsToService={seconds}
            connected={connected}
            claimed={claimed}
            onClaim={() => setClaimed(true)}
          />
        </div>

        <LiveActivity events={events} now={now} />
        <MarketStrip snapshot={snapshot} />
      </main>

      <footer className="hotel-footer">
        <span className="hotel-footer__brand">HOTEL100</span>
        <span className="hotel-footer__sep" aria-hidden="true" />
        <span className="hotel-footer__tag">100 rooms. No reservations.</span>
        <button
          type="button"
          className="hotel-footer__lobby"
          onClick={() => setLobbyOpen(true)}
        >
          Enter the Lobby
        </button>
        <span className="hotel-footer__motto">A higher kind of stay.</span>
      </footer>

      <LobbySheet open={lobbyOpen} guests={snapshot.lobby} onClose={() => setLobbyOpen(false)} />
    </div>
  );
}
```

### `src/components/hotel/HotelHeader.tsx`

```tsx
import logo from "@/assets/hotel100-logo3.png";
import { BellIcon } from "./icons";
import { clock } from "./format";
import type { OperationalState } from "@/lib/hotel-fixture";

type Props = {
  operationalState: OperationalState;
  secondsToService: number;
  connected: boolean;
  wallet: string;
  onToggleWallet: () => void;
};

export function HotelHeader({
  operationalState,
  secondsToService,
  connected,
  wallet,
  onToggleWallet,
}: Props) {
  const live = operationalState === "LIVE";

  return (
    <header className="hotel-header">
      <div className="hotel-header__brand">
        <span className="hotel-header__bell" aria-hidden="true">
          <BellIcon />
        </span>
        <img src={logo} alt="HOTEL100" className="hotel-header__logo" />
        <span className="hotel-header__tagline">100 rooms. No reservations.</span>
      </div>

      <div className="hotel-header__meta">
        <span className={live ? "hotel-pill hotel-pill--live" : "hotel-pill"}>
          <i className="hotel-dot" aria-hidden="true" />
          {live ? "LIVE" : operationalState}
        </span>
        <span className="hotel-header__rule" aria-hidden="true" />
        <span className="hotel-header__service">
          <span className="hotel-label">Next service</span>
          <span className="hotel-mono hotel-header__clock">{clock(secondsToService)}</span>
        </span>
        <button type="button" className="hotel-wallet-btn" onClick={onToggleWallet}>
          {connected ? wallet : "Connect Wallet"}
        </button>
      </div>
    </header>
  );
}
```

### `src/components/hotel/YourStayPanel.tsx`

```tsx
import { ArrowUpIcon, ClockIcon, CopyIcon, StarIcon } from "./icons";
import { amount, duration } from "./format";
import type { HotelSnapshot } from "@/lib/hotel-fixture";

type Props = {
  stay: HotelSnapshot["stay"];
  connected: boolean;
  onConnect: () => void;
  onFocusRoom: () => void;
};

export function YourStayPanel({ stay, connected, onConnect, onFocusRoom }: Props) {
  return (
    <section className="hotel-panel hotel-stay" aria-labelledby="your-stay-heading">
      <div className="hotel-panel__head">
        <h2 id="your-stay-heading" className="hotel-panel__title">
          Your Stay
        </h2>
      </div>

      {!connected ? (
        <div className="hotel-stay__empty">
          <p className="hotel-stay__emptyLead">No key issued.</p>
          <p className="hotel-stay__emptyBody">
            Connect a wallet to see your room, rank and Room Service entitlement.
          </p>
          <button type="button" className="hotel-btn hotel-btn--ghost" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          <div className="hotel-walletcard">
            <span className="hotel-walletcard__label">
              <i className="hotel-dot" aria-hidden="true" />
              Connected wallet
            </span>
            <span className="hotel-walletcard__value">
              <span className="hotel-mono">{stay.wallet}</span>
              <CopyIcon className="hotel-walletcard__copy" />
            </span>
          </div>

          <button type="button" className="hotel-stay__room" onClick={onFocusRoom}>
            <span className="hotel-label">Room</span>
            <span className="hotel-stay__roomNumber">{stay.room}</span>
            <span className="hotel-stay__rank">Rank #{stay.rank}</span>
          </button>

          <div className="hotel-stay__balance">
            <span className="hotel-mono hotel-stay__balanceValue">{amount(stay.balance)}</span>
            <span className="hotel-stay__balanceUnit">HOTEL</span>
          </div>

          {stay.movement ? (
            <div className="hotel-movement">
              <span className="hotel-movement__icon" aria-hidden="true">
                <ArrowUpIcon />
              </span>
              <span className="hotel-movement__body">
                <span className="hotel-mono hotel-movement__amount">
                  {amount(stay.movement.amount)} HOTEL
                </span>
                <span className="hotel-movement__caption">
                  to Room {stay.movement.toRoom}
                </span>
              </span>
            </div>
          ) : null}

          <dl className="hotel-stay__facts">
            <div className="hotel-stay__fact">
              <ClockIcon className="hotel-stay__factIcon" />
              <dt>Checked in</dt>
              <dd>{duration(stay.checkedInMinutes)}</dd>
            </div>
            <div className="hotel-stay__fact">
              <StarIcon className="hotel-stay__factIcon" />
              <dt>Best room</dt>
              <dd>#{stay.bestRoom}</dd>
            </div>
          </dl>

          <div className="hotel-fob">
            <div className="hotel-fob__tag">
              <span className="hotel-fob__ring" aria-hidden="true" />
              <span className="hotel-fob__mark">HOTEL100</span>
              <span className="hotel-fob__sub">Stay higher</span>
            </div>
            <p className="hotel-fob__motto">
              {"Same "}
              <br />
              {"guests. "}
              <br />
              {"Higher "}
              <br />
              {"rooms."}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
```

### `src/components/hotel/HotelFacade.tsx`

```tsx
import logo from "@/assets/hotel100-logo3.png";
import type { HotelRoom } from "@/lib/hotel-fixture";
import { amount } from "./format";

type Props = {
  rooms: HotelRoom[];
  connectedRoom: number | null;
  selectedRoom: number | null;
  onSelectRoom: (room: number | null) => void;
  serviceArriving: boolean;
};

/** Row 1 holds rooms 2-10 (9 windows); rows 2-10 hold ten windows each. */
function buildRows(rooms: HotelRoom[]) {
  const standard = rooms.filter((r) => r.room >= 2);
  const rows: HotelRoom[][] = [standard.slice(0, 9)];
  for (let i = 9; i < standard.length; i += 10) {
    rows.push(standard.slice(i, i + 10));
  }
  return rows;
}

export function HotelFacade({
  rooms,
  connectedRoom,
  selectedRoom,
  onSelectRoom,
  serviceArriving,
}: Props) {
  const penthouse = rooms.find((r) => r.room === 1);
  const rows = buildRows(rooms);
  const selected = selectedRoom ? rooms.find((r) => r.room === selectedRoom) : null;

  return (
    <section
      className={`hotel-facade${serviceArriving ? " hotel-facade--service" : ""}`}
      aria-label="HOTEL100 façade"
    >
      <div className="hotel-facade__sky" aria-hidden="true" />

      <div className="hotel-building">
        <div className="hotel-building__pediment" aria-hidden="true">
          <span className="hotel-building__finial" />
        </div>

        <div className="hotel-building__parapet">
          <span className="hotel-building__cornice" aria-hidden="true" />
          <img src={logo} alt="HOTEL100" className="hotel-building__logo" />
          <span className="hotel-building__motto">A higher kind of stay.</span>
        </div>

        <div className="hotel-penthouse">
          <span className="hotel-pilaster hotel-pilaster--left" aria-hidden="true" />

          <div className="hotel-penthouse__terrace" aria-hidden="true">
            <span className="hotel-penthouse__baluster" />
            <span className="hotel-penthouse__baluster" />
            <span className="hotel-penthouse__baluster" />
            <span className="hotel-penthouse__baluster" />
          </div>

          <div className="hotel-penthouse__pavilion">
            <span className="hotel-penthouse__roof" aria-hidden="true" />
            <div className="hotel-penthouse__suite" aria-hidden="true">
              <span className="hotel-penthouse__chandelier" />
              <span className="hotel-penthouse__arch" />
              <span className="hotel-penthouse__arch hotel-penthouse__arch--wide" />
              <span className="hotel-penthouse__arch" />
            </div>
            <button
              type="button"
              className={`hotel-penthouse__plaque${
                connectedRoom === 1 ? " is-connected" : ""
              }${selectedRoom === 1 ? " is-selected" : ""}`}
              onClick={() => onSelectRoom(selectedRoom === 1 ? null : 1)}
              aria-label={
                penthouse?.occupied
                  ? `Penthouse, Room 01, occupied by ${penthouse.wallet}`
                  : "Penthouse, Room 01, vacant"
              }
            >
              <span className="hotel-penthouse__label">Penthouse</span>
              <span className="hotel-penthouse__number">Room 01</span>
            </button>
          </div>

          <div className="hotel-penthouse__holder">
            <span className="hotel-mono hotel-penthouse__holderWallet">
              {penthouse?.wallet ?? "vacant"}
            </span>
            <span className="hotel-mono hotel-penthouse__holderBalance">
              {penthouse?.balance ? `${amount(penthouse.balance)} HOTEL` : "—"}
            </span>
          </div>

          <span className="hotel-pilaster hotel-pilaster--right" aria-hidden="true" />
        </div>

        <div className="hotel-rows">
          <span className="hotel-pilaster hotel-pilaster--tall" aria-hidden="true" />
          <span
            className="hotel-pilaster hotel-pilaster--tall hotel-pilaster--right"
            aria-hidden="true"
          />
          {rows.map((row, index) => (
            <div className="hotel-row" key={index}>
              {row.map((room) => {
                const isConnected = room.room === connectedRoom;
                const isSelected = room.room === selectedRoom;
                return (
                  <button
                    type="button"
                    key={room.room}
                    className={`hotel-window${room.occupied ? " is-occupied" : " is-vacant"}${
                      isConnected ? " is-connected" : ""
                    }${isSelected ? " is-selected" : ""}`}
                    style={{ ["--lamp" as string]: (room.room % 5) / 10 }}
                    onClick={() => onSelectRoom(isSelected ? null : room.room)}
                    aria-label={
                      room.occupied
                        ? `Room ${room.room}, rank ${room.rank}, occupied by ${room.wallet}`
                        : `Room ${room.room}, vacant`
                    }
                  >
                    <span className="hotel-window__lintel" aria-hidden="true" />
                    <span className="hotel-window__glass" aria-hidden="true">
                      <span className="hotel-window__curtain" />
                      <span className="hotel-window__curtain hotel-window__curtain--right" />
                      <span className="hotel-window__mullion" />
                      <span className="hotel-window__transom" />
                    </span>
                    <span className="hotel-window__sill" aria-hidden="true" />
                    <span className="hotel-window__plaque">
                      <span className="hotel-window__number hotel-mono">
                        {String(room.room).padStart(2, "0")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="hotel-entrance">
          <div className="hotel-entrance__wing" aria-hidden="true">
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
          </div>
          <span className="hotel-entrance__lamp" aria-hidden="true" />
          <div className="hotel-entrance__canopy" aria-hidden="true">
            <span className="hotel-entrance__dome" />
            <span className="hotel-entrance__valance" />
          </div>
          <div className="hotel-entrance__doors">
            <span className="hotel-entrance__sign">HOTEL100</span>
            <span className="hotel-entrance__door" aria-hidden="true" />
            <span className="hotel-entrance__door" aria-hidden="true" />
          </div>
          <span className="hotel-entrance__lamp hotel-entrance__lamp--right" aria-hidden="true" />
          <div className="hotel-entrance__wing hotel-entrance__wing--right" aria-hidden="true">
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
            <span className="hotel-entrance__bay" />
          </div>
          <p className="hotel-entrance__plaque">
            100 rooms.
            <br />
            No reservations.
          </p>
        </div>

        <div className="hotel-plinth" aria-hidden="true">
          <span className="hotel-plinth__step" />
          <span className="hotel-plinth__step hotel-plinth__step--wide" />
        </div>

        <div className="hotel-hedge" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <span key={i} className="hotel-hedge__tree" style={{ ["--i" as string]: i }} />
          ))}
        </div>
      </div>

      <div className="hotel-facade__foot">
        {selected ? (
          <p className="hotel-facade__selected">
            <span className="hotel-facade__selectedRoom">
              {selected.room === 1 ? "Penthouse · Room 01" : `Room ${selected.room}`}
            </span>
            <span className="hotel-facade__selectedSep" aria-hidden="true" />
            {selected.occupied ? (
              <>
                <span className="hotel-mono">{selected.wallet}</span>
                <span className="hotel-facade__selectedSep" aria-hidden="true" />
                <span className="hotel-mono">{amount(selected.balance ?? 0)} HOTEL</span>
                <span className="hotel-facade__selectedSep" aria-hidden="true" />
                <span>Rank #{selected.rank}</span>
              </>
            ) : (
              <span className="hotel-facade__selectedVacant">Unoccupied</span>
            )}
          </p>
        ) : (
          <p className="hotel-facade__quiet" aria-hidden="true">
            <span className="hotel-facade__quietRule" />
          </p>
        )}
      </div>
    </section>
  );
}
```

### `src/components/hotel/RoomServicePanel.tsx`

```tsx
import { BellIcon, ClockIcon, LedgerIcon } from "./icons";
import { clock } from "./format";
import type { RoomServiceState } from "@/lib/hotel-fixture";

type Props = {
  state: RoomServiceState;
  claimableEth: string;
  lastServiceEth: string;
  secondsToService: number;
  connected: boolean;
  claimed: boolean;
  onClaim: () => void;
};

export function RoomServicePanel({
  state,
  claimableEth,
  lastServiceEth,
  secondsToService,
  connected,
  claimed,
  onClaim,
}: Props) {
  const stateLabel = state.replace("ROOM SERVICE ", "");

  return (
    <section className="hotel-panel hotel-service" aria-labelledby="room-service-heading">
      <div className="hotel-panel__head hotel-panel__head--icon">
        <span className="hotel-service__bell" aria-hidden="true">
          <BellIcon />
        </span>
        <h2 id="room-service-heading" className="hotel-panel__title">
          Room Service
        </h2>
      </div>

      <p className="hotel-service__lead">The pool awaits</p>

      <div className={`hotel-service__amount hotel-service__amount--${stateLabel.toLowerCase()}`}>
        <span className="hotel-mono hotel-service__value">
          {connected ? claimableEth : "—.——"}
          <span className="hotel-service__unit">ETH</span>
        </span>
        <span className="hotel-service__state">{stateLabel}</span>
      </div>

      <button
        type="button"
        className="hotel-btn hotel-btn--claim"
        onClick={onClaim}
        disabled={!connected || claimed}
      >
        {claimed ? "Room Service claimed" : "Claim Room Service"}
      </button>
      <p className="hotel-service__note">
        {connected
          ? "Prototype only — no transaction is broadcast."
          : "Connect a wallet to view your entitlement."}
      </p>

      <dl className="hotel-service__facts">
        <div className="hotel-service__fact">
          <ClockIcon className="hotel-service__factIcon" />
          <div>
            <dt>Next service</dt>
            <dd className="hotel-mono">{clock(secondsToService)}</dd>
          </div>
        </div>
        <div className="hotel-service__fact">
          <LedgerIcon className="hotel-service__factIcon" />
          <div>
            <dt>Last service</dt>
            <dd className="hotel-mono">
              {lastServiceEth} <span className="hotel-service__factUnit">ETH</span>
            </dd>
          </div>
        </div>
      </dl>

      <blockquote className="hotel-service__quote">
        <p>“Same guests.</p>
        <p>Bigger stays.”</p>
        <cite>HOTEL100</cite>
      </blockquote>
    </section>
  );
}
```

### `src/components/hotel/LiveActivity.tsx`

```tsx
import type { ReactElement } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BellIcon,
  CrownIcon,
  DoorIcon,
  KeyIcon,
} from "./icons";
import { hhmm, relative } from "./format";
import type { ActivityEvent, ActivityKind } from "@/lib/hotel-fixture";

const ICONS: Record<ActivityKind, (p: { className?: string }) => ReactElement> = {
  "check-in": KeyIcon,
  upgrade: ArrowUpIcon,
  downgrade: ArrowDownIcon,
  "room-service": BellIcon,
  penthouse: CrownIcon,
  "check-out": DoorIcon,
};

export function LiveActivity({ events, now }: { events: ActivityEvent[]; now: number }) {
  return (
    <section className="hotel-panel hotel-activity" aria-labelledby="activity-heading">
      <div className="hotel-activity__head">
        <h2 id="activity-heading" className="hotel-panel__title hotel-activity__title">
          <i className="hotel-dot" aria-hidden="true" />
          Live Activity
        </h2>
        <span className="hotel-activity__sub">Real-time hotel activity</span>
        <span className="hotel-activity__all">
          All activity
          <ArrowRightIcon className="hotel-activity__allIcon" />
        </span>
      </div>

      <ul className="hotel-activity__list">
        {events.map((event) => {
          const Icon = ICONS[event.kind];
          return (
            <li className="hotel-activity__row" key={event.id}>
              <span className="hotel-mono hotel-activity__time">{hhmm(event.at)}</span>
              <span className={`hotel-activity__icon is-${event.kind}`} aria-hidden="true">
                <Icon />
              </span>
              <span className="hotel-activity__text hotel-mono">{event.text}</span>
              <span className="hotel-activity__ago">{relative(event.at, now)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

### `src/components/hotel/MarketStrip.tsx`

```tsx
import { ArrowRightIcon, MarketIcon } from "./icons";
import { amount } from "./format";
import type { HotelSnapshot } from "@/lib/hotel-fixture";

/**
 * Price, market cap, liquidity and the trade destination are NOT exposed by the
 * canonical hotel state API, so they are never invented here — the strip shows
 * them as unavailable until a real source is approved.
 */
export function MarketStrip({ snapshot }: { snapshot: HotelSnapshot }) {
  const unavailable = <span className="hotel-market__unavailable">Not published</span>;

  return (
    <section className="hotel-panel hotel-market" aria-labelledby="market-heading">
      <h2 id="market-heading" className="hotel-market__title">
        <MarketIcon className="hotel-market__icon" />
        Hotel Market
      </h2>

      <span className="hotel-market__rule" aria-hidden="true" />

      <dl className="hotel-market__figures">
        <div className="hotel-market__figure">
          <dt>$HOTEL</dt>
          <dd>{snapshot.priceUsd === null ? unavailable : `$${snapshot.priceUsd}`}</dd>
        </div>
        <div className="hotel-market__figure">
          <dt>MC</dt>
          <dd>{snapshot.marketCapUsd === null ? unavailable : `$${snapshot.marketCapUsd}`}</dd>
        </div>
        <div className="hotel-market__figure">
          <dt>LIQ</dt>
          <dd>{snapshot.liquidityUsd === null ? unavailable : `$${snapshot.liquidityUsd}`}</dd>
        </div>
        <div className="hotel-market__figure">
          <dt>Holders</dt>
          <dd className="hotel-mono">{amount(snapshot.holderCount)}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="hotel-btn hotel-btn--trade"
        disabled={snapshot.tradeUrl === null}
        title={
          snapshot.tradeUrl === null
            ? "No trade destination is published by the hotel state API"
            : undefined
        }
      >
        Trade $HOTEL
        <ArrowRightIcon className="hotel-btn__icon" />
      </button>
    </section>
  );
}
```

### `src/components/hotel/LobbySheet.tsx`

```tsx
import { amount } from "./format";
import type { LobbyGuest } from "@/lib/hotel-fixture";

type Props = {
  open: boolean;
  guests: LobbyGuest[];
  onClose: () => void;
};

export function LobbySheet({ open, guests, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="hotel-lobby" role="dialog" aria-modal="true" aria-label="The Lobby">
      <button
        type="button"
        className="hotel-lobby__scrim"
        aria-label="Close the lobby"
        onClick={onClose}
      />
      <div className="hotel-lobby__sheet">
        <div className="hotel-lobby__head">
          <h2 className="hotel-panel__title">The Lobby</h2>
          <button type="button" className="hotel-lobby__close" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="hotel-lobby__lead">
          Rank #101 and below. No room, no Room Service — the shortest way up is Room 100.
        </p>
        <ul className="hotel-lobby__list">
          {guests.map((guest) => (
            <li className="hotel-lobby__row" key={guest.rank}>
              <span className="hotel-mono hotel-lobby__rank">#{guest.rank}</span>
              <span className="hotel-mono hotel-lobby__wallet">{guest.wallet}</span>
              <span className="hotel-mono hotel-lobby__balance">{amount(guest.balance)} HOTEL</span>
              <span className="hotel-lobby__gap">
                +{amount(guest.toRoom100)} to Room 100
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### `src/components/hotel/format.ts`

```tsx
export function clock(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Relative time derived from a canonical timestamp — never a separate source. */
export function relative(iso: string, now: number) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function amount(n: number) {
  return n.toLocaleString("en-US");
}
```

### `src/components/hotel/icons.tsx`

```tsx
type P = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function BellIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 17h14l-1.4-2.2V11a5.6 5.6 0 0 0-11.2 0v3.8L5 17Z" />
      <path d="M10.4 20h3.2" />
      <path d="M12 5.4V4" />
    </svg>
  );
}

export function ClockIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.4l3 1.8" />
    </svg>
  );
}

export function StarIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.1-4.6-2.5-4.6 2.5.9-5.1L4.5 10l5.2-.7L12 4.5Z" />
    </svg>
  );
}

export function CopyIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="1.6" />
      <path d="M15 6.5A1.5 1.5 0 0 0 13.5 5H6.5A1.5 1.5 0 0 0 5 6.5v7A1.5 1.5 0 0 0 6.5 15" />
    </svg>
  );
}

export function LedgerIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="6" y="4" width="12" height="16" rx="1.6" />
      <path d="M9 9h6M9 12.5h6M9 16h3.5" />
    </svg>
  );
}

export function MarketIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 19V13M11 19V6M16 19v-8M21 19H4" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 19V6M7 11l5-5 5 5" />
    </svg>
  );
}

export function ArrowDownIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 5v13M17 13l-5 5-5-5" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  );
}

export function KeyIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4.5" y="6" width="9" height="12" rx="2" />
      <circle cx="17.5" cy="8" r="2.2" />
    </svg>
  );
}

export function CrownIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 17h16l-1.2-8-4 3.2L12 6l-2.8 6.2-4-3.2L4 17Z" />
    </svg>
  );
}

export function DoorIcon({ className }: P) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M7 20V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V20" />
      <path d="M5 20h14M13.6 12h.01" />
    </svg>
  );
}
```

## 19. Production mapping

**`apps/web/src/hotel/components/HotelView.tsx`** adopts the prototype's DOM structure and class names for: header, Your Stay panel, façade (building, penthouse, rows, entrance, plinth, hedge, selected-room foot), Room Service panel, Live Activity, Market strip, footer/Lobby trigger.

**Retain existing production logic in `HotelView.tsx` (do not replace with prototype behaviour):**
- canonical state fetch/polling of `GET /api/hotel/state` and its fail-closed handling;
- frozen ranking → room mapping (balance desc, then numeric wallet asc; #1 Penthouse, #2–#100 rooms, #101+ Lobby);
- occupancy, balances, move-up amounts, check-in duration, best room, holder count;
- Room Service state machine (WAITING / ARRIVING / DELAYED), 15-minute cycle timing, entitlement figures, claimable amount;
- claim flow: wallet connection, chain 4663 validation, EIP-712 signature, simulation, send, receipt confirmation, refresh only after confirmation;
- stale → `HOTEL SYNCING` withholding, pre-live → `HOTEL CHECK-IN OPENS SOON`;
- Lobby data for #101+;
- activity feed source and event kinds (prototype only supplies the icon map and relative-time formatting).

**Must NOT be ported (fixture-only):**
- `src/lib/hotel-fixture.ts` in its entirety (rooms, wallets, balances, lobby guests, `buildActivity`, `connectedRoom = 47`);
- the local `seconds` 900-second countdown loop and `serviceArriving = seconds <= 60` trigger — use real service timing;
- `useState` wallet toggle (`onToggleWallet`) standing in for wallet connection;
- local `claimed` boolean standing in for a confirmed claim;
- the copy "Prototype only — no transaction is broadcast.";
- the fixed `new Date("2026-01-01T14:20:00Z")` seed time;
- hard-coded `null` market values *as constants* — production still renders "Not published" but derives nullity from the canonical state.

**`apps/web/src/app/globals.css`** receives §17 in full, in order, inside the existing global stylesheet: tokens/base first (hotel `:root` variables, `--font-*`, `body` background, `.hotel-mono`, `.hotel-label`, `.hotel-dot`), then header, layout, panels, façade, penthouse, rooms, entrance, activity, market, the appended refinement/architectural/polish passes (order matters), then the 1200 / 880 / 560 media blocks and the reduced-motion block last. Tailwind `@theme inline` / shadcn aliasing is prototype scaffolding — keep only if production uses the same token layer. Fonts must be registered in `app/layout.tsx`.

## 20. Regression checklist (production port)

- [ ] All 100 rooms render (Penthouse + 99 windows), 10 floors
- [ ] Rank ↔ room mapping unchanged (balance desc, wallet asc; #1 Penthouse, #2–#100, #101+ Lobby)
- [ ] Connected guest's room highlighted in muted gold
- [ ] Stale state withholds data → `HOTEL SYNCING`
- [ ] Pre-live state → `HOTEL CHECK-IN OPENS SOON`
- [ ] Lobby lists #101+ with balance and amount to Room 100
- [ ] Exact move-up amounts from canonical state
- [ ] Room Service countdown driven by real 15-minute cycle
- [ ] Claimable amount and WAITING / ARRIVING / DELAYED states correct
- [ ] Wallet connection behaviour unchanged
- [ ] Chain 4663 validation enforced
- [ ] EIP-712 claim structure unchanged
- [ ] Transaction simulation before send
- [ ] Receipt confirmation required
- [ ] State refresh only after confirmation
- [ ] `prefers-reduced-motion` honoured (single warmth animation suppressed)
- [ ] 1440px appearance matches the approved screenshot
- [ ] 1024px appearance matches the approved screenshot
- [ ] 390px appearance matches the approved screenshot
- [ ] No horizontal overflow at 1440 / 1024 / 390 (`scrollWidth === clientWidth`)
- [ ] No fixture data, prototype copy, or local countdown/claim state shipped
