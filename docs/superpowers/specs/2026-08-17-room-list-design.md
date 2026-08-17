# Room List Design

**Date:** 2026-08-17
**Status:** Approved (brainstorming)

## Summary

Add a public room list to the multiplayer setup screen so players can discover open
rooms and join by clicking a row, without typing a room code. Manual code entry stays.

## Requirements

- All rooms on the server are listed publicly (no opt-in toggle).
- The list shows, per room: **host name**, **player count** (`n/6`), and a **status
  badge** (Lobby / In game).
- Clicking a room row joins it directly (its code is used under the hood).
- The 5-char code is **not** displayed in the list.
- Manual code entry in `GameSetup` remains available.
- In-game rooms appear with an "In game" badge; clicking one is rejected by the
  server exactly as today (source of truth stays server-side).

## Architecture

### Server: `GET /rooms` endpoint

- `RoomManager.list()` returns a snapshot for every room in `this.rooms`:
  `{ code, hostName, playerCount, phase }`.
  - `hostName`: `game.getPlayers()[game.getHostPlayerId()].name`
  - `playerCount`: number of filled slots (named humans + bots), of max 6
  - `phase`: `game.getState().phase`
- `server/http.ts` adds a route: `GET /rooms` returns `200` + JSON array.
  All other paths keep serving static files as today.
- No auth. No per-room detail beyond the listed fields.

### Client: room list UI

- New hook `useRoomList()` polls `GET /rooms` every ~4s. Returns `{ rooms, error }`.
- `GameSetup.tsx` renders the list below the existing create/join card:
  - A row per room: host name, player count (`n/6`), status badge (Lobby / In game).
  - Each row is a button; clicking calls the existing `onJoin(name, code)` with that
    room's code. The name field typed by the player is used.
  - In-game rows may be visually disabled; the server still rejects a join attempt
    if the game started (its message is rendered by the client as today).
  - Empty state: "No open rooms yet" when the server returns zero rooms.
  - Server unreachable: the list section hides quietly; no crash.
- New i18n keys in both `en` and `id` locales: list title, status labels
  (Lobby / In game), empty state, player-count format.

## Data Flow

- Client polls `GET /rooms` every 4s → JSON array → rows.
- Each poll replaces the list wholesale (no diffing).
- Server computes the snapshot fresh per request from its in-memory room map.

## Error Handling

- Failed fetch → keep last good list or hide section quietly; never crash.
- No retry/backoff beyond the regular 4s tick.

## Testing

- `server/__tests__/http.test.ts` (or `roomManager.test.ts`): `GET /rooms` returns
  the correct snapshot (code, host name, player count, phase) for a lobby room and
  an in-game room.
- `src/components/__tests__/GameSetup.test.tsx`: mock `useRoomList`; list renders
  rows with host/players/status; clicking a row calls `onJoin` with the right code.
- `e2e/multiplayer.spec.ts`: create a room in one browser context, assert it appears
  in the other context's room list, join by clicking it.

## Conventions

- `const` object + derived type for any new status values; no TS enums.
- i18n keys added to both `en` and `id` translation files (flat keys).
- Semicolon style matches each file edited.