# Monopoly — Offline Bot Reconnect-Grace Feedback

**Date**: 2026-08-17
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared reducer/cards logic)

## Problem

Follow-up to `2026-08-17-offline-bot-control-design.md`. When a human player goes
offline mid-game, the bot takes over their seat — but the first move is delayed by
`BOT_GRACE_MS = 30_000` (30s) to give a refresh/rejoin a chance to recover control.

Two defects:

1. **No feedback during the wait.** The 30s grace produces no log entry and no
   countdown. The turn header shows `{{name}} — offline, a bot is playing`, which
   is misleading (the bot is not playing yet — it is waiting). The other human
   player just stares at a frozen turn for 30s with no idea what is happening.
2. **The wait is too long.** 30s is far more than the ~1-2s a refresh actually
   takes, and with no feedback it feels like a hang.

## Goal

The reconnect grace becomes short and legible:

- The grace is **3s** (down from 30s).
- It applies **only on the first turn after the disconnect** — not on every
  subsequent turn of the offline player.
- While waiting, the event log gets a notice and the turn header shows a **live
  countdown** (`Waiting for hp to reconnect… 3s`), so the other players know
  exactly what is happening and for how long.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Grace duration | `BOT_GRACE_MS`: `30_000` → `3_000` |
| 2 | Once-per-disconnect | Replace the `drivenPlayerId`/`isFresh` mechanism with a per-slot `gracePending` flag, reset only by disconnect/reconnect, so the grace fires once per disconnect |
| 3 | Wire state | Add `GameState.reconnectGrace: { playerId; until } \| null`; `until` is a server epoch-ms deadline |
| 4 | New action | `GameActionType.SetReconnectGrace { playerId, until }` — set (with log) when `until` given, clear (no log) when `until: null` |
| 5 | Server flow | On grace consumption, schedule the 3s timer then broadcast the grace; on timer fire, act then clear the grace |
| 6 | Client feedback | `TurnHeader` shows a live countdown during the grace window; event log gets `event.reconnectWait` via the reducer |
| 7 | i18n | New `event.reconnectWait` and `turn.reconnectWait` keys in `en` and `id` |

## Change details

### 1 — Grace duration

`server/gameServer.ts`: `const BOT_GRACE_MS = 3_000`.

### 2 — Once-per-disconnect tracking

The existing `drivenPlayerId` is reset in `driveBots()` whenever the current
player is not driveable — i.e. on every connected human's turn — so the grace
re-applies at the start of *every* offline player's turn, not just the first.
Replace it with a per-slot flag so multiple offline players are tracked
independently and the grace survives between turns:

- `Slot` (`server/gameServer.ts`) gains `gracePending: boolean` (init `false`).
- Set `gracePending = true` when a seat goes offline mid-game:
  - `disconnect(clientId)`, and
  - `leave(clientId)` in the mid-game branch (the `else` that marks the slot
    offline and dispatches `SetBotControl(true)`).
- Set `gracePending = false` on:
  - `join()` reconnect branch (seat restored),
  - `driveBots()` when the grace is consumed (the flag is cleared as soon as the
    first grace timer is scheduled).
- `driveBots()` uses `slot.gracePending` instead of `drivenPlayerId`:
  ```ts
  const isRealBot = slot.isBot
  const isGraceTurn = !isRealBot && slot.gracePending
  if (isGraceTurn) slot.gracePending = false
  const delay = isGraceTurn ? BOT_GRACE_MS : BOT_STEP_MS
  ```
  `drivenPlayerId` is removed entirely (declaration + the two resets in the
  `!slot` / `!isDriveable` branches + the `isFresh` read/set).
- All `Slot` object-literal construction sites gain `gracePending: false`
  (constructor array initializer, `join()` new-slot branch, `addBot()`,
  `removeBot()`, `leave()` setup branch and its bot-clear loop).

Real bot seats (`isBot: true`) are unaffected — `isRealBot` forces `BOT_STEP_MS`
and `gracePending` is never consulted for them.

### 3 — Grace state on the wire

`src/types/game.ts`:

```ts
export type ReconnectGrace = { playerId: number; until: number };
```

`GameState` gains `reconnectGrace: ReconnectGrace | null`. `until` is computed by
the **server** (never by the reducer) as `Date.now() + BOT_GRACE_MS`; the client
computes remaining seconds against its own clock.

### 4 — `SetReconnectGrace` action

`src/types/game.ts`:

- `GameActionType` gains `SetReconnectGrace: 'SET_RECONNECT_GRACE'` (new wire
  value — never change it).
- `GameAction` union gains
  `{ type: typeof GameActionType.SetReconnectGrace; playerId: number; until: number | null }`.

`src/logic/gameReducer.ts`:

- `createInitialState` adds `reconnectGrace: null`.
- New case (idempotent like `SetBotControl`):
  ```ts
  case GameActionType.SetReconnectGrace: {
    if (action.until == null) {
      if (!state.reconnectGrace) return state;
      return { ...state, reconnectGrace: null };
    }
    if (state.reconnectGrace?.playerId === action.playerId) return state;
    const player = state.players[action.playerId];
    return {
      ...state,
      reconnectGrace: { playerId: action.playerId, until: action.until },
      eventLog: player
        ? [...state.eventLog, { key: 'event.reconnectWait', params: { name: player.name } }]
        : state.eventLog,
    };
  }
  ```
- `SetBotControl` case: on reconnect (`controlled: false`) clear any grace for
  that player:
  ```ts
  reconnectGrace: action.controlled
    ? state.reconnectGrace
    : state.reconnectGrace?.playerId === action.playerId
      ? null
      : state.reconnectGrace,
  ```

### 5 — Server flow (`driveBots`)

`server/gameServer.ts`:

- Schedule the grace timer first, then broadcast the grace state so the countdown
  and log reach clients (the trailing `dispatch` re-enters `driveBots`, but the
  `botTimer !== null` guard makes it a no-op):
  ```ts
  this.botTimer = setTimeout(() => { /* ... */ }, delay);
  if (isGraceTurn) {
    this.dispatch({ type: GameActionType.SetReconnectGrace, playerId: currentPlayer, until: Date.now() + BOT_GRACE_MS });
  }
  ```
- Timer callback: run the bot action first, then clear the grace. Clearing after
  acting avoids a re-entrant `driveBots` double-step (the action advances the
  phase, so the clear's `driveBots` re-run is a no-op or schedules the *next*
  700ms step correctly). Add a small helper:
  ```ts
  private clearReconnectGrace(playerId: number): void {
    if (this.state.reconnectGrace?.playerId === playerId) {
      this.dispatch({ type: GameActionType.SetReconnectGrace, playerId, until: null });
    }
  }
  ```
  Called after `startRoll()` / `dispatch(actionNow)`, and also when
  `decideBotAction` returns `null` (to drop a stale grace).
- `handleAction`: ignore a client-sent `SetReconnectGrace` the same way
  `SetBotControl` is ignored (add it next to the existing guard).

### 6 — Client feedback

`src/components/TurnHeader.tsx`:

- Convert `statusText` into component state (the current player's grace may be
  active with no new server snapshot arriving during the 3s wait, so the countdown
  must tick locally). Track `now` with a ~250ms `setInterval` that runs only while
  `state.reconnectGrace` is non-null.
- When `state.reconnectGrace?.playerId === currentPlayer.id`, render
  `turn.reconnectWait` (`Waiting for {{name}} to reconnect… {{seconds}}s`) with
  `seconds = Math.max(0, Math.ceil((until - now) / 1000))`. This branch takes
  precedence over the existing `turn.botControl` text.
- The event-log notice needs no client work — it rides `event.reconnectWait` from
  the reducer.

### 7 — i18n

`src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys):

- `event.reconnectWait`: `Waiting for {{name}} to reconnect…` / `Menunggu {{name}} untuk terhubung kembali…`
- `turn.reconnectWait`: `Waiting for {{name}} to reconnect… {{seconds}}s` / `Menunggu {{name}} untuk terhubung kembali… {{seconds}}s`

## Files summary

| File | Change |
|------|--------|
| `src/types/game.ts` | `ReconnectGrace` type; `GameState.reconnectGrace`; `GameActionType.SetReconnectGrace`; `GameAction` union entry |
| `src/logic/gameReducer.ts` | `createInitialState` `reconnectGrace: null`; `SetReconnectGrace` case; `SetBotControl` clears grace on reconnect |
| `server/gameServer.ts` | `BOT_GRACE_MS = 3_000`; `Slot.gracePending`; drop `drivenPlayerId`; `driveBots` grace scheduling + clear-after-act; `clearReconnectGrace` helper; `handleAction` guard |
| `src/components/TurnHeader.tsx` | live-countdown status for `reconnectGrace` |
| `src/i18n/locales/{en,id}/translation.json` | `event.reconnectWait`, `turn.reconnectWait` |

## Testing

- Reducer (`src/logic/__tests__/gameReducer.test.ts`): `SetReconnectGrace` sets
  the field + appends `event.reconnectWait` when `until` given; clears without a
  log when `until: null`; idempotent; `SetBotControl(false)` clears a matching
  grace; `createInitialState` initializes `reconnectGrace: null`.
- Server (`server/__tests__/gameServer.test.ts`, injected `rng` + fake timers):
  update the three existing 30s-grace tests to 3s; add — grace state is
  broadcast on the offline player's turn (assert `reconnectGrace` set, then
  cleared after the bot acts); grace applies **once** per disconnect (a second
  consecutive turn of the same offline player steps at 700ms with no new grace);
  a client-sent `SetReconnectGrace` is ignored.
- Component (`src/components/__tests__/TurnHeader.test.tsx`): with
  `reconnectGrace` set for the current player, the countdown text renders.
- Test helpers: existing `makeState`/`makeStartedState` literals gain
  `reconnectGrace: null`.
- Verification: `npm run typecheck`, `npm run test:unit`, `npm run lint`.
  Manual e2e — one player closes their tab mid-game; confirm the other player
  sees the log notice + ~3s countdown, then the bot acts with `(bot)` labels.

## Out of scope

- Host transfer / kicking while a player is offline.
- Persisting grace state across a server restart (state is in-memory).
- Labeling real bot seats (`isBot`) with the `(bot)` suffix.
