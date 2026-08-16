# Trade Feature Config Toggle Design

Date: 2026-08-16

## Problem

The trade feature (propose/accept/reject/cancel negotiation, inbox UI, bot
valuation) is always on. There is no way for a server operator to turn trades
off for every room on their server. The only server configuration today is the
`PORT` and `DIST_DIR` env vars; there is no feature-flag mechanism.

## Goals

- A server operator can disable the entire trade feature with one env var.
- Default is **disabled**: trades are off unless the operator opts in.
- Disabling is authoritative, not cosmetic — the shared `gameReducer` (the
  single source of truth for rules) refuses trade actions, and the server
  rejects them with feedback.
- When disabled, the client hides all trade entry points (popup Trade button
  and the Trades inbox button) derived from the broadcast state snapshot.

## Non-Goals

- No per-room or per-game toggle — the config is global to a server process.
- No generic feature-flags abstraction — this is a one-off env var for trades.
  Future optional features get their own env var when they need one (YAGNI).
- No i18n changes — disabling just hides existing UI; no new UI strings.
- No changes to trade rules, the trade wire contract, or the bot valuation.

## Design

### 1. Env var → server plumbing

- `server/main.ts` reads the flag and passes it down:

  ```ts
  const tradesEnabled = process.env.TRADES_ENABLED === 'true'
  const { httpServer } = createServer(distDir, { tradesEnabled })
  ```

  Anything other than the literal `'true'` (unset, `'false'`, `'0'`, …) means
  trades are disabled.

- `server/http.ts`: `createServer(distDir = 'dist', opts?: { tradesEnabled?: boolean })`
  forwards it into `new RoomManager({ send }, { tradesEnabled: opts?.tradesEnabled ?? false })`.

- `server/roomManager.ts`: the constructor `opts` gains `tradesEnabled?: boolean`
  (stored on the instance, default `false`); `create()` forwards it into
  `new GameServer(events, { code, rng, tradesEnabled })`.

- `server/gameServer.ts`: the constructor `opts` gains `tradesEnabled?: boolean`;
  the initial state is seeded from it:

  ```ts
  this.state = createInitialState({ tradesEnabled: opts?.tradesEnabled ?? false })
  ```

### 2. Game state (`src/types/game.ts`)

`GameState` gains:

```ts
tradesEnabled: boolean   // global feature flag, fixed for the life of a room
```

The field rides along in every broadcast state snapshot, so clients get it for
free — no new message type. It is set once at server startup/room creation and
never changes mid-game. No `STATE_VERSION` bump: the `useGame` localStorage
hook that used it was deleted; the app is multiplayer-only.

### 3. Reducer rules (`src/logic/gameReducer.ts`)

- `createInitialState({ tradesEnabled = false }: { tradesEnabled?: boolean } = {})`
  includes the field (defaults to disabled, matching the env default).

- Each of the four trade cases — `PROPOSE_TRADE`, `ACCEPT_TRADE`,
  `REJECT_TRADE`, `CANCEL_TRADE` — starts with:

  ```ts
  if (!state.tradesEnabled) return state
  ```

  The reducer is the single source of truth: no trade action can mutate state
  when disabled, regardless of how it is dispatched.

### 4. Server gate (`server/gameServer.ts`)

At the top of `handleAction`, before the existing turn/trade gates:

```ts
if (
  !this.state.tradesEnabled &&
  (action.type === GameActionType.ProposeTrade ||
    action.type === GameActionType.AcceptTrade ||
    action.type === GameActionType.RejectTrade ||
    action.type === GameActionType.CancelTrade)
) {
  this.events.send(clientId, { type: ServerMessageType.Error, message: 'Fitur pertukaran tidak tersedia' })
  return
}
```

This gives a client that still sends a trade action (e.g. a stale or crafted
client) immediate feedback instead of a silent no-op. The message follows the
existing hardcoded-Indonesian server-error convention (same as
`'Bukan giliranmu'`).

### 5. Client UI gating

- `src/components/GameView.tsx`: `const tradesEnabled = state.tradesEnabled`;
  `canTrade = tradesEnabled && isMyTurn && state.phase === GamePhase.Waiting && !state.pendingAction`;
  thread `tradesEnabled` to `Sidebar`.
- `src/components/Sidebar.tsx`: new `tradesEnabled?: boolean` prop (default
  `true` so existing tests keep compiling); hide the Trades badge button when
  `false`; forward `tradesEnabled` to `PlayerPanel`.
- `src/components/PlayerPanel.tsx`: forward `tradesEnabled` to `PlayerCard`.
- `src/components/PlayerCard.tsx` (and `PlayerPopup`): render the Trade button
  only when `player.id !== currentPlayerId && tradesEnabled`. When disabled the
  button is hidden entirely — not shown greyed out.

With trades disabled the reducer keeps `pendingTrades` empty forever, so the
inbox badge count stays `0`; hiding the button is belt-and-suspenders.

## Testing

- `src/logic/__tests__/gameReducer.test.ts`: the `trade negotiation` describe
  block builds its state via `createInitialState({ tradesEnabled: true })`.
  New tests assert that on the default (disabled) state, `PROPOSE_TRADE` adds no
  `pendingTrades` and no log entry, and `ACCEPT_TRADE` / `REJECT_TRADE` /
  `CANCEL_TRADE` are no-ops even for a synthetic inbox.
- `server/__tests__/gameServer.test.ts`: the `setup()` helper used by the
  existing trade tests constructs its server with `{ tradesEnabled: true }`.
  New test: with trades disabled, `handleAction` on a trade action sends the
  error and the inbox stays empty.
- `src/components/__tests__/Sidebar.test.tsx` and
  `src/components/__tests__/PlayerCard.test.tsx`: new tests assert the Trades
  button / popup Trade button is hidden when `tradesEnabled` is `false`.
- `server/__tests__/roomManager.test.ts` / `http.test.ts`: propagation test that
  a room created under `RoomManager({ tradesEnabled })` yields
  `game.getState().tradesEnabled` equal to the configured value.

## Documentation

- `AGENTS.md`: document `TRADES_ENABLED` under Commands/Configuration —
  default disabled; run `TRADES_ENABLED=true npm run server` to enable trades.
- Note for future work: any e2e that exercises trades must spawn the server
  with `TRADES_ENABLED=true`.

## Verification

- `npm run typecheck`, `npm run test:unit`, and `npm run lint` all pass.
