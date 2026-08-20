# Design — Room lifecycle (no humans), AFK takeover, board naming fix

**Date**: 2026-08-20
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared reducer/cards logic)

## Problems

1. **Rooms never stop when all humans leave.** `RoomManager.removeClient` only deletes a room
   when the last member's WebSocket closes AND every slot has no name (`!p.connected && !p.name`).
   Mid-game, `leave()`/`disconnect()` keep the human's `name` so they can reconnect — so a room
   whose last human left or went offline keeps its bots playing forever.
2. **Board naming swap (English only).** `board.space.27` = "Water Company" but space 27 is a
   property; `board.space.28` = "Toulouse" but space 28 is the utility. Indonesian is correct.
3. **No AFK handling.** A **connected** human whose turn it is can stall the game forever —
   nothing ever takes over their seat (the existing bot takeover only triggers on disconnect).

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Room teardown | `RoomManager` schedules room deletion when the last connected human leaves/disconnects. Immediate delete if no named human seat remains (lobby explicit leave); otherwise a grace window (`ROOM_EMPTY_GRACE_MS`, default 30_000ms, env `ROOM_EMPTY_GRACE_MS`) before deletion. Reconnect within the window cancels it. Deletion stops the `GameServer` timers. |
| 2 | Board naming | Swap `board.space.27` / `board.space.28` labels in `src/i18n/locales/en/translation.json`. No data/geometry change. |
| 3 | AFK | `GameServer` runs an inactivity timer (`AFK_TIMEOUT_MS`, default 30_000ms, env `AFK_TIMEOUT_MS`) while a connected human is deciding. On expiry it dispatches `SetBotControl { playerId, controlled: true, reason: 'afk' }` → `event.playerAfk` log; the bot plays the turn at normal bot speed. A connected AFK-marked player who sends any turn action clears bot control (`event.playerBack`) and their action processes. |
| 4 | UI | Reuse the existing `🤖 BOT` card badge and `turn.botControl` status; no new `GameState` field (see assumptions). |

## Change details

### 1 — Room teardown (`server/roomManager.ts`, `server/gameServer.ts`, `server/http.ts`, `server/main.ts`)

- `RoomManager` gains:
  - `opts.roomEmptyGraceMs` (default 30_000).
  - `private teardownTimers = new Map<string, ReturnType<typeof setTimeout>>()`.
  - `removeClient` → after the last member leaves, call `evaluateTeardown(code, game)`.
  - `evaluateTeardown(code, game)`:
    - `players = game.getPlayers()`
    - `hasNamedHuman = players.some(p => !p.isBot && p.name !== null)`
    - `hasConnectedHuman = players.some(p => !p.isBot && p.connected)`
    - clear any pending timer; if `!hasNamedHuman` → `deleteRoom(code)` immediately; else if
      `!hasConnectedHuman` → schedule `deleteRoom(code)` after `roomEmptyGraceMs`.
  - `addClient` → cancel any pending teardown timer (a rejoin keeps the room alive).
  - `deleteRoom(code)` → clear the timer, call `game.stop()`, drop `rooms`/`roomClients` and any
    dangling `clientRoom` entries.
- `GameServer` gains `stop()` → clears the bot timer **and** the AFK timer.
- `createServer`/`main.ts` thread `roomEmptyGraceMs` and `afkTimeoutMs` from env (integer ms).
- e2e helper `startServer(port, env?)` accepts extra env to run specs with short timeouts.

### 2 — Board naming (`src/i18n/locales/en/translation.json`)

Swap the values at `board.space.27` ("Water Company" → "Toulouse") and `board.space.28`
("Toulouse" → "Water Company").

### 3 — AFK takeover (`server/gameServer.ts`, `src/types/game.ts`, `src/logic/gameReducer.ts`, i18n)

- `src/types/game.ts`:
  - `GameAction.SetBotControl` gains optional `reason?: 'offline' | 'afk'`.
  - `LogEventKey.PlayerAfk = 'event.playerAfk'`.
- `gameReducer.ts` `SetBotControl` case: when `controlled === true`, log
  `event.playerAfk` if `action.reason === 'afk'`, else `event.playerOffline`.
- `gameServer.ts`:
  - `private afkTimer` + `opts.afkTimeoutMs` (default 30_000).
  - `driveBots()` rework:
    - Setup/GameOver or missing slot → clear both timers.
    - Current player is a **connected non-bot human not bot-controlled** → clear bot timer, reset
      `botSteps`, (re)schedule the AFK timer.
    - Otherwise clear the AFK timer and drive as today, with `isDriveable = slot.isBot ||
      botControlled` (bot drives AFK-marked connected humans too). The timer callback's
      `stillDriveable` re-check drops the `!current.connected` clause for the same reason.
  - `scheduleAfkTimer(playerId)`: clears any pending AFK timer and schedules a new one; on fire it
    re-verifies phase/current player/connected/not-already-bot-controlled, then dispatches
    `SetBotControl(playerId, true, 'afk')`.
  - `clearAfkIfHuman(clientId)`: if the acting client's slot is connected and their player is
    `botControlled`, dispatch `SetBotControl(playerId, false)` first (playerBack). Called in
    `roll()` before `startRoll` and in `handleAction`'s final dispatch path.
  - `stop()` clears both timers.
- i18n: `event.playerAfk` added to `en` and `id` translation.json.

### 4 — Test hooks (`src/components/BoardGrid.tsx`)

Add `data-testid={'board-cell-' + space.id}` to each board cell so the naming fix is assertable.

## Testing

- **Reducer** (`src/logic/__tests__/gameReducer.test.ts`): `SetBotControl` with `reason: 'afk'`
  logs `event.playerAfk`; existing offline behavior unchanged.
- **Server** (`server/__tests__/gameServer.test.ts`, fake timers + injected rng):
  - A connected human who does nothing for `AFK_TIMEOUT_MS` becomes `botControlled`, the
    `event.playerAfk` log fires, and the bot rolls/ends their turn at normal bot speed.
  - A connected AFK-marked human who rolls takes control back (`playerBack`, `botControlled`
    false) and their roll resolves.
- **RoomManager** (`server/__tests__/roomManager.test.ts`, fake timers, `roomEmptyGraceMs`):
  - last human disconnect mid-game → room deleted after the grace.
  - rejoin within the grace → room kept.
  - lobby explicit leave (name cleared) → immediate delete (existing test).
- **E2E**:
  - `e2e/board-naming.spec.ts` (shared server): seed a waiting game, assert
    `board-cell-27` shows "Toulouse" and `board-cell-28` shows "Water Company".
  - `e2e/room-lifecycle.spec.ts` (dedicated server, short timeouts):
    - AFK: host's player card shows `BOT` within ~10s and the host's roll button never appears
      (bot plays their turn).
    - Leave: two humans leave mid-game → room removed after grace (`GET /rooms` no longer lists it).
    - Offline: both humans disconnect → room removed after grace.
    - Reconnect: last human refreshes within grace → room survives and the game continues.
- **Verification**: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`,
  `npm run test:e2e`.

## Out of scope

- A distinct "AFK" label in `TurnHeader`/`PlayerCard` beyond the `🤖 BOT` badge and
  `event.playerAfk` log (would need a new `Player`/`GameState` field).
- Changing `turn.botControl` wording (existing offline feature + component test).
- Lobby UX for "room was removed" beyond the existing "Room not found" error.
