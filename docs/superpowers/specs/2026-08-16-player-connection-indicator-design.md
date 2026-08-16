# Player Connection Indicator Design

Date: 2026-08-16

## Problem

During gameplay the sidebar player list (`PlayerPanel` → `PlayerCard`) renders
purely from `GameState` and gives no indication of whether a player's WebSocket
connection is active. A player who disconnects mid-game looks identical to one
who is still connected. The lobby screen does show a ` (disconnected)` text
suffix, but the in-game player cards show nothing.

## Goals

- Show a clear, at-a-glance indication of connected vs. disconnected for every
  player in the in-game sidebar player list.
- Apply the same visual treatment to the lobby player rows, replacing the
  current text-only suffix with the shared indicator style.
- Reuse connection state the server already broadcasts; do not add new wire
  messages or server logic.
- Keep `GameState` / the shared `gameReducer` pure — connection is network
  metadata, not game state.
- Bots always read as connected (the server already marks bot seats
  `connected: true` forever).

## Non-Goals

- No change to the client/server wire contract (`src/types/net.ts`).
- No change to `src/types/game.ts` (`Player` / `GameState` unchanged).
- No reconnect logic or connection timers — the indicator reflects the
  last-known state broadcast by the server.
- No per-player custom messages.

## Design

### 1. Connection data already exists client-side

`GameServer.broadcast()` sends a `Lobby` message (`LobbyPlayer[]`, each with
`connected: boolean`) alongside every state snapshot (`server/gameServer.ts`,
`src/types/net.ts`). `useNetworkGame` already stores this in its `lobby` state,
updated on `Welcome` and `Lobby` messages. The indicator is purely a matter of
threading `lobby` down to the player cards.

### 2. Prop threading

- `src/components/MultiplayerGame.tsx` — compute the connected set from the
  live lobby and pass it to `GameView`:

  ```tsx
  const connectedPlayerIds = new Set(game.lobby.filter((p) => p.connected).map((p) => p.id))
  <GameView game={game} connectedPlayerIds={connectedPlayerIds} onLeave={game.leave} />
  ```

- `src/components/GameView.tsx` — new optional prop `connectedPlayerIds?: Set<number>`,
  forwarded to `Sidebar`.
- `src/components/Sidebar.tsx` — new optional prop `connectedPlayerIds?: Set<number>`,
  forwarded to `PlayerPanel`.
- `src/components/PlayerPanel.tsx` — new optional prop; per player card:

  ```tsx
  const connected = connectedPlayerIds === undefined || connectedPlayerIds.has(player.id)
  ```

  Missing set (undefined) or unknown id ⇒ treated as connected, so existing
  tests and the "not yet known" window don't flash offline.

- `src/components/PlayerCard.tsx` — new prop `connected?: boolean` (default
  `true`). When `false`:
  - Dim the card: add `opacity-50` to the existing className list (stacks with
    the current bankrupt `opacity-50`; both apply → still 50%).
  - Render a short label in the name row: `{!connected && <span className="text-xs font-bold text-muted">{t('card.disconnected')}</span>}`.

### 3. Lobby upgrade

`src/components/Lobby.tsx` — for a slot with `p && !p.connected`, add
`opacity-50` to the row className (keep the existing
`lobby.disconnectedSuffix` label). This gives the lobby the same dim+label
style as the in-game cards.

### 4. i18n

Add one flat key to both locale files (`src/i18n/locales/en/translation.json`
and `id/translation.json`):

- `card.disconnected`: `"OFFLINE"` (both locales; matches the uppercase style
  of `card.bankrupt`).

## Testing

- `src/components/__tests__/PlayerCard.test.tsx`: new tests —
  `connected={false}` shows the `OFFLINE` label and the dim class; the default
  (prop omitted) shows no offline label.
- `src/components/__tests__/PlayerPanel.test.tsx`: new test — a player id not
  in `connectedPlayerIds` renders an offline card; omitted set keeps everyone
  connected.
- `src/components/__tests__/Sidebar.test.tsx`: new test — a disconnected player
  card shows the offline label when `connectedPlayerIds` excludes that id.
- `src/components/__tests__/Lobby.test.tsx`: new test — a disconnected player
  row carries the dim class and the disconnected label.
- Existing component tests stay green because every new prop defaults to the
  current behavior (omitted set ⇒ connected, `connected` defaults `true`).

## Verification

- `npm run typecheck`, `npm run test:unit`, and `npm run lint` all pass.
- Manual: host a room with a bot, start the game, close the bot seat's tab (or
  kill a second browser), and confirm that player's sidebar card dims and shows
  OFFLINE while the board continues.
