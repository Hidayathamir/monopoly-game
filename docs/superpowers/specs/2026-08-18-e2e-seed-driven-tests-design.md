# E2E Seed-Driven Tests Design

**Date:** 2026-08-18

## Goal

Make 5 e2e tests faster and more deterministic by seeding a mid-game `Waiting`
state into the room via `POST /seed` instead of clicking through room setup and
playing turns until a target state is reached.

## Context

- The server supports `E2E_SEED_ENABLED=true`; `POST /seed {code, state}`
  validates the state, replaces the room's state wholesale, cancels pending bot
  timers, and broadcasts to all clients (`server/gameServer.ts:189`).
- `createSeededState(spec)` in `src/logic/seed.ts` builds a full `GameState`
  from a compact `SeedSpec`. `validateStateForRoom` requires the room's joined
  slots to match the seed's players exactly (player `i` at `players[i]`), and
  `currentPlayer` must be a connected client or a bot slot.
- Existing seed e2e: `e2e/seed.spec.ts` + `e2e/helpers/seed.ts` (`seedGame`) +
  `e2e/fixtures/bankruptcy-seed.ts` (generated 912-line literal).

## Key findings that shape this design

### Finding 1: e2e specs cannot import `src/logic/seed.ts` at runtime

Playwright's ESM loader rejects the bare JSON imports in `src/data/*`
(`src/data/board.ts`, `src/data/cards.ts`): importing `createSeededState` from
an e2e spec throws

```
TypeError: Module "…/src/data/board-data.json" needs an import attribute of "type: json"
```

Verified empirically. `import type { GameState }` is fine (type-only, erased),
but any runtime import that reaches `board-data.json`/`cards-data.json` fails.

**Consequence:** `seedWaitingGame` cannot literally call `createSeededState`.
Instead we generate a checked-in fixture that *embeds the output of*
`createSeededState` (board + card decks) — a new `npm run print-initial-state`
script (built on `createSeededState`, runnable via `tsx`) writes
`e2e/fixtures/initial-state.ts`. The e2e helper assembles compact `Waiting`
states from that fixture. This keeps the helper API exactly as intended and
avoids any hand-maintained 900-line JSON in the specs; the fixture is
generated, shared, and regenerable (same pattern as `bankruptcy-seed.ts`).

### Finding 2: seeding a bot's turn does not auto-play the bot

`seedState` clears bot timers and broadcasts but never calls `driveBots()`. So
after `POST /seed` with `currentPlayer = <bot slot>`, the bot just sits idle;
the existing unit test `seedState cancels a pending bot timer on re-seed`
(`server/__tests__/gameServer.test.ts:585`) explicitly asserts the bot does
**not** act after re-seed. No benign client action can trigger `driveBots`
when it is the bot's turn (all non-turn actions are rejected).

**Consequence:** requirement (b) — "seed currentPlayer = bot slot so the bot
auto-plays immediately" — is impossible without a small server change. We add
`this.driveBots()` at the end of `seedState`. This is safe for every other seed
use: `driveBots` no-ops when `currentPlayer` is a connected human slot
(bankruptcy seed, tests a/c/d/e). The existing re-seed unit test is updated to
seed `currentPlayer: 0` (a human) so its cancellation semantics still hold, and
a new unit test covers bot-driving-after-seed.

## Assumptions (made on the user's behalf; user asleep)

1. **Feature branch only, no merge.** Work lives on
   `feature/e2e-seed-driven-tests`; the user merges to `main` manually.
2. **Server change is in scope.** The `driveBots()`-after-seed change is the
   minimal enabler for requirement (b). It changes no wire format and no game
   rules; it only resumes autonomous play when the seeded `currentPlayer` is a
   bot slot.
3. **Generated fixture approach.** Because of Finding 1, the helper cannot
   import `createSeededState`. The generated `initial-state.ts` fixture is the
   repo-consistent way to stay "built on `createSeededState`" while keeping the
   runtime import JSON-free. Alternative considered and rejected: spawning a
   `tsx` child process per seed call (slow, fragile, non-idiomatic).
4. **Seeded player defaults.** `money` defaults to 1500 (`STARTING_MONEY`),
   `position` 0, `passedGo` true, `isBot`/`botControlled` false unless given.
5. **Turn order default.** `turnOrder` defaults to `players.map(p => p.id)`
   (host first) unless specified. Test (b) explicitly passes `turnOrder: [0, 1]`
   so the host plays first and the bot gets its turn next.
6. **Tests to seed:** the 5 named below. `multiplayer.spec.ts:4` keeps its real
   Start-button coverage; the two soak tests (`monopoly.spec.ts:52`, `:96`) and
   pure-lobby tests are untouched.
7. **`currentPlayer` chosen per test:** host (connected human) everywhere
   except (b), where it is the bot slot (slot 1) so the bot auto-plays.

## Seed helper API

In `e2e/helpers/seed.ts` (no semicolons, matching the file):

```ts
export interface SeedWaitingPlayerSpec {
  id: number
  name: string
  money?: number
  isBot?: boolean
}

export interface SeedWaitingOptions {
  players: SeedWaitingPlayerSpec[]
  currentPlayer: number
  turnOrder?: number[]
}

export function buildWaitingState(opts: SeedWaitingOptions): GameState

export async function seedWaitingGame(
  url: string,
  code: string,
  opts: SeedWaitingOptions,
): Promise<void>
```

`buildWaitingState` builds a `GamePhase.Waiting` state (players sorted by id,
each at its own slot index; empty board ownership; `dice: null`,
`pendingAction: null`; default decks from the generated fixture; all other
fields matching `createSeededState` defaults) and `seedWaitingGame` POSTs it
through the existing `seedGame`.

## Server change

`server/gameServer.ts` `seedState`: after `this.broadcast()`, call
`this.driveBots()`.

Unit tests (`server/__tests__/gameServer.test.ts`):
- Update `seedState cancels a pending bot timer on re-seed`: seed
  `currentPlayer: 0` (Alice, human) instead of the bot slot; assert
  `currentPlayer` stays `0` and no bot action occurs after advancing timers.
- Add `seedState resumes bot driving when it is a bot turn`: seed
  `currentPlayer: 1` (Droid, bot), advance `BOT_STEP_MS`, assert phase moves to
  `Rolling`.

## Test rewrites

All five keep the room-create + join steps and call `seedWaitingGame` after the
room is populated (replacing Add-Bot/Start/wait dances):

1. **`e2e/multiplayer.spec.ts` "a player can hold-to-roll without breaking
   multiplayer"** — host + guest join; seed `currentPlayer: 0` (host); assert
   the host's Roll button (deterministic, remove the either-player branch);
   hold-to-roll on the host; assert dice pips appear.

2. **`e2e/multiplayer.spec.ts` "host adds a bot, starts, and the bot
   auto-plays"** — host creates; click Add Bot once; seed
   `players: [host, Droid(bot)], currentPlayer: 1, turnOrder: [0, 1]`; assert
   `waiting-for` shows Droid; assert control returns to host (Roll button
   visible, 30s). Remove `playHostTurns`/`stopOnWaitingFor`.

3. **`e2e/multiplayer.spec.ts` "a player who refreshes mid-game rejoins"** —
   host + guest join; seed a `Waiting` game (`currentPlayer: 0`); assert both
   sidebars; reload the guest page; assert sidebar + guest name.

4. **`e2e/multiplayer.spec.ts` "a player can leave the room mid-game"** — host +
   guest join; seed a `Waiting` game (`currentPlayer: 0`); guest leaves; assert
   guest returns to the menu (`h1` Monopoly).

5. **`e2e/monopoly.spec.ts` "center panel fits on viewports"** — per viewport:
   create room; click Add Bot once (2 joined slots needed); seed
   `players: [host, bot], currentPlayer: 0`; assert board + sidebar fit. Layout
   assertions unchanged.

## Files touched

- Create: `scripts/print-initial-state.ts` (generator, uses `createSeededState`)
- Create: `e2e/fixtures/initial-state.ts` (generated: board + card decks)
- Modify: `package.json` (`print-initial-state` script)
- Modify: `e2e/helpers/seed.ts` (`buildWaitingState`, `seedWaitingGame`)
- Modify: `server/gameServer.ts` (`seedState` → `driveBots()`)
- Modify: `server/__tests__/gameServer.test.ts` (update + add seed tests)
- Modify: `e2e/multiplayer.spec.ts` (tests a–d)
- Modify: `e2e/monopoly.spec.ts` (test e)

## Verification

- `npm run build` (dist/ required by server-backed specs)
- `npm run typecheck`, `npm run lint`
- `npm run test:unit`
- `npx playwright test` — full e2e suite passes; run each of the 5 updated
  specs multiple times to confirm no flakes.
