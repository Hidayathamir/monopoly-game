# Emoticons

## Summary

A quick-reaction feature: players emit one of 4 emoticons (😢 😂 😠 😎) via buttons in the sidebar. The emoticon floats above the sender's token on the board and is visible to every player in the room. Bots (and AFK/bot-controlled players) auto-emit emoticons for significant game events. Emoticons are ephemeral — in-memory only, never persisted, never written to the event log.

## Motivation

Monopoly is social; players want a lightweight, non-verbal way to react to what's happening (paying a huge rent, bankrupting, winning a trade). Full chat is explicitly out of scope. Four quick emoticons give the game a living, reactive feel without a text channel.

## Requirements (settled)

- Limited set: sad 😢, happy/laugh 😂, angry 😠, proud/arrogant 😎 — quick buttons only (no free-text chat, no emoji shortcuts).
- Emoticons render inline, floating above the emitter's token/space on the board.
- Visible to ALL players in the room.
- Can be emitted at any time during the game, any phase **except while dice are rolling**.
- Per-player cooldown: one emit every 5 seconds (server-authoritative, same rule for humans, bots, and AFK/bot-controlled players).
- No persistence — ephemeral, in-memory only; no DB/replay support.
- Emoticons are board-only — never written to the event log.
- Bots emit emoticons for significant events: bankruptcy=😢, expensive rent=😠, monopoly=😎, trade win/doubles=😂.
- Tests: unit tests for cooldown/buttons; E2E spec for emission + visibility.

## Assumptions (made while the user was away)

1. "Dice rolling" means the `Rolling` phase (dice animation). All other phases are allowed, including `Moving`, `Resolving`, `Buying`, `Building`, and `GameOver`.
2. Emitting is blocked only before the game starts (lobby/`Setup` phase) and during `Rolling`.
3. "Expensive rent" = a single rent payment ≥ `EXPENSIVE_RENT_THRESHOLD` ($300, 20% of starting money).
4. Bot emoticon triggers are derived from the reducer's `eventLog` diff (no reducer changes needed).
5. A rejected emit (cooldown active / wrong phase / not in a game) is silently dropped — no error message, to avoid UI noise.
6. Emoticons are a dedicated ephemeral broadcast channel, not part of `GameState`.

## Behavior

### Human emission

1. Player clicks one of 4 glyph buttons in the sidebar (always visible during a game, regardless of whose turn).
2. Client immediately disables the buttons for 5s (local cooldown feedback) and sends `{ type: 'emoticon', emoticon }`.
3. Server validates: game has started, phase is not `Rolling`, and the sender's 5s cooldown has elapsed.
4. If valid, server broadcasts `{ type: 'emoticon', playerId, emoticon }` to all room members. Each client adds a bubble above the sender's token that pops up and fades out over `EMOTICON_LIFETIME_MS` (3s), then is removed.
5. If invalid, the message is dropped silently.

### Bot emission

- After every applied action, the server diffs the `eventLog` and maps events to emotions for bot/bot-controlled players:

| Event | Emitter | Emoticon |
|---|---|---|
| `event.bankruptcy` | bankrupt player (if bot) | 😢 |
| `event.paidRent` with amount ≥ $300 | payer (if bot) | 😠 |
| `event.monopolyRent` | owner (if bot) | 😎 |
| `event.tradeAccepted` | each bot party | 😂 |
| `event.doublesAgain` | roller (if bot) | 😂 |

- Bot emissions respect the exact same per-player 5s cooldown as humans.

## Architecture

Emoticons are a **dedicated ephemeral side-channel** — they do not enter `GameState`, the reducer, seed validation, or the event log.

```
Client (useNetworkGame) ── {type:'emoticon', emoticon} ──▶ server (GameServer.emitEmoticon)
                                                                    │ validate (phase, cooldown)
                                                                    ▼ broadcast
roomManager.broadcastEmoticon ── {type:'emoticon', playerId, emoticon} ──▶ all clients
Client ── activeEmotions[] ──▶ EmoticonOverlay (floats above tokens)
```

### Types (`src/types/emotion.ts` — new)

```typescript
export const Emoticon = { Sad: 'sad', Happy: 'happy', Angry: 'angry', Proud: 'proud' } as const
export type Emoticon = (typeof Emoticon)[keyof typeof Emoticon]
export const EMOTICON_GLYPHS: Record<Emoticon, string> = {
  sad: '😢', happy: '😂', angry: '😠', proud: '😎',
}
export const EMOTICON_COOLDOWN_MS = 5_000
export const EMOTICON_LIFETIME_MS = 3_000
export const EXPENSIVE_RENT_THRESHOLD = Math.floor(STARTING_MONEY * 0.2) // 300
```

### Network protocol (`src/types/net.ts`)

- `ClientMessageType.Emoticon = 'emoticon'` → `{ type: 'emoticon'; emoticon: Emoticon }`
- `ServerMessageType.Emoticon = 'emoticon'` → `{ type: 'emoticon'; playerId: number; emoticon: Emoticon }`
- Update `src/types/__tests__/enums.test.ts` to lock the new wire values.

### Server (`server/gameServer.ts`)

- Add `broadcastEmoticon(emotion: { playerId: number; emoticon: Emoticon })` to `GameServerEvents`.
- `emitEmoticon(clientId, emoticon)`:
  1. Resolve the sender's slot/player index by `clientId`; if not found or phase is `Setup`/`Rolling`, drop.
  2. Enforce `EMOTICON_COOLDOWN_MS` via `private lastEmotionAt: Map<number, number>`.
  3. Broadcast to the room.
- `applyAction`: capture `prevState`, run the reducer, then call `emitBotEmotions(prevState)` (respecting cooldown) before `broadcast()`.
- `stop()` clears the cooldown map's timers (none — plain timestamps) — no special handling needed.

### Bot detection (`src/logic/emotions.ts` — new, pure)

```typescript
export function detectBotEmotions(prev: GameState, next: GameState): Array<{ playerId: number; emoticon: Emoticon }>
```

- Diffs `next.eventLog.slice(prev.eventLog.length)`, matches entries per the table above.
- Emits only for players where `next.players[id].isBot || next.players[id].botControlled`.
- Resolves names→ids via `next.players`.

### Room manager (`server/roomManager.ts`)

- Wire `broadcastEmoticon` → `this.broadcastToRoom(code, { type: ServerMessageType.Emoticon, ...emotion })`.

### HTTP/WS (`server/http.ts`)

- Handle `ClientMessageType.Emoticon` → `roomManager.gameFor(clientId)?.emitEmoticon(clientId, msg.emoticon)`.

### Client hook (`src/hooks/useNetworkGame.ts`)

- `activeEmotions: ActiveEmotion[]` state (`{ id: number; playerId: number; emoticon: Emoticon }`), appended on each `emoticon` server message and removed after `EMOTICON_LIFETIME_MS` (per-emotion timer, cleaned up on unmount).
- `emitEmoticon(emoticon)` sends the client message.
- Add both to `GameApi` (`src/types/game.ts`) and `NetworkGameApi`.

### Client net (`src/net/client.ts`)

- `emitEmoticon(emoticon)` convenience method.

### UI

- **`EmoticonBar`** (new, `src/components/EmoticonBar.tsx`): 4 glyph buttons; disabled while `state.phase === GamePhase.Rolling` and during the local 5s cooldown. Placed in `Sidebar` above the turn-specific content (always visible). Buttons have i18n `title`s (`emoticon.sad` etc.).
- **`EmoticonOverlay`** (new, `src/components/EmoticonOverlay.tsx`): absolutely-positioned bubbles above each token using the same `POSITIONS`/`PLAYER_OFFSETS` math as `PlayerTokens` (export `POSITIONS` from `PlayerTokens`). Bubbles anchor to `player.position` (the target space) — during the brief token-move animation a bubble may sit at the destination; acceptable for an ephemeral effect. Pop + fade CSS animation; `data-testid="emoticon-<playerId>-<emoticon>"`. Rendered by `GameBoard` (new `emotions` prop threaded from `GameView`).
- i18n keys added to `en` and `id` locales.

## Error handling

- Invalid/dropped emits (cooldown, wrong phase, not joined) are silent — no error messages.
- Malformed emoticon values from a client are rejected (only the 4 known strings broadcast).
- Timers for bubble expiry are cleared on component/hook unmount.

## Testing

### Unit tests

- `src/logic/__tests__/emotions.test.ts`: each trigger maps to the right (player, emoticon); ignores non-bot players; ignores cheap rent; only newest entries are considered.
- `server/__tests__/emoticon.test.ts` (new GameServer tests): emit broadcasts; cooldown suppresses a second emit within 5s; blocked during `Rolling`; blocked in `Setup`; bot auto-emits on a seeded bankruptcy/expensive-rent state; bot respects the same cooldown.
- `src/components/__tests__/EmoticonBar.test.tsx`: renders 4 buttons with correct glyphs; click calls `onEmit` with the right emoticon; buttons disabled during `Rolling`; disabled during cooldown and re-enabled after 5s (fake timers).
- `src/hooks/__tests__/useNetworkGame.test.ts`: `emoticon` server message appends to `activeEmotions`; expiry removal after lifetime; `emitEmoticon` sends the correct client message.
- `src/types/__tests__/enums.test.ts`: lock new wire values.

### E2E (`e2e/emoticon.spec.ts`)

Uses `serverUrl` fixture (trades disabled). New seed fixture `e2e/fixtures/emoticon-seed.ts` exposes two builders:

- `buildResolvingPayRentState(opts)` — phase `Resolving`, `pendingAction` `PayRent` (amount configurable, current player must be a bot), matching board ownership.
- `buildWaitingState` is reused from `e2e/helpers/seed.ts` for the human-emission scenarios.

1. **Human emission + visibility**: two clients create/join, seed a Waiting game, client A clicks 😂 → client B sees `data-testid="emoticon-0-happy"` above A's token.
2. **Cooldown UI**: after A clicks, A's emoticon buttons are disabled, then re-enabled after 5s.
3. **Bot auto-emits on expensive rent**: 3-player seed (Host, Tamu, Droid bot), bot is current in `Resolving` with `pendingAction = PayRent` ≥ $300 → bot pays, all clients see the 😠 bubble above the bot's token.

## Files to change

| File | Change |
|------|--------|
| `src/types/emotion.ts` | new — emoticon consts/types + constants |
| `src/logic/emotions.ts` | new — `detectBotEmotions` |
| `src/types/net.ts` | add `Emoticon` client + server message types |
| `src/types/game.ts` | add `activeEmotions`/`emitEmoticon` to `GameApi` |
| `src/net/client.ts` | add `emitEmoticon()` |
| `src/hooks/useNetworkGame.ts` | handle server message, expose `activeEmotions` + `emitEmoticon` |
| `server/gameServer.ts` | `emitEmoticon`, cooldown map, `emitBotEmotions`, new event callback |
| `server/roomManager.ts` | wire `broadcastEmoticon` |
| `server/http.ts` | handle `emoticon` client message |
| `src/components/EmoticonBar.tsx` | new — sidebar buttons |
| `src/components/EmoticonOverlay.tsx` | new — floating bubbles |
| `src/components/PlayerTokens.tsx` | export `POSITIONS` |
| `src/components/GameBoard.tsx` | render `EmoticonOverlay`, thread `emotions` prop |
| `src/components/GameView.tsx` | thread `game.emitEmoticon` + `game.activeEmotions` |
| `src/components/Sidebar.tsx` | render `EmoticonBar`, new `onEmitEmoticon` + phase props |
| i18n en/id | `emoticon.*` keys |
| `src/types/__tests__/enums.test.ts` | lock new wire values |
| `src/logic/__tests__/emotions.test.ts` | new unit tests |
| `server/__tests__/emoticon.test.ts` | new unit tests |
| `src/components/__tests__/EmoticonBar.test.tsx` | new unit tests |
| `src/hooks/__tests__/useNetworkGame.test.ts` | extend |
| `e2e/emoticon.spec.ts` | new E2E spec |

## Out of scope

- Free-text chat or emoji shortcuts.
- Persistence / replay / DB.
- Emoticons in the event log.
- Custom/extra emoticons or animated stickers.
- Emoticon sound effects.
