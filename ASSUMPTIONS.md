# ASSUMPTIONS — room-lifecycle / AFK / board naming fixes

Made while the user was away (working-while-away). Branch `feat/room-lifecycle-afk-board-fix` (not merged).

## Issue 1 — remove/stop room when no humans remain

- "No human playing → game should stop" means: when the last **connected** human leaves
  (explicit Leave) or goes offline (WebSocket close) mid-game, the game stops and the room
  is removed.
- A **reconnect grace window** (`ROOM_EMPTY_GRACE_MS`, default 30s, env-overridable) is kept so a
  brief refresh / network blip of the last human can rejoin. If a human rejoins within the window
  the room stays; otherwise it is torn down.
- A room whose seats are all cleared (lobby explicit Leave, which nulls the name) is removed
  **immediately** — no grace — preserving the existing behavior/tests.
- A lobby disconnect that leaves a named (reconnectable) seat reserved is now also cleaned up
  after the same grace window instead of lingering forever.
- When a room is removed, its `GameServer` timers are stopped (`GameServer.stop()`).

## Issue 3 — AFK detection

- `AFK_TIMEOUT_MS` default **30s** (env-overridable). Inactivity-based: the clock resets on every
  state change/action, so a player who keeps acting is never marked AFK.
- When the AFK timer fires for a **connected** human whose turn requires input, they are marked
  `botControlled` with a distinct `event.playerAfk` log entry and the bot plays their turn at
  normal bot speed (no reconnect-grace delay).
- A connected, AFK-marked player who sends an action takes back control immediately
  (`event.playerBack`), including mid-turn.
- UI keeps the existing `🤖 BOT` badge and `turn.botControl` status text. KNOWN LIMITATION: the
  TurnHeader for an AFK player still reads "offline, a bot is playing" (accurate for the offline
  case). A distinct AFK label would require a new `GameState`/`Player` field — deferred to keep the
  change surgical; the event log and card badge carry the AFK signal.

## Issue 2 — board naming

- The bug is in the **English** locale only: `board.space.27` is labeled "Water Company" and
  `board.space.28` "Toulouse", but space 27 is a property (yellow group) and space 28 is the
  utility. Indonesian is already correct. Fix = swap the two English labels. Board geometry/rents
  match standard Monopoly and are unchanged.

## E2E strategy

- Issue 2 uses the shared worker server (default timeouts).
- Issues 1 & 3 use a **dedicated server** started by the spec with short
  `AFK_TIMEOUT_MS`/`ROOM_EMPTY_GRACE_MS` so the tests run in seconds instead of minutes.
  This requires `npm run build` first (existing requirement for server-backed specs).
