# Monopoly — Rooms (Create / Join / Leave)

**Date**: 2026-08-15
**Stack**: React 19 + TypeScript + Vite 8, Node.js + `ws`, `tsx`

## Goal

Replace the single global multiplayer game with **multiple named rooms**. A player can create a room, join a room by a short code, and — from inside a room (lobby or mid-game) — leave it and join or create another room. Each room is an independent game. The existing single-device (hot-seat) mode stays untouched.

## Decisions

| Decision | Choice |
|----------|--------|
| Architecture | `RoomManager` on the server holds many `GameServer` instances, one per room |
| Room identity | Short code (5 chars, uppercase alphanumeric, no `O/0/I/1`), unique per server |
| Host role | Explicit `hostPlayerId` per room; creator is host; transfers on host leave (lobby) |
| Max players | 6 per room (unchanged) |
| Leave in lobby | Seat freed; host transfers if the leaver was host |
| Leave mid-game | Token/money/properties stay; player marked **left**; turns auto-skipped; game continues |
| Disconnect | Same gameplay effect as leave, but name is **reserved** for reconnect |
| Rejoin | Same room code + same name reclaims a **reserved** slot/token (after disconnect or a mid-game leave); an explicit lobby leave frees the seat, so rejoining enters as a fresh player |
| Room cleanup | Delete room when it has zero connected clients and zero reserved (named-but-disconnected) slots |
| Local mode | Kept exactly as-is |

## Architecture

Three pieces, reusing the existing pure `gameReducer` and the existing `GameServer` class largely unchanged:

- **`RoomManager`** (new `server/roomManager.ts`): the new top-level owner of rooms. It generates unique codes, instantiates a `GameServer` per room, tracks which client is in which room, wires each room's `GameServerEvents` to room-scoped broadcast/send, and deletes empty rooms.
- **`GameServer`** (existing `server/gameServer.ts`, minor edits): already does join/start/roll/action/disconnect for one game. Gains: host transfer, explicit `leave`, and mid-game "mark left + auto-skip turn". Its `GameServerEvents` become room-scoped (no change to the class interface itself).
- **React client** (existing): gains create/join/leave UI and a `code`/`hostPlayerId` in state.

### Room-scoped broadcast

Today `http.ts` wires `GameServerEvents` to `broadcast()` over **all** sockets. With rooms, each room's events must reach only its members. `RoomManager` keeps `Map<code, Set<clientId>>` and exposes `broadcastToRoom(code, msg)` / `sendToClient(clientId, msg)`. `http.ts` creates the `GameServer` via `RoomManager.create()`, which wires its events to the room-scoped functions. The `GameServer` class does not know about rooms.

### Code generation

`RoomManager.create()` generates a 5-char code from `A-Z2-9` (excluding `O`, `0`, `I`, `1`), retrying on collision with an existing room.

## Protocol (`src/types/net.ts`)

Client → server:
```ts
{ type: 'create'; name: string }                        // make a room, join as host (player 0)
{ type: 'join'; code: string; name: string }            // join an existing room
{ type: 'start' }
{ type: 'leave' }                                        // explicit leave (free seat / mark left)
{ type: 'action'; action: GameAction }
```

Server → client:
```ts
{ type: 'welcome'; playerId; hostPlayerId; players; state; code }
{ type: 'lobby'; players; hostPlayerId }
{ type: 'state'; state }
{ type: 'left' }                                          // ack: left successfully, return to menu
{ type: 'error'; message }
```

Changes from today: `welcome`/`lobby` gain `hostPlayerId`; `join` gains `code`; new `create`, `leave`, and `left` messages.

## Server model

### `RoomManager`

- `create()` → `{ code, game }`; adds the room and an empty client set.
- `get(code)` → `GameServer | undefined`.
- `join(code, clientId)` → adds client to the room's client set (the `GameServer.join` does slot/name logic).
- `leave(clientId)` → removes client from its room's client set and notifies the room's `GameServer`.
- `remove(code)` when a room is empty (no connected clients and no reserved slots).
- `codeFor(clientId)` → `code | undefined`.

### `GameServer` edits

- Add a `hostSlotIndex` field (initial 0 = creator). `start()` allows only the host slot; `getPlayers`/broadcast include `hostPlayerId`.
- `leave(clientId)`: if phase is `Setup`, remove the slot entirely (free seat) and, if the leaver was host, reassign `hostSlotIndex` to the next connected slot. If the game is running, mark the slot "left" (keep `name`, drop `clientId`/`connected`) and trigger turn-skip.
- `disconnect(clientId)`: keep the slot reserved (`connected = false`, `clientId = null`, `name` kept) so a same-name rejoin can reclaim it; if the game is running, also trigger turn-skip.
- **Turn-skip**: after a leave/disconnect during a running game, if the current player has left/disconnected, auto-advance: `END_TURN` when the phase is `Waiting` and there is no pending action; auto-decline optional `BuyProperty`; for `PayRent`/`Bankruptcy`, auto-pay if affordable else `DECLARE_BANKRUPTCY`. This closes the existing gap where a pending decision stalls forever if the deciding player disappears.

## Client changes

- **`GameSetup.tsx`** — multiplayer tab becomes two actions: **Buat Kamar** (name → `create`) and **Masuk Kamar** (name + code → `join`).
- **`Lobby.tsx`** — show the room **code** prominently (copyable) plus the share URL; "Keluar" sends `leave`. Host indicator uses `hostPlayerId` instead of `playerId === 0`.
- **`GameView.tsx`** — add a **"Keluar Kamar"** button (sidebar/header) that sends `leave`.
- **`useNetworkGame.ts`** — add `create(name)`, `join(code, name)`, `leave()`, plus `code` and `hostPlayerId` state. On `left`, reset and invoke an `onLeft` callback.
- **`App.tsx`** — split `handleJoin` into create/join entry points; `onLeft` returns `mode` to `null` (menu).
- **`src/net/client.ts`** — no structural change; it already serializes arbitrary `ClientMessage`s.

## Files summary

| File | Change |
|------|--------|
| `server/roomManager.ts` | **NEW** — room registry, code generation, room-scoped broadcast wiring, cleanup |
| `server/gameServer.ts` | Add host transfer, `leave`, mid-game "left" marking + turn-skip |
| `server/http.ts` | Use `RoomManager`; route `create`/`join`/`leave`; per-room socket sets |
| `src/types/net.ts` | Update protocol (`create`, `join {code}`, `leave`, `left`, `hostPlayerId`, `code`) |
| `src/hooks/useNetworkGame.ts` | Add `create`/`join`/`leave`, `code`, `hostPlayerId`, `onLeft` |
| `src/components/GameSetup.tsx` | Create vs join room UI (name + code) |
| `src/components/Lobby.tsx` | Show room code; leave button; host via `hostPlayerId` |
| `src/components/GameView.tsx` | Add "Keluar Kamar" button |
| `src/App.tsx` | Create/join entry points; return to menu on leave |
| `src/logic/gameReducer.ts` | Unchanged (shared as-is) |

## Testing

- **`server/__tests__/roomManager.test.ts`** (new): unique code generation, create/get/join/leave wiring, empty-room cleanup.
- **`server/__tests__/gameServer.test.ts`**: host transfer on host leave; leave in lobby frees seat; leave mid-game marks left and skips turn; reconnect-by-name reclaims slot.
- **`server/__tests__/http.test.ts`**: create/join/leave message routing; error cases (bad code, full room, duplicate name).
- **`src/net/__tests__/client.test.ts`**: updated message types still round-trip.
- **Playwright** (`e2e/multiplayer.spec.ts`): two pages — page A creates a room, page B joins by code, both see each other; A leaves and B's lobby updates; a third flow leaves mid-game and joins a new room.

## Out of scope

- Room list browser / public room directory.
- Persisting rooms server-side across restarts.
- Spectating, chat, private rooms with passwords, or AI opponents.
- Changing existing hot-seat rules or UI.
