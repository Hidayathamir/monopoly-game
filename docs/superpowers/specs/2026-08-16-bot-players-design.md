# Monopoly — Bot Players

**Date**: 2026-08-16
**Stack**: React 19 + TypeScript + Vite 8; Node.js + `ws`, `tsx`; i18next; Vitest + Playwright

## Goal

Let a human play against (or alongside) AI-controlled **bot players**. Bots are available in **both** game modes:

- **Local (single-device)**: mark individual seats as bots in the setup screen.
- **Multiplayer**: the host adds/removes bots in the lobby to fill empty seats.

Bots are **simple, one difficulty**: they auto-roll, buy any affordable unowned property, pay rent (liquidating houses/mortgaging to cover when short), build houses on owned monopolies when they can afford it, and otherwise play a full, legal game. They never propose or accept trades.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Architecture | Shared pure bot brain (`src/logic/bot.ts`) + thin per-context drivers (local `useGame` effect, server `GameServer`) — mirrors how `gameReducer` is already shared |
| 2 | Bot identity | `isBot: boolean` on `Player`, `LobbyPlayer`, and server `Slot` |
| 3 | Local setup UI | Player count becomes 2–6; each seat has a **Bot** checkbox |
| 4 | Multiplayer lobby UI | Host-only **Add Bot** button (fills next empty seat) + per-bot **remove** control |
| 5 | Human joining a full-of-bots room | `join()` fills the first free non-bot seat; if none and bots exist, it **replaces the newest bot** so humans are never locked out |
| 6 | Bot slots vs "left" slots | Bot slots are `connected: true` with no `clientId`, so `skipLeftPlayers()` (for disconnected humans) never treats them as left |
| 7 | Host never a bot | `nextConnectedSlot()` skips bot slots on host transfer |
| 8 | Bot pacing | Bots act on ~600–800ms timers so humans can watch |
| 9 | Persistence | `Player.isBot` changes `GameState` shape → bump `STATE_VERSION` 6 → 7 |
| 10 | Local `ROLL_DICE` | Routes through the existing local `roll()` helper (dice generation + anim timers); everything else dispatches directly |

## Architecture

### Shared bot brain — `src/logic/bot.ts` (NEW)

Pure function with no DOM/node dependencies, importable from both browser and server (same as `gameReducer`):

```ts
decideBotAction(state: GameState): GameAction | null
```

Returns the single next action the **current player** should take if they are a bot, else `null`. Decision table:

| State | Action |
|-------|--------|
| `Waiting`, not in jail, no pending, `dice === null`, owns a monopoly it can build on | `BUILD_HOUSE` (cheapest affordable buildable monopoly space) |
| `Waiting`, not in jail, no pending, `dice === null` | `ROLL_DICE` |
| `Waiting`, in jail, has card | `USE_GET_OUT_OF_JAIL_FREE` |
| `Waiting`, in jail, no card, can afford fine | `PAY_JAIL_FINE` |
| `Waiting`, in jail, otherwise | `ROLL_DICE` (attempt doubles) |
| pending `BuyProperty` | `BUY_PROPERTY` if `money >= price`, else `DECLINE_BUY` |
| pending `PayRent` | `PAY_RENT` if affordable; else `SELL_HOUSE` (first owned space with houses) → `MORTGAGE` → `PAY_RENT`; only `DECLARE_BANKRUPTCY` if still short |
| pending `DrawCard` | `DRAW_CARD` |
| pending `CardEffect` | `RESOLVE_CARD` |
| `Waiting` with `dice` set (movement resolved) | `END_TURN` |
| any other phase | `null` |

Each call returns **one** action; the driver loops (with a safety cap, like `skipLeftPlayers`'s guard) so multi-step decisions (house building, rent liquidation, doubles re-rolls) resolve turn by turn.

Building policy: build only on spaces in a complete color set (`isMonopoly`), only while affordable, and always spread houses (build on the currently-cheapest buildable space) — no hotel juggling. The "keep a little cash" rule: build only if `money - houseCost >= 50`.

### Data model

- **`src/types/game.ts`**: `Player` gains `isBot: boolean`; `START_GAME` action gains `isBot?: boolean[]` (defaults all `false`); reducer stamps it.
- **`src/types/net.ts`**: `LobbyPlayer` gains `isBot: boolean`; new client messages `{ type: 'addBot' }` and `{ type: 'removeBot'; playerId: number }`.
- **`src/hooks/useGame.ts`**: bump `STATE_VERSION` to `7`; `startGame(players: { name: string; isBot: boolean }[])`.
- **`src/data/bots.ts`** (NEW): fixed pool of bot names (e.g. `Bot A–F` or fun names), used by both local fallback and server `addBot`.

## Client changes

### `src/components/GameSetup.tsx` — local mode

- Player count dropdown: 2 → 2–6.
- Each seat row: name input (as today) plus a **Bot** checkbox. When checked, the seat is bot-controlled (name optional; falls back to the next bot name from the pool).
- `handleStart()` builds `{ name, isBot }[]` and calls `onStartLocal` with it.
- i18n: `setup.isBot`, `setup.addBotLabel` etc. in `en` + `id`.

### `src/components/Lobby.tsx` — multiplayer

- If `isHost`: an **Add Bot** button (disabled when 6 seats full) → `game.addBot()`.
- Each bot seat (`LobbyPlayer.isBot`) shows a compact remove control → `game.removeBot(playerId)`.
- Bot names display in the player list like any player.
- i18n: `lobby.addBot`, `lobby.removeBot`, `common.bot` in `en` + `id`.

### `src/hooks/useNetworkGame.ts`

- Add `addBot()` → `send({ type: 'addBot' })`.
- Add `removeBot(playerId)` → `send({ type: 'removeBot', playerId })`.

## Server changes

### `server/gameServer.ts`

- `Slot` gains `isBot: boolean`.
- **`addBot(clientId)`** — host-only, `Setup` phase only: find first empty seat (`clientId === null && !isBot`), fill with `{ clientId: null, name: <bot name>, connected: true, isBot: true }`, broadcast. Reject non-host / game-running / full.
- **`removeBot(clientId, playerId)`** — host-only, `Setup` phase only: clear that seat if it's a bot. Reject otherwise.
- **`join()`** — find first free non-bot seat; if none and at least one bot seat exists, **replace the newest bot** (highest index) with the joining human.
- **`start()`** — include bot seats in `joined` (`clientId !== null || isBot`); pass `isBot` flags in `START_GAME`.
- **Bot turn driving** — new `driveBots()` invoked from the same path as `scheduleAutoSteps()`: if the current player's slot `isBot`, `setTimeout(~700ms)` then `applyAction(decideBotAction(state))`, repeating until the current player is not a bot, with a guard cap. Refactor `roll()` so the human and bot paths share the dice-generation + `DICE_ANIMATED`/`RESOLVE_SPACE` timers.
- **`nextConnectedSlot()`** — skip `isBot` slots (bots never become host).
- **`skipLeftPlayers()`** — unchanged: bot slots are `connected: true` so they're never skipped as left.

### `src/types/net.ts` (protocol)

Client → server: `addBot`, `removeBot { playerId }`. Server → client: `LobbyPlayer` gains `isBot` (already delivered via `welcome`/`lobby`).

## Local driver — `src/hooks/useGame.ts`

Add an effect watching `state`:

- If the current player is a bot and `decideBotAction(state)` returns an action, dispatch it after ~600ms.
- `ROLL_DICE` → call the existing local `roll()` (it already rolls + times `DICE_ANIMATED`/`RESOLVE_SPACE`); all other actions dispatch via `send`.
- Guard with a ref/flag so actions are never double-scheduled while state settles.
- Existing auto-steps (auto `RESOLVE_SPACE`, auto `drawCard`) already cover those phases for bots too.

## Files summary

| File | Change |
|------|--------|
| `src/logic/bot.ts` | **NEW** — `decideBotAction(state)` pure bot brain |
| `src/data/bots.ts` | **NEW** — bot name pool |
| `src/types/game.ts` | `Player.isBot`; `START_GAME.isBot[]`; reducer stamps it |
| `src/types/net.ts` | `LobbyPlayer.isBot`; `addBot` / `removeBot` client messages |
| `src/hooks/useGame.ts` | `STATE_VERSION` → 7; `startGame({name,isBot}[])`; bot driver effect |
| `src/hooks/useNetworkGame.ts` | `addBot()`, `removeBot(playerId)` |
| `src/components/GameSetup.tsx` | 2–6 players; per-seat Bot checkbox |
| `src/components/Lobby.tsx` | Host "Add Bot" + per-bot remove |
| `server/gameServer.ts` | `Slot.isBot`; `addBot`/`removeBot`; join-replaces-bot; bot turn driver; host-transfer skips bots; `start()` passes `isBot` |
| `src/i18n/locales/{en,id}/translation.json` | New keys for bot labels |

## Testing

- **`src/logic/__tests__/bot.test.ts`** (NEW): `decideBotAction` returns the right action for each state — buy vs decline, rent liquidation sequence (sell → mortgage → pay → bankrupt), jail (card / fine / roll), building only on monopolies with a cash buffer, end-turn after movement, `null` for non-bot/other phases.
- **`server/__tests__/gameServer.test.ts`**: host-only add/remove bot; add fills empty seat, rejects full/started; remove clears a bot seat; `join()` replaces newest bot when all seats are bots; bot turn auto-plays to the next human and stops (no infinite loop); host transfer skips bot slots; `start()` includes bots.
- **`src/hooks/__tests__/useGame.test.ts`**: local game with bots advances multiple turns without stalling.
- **Playwright** (`e2e/`): local setup with 1 human + 1 bot starts and reaches the human's second turn; multiplayer lobby add/remove bot (host-only) and a bot auto-takes its turn in a room with one human.

## Out of scope

- Difficulty levels, personalities, strategy tuning, trading bots.
- Bots taking over slots of humans who leave mid-game (those still auto-skip as today).
- Bot vs bot-only games without any human (allowed implicitly but not a target).
