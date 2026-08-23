# Emoticons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 quick emoticon buttons (😢 😂 😠 😎) that float above the sender's token on the board, visible to all players, with server-authoritative 5s cooldown and automatic bot emission for significant events.

**Architecture:** Emoticons ride a dedicated ephemeral broadcast channel — a new `emoticon` client/server message type — never touching `GameState`, the reducer, seed validation, or the event log. The server validates phase + per-player cooldown and broadcasts; a pure `detectBotEmotions(prev, next)` helper maps eventLog diffs to bot emoticons. The client keeps a small local list of active bubbles and renders them above tokens.

**Tech Stack:** TypeScript (Vite + React SPA, `verbatimModuleSyntax`, `erasableSyntaxOnly` — no enums), Node `ws` server, vitest, Playwright, Tailwind v4, react-i18next.

## Global Constraints

- **No enums / namespaces / `const enum`.** Use `as const` objects + type aliases (see `src/types/game.ts`).
- **`verbatimModuleSyntax`** → use `import type` for type-only imports.
- Never put emoticons in the event log, `GameState`, or seed fixtures.
- Cooldown is `5_000ms` server-side for humans, bots, and AFK/bot-controlled players alike.
- Blocked only in `Setup` (lobby) and `Rolling` (dice animation) phases.
- Emoticon lifetime is `3_000ms` client-side.
- i18n: add `emoticon.*` keys to BOTH `en` and `id` locales.
- Existing `enums.test.ts` locks all wire values — updating it is mandatory when adding message types.

---
---

### Task 1: Emoticon domain types + wire protocol

**Files:**
- Create: `src/types/emotion.ts`
- Modify: `src/types/net.ts`
- Create: `src/types/__tests__/emotion.test.ts`
- Modify: `src/types/__tests__/enums.test.ts`

**Interfaces:**
- Produces: `Emoticon` type (values `'sad' | 'happy' | 'angry' | 'proud'`), `EMOTICON_GLYPHS: Record<Emoticon, string>`, `EMOTICON_LIST: Emoticon[]`, `EMOTICON_COOLDOWN_MS` (=5000), `EMOTICON_LIFETIME_MS` (=3000), `EXPENSIVE_RENT_THRESHOLD` (=300), `isEmoticon(value): value is Emoticon`, `ActiveEmotion = { id: number; playerId: number; emoticon: Emoticon }`. All later tasks import these.

- [ ] **Step 1: Create `src/types/emotion.ts`**

```typescript
import { STARTING_MONEY } from '../data/board'

export const Emoticon = {
  Sad: 'sad',
  Happy: 'happy',
  Angry: 'angry',
  Proud: 'proud',
} as const
export type Emoticon = (typeof Emoticon)[keyof typeof Emoticon]

export const EMOTICON_LIST: Emoticon[] = [
  Emoticon.Sad,
  Emoticon.Happy,
  Emoticon.Angry,
  Emoticon.Proud,
]

export const EMOTICON_GLYPHS: Record<Emoticon, string> = {
  [Emoticon.Sad]: '😢',
  [Emoticon.Happy]: '😂',
  [Emoticon.Angry]: '😠',
  [Emoticon.Proud]: '😎',
}

export const EMOTICON_COOLDOWN_MS = 5_000
export const EMOTICON_LIFETIME_MS = 3_000
export const EXPENSIVE_RENT_THRESHOLD = Math.floor(STARTING_MONEY * 0.2)

export function isEmoticon(value: unknown): value is Emoticon {
  return typeof value === 'string' && EMOTICON_LIST.includes(value as Emoticon)
}

export type ActiveEmotion = {
  id: number
  playerId: number
  emoticon: Emoticon
}
```

- [ ] **Step 2: Write the failing test** — create `src/types/__tests__/emotion.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  Emoticon, EMOTICON_GLYPHS, EMOTICON_LIST, EMOTICON_COOLDOWN_MS,
  EMOTICON_LIFETIME_MS, EXPENSIVE_RENT_THRESHOLD, isEmoticon,
} from '../emotion'

describe('emotion constants', () => {
  it('defines exactly the four required emoticons', () => {
    expect(EMOTICON_LIST).toEqual(['sad', 'happy', 'angry', 'proud'])
  })

  it('maps every emoticon to its glyph', () => {
    expect(EMOTICON_GLYPHS[Emoticon.Sad]).toBe('😢')
    expect(EMOTICON_GLYPHS[Emoticon.Happy]).toBe('😂')
    expect(EMOTICON_GLYPHS[Emoticon.Angry]).toBe('😠')
    expect(EMOTICON_GLYPHS[Emoticon.Proud]).toBe('😎')
  })

  it('uses a 5s cooldown, 3s lifetime, and a $300 expensive-rent threshold', () => {
    expect(EMOTICON_COOLDOWN_MS).toBe(5000)
    expect(EMOTICON_LIFETIME_MS).toBe(3000)
    expect(EXPENSIVE_RENT_THRESHOLD).toBe(300)
  })

  it('isEmoticon accepts only the four known values', () => {
    expect(EMOTICON_LIST.every((e) => isEmoticon(e))).toBe(true)
    expect(isEmoticon('lol')).toBe(false)
    expect(isEmoticon(42)).toBe(false)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/types/__tests__/emotion.test.ts`
Expected: FAIL — `src/types/emotion.ts` does not exist.

- [ ] **Step 4: Implement `src/types/emotion.ts`** (content from Step 1).

- [ ] **Step 5: Add wire types to `src/types/net.ts`**

Add import at top: `import type { Emoticon } from './emotion'`

In the `ClientMessageType` const object add the entry `Emoticon: 'emoticon',` (keep existing entries).

In the `ServerMessageType` const object add the entry `Emoticon: 'emoticon',` (keep existing entries).

Append to the `ClientMessage` union:

```typescript
  | { type: typeof ClientMessageType.Emoticon; emoticon: Emoticon }
```

Append to the `ServerMessage` union:

```typescript
  | { type: typeof ServerMessageType.Emoticon; playerId: number; emoticon: Emoticon }
```

- [ ] **Step 6: Lock wire values in `src/types/__tests__/enums.test.ts`**

Add `'emoticon'` to the end of the `ClientMessageType` expectation array and to the end of the `ServerMessageType` expectation array:

```typescript
  expect(Object.values(ClientMessageType)).toEqual(['create', 'join', 'start', 'leave', 'addBot', 'removeBot', 'action', 'setIdentity', 'manualBotToggle', 'emoticon']);
  expect(Object.values(ServerMessageType)).toEqual(['welcome', 'lobby', 'state', 'left', 'error', 'emoticon']);
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/types/__tests__/emotion.test.ts src/types/__tests__/enums.test.ts`
Expected: PASS (both files).

- [ ] **Step 8: Commit**

```bash
git add src/types/emotion.ts src/types/net.ts src/types/__tests__/emotion.test.ts src/types/__tests__/enums.test.ts
git commit -m "feat: add emoticon domain types and wire protocol"
```

---
---

### Task 2: Pure bot emotion detection

**Files:**
- Create: `src/logic/emotions.ts`
- Create: `src/logic/__tests__/emotions.test.ts`

**Interfaces:**
- Consumes: `Emoticon` from `../types/emotion`, `EXPENSIVE_RENT_THRESHOLD`, `LogEventKey`, `GameState` from `../types/game`.
- Produces: `BotEmotion = { playerId: number; emoticon: Emoticon }` and `detectBotEmotions(prev: GameState, next: GameState): BotEmotion[]`. The server (Task 3) consumes this.

- [ ] **Step 1: Write the failing test** — create `src/logic/__tests__/emotions.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { detectBotEmotions } from '../emotions'
import { Emoticon } from '../../types/emotion'
import { createInitialState, gameReducer } from '../gameReducer'
import { GameActionType, LogEventKey, type GameState } from '../../types/game'
import { actorEntry } from '../logEntries'

function makePlayersState(emitterIndex: number, emitterIsBot: boolean): GameState {
  const base = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
    isBot: [false, true],
  })
  const next = { ...base, eventLog: [] }
  const p = next.players[emitterIndex]
  if (emitterIndex === 0 && !emitterIsBot) return next
  if (emitterIsBot) {
    next.players = next.players.map((pl, i) => (i === emitterIndex ? { ...pl, isBot: true } : pl))
  }
  void p
  return next
}

function withEvent(state: GameState, entries: ReturnType<typeof actorEntry>[]): GameState {
  return { ...state, eventLog: entries }
}

describe('detectBotEmotions', () => {
  it('maps a bot bankruptcy to sad', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [actorEntry(LogEventKey.Bankruptcy, bot)])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Sad }])
  })

  it('does not emit for a human bankruptcy', () => {
    const prev = makePlayersState(0, false)
    const human = prev.players[0]
    const next = withEvent(prev, [actorEntry(LogEventKey.Bankruptcy, human)])
    expect(detectBotEmotions(prev, next)).toEqual([])
  })

  it('maps expensive rent (>= threshold) paid by a bot to angry', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.PaidRent, params: { name: bot.name, amount: 300, owner: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Angry }])
  })

  it('ignores cheap rent below the threshold', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.PaidRent, params: { name: bot.name, amount: 299, owner: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([])
  })

  it('maps a monopoly rent to proud for the owner bot', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.MonopolyRent, params: { owner: bot.name, name: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Proud }])
  })

  it('maps a completed trade to happy for each bot party', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.TradeAccepted, params: { from: bot.name, to: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Happy }])
  })

  it('maps doubles to happy for the rolling bot', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [actorEntry(LogEventKey.DoublesAgain, bot)])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Happy }])
  })

  it('ignores unrelated event-log entries', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.Rolled, params: { name: bot.name, d1: 2, d2: 3, total: 5 } },
      { key: LogEventKey.Turn, params: { name: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/__tests__/emotions.test.ts`
Expected: FAIL — `src/logic/emotions.ts` does not exist.

- [ ] **Step 3: Implement `src/logic/emotions.ts`**

```typescript
import { Emoticon, EXPENSIVE_RENT_THRESHOLD, type Emoticon as EmoticonType } from '../types/emotion'
import { LogEventKey, type GameState } from '../types/game'

export type BotEmotion = {
  playerId: number
  emoticon: EmoticonType
}

function isBotControlled(state: GameState, playerId: number): boolean {
  const p = state.players[playerId]
  return !!p && (p.isBot || p.botControlled)
}

function playerIdByName(state: GameState, name: unknown): number | null {
  if (typeof name !== 'string') return null
  const idx = state.players.findIndex((p) => p.name === name)
  return idx === -1 ? null : idx
}

export function detectBotEmotions(prev: GameState, next: GameState): BotEmotion[] {
  const newEntries = next.eventLog.slice(prev.eventLog.length)
  const emotions: BotEmotion[] = []

  for (const entry of newEntries) {
    const params = entry.params ?? {}
    switch (entry.key) {
      case LogEventKey.Bankruptcy: {
        const id = playerIdByName(next, params.name)
        if (id !== null && isBotControlled(next, id)) {
          emotions.push({ playerId: id, emoticon: Emoticon.Sad })
        }
        break
      }
      case LogEventKey.PaidRent: {
        const id = playerIdByName(next, params.name)
        if (
          id !== null &&
          isBotControlled(next, id) &&
          typeof params.amount === 'number' &&
          params.amount >= EXPENSIVE_RENT_THRESHOLD
        ) {
          emotions.push({ playerId: id, emoticon: Emoticon.Angry })
        }
        break
      }
      case LogEventKey.MonopolyRent: {
        const id = playerIdByName(next, params.owner)
        if (id !== null && isBotControlled(next, id)) {
          emotions.push({ playerId: id, emoticon: Emoticon.Proud })
        }
        break
      }
      case LogEventKey.TradeAccepted: {
        for (const name of [params.from, params.to]) {
          const id = playerIdByName(next, name)
          if (id !== null && isBotControlled(next, id)) {
            emotions.push({ playerId: id, emoticon: Emoticon.Happy })
          }
        }
        break
      }
      case LogEventKey.DoublesAgain: {
        const id = playerIdByName(next, params.name)
        if (id !== null && isBotControlled(next, id)) {
          emotions.push({ playerId: id, emoticon: Emoticon.Happy })
        }
        break
      }
      default:
        break
    }
  }
  return emotions
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/logic/__tests__/emotions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logic/emotions.ts src/logic/__tests__/emotions.test.ts
git commit -m "feat: add pure bot emotion detection"
```

---
---

### Task 3: Server emission (cooldown, phase gate, bot broadcast)

**Files:**
- Modify: `server/gameServer.ts`
- Modify: `server/roomManager.ts`
- Modify: `server/http.ts`
- Modify: `server/__tests__/gameServer.test.ts` (setup helper only)
- Create: `server/__tests__/emoticon.test.ts`

**Interfaces:**
- Consumes: `Emoticon`, `isEmoticon`, `EMOTICON_COOLDOWN_MS` from `../src/types/emotion`; `detectBotEmotions` from `../src/logic/emotions`.
- Produces: `GameServer.emitEmoticon(clientId: ClientId, emoticon: Emoticon): void` (public, called by `server/http.ts`); new `GameServerEvents.broadcastEmoticon(emotion: { playerId: number; emoticon: Emoticon }): void` (implemented by `RoomManager`); `RoomManager` + `createServer` handle the new client message.

- [ ] **Step 1: Add the event callback + cooldown map + emit methods in `server/gameServer.ts`**

Add imports at top:

```typescript
import { Emoticon, EMOTICON_COOLDOWN_MS, isEmoticon } from '../src/types/emotion'
import { detectBotEmotions } from '../src/logic/emotions'
```

Add to the `GameServerEvents` interface (after `broadcastLobby`):

```typescript
  broadcastEmoticon(emotion: { playerId: number; emoticon: Emoticon }): void
```

Add a field next to the other private fields (e.g. after `private afkTimeoutMs: number`):

```typescript
  private lastEmotionAt = new Map<number, number>()
```

Add a public method (place it after `handleManualBotToggle`):

```typescript
  emitEmoticon(clientId: ClientId, emoticon: Emoticon): void {
    if (!isEmoticon(emoticon)) return
    if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.Rolling) return
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    if (index === -1) return
    if (!this.state.players[index]) return
    const now = Date.now()
    const last = this.lastEmotionAt.get(index) ?? 0
    if (now - last < EMOTICON_COOLDOWN_MS) return
    this.lastEmotionAt.set(index, now)
    this.events.broadcastEmoticon({ playerId: index, emoticon })
  }
```

Change `applyAction` (currently lines ~452-457) to capture the previous state and emit bot emotions:

```typescript
  private applyAction(action: GameAction): void {
    const prev = this.state
    this.state = gameReducer(this.state, action)
    this.emitBotEmotions(prev)
    this.broadcast()
    this.scheduleAutoSteps()
    this.driveBots()
  }

  private emitBotEmotions(prev: GameState): void {
    const now = Date.now()
    for (const em of detectBotEmotions(prev, this.state)) {
      const last = this.lastEmotionAt.get(em.playerId) ?? 0
      if (now - last < EMOTICON_COOLDOWN_MS) continue
      this.lastEmotionAt.set(em.playerId, now)
      this.events.broadcastEmoticon({ playerId: em.playerId, emoticon: em.emoticon })
    }
  }
```

- [ ] **Step 2: Wire the room broadcast in `server/roomManager.ts`**

In `create()`, inside the `GameServerEvents` object passed to `new GameServer(...)`, add after `broadcastLobby`:

```typescript
        broadcastEmoticon: (emotion) =>
          this.broadcastToRoom(code, {
            type: ServerMessageType.Emoticon,
            playerId: emotion.playerId,
            emoticon: emotion.emoticon,
          }),
```

- [ ] **Step 3: Handle the client message in `server/http.ts`**

Add an `else if` branch in the `ws.on('message')` chain (after the `ManualBotToggle` branch):

```typescript
        } else if (msg.type === ClientMessageType.Emoticon) {
          roomManager.gameFor(clientId)?.emitEmoticon(clientId, msg.emoticon)
        }
```

- [ ] **Step 4: Fix the existing server test setup helper**

In `server/__tests__/gameServer.test.ts`, inside the `setup()` helper's events object (next to `broadcastLobby`), add:

```typescript
      broadcastEmoticon: (em) => sent.push({ type: ServerMessageType.Emoticon, playerId: em.playerId, emoticon: em.emoticon }),
```

This keeps the existing test file compiling. Do not add new tests here.

- [ ] **Step 5: Write the failing server tests** — create `server/__tests__/emoticon.test.ts`

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { GameServer } from '../gameServer'
import { GamePhase, PendingActionType } from '../../src/types/game'
import { ServerMessageType } from '../../src/types/net'
import type { ServerMessage } from '../../src/types/net'
import { Emoticon } from '../../src/types/emotion'
import { createSeededState } from '../../src/logic/seed'

function setup(opts?: { seedEnabled?: boolean; rng?: () => number }) {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const sent: ServerMessage[] = []
  const server = new GameServer(
    {
      broadcastState: (state) => sent.push({ type: ServerMessageType.State, state }),
      broadcastLobby: (players, hostPlayerId) => sent.push({ type: ServerMessageType.Lobby, players, hostPlayerId }),
      broadcastEmoticon: (em) => sent.push({ type: ServerMessageType.Emoticon, playerId: em.playerId, emoticon: em.emoticon }),
      send: (_id, msg) => sent.push(msg),
    },
    opts,
  )
  return { server, sent }
}

function emoticonMessages(sent: ServerMessage[]) {
  return sent.filter((m): m is { type: string; playerId: number; emoticon: Emoticon } => m.type === ServerMessageType.Emoticon)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('GameServer emoticons', () => {
  it('broadcasts an emoticon from a joined player during the game', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.emitEmoticon('c0', Emoticon.Happy)
    expect(emoticonMessages(sent)).toEqual([{ type: ServerMessageType.Emoticon, playerId: 0, emoticon: Emoticon.Happy }])
  })

  it('enforces the 5s cooldown per player', () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.emitEmoticon('c0', Emoticon.Happy)
    vi.setSystemTime(14_999) // +4999ms
    server.emitEmoticon('c0', Emoticon.Angry)
    expect(emoticonMessages(sent)).toHaveLength(1)

    vi.setSystemTime(15_000) // +5000ms
    server.emitEmoticon('c0', Emoticon.Angry)
    expect(emoticonMessages(sent)).toHaveLength(2)
    vi.useRealTimers()
  })

  it('does not broadcast while dice are rolling (Rolling phase)', () => {
    vi.useFakeTimers()
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.roll('c0') // phase -> Rolling
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    server.emitEmoticon('c0', Emoticon.Happy)
    expect(emoticonMessages(sent)).toHaveLength(0)
    vi.useRealTimers()
  })

  it('does not broadcast before the game starts (Setup phase)', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.emitEmoticon('c0', Emoticon.Happy)
    expect(emoticonMessages(sent)).toHaveLength(0)
  })

  it('drops unknown emoticon values', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.emitEmoticon('c0', 'lol' as any)
    expect(emoticonMessages(sent)).toHaveLength(0)
  })

  it('emits sad from a bot that declares bankruptcy, respecting the cooldown', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { server, sent } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.addBot('c0') // slot 1 is the bot

    const bankruptcySeed = createSeededState({
      players: [
        { id: 0, name: 'Alice', money: 1000 },
        { id: 1, name: 'Droid', money: 0, isBot: true },
      ],
      currentPlayer: 1,
      turnOrder: [0, 1],
      phase: GamePhase.Resolving,
      pendingAction: { type: PendingActionType.Bankruptcy, amount: 1000, spaceId: 39 },
    })

    server.seedState(bankruptcySeed)
    vi.advanceTimersByTime(700) // bot declares bankruptcy
    expect(emoticonMessages(sent)).toEqual([{ type: ServerMessageType.Emoticon, playerId: 1, emoticon: Emoticon.Sad }])

    // Second bankruptcy inside the cooldown window must be suppressed.
    vi.advanceTimersByTime(100)
    server.seedState(bankruptcySeed)
    vi.advanceTimersByTime(700) // t=1500, still < 5000 after the first emit at t=700
    expect(emoticonMessages(sent)).toHaveLength(1)

    // After the cooldown elapses, a new event emits again.
    vi.advanceTimersByTime(5_000) // t=6500
    server.seedState(bankruptcySeed)
    vi.advanceTimersByTime(700) // t=7200
    expect(emoticonMessages(sent)).toHaveLength(2)
    vi.useRealTimers()
  })
})
```

Note: `createSeededState` requires a room with the given players; verify it accepts `isBot` on the player spec (it is forwarded into `Player`). If the bot's `money: 0` fails the seed's "money must be non-negative" check, it passes (0 is non-negative).

- [ ] **Step 6: Run the server tests**

Run: `npx vitest run server/__tests__/gameServer.test.ts server/__tests__/emoticon.test.ts`
Expected: FAIL — `GameServerEvents` has no `broadcastEmoticon` member / compile error at first, then test assertions fail until Task 3 implementation is complete.

- [ ] **Step 7: Complete implementation and verify all pass**

Run: `npx vitest run server/__tests__/gameServer.test.ts server/__tests__/emoticon.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/gameServer.ts server/roomManager.ts server/http.ts server/__tests__/gameServer.test.ts server/__tests__/emoticon.test.ts
git commit -m "feat: server-side emoticon emission with cooldown and bot triggers"
```

---
---

### Task 4: Client hook + net client

**Files:**
- Modify: `src/net/client.ts`
- Modify: `src/hooks/useNetworkGame.ts`
- Modify: `src/types/game.ts`
- Modify: `src/hooks/__tests__/useNetworkGame.test.ts`

**Interfaces:**
- Consumes: `Emoticon`, `ActiveEmotion`, `EMOTICON_LIFETIME_MS` from `../types/emotion`; `ServerMessageType`/`ClientMessageType`.
- Produces: `GameApi.activeEmotions: ActiveEmotion[]`, `GameApi.emitEmoticon(emoticon: Emoticon): void`, `GameClient.emitEmoticon(emoticon): void`. Consumed by Task 5/6 UI components.

- [ ] **Step 1: Add `emitEmoticon` to `src/net/client.ts`**

Add import at top: `import type { Emoticon } from '../types/emotion'`

Add a method to `GameClient` (next to `manualBotToggle`):

```typescript
  emitEmoticon(emoticon: Emoticon): void {
    this.send({ type: ClientMessageType.Emoticon, emoticon })
  }
```

- [ ] **Step 2: Add types to `src/types/game.ts`**

Add import at top: `import type { ActiveEmotion, Emoticon } from './emotion'`

Add to the `GameApi` type (e.g. after `state`, `myPlayerId`):

```typescript
  activeEmotions: ActiveEmotion[]
  emitEmoticon: (emoticon: Emoticon) => void
```

- [ ] **Step 3: Wire the hook in `src/hooks/useNetworkGame.ts`**

Add imports:

```typescript
import { Emoticon, EMOTICON_LIFETIME_MS } from '../types/emotion'
import type { ActiveEmotion } from '../types/emotion'
```

Add state + refs after the other `useState` declarations:

```typescript
  const [activeEmotions, setActiveEmotions] = useState<ActiveEmotion[]>([])
  const emotionIdRef = useRef(0)
  const emotionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
```

In the `onMessage` handler chain, add after the `State` branch:

```typescript
        } else if (message.type === ServerMessageType.Emoticon) {
          const id = emotionIdRef.current++
          const timer = setTimeout(() => {
            setActiveEmotions((prev) => prev.filter((e) => e.id !== id))
          }, EMOTICON_LIFETIME_MS)
          emotionTimersRef.current.push(timer)
          setActiveEmotions((prev) => [...prev, { id, playerId: message.playerId, emoticon: message.emoticon }])
        }
```

In the `useEffect` cleanup for the client (the existing `return () => client.close()`), clear the timers:

```typescript
    return () => {
      client.close()
      for (const timer of emotionTimersRef.current) clearTimeout(timer)
      emotionTimersRef.current = []
    }
```

Add the `emitEmoticon` callback (next to `manualBotToggle`):

```typescript
  const emitEmoticon = useCallback((emoticon: Emoticon) => send({ type: ClientMessageType.Emoticon, emoticon }), [send])
```

Add both to the returned object:

```typescript
    activeEmotions,
    emitEmoticon,
```

And add both to the `NetworkGameApi` type (it extends `GameApi`, so only `activeEmotions`/`emitEmoticon` are already covered by `GameApi` — no change needed to `NetworkGameApi`).

- [ ] **Step 4: Write the failing hook tests** — extend `src/hooks/__tests__/useNetworkGame.test.ts`

Add import: `import { Emoticon } from '../../types/emotion'`

Add tests inside the `describe`:

```typescript
  it('exposes emitEmoticon which sends an emoticon client message', () => {
    const onLeft = vi.fn()
    const { result } = renderHook(() => useNetworkGame(onLeft))
    act(() => result.current.emitEmoticon(Emoticon.Proud))
    expect(sendMock).toHaveBeenCalledWith({ type: 'emoticon', emoticon: 'proud' })
  })

  it('appends activeEmotions on an emoticon server message and removes it after the lifetime', () => {
    const onLeft = vi.fn()
    vi.useFakeTimers()
    const { result } = renderHook(() => useNetworkGame(onLeft))

    act(() => onMessageHandler?.({ type: 'emoticon', playerId: 0, emoticon: 'sad' }))
    expect(result.current.activeEmotions).toEqual([{ id: 0, playerId: 0, emoticon: 'sad' }])

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.activeEmotions).toEqual([])
    vi.useRealTimers()
  })

  it('keeps separate bubbles per emoticon message', () => {
    const onLeft = vi.fn()
    const { result } = renderHook(() => useNetworkGame(onLeft))
    act(() => onMessageHandler?.({ type: 'emoticon', playerId: 0, emoticon: 'sad' }))
    act(() => onMessageHandler?.({ type: 'emoticon', playerId: 1, emoticon: 'angry' }))
    expect(result.current.activeEmotions).toEqual([
      { id: 0, playerId: 0, emoticon: 'sad' },
      { id: 1, playerId: 1, emoticon: 'angry' },
    ])
  })
```

The existing test file's `onLeft` is defined per-test (`const onLeft = vi.fn()`); reuse that pattern.

- [ ] **Step 5: Run the hook tests**

Run: `npx vitest run src/hooks/__tests__/useNetworkGame.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full client typecheck to confirm `GameApi`/`GameClient` compile**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/net/client.ts src/types/game.ts src/hooks/useNetworkGame.ts src/hooks/__tests__/useNetworkGame.test.ts
git commit -m "feat: client hook for emoticon emit and active bubble state"
```

---
---

### Task 5: EmoticonBar UI + i18n

**Files:**
- Create: `src/components/EmoticonBar.tsx`
- Create: `src/components/__tests__/EmoticonBar.test.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/GameView.tsx`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `EMOTICON_LIST`, `EMOTICON_GLYPHS`, `EMOTICON_COOLDOWN_MS`, `Emoticon` from `../types/emotion`; `GamePhase` from `../types/game`.
- Produces: `<EmoticonBar disabled={boolean} onEmit={(emoticon: Emoticon) => void} />` and a new `Sidebar` prop `onEmitEmoticon: (emoticon: Emoticon) => void`.

- [ ] **Step 1: Write the failing component test** — create `src/components/__tests__/EmoticonBar.test.tsx`

```typescript
// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import EmoticonBar from '../EmoticonBar'
import { renderWithProviders } from '../../test/test-utils'
import { Emoticon } from '../../types/emotion'

afterEach(cleanup)

describe('EmoticonBar', () => {
  it('renders one button per emoticon with the right glyph', () => {
    renderWithProviders(<EmoticonBar onEmit={() => {}} />)
    expect(screen.getByTestId('emoticon-button-sad')).toHaveTextContent('😢')
    expect(screen.getByTestId('emoticon-button-happy')).toHaveTextContent('😂')
    expect(screen.getByTestId('emoticon-button-angry')).toHaveTextContent('😠')
    expect(screen.getByTestId('emoticon-button-proud')).toHaveTextContent('😎')
  })

  it('calls onEmit with the clicked emoticon', () => {
    const onEmit = vi.fn()
    renderWithProviders(<EmoticonBar onEmit={onEmit} />)
    fireEvent.click(screen.getByTestId('emoticon-button-proud'))
    expect(onEmit).toHaveBeenCalledWith(Emoticon.Proud)
  })

  it('disables all buttons when disabled is set', () => {
    renderWithProviders(<EmoticonBar disabled onEmit={() => {}} />)
    expect(screen.getByTestId('emoticon-button-sad')).toBeDisabled()
    expect(screen.getByTestId('emoticon-button-happy')).toBeDisabled()
  })

  it('applies a 5s cooldown after a click', () => {
    vi.useFakeTimers()
    const onEmit = vi.fn()
    renderWithProviders(<EmoticonBar onEmit={onEmit} />)

    fireEvent.click(screen.getByTestId('emoticon-button-angry'))
    expect(screen.getByTestId('emoticon-button-angry')).toBeDisabled()
    fireEvent.click(screen.getByTestId('emoticon-button-angry'))
    expect(onEmit).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4999)
    expect(screen.getByTestId('emoticon-button-angry')).toBeDisabled()

    vi.advanceTimersByTime(1)
    expect(screen.getByTestId('emoticon-button-angry')).toBeEnabled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/EmoticonBar.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `src/components/EmoticonBar.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOTICON_COOLDOWN_MS, EMOTICON_GLYPHS, EMOTICON_LIST, type Emoticon } from '../types/emotion'

interface Props {
  disabled?: boolean
  onEmit: (emoticon: Emoticon) => void
}

export default function EmoticonBar({ disabled = false, onEmit }: Props) {
  const { t } = useTranslation()
  const [cooldown, setCooldown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleClick(emoticon: Emoticon) {
    if (disabled || cooldown) return
    onEmit(emoticon)
    setCooldown(true)
    timerRef.current = setTimeout(() => setCooldown(false), EMOTICON_COOLDOWN_MS)
  }

  return (
    <div data-testid="emoticon-bar" className="flex items-center justify-center gap-1.5">
      {EMOTICON_LIST.map((em) => (
        <button
          key={em}
          type="button"
          data-testid={`emoticon-button-${em}`}
          title={t('emoticon.' + em)}
          aria-label={t('emoticon.' + em)}
          disabled={disabled || cooldown}
          onClick={() => handleClick(em)}
          className="w-8 h-8 rounded-lg text-lg leading-none flex items-center justify-center border border-border bg-bg-dark hover:opacity-90 disabled:opacity-40"
        >
          {EMOTICON_GLYPHS[em]}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add i18n keys**

In `src/i18n/locales/en/translation.json` (before the `"bot.toggleOn"` line):

```json
  "emoticon.sad": "Sad",
  "emoticon.happy": "Happy",
  "emoticon.angry": "Angry",
  "emoticon.proud": "Proud",
```

In `src/i18n/locales/id/translation.json` (before the `"bot.toggleOn"` line):

```json
  "emoticon.sad": "Sedih",
  "emoticon.happy": "Tertawa",
  "emoticon.angry": "Marah",
  "emoticon.proud": "Sombong",
```

- [ ] **Step 5: Wire into `src/components/Sidebar.tsx`**

Add import:

```typescript
import EmoticonBar from './EmoticonBar'
import { GamePhase } from '../types/game'
import type { Emoticon } from '../types/emotion'
```

Add to the `Props` interface: `onEmitEmoticon: (emoticon: Emoticon) => void`

Destructure `onEmitEmoticon` from props (in the function signature destructuring, after `onOpenTrades`).

Render the bar right after the `<DiceRoller ... />` line:

```tsx
        <EmoticonBar disabled={state.phase === GamePhase.Rolling} onEmit={onEmitEmoticon} />
```

- [ ] **Step 6: Pass the callback in `src/components/GameView.tsx`**

Add to the `<Sidebar ...>` element (next to `onToggleBot={handleToggleBot}`):

```tsx
          onEmitEmoticon={game.emitEmoticon}
```

- [ ] **Step 7: Run the component tests**

Run: `npx vitest run src/components/__tests__/EmoticonBar.test.tsx src/components/__tests__/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/EmoticonBar.tsx src/components/__tests__/EmoticonBar.test.tsx src/components/Sidebar.tsx src/components/GameView.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: emoticon quick buttons in the sidebar"
```

---
---

### Task 6: EmoticonOverlay floating bubbles

**Files:**
- Modify: `src/components/PlayerTokens.tsx`
- Create: `src/components/EmoticonOverlay.tsx`
- Create: `src/components/__tests__/EmoticonOverlay.test.tsx`
- Modify: `src/components/GameBoard.tsx`
- Modify: `src/components/GameView.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `ActiveEmotion` from `../types/emotion`, `GameState`, `PLAYER_OFFSETS` from `../data/players`, `POSITIONS` exported from `./PlayerTokens`, `game.activeEmotions` from `GameApi`.
- Produces: `<EmoticonOverlay state={GameState} emotions={ActiveEmotion[]} />`, a new `GameBoard` prop `emotions: ActiveEmotion[]`, and the `emoticon-pop` keyframe animation.

- [ ] **Step 1: Export `POSITIONS` from `src/components/PlayerTokens.tsx`**

Change `const POSITIONS` to `export const POSITIONS` and add the react-refresh disable comment directly above it (matching the existing pattern above `getPath`):

```typescript
// eslint-disable-next-line react-refresh/only-export-components
export const POSITIONS: Record<number, { x: number; y: number }> = {
```

- [ ] **Step 2: Write the failing overlay test** — create `src/components/__tests__/EmoticonOverlay.test.tsx`

```typescript
// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import EmoticonOverlay from '../EmoticonOverlay'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import type { ActiveEmotion } from '../../types/emotion'

function makeState(): GameState {
  return gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  })
}

afterEach(cleanup)

describe('EmoticonOverlay', () => {
  it('renders a bubble above the emitting player with the right glyph', () => {
    const emotions: ActiveEmotion[] = [{ id: 1, playerId: 0, emoticon: 'happy' }]
    const { container } = renderWithProviders(<EmoticonOverlay state={makeState()} emotions={emotions} />)
    const bubble = container.querySelector('[data-testid="emoticon-0-happy"]') as HTMLElement
    expect(bubble).not.toBeNull()
    expect(bubble.textContent).toBe('😂')
  })

  it('ignores emotions for unknown players', () => {
    const emotions: ActiveEmotion[] = [{ id: 1, playerId: 99, emoticon: 'sad' }]
    const { container } = renderWithProviders(<EmoticonOverlay state={makeState()} emotions={emotions} />)
    expect(container.querySelector('[data-testid="emoticon-99-sad"]')).toBeNull()
  })

  it('renders multiple bubbles for multiple emotions', () => {
    const emotions: ActiveEmotion[] = [
      { id: 1, playerId: 0, emoticon: 'sad' },
      { id: 2, playerId: 1, emoticon: 'angry' },
    ]
    const { container } = renderWithProviders(<EmoticonOverlay state={makeState()} emotions={emotions} />)
    expect(container.querySelector('[data-testid="emoticon-0-sad"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="emoticon-1-angry"]')).not.toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/EmoticonOverlay.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 4: Implement `src/components/EmoticonOverlay.tsx`**

```tsx
import { EMOTICON_GLYPHS, type ActiveEmotion } from '../types/emotion'
import type { GameState } from '../types/game'
import { PLAYER_OFFSETS } from '../data/players'
import { POSITIONS } from './PlayerTokens'

interface Props {
  state: GameState
  emotions: ActiveEmotion[]
}

export default function EmoticonOverlay({ state, emotions }: Props) {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {emotions.map((em) => {
        const player = state.players[em.playerId]
        if (!player) return null
        const pos = POSITIONS[player.position] ?? POSITIONS[0]
        const offset = PLAYER_OFFSETS[player.id] ?? PLAYER_OFFSETS[0]
        return (
          <div
            key={em.id}
            data-testid={`emoticon-${player.id}-${em.emoticon}`}
            className="absolute z-30 text-2xl animate-[emoticon-pop_3s_ease-out_forwards]"
            style={{
              left: `calc(${pos.x}% + ${offset.dx}px)`,
              top: `calc(${pos.y}% + ${offset.dy}px)`,
            }}
          >
            {EMOTICON_GLYPHS[em.emoticon]}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Add the `emoticon-pop` keyframes to `src/index.css`**

Append after the `hint-fade-in` keyframes block:

```css
@keyframes emoticon-pop {
  0% { opacity: 0; transform: translate(-50%, -100%) translateY(4px) scale(0.4); }
  15% { opacity: 1; transform: translate(-50%, -100%) translateY(-6px) scale(1.15); }
  30% { opacity: 1; transform: translate(-50%, -100%) translateY(-10px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -100%) translateY(-30px) scale(1); }
}
```

- [ ] **Step 6: Render the overlay in `src/components/GameBoard.tsx`**

Add `import EmoticonOverlay from './EmoticonOverlay'` and `import type { ActiveEmotion } from '../types/emotion'`.

Add `emotions: ActiveEmotion[]` to the `Props` interface and destructure it.

Render it after `<PlayerTokens state={state} />`:

```tsx
        <EmoticonOverlay state={state} emotions={emotions} />
```

- [ ] **Step 7: Thread `emotions` in `src/components/GameView.tsx`**

Add `emotions={game.activeEmotions}` to the `<GameBoard ...>` element.

- [ ] **Step 8: Run the component tests**

Run: `npx vitest run src/components/__tests__/EmoticonOverlay.test.tsx src/components/__tests__/PlayerTokens.test.tsx src/components/__tests__/GameBoard.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/PlayerTokens.tsx src/components/EmoticonOverlay.tsx src/components/__tests__/EmoticonOverlay.test.tsx src/components/GameBoard.tsx src/components/GameView.tsx src/index.css
git commit -m "feat: render floating emoticon bubbles above player tokens"
```

---
---

### Task 7: E2E spec

**Files:**
- Create: `e2e/fixtures/emoticon-seed.ts`
- Create: `e2e/emoticon.spec.ts`

**Interfaces:**
- Consumes: `buildWaitingState` from `./helpers/seed`, `seedGame`/`seedWaitingGame` from `./helpers/seed`, the `serverUrl` fixture from `./fixtures`.

- [ ] **Step 1: Create the seed fixture** — `e2e/fixtures/emoticon-seed.ts`

```typescript
import type { GameState } from '../../src/types/game'
import { GamePhase, PendingActionType } from '../../src/types/game'
import { buildWaitingState, type SeedWaitingPlayerSpec } from '../helpers/seed'

export interface ResolvingPayRentOptions {
  players: SeedWaitingPlayerSpec[]
  currentPlayer: number
  spaceId: number
  ownerId: number
  amount: number
  turnOrder?: number[]
}

export function buildResolvingPayRentState(opts: ResolvingPayRentOptions): GameState {
  const base = buildWaitingState({
    players: opts.players,
    currentPlayer: opts.currentPlayer,
    turnOrder: opts.turnOrder,
  })
  return {
    ...base,
    phase: GamePhase.Resolving,
    pendingAction: { type: PendingActionType.PayRent, spaceId: opts.spaceId, amount: opts.amount },
    board: base.board.map((s) => (s.id === opts.spaceId ? { ...s, owner: opts.ownerId } : s)),
  }
}
```

- [ ] **Step 2: Write the failing E2E spec** — `e2e/emoticon.spec.ts`

```typescript
import { test, expect } from './fixtures'
import { seedWaitingGame, seedGame } from './helpers/seed'
import { buildResolvingPayRentState } from './fixtures/emoticon-seed'

function addLanguageScript(context: import('@playwright/test').BrowserContext) {
  return context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
}

async function twoPlayerLobby(browser: import('@playwright/test').Browser, serverUrl: string) {
  const context = await browser.newContext()
  await addLanguageScript(context)
  const pageA = await context.newPage()
  const pageB = await context.newPage()

  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  return { context, pageA, pageB, code }
}

test('an emitted emoticon floats above the sender token and is visible to the other player', async ({ browser, serverUrl }) => {
  const { pageA, pageB, code } = await twoPlayerLobby(browser, serverUrl)

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await pageA.click('[data-testid="emoticon-button-happy"]')
  await expect(pageB.locator('[data-testid="emoticon-0-happy"]')).toBeVisible({ timeout: 2000 })
  await expect(pageA.locator('[data-testid="emoticon-0-happy"]')).toBeVisible({ timeout: 2000 })
})

test('emoticon buttons apply a 5s cooldown after emitting', async ({ browser, serverUrl }) => {
  const { pageA, code } = await twoPlayerLobby(browser, serverUrl)

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  const happy = pageA.locator('[data-testid="emoticon-button-happy"]')
  await expect(happy).toBeEnabled()
  await happy.click()
  await expect(happy).toBeDisabled()
  await expect(happy).toBeEnabled({ timeout: 6000 })
})

test('a bot auto-emits angry after paying expensive rent', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await addLanguageScript(context)
  const page = await context.newPage()

  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await page.click('button:has-text("Add Bot")')
  await page.click('button:has-text("Add Bot")') // Host + Droid (slot 1) + Byte (slot 2)
  await expect(page.locator('text=Droid')).toBeVisible()

  // Bot (slot 2, "Byte") must pay $500 rent to the host (slot 0) — expensive rent → angry.
  const state = buildResolvingPayRentState({
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
      { id: 2, name: 'Byte', money: 1500, isBot: true },
    ],
    currentPlayer: 2,
    spaceId: 39,
    ownerId: 0,
    amount: 500,
    turnOrder: [0, 1, 2],
  })
  await seedGame(serverUrl, code, state)

  await expect(page.locator('[data-testid="emoticon-2-angry"]')).toBeVisible({ timeout: 3000 })
})
```

Note: `BOT_NAMES` (`src/data/bots.ts`) is `['Droid', 'Byte', 'Nova', 'Pixel', 'Robo', 'Mecha']` — the first `Add Bot` fills slot 1 ("Droid"), the second fills slot 2 ("Byte"). The `seedWaitingGame`/`seedGame` path validates player names against joined slots, so keep these exact names.

- [ ] **Step 3: Build and run the E2E spec**

Run:
```bash
npm run build
npx playwright test e2e/emoticon.spec.ts
```
Expected: FAIL initially (until Task 6 UI is present), then PASS once all prior tasks are complete. If the bot-name assumption in the third test fails, correct the names against `src/data/bots.ts`.

- [ ] **Step 4: Run the full E2E suite to confirm no regressions**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/emoticon-seed.ts e2e/emoticon.spec.ts
git commit -m "test: e2e coverage for emoticon emission, visibility, cooldown, and bot emission"
```

---
---

## Self-Review Checklist

- **Spec coverage:** emoticon set + glyphs (Task 1) ✓; quick buttons only (Task 5) ✓; floating above token, all players (Task 6) ✓; any phase except dice rolling (Task 3 gate) ✓; 5s per-player cooldown for humans + bots (Tasks 3) ✓; no persistence, in-memory (side-channel, never in GameState/event log) ✓; no event log (never touched) ✓; bot triggers (Task 2/3) ✓; unit tests cooldown/buttons (Tasks 3/5) ✓; E2E emission + visibility (Task 7) ✓; bots & AFK same cooldown (Task 3 `emitBotEmotions` uses the same `lastEmotionAt` map + `detectBotEmotions` includes `botControlled`) ✓.
- **Placeholder scan:** no TBD/TODO; every code step has full content.
- **Type consistency:** `Emoticon` union `'sad'|'happy'|'angry'|'proud'`; `ActiveEmotion {id,playerId,emoticon}`; `BotEmotion {playerId,emoticon}`; `broadcastEmoticon({playerId,emoticon})`; `emitEmoticon(clientId,emoticon)` — consistent across Tasks 1-7.
