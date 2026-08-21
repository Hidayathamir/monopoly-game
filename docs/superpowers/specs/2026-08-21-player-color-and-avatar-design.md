# Design: Player color & avatar

**Date:** 2026-08-21
**Status:** Approved (Sections 1–5)

## Overview

Let players choose their own game-piece color (issue 1) and an avatar — either
from a fixed set of presets or an uploaded custom picture (issue 2) — in the
lobby, shared with all players in the room and persisted across sessions.

Design and implementation are combined into a single feature because both
issues touch the same player-identity code (lobby, player cards, board tokens,
wire contract).

## Goals / non-goals

### Goals

- Player picks one of 6 palette colors; uniqueness per room is enforced
  (first-come), so board tokens stay distinguishable.
- Player picks a preset avatar from a fixed list, or uploads a custom image.
- Identity is visible to every player on every device in the same room.
- Identity is locked at game start (lobby-only changes).
- Color/avatar persist per player name in `localStorage`, like the name does
  today, and are re-sent on refresh/rejoin.
- Bots, offline/AFK/reconnected players, seeds, and event-log history all carry
  identity consistently.

### Non-goals

- No server-side file storage for custom avatars; custom images travel as small
  data URLs embedded in state/lobby snapshots.
- No mid-game identity changes.
- No avatar identity per move in the event log beyond what `player.color` /
  `player.avatar` already give through the `Player` snapshot.

## Approaches considered

1. **Identity carried in shared state (chosen)** — extend `LobbyPlayer`,
   `GameState.Player`, and the server `Slot` with `color` + `avatar`; a new
   setup-phase wire message `SetIdentity`; identity flows into
   `state.players` at start. Single source of truth; works for bots/seeds/
   history; cross-device by construction; no server storage. Cons: custom
   images are data URLs in snapshots (size-capped).
2. **Identity via side channel** — server keeps identity only in slots →
   `LobbyPlayer`; `GameState.Player` unchanged; client resolves color from a
   separate map. Rejected: two sources of truth, breaks bots/seeds/history.
3. **Server-side file uploads** — images POSTed to server, served by URL.
   Rejected: file storage/serving/cleanup/concurrency overkill for this LAN/
   casual multiplayer app.

## Section 1 — Identity model & data flow

All fixed string sets use `const` objects with derived union types (repo
convention — no TS `enum`, `erasableSyntaxOnly`). See `src/data/avatars.ts`.

### New file `src/data/avatars.ts`

```ts
export const AvatarKind = { Preset: 'preset', Custom: 'custom' } as const
export type AvatarKind = (typeof AvatarKind)[keyof typeof AvatarKind]

export const PRESET_AVATARS = {
  Cat: 'cat', Dog: 'dog', Robot: 'robot', Alien: 'alien', Ghost: 'ghost',
  Penguin: 'penguin', Fox: 'fox', Dino: 'dino', Crab: 'crab', Octopus: 'octopus',
} as const
export type PresetAvatarId = (typeof PRESET_AVATARS)[keyof typeof PRESET_AVATARS]
```

Contents of `avatars.ts`:

- `AvatarKind` const object + union type.
- `PRESET_AVATARS` const object + `PresetAvatarId` derived union (10 emoji
  presets).
- `PRESET_EMOJI: Record<PresetAvatarId, string>` mapping each id to its emoji.
- `DEFAULT_AVATAR: PlayerAvatar` (preset cat).
- `isPresetAvatar(value)` / `isCustomAvatar(value)` / `isValidAvatar(value)`
  validators.
- `CUSTOM_AVATAR_MAX_DATA_URL_LENGTH` size cap (~100_000 chars).
- `CUSTOM_AVATAR_MAX_DIMENSION` (96px) for the client-side downscale target.

### Types (`src/types/game.ts`)

```ts
export type PlayerAvatar =
  | { kind: typeof AvatarKind.Preset; id: PresetAvatarId }
  | { kind: typeof AvatarKind.Custom; dataUrl: string }
```

`Player` gains required fields:

```ts
color: string
avatar: PlayerAvatar
```

`LobbyPlayer` (`src/types/net.ts`) gains the same `color: string` and
`avatar: PlayerAvatar` (required).

### Server (`server/gameServer.ts`)

- `Slot` gains `color: string | null` and `avatar: PlayerAvatar | null`.
- `create`/`join` accept optional desired `color`/`avatar`; server assigns the
  first free palette color when the desired one is taken or unspecified.
  Uniqueness is enforced server-side, first-come. `PLAYER_COLORS`
  (`src/data/players.ts`) is the palette; max 6 players already.
- New setup-phase wire message `SetIdentity { color?, avatar? }`; server
  validates color is free (or your own) and avatar valid; mid-game changes are
  rejected. On success the server broadcasts the updated lobby (and the next
  state snapshot carries it via `Player`).
- Custom data URLs are capped (~100KB string length) server-side.
- `addBot()` auto-assigns the next free color + a default preset avatar
  (deterministic by slot).
- `start()` passes `colors: string[]` + `avatars: PlayerAvatar[]` into the
  `StartGame` action.

### Reducer (`src/logic/gameReducer.ts`)

`StartGame` gains `colors: string[]` and `avatars: PlayerAvatar[]`; it writes
them onto each created `Player`. This is the single source of truth — board
tokens, player cards, and the event log all read `player.color` /
`player.avatar`. The reducer stays pure, so identity is preserved through
history playback.

## Section 2 — Wire contract

### `src/types/net.ts`

`ClientMessageType` gains `SetIdentity: 'setIdentity'`. `ClientMessage` gains:

```ts
| { type: typeof ClientMessageType.Create; name: string; color?: string; avatar?: PlayerAvatar }
| { type: typeof ClientMessageType.Join; code: string; name: string; color?: string; avatar?: PlayerAvatar }
| { type: typeof ClientMessageType.SetIdentity; color?: string; avatar?: PlayerAvatar }
```

`ServerMessage.Welcome` / `.Lobby` already carry `LobbyPlayer[]` (now with
identity). `GameState` snapshots carry identity via `Player`. No new server
message type for identity — a successful `SetIdentity` is followed by the
existing lobby/state broadcasts.

Wire values are part of the client/server contract and must not change when
refactoring.

### Client (`src/net/client.ts`, `src/hooks/useNetworkGame.ts`)

- `create(name, { color, avatar })`, `join(code, name, { color, avatar })`,
  new `setIdentity({ color, avatar })`.
- `useNetworkGame` accepts an optional persisted identity at construction and
  includes `color`/`avatar` when creating/joining/rejoining.

### Persistence (`src/net/session.ts`, `src/i18n/constants.ts`)

- `StorageKey.PlayerIdentity` (new): stores the chosen `{ color, avatar }`
  per name in `localStorage`, mirroring `StorageKey.PlayerName`.
- `StorageKey.MpSession` already exists; extend the saved session to carry
  `color` + `avatar` so a refresh auto-rejoin re-sends them (see
  `src/components/MultiplayerGame.tsx` `saveSession`).
- `GameSetup.tsx` persists the chosen color/avatar on load/change, pre-filled
  from `localStorage`.

## Section 3 — Lobby UI

`src/components/Lobby.tsx` gains an identity panel for the player's own seat
(only the seat where `playerId === your id` shows pickers; other rows are
display-only):

- **Color picker**: swatch grid of all 6 `PLAYER_COLORS`. Taken colors are
  shown disabled/struck; current color ring-highlighted. Click sends
  `setIdentity({ color })`.
- **Avatar picker**: row of the 10 `PRESET_AVATARS` emoji; current
  highlighted. **Upload**: `<input type="file" accept="image/*">` →
  client-side downscale to ≤96×96 JPEG data URL (Canvas), size-capped, sent as
  `setIdentity({ avatar: { kind: AvatarKind.Custom, dataUrl } })`. "Remove
  custom" reverts to the preset.
- Lobby rows use `p.color` for the dot (instead of `PLAYER_COLORS[i]`) and show
  each player's avatar.

## Section 4 — Board tokens, player cards & bots

- **Board tokens** (`src/components/GameBoard.tsx` / `PlayerTokens.tsx`): read
  `state.players[i].color` instead of `PLAYER_COLORS[i]`. Tokens render as a
  colored ring/badge around the avatar so players stay distinguishable.
- **Player cards** (`Sidebar.tsx` / `PlayerPanel.tsx` / `PlayerCard.tsx`):
  use `player.color` and show the avatar next to the name. Monopoly-color
  logic (from board data) is unrelated and unchanged.
- **Lobby rows**: `p.color` + `p.avatar`.
- **Bots**: `addBot()` assigns next free color + default preset avatar. Bot
  logic (`decideBotAction`) is untouched.
- **Offline/AFK/reconnected**: identity lives on the `Slot` and on
  `state.players`; leave/disconnect during gameplay only flips `connected`, so
  the reconnect path in `join()` keeps the slot's existing color/avatar.

## Section 5 — Seeds, validation, tests & i18n

### Seeds & validation

- `src/logic/seed.ts`: `createSeededState` defaults players to
  `color: PLAYER_COLORS[id % 6]` + `DEFAULT_AVATAR`; `SeedPlayerSpec` gains
  `color?` / `avatar?`.
- `validateStateStructure`: validate `player.color` is a non-empty valid hex
  from the palette and `player.avatar` passes the avatar validator.
- `e2e/helpers/seed.ts` `buildWaitingState` and checked-in generated fixtures
  (`e2e/fixtures/initial-state.ts`, seeds) gain `color`/`avatar` defaults so
  e2e state stays valid. Regenerate fixtures via existing scripts.

### Tests

- Server (`server/__tests__/*`): color uniqueness (taken → auto-assign next
  free / rejection), `SetIdentity` validation (mid-game rejected, oversized
  custom rejected), avatar validity, join/rejoin identity preservation, bots
  get free colors.
- Reducer/unit: `StartGame` writes colors/avatars; identity preserved through
  history (pure reducer).
- Client: lobby picker sends `SetIdentity`; upload downscale; component
  render with identity (`renderWithProviders`).

### i18n

Every new UI string (panel label, upload button, remove-custom, color taken,
validation errors) added to both `src/i18n/locales/en/translation.json` and
`src/i18n/locales/id/translation.json`. Server-side error strings stay
hardcoded Indonesian per existing convention.

## Data flow summary

```
GameSetup (persist color/avatar per name)
  → Create/Join message (+ color/avatar)   [client]
  → Server slot assignment (free color, valid avatar)   [authoritative]
  → Lobby broadcast (LobbyPlayer.color/avatar)
  → player picks → SetIdentity → server validates → Lobby broadcast
  → Start → StartGame(colors, avatars) → state.players[i].color/avatar
  → tokens, player cards, lobby rows render identity
  → Refresh/rejoin re-sends persisted identity from localStorage
```
