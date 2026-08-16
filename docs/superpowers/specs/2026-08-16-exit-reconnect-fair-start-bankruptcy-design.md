# Monopoly — Exit, Reconnect, Fair Start, Jail Cards & Bankruptcy

**Date**: 2026-08-16
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared reducer/cards logic)

## Goal

Address seven play-tested issues across the shared game logic, hooks, and UI:

1. Single-player game has no way to exit and start a fresh game.
2. Refreshing the page in multiplayer loses the room; the player should rejoin the previous match automatically.
3. Get Out of Jail Free cards are a boolean, so holding two cards and using one consumes both.
4. The starting/turn order is fixed by join order, so the last player to join is always last.
5. After a player goes bankrupt, the next player inherits the dead player's dice state and can build houses immediately.
6. After a bankruptcy, the next player can only "end turn" instead of rolling fresh.
9. When a player goes bankrupt to another player, their entire net worth should go to that player (in cash), not vanish to the bank.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Single-player exit | Pass `onLeave={local.resetGame}` into local `GameView`; reuse `RoomExit` with single-player copy overrides |
| 2 | Multiplayer reconnect | Persist `{ name, code }` session in localStorage; auto-rejoin on refresh; clear on leave/Left/room-gone |
| 3 | Jail cards | Replace `hasGetOutOfJailFree: boolean` with `getOutOfJailFreeCards: number` |
| 4 | Fair start | Add `turnOrder: number[]` to `GameState`; shuffle at start; `currentPlayer = turnOrder[0]`; render the player list in `turnOrder` order |
| 5+6 | Bankruptcy turn flow | `DeclareBankruptcy` resets `dice`/`doublesCount`/`lastMoveSteps` and advances via `getNextPlayer` (turn-order aware), plus logs `event.turn` |
| 9 | Bankruptcy assets | Liquidate the bankrupt player's assets to cash (existing rates) and pay the creditor (the landlord); else assets go to the bank |

## Change details

### 1 — Single-player exit

**Root cause:** `App.tsx:59` renders `<GameView game={local} />` without `onLeave`, and `Sidebar` only renders `RoomExit` when `onLeave` is provided. `useGame.resetGame` already clears the saved state and reloads to the setup screen.

**Fix:**
- `App.tsx`: `<GameView game={local} onLeave={local.resetGame} exitKeys={{ labelKey: 'exit.label', titleKey: 'exit.title', messageKey: 'exit.message', confirmKey: 'exit.confirm' }} />`.
- `GameView` and `Sidebar` forward an optional `exitKeys` prop to `RoomExit`.
- `RoomExit` gains optional i18n-key overrides `labelKey`, `titleKey`, `messageKey`, `confirmKey`, defaulting to the current lobby copy. Multiplayer usage passes no `exitKeys`, so its copy is unchanged.
- New i18n keys (both `en` and `id`):
  - `exit.label` = "Exit Game" / "Keluar Permainan"
  - `exit.title` = "Exit Game" / "Keluar Permainan"
  - `exit.message` = "Leave the current game? Progress will be lost and a new game will start." / "Keluar dari permainan saat ini? Progres akan hilang dan permainan baru akan dimulai."
  - `exit.confirm` = "Exit" / "Keluar"

Net effect: single-player sidebar shows the 🚪 button; confirming exits to setup with a fresh game. Multiplayer copy is unchanged.

### 2 — Auto-rejoin multiplayer

**Root cause:** the server already reconnects a disconnected slot by the same name (`GameServer.join`, `server/gameServer.ts:68`), even mid-game. The client stores nothing, so a refresh loses the room code and name held only in React state (`joinInfo`).

**Fix:**
- New module `src/net/session.ts`:
  - `saveSession({ name, code })`, `loadSession()`, `clearSession()`.
  - localStorage key `monopoly-mp-session`, value `{ name, code, savedAt }`.
- `MultiplayerGame`: an effect watches `game.code` + `name`; when both are present (a `Welcome` arrived), `saveSession({ name, code: game.code })`.
- `App.tsx`: on mount, if a session exists, `setMode(Multiplayer)` and `setJoinInfo({ name, code })`; `MultiplayerGame`'s existing `join(code, name)` effect auto-rejoins. The server returns the full state snapshot, restoring the board. On `onLeft` (fires for the server's `Left` message and after explicit `leave()`), `clearSession()` then `setMode(null)`.
- Stale-session fallback: if the room is gone, `Join` returns the server error "Ruangan tidak ditemukan"; the player sees it in the Lobby and can use the existing leave button to return to setup (which clears the session). No fragile message matching.

Notes:
- Rejoin works during Setup and mid-game because `disconnect` keeps the slot name (`server/gameServer.ts:263`).
- While away, the disconnected player's turns are auto-skipped by `skipLeftPlayers` until rejoin — unchanged.

### 3 — Get Out of Jail Free cards as a count

**Root cause:** `Player.hasGetOutOfJailFree` is a `boolean` (`src/types/game.ts:100`). Drawing a card sets it `true` (`src/logic/cards.ts:28`); using the card sets it `false` (`gameReducer.ts:646`). Holding two cards (Chance id 7 + Community id 104) and using one removes both.

**Fix:**
- `Player.getOutOfJailFreeCards: number` (init `0`).
- `resolveCardEffect` `GetOutOfJailFree`: increment (`cards.getOutOfJailFreeCards + 1`).
- `gameReducer` `UseGetOutOfJailFree`: guard `> 0`, decrement by 1.
- `bot.ts`: guard `> 0`.
- `ActionSection`: render the use-card button when `> 0`.
- `PlayerCard`: show the 🎴 indicator when `> 0`, with the count in the title when > 1 (parameterize `card.jailFreeTitle` with `{{count}}`).
- Bump `STATE_VERSION` in `src/hooks/useGame.ts` (8 → 9) — `Player` shape changed.

### 4 — Randomized turn order + player list follows it

**Root cause:** `StartGame` sets `currentPlayer: 0` and `getNextPlayer` advances by `(currentPlayer + 1)`, so order is always join order. `PlayerPanel` renders `state.players` in array (join) order.

**Fix:**
- Add `GameState.turnOrder: number[]` — the player IDs in turn order.
- `StartGame`: `turnOrder = shuffle([0..playerCount-1])`, `currentPlayer = turnOrder[0]`. Reuses the existing `shuffle` helper (Math.random, consistent with existing deck-shuffle behavior).
- `getNextPlayer`: find `currentPlayer` in `turnOrder`, return the next id whose player is not bankrupt (wrap around).
- `PlayerPanel`: render `turnOrder.map((id) => players[id])` so the list follows turn order. Colors stay keyed to `player.id` (unchanged per player).
- `StartGame` event log: keep `event.gameStarted`; `currentPlayer`/`event.turn` transitions already log the new player on each advance.
- `state.currentPlayer` remains a player ID, so server turn authorization (`slotIndex === currentPlayer`), board ownership, and trades are unaffected.

### 5 + 6 — Bankruptcy turn flow

**Root cause:** `DeclareBankruptcy` (`gameReducer.ts:694`) never resets `dice`/`doublesCount`/`lastMoveSteps` and sets `currentPlayer` to `activePlayers[0]` (first non-bankrupt in array order). The next player therefore inherits the dead player's dice: the UI treats them as mid-turn — build button available (issue 5, `ActionSection.canBuild` requires `dice !== null`) and rolling blocked (issue 6, `DiceRoller` requires `dice === null`).

**Fix:** in `DeclareBankruptcy`:
- Reset `dice: null`, `doublesCount: 0`, `lastMoveSteps: null`.
- `currentPlayer = getNextPlayer(...)` (from the bankrupt player's position, skipping bankrupt players) instead of `activePlayers[0]`.
- Append `{ key: 'event.turn', params: { name: newPlayer.name } }` to the log.
- Game-over branch unchanged (winner is the sole remaining player).

### 9 — Bankruptcy liquidates to the creditor

**Root cause:** `DeclareBankruptcy` zeroes the bankrupt player's money and returns properties to the bank (`owner: null, houses: 0, mortgaged: false`); the landlord receives nothing.

**Fix:** in `DeclareBankruptcy`:
- Determine the creditor from the pending action: if `state.pendingAction?.type === PendingActionType.Bankruptcy`, then `creditorId = state.board[pending.spaceId]?.owner` (the landlord); otherwise `null` (bank).
- Liquidate the bankrupt player's assets, following existing rates from `src/data/board.ts`:
  - cash: `Math.max(0, player.money)`
  - houses/hotels: `Math.floor(getTotalHouseInvestment(space) * HOUSE_SELL_RATE)` per owned space
  - unmortgaged property: `Math.floor((space.price ?? 0) * SELL_RATE)`
  - mortgaged property: `Math.floor((space.price ?? 0) * MORTGAGED_SELL_EXTRA)`
- Board: every owned space → `owner: null, houses: 0, mortgaged: false`.
- Bankrupt player → `money: 0, properties: [], bankrupt: true, getOutOfJailFreeCards: 0`.
- If a creditor exists, add the liquidation total to their money.
- Log: keep `event.bankruptcy`, add `event.bankruptcyTransfer` (`{{name}}`'s assets were liquidated to `{{creditor}}` for `{{amount}}`).
- Game-over check unchanged (`activePlayers.length <= 1`); the remaining player (the creditor) receives the cash and wins.

## Files summary

| File | Change |
|------|--------|
| `src/types/game.ts` | `Player.getOutOfJailFreeCards: number`; `GameState.turnOrder: number[]` |
| `src/logic/gameReducer.ts` | `StartGame` shuffle + `turnOrder`; `getNextPlayer` turn-order aware; `DeclareBankruptcy` rework (dice reset, next player, liquidation); `UseGetOutOfJailFree` decrement |
| `src/logic/cards.ts` | `GetOutOfJailFree` increments the count |
| `src/logic/bot.ts` | jail-card guard `> 0` |
| `src/net/session.ts` (new) | `saveSession` / `loadSession` / `clearSession` |
| `src/hooks/useNetworkGame.ts` | no change (Welcome already exposes `code`) |
| `src/hooks/useGame.ts` | bump `STATE_VERSION` to 9 |
| `src/App.tsx` | restore session on mount; clear session + `setMode(null)` on `onLeft`; pass `onLeave` + `exitKeys` to local `GameView` |
| `src/components/MultiplayerGame.tsx` | save session when `code` + name are known |
| `src/components/RoomExit.tsx` | optional copy-key overrides |
| `src/components/Sidebar.tsx`, `src/components/GameView.tsx` | forward `exitKeys` |
| `src/components/PlayerPanel.tsx` | render players in `turnOrder` |
| `src/components/PlayerCard.tsx` | jail-card count display |
| `src/components/ActionSection.tsx` | jail-card guard `> 0` |
| `src/i18n/locales/{en,id}/translation.json` | `exit.*`, `event.bankruptcyTransfer`, `card.jailFreeTitle` count param |
| tests | see below |

## Testing

- Reducer: `StartGame` produces a permutation `turnOrder` with `currentPlayer === turnOrder[0]`; `getNextPlayer` advances within `turnOrder` and skips bankrupt players; `DeclareBankruptcy` resets dice, advances to the next non-bankrupt player, and liquidates assets to the creditor (cash + houses + mortgaged/unmortgaged property, game-over winner gets the cash); `UseGetOutOfJailFree` decrements; jail-card init is 0.
- Cards: two draws increment to 2; using one leaves 1.
- `PlayerPanel`: renders in `turnOrder` order.
- `useNetworkGame`/`App`: session save on `Welcome`, restore on mount, clear on `Left`/leave.
- Server: `start()` produces the shuffled `turnOrder` (structure asserted); existing reconnection behavior covered by room tests.
- Component: local `GameView` shows the exit button; `RoomExit` copy override.
- E2E: single-player exit returns to setup with a fresh game; multiplayer refresh mid-game reconnects the same player to the same room.

## Out of scope

- Negative money / bankruptcy caused by card effects (taxes, street repairs) — `PayRent` is the only `Bankruptcy` trigger.
- Replacing `Math.random` in the reducer shuffle with the injected server rng (matches existing deck-shuffle behavior).
- Turn-based reconnect takeover / reconnecting to a room whose name was taken by another human.
