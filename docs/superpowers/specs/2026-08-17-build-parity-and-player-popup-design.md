# Monopoly — Build Rule Parity & Player Popup Fix

**Date**: 2026-08-17
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared `gameReducer` is the single source of truth)

## Issues

1. **Bots can build houses from anywhere.** A human can only build while standing on their own property; bots build at the start of their turn from any property they own.
2. **Player popup goes off-screen on Android (portrait).** Tapping a player in the player list opens a `position: fixed` popup that extends past the right edge of the viewport, so only half is visible.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1a | Build rule enforcement | Enforce "build only on the property the current player is standing on" in `gameReducer` (authoritative, shared by client and server) — not just in the bot's decision |
| 1b | Bot build volume | Bot builds **once per landing** (a "built this stop" flag), then ends its turn |
| 1c | Bot cash buffer | Drop the old `money - cost < 50` buffer so the bot's build decision mirrors the human Build button (`money >= cost`) |
| 2a | Popup positioning | Measure the popup after render and clamp/flip it to stay within the viewport |
| 2b | Touch dismissal | Add tap-to-dismiss: a `pointerdown` outside the popup and outside the originating card closes it |

## Issue 1 — Build rule parity

### Root cause

- `decideBotAction` (`src/logic/bot.ts:41-43`) runs `buildAction(state)` **before rolling** (`dice === null`) and the helper (`src/logic/bot.ts:50-67`) scans **every** owned property anywhere on the board, picking the cheapest.
- `gameReducer` `BuildHouse` (`src/logic/gameReducer.ts:411-431`) only checks houses `< 5`, cost, and money. It does **not** check ownership, mortgage, position, dice, or the just-bought rule.
- The server (`server/gameServer.ts:291-295`) only validates `isTurn`, so a crafted `BUILD_HOUSE` for any property would be accepted.
- The human UI gate already exists: `ActionSection.tsx:94-100` requires `dice !== null`, standing on own un-mortgaged property, houses `< 5`, and not the just-bought space. The reducer will now encode these same predicates so players and bots share one rule everywhere.

### Changes

**`src/types/game.ts`**
- Add `builtThisStop: boolean` to `GameState` (wire-neutral, internal).

**`src/logic/gameReducer.ts`**
- `createInitialState`: init `builtThisStop: false`.
- `RollDice` case: set `builtThisStop: false` (a new roll/move resets the "once per landing" window). Clear alongside the existing `justBoughtSpaceId: null` set at that case.
- `BuildHouse` case: succeed only when all of the following hold, else return `state` unchanged:
  - `space.id === player.position` (the current player is standing on it)
  - `space.owner === state.currentPlayer`
  - `state.dice !== null` (it was landed on this turn; prevents pre-roll builds)
  - `state.pendingAction === null`
  - `space.houses < 5`
  - `!space.mortgaged`
  - `getHouseCost(space, space.houses) > 0`
  - `player.money >= cost`
  - `space.id !== state.justBoughtSpaceId`
  - On success, also set `builtThisStop: true`.

**`src/logic/bot.ts`**
- `decideBotAction` `GamePhase.Waiting` branch:
  - `dice === null` → `{ type: RollDice }` only (no pre-roll build).
  - `dice !== null` (post-landing) → `buildAction(state)` if it would build, else `{ type: EndTurn }`.
- `buildAction`: consider **only** the space at `player.position`; require it to be the player's own, not mortgaged, houses `< 5`, a full color set (`isMonopoly`, unchanged existing bot preference), affordable (`money >= cost`, buffer dropped), and `!state.builtThisStop`. Return `null` otherwise.

**Tests**
- `src/logic/__tests__/gameReducer.test.ts` — `BUILD_HOUSE` cases (lines ~408-449) and event-log cases (lines ~963-976) must set the player's position to the target space and a rolled `dice` before dispatching. Add a new case: cannot build when **not** standing on the property (position elsewhere → state unchanged).
- `src/logic/__tests__/bot.test.ts` — update "builds a house on a completed, affordable color set" to stand on the property with `dice` set; add: does not build before rolling; builds once per landing (`builtThisStop: true` → `END_TURN`); does not build on an incomplete color set when standing on it (`END_TURN`).
- Add `builtThisStop: false` to `GameState` literals in `src/logic/__tests__/cards.test.ts`, `src/components/__tests__/TurnHeader.test.tsx`, and `src/components/__tests__/Sidebar.test.tsx`.

No `server/` changes: `driveBots` already re-runs `decideBotAction` after each action (guarded by `botSteps` cap), so a one-shot build is followed by `END_TURN` on the next step.

## Issue 2 — Player popup off-screen + tap-to-dismiss

### Root cause

`src/components/PlayerCard.tsx:138-142`: `PlayerPopup` is rendered in a `document.body` portal with `position: fixed`, `left: rect.right + 8`, `top: max(0, rect.top - 4)`, `max-w-[260px]`, `max-h-[60vh]`, and **no viewport clamping**. On a narrow portrait phone the popup (up to 260px) opens to the right of a card near the viewport edge and is clipped. Dismissal is hover-only (a 200ms leave timer), which is unreliable on touch where there is no real hover.

### Changes (`src/components/PlayerCard.tsx`)

- **Measure + clamp** (in `PlayerPopup`, via `useLayoutEffect` + a ref on the fixed div):
  - margin = 8.
  - Preferred `left = rect.right + 8`; if `left + width > innerWidth - margin`, flip left to `rect.left - width - 8`; snap the result into `[margin, innerWidth - width - margin]`.
  - Preferred `top = rect.top - 4`; snap into `[margin, innerHeight - height - margin]` (keeps the existing `max-h-[60vh]` scroll for tall lists).
  - Add `max-width: min(260px, 100vw - 16px)` as a safety clamp.
  - `useLayoutEffect` runs before paint, so no flicker.
- **Tap-to-dismiss**: while open, a document-level `pointerdown` listener closes the popup when the target is outside both the popup and the originating player card. Listener added in an effect while `popupRect` is set and removed on close/unmount. Use refs for the card (in `PlayerCard`) and the popup (in `PlayerPopup`) so the check is accurate.

**Tests** (`src/components/__tests__/PlayerCard.test.tsx`)
- jsdom has no real layout; mock the measured popup size (e.g. `Object.defineProperty` on the popup ref's `offsetWidth`/`offsetHeight`) and `window.innerWidth`/`innerHeight`, then assert the computed style keeps `left + width <= innerWidth` and flips to the left when a right-side placement would overflow.
- Add a tap-to-dismiss test: `pointerdown` on a target outside the card closes the popup.

## Out of scope

- The monopoly (full color-set) requirement for building: the reducer and human UI do not require it today; the bot keeping `isMonopoly` as a strategy choice is unchanged.
- Any change to rent, mortgage, sell, or trade rules.
- The `PropertyTooltip` board popup — it has its own positioning handled by `BoardGrid`.

## Verification

- `npm run test:unit`, `npm run typecheck`, `npm run lint`.
- `npm run build && npm run test:e2e` for a manual device check of the popup (server-backed specs need `dist/`).