# Monopoly — Offline Players Controlled by a Bot

**Date**: 2026-08-17
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared reducer/cards logic)

## Problem

When a human player disconnects mid-game, the server's `skipLeftPlayers`
(`server/gameServer.ts:326`) **auto-plays their turn** — it instantly ends the
turn, auto-declines property buys, auto-pays rent, auto-declares bankruptcy,
and auto-draws cards. The event log shows `Turn: hp` followed immediately by
`Turn: Hidayat`; the offline player loses every decision they were owed. The
round keeps moving, but the absent player's seat is effectively dead weight:
turns vanish, and no one knows a bot isn't deciding for them.

## Goal

When a human player goes offline mid-game, an AI bot takes over their seat so
the game keeps flowing, and it is unmistakable that the bot is the one deciding:

- The offline player's turns are played by the bot AI (`decideBotAction`), at
  normal bot speed.
- A short grace period (30s) before the bot's first move gives a brief
  disconnect/refresh — which auto-rejoins in ~1-2s — a chance to recover before
  the bot acts.
- Every bot-played action is labeled in the event log, e.g.
  `hp (bot) rolled 4+3=7`.
- The player card shows a bot indicator; the turn header says the bot is
  playing. Clear log notices fire on offline and on return.
- When the human reconnects (rejoin by name already works), they take back
  control immediately — mid-turn if the bot is still playing it.

Bots already on bot seats (`isBot: true`) keep their exact current behavior.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | State representation | Add `Player.botControlled: boolean` to shared `GameState`; the server flips it via a new reducer action `SetBotControl { playerId, controlled }` |
| 2 | Bot AI gate | `decideBotAction` accepts a current player who is `isBot` **or** `botControlled` |
| 3 | Turn driving | `driveBots` also drives offline-human seats; first move after a 30s grace (`BOT_GRACE_MS`), then normal 700ms steps; `skipLeftPlayers` is removed |
| 4 | Disconnect / reconnect | `disconnect()` dispatches `SetBotControl(..., true)` mid-game; rejoin dispatches `SetBotControl(..., false)`; pending grace timer no-ops on reconnect |
| 5 | Verbose labeling | Reducer log entries attributed to a bot-controlled player carry `params.bot: true`; `resolveLogEntry` renders the name through `log.botName` (`{{name}} (bot)`); takeover/return notices are separate log keys |
| 6 | Trades | Reducer auto-responses to trade offers target `isBot` **or** `botControlled` players (via `shouldAcceptTrade`) |
| 7 | UI | `PlayerCard` shows 🤖 BOT when `player.botControlled`; `TurnHeader` status becomes `turn.botControl` for the bot-controlled current player |

## Change details

### 1 — `Player.botControlled` + `SetBotControl` action

- Add `botControlled: boolean` to `Player` (`src/types/game.ts`), init `false`
  in `StartGame` (`gameReducer.ts` player construction).
- New `GameActionType.SetBotControl`:
  - `{ type: SetBotControl, playerId: number, controlled: true }` → set the
    flag on `players[playerId]`, append `event.playerOffline` log. Idempotent:
    no-op if the player is already bot-controlled.
  - `{ type: SetBotControl, playerId, controlled: false }` → clear the flag,
    append `event.playerBack` log. Idempotent: no-op if already not
    bot-controlled (so a reconnect during Setup logs nothing; the flag is never
    set there anyway).
- `Player` shape changed ⇒ bump `STATE_VERSION` in `src/hooks/useGame.ts`
  (9 → 10).

### 2 — `decideBotAction` gate

`src/logic/bot.ts:9`:

```ts
if ((!player.isBot && !player.botControlled) || state.phase === GamePhase.GameOver) return null
```

No decision logic changes — the same AI that plays bot seats now plays offline
humans (roll, jail escape, buy/decline, pay rent, liquidation, cards, build).

### 3 — Server turn driving

`src/server/gameServer.ts`:

- `driveBots()`: a seat is bot-driven when `slot.isBot` **or** (mid-game and
  `slot.connected === false` and `state.players[currentPlayer].botControlled`).
  Delay: real bot seat → 700ms; offline human → `BOT_GRACE_MS` (30s) for the
  first action, then 700ms steps. Track `drivenPlayerId` so the grace applies
  once per takeover; reset it whenever the current player is connected or not
  bot-controlled. Each scheduled step re-checks the slot's `connected` and the
  player's `botControlled` before acting — a reconnect mid-turn makes the
  pending timer no-op and the human takes over from the current state. Keep the
  100-step safety cap.
- `skipLeftPlayers()`: removed. Auto-playing an offline human's turn is the
  bot's job now. Callers in `disconnect()`, `dispatch()`, and `applyAction()`
  are deleted. (Real bot seats were never touched by it — their `connected`
  stays `true`.)

### 4 — Disconnect / reconnect dispatch

- `disconnect(clientId)` (after marking the slot offline):
  ```ts
  if (this.state.phase !== GamePhase.Setup) {
    this.dispatch({ type: GameActionType.SetBotControl, playerId: index, controlled: true })
  }
  ```
  The dispatch flows through `applyAction` → `driveBots`, which picks up the
  now-offline current player.
- `join()` reconnect branch (the same-name seat rejoin) restores the slot and:
  ```ts
  if (this.state.phase !== GamePhase.Setup) {
    this.dispatch({ type: GameActionType.SetBotControl, playerId: slotIndex, controlled: false })
  }
  ```
  Pending grace timers for that player are canceled; a fired-but-stale timer
  re-checks `connected` and no-ops.

### 5 — Verbose `(bot)` labeling

Structure change only in intent — the reducer stores a flag, rendering stays in
`resolveLogEntry`:

- Every reducer log entry attributed to the acting (current) player gains a
  `bot` param when that player is bot-controlled — a mechanical sweep of the
  log call sites in `gameReducer.ts` (roll, aim roll, pass-go, jail break/fail/
  forced out, triple doubles, to-jail, taxes, bought, paid rent, cards, build,
  sell, mortgage, trade, turn transitions, bankruptcy):
  ```ts
  { key: 'event.rolled', params: { name: player.name, bot: player.botControlled, d1, d2, total } }
  ```
- `resolveLogEntry` (`src/i18n/log.ts:10`): if `entry.params.bot`, rewrite
  `params.name` = `t('log.botName', { name })` so i18next renders
  `hp (bot) rolled 4+3=7`. Entries with multiple names (`owner`/`name`) label
  the actor only — the `name` param.
- Takeover/return are their own keys (`event.playerOffline`, `event.playerBack`)
  so they read naturally without a suffix.

### 6 — Trades

The reducer auto-responds to trade offers targeting bot seats (3 call sites
using `shouldAcceptTrade`, `gameReducer.ts`). Extend each guard from
`player.isBot` to `player.isBot || player.botControlled`, so an offline human's
seat answers trade offers like a bot. Offline players still can't initiate or
accept trades on their own — only the bot response changes.

### 7 — UI

- `src/components/PlayerCard.tsx`: when `player.botControlled`, render next to
  the existing `OFFLINE` label:
  ```tsx
  {player.botControlled && <span className="text-xs font-bold text-gold">🤖 {t('card.botControl')}</span>}
  ```
  The `OFFLINE` dim/label already applies via `connected` prop from `lobby`
  (existing connection-indicator work) — unchanged.
- `src/components/TurnHeader.tsx`: when the current player is
  `player.botControlled`, the status line (normally "Roll the dice" etc.)
  becomes `turn.botControl`; the player name stays.
- No countdown during the 30s grace — the takeover notice fired at disconnect
  and the card/header indicators cover the window.

## Files summary

| File | Change |
|------|--------|
| `src/types/game.ts` | `Player.botControlled: boolean`; `GameActionType.SetBotControl`; `GameAction` union entry |
| `src/logic/gameReducer.ts` | player init `botControlled: false`; `SetBotControl` case (flag + offline/back logs, idempotent); `bot: player.botControlled` on actor log entries; trade auto-response guards `isBot \|\| botControlled` |
| `src/logic/bot.ts` | `decideBotAction` gate accepts `botControlled` |
| `src/i18n/log.ts` | `params.bot` → render name through `log.botName` |
| `src/server/gameServer.ts` | dispatch `SetBotControl` on disconnect/rejoin; `driveBots` drives offline humans with 30s grace; remove `skipLeftPlayers` |
| `src/hooks/useGame.ts` | bump `STATE_VERSION` to 10 |
| `src/components/PlayerCard.tsx` | 🤖 BOT badge when `player.botControlled` |
| `src/components/TurnHeader.tsx` | `turn.botControl` status for bot-controlled current player |
| `src/i18n/locales/{en,id}/translation.json` | `log.botName`, `event.playerOffline`, `event.playerBack`, `card.botControl`, `turn.botControl` |

## Testing

- Reducer: `SetBotControl` sets/clears the flag and appends the offline/back
  entries (idempotent both ways); `StartGame` initializes `botControlled:
  false`; actor entries for a bot-controlled player carry `bot: true`.
- Bot (`src/logic/__tests__/bot.test.ts`): `decideBotAction` returns actions for
  a `botControlled` non-bot player (roll, buy/decline, rent, jail).
- Server (`src/server/__tests__/gameServer.test.ts`, injected `rng` + fake
  timers): disconnect mid-game marks the player bot-controlled and the bot
  plays their turn after the 30s grace; reconnect within grace cancels the bot
  and the human decides; reconnect after the bot acted continues from that
  state; an offline player's turn is never auto-skipped.
- Trade (`gameReducer`): a trade offered to a `botControlled` player is
  auto-answered via `shouldAcceptTrade`.
- Components: `PlayerCard` shows the 🤖 BOT label when `player.botControlled`;
  `TurnHeader` shows `turn.botControl`.
- i18n: both new `event.*` keys resolve in `en` and `id`.
- Verification: `npm run typecheck`, `npm run test:unit`, `npm run lint`.
  Manual e2e — two browser contexts; one player closes the tab mid-game; confirm
  their turn is played by the bot with `(bot)` log labels after ~30s; rejoin and
  take over.

## Out of scope

- Host transfer / kicking while a player is offline.
- A visible countdown of the 30s grace window.
- Labeling real bot seats (`isBot`) with the `(bot)` suffix — their names
  already read as bots; behavior unchanged.
- Changing bot seat add/remove rules during a game.