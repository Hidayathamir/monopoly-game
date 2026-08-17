# Seed Defined State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flag-gated way to seed any full `GameState` into a running room over HTTP (used by a dev-only "Load Scenario" panel for manual playtesting and by e2e), plus a seed-based e2e test that drives bankruptcy on unpayable rent.

**Architecture:** `POST /seed` + `GET /config` on the existing Node HTTP server, gated by `E2E_SEED_ENABLED=true` (same pattern as `TRADES_ENABLED`). A shared pure module `src/logic/seed.ts` provides the builder (`createSeededState`) and two validators (`validateStateStructure`, `validateStateForRoom`). The server replaces its state wholesale, cancels pending bot timers, and broadcasts. The client shows a Load Scenario panel in the lobby when `/config` reports the flag. e2e posts a checked-in generated `GameState` fixture and drives the bankruptcy UI.

**Tech Stack:** Node `http` + `ws`, TypeScript (three tsconfig projects), React 19, Vitest, Playwright, tsx.

## Global Constraints

- No TS `enum` anywhere (`erasableSyntaxOnly`); use `const` objects + derived union types. `verbatimModuleSyntax` is on — type-only imports must use `import type`. `noUnusedLocals`/`noUnusedParameters` are on.
- Semicolons: `src/logic/*` and `src/data/*` use them; `server/*`, `src/components`, `src/hooks`, `src/net` omit them. Match the file being edited.
- i18n: every UI string must exist in BOTH `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys, `keySeparator: false`). Do not add hardcoded user-facing strings.
- Wire values (message types, action types, phases) must never change. The websocket protocol (`src/types/net.ts`) is untouched by this feature; new traffic is plain HTTP.
- `E2E_SEED_ENABLED` follows the `TRADES_ENABLED` contract: only the literal string `true` enables it; anything else leaves seeds disabled.
- `npm run build` = `tsc -b && vite build` (typechecks all three TS projects, then builds `dist/`). `npm run test:unit` = vitest. `npm run test:e2e` = Playwright (needs `dist/` first; the e2e server spawns `tsx server/main.ts`).
- The seeded state's `currentPlayer` is a server **slot index**; seeds must satisfy `players[i].id === i` for every joined slot.

---

### Task 1: Shared seed module `src/logic/seed.ts` + unit tests

**Files:**
- Create: `src/logic/seed.ts`
- Test: `src/logic/__tests__/seed.test.ts`

**Interfaces:**
- Produces:
  - `type SeedBoardOverride = { owner?: number; houses?: number; mortgaged?: boolean }`
  - `interface SeedPlayerSpec { id: number; name: string; money: number; position?: number; inJail?: boolean; jailTurns?: number; getOutOfJailFreeCards?: number; bankrupt?: boolean; isBot?: boolean; botControlled?: boolean; passedGo?: boolean }`
  - `interface SeedSpec { players: SeedPlayerSpec[]; board?: Partial<Record<number, SeedBoardOverride>>; currentPlayer: number; turnOrder?: number[]; phase?: GamePhase; pendingAction?: PendingAction | null; tradesEnabled?: boolean }`
  - `function createSeededState(spec: SeedSpec): GameState`
  - `type ValidationResult = { ok: true } | { ok: false; message: string }`
  - `function validateStateStructure(state: GameState): ValidationResult`
  - `interface SlotInfo { name: string | null; connected: boolean; isBot: boolean }`
  - `function validateStateForRoom(state: GameState, slots: SlotInfo[]): ValidationResult`

- [ ] **Step 1: Write the failing test**

Create `src/logic/__tests__/seed.test.ts` (semicolons, colocated with source like the other `__tests__` there):

```ts
import { describe, it, expect } from 'vitest';
import { GamePhase, PendingActionType } from '../../types/game';
import type { GameState } from '../../types/game';
import { createSeededState, validateStateStructure, validateStateForRoom } from '../seed';

const SLOTS = [
  { name: 'Alpha', connected: true, isBot: false },
  { name: 'Bravo', connected: true, isBot: false },
];

function baseState(): GameState {
  return createSeededState({
    players: [
      { id: 0, name: 'Alpha', money: 1000 },
      { id: 1, name: 'Bravo', money: 1 },
    ],
    board: { 39: { owner: 0, houses: 4 } },
    currentPlayer: 1,
    turnOrder: [1, 0],
  });
}

describe('createSeededState', () => {
  it('builds a valid waiting state with defaults filled and slot-keyed players', () => {
    const s = baseState();
    expect(s.phase).toBe(GamePhase.Waiting);
    expect(s.board).toHaveLength(40);
    expect(s.players.map((p) => p.id)).toEqual([0, 1]);
    expect(s.players[0].position).toBe(0);
    expect(s.players[0].passedGo).toBe(true);
    expect(s.players[0].bankrupt).toBe(false);
    expect(s.players[0].properties).toEqual([39]);
    expect(s.board[39].owner).toBe(0);
    expect(s.board[39].houses).toBe(4);
    expect(s.board[39].mortgaged).toBe(false);
    expect(s.turnOrder).toEqual([1, 0]);
    expect(s.pendingAction).toBeNull();
    expect(s.dice).toBeNull();
    expect(s.chanceDeck.length).toBeGreaterThan(0);
    expect(validateStateStructure(s).ok).toBe(true);
  });

  it('accepts a staged pending action for a decision-point seed', () => {
    const s = createSeededState({
      players: [
        { id: 0, name: 'Alpha', money: 1000 },
        { id: 1, name: 'Bravo', money: 1 },
      ],
      board: { 39: { owner: 0, houses: 4 } },
      currentPlayer: 1,
      phase: GamePhase.Resolving,
      pendingAction: { type: PendingActionType.PayRent, spaceId: 39, amount: 1700 },
    });
    expect(s.phase).toBe(GamePhase.Resolving);
    expect(s.pendingAction).toEqual({ type: PendingActionType.PayRent, spaceId: 39, amount: 1700 });
    expect(validateStateStructure(s).ok).toBe(true);
  });
});

describe('validateStateStructure', () => {
  it('rejects a wrong board length', () => {
    const s = baseState() as GameState;
    const bad = { ...s, board: s.board.slice(0, 10) };
    expect(validateStateStructure(bad)).toEqual({ ok: false, message: expect.stringContaining('40') });
  });

  it('rejects duplicate player ids', () => {
    const s = baseState();
    const bad = { ...s, players: [{ ...s.players[0] }, { ...s.players[0], name: 'Bravo' }] };
    expect(validateStateStructure(bad).ok).toBe(false);
  });

  it('rejects a turnOrder that is not a permutation of player ids', () => {
    const s = baseState();
    const bad = { ...s, turnOrder: [1, 1] };
    expect(validateStateStructure(bad).ok).toBe(false);
  });

  it('rejects currentPlayer not in turnOrder', () => {
    const s = baseState();
    const bad = { ...s, currentPlayer: 9 };
    expect(validateStateStructure(bad).ok).toBe(false);
  });

  it('rejects a board owner whose properties list does not match', () => {
    const s = baseState();
    const bad = { ...s, players: [{ ...s.players[0], properties: [] }] };
    expect(validateStateStructure(bad).ok).toBe(false);
    const bad2 = { ...s, players: [{ ...s.players[0], properties: [0] }] };
    expect(validateStateStructure(bad2).ok).toBe(false);
  });

  it('rejects a claimed property that is not owned on the board', () => {
    const s = baseState();
    const bad = { ...s, players: [{ ...s.players[1], properties: [1] }] };
    expect(validateStateStructure(bad).ok).toBe(false);
  });

  it('rejects houses out of range', () => {
    const s = baseState() as GameState;
    const bad = { ...s, board: s.board.map((sp, i) => (i === 39 ? { ...sp, houses: 6 } : sp)) };
    expect(validateStateStructure(bad).ok).toBe(false);
  });

  it('rejects Waiting phase with a pending action', () => {
    const s = baseState();
    const bad = { ...s, pendingAction: { type: PendingActionType.PayRent, spaceId: 39, amount: 1700 } };
    expect(validateStateStructure(bad).ok).toBe(false);
  });

  it('rejects Resolving phase without a pending action', () => {
    const s = baseState();
    const bad = { ...s, phase: GamePhase.Resolving, pendingAction: null };
    expect(validateStateStructure(bad).ok).toBe(false);
  });
});

describe('validateStateForRoom', () => {
  it('accepts a seed whose players match the joined slots', () => {
    const s = baseState();
    expect(validateStateForRoom(s, SLOTS).ok).toBe(true);
  });

  it('rejects a player count mismatch', () => {
    const s = baseState();
    const one = createSeededState({ players: [{ id: 0, name: 'Alpha', money: 100 }], currentPlayer: 0 });
    expect(validateStateForRoom(one, SLOTS).ok).toBe(false);
  });

  it('rejects a player whose id has no joined slot', () => {
    const s = baseState();
    const stray = createSeededState({
      players: [{ id: 2, name: 'Casper', money: 100 }],
      currentPlayer: 2,
    });
    expect(validateStateForRoom(stray, SLOTS).ok).toBe(false);
  });

  it('rejects a player not sitting at its own index', () => {
    const s = baseState();
    const bad = { ...s, players: [{ ...s.players[1], id: 0 }, { ...s.players[0], id: 1 }] };
    expect(validateStateForRoom(bad, SLOTS).ok).toBe(false);
  });

  it('rejects a currentPlayer that is not a connected client or bot', () => {
    const s = baseState();
    expect(validateStateForRoom(s, [
      { name: 'Alpha', connected: true, isBot: false },
      { name: 'Bravo', connected: false, isBot: false },
    ]).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/logic/__tests__/seed.test.ts`
Expected: FAIL — module `../seed` cannot be resolved / tests error with "Cannot find module".

- [ ] **Step 3: Implement `src/logic/seed.ts`**

Create `src/logic/seed.ts` (semicolons, like `gameReducer.ts`):

```ts
import { GamePhase, type GameState, type PendingAction, type Player, type Space } from '../types/game';
import { createInitialBoard } from '../data/board';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../data/cards';

const BOARD_SIZE = 40;
const MAX_SLOTS = 6;

export type SeedBoardOverride = { owner?: number; houses?: number; mortgaged?: boolean };

export interface SeedPlayerSpec {
  id: number;
  name: string;
  money: number;
  position?: number;
  inJail?: boolean;
  jailTurns?: number;
  getOutOfJailFreeCards?: number;
  bankrupt?: boolean;
  isBot?: boolean;
  botControlled?: boolean;
  passedGo?: boolean;
}

export interface SeedSpec {
  players: SeedPlayerSpec[];
  board?: Partial<Record<number, SeedBoardOverride>>;
  currentPlayer: number;
  turnOrder?: number[];
  phase?: GamePhase;
  pendingAction?: PendingAction | null;
  tradesEnabled?: boolean;
}

export function createSeededState(spec: SeedSpec): GameState {
  const board: Space[] = createInitialBoard();
  for (const [idStr, override] of Object.entries(spec.board ?? {})) {
    const id = Number(idStr);
    if (override == null) continue;
    board[id] = { ...board[id], ...definedOnly(override) };
  }
  const owners = new Map<number, number[]>();
  board.forEach((space) => {
    if (space.owner === null) return;
    const list = owners.get(space.owner) ?? [];
    list.push(space.id);
    owners.set(space.owner, list);
  });
  const players: Player[] = [...spec.players]
    .sort((a, b) => a.id - b.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      money: p.money,
      position: p.position ?? 0,
      properties: owners.get(p.id) ?? [],
      passedGo: p.passedGo ?? true,
      inJail: p.inJail ?? false,
      jailTurns: p.jailTurns ?? 0,
      bankrupt: p.bankrupt ?? false,
      getOutOfJailFreeCards: p.getOutOfJailFreeCards ?? 0,
      isBot: p.isBot ?? false,
      botControlled: p.botControlled ?? false,
    }));
  return {
    phase: spec.phase ?? GamePhase.Waiting,
    players,
    turnOrder: spec.turnOrder ?? players.map((p) => p.id),
    currentPlayer: spec.currentPlayer,
    board,
    chanceDeck: [...CHANCE_CARDS],
    communityDeck: [...COMMUNITY_CARDS],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: spec.pendingAction ?? null,
    justBoughtSpaceId: null,
    builtThisStop: false,
    reconnectGrace: null,
    pendingTrades: [],
    nextTradeId: 0,
    tradesEnabled: spec.tradesEnabled ?? false,
  };
}

function definedOnly<T extends object>(src: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function validateStateStructure(state: GameState): ValidationResult {
  if (state.board.length !== BOARD_SIZE) {
    return { ok: false, message: `board must have ${BOARD_SIZE} spaces, got ${state.board.length}` };
  }
  const playerIds = state.players.map((p) => p.id);
  if (new Set(playerIds).size !== playerIds.length) {
    return { ok: false, message: 'player ids must be unique' };
  }
  if (playerIds.some((id) => id < 0 || id >= MAX_SLOTS)) {
    return { ok: false, message: `player ids must be in 0..${MAX_SLOTS - 1}` };
  }
  const expectedTurn = [...playerIds].sort((a, b) => a - b);
  const actualTurn = [...state.turnOrder].sort((a, b) => a - b);
  if (state.turnOrder.length !== playerIds.length || expectedTurn.some((v, i) => v !== actualTurn[i])) {
    return { ok: false, message: 'turnOrder must be a permutation of the player ids' };
  }
  if (!state.turnOrder.includes(state.currentPlayer)) {
    return { ok: false, message: 'currentPlayer must be in turnOrder' };
  }
  if (state.board.some((s) => s.owner !== null && !playerIds.includes(s.owner))) {
    return { ok: false, message: 'board has an owner that is not a player id' };
  }
  if (state.board.some((s) => s.houses < 0 || s.houses > 5)) {
    return { ok: false, message: 'houses must be within 0..5' };
  }
  for (const player of state.players) {
    const owned = state.board.filter((s) => s.owner === player.id).map((s) => s.id).sort((a, b) => a - b);
    const claimed = [...player.properties].sort((a, b) => a - b);
    if (owned.length !== claimed.length || owned.some((v, i) => v !== claimed[i])) {
      return { ok: false, message: `player ${player.id} (${player.name}) properties must match its owned board spaces` };
    }
  }
  if (state.players.some((p) => !Number.isFinite(p.money) || p.money < 0)) {
    return { ok: false, message: 'player money must be a non-negative finite number' };
  }
  if (state.players.some((p) => p.position < 0 || p.position >= BOARD_SIZE)) {
    return { ok: false, message: 'player position must be within 0..39' };
  }
  if (state.phase === GamePhase.Waiting && (state.pendingAction !== null || state.dice !== null)) {
    return { ok: false, message: 'Waiting state must have pendingAction === null and dice === null' };
  }
  if (state.phase === GamePhase.Resolving && state.pendingAction === null) {
    return { ok: false, message: 'Resolving state must have a pendingAction' };
  }
  return { ok: true };
}

export interface SlotInfo {
  name: string | null;
  connected: boolean;
  isBot: boolean;
}

export function validateStateForRoom(state: GameState, slots: SlotInfo[]): ValidationResult {
  const joined = slots.filter((s) => s.name !== null).length;
  if (state.players.length !== joined) {
    return { ok: false, message: `seed has ${state.players.length} players but the room has ${joined} joined slots` };
  }
  for (const p of state.players) {
    const slot = slots[p.id];
    if (!slot || slot.name === null) {
      return { ok: false, message: `player ${p.id} (${p.name}) has no matching joined slot` };
    }
    if (state.players[p.id] !== p) {
      return { ok: false, message: `player ${p.id} must sit at players[${p.id}] (slot index)` };
    }
  }
  const current = slots[state.currentPlayer];
  if (!current || current.name === null || (!current.connected && !current.isBot)) {
    return { ok: false, message: 'currentPlayer must be a connected client or a bot slot' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/logic/__tests__/seed.test.ts`
Expected: PASS (all 15 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS across all three tsconfig projects.

- [ ] **Step 6: Commit**

```bash
git add src/logic/seed.ts src/logic/__tests__/seed.test.ts
git commit -m "feat: add shared seed builder and validators"
```

---

### Task 2: `GameServer.seedState` + unit tests

**Files:**
- Modify: `server/gameServer.ts` (constructor opts ~line 46, add method after `start()` ~line 184)
- Test: `server/__tests__/gameServer.test.ts`

**Interfaces:**
- Consumes: `createSeededState`, `validateStateStructure`, `validateStateForRoom` from `src/logic/seed.ts` (Task 1).
- Produces: `GameServer.seedState(state: GameState): void` (throws `Error` on disabled/invalid seed; otherwise replaces state, cancels bot timers, broadcasts). Constructor opts gain `seedEnabled?: boolean`.
- Note: `gameServer.ts` omits semicolons; match the file. `Slot` already has the shape `SlotInfo` needs (`name`, `connected`, `isBot`), so `this.slots` is directly usable.

- [ ] **Step 1: Write the failing tests (append to `server/__tests__/gameServer.test.ts`)**

```ts
import { GamePhase, PendingActionType } from '../../src/types/game'
import { createSeededState } from '../../src/logic/seed'

  it('seedState replaces state and broadcasts state + lobby when enabled', () => {
    const { server, sent } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const seeded = createSeededState({
      players: [
        { id: 0, name: 'Alice', money: 1000 },
        { id: 1, name: 'Bob', money: 1 },
      ],
      board: { 39: { owner: 0, houses: 4 } },
      currentPlayer: 1,
      phase: GamePhase.Resolving,
      pendingAction: { type: PendingActionType.PayRent, spaceId: 39, amount: 1700 },
      tradesEnabled: false,
    })
    server.seedState(seeded)
    expect(server.getState().phase).toBe(GamePhase.Resolving)
    expect(server.getState().players[1].money).toBe(1)
    expect(sent.some((m) => m.type === 'state' && m.state.phase === GamePhase.Resolving)).toBe(true)
    expect(sent.some((m) => m.type === 'lobby')).toBe(true)
  })

  it('seedState throws when seeding is disabled', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const seeded = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })
    expect(() => server.seedState(seeded)).toThrow(/disabled/)
  })

  it('seedState throws on an invalid seed (player count mismatch)', () => {
    const { server } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const seeded = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })
    expect(() => server.seedState(seeded)).toThrow(/Invalid seed state/)
  })

  it('seedState cancels a pending bot timer on re-seed', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1, 4], sum 5, non-doubles
    const { server } = setup({ seedEnabled: true, rng })
    server.join('c0', 'Alice')
    server.addBot('c0') // slot 1 is a bot (name Droid)
    server.start('c0')  // Math.random is mocked 0.5 → turnOrder [0, 1], currentPlayer 0

    // Play the host's turn so it ends on the bot (slot 1) → driveBots schedules a timer.
    server.roll('c0')
    vi.advanceTimersByTime(500)               // DiceAnimated → [1,4], Moving, pos 5
    vi.advanceTimersByTime(500 + 5 * 150)     // ResolveSpace: space 5 (unowned railroad) → Waiting
    server.handleAction('c0', { type: 'END_TURN' }) // currentPlayer → 1 (bot), bot timer scheduled

    const seeded = createSeededState({
      players: [
        { id: 0, name: 'Alice', money: 1000 },
        { id: 1, name: 'Droid', money: 100, isBot: true },
      ],
      currentPlayer: 1,
      turnOrder: [1, 0],
    })
    server.seedState(seeded)
    const logLength = server.getState().eventLog.length

    vi.advanceTimersByTime(10 * 700 + 100) // if the timer had survived it would have rolled by now
    expect(server.getState().currentPlayer).toBe(1)
    expect(server.getState().dice).toBeNull()
    expect(server.getState().eventLog.length).toBe(logLength)
  })
```

Note: the gameServer tests already import `GamePhase` and `ServerMessage`; add the new imports at the top of the file (the existing file header imports `import { GamePhase } from '../../src/types/game'`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: FAIL — `seedState` is not a function; constructor opts type error for `seedEnabled`.

- [ ] **Step 3: Implement `GameServer.seedState`**

In `server/gameServer.ts`:

1. Update the constructor signature and state init to accept the flag:

```ts
constructor(events: GameServerEvents, opts?: { rng?: () => number; code?: string; tradesEnabled?: boolean; seedEnabled?: boolean }) {
  this.state = createInitialState({ tradesEnabled: opts?.tradesEnabled ?? false })
  this.events = events
  this.rng = opts?.rng ?? Math.random
  this.code = opts?.code ?? ''
  this.seedEnabled = opts?.seedEnabled ?? false
}
```

2. Add the private field near the other private fields:

```ts
private seedEnabled: boolean
```

3. Add the method immediately after `start()`:

```ts
seedState(state: GameState): void {
  if (!this.seedEnabled) {
    throw new Error('seeding disabled')
  }
  const structural = validateStateStructure(state)
  if (!structural.ok) {
    throw new Error(`Invalid seed state: ${structural.message}`)
  }
  const roomCheck = validateStateForRoom(state, this.slots)
  if (!roomCheck.ok) {
    throw new Error(`Invalid seed state: ${roomCheck.message}`)
  }
  this.clearBotTimer()
  this.botSteps = 0
  this.state = { ...state, tradesEnabled: this.state.tradesEnabled }
  this.broadcast()
}
```

4. Add the import at the top of the file (after the existing `import { rollControlledDice } ...` line):

```ts
import { validateStateStructure, validateStateForRoom } from '../src/logic/seed'
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: PASS (existing tests + 4 new).

- [ ] **Step 5: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts
git commit -m "feat: add server-side seedState with validation and bot-timer cancel"
```

---

### Task 3: Flag plumbing + `GET /config` + `POST /seed` + tests

**Files:**
- Modify: `server/roomManager.ts` (constructor opts line 18–25, `create()` line 27–42)
- Modify: `server/http.ts` (createServer opts line 19, route handler line 31–64, RoomManager construction line 29)
- Modify: `server/main.ts` (line 5–6)
- Test: `server/__tests__/roomManager.test.ts`
- Test: `server/__tests__/http.test.ts`

**Interfaces:**
- Consumes: `GameServer.seedState`, `GameServer` opts `seedEnabled` (Task 2).
- Produces:
  - `createServer(distDir, opts?: { tradesEnabled?: boolean; seedEnabled?: boolean })`
  - `GET /config` → `200 { seedEnabled: boolean }`
  - `POST /seed` body `{ code: string; state: GameState }` → `200 { ok: true }` | `403` (disabled) | `400 { message }` (bad JSON/missing fields/invalid state) | `404` (unknown room)
- Note: `server/http.ts` already imports `GameState`? No — add `import type { GameState } from '../src/types/game'`. `roomManager.ts` and `http.ts` and `main.ts` omit semicolons.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/roomManager.test.ts`:

```ts
it('forwards seedEnabled to created games (default false)', () => {
  const { rm } = setup()
  expect(rm.create().game.getState().tradesEnabled).toBe(false)
  // seedEnabled is private; assert indirectly via a GameServer behavior:
  // constructing with the flag is covered in http.test.ts and gameServer.test.ts.
  expect(rm.create().game).toBeDefined()
})

it('seeds created games with seedEnabled true', () => {
  const sent: { clientId: string; message: ServerMessage }[] = []
  const rm = new RoomManager({ send: (clientId, message) => sent.push({ clientId, message }) }, { seedEnabled: true })
  const { code, game } = rm.create()
  rm.addClient(code, 'c1')
  game.join('c1', 'Alice')
  const seeded = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })
  expect(() => game.seedState(seeded)).not.toThrow()
})
```

Append to `server/__tests__/http.test.ts`:

```ts
import { createSeededState } from '../../src/logic/seed'

it('GET /config reflects the seedEnabled flag', async () => {
  const res = await fetch(`http://localhost:${port}/config`)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ seedEnabled: false })
})

it('POST /seed returns 403 when seeding is disabled', async () => {
  const res = await fetch(`http://localhost:${port}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'ABC12', state: {} }),
  })
  expect(res.status).toBe(403)
})

it('POST /seed seeds a room and broadcasts the state when enabled', async () => {
  const created = createServer(dir, { seedEnabled: true })
  const server = created.httpServer
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const seedPort = (server.address() as AddressInfo).port

  const ws = await new Promise<WebSocket>((resolve, reject) => {
    const s = new WebSocket(`ws://localhost:${seedPort}/ws`)
    s.on('open', () => resolve(s))
    s.on('error', reject)
  })
  const welcome = waitFor(ws, 'welcome')
  ws.send(JSON.stringify({ type: 'create', name: 'Alice' }))
  const w = (await welcome) as Extract<ServerMessage, { type: 'welcome' }>
  const state = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })

  const stateMsg = waitFor(ws, 'state')
  const res = await fetch(`http://localhost:${seedPort}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: w.code, state }),
  })
  expect(res.status).toBe(200)
  const msg = (await stateMsg) as Extract<ServerMessage, { type: 'state' }>
  expect(msg.state.phase).toBe('waiting')
  expect(msg.state.players[0].money).toBe(100)
  ws.close()
  server.close()
})

it('POST /seed returns 404 for an unknown room and 400 for an invalid state', async () => {
  const created = createServer(dir, { seedEnabled: true })
  const server = created.httpServer
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const seedPort = (server.address() as AddressInfo).port

  const state = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })
  const missing = await fetch(`http://localhost:${seedPort}/seed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'ZZZZZ', state }),
  })
  expect(missing.status).toBe(404)

  const bad = await fetch(`http://localhost:${seedPort}/seed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'ABC12', state: { ...state, board: state.board.slice(0, 10) } }),
  })
  expect(bad.status).toBe(400)
  server.close()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/__tests__/roomManager.test.ts server/__tests__/http.test.ts`
Expected: FAIL — `createServer`/`RoomManager` reject the `seedEnabled` option; `/config` and `/seed` return 404/HTML.

- [ ] **Step 3: Implement the plumbing**

In `server/roomManager.ts`:

```ts
constructor(
  events: { send(clientId: ClientId, message: ServerMessage): void },
  opts?: { rng?: () => number; tradesEnabled?: boolean; seedEnabled?: boolean },
) {
  this.events = events
  this.rng = opts?.rng ?? Math.random
  this.tradesEnabled = opts?.tradesEnabled ?? false
  this.seedEnabled = opts?.seedEnabled ?? false
}
```

Add field: `private seedEnabled: boolean`; forward in `create()`:

```ts
new GameServer(
  {
    broadcastState: (state) =>
      this.broadcastToRoom(code, { type: ServerMessageType.State, state }),
    broadcastLobby: (players, hostPlayerId) =>
      this.broadcastToRoom(code, { type: ServerMessageType.Lobby, players, hostPlayerId }),
    send: (clientId, msg) => this.events.send(clientId, msg),
  },
  { code, rng: this.rng, tradesEnabled: this.tradesEnabled, seedEnabled: this.seedEnabled },
)
```

In `server/http.ts`:

```ts
import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve, relative, isAbsolute } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomManager } from './roomManager'
import { ClientMessageType, ServerMessageType } from '../src/types/net'
import type { ClientMessage, ServerMessage } from '../src/types/net'
import type { GameState } from '../src/types/game'
import { validateStateStructure, validateStateForRoom } from '../src/logic/seed'

export function createServer(distDir = 'dist', opts?: { tradesEnabled?: boolean; seedEnabled?: boolean }) {
  const root = resolve(distDir)
  const sockets = new Map<string, WebSocket>()
  const seedEnabled = opts?.seedEnabled ?? false
  let nextId = 1

  function send(clientId: string, msg: ServerMessage): void {
    const ws = sockets.get(clientId)
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  const roomManager = new RoomManager(
    { send },
    { tradesEnabled: opts?.tradesEnabled ?? false, seedEnabled },
  )

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (url.pathname === '/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ seedEnabled }))
      return
    }

    if (url.pathname === '/seed' && req.method === 'POST') {
      if (!seedEnabled) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'seeding disabled' }))
        return
      }
      let body = ''
      for await (const chunk of req) body += chunk
      let parsed: { code?: string; state?: GameState } = {}
      try {
        parsed = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'invalid JSON body' }))
        return
      }
      const { code, state } = parsed
      if (typeof code !== 'string' || !code || !state) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'code and state are required' }))
        return
      }
      const game = roomManager.get(code)
      if (!game) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'room not found' }))
        return
      }
      try {
        const structural = validateStateStructure(state)
        if (!structural.ok) throw new Error(structural.message)
        const roomCheck = validateStateForRoom(state, game.getPlayers().map((p) => ({
          name: p.name, connected: p.connected, isBot: p.isBot,
        })))
        if (!roomCheck.ok) throw new Error(roomCheck.message)
        game.seedState(state)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: e instanceof Error ? e.message : 'invalid seed state' }))
      }
      return
    }

    if (url.pathname === '/rooms' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(roomManager.list()))
      return
    }
    // ... rest unchanged (static file serving)
  })
  // ... rest unchanged (WebSocketServer)
  return { httpServer, wss, roomManager }
}
```

Note: `game.getPlayers()` returns `LobbyPlayer[]` = `{ id, name, connected, isBot }` — map it to `SlotInfo` (`{ name, connected, isBot }`).

In `server/main.ts`:

```ts
const port = Number(process.env.PORT ?? 3001)
const distDir = process.env.DIST_DIR ?? 'dist'
const tradesEnabled = process.env.TRADES_ENABLED === 'true'
const seedEnabled = process.env.E2E_SEED_ENABLED === 'true'
const { httpServer } = createServer(distDir, { tradesEnabled, seedEnabled })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/__tests__/roomManager.test.ts server/__tests__/http.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/roomManager.ts server/http.ts server/main.ts server/__tests__/roomManager.test.ts server/__tests__/http.test.ts
git commit -m "feat: serve GET /config and POST /seed gated by E2E_SEED_ENABLED"
```

---

### Task 4: Scenario generator script + checked-in e2e fixture

**Files:**
- Create: `scripts/print-seed.ts`
- Create: `e2e/fixtures/bankruptcy-seed.ts` (generated, verified, then committed)
- Modify: `package.json` — add `"scripts": { "print-seed": "tsx scripts/print-seed.ts" }`

**Interfaces:**
- Consumes: `createSeededState` from `src/logic/seed.ts` (Task 1).
- Produces: `e2e/fixtures/bankruptcy-seed.ts` exporting `export const bankruptcySeed: GameState` — a checked-in literal with ONLY `import type { GameState } ...` (Playwright's ESM loader rejects the JSON imports in `src/data`, so the fixture must not import `src/logic/seed.ts` or `src/data/*` at runtime).

- [ ] **Step 1: Write the generator script**

Create `scripts/print-seed.ts` (this is a `tsx`-run script; keep it dependency-light, semicolons):

```ts
import { writeFileSync } from 'node:fs'
import { createSeededState } from '../src/logic/seed'
import { GamePhase, PendingActionType } from '../src/types/game'

const state = createSeededState({
  players: [
    { id: 0, name: 'Alpha', money: 1000, passedGo: true },
    { id: 1, name: 'Bravo', money: 1, passedGo: true },
  ],
  board: {
    39: { owner: 0, houses: 4 },
    11: { owner: 0 },
    28: { owner: 0 },
  },
  currentPlayer: 1,
  turnOrder: [1, 0],
  phase: GamePhase.Resolving,
  pendingAction: { type: PendingActionType.PayRent, spaceId: 39, amount: 1700 },
  tradesEnabled: false,
})

const out =
  "import type { GameState } from '../../src/types/game'\n" +
  '\n' +
  '// GENERATED by `npm run print-seed` — do not edit by hand.\n' +
  '// Boardwalk (39) owned by Alpha with 4 houses; Bravo owes $1700 and has $1.\n' +
  `export const bankruptcySeed: GameState = ${JSON.stringify(state, null, 2)}\n`

writeFileSync('e2e/fixtures/bankruptcy-seed.ts', out)
console.log('wrote e2e/fixtures/bankruptcy-seed.ts')
console.log('JSON for manual pasting:')
console.log(JSON.stringify(state))
```

- [ ] **Step 2: Add the npm script**

In `package.json`, inside the existing `"scripts"` object add:

```json
"print-seed": "tsx scripts/print-seed.ts"
```

- [ ] **Step 3: Run the generator and verify the fixture**

Run: `mkdir -p e2e/fixtures && npm run print-seed`
Expected: prints the JSON and writes `e2e/fixtures/bankruptcy-seed.ts`.

Then sanity-check the fixture structurally:

```bash
npx tsx -e "import { bankruptcySeed } from './e2e/fixtures/bankruptcy-seed'; console.log(bankruptcySeed.board.length, bankruptcySeed.phase, bankruptcySeed.players.map(p=>[p.id,p.money]))"
```

Expected: `40 resolving [[0,1000],[1,1]]`. Verify `bankruptcySeed.board[39].owner === 0`, `houses === 4`, and `pendingAction` is `{ type: 'payRent', spaceId: 39, amount: 1700 }`.

- [ ] **Step 4: Commit**

```bash
git add scripts/print-seed.ts package.json e2e/fixtures/bankruptcy-seed.ts
git commit -m "feat: seed scenario generator and bankruptcy e2e fixture"
```

---

### Task 5: Client config hook + Load Scenario panel + i18n

**Files:**
- Create: `src/hooks/useServerConfig.ts`
- Create: `src/components/LoadScenarioPanel.tsx`
- Modify: `src/components/Lobby.tsx` (mount the panel, ~line 71 before `</div>`)
- Modify: `src/i18n/locales/en/translation.json`, `id/translation.json`
- Test: `src/components/__tests__/LoadScenarioPanel.test.tsx`

**Interfaces:**
- Consumes: `validateStateStructure` from `src/logic/seed.ts` (Task 1), `POST /seed` + `GET /config` (Task 3).
- Produces:
  - `function useServerConfig(): { seedEnabled: boolean | null; loading: boolean }`
  - `<LoadScenarioPanel seedEnabled={boolean} code={string | null} />`
- Note: components/hooks omit semicolons. i18n: flat keys, `keySeparator: false`; panel copy must exist in both locales.

- [ ] **Step 1: Add i18n keys**

In both `src/i18n/locales/en/translation.json` and `id/translation.json` add these top-level keys:

en:
```json
"seed.title": "Load Scenario (dev)",
"seed.roomCode": "Room code",
"seed.json": "State JSON",
"seed.validate": "Validate",
"seed.apply": "Apply",
"seed.validJson": "Valid state",
"seed.invalidJson": "Invalid state",
"seed.applied": "State applied",
"seed.applyError": "Apply failed",
"seed.hidden": ""
```

id:
```json
"seed.title": "Muat Skenario (dev)",
"seed.roomCode": "Kode ruangan",
"seed.json": "JSON status",
"seed.validate": "Validasi",
"seed.apply": "Terapkan",
"seed.validJson": "Status valid",
"seed.invalidJson": "Status tidak valid",
"seed.applied": "Status diterapkan",
"seed.applyError": "Gagal menerapkan",
"seed.hidden": ""
```

The `seed.hidden` key is intentionally unused at runtime — it exists so the flat-keys files for en and id stay parallel if a future key is dropped. (If you prefer, drop `seed.hidden` from both files instead; never leave it in only one.)

- [ ] **Step 2: Write the failing component test**

Create `src/components/__tests__/LoadScenarioPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import LoadScenarioPanel from '../LoadScenarioPanel'

describe('LoadScenarioPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when seedEnabled is false', () => {
    const { container } = renderWithProviders(<LoadScenarioPanel seedEnabled={false} code="ABC12" />)
    expect(container.firstChild).toBeNull()
  })

  it('validates pasted JSON client-side', () => {
    renderWithProviders(<LoadScenarioPanel seedEnabled code="ABC12" />)
    fireEvent.change(screen.getByLabelText(/State JSON/i), { target: { value: '{not json' } })
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }))
    expect(screen.getByText(/Invalid state/i)).toBeVisible()
  })

  it('posts the seed and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<LoadScenarioPanel seedEnabled code="ABC12" />)
    fireEvent.change(screen.getByLabelText(/State JSON/i), {
      target: { value: '{"phase":"waiting","players":[],"turnOrder":[],"currentPlayer":0,"board":[],"chanceDeck":[],"communityDeck":[],"freeParkingPot":0,"dice":null,"doublesCount":0,"lastMoveSteps":null,"eventLog":[],"pendingAction":null,"justBoughtSpaceId":null,"builtThisStop":false,"reconnectGrace":null,"pendingTrades":[],"nextTradeId":0,"tradesEnabled":false}' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }))
    expect(await screen.findByText(/State applied/i)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith('/seed', expect.objectContaining({ method: 'POST' }))
  })
})
```

Note: the JSON used in the third test parses fine but would fail `validateStateStructure` (`board.length !== 40`) — that is expected: the panel's Apply posts regardless (validation is advisory; the server is authoritative and its rejection surfaces as an error message under the form). The mock controls the success path so the test asserts the happy flow.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/LoadScenarioPanel.test.tsx`
Expected: FAIL — module `../LoadScenarioPanel` cannot be resolved.

- [ ] **Step 4: Implement the hook**

Create `src/hooks/useServerConfig.ts`:

```ts
import { useEffect, useState } from 'react'

export function useServerConfig() {
  const [seedEnabled, setSeedEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { seedEnabled?: boolean } | null) => {
        if (cancelled) return
        setSeedEnabled(data?.seedEnabled ?? false)
      })
      .catch(() => {
        if (!cancelled) setSeedEnabled(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { seedEnabled, loading }
}
```

- [ ] **Step 5: Implement the panel component**

Create `src/components/LoadScenarioPanel.tsx` (uses `Button`, `useTranslation`, `useState`; omit semicolons):

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { validateStateStructure } from '../logic/seed'
import type { GameState } from '../types/game'

interface Props {
  seedEnabled: boolean
  code: string | null
}

export default function LoadScenarioPanel({ seedEnabled, code }: Props) {
  const { t } = useTranslation()
  const [json, setJson] = useState('')
  const [roomCode, setRoomCode] = useState(code ?? '')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!seedEnabled) return null

  function handleValidate() {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      setMessage({ kind: 'error', text: t('seed.invalidJson') })
      return
    }
    const result = validateStateStructure(parsed as GameState)
    setMessage(result.ok ? { kind: 'ok', text: t('seed.validJson') } : { kind: 'error', text: result.message })
  }

  async function handleApply() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode, state: JSON.parse(json) }),
      })
      const body = (await res.json().catch(() => null)) as { message?: string } | null
      if (res.ok) {
        setMessage({ kind: 'ok', text: t('seed.applied') })
        setJson('')
      } else {
        setMessage({ kind: 'error', text: `${t('seed.applyError')}: ${body?.message ?? res.status}` })
      }
    } catch {
      setMessage({ kind: 'error', text: t('seed.applyError') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-bg-card px-10 py-6 rounded-xl flex flex-col gap-3 min-w-[360px] border border-border-light">
      <h2 className="text-xl text-gold m-0">{t('seed.title')}</h2>
      <label className="text-sm text-muted">
        {t('seed.roomCode')}
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          maxLength={5}
          className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base w-full mt-1"
        />
      </label>
      <label className="text-sm text-muted">
        {t('seed.json')}
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={8}
          spellCheck={false}
          className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-xs font-mono w-full mt-1"
        />
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleValidate}>{t('seed.validate')}</Button>
        <Button size="sm" onClick={handleApply} disabled={busy}>{t('seed.apply')}</Button>
      </div>
      {message && (
        <p className={message.kind === 'ok' ? 'text-green-money text-sm' : 'text-red-danger text-sm'}>{message.text}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Mount the panel in the lobby**

In `src/components/Lobby.tsx`, add the hook + panel. Add near the top imports:

```tsx
import { useServerConfig } from '../hooks/useServerConfig'
import LoadScenarioPanel from './LoadScenarioPanel'
```

Inside `Lobby`, after the existing host-start block and before `</div>` (around line 71):

```tsx
const { seedEnabled } = useServerConfig()
```

And right after the RoomExit element:

```tsx
<LoadScenarioPanel seedEnabled={seedEnabled === true} code={code} />
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/LoadScenarioPanel.test.tsx`
Expected: PASS.

- [ ] **Step 8: Typecheck + lint + i18n build**

Run: `npm run typecheck && npm run lint`
Expected: PASS (lint should not add new warnings beyond the 2 pre-existing in `PlayerTokens.tsx`).

Run: `npm run build` — confirms both i18n files parse and the bundle builds.
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useServerConfig.ts src/components/LoadScenarioPanel.tsx src/components/Lobby.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/components/__tests__/LoadScenarioPanel.test.tsx
git commit -m "feat: dev-only Load Scenario panel for manual playtesting"
```

---

### Task 6: e2e seed helpers + `e2e/seed.spec.ts` (bankruptcy)

**Files:**
- Modify: `e2e/helpers/server.ts` (spawn env ~line 10–15)
- Create: `e2e/helpers/seed.ts`
- Create: `e2e/seed.spec.ts`

**Interfaces:**
- Consumes: `e2e/fixtures/bankruptcy-seed.ts` (`bankruptcySeed`, Task 4), `POST /seed` (Task 3).
- Produces:
  - `function seedGame(url: string, code: string, state: GameState): Promise<void>` — POSTs `/seed`, throws with the server body message on failure.
  - `e2e/seed.spec.ts` — single test driving the bankruptcy flow.
- Note: `e2e/*.ts` may import `import type { GameState } from '../src/types/game'` (type-only, erased) but MUST NOT import `src/logic/*` or `src/data/*` at runtime — Playwright's ESM loader rejects the repo's bare JSON imports.

- [ ] **Step 1: Enable the flag in the e2e server harness**

In `e2e/helpers/server.ts`, change the spawn env:

```ts
env: { ...process.env, PORT: String(port), E2E_SEED_ENABLED: 'true' },
```

- [ ] **Step 2: Write the seed helper**

Create `e2e/helpers/seed.ts`:

```ts
import type { GameState } from '../../src/types/game'

export async function seedGame(url: string, code: string, state: GameState): Promise<void> {
  const res = await fetch(`${url}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(`seed failed (HTTP ${res.status})${body?.message ? `: ${body.message}` : ''}`)
  }
}
```

- [ ] **Step 3: Write the failing e2e test**

Create `e2e/seed.spec.ts`:

```ts
import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { bankruptcySeed } from './fixtures/bankruptcy-seed'

test('a player cannot pay rent, declares bankruptcy, and the opponent wins', async ({ browser, serverUrl }) => {
  const contextA = await browser.newContext()
  await contextA.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  // Alpha (host) creates the room.
  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Alpha')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  // Bravo joins by code.
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Bravo')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Bravo')).toBeVisible({ timeout: 5000 })

  // Seed the decision point: Bravo owes $1,700 rent on Alpha's Boardwalk.
  await seedGame(serverUrl, code, bankruptcySeed)

  // Bravo (current player) is at the rent prompt on both clients.
  await expect(pageB.getByRole('button', { name: /Pay Rent/i })).toBeVisible({ timeout: 5000 })
  await expect(pageA.locator('[data-testid="waiting-for"]')).toContainText('Bravo')

  // Bravo attempts to pay — $1 < $1,700 → bankruptcy modal.
  await pageB.getByRole('button', { name: /Pay Rent/i }).click()
  await expect(pageB.locator('[data-testid="bankruptcy-modal"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.getByText(/cannot pay/i)).toContainText('$1,700')

  // Bravo declares bankruptcy.
  await pageB.getByRole('button', { name: /Declare Bankruptcy/i }).click()

  // Game over: Alpha wins on both clients; Bravo shows the bankrupt badge.
  await expect(pageB.getByText(/wins!/i)).toBeVisible({ timeout: 5000 })
  await expect(pageA.getByText(/wins!/i)).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText(/bankrupt/i)
})
```

- [ ] **Step 4: Add `data-testid` support to `Modal` and use it in the bankruptcy modal**

`src/components/Modals/Modal.tsx` only forwards `className`. Add an optional prop so tests can target the overlay:

In `src/components/Modals/Modal.tsx`:

```tsx
interface ModalProps {
  children: ReactNode
  onClose?: () => void
  className?: string
  dataTestId?: string
}

export default function Modal({ children, className = '', onClose, dataTestId }: ModalProps) {
  return (
    <div
      data-testid={dataTestId}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
    >
      <div
        className={[
          'bg-bg-card rounded-xl p-6 min-w-80 max-w-[500px] flex flex-col gap-3',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
```

In `src/components/Modals/BankruptcyModal.tsx`, pass `dataTestId="bankruptcy-modal"` to `<Modal>`. (Optional but nice: pass `dataTestId="game-over-modal"` in `GameOverModal.tsx` too.)

In `src/components/__tests__/BankruptcyModal.test.tsx`, add an assertion that the modal is targetable:

```tsx
expect(screen.getByTestId('bankruptcy-modal')).toBeVisible()
```

- [ ] **Step 5: Build and run the e2e test**

Run: `npm run build`
Run: `npx playwright test e2e/seed.spec.ts`
Expected: PASS. If the BankruptcyModal has no `data-testid`, first complete Step 4, rebuild, re-run.

- [ ] **Step 6: Run the full suite**

Run: `npm run test:unit`
Run: `npx playwright test`
Expected: all unit + existing e2e + new seed e2e pass.

- [ ] **Step 7: Commit**

```bash
git add e2e/helpers/server.ts e2e/helpers/seed.ts e2e/seed.spec.ts src/components/Modals/Modal.tsx src/components/Modals/BankruptcyModal.tsx src/components/__tests__/BankruptcyModal.test.tsx
git commit -m "test: seed-based e2e for bankruptcy on unpayable rent"
```

---

### Task 7: Docs (`AGENTS.md`)

**Files:**
- Modify: `AGENTS.md` (Commands + Gotchas sections)

- [ ] **Step 1: Document the new flag and endpoints**

In the Commands section, after the `TRADES_ENABLED` bullet, add:

```markdown
- `E2E_SEED_ENABLED=true npm run server` — enables the dev/test seed feature
  (env `E2E_SEED_ENABLED`, default disabled; anything other than the literal
  `true` disables it). When on, the server exposes `GET /config`
  (`{seedEnabled: true}`) and `POST /seed` (`{code, state}`), and the lobby
  shows a Load Scenario panel for pasting a full game-state JSON. Seeds replace
  the room's state wholesale (any phase) and broadcast to all clients.
```

In the Gotchas section, add a bullet:

```markdown
- Seeding is a dev/test-only capability: `POST /seed` returns 403 unless the
  server was launched with `E2E_SEED_ENABLED=true`. The Playwright e2e env sets
  it automatically (`e2e/helpers/server.ts`). To author a scenario, build one
  with `createSeededState` (`src/logic/seed.ts`) or generate it via
  `npm run print-seed`; the checked-in e2e scenario is
  `e2e/fixtures/bankruptcy-seed.ts` (generated, not hand-edited).
```

- [ ] **Step 2: Review the diff and commit**

Run: `git diff AGENTS.md`
Verify the wording matches the actual implementation (endpoint names, env var name, script name).

```bash
git add AGENTS.md
git commit -m "docs: document E2E_SEED_ENABLED seed/load-scenario feature"
```

---

## Self-Review Notes

- Spec coverage: §1 builder+validators → Task 1; §2 server plumbing → Tasks 2–3; §3 client hook/panel → Task 5; §4 e2e → Tasks 4+6; docs/commands → Task 7.
- The decision-point scenario (phase `Resolving` + `pendingAction` payRent) matches the approved spec revision and avoids the luck-weighted aimed-dice flakiness.
- Fixture generation constraint (Playwright ESM loader vs `src/data` JSON imports) is handled by Task 4 generating a plain typed literal.
- `validateStateForRoom` receives `SlotInfo` built from `game.getPlayers()` in the HTTP layer; `this.slots` is structurally compatible in `GameServer.seedState`.