# LAN / Internet Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authoritative Node.js WebSocket server so friends can play Monopoly from their own laptops over LAN (or the internet via ngrok), while keeping the existing single-device hot-seat mode untouched.

**Architecture:** A single-port Node server (`ws` + `node:http`) holds the authoritative `GameState`, reuses the existing pure `gameReducer` for all logic, generates all randomness server-side, and serves the built `dist/` so one URL loads both app and socket. The React client becomes a thin view that renders server-broadcast state and sends discrete actions for the current player only.

**Tech Stack:** React 19 + TypeScript + Vite 8 (client), Node.js + `ws` + `tsx` (server), Vitest (unit), Playwright (e2e).

## Global Constraints

- TypeScript `verbatimModuleSyntax` is ON: type-only imports MUST use `import type { ... }`.
- `erasableSyntaxOnly` is ON: no enums, no namespaces, no parameter properties.
- `noUnusedLocals` / `noUnusedParameters` are ON: no unused variables.
- UI copy is Indonesian; currency formatted via `formatMoney` (rupiah).
- Server code must not import any DOM/browser module; it only imports `src/types`, `src/logic`, `src/data`, `src/utils`.
- All randomness (dice rolls, deck shuffling) happens on the server; the client never generates dice in multiplayer.
- Tests: unit tests use Vitest (jsdom via `// @vitest-environment jsdom` comment where DOM is needed). Verify with `npm run typecheck`, `npm run lint`, `npm run test:unit`.
- Existing local mode behavior (reducer, localStorage, timers) must remain functionally identical.

---

### Task 1: Shared player colors and 6-player token offsets

**Files:**
- Create: `src/data/players.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/GameBoard.tsx`
- Modify: `src/components/PlayerTokens.tsx`
- Test: `src/data/__tests__/players.test.ts`

**Interfaces:**
- Produces: `PLAYER_COLORS: string[]` (length 6) and `PLAYER_OFFSETS: Record<number, { dx: number; dy: number }>` (keys 0–5) from `src/data/players.ts`. Later tasks import these.

- [ ] **Step 1: Write the failing test**

Create `src/data/__tests__/players.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PLAYER_COLORS, PLAYER_OFFSETS } from '../players'

describe('players', () => {
  it('defines 6 distinct colors', () => {
    expect(PLAYER_COLORS).toHaveLength(6)
    expect(new Set(PLAYER_COLORS).size).toBe(6)
  })

  it('defines token offsets for player ids 0 through 5', () => {
    for (let i = 0; i < 6; i++) {
      expect(PLAYER_OFFSETS[i]).toBeDefined()
      expect(typeof PLAYER_OFFSETS[i].dx).toBe('number')
      expect(typeof PLAYER_OFFSETS[i].dy).toBe('number')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/__tests__/players.test.ts`
Expected: FAIL — cannot resolve `../players`.

- [ ] **Step 3: Write the implementation**

Create `src/data/players.ts`:

```ts
export const PLAYER_COLORS = [
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#F39C12',
  '#9B59B6',
  '#E67E22',
]

export const PLAYER_OFFSETS: Record<number, { dx: number; dy: number }> = {
  0: { dx: -8, dy: -8 },
  1: { dx: 8, dy: -8 },
  2: { dx: -8, dy: 8 },
  3: { dx: 8, dy: 8 },
  4: { dx: 0, dy: -8 },
  5: { dx: 0, dy: 8 },
}
```

- [ ] **Step 4: Wire the consumers**

In `src/components/Sidebar.tsx`, delete the local `PLAYER_COLORS` constant (line 23) and import it:

```ts
import { PLAYER_COLORS } from '../data/players'
```

In `src/components/GameBoard.tsx`, replace both inline `playerColors={['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']}` arrays (lines 22 and 29) with the imported constant; add the import:

```ts
import { PLAYER_COLORS } from '../data/players'
```

In `src/components/PlayerTokens.tsx`, delete the local `OFFSETS` object (lines 31–34), import `PLAYER_OFFSETS`, and update the reference (line 95):

```ts
import { PLAYER_OFFSETS } from '../data/players'
// ...
const offset = PLAYER_OFFSETS[player.id] ?? PLAYER_OFFSETS[0]
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/data/__tests__/players.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/players.ts src/data/__tests__/players.test.ts src/components/Sidebar.tsx src/components/GameBoard.tsx src/components/PlayerTokens.tsx
git commit -m "feat: shared player colors and 6-player token offsets"
```

---

### Task 2: Shared network types and the GameApi interface

**Files:**
- Create: `src/types/net.ts`
- Modify: `src/types/game.ts`
- Test: none (types only; typecheck validates)

**Interfaces:**
- Produces: `ClientMessage`, `ServerMessage`, `LobbyPlayer`, `ConnectionStatus` (from `src/types/net.ts`) and `GameApi` (from `src/types/game.ts`). All later tasks import these.

- [ ] **Step 1: Add the network protocol types**

Create `src/types/net.ts`:

```ts
import type { GameState, GameAction } from './game'

export type LobbyPlayer = { id: number; name: string | null; connected: boolean }

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'start' }
  | { type: 'action'; action: GameAction }

export type ServerMessage =
  | { type: 'welcome'; playerId: number; players: LobbyPlayer[]; state: GameState }
  | { type: 'lobby'; players: LobbyPlayer[] }
  | { type: 'state'; state: GameState }
  | { type: 'error'; message: string }
```

- [ ] **Step 2: Add the GameApi interface**

In `src/types/game.ts`, append at the end of the file:

```ts
export type GameApi = {
  state: GameState;
  roll: () => void;
  buyProperty: () => void;
  declineBuy: () => void;
  payRent: () => void;
  buildHouse: (spaceId: number) => void;
  sellHouse: (spaceId: number) => void;
  mortgage: (spaceId: number) => void;
  unmortgage: (spaceId: number) => void;
  sellProperty: (spaceId: number) => void;
  proposeTrade: (offer: TradeOffer) => void;
  drawCard: () => void;
  resolveCard: () => void;
  endTurn: () => void;
  declareBankruptcy: () => void;
  skipAction: () => void;
  payJailFine: () => void;
  useGetOutOfJailFree: () => void;
  resetGame: () => void;
};
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (the new types are additive; nothing references them yet).

- [ ] **Step 4: Commit**

```bash
git add src/types/net.ts src/types/game.ts
git commit -m "feat: add network protocol types and GameApi interface"
```

---

### Task 3: Authoritative GameServer class

**Files:**
- Create: `server/gameServer.ts`
- Create: `server/__tests__/gameServer.test.ts`
- Create: `tsconfig.server.json`
- Modify: `tsconfig.json`
- Modify: `package.json` (deps only — `ws`, `@types/ws`, `tsx`)
- Test: `server/__tests__/gameServer.test.ts`

**Interfaces:**
- Consumes: `gameReducer`, `createInitialState` (from `src/logic/gameReducer`); `GamePhase`, `GameAction`, `GameState` (from `src/types/game`); `LobbyPlayer` (from `src/types/net`).
- Produces: `GameServer` class (from `server/gameServer.ts`) with methods `join(clientId, name)`, `start(clientId)`, `roll(clientId)`, `handleAction(clientId, action)`, `disconnect(clientId)`, `getState()`, `getPlayers()`, and constructor `(events, opts?)` where `events = { broadcastState, broadcastLobby, send }` and `opts = { rng?: () => number }`.

- [ ] **Step 1: Add dependencies**

Run:

```bash
npm install ws
npm install -D @types/ws tsx
```

- [ ] **Step 2: Add the server tsconfig**

Create `tsconfig.server.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.server.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["server", "src/types", "src/logic", "src/data", "src/utils"],
  "exclude": ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"]
}
```

In `tsconfig.json`, add the reference:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.server.json" }
  ]
}
```

- [ ] **Step 3: Write the failing tests**

Create `server/__tests__/gameServer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameServer } from '../gameServer'
import { GamePhase } from '../../src/types/game'
import type { ServerMessage } from '../../src/types/net'

function setup(rng?: () => number) {
  const sent: ServerMessage[] = []
  const server = new GameServer(
    {
      broadcastState: () => {},
      broadcastLobby: () => {},
      send: (_id, msg) => sent.push(msg),
    },
    rng ? { rng } : undefined,
  )
  return { server, sent }
}

describe('GameServer', () => {
  afterEach(() => vi.useRealTimers())

  it('assigns slot 0 to the first joiner and slot 1 to the second', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    expect(sent.find((m) => m.type === 'welcome' && m.playerId === 0)).toBeDefined()
    expect(sent.find((m) => m.type === 'welcome' && m.playerId === 1)).toBeDefined()
    expect(server.getPlayers().filter((p) => p.name)).toHaveLength(2)
  })

  it('rejects a duplicate active name', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Alice')
    expect(sent.some((m) => m.type === 'error' && m.message === 'Nama sudah dipakai')).toBe(true)
  })

  it('rejects joining when the room is full', () => {
    const { server, sent } = setup()
    for (let i = 0; i < 6; i++) server.join(`c${i}`, `P${i}`)
    server.join('c6', 'Extra')
    expect(sent.some((m) => m.type === 'error' && m.message === 'Kamar penuh (maks 6 pemain)')).toBe(true)
  })

  it('only the host (slot 0) can start the game', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c1')
    expect(server.getState().phase).toBe(GamePhase.Setup)
    server.start('c0')
    expect(server.getState().phase).toBe(GamePhase.Waiting)
    expect(server.getState().players.map((p) => p.name)).toEqual(['Alice', 'Bob'])
  })

  it('rejects out-of-turn actions', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    // It is player 0's turn; player 1 tries to roll.
    server.handleAction('c1', { type: 'ROLL_DICE' })
    expect(server.getState().phase).toBe(GamePhase.Waiting)
  })

  it('rolls authoritative dice and advances the turn flow', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1, 4], sum 5
    const { server } = setup(rng)
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0')
    expect(server.getState().phase).toBe(GamePhase.Rolling)

    vi.advanceTimersByTime(500)
    expect(server.getState().dice).toEqual([1, 4])
    expect(server.getState().players[0].position).toBe(5)

    vi.advanceTimersByTime(500 + 5 * 150)
    // Landed on railroad (space 5), unowned, not yet passed Go → back to waiting.
    expect(server.getState().phase).toBe(GamePhase.Waiting)
  })

  it('reclaims a disconnected slot on rejoin with the same name', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.disconnect('c1')
    server.join('c2', 'Bob')
    expect(server.getPlayers().find((p) => p.id === 1)?.connected).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: FAIL — cannot resolve `../gameServer`.

- [ ] **Step 5: Write the implementation**

Create `server/gameServer.ts`:

```ts
import { gameReducer, createInitialState } from '../src/logic/gameReducer'
import { GamePhase, type GameState, type GameAction } from '../src/types/game'
import type { LobbyPlayer, ServerMessage } from '../src/types/net'

export type ClientId = string

export interface GameServerEvents {
  broadcastState(state: GameState): void
  broadcastLobby(players: LobbyPlayer[]): void
  send(clientId: ClientId, message: ServerMessage): void
}

interface Slot {
  clientId: ClientId | null
  name: string | null
  connected: boolean
}

const MAX_PLAYERS = 6

export class GameServer {
  private state: GameState = createInitialState()
  private slots: Slot[] = Array.from({ length: MAX_PLAYERS }, () => ({
    clientId: null,
    name: null,
    connected: false,
  }))
  private events: GameServerEvents
  private rng: () => number

  constructor(events: GameServerEvents, opts?: { rng?: () => number }) {
    this.events = events
    this.rng = opts?.rng ?? Math.random
  }

  getState(): GameState {
    return this.state
  }

  getPlayers(): LobbyPlayer[] {
    return this.slots.map((s, i) => ({ id: i, name: s.name, connected: s.connected }))
  }

  join(clientId: ClientId, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) {
      this.events.send(clientId, { type: 'error', message: 'Nama tidak boleh kosong' })
      return
    }

    const disconnected = this.slots.find((s) => s.name === trimmed && !s.connected)
    if (disconnected) {
      disconnected.clientId = clientId
      disconnected.connected = true
      this.events.send(clientId, {
        type: 'welcome',
        playerId: this.slots.indexOf(disconnected),
        players: this.getPlayers(),
        state: this.state,
      })
      this.broadcast()
      return
    }

    if (this.slots.some((s) => s.name === trimmed && s.connected)) {
      this.events.send(clientId, { type: 'error', message: 'Nama sudah dipakai' })
      return
    }

    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: 'error', message: 'Permainan sudah dimulai' })
      return
    }

    const index = this.slots.findIndex((s) => s.clientId === null)
    if (index === -1) {
      this.events.send(clientId, { type: 'error', message: 'Kamar penuh (maks 6 pemain)' })
      return
    }

    this.slots[index] = { clientId, name: trimmed, connected: true }
    this.events.send(clientId, {
      type: 'welcome',
      playerId: index,
      players: this.getPlayers(),
      state: this.state,
    })
    this.broadcast()
  }

  start(clientId: ClientId): void {
    const slot = this.slots.find((s) => s.clientId === clientId)
    if (!slot || this.slots.indexOf(slot) !== 0) {
      this.events.send(clientId, { type: 'error', message: 'Hanya host yang bisa memulai' })
      return
    }
    if (this.state.phase !== GamePhase.Setup) return

    const joined = this.slots.filter((s) => s.clientId !== null)
    if (joined.length < 2) {
      this.events.send(clientId, { type: 'error', message: 'Butuh minimal 2 pemain' })
      return
    }

    this.dispatch({
      type: 'START_GAME',
      playerCount: joined.length,
      names: joined.map((s) => s.name ?? `Pemain`),
    })
  }

  roll(clientId: ClientId): void {
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: 'error', message: 'Bukan giliranmu' })
      return
    }
    if (this.state.phase !== GamePhase.Waiting || this.state.pendingAction || this.state.dice !== null) {
      this.events.send(clientId, { type: 'error', message: 'Belum bisa melempar dadu' })
      return
    }

    this.dispatch({ type: 'ROLL_DICE' })
    const d1 = 1 + Math.floor(this.rng() * 6)
    const d2 = 1 + Math.floor(this.rng() * 6)
    const animDuration = 500 + (d1 + d2) * 150

    setTimeout(() => {
      this.dispatch({ type: 'DICE_ANIMATED', dice: [d1, d2] })
      setTimeout(() => this.dispatch({ type: 'RESOLVE_SPACE' }), animDuration)
    }, 500)
  }

  handleAction(clientId: ClientId, action: GameAction): void {
    if (action.type === 'ROLL_DICE') {
      this.roll(clientId)
      return
    }
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: 'error', message: 'Bukan giliranmu' })
      return
    }
    this.dispatch(action)
  }

  disconnect(clientId: ClientId): void {
    const slot = this.slots.find((s) => s.clientId === clientId)
    if (slot) slot.connected = false
    this.broadcast()
  }

  private isTurn(clientId: ClientId): boolean {
    if (this.state.phase === GamePhase.Setup) return false
    const index = this.slots.findIndex((s) => s.clientId === clientId)
    return index !== -1 && index === this.state.currentPlayer
  }

  private dispatch(action: GameAction): void {
    this.state = gameReducer(this.state, action)
    this.broadcast()
    this.scheduleAutoSteps()
  }

  private scheduleAutoSteps(): void {
    const s = this.state
    if (s.phase === GamePhase.Resolving && !s.pendingAction) {
      setTimeout(() => {
        if (this.state.phase === GamePhase.Resolving && !this.state.pendingAction) {
          this.dispatch({ type: 'RESOLVE_SPACE' })
        }
      }, 200)
    } else if (s.pendingAction?.type === 'drawCard') {
      setTimeout(() => {
        if (this.state.pendingAction?.type === 'drawCard') {
          this.dispatch({ type: 'DRAW_CARD' })
        }
      }, 300)
    }
  }

  private broadcast(): void {
    this.events.broadcastState(this.state)
    this.events.broadcastLobby(this.getPlayers())
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/gameServer.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts tsconfig.server.json tsconfig.json package.json package-lock.json
git commit -m "feat: authoritative GameServer with turn enforcement and server-side dice"
```

---

### Task 4: HTTP + WebSocket server entry point

**Files:**
- Create: `server/http.ts`
- Create: `server/main.ts`
- Create: `server/__tests__/http.test.ts`
- Modify: `package.json` (add `server` script)
- Test: `server/__tests__/http.test.ts`

**Interfaces:**
- Consumes: `GameServer` (Task 3), `ClientMessage`/`ServerMessage` (Task 2).
- Produces: `createServer(port?, distDir?)` from `server/http.ts` returning `{ httpServer, wss, game }`. `server/main.ts` is the runnable entry (`npm run server`).

- [ ] **Step 1: Add the server script**

In `package.json`, add to `scripts`:

```json
"server": "tsx server/main.ts"
```

- [ ] **Step 2: Write the failing test**

Create `server/__tests__/http.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { createServer } from '../http'
import type { ServerMessage } from '../../src/types/net'

let httpServer: ReturnType<typeof createServer>['httpServer']
let port: number
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'monopoly-'))
  const created = createServer(dir)
  httpServer = created.httpServer
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  port = (httpServer.address() as AddressInfo).port
})

afterAll(() => {
  httpServer.close()
})

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function nextMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => {
    ws.on('message', (raw) => resolve(JSON.parse(raw.toString()) as ServerMessage))
  })
}

describe('http server', () => {
  it('welcomes a joining client with playerId 0', async () => {
    const ws = await connect()
    const welcome = nextMessage(ws)
    ws.send(JSON.stringify({ type: 'join', name: 'Alice' }))
    const msg = await welcome
    expect(msg.type).toBe('welcome')
    if (msg.type === 'welcome') expect(msg.playerId).toBe(0)
    ws.close()
  })

  it('broadcasts lobby updates to all clients', async () => {
    const a = await connect()
    a.on('message', () => {})
    a.send(JSON.stringify({ type: 'join', name: 'Alice' }))
    await new Promise((r) => setTimeout(r, 50))

    const b = await connect()
    const lobby = new Promise<ServerMessage>((resolve) => {
      a.once('message', (raw) => resolve(JSON.parse(raw.toString()) as ServerMessage))
    })
    b.send(JSON.stringify({ type: 'join', name: 'Bob' }))
    const msg = await lobby
    expect(msg.type).toBe('lobby')
    if (msg.type === 'lobby') expect(msg.players.filter((p) => p.name)).toHaveLength(2)
    a.close()
    b.close()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/http.test.ts`
Expected: FAIL — cannot resolve `../http`.

- [ ] **Step 4: Write the implementation**

Create `server/http.ts`:

```ts
import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve } from 'node:path'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { GameServer } from './gameServer'
import type { ClientMessage, ServerMessage } from '../src/types/net'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

export function createServer(distDir = 'dist') {
  const sockets = new Map<string, WebSocket>()
  let nextId = 1

  function broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg)
    for (const ws of sockets.values()) ws.send(data)
  }

  const game = new GameServer({
    broadcastState: (state) => broadcast({ type: 'state', state }),
    broadcastLobby: (players) => broadcast({ type: 'lobby', players }),
    send: (clientId, msg) => sockets.get(clientId)?.send(JSON.stringify(msg)),
  })

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const relative = url.pathname === '/' ? 'index.html' : url.pathname
    const filePath = join(distDir, relative)
    if (!filePath.startsWith(resolve(distDir))) {
      res.writeHead(403)
      res.end()
      return
    }
    try {
      const data = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      try {
        const index = await readFile(join(distDir, 'index.html'))
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(index)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    }
  })

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (ws) => {
    const clientId = String(nextId++)
    sockets.set(clientId, ws)
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage
        if (msg.type === 'join') game.join(clientId, msg.name)
        else if (msg.type === 'start') game.start(clientId)
        else if (msg.type === 'action') game.handleAction(clientId, msg.action)
      } catch {
        // ignore malformed messages
      }
    })
    ws.on('close', () => {
      sockets.delete(clientId)
      game.disconnect(clientId)
    })
  })

  return { httpServer, wss, game }
}
```

Create `server/main.ts`:

```ts
import { createServer } from './http'

const port = Number(process.env.PORT ?? 3001)
const distDir = process.env.DIST_DIR ?? 'dist'
const { httpServer } = createServer(distDir)
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Monopoli server aktif di http://0.0.0.0:${port}`)
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/http.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/http.ts server/main.ts server/__tests__/http.test.ts package.json
git commit -m "feat: HTTP + WebSocket server entry point"
```

---

### Task 5: WebSocket client wrapper and useNetworkGame hook

**Files:**
- Create: `src/net/client.ts`
- Create: `src/net/__tests__/client.test.ts`
- Create: `src/hooks/useNetworkGame.ts`
- Test: `src/net/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `ClientMessage`, `ServerMessage`, `ConnectionStatus` (Task 2), `GameApi`, `GameAction`, `TradeOffer` (Task 2 / existing).
- Produces: `GameClient` class (from `src/net/client.ts`) with `connect()`, `send(msg)`, `close()`, constructor `(handlers, opts?)`; and `useNetworkGame()` (from `src/hooks/useNetworkGame.ts`) returning `GameApi & { playerId, lobby, status, join, start }`.

- [ ] **Step 1: Write the failing test**

Create `src/net/__tests__/client.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { GameClient } from '../client'
import type { ServerMessage } from '../../types/net'

class FakeWebSocket {
  sent: string[] = []
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(_url: string) {}
  send(data: string) {
    this.sent.push(data)
  }
  close() {}
  emitMessage(obj: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
}

function setup() {
  let instance: FakeWebSocket | null = null
  const received: ServerMessage[] = []
  const client = new GameClient(
    { onMessage: (m) => received.push(m) },
    { WebSocketImpl: class extends FakeWebSocket { constructor(url: string) { super(url); instance = this } } },
  )
  return { client, received, getInstance: () => instance }
}

describe('GameClient', () => {
  it('buffers messages until open and flushes after', () => {
    const { client, getInstance } = setup()
    // readyState CONNECTING → messages queued
    const ws = getInstance()!
    ws.readyState = 0
    client.connect()
    client.send({ type: 'join', name: 'Alice' })
    expect(ws.sent).toHaveLength(0)
    ws.readyState = 1
    ws.onopen?.()
    expect(ws.sent).toHaveLength(1)
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'join', name: 'Alice' })
  })

  it('parses and forwards server messages', () => {
    const { client, received, getInstance } = setup()
    client.connect()
    getInstance()!.emitMessage({ type: 'error', message: 'boom' })
    expect(received).toEqual([{ type: 'error', message: 'boom' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/client.test.ts`
Expected: FAIL — cannot resolve `../client`.

- [ ] **Step 3: Write the GameClient implementation**

Create `src/net/client.ts`:

```ts
import type { ClientMessage, ServerMessage } from '../types/net'

export interface ClientHandlers {
  onMessage: (message: ServerMessage) => void
  onOpen?: () => void
  onClose?: () => void
}

export class GameClient {
  private ws: WebSocket | null = null
  private queue: string[] = []

  constructor(
    private handlers: ClientHandlers,
    private opts: { wsUrl?: string; WebSocketImpl?: typeof WebSocket } = {},
  ) {}

  connect(): void {
    const url =
      this.opts.wsUrl ??
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    const WS = this.opts.WebSocketImpl ?? WebSocket
    this.ws = new WS(url)
    this.ws.onopen = () => {
      this.handlers.onOpen?.()
      this.flush()
    }
    this.ws.onmessage = (event) => {
      try {
        this.handlers.onMessage(JSON.parse(event.data as string) as ServerMessage)
      } catch {
        // ignore malformed
      }
    }
    this.ws.onclose = () => this.handlers.onClose?.()
    this.ws.onerror = () => this.handlers.onClose?.()
  }

  send(message: ClientMessage): void {
    const data = JSON.stringify(message)
    if (this.ws?.readyState === 1) this.ws.send(data)
    else this.queue.push(data)
  }

  close(): void {
    this.ws?.close()
  }

  private flush(): void {
    const queued = this.queue
    this.queue = []
    for (const message of queued) this.ws?.send(message)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/net/__tests__/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the useNetworkGame hook**

Create `src/hooks/useNetworkGame.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState } from '../logic/gameReducer'
import { GameClient } from '../net/client'
import type { GameApi, GameAction, GameState, TradeOffer } from '../types/game'
import type { ConnectionStatus, LobbyPlayer } from '../types/net'

export type NetworkGameApi = GameApi & {
  playerId: number | null
  lobby: LobbyPlayer[]
  status: ConnectionStatus
  join: (name: string) => void
  start: () => void
}

export function useNetworkGame(): NetworkGameApi {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [lobby, setLobby] = useState<LobbyPlayer[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const clientRef = useRef<GameClient | null>(null)

  useEffect(() => {
    const client = new GameClient({
      onOpen: () => setStatus('connected'),
      onClose: () => setStatus('disconnected'),
      onMessage: (message) => {
        if (message.type === 'welcome') {
          setPlayerId(message.playerId)
          setLobby(message.players)
          setState(message.state)
          setStatus('connected')
        } else if (message.type === 'lobby') {
          setLobby(message.players)
        } else if (message.type === 'state') {
          setState(message.state)
        }
      },
    })
    client.connect()
    clientRef.current = client
    return () => client.close()
  }, [])

  const send = useCallback((message: Parameters<GameClient['send']>[0]) => {
    clientRef.current?.send(message)
  }, [])

  const sendAction = useCallback(
    (action: GameAction) => send({ type: 'action', action }),
    [send],
  )

  const join = useCallback((name: string) => send({ type: 'join', name }), [send])
  const start = useCallback(() => send({ type: 'start' }), [send])

  const roll = useCallback(() => sendAction({ type: 'ROLL_DICE' }), [sendAction])
  const buyProperty = useCallback(() => sendAction({ type: 'BUY_PROPERTY' }), [sendAction])
  const declineBuy = useCallback(() => sendAction({ type: 'DECLINE_BUY' }), [sendAction])
  const payRent = useCallback(() => sendAction({ type: 'PAY_RENT' }), [sendAction])
  const buildHouse = useCallback((spaceId: number) => sendAction({ type: 'BUILD_HOUSE', spaceId }), [sendAction])
  const sellHouse = useCallback((spaceId: number) => sendAction({ type: 'SELL_HOUSE', spaceId }), [sendAction])
  const mortgage = useCallback((spaceId: number) => sendAction({ type: 'MORTGAGE', spaceId }), [sendAction])
  const unmortgage = useCallback((spaceId: number) => sendAction({ type: 'UNMORTGAGE', spaceId }), [sendAction])
  const sellProperty = useCallback((spaceId: number) => sendAction({ type: 'SELL_PROPERTY', spaceId }), [sendAction])
  const proposeTrade = useCallback((offer: TradeOffer) => sendAction({ type: 'PROPOSE_TRADE', offer }), [sendAction])
  const drawCard = useCallback(() => sendAction({ type: 'DRAW_CARD' }), [sendAction])
  const resolveCard = useCallback(() => sendAction({ type: 'RESOLVE_CARD' }), [sendAction])
  const endTurn = useCallback(() => sendAction({ type: 'END_TURN' }), [sendAction])
  const declareBankruptcy = useCallback(() => sendAction({ type: 'DECLARE_BANKRUPTCY' }), [sendAction])
  const skipAction = useCallback(() => sendAction({ type: 'SKIP_ACTION' }), [sendAction])
  const payJailFine = useCallback(() => sendAction({ type: 'PAY_JAIL_FINE' }), [sendAction])
  const useGetOutOfJailFree = useCallback(() => sendAction({ type: 'USE_GET_OUT_OF_JAIL_FREE' }), [sendAction])
  const resetGame = useCallback(() => window.location.reload(), [])

  return {
    state,
    playerId,
    lobby,
    status,
    join,
    start,
    roll,
    buyProperty,
    declineBuy,
    payRent,
    buildHouse,
    sellHouse,
    mortgage,
    unmortgage,
    sellProperty,
    proposeTrade,
    drawCard,
    resolveCard,
    endTurn,
    declareBankruptcy,
    skipAction,
    payJailFine,
    useGetOutOfJailFree,
    resetGame,
  }
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/net/client.ts src/net/__tests__/client.test.ts src/hooks/useNetworkGame.ts
git commit -m "feat: WebSocket client and useNetworkGame hook"
```

---

### Task 6: Extract GameView and move local roll orchestration into useGame

**Files:**
- Modify: `src/hooks/useGame.ts`
- Create: `src/components/GameView.tsx`
- Modify: `src/App.tsx` (temporary: point local flow at GameView; final wiring in Task 8)

**Interfaces:**
- Consumes: `GameApi` (Task 2).
- Produces: `useGame()` returning `GameApi & { startGame, dispatch }` with a new `roll()` method and internal auto-step effects; `GameView` component taking `{ game: GameApi }`.

- [ ] **Step 1: Refactor useGame**

Replace `src/hooks/useGame.ts` with:

```ts
import { useReducer, useCallback, useEffect, useRef } from 'react'
import { GamePhase, PendingActionType, type GameAction, type TradeOffer } from '../types/game'
import { gameReducer, createInitialState } from '../logic/gameReducer'

const STORAGE_KEY = 'monopoly-game-state'
const STATE_VERSION = 4

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    if (parsed._version !== STATE_VERSION) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, null, () => loadState() || createInitialState())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _version: STATE_VERSION }))
  }, [state])

  const startGame = useCallback((playerCount: number, names: string[]) => {
    dispatch({ type: 'START_GAME', playerCount, names })
  }, [])

  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }, [])

  const roll = useCallback(() => {
    dispatch({ type: 'ROLL_DICE' })
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    const total = d1 + d2
    const animDuration = 500 + total * 150
    setTimeout(() => {
      dispatch({ type: 'DICE_ANIMATED', dice: [d1, d2] })
      setTimeout(() => dispatch({ type: 'RESOLVE_SPACE' }), animDuration)
    }, 500)
  }, [])

  const send = useCallback((action: GameAction) => dispatch(action), [])

  const buyProperty = useCallback(() => send({ type: 'BUY_PROPERTY' }), [send])
  const declineBuy = useCallback(() => send({ type: 'DECLINE_BUY' }), [send])
  const payRent = useCallback(() => send({ type: 'PAY_RENT' }), [send])
  const buildHouse = useCallback((spaceId: number) => send({ type: 'BUILD_HOUSE', spaceId }), [send])
  const sellHouse = useCallback((spaceId: number) => send({ type: 'SELL_HOUSE', spaceId }), [send])
  const mortgage = useCallback((spaceId: number) => send({ type: 'MORTGAGE', spaceId }), [send])
  const unmortgage = useCallback((spaceId: number) => send({ type: 'UNMORTGAGE', spaceId }), [send])
  const sellProperty = useCallback((spaceId: number) => send({ type: 'SELL_PROPERTY', spaceId }), [send])
  const proposeTrade = useCallback((offer: TradeOffer) => send({ type: 'PROPOSE_TRADE', offer }), [send])
  const drawCard = useCallback(() => send({ type: 'DRAW_CARD' }), [send])
  const resolveCard = useCallback(() => send({ type: 'RESOLVE_CARD' }), [send])
  const endTurn = useCallback(() => send({ type: 'END_TURN' }), [send])
  const declareBankruptcy = useCallback(() => send({ type: 'DECLARE_BANKRUPTCY' }), [send])
  const skipAction = useCallback(() => send({ type: 'SKIP_ACTION' }), [send])
  const payJailFine = useCallback(() => send({ type: 'PAY_JAIL_FINE' }), [send])
  const useGetOutOfJailFree = useCallback(() => send({ type: 'USE_GET_OUT_OF_JAIL_FREE' }), [send])

  useEffect(() => {
    if (state.phase === GamePhase.Resolving && !state.pendingAction) {
      dispatch({ type: 'RESOLVE_SPACE' })
    }
  }, [state.phase, state.pendingAction])

  useEffect(() => {
    if (state.pendingAction?.type === PendingActionType.DrawCard) {
      const t = setTimeout(() => dispatch({ type: 'DRAW_CARD' }), 300)
      return () => clearTimeout(t)
    }
  }, [state.pendingAction])

  const wasInJailRef = useRef<Record<number, boolean>>({})
  useEffect(() => {
    const player = state.players[state.currentPlayer]
    if (!player) return
    const wasInJail = wasInJailRef.current[player.id] ?? false
    wasInJailRef.current[player.id] = player.inJail
    if (player.inJail && !wasInJail && state.phase === GamePhase.Waiting && !state.pendingAction) {
      const t = setTimeout(() => dispatch({ type: 'END_TURN' }), 300)
      return () => clearTimeout(t)
    }
  }, [state.players, state.phase, state.pendingAction, state.currentPlayer])

  return {
    state,
    dispatch,
    startGame,
    resetGame,
    roll,
    buyProperty,
    declineBuy,
    payRent,
    buildHouse,
    sellHouse,
    mortgage,
    unmortgage,
    sellProperty,
    proposeTrade,
    drawCard,
    resolveCard,
    endTurn,
    declareBankruptcy,
    skipAction,
    payJailFine,
    useGetOutOfJailFree,
  }
}
```

- [ ] **Step 2: Create GameView**

Create `src/components/GameView.tsx`:

```tsx
import { useState } from 'react'
import type { GameApi, TradeOffer } from '../types/game'
import GameBoard from './GameBoard'
import Sidebar from './Sidebar'
import TradeModal from './Modals/TradeModal'
import CardModal from './Modals/CardModal'
import BankruptcyModal from './Modals/BankruptcyModal'
import GameOverModal from './Modals/GameOverModal'

export default function GameView({ game }: { game: GameApi }) {
  const { state } = game
  const [showTrade, setShowTrade] = useState(false)

  return (
    <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
      <GameBoard
        state={state}
        onSell={game.sellHouse}
        onMortgage={game.mortgage}
        onUnmortgage={game.unmortgage}
        onBuild={game.buildHouse}
        onSellProperty={game.sellProperty}
      >
        <Sidebar
          state={state}
          onRoll={game.roll}
          onEndTurn={game.endTurn}
          onProposeTrade={() => setShowTrade(true)}
          onDrawCard={game.drawCard}
          onBuyProperty={game.buyProperty}
          onDeclineBuy={game.declineBuy}
          onPayRent={game.payRent}
          onDeclareBankruptcy={game.declareBankruptcy}
          onSkipAction={game.skipAction}
          onPayJailFine={game.payJailFine}
          onUseGetOutOfJailFree={game.useGetOutOfJailFree}
        />
      </GameBoard>
      <CardModal state={state} onResolve={game.resolveCard} />
      <BankruptcyModal state={state} onClose={game.skipAction} onBankruptcy={game.declareBankruptcy} />
      <GameOverModal state={state} onReset={game.resetGame} />
      {showTrade && (
        <TradeModal
          state={state}
          onPropose={(offer: TradeOffer) => {
            game.proposeTrade(offer)
            setShowTrade(false)
          }}
          onClose={() => setShowTrade(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Point App at GameView (temporary)**

Replace the body of `src/App.tsx` with a minimal local-only version that keeps the existing `GameSetup` `onStart` prop (the `GameSetup` rewrite to `onStartLocal`/`onJoin` happens in Task 7):

```tsx
import { GamePhase } from './types/game'
import { useGame } from './hooks/useGame'
import GameSetup from './components/GameSetup'
import GameView from './components/GameView'

export default function App() {
  const game = useGame()
  const { state } = game

  if (state.phase === GamePhase.Setup) {
    return (
      <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
        <GameSetup onStart={game.startGame} />
      </div>
    )
  }

  return <GameView game={game} />
}
```

- [ ] **Step 4: Run typecheck and existing tests**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS (reducer/component tests unaffected; no test references App.tsx internals).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGame.ts src/components/GameView.tsx src/App.tsx
git commit -m "refactor: extract GameView and move roll orchestration into useGame"
```

---

### Task 7: GameSetup mode selector, Lobby, and MultiplayerGame

**Files:**
- Modify: `src/components/GameSetup.tsx`
- Create: `src/components/Lobby.tsx`
- Create: `src/components/MultiplayerGame.tsx`
- Test: `src/components/__tests__/GameSetup.test.tsx`

**Interfaces:**
- Consumes: `PLAYER_COLORS` (Task 1), `useNetworkGame` (Task 5), `GameView` (Task 6), `LobbyPlayer`/`ConnectionStatus` (Task 2).
- Produces: `GameSetup` with props `{ onStartLocal, onJoin }`; `Lobby` with props `{ game, onExit }`; `MultiplayerGame` with props `{ name, onExit }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/GameSetup.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'

describe('GameSetup', () => {
  it('switches to multiplayer form and calls onJoin', () => {
    const onJoin = vi.fn()
    render(<GameSetup onStartLocal={() => {}} onJoin={onJoin} />)

    fireEvent.click(screen.getByText('Multiplayer (LAN)'))
    const input = screen.getByPlaceholderText('Nama')
    fireEvent.change(input, { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText('Masuk'))

    expect(onJoin).toHaveBeenCalledWith('Alice')
  })

  it('starts a local game with filled names', () => {
    const onStartLocal = vi.fn()
    render(<GameSetup onStartLocal={onStartLocal} onJoin={() => {}} />)

    fireEvent.change(screen.getAllByPlaceholderText(/Pemain/)[0], { target: { value: 'A' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Pemain/)[1], { target: { value: 'B' } })
    fireEvent.click(screen.getByText('Mulai Permainan'))

    expect(onStartLocal).toHaveBeenCalledWith(2, ['A', 'B'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/GameSetup.test.tsx`
Expected: FAIL — `GameSetup` does not yet accept `onStartLocal`/`onJoin` or render the multiplayer form.

- [ ] **Step 3: Rewrite GameSetup**

Replace `src/components/GameSetup.tsx` with:

```tsx
import { useState } from 'react'
import Button from './Button'
import { PLAYER_COLORS } from '../data/players'

interface Props {
  onStartLocal: (playerCount: number, names: string[]) => void
  onJoin: (name: string) => void
}

export default function GameSetup({ onStartLocal, onJoin }: Props) {
  const [mode, setMode] = useState<'local' | 'multiplayer'>('local')
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState<string[]>(['', '', '', ''])
  const [myName, setMyName] = useState('')

  function handleNameChange(index: number, value: string) {
    const newNames = [...names]
    newNames[index] = value
    setNames(newNames)
  }

  function handleStart() {
    const filledNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Pemain ${i + 1}`)
    onStartLocal(playerCount, filledNames)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-[80px] text-gold m-0">Monopoli Indonesia</h1>
      <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="flex gap-2">
          <Button variant={mode === 'local' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('local')}>
            Satu Perangkat
          </Button>
          <Button variant={mode === 'multiplayer' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('multiplayer')}>
            Multiplayer (LAN)
          </Button>
        </div>

        {mode === 'local' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-base text-muted">Jumlah Pemain</label>
              <select
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
              >
                <option value={2}>2 Pemain</option>
                <option value={3}>3 Pemain</option>
                <option value={4}>4 Pemain</option>
              </select>
            </div>
            {Array.from({ length: playerCount }).map((_, i) => (
              <div className="flex flex-col gap-1.5" key={i}>
                <label className="text-base text-muted flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                  Nama Pemain {i + 1}
                </label>
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  placeholder={`Pemain ${i + 1}`}
                  maxLength={12}
                  className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
                />
              </div>
            ))}
            <Button variant="start" size="lg" onClick={handleStart}>
              Mulai Permainan
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-base text-muted">Nama Kamu</label>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="Nama"
                maxLength={12}
                className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
              />
            </div>
            <Button variant="start" size="lg" onClick={() => onJoin(myName.trim() || 'Pemain')}>
              Masuk
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/GameSetup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create Lobby**

Create `src/components/Lobby.tsx`:

```tsx
import type { ConnectionStatus, LobbyPlayer } from '../types/net'
import type { NetworkGameApi } from '../hooks/useNetworkGame'
import { PLAYER_COLORS } from '../data/players'
import Button from './Button'

interface Props {
  game: NetworkGameApi
  onExit: () => void
}

export default function Lobby({ game, onExit }: Props) {
  const { lobby, playerId, status, start } = game
  const isHost = playerId === 0
  const url = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-4xl text-gold m-0">Lobi</h1>
      <div className="bg-bg-card px-10 py-6 rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="text-center">
          <p className="text-sm text-muted">Bagikan alamat ini ke temanmu:</p>
          <strong className="text-text break-all">{url}</strong>
        </div>

        {status === 'connecting' && <p className="text-muted text-center">Menghubungkan…</p>}
        {status === 'disconnected' && <p className="text-red-danger text-center">Terputus dari server</p>}

        <div className="flex flex-col gap-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted mb-1.5 text-center">Pemain</div>
          {Array.from({ length: 6 }).map((_, i) => {
            const p: LobbyPlayer | undefined = lobby[i]
            return (
              <div key={i} className="flex items-center gap-2 text-base">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                <span className="text-muted">{i === 0 ? 'Host' : 'Pemain'} {i + 1}</span>
                <span className="text-text">
                  {p?.name ?? '—'}
                  {p && !p.connected ? ' (terputus)' : ''}
                </span>
              </div>
            )
          })}
        </div>

        {isHost && (
          <Button variant="start" size="lg" onClick={start} disabled={lobby.filter((p) => p.name).length < 2}>
            Mulai ({lobby.filter((p) => p.name).length}/6)
          </Button>
        )}
        <Button variant="secondary" onClick={onExit}>
          Keluar
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create MultiplayerGame**

Create `src/components/MultiplayerGame.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { GamePhase } from '../types/game'
import { useNetworkGame } from '../hooks/useNetworkGame'
import Lobby from './Lobby'
import GameView from './GameView'

interface Props {
  name: string
  onExit: () => void
}

export default function MultiplayerGame({ name, onExit }: Props) {
  const game = useNetworkGame()
  const joinedRef = useRef(false)

  useEffect(() => {
    if (!joinedRef.current) {
      joinedRef.current = true
      game.join(name)
    }
  }, [name, game.join])

  if (game.state.phase === GamePhase.Setup) {
    return <Lobby game={game} onExit={onExit} />
  }

  return <GameView game={game} />
}
```

- [ ] **Step 7: Run typecheck and tests**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/GameSetup.tsx src/components/Lobby.tsx src/components/MultiplayerGame.tsx src/components/__tests__/GameSetup.test.tsx
git commit -m "feat: mode selector, lobby, and multiplayer game screen"
```

---

### Task 8: Final App wiring and E2E smoke test

**Files:**
- Modify: `src/App.tsx`
- Create: `e2e/multiplayer.spec.ts`

**Interfaces:**
- Consumes: `useGame`, `GameSetup`, `GameView`, `MultiplayerGame` (Tasks 6–7).

- [ ] **Step 1: Final App wiring**

Replace `src/App.tsx` with:

```tsx
import { useState } from 'react'
import { GamePhase } from './types/game'
import { useGame } from './hooks/useGame'
import GameSetup from './components/GameSetup'
import GameView from './components/GameView'
import MultiplayerGame from './components/MultiplayerGame'

type Mode = 'local' | 'multiplayer' | null

export default function App() {
  const local = useGame()
  const [mode, setMode] = useState<Mode>(() =>
    local.state.phase !== GamePhase.Setup ? 'local' : null,
  )
  const [name, setName] = useState('')

  function handleStartLocal(count: number, names: string[]) {
    local.startGame(count, names)
    setMode('local')
  }

  function handleJoin(n: string) {
    setName(n)
    setMode('multiplayer')
  }

  if (mode === 'multiplayer') {
    return <MultiplayerGame name={name} onExit={() => setMode(null)} />
  }

  if (mode === null || local.state.phase === GamePhase.Setup) {
    return (
      <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
        <GameSetup onStartLocal={handleStartLocal} onJoin={handleJoin} />
      </div>
    )
  }

  return <GameView game={local} />
}
```

- [ ] **Step 2: Run typecheck, lint, and unit tests**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: PASS.

- [ ] **Step 3: Write the E2E smoke test**

Create `e2e/multiplayer.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'

const PORT = 3123
let serverProc: ChildProcess | null = null

test.beforeAll(async () => {
  // Requires `npm run build` first so `dist/` exists (served by the server).
  serverProc = spawn('npx', ['tsx', 'server/main.ts'], {
    env: { ...process.env, PORT: String(PORT) },
    cwd: process.cwd(),
    stdio: 'ignore',
  })
  // Wait for the server to start listening.
  await new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:${PORT}/`)
        if (res.ok) return resolve(undefined)
      } catch {}
      if (Date.now() - startedAt > 10000) return reject(new Error('server did not start'))
      setTimeout(poll, 200)
    }
    poll()
  })
})

test.afterAll(() => {
  serverProc?.kill()
})

test('two clients join and start a game', async ({ browser }) => {
  const pageA = await browser.newPage()
  const pageB = await browser.newPage()

  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
  await pageA.fill('input[placeholder="Nama"]', 'Host')
  await pageA.click('button:has-text("Masuk")')

  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
  await pageB.fill('input[placeholder="Nama"]', 'Tamu')
  await pageB.click('button:has-text("Masuk")')

  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  await pageA.click('button:has-text("Mulai")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 4: Build and run the E2E test**

Run: `npm run build && npx playwright test e2e/multiplayer.spec.ts`
Expected: PASS (two browser pages connect to the local server and reach the board).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx e2e/multiplayer.spec.ts server/main.ts
git commit -m "feat: wire App to local/multiplayer modes and add multiplayer e2e smoke test"
```

---

## Known limitations (accepted for v1)

- Trade in multiplayer follows the same (existing, minimal) local path; only the current player can propose.
- The server keeps no game state across restarts; a server crash loses the game.
- `resetGame` in multiplayer reloads the page; the host must restart the server (`Ctrl-C` then `npm run server`) to begin a fresh game.
