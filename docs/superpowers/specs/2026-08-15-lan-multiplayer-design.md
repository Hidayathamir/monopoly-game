# Monopoly — LAN / Internet Multiplayer

**Date**: 2026-08-15
**Stack**: React 19 + TypeScript + Vite 8, Node.js + `ws`, `tsx` for running the TS server

## Goal

Let friends play from their own laptops. The host runs a small authoritative Node server on their machine; friends connect from their browsers (same network via the host's IP, or anywhere via an ngrok tunnel). The existing single-device (hot-seat) mode stays untouched.

## Decisions

| Decision | Choice |
|----------|--------|
| Architecture | Authoritative Node.js WebSocket server + thin React client (no WebRTC) |
| State ownership | Server holds the single true `GameState`; clients render only, never run the reducer in multiplayer |
| Randomness | Server-authoritative: dice rolls and card shuffles happen on the server only |
| Server port | Single port `3001` serves **both** the built client (static) **and** the WebSocket |
| Host role | Host is player 0 (first to connect); host also plays |
| Max players | 6 (host + 5 friends) |
| Turn enforcement | Server maps each socket to a `playerId` and rejects actions from anyone but the current player |
| Board visibility | Full shared board for everyone (Monopoly is open-information) |
| Local mode | Kept exactly as-is (`useGame` + reducer + localStorage) |
| Connection | Client connects WS to its own origin — works for LAN IP or ngrok with zero config |

## Architecture

Two pieces, reusing the existing pure `gameReducer`:

- **Node WebSocket server** (new `server/`): holds the authoritative `GameState`, applies validated `GameAction`s via the existing `gameReducer`, generates all randomness, and broadcasts the resulting state to every connected client. Also serves the built `dist/` statically so a single URL loads both app and socket.
- **React client** (existing): in multiplayer becomes a thin view. It receives state over WS and sends discrete action messages. Local mode is unchanged.

`gameReducer.ts` and `types/game.ts` are already pure (no DOM), so both browser and Node import them directly — no logic duplication. `tsx` runs the TS server without a build step for the server code.

### Connection flow

1. Host runs `npm run build && npm run server` (server on `:3001`, serving `dist/`).
2. Host opens `http://localhost:3001`, picks "Multiplayer", is assigned slot 0, sees the lobby with the address to share.
3. Friend opens `http://<host-ip>:3001` on the same network, or `https://<something>.ngrok.app` (from `ngrok http 3001`). Client auto-derives the WS URL from its own `window.location.origin` — no config, works over `ws://` or `wss://`.
4. Friend enters their name in the lobby, joins as the next free slot (1–5).
5. Player 0 clicks "Start game" when everyone is present.

## Server model

### `GameServer` class

- Holds `GameState`, created via `createInitialState()` (deck shuffling already happens here, now server-side).
- `connections: Map<playerId, WebSocket>` plus a lobby list of joined players (name → slot).
- `applyAction(action)`: validates that the sender's `playerId === currentPlayer` (or is a valid lobby action), runs `gameReducer`, and broadcasts.
- `handleRoll()`: server-driven turn sequence — applies `RollDice`, generates dice, waits ~600ms, applies `DiceAnimated`, waits the animation window, applies `ResolveSpace`. Stops whenever a `pendingAction` needs a player decision. Client animations remain CSS-driven off phase transitions.

### Turn flow

Client sends `ROLL_DICE` → server steps `Rolling → Moving → ResolveSpace` on timers → if a `pendingAction` requires a decision (buy / pay rent / draw card / etc.), the server waits for the current player's next message.

### Lifecycle & errors

- Single room, one game at a time. Full room (6) rejects extra joins.
- Out-of-turn / wrong-phase actions are rejected and logged; client surfaces a "connected / disconnected" status.
- Names are unique per room; a duplicate lobby name is rejected (the joining client is prompted to pick another).
- Reconnect: a client that drops and rejoins with the same name reclaims its slot; the game keeps running on the server. Server process death loses the game (accepted for LAN party scope).

## Client changes

- **Mode selector** on `GameSetup.tsx`: "Local (same device)" vs "Multiplayer (LAN)".
- **Local mode** unchanged.
- **New `src/net/client.ts`**: WebSocket wrapper — connect, `sendAction`, message parsing, status + reconnect-by-name.
- **New `src/hooks/useNetworkGame.ts`**: mirrors `useGame`'s API; holds state from server messages and exposes `sendAction(type, payload)`.
- **New `src/components/Lobby.tsx`**: shows joined players + shareable address; name entry; Start button for player 0 only.
- **`App.tsx` refactor**: same board/sidebar/modals render from either local or network source. `handleRoll` in local mode keeps the existing client-side dice generation; in multiplayer it sends `ROLL_DICE` and lets the server roll.
- **`GameSetup`/colors**: support 6 players and 6 token colors (currently 4).

## Files summary

| File | Change |
|------|--------|
| `server/index.ts` (or `server.ts`) | **NEW** — WS server entry, serves `dist/` |
| `server/gameServer.ts` | **NEW** — `GameServer` class (state, validation, broadcast, turn timers) |
| `src/net/client.ts` | **NEW** — WebSocket client wrapper |
| `src/hooks/useNetworkGame.ts` | **NEW** — multiplayer hook mirroring `useGame` |
| `src/components/Lobby.tsx` | **NEW** — lobby / join / start screen |
| `src/components/GameSetup.tsx` | Add mode selector |
| `src/App.tsx` | Route local vs network game; remove client dice in multiplayer |
| `src/types/game.ts` | Add network message types (client↔server protocol) |
| `package.json` | Add `server` script; add deps `ws`, `@types/ws`, `tsx` |
| `src/logic/gameReducer.ts` | Unchanged (shared as-is) |

## Protocol (client ↔ server)

- Client → server: `join { name }`, `start { }`, `action { type, ...payload }`.
- Server → client: `joined { playerId, players }`, `state { gameState }` (full state on every change), `error { message }`.

## Testing

- Unit tests for `GameServer`: slot assignment, join/leave, turn enforcement (reject out-of-turn action), authoritative dice, full-room rejection.
- Existing reducer tests unchanged.
- Playwright smoke test: boot the server, open two pages, join both, assert the second client sees the first's state.

## Out of scope

- WebRTC / peer-to-peer.
- Multiple simultaneous rooms.
- Persisting a game server-side across restarts.
- Hidden/private information, spectating, chat, undo, or AI opponents.
- Changing existing hot-seat game rules or UI.
