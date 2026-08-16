# Design: Remove Single Device — Multiplayer (LAN) Only

Date: 2026-08-16

## Goal

Make the game multiplayer-only (LAN). Remove the "Single Device" feature
completely: the mode toggle on the setup screen, the local game form, the local
game hook, its localStorage persistence, its i18n strings, and all unit/e2e
tests that exercise local mode. Rewrite the game-flow e2e specs to run against
the LAN server so gameplay coverage is preserved. Multiplayer (LAN) becomes the
default and only entry point.

## Current behavior

- `src/App.tsx` picks a mode at runtime: local (`useGame`) or multiplayer
  (`MultiplayerGame`), with a setup screen shown when neither is active.
- `src/components/GameSetup.tsx` shows a two-button toggle
  (`setup.singleDevice` / `setup.multiplayer`) and renders either a local setup
  form (player count, names, bot seats, "Start Game") or a multiplayer
  create/join form.
- Local mode runs on `src/hooks/useGame.ts`: drives `gameReducer` directly,
  generates dice client-side (plain and `rollControlledDice`), auto-plays bot
  seats, auto-resolves moves/cards, and persists state to localStorage
  `monopoly-game-state`. It exposes `myPlayerId: null`, which several shared
  components branch on.
- e2e game-flow specs (`e2e/monopoly.spec.ts`, and the currency test in
  `e2e/i18n.spec.ts`) play games in local mode because it needs no server.
- `e2e/multiplayer.spec.ts` already exercises the real LAN server.

## Design decisions

1. **Multiplayer-only app.** `App` renders either the multiplayer setup screen
   or the multiplayer game. There is no mode selector.
2. **Setup screen keeps only the create/join form** (Your Name, Create Room /
   Join Room, room code, Continue). The toggle row and local form are removed.
3. **Delete the local hook** (`useGame.ts`) and its tests. Shared engine code —
   `gameReducer.ts`, `bot.ts`, `controlledDice.ts` — is untouched; the server
   already uses all three (`server/gameServer.ts` rolls via
   `rollControlledDice`, decides bots via `decideBotAction`).
4. **Preserve game-UI e2e coverage by running against the server.** Gameplay
   e2e tests are rewritten to the same pattern as the existing "host adds a bot,
   starts, and the bot auto-plays" test: one browser context creates a room,
   adds server-side bots, starts, and plays turns while bots auto-play.
5. **`myPlayerId` stays `number | null` in this change.** The `=== null`
   branches in `GameView` and `TradeInboxModal` become dead but harmless, and
   `useNetworkGame`'s `playerId` is legitimately `null` in the lobby. Tightening
   to `number` is a follow-up (see Out of scope).

## File changes

### `src/components/GameSetup.tsx`
- Props become `{ onCreate: (name: string) => void; onJoin: (name: string, code: string) => void }`
  (`onStartLocal` dropped).
- Remove `SetupMode` const/type, the `mode` state, the toggle button row, and the
  entire `mode === SetupMode.Local` branch (player-count select, name inputs, bot
  checkboxes, "Start Game"), plus `handleStart`, `handleBotChange`,
  `handleNameChange`.
- Remove now-unused imports (`PLAYER_COLORS`, `BOT_NAMES`).
- Keep the multiplayer form exactly as-is (create/join toggle, room code input
  when joining, `Continue`).

### `src/App.tsx`
- Remove imports: `useGame`, `GameView`, `GamePhase`.
- Replace the `Mode` state with a `started: boolean` initialized from
  `loadSession()` (keeps auto-rejoin on refresh).
- `handleCreate` / `handleJoin` set `joinInfo` and `started = true`; the
  multiplayer `onLeft` clears the session and sets `started = false`.
- Render: `started ? <MultiplayerGame .../> : <GameSetup onCreate onJoin />`.
  The local `GameView` branch (with `exitKeys`) is removed.

### `src/hooks/useGame.ts` — deleted
### `src/hooks/__tests__/useGame.test.ts` — deleted

### i18n — remove keys from both `en` and `id` `translation.json`
- `setup.singleDevice`, `setup.multiplayer`, `setup.playerCount`,
  `setup.playerCount2..6`, `setup.playerName`, `setup.playerPlaceholder`,
  `setup.isBot`, `setup.isBotLabel`, `setup.start`
- `common.player` (only used by the removed `handleStart` fallback)
- `exit.label`, `exit.title`, `exit.message`, `exit.confirm` (only used by the
  removed local branch; multiplayer uses `lobby.leaveRoom` / `confirm.*`)

### `src/components/__tests__/GameSetup.test.tsx`
- Remove the three local tests (start local game, bot seat default name, gold
  ring toggle).
- Adapt the join test: no "Multiplayer (LAN)" click (the form is shown
  directly).
- Add a create-room test (`onCreate` called with the name).

## E2E

### Shared server helper
- New `e2e/helpers/server.ts` that spawns `npx tsx server/main.ts` with a unique
  port per Playwright worker and returns `{ url, close }`. Each spec file uses a
  worker-scoped fixture so parallel workers don't collide on one port.
- Requires `npm run build` first (`dist/` is served by the server) — already a
  documented gotcha.

### `e2e/multiplayer.spec.ts`
- Remove the `page.click('button:has-text("Multiplayer")')` step from all five
  tests (the setup screen now shows the multiplayer form directly). Logic
  unchanged.

### `e2e/monopoly.spec.ts` — rewritten to server-based play
- "setup screen renders correctly" → asserts the multiplayer form: `Create Room` /
  `Join Room` buttons and the Your Name field visible; no `player-count` select.
- "start game with 2 players" → host creates room, adds one bot, starts; expect
  two player cards with the chosen names and `$`.
- "buy property and see it in panel" → host + one bot, play up to ~15 turns via
  the existing turn-handler helper; assert the first player card is non-empty.
- "center panel fits on 3 viewports" → host + one bot, start at each viewport
  size, assert sidebar fits within the board (same assertions as today).
- "4-player game survives many turns" → host + three bots, start, play up to 12
  turns; assert player cards count >= 2.
- Dropped as duplicates (already covered in `multiplayer.spec.ts`): "bot seat
  auto-plays" (→ "host adds a bot, starts, and the bot auto-plays"), "single
  player can exit" (→ "a player can leave the room mid-game and return to the
  menu").

### `e2e/i18n.spec.ts`
- Test 1 (language default/toggle) → assert `Create Room` visible, open
  Settings, select `id`, assert `Buat Ruangan`.
- Test 2 (currency) → server flow: create room, add a bot, start; assert `$` on
  a player card, open Settings, select `IDR`, assert `Rp`.

## Out of scope / follow-ups

- Tighten `GameApi.myPlayerId` to `number` and delete the now-dead `=== null`
  branches in `GameView.tsx` and `TradeInboxModal.tsx` (requires reconciling
  `useNetworkGame`'s lobby-time `playerId: null`).
- `monopoly-game-state` localStorage key dies with `useGame`; no migration
  needed.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run build`
- `npm run test:e2e` (with `dist/` built first)
