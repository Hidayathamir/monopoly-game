# Enum-like String Constants Design

Date: 2026-08-16

## Problem

The codebase mixes two styles for enum-like string values:

- `src/types/game.ts` already declares **`const` objects + derived union types**
  (`GameActionType`, `PendingActionType`, `GamePhase`, `SpaceType`, `CardType`,
  `CardActionType`) and `gameReducer.ts` uses them everywhere.
- But several production files still emit raw string literals:
  `server/gameServer.ts`, `server/http.ts`, `server/roomManager.ts`,
  `src/hooks/useNetworkGame.ts`, `src/logic/bot.ts`, and
  `src/components/Lobby.tsx`.
- `src/types/net.ts` has **no const objects at all** for the wire message types
  (`ClientMessage`, `ServerMessage`) nor for `ConnectionStatus` — the union
  discriminants are inline string literals.

Real TypeScript `enum` is not an option: the repo enforces
`erasableSyntaxOnly: true` across all tsconfig projects. The "enum" convention
is `const` object + derived union type (as in `game.ts`).

## Convention (codified in AGENTS.md)

Add to the AGENTS.md **Conventions** section:

> **Enum-like string constants**: Any fixed set of string values (wire message
> types, phases, action types, statuses, etc.) must be declared as a `const`
> object with a derived union type (see `src/types/game.ts` and
> `src/types/net.ts`). Do not use raw string literals in production code where
> a constant exists; do not introduce TypeScript `enum` (repo enforces
> `erasableSyntaxOnly`). Wire values are part of the client/server contract and
> must never change when refactoring.

## Goals

- Every enum-like string in production code is referenced through its `const`
  object; no raw literals where a constant exists.
- Add the three missing const objects in `src/types/net.ts` and derive the union
  types from them.
- Zero behavior change: all wire values stay byte-identical (protocol +
  localStorage compatibility).

## Non-Goals

- No change to any string **value** (protocol contract + persisted
  `monopoly-game-state` must not break).
- No change to test files — raw literals in `__tests__` still typecheck because
  the literal is assignable to the derived union type.
- No change to `docs/superpowers/*` plan/spec files.
- No introduction of TypeScript `enum`.

## Design

### 1. `src/types/net.ts` — add consts, derive types

Follow the existing `net.ts` style (no semicolons):

```ts
export const ClientMessageType = {
  Create: 'create',
  Join: 'join',
  Start: 'start',
  Leave: 'leave',
  AddBot: 'addBot',
  RemoveBot: 'removeBot',
  Action: 'action',
} as const
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType]

export const ServerMessageType = {
  Welcome: 'welcome',
  Lobby: 'lobby',
  State: 'state',
  Left: 'left',
  Error: 'error',
} as const
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType]

export const ConnectionStatus = {
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnected: 'disconnected',
} as const
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus]
```

Rewrite the `ClientMessage`/`ServerMessage` union discriminants to use the
`typeof X.Y` form (matching how `GameAction` in `game.ts` references
`GameActionType`):

```ts
export type ClientMessage =
  | { type: typeof ClientMessageType.Create; name: string }
  | { type: typeof ClientMessageType.Join; code: string; name: string }
  | { type: typeof ClientMessageType.Start }
  | { type: typeof ClientMessageType.Leave }
  | { type: typeof ClientMessageType.AddBot }
  | { type: typeof ClientMessageType.RemoveBot; playerId: number }
  | { type: typeof ClientMessageType.Action; action: GameAction }

export type ServerMessage =
  | { type: typeof ServerMessageType.Welcome; playerId: number; hostPlayerId: number; players: LobbyPlayer[]; state: GameState; code: string }
  | { type: typeof ServerMessageType.Lobby; players: LobbyPlayer[]; hostPlayerId: number }
  | { type: typeof ServerMessageType.State; state: GameState }
  | { type: typeof ServerMessageType.Left }
  | { type: typeof ServerMessageType.Error; message: string }
```

### 2. Replace raw literals in production code

`server/gameServer.ts` (import `GameActionType`, `PendingActionType` from
`src/types/game`; `ServerMessageType` from `src/types/net`):

- `GameActionType.*` — every dispatch and compare site (`START_GAME`,
  `ROLL_DICE`, `DICE_ANIMATED`, `RESOLVE_SPACE`, `DECLINE_BUY`, `PAY_RENT`,
  `DECLARE_BANKRUPTCY`, `DRAW_CARD`, `RESOLVE_CARD`, `END_TURN`,
  `PROPOSE_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `CANCEL_TRADE`).
- `PendingActionType.*` — the `skipLeftPlayers()` pending checks
  (`buyProperty`, `payRent`, `bankruptcy`, `drawCard`, `cardEffect`) and the
  `scheduleAutoSteps()` `drawCard` checks.
- `ServerMessageType.Error` for every `{ type: 'error', message }` send;
  `ServerMessageType.Welcome` for the welcome payloads; `ServerMessageType.Left`
  for the leave acks.

`server/http.ts` (import `ClientMessageType`):

- `msg.type === ClientMessageType.Create` etc. for the whole dispatch chain.

`server/roomManager.ts` (import `ServerMessageType`):

- `{ type: ServerMessageType.State, state }` and
  `{ type: ServerMessageType.Lobby, players, hostPlayerId }`.

`src/hooks/useNetworkGame.ts` (imports):

- `ClientMessageType.*` in the `send` callbacks (create/join/leave/start/addBot/
  removeBot/action).
- `ServerMessageType.*` in the `onMessage` handler (`welcome`, `lobby`, `state`,
  `left`, `error`).
- `GameActionType.*` in every `sendAction` call.
- `ConnectionStatus.*` for the status state (`connecting`, `connected`,
  `disconnected`).

`src/logic/bot.ts` (import `GameActionType`):

- `GameActionType.*` for every returned action (`BUY_PROPERTY`, `DECLINE_BUY`,
  `PAY_RENT`, `DRAW_CARD`, `RESOLVE_CARD`, `DECLARE_BANKRUPTCY`,
  `USE_GET_OUT_OF_JAIL_FREE`, `PAY_JAIL_FINE`, `ROLL_DICE`, `END_TURN`,
  `BUILD_HOUSE`, `SELL_HOUSE`, `MORTGAGE`).

`src/components/Lobby.tsx` (import `ConnectionStatus`):

- `status === ConnectionStatus.Connecting` and
  `status === ConnectionStatus.Disconnected`.

### 3. AGENTS.md convention entry

Add the convention bullet described above to the **Conventions** section of
`AGENTS.md`, next to the existing "No TS enums" bullet.

## Files

- Modify: `src/types/net.ts`
- Modify: `server/gameServer.ts`
- Modify: `server/http.ts`
- Modify: `server/roomManager.ts`
- Modify: `src/hooks/useNetworkGame.ts`
- Modify: `src/logic/bot.ts`
- Modify: `src/components/Lobby.tsx`
- Modify: `AGENTS.md`
- New: `docs/superpowers/specs/2026-08-16-enum-string-constants-design.md`

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run build` (required — the server is compiled by `tsc -b` and the
  multiplayer e2e spec serves `dist/`)
