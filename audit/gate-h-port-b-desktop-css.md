# Gate H — Phase B desktop CSS (1440px)

**UTC timestamp:** `2026-09-19T14:26:15Z`  
**Gate:** H — Public HOTEL UI (Phase B only: 1440px desktop visual CSS)  
**Spec / handoff:** `design/hotel100/HOTEL100-Production-UI-Handoff.md` §17 (desktop passes only)  
**Prior phase:** `audit/gate-h-port-a-structure.md`  
**Production broadcasts performed:** `NONE`

---

## Verdict

**PASS — PHASE B DESKTOP CSS PORTED AT 1440px**

---

## Git state

| Field | Value |
|------|--------|
| Branch | `main` |
| HEAD | `eab9af1515695c432923daa4bc426440027cf464` |
| Working-tree state | Dirty — Phase A + Phase B uncommitted; no commit/push |
| Phase B files | `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `biome.json`, screenshot + this report |

Backend, contracts, database, worker, indexer, and Phase A production logic/markup were not rewritten for this phase.

---

## CSS sections ported

From §17, **in handoff source order**, excluding responsive `max-width` media blocks:

| Section | Status |
|---------|--------|
| Tokens / `:root` hotel palette + font stacks (+ unused shadcn aliases kept from handoff `:root`) | Ported |
| Base body / `.hotel-mono` / `.hotel-label` / `.hotel-dot` | Ported |
| Header | Ported |
| Page / `.hotel-shell` / `.hotel-main` / `.hotel-grid` | Ported |
| Side panels (Your Stay, Room Service) | Ported |
| Façade / building / sky | Ported |
| Penthouse | Ported |
| Standard rooms / windows | Ported |
| Entrance / plinth / hedge | Ported |
| Live Activity | Ported |
| Hotel Market | Ported |
| Footer / Lobby sheet | Ported |
| Motion + `prefers-reduced-motion` | Ported |
| Refinement / architectural / polish passes (cascade overrides preserved) | Ported |
| ETH overflow guard (desktop rules) | Ported |
| Responsive `@media (max-width: 1200/880/560)` | **Deferred** (Phase C+) |

Also retained production-only `.sr-only` and a token-aligned `.hotel-op-banner` (Phase A operational banner; not in Lovable CSS).

**Not ported:** Tailwind `@import` / `@theme` / `@layer` / `.dark` scaffolding (production has no that token layer).

**One mechanical CSS fix:** the prototype hedge rule `calc(18px + (var(--i) % 4) * 6px)` is invalid CSS (`%` is not JS modulo). Replaced with `height: 18px` and a comment; later approved hedge passes still set final heights via `nth-child` — final 1440 appearance unchanged.

---

## Font changes

`apps/web/src/app/layout.tsx` already used `next/font/google`. Aligned CSS variables to the handoff names:

| Family | `next/font` | CSS variable |
|--------|-------------|--------------|
| Inter (400/500/600) | yes | `--font-sans` |
| Cormorant Garamond (400/500/600, italic) | yes | `--font-display` |
| IBM Plex Mono (400/500) | yes | `--font-mono` |

`:root` keeps the handoff fallback stacks; body class variables supply the loaded faces.

---

## Biome

`biome.json` override for `apps/web/src/app/globals.css`:

- formatter **off** (preserve handoff source formatting / cascade order)
- `noImportantStyles` / `noDescendingSpecificity` **off** (intentional reduced-motion `!important` and multi-pass overrides)

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm --filter @hotel100/web test` | **PASS** — 34 tests |
| `pnpm --filter @hotel100/web typecheck` | **PASS** |
| `pnpm --filter @hotel100/web lint` | **PASS** |
| `pnpm --filter @hotel100/web build` | **PASS** |
| Local `next start` (`127.0.0.1:3010`) | **PASS** |
| 1440 screenshot | `audit/gate-h-screenshots/phase-b-desktop-1440.png` |
| 1440 horizontal overflow (`scrollWidth === clientWidth`) | **PASS** — both `documentElement` and `body` = **1440**; `.hotel-shell` = **1440** |
| Production broadcast | **NONE** |

Runtime DOM at 1440 (fail-closed, no DB): `.hotel-shell` + `.hotel-facade` present, **99** `[data-room]` windows, header pill **HOTEL SYNCING**.

---

## Visible differences vs approved Lovable desktop

Styling contract at 1440 matches the Lovable desktop structure (three-column shell, stone façade, panels, activity/market strips, footer). Expected **content** differences vs the fixture prototype (not CSS failures):

- **HOTEL SYNCING** + operational banner — production fail-closed without a live index (no fixture holders).
- All rooms vacant / penthouse “vacant” — same reason.
- Room Service **—.—— ETH / NONE**, claim disabled — no connected entitlement.
- Live Activity empty; Market figures **Not published**.
- Production op-banner strip under the header (Lovable had no equivalent).

Responsive polish at 1024 / 390 is **out of scope** for Phase B.

---

## Follow-on

- Phase C: port §17 responsive `max-width` blocks (1200 / 880 / 560 / 390) and re-check overflow + screenshots at those widths.
