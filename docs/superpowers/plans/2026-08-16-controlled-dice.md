# Controlled Dice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the random roll button with a hold-and-release target selector for human players, where a random per-roll luck value (0–100) concentrates the dice result around the chosen total — high luck ≈ near/at target, low luck ≈ normal random 2d6.

**Architecture:** A new pure shared module `src/logic/controlledDice.ts` produces the dice from a target + injectable rng, used identically by the local client (`useGame`) and the authoritative multiplayer server (`GameServer`). `RollDice`/`DiceAnimated` actions gain optional `target`/`luck` fields (additive wire change); the reducer only extends the `event.rolled` log when aiming. The hold-and-release interaction is component-local UI state in `DiceRoller.tsx`.

**Tech Stack:** React 19 + Vite 8 + TypeScript (strict, `erasableSyntaxOnly`), Tailwind v4, Vitest + Testing Library, Node `ws` server via `tsx`. Spec: `docs/superpowers/specs/2026-08-16-controlled-dice-design.md`.

## Global Constraints

- No TS enums — `const` objects + derived union types (`erasableSyntaxOnly: true`).
- `verbatimModuleSyntax: true` — type-only imports must use `import type`.
- `noUnusedLocals` / `noUnusedParameters` are on.
- i18n: every new UI string must exist in **both** `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys, `keySeparator: false`).
- Semicolons are mixed by file: `src/logic/*`, `src/data/*`, `src/types/game.ts` use semicolons; components/hooks/server files omit them. Match the file you edit.
- Wire values are part of the client/server contract and must never change; only *additive* optional fields are allowed.
- After each task, run `npm run typecheck`, `npm run lint`, and `npm run test:unit`.
- `gameReducer`'s `shuffle` uses `Math.random`; `GameServer` takes an injectable `rng` — tests must inject deterministic rngs.

---

### Task 1: Core algorithm `src/logic/controlledDice.ts`

**Files:**
- Create: `src/logic/controlledDice.ts`
- Test: `src/logic/__tests__/controlledDice.test.ts`

**Interfaces:**
- Produces: `export type ControlledDiceResult = { dice: [number, number]; luck: number }`
- Produces: `export function rollControlledDice(target: number, rng: () => number): ControlledDiceResult`
- Consumes: nothing (pure module).

- [ ] **Step 1: Write the failing test**

Create `src/logic/__tests__/controlledDice.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rollControlledDice } from '../controlledDice'

function sequence(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

// LCG producing [0,1); deterministic per run.
function lcgSequence(seed = 1): () => number {
  let x = seed
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280)
}

describe('rollControlledDice', () => {
  it('at luck 0 samples exactly standard 2d6', () => {
    // luck = floor(0 * 101) = 0; r = 0.5 * 36 = 18 → total 7; pair index 0 → (1, 6)
    const { dice, luck } = rollControlledDice(8, sequence(0, 0.5, 0))
    expect(luck).toBe(0)
    expect(dice).toEqual([1, 6])
  })

  it('at luck 100 always stays within the target neighborhood', () => {
    for (const target of [2, 7, 8, 12]) {
      for (let i = 0; i < 500; i++) {
        // Fresh rng per roll: first call forces luck 100, the rest come from the LCG.
        const lcg = lcgSequence(i + 1)
        let first = true
        const rng = () => (first ? ((first = false), 0.999) : lcg())
        const r = rollControlledDice(target, rng)
        const total = r.dice[0] + r.dice[1]
        expect(total).toBeGreaterThanOrEqual(Math.max(2, target - 3))
        expect(total).toBeLessThanOrEqual(Math.min(12, target + 3))
      }
    }
  })

  it('at luck 100 makes the target the most common total', () => {
    const counts = new Map<number, number>()
    for (let i = 0; i < 1000; i++) {
      const lcg = lcgSequence(i + 1)
      let first = true
      const rng = () => (first ? ((first = false), 0.999) : lcg())
      const r = rollControlledDice(8, rng)
      const total = r.dice[0] + r.dice[1]
      counts.set(total, (counts.get(total) ?? 0) + 1)
      expect(r.luck).toBe(100)
    }
    const targetCount = counts.get(8) ?? 0
    for (const [total, count] of counts) {
      if (total !== 8) expect(targetCount).toBeGreaterThan(count)
    }
  })

  it('at mid luck clusters toward the target more than random', () => {
    const counts = new Map<number, number>()
    for (let i = 0; i < 2000; i++) {
      const lcg = lcgSequence(i + 1)
      let first = true
      const rng = () => (first ? ((first = false), 0.5) : lcg()) // luck 50
      const r = rollControlledDice(8, rng)
      const total = r.dice[0] + r.dice[1]
      counts.set(total, (counts.get(total) ?? 0) + 1)
    }
    const middle = [5, 6, 7, 8, 9].reduce((s, t) => s + (counts.get(t) ?? 0), 0)
    const outer = [2, 3, 4, 10, 11, 12].reduce((s, t) => s + (counts.get(t) ?? 0), 0)
    expect(middle).toBeGreaterThan(outer * 2)
  })

  it('deterministically rolls a known mid-luck result', () => {
    // luck 50, total 8, pair index 2 → (4, 4)
    const r = rollControlledDice(8, sequence(0.5, 0.5, 0.5))
    expect(r.luck).toBe(50)
    expect(r.dice).toEqual([4, 4])
  })

  it('always produces valid dice and a luck in 0..100', () => {
    const lcg = lcgSequence()
    for (const target of [2, 5, 7, 12]) {
      for (let i = 0; i < 2000; i++) {
        const r = rollControlledDice(target, lcg)
        expect(r.luck).toBeGreaterThanOrEqual(0)
        expect(r.luck).toBeLessThanOrEqual(100)
        expect(r.dice[0]).toBeGreaterThanOrEqual(1)
        expect(r.dice[0]).toBeLessThanOrEqual(6)
        expect(r.dice[1]).toBeGreaterThanOrEqual(1)
        expect(r.dice[1]).toBeLessThanOrEqual(6)
        expect(r.dice[0] + r.dice[1]).toBeGreaterThanOrEqual(2)
        expect(r.dice[0] + r.dice[1]).toBeLessThanOrEqual(12)
      }
    }
  })

  it('is a pure function of its rng', () => {
    const a = rollControlledDice(9, sequence(0.5, 0.1, 0.7))
    const b = rollControlledDice(9, sequence(0.5, 0.1, 0.7))
    expect(a).toEqual(b)
  })
})
```

> Note: each statistical test creates a fresh rng per roll so the first call forces a fixed luck (0.999 → 100, 0.5 → 50) on every roll while the remaining two calls (total, pair) come from a deterministic LCG seeded per roll. Assertions use generous margins so the tests are not flaky.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/__tests__/controlledDice.test.ts`
Expected: FAIL — module `../controlledDice` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/logic/controlledDice.ts` (semicolons, matching `src/logic/*`):

```ts
export type ControlledDiceResult = { dice: [number, number]; luck: number };

const TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const STANDARD_COUNTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

const PEAK_WEIGHTS: Record<number, number> = { 0: 10, 1: 4, 2: 2, 3: 1 };

function buildPeakWeights(target: number): Record<number, number> {
  const weights: Record<number, number> = {};
  for (const [offset, weight] of Object.entries(PEAK_WEIGHTS)) {
    const o = Number(offset);
    for (const t of new Set([target - o, target + o])) {
      if (t >= 2 && t <= 12) weights[t] = (weights[t] ?? 0) + weight;
    }
  }
  return weights;
}

export function rollControlledDice(target: number, rng: () => number): ControlledDiceResult {
  const luck = Math.min(100, Math.floor(rng() * 101));
  const alpha = luck / 100;
  const peak = buildPeakWeights(target);

  let sum = 0;
  const weights: Record<number, number> = {};
  for (const total of TOTALS) {
    const w = alpha * (peak[total] ?? 0) + (1 - alpha) * STANDARD_COUNTS[total];
    weights[total] = w;
    sum += w;
  }

  let r = rng() * sum;
  let total = TOTALS[TOTALS.length - 1];
  for (const t of TOTALS) {
    r -= weights[t];
    if (r < 0) {
      total = t;
      break;
    }
  }

  const pairs: [number, number][] = [];
  for (let a = 1; a <= 6; a++) {
    const b = total - a;
    if (b >= 1 && b <= 6) pairs.push([a, b]);
  }
  const dice = pairs[Math.floor(rng() * pairs.length)];
  return { dice, luck };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/logic/__tests__/controlledDice.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/logic/controlledDice.ts src/logic/__tests__/controlledDice.test.ts
git commit -m "feat: controlled dice luck algorithm"
```

---

### Task 2: Action types + reducer aim logging

**Files:**
- Modify: `src/types/game.ts` (GameAction union, lines 171–198)
- Modify: `src/logic/gameReducer.ts` (DiceAnimated handler, line ~161)
- Test: `src/logic/__tests__/gameReducer.test.ts` (in `describe('ROLL_DICE + DICE_ANIMATED')`, after line ~125)

**Interfaces:**
- Consumes: Task 1 `ControlledDiceResult` (not needed here — this task only shapes actions).
- Produces: `GameAction.RollDice` gains optional `target?: number`; `GameAction.DiceAnimated` gains optional `target?: number; luck?: number`. New log key `event.rolledAimed` with params `{ name, d1, d2, total, target, luck }`. These are consumed by Tasks 3, 4, 5, 6.

- [ ] **Step 1: Write the failing test**

Add to `src/logic/__tests__/gameReducer.test.ts` inside the existing `describe('ROLL_DICE + DICE_ANIMATED', () => {...})` block (after the `collects 200 when passing GO` test):

```ts
    it('logs event.rolledAimed with target and luck when aiming', () => {
      const state = makeStartedState();
      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 4], target: 7, luck: 80 });
      const entry = s2.eventLog[s2.eventLog.length - 1];
      expect(entry.key).toBe('event.rolledAimed');
      expect(entry.params).toEqual(expect.objectContaining({ d1: 3, d2: 4, total: 7, target: 7, luck: 80 }));
    });

    it('logs plain event.rolled without target or luck when not aiming', () => {
      const state = makeStartedState();
      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 4] });
      const entry = s2.eventLog[s2.eventLog.length - 1];
      expect(entry.key).toBe('event.rolled');
      expect(entry.params).not.toHaveProperty('target');
      expect(entry.params).not.toHaveProperty('luck');
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — `TypeScript: Object literal may only specify known properties ... 'target' does not exist in type 'DiceAnimated'`.

- [ ] **Step 3: Update the action types**

In `src/types/game.ts`, change (inside the `GameAction` union):

```ts
  | { type: typeof GameActionType.RollDice }
```
→
```ts
  | { type: typeof GameActionType.RollDice; target?: number }
```

and

```ts
  | { type: typeof GameActionType.DiceAnimated; dice: [number, number] }
```
→
```ts
  | { type: typeof GameActionType.DiceAnimated; dice: [number, number]; target?: number; luck?: number }
```

- [ ] **Step 4: Update the reducer log**

In `src/logic/gameReducer.ts`, in the `DiceAnimated` case, replace:

```ts
      const newEventLog = [...state.eventLog, { key: 'event.rolled', params: { name: player.name, d1: dice[0], d2: dice[1], total } }];
```

with:

```ts
      const aimed = action.target !== undefined && action.luck !== undefined;
      const rolledEntry: LogEntry = aimed
        ? { key: 'event.rolledAimed', params: { name: player.name, d1: dice[0], d2: dice[1], total, target: action.target, luck: action.luck } }
        : { key: 'event.rolled', params: { name: player.name, d1: dice[0], d2: dice[1], total } };
      const newEventLog = [...state.eventLog, rolledEntry];
```

(`LogEntry` is already imported in this file.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: PASS (all tests, including the 2 new ones).

- [ ] **Step 6: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/logic/__tests__/gameReducer.test.ts
git commit -m "feat: carry roll target/luck through actions and log event.rolledAimed"
```

---

### Task 3: i18n keys (en + id)

**Files:**
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: Task 2 `event.rolledAimed` key.
- Produces: keys `dice.aiming`, `event.rolledAimed`. Consumed by Tasks 4, 6 at runtime.

- [ ] **Step 1: Add English keys**

In `src/i18n/locales/en/translation.json`:
- Near the other `dice.*` keys (line ~170) add:

```json
  "dice.aiming": "Aiming: {{target}}",
```

- Directly after the `event.rolled` line (line 77) add:

```json
  "event.rolledAimed": "{{name}} rolled {{d1}}+{{d2}}={{total}} (aimed for {{target}}, luck {{luck}})",
```

Make sure the JSON stays valid (commas between siblings).

- [ ] **Step 2: Add Indonesian keys**

In `src/i18n/locales/id/translation.json`:
- Near the other `dice.*` keys add:

```json
  "dice.aiming": "Membidik: {{target}}",
```

- After the `event.rolled` line (line 77) add:

```json
  "event.rolledAimed": "{{name}} melempar {{d1}}+{{d2}}={{total}} (membidik {{target}}, keberuntungan {{luck}})",
```

- [ ] **Step 3: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green (JSON parses; no test references these keys yet).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: i18n keys for aiming readout and aimed roll log"
```

---

### Task 4: Local + network `roll(target?)`

**Files:**
- Modify: `src/hooks/useGame.ts` (line ~50 `roll`)
- Modify: `src/hooks/useNetworkGame.ts` (line 85 `roll`)
- Test: `src/hooks/__tests__/useGame.test.ts`

**Interfaces:**
- Consumes: Task 1 `rollControlledDice`; Task 2 `RollDice.target?`.
- Produces: `GameApi['roll']` becomes `(target?: number) => void`. `useNetworkGame.roll` same signature. Consumed by Task 6 (`DiceRoller.onRoll`).

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `src/hooks/__tests__/useGame.test.ts` (file style: no semicolons, single quotes):

```ts
describe('useGame controlled dice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rolls controlled dice toward the given target and logs the aim', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // luck 50, total 8, pair (4,4)
    const { result } = renderHook(() => useGame())
    act(() => result.current.startGame([{ name: 'Alice', isBot: false }, { name: 'Bob', isBot: false }]))

    act(() => result.current.roll(8))
    act(() => vi.advanceTimersByTime(500)) // DICE_ANIMATED
    expect(result.current.state.dice).toEqual([4, 4])
    expect(result.current.state.doublesCount).toBe(1)

    const entry = result.current.state.eventLog[result.current.state.eventLog.length - 1]
    expect(entry.key).toBe('event.rolledAimed')
    expect(entry.params).toEqual(expect.objectContaining({ target: 8, luck: 50 }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useGame.test.ts`
Expected: FAIL — the log entry key is `event.rolled` (the target is dropped because `roll()` still takes no argument and dispatches `RollDice` without `target`).

- [ ] **Step 3: Update `useGame.ts`**

Add the import at the top of `src/hooks/useGame.ts` (near the other `../logic` imports):

```ts
import { rollControlledDice } from '../logic/controlledDice'
```

Replace the existing `roll` (lines 50–60):

```ts
  const roll = useCallback((target?: number) => {
    dispatch({ type: GameActionType.RollDice })
    let dice: [number, number]
    let aimed: { target: number; luck: number } | undefined
    if (target != null) {
      const result = rollControlledDice(target, Math.random)
      dice = result.dice
      aimed = { target, luck: result.luck }
    } else {
      const d1 = Math.floor(Math.random() * 6) + 1
      const d2 = Math.floor(Math.random() * 6) + 1
      dice = [d1, d2]
    }
    const total = dice[0] + dice[1]
    const animDuration = 500 + total * 150
    setTimeout(() => {
      dispatch({ type: GameActionType.DiceAnimated, dice, ...(aimed ?? {}) })
      setTimeout(() => dispatch({ type: GameActionType.ResolveSpace }), animDuration)
    }, 500)
  }, [])
```

- [ ] **Step 4: Update `useNetworkGame.ts`**

Replace line 85:

```ts
  const roll = useCallback(() => sendAction({ type: GameActionType.RollDice }), [sendAction])
```
→
```ts
  const roll = useCallback(
    (target?: number) => sendAction({ type: GameActionType.RollDice, ...(target != null ? { target } : {}) }),
    [sendAction],
  )
```

No changes needed to `src/types/net.ts` or `src/net/client.ts`: the target rides inside the `GameAction` on the existing `ClientMessage.Action` (additive optional field).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/useGame.test.ts`
Expected: PASS (existing tests + new controlled-dice test).

- [ ] **Step 6: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useGame.ts src/hooks/useNetworkGame.ts src/hooks/__tests__/useGame.test.ts
git commit -m "feat: roll(target?) for local and network games"
```

---

### Task 5: Authoritative server roll

**Files:**
- Modify: `server/gameServer.ts` (`roll` line 202, `startRoll` line 214, `handleAction` line 233)
- Test: `server/__tests__/gameServer.test.ts`

**Interfaces:**
- Consumes: Task 1 `rollControlledDice`; Task 2 `RollDice.target?`.
- Produces: `GameServer.roll(clientId, target?)`, `GameServer.startRoll(target?)`. `handleAction` forwards `action.target` for `ROLL_DICE`. Bots keep rolling random via `startRoll()` (unchanged, no target).

- [ ] **Step 1: Write the failing test**

Add to `server/__tests__/gameServer.test.ts` (after the `rolls authoritative dice...` test, ~line 89):

```ts
  it('rolls controlled dice toward the client target', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0.5, 0.5, 0.5][n++] ?? 0.5) // luck 50, total 8, pair (4,4)
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0', 8)
    expect(server.getState().phase).toBe(GamePhase.Rolling)

    vi.advanceTimersByTime(500)
    expect(server.getState().dice).toEqual([4, 4])
    const entry = server.getState().eventLog[server.getState().eventLog.length - 1]
    expect(entry.key).toBe('event.rolledAimed')
    expect(entry.params).toEqual(expect.objectContaining({ target: 8, luck: 50 }))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: FAIL — `TypeScript: Expected 1 arguments, but got 2` on `server.roll('c0', 8)`.

- [ ] **Step 3: Update `server/gameServer.ts`**

Add the import at the top (near `decideBotAction`):

```ts
import { rollControlledDice } from '../src/logic/controlledDice'
```

Change `roll` (line 202) signature and call:

```ts
  roll(clientId: ClientId, target?: number): void {
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Bukan giliranmu' })
      return
    }
    if (this.state.phase !== GamePhase.Waiting || this.state.pendingAction || this.state.dice !== null) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Belum bisa melempar dadu' })
      return
    }
    this.startRoll(target)
  }
```

Change `startRoll` (line 214):

```ts
  private startRoll(target?: number): void {
    this.dispatch({ type: GameActionType.RollDice })
    let dice: [number, number]
    let aimed: { target: number; luck: number } | undefined
    if (target != null) {
      const result = rollControlledDice(target, this.rng)
      dice = result.dice
      aimed = { target, luck: result.luck }
    } else {
      dice = [1 + Math.floor(this.rng() * 6), 1 + Math.floor(this.rng() * 6)]
    }
    const animDuration = 500 + (dice[0] + dice[1]) * 150

    setTimeout(() => {
      if (this.state.phase === GamePhase.Rolling) {
        this.dispatch({ type: GameActionType.DiceAnimated, dice, ...(aimed ?? {}) })
        setTimeout(() => {
          if (this.state.phase === GamePhase.Moving) {
            this.dispatch({ type: GameActionType.ResolveSpace })
          }
        }, animDuration)
      }
    }, 500)
  }
```

Change `handleAction` (line 233):

```ts
    if (action.type === GameActionType.RollDice) {
      this.roll(clientId, action.target)
      return
    }
```

Bot path (line 365 `this.startRoll()`) stays untouched — bots roll random.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: PASS (existing + new test).

- [ ] **Step 5: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts
git commit -m "feat: server-authoritative controlled dice roll"
```

---

### Task 6: Hold-and-release UI in `DiceRoller.tsx`

**Files:**
- Modify: `src/components/DiceRoller.tsx`
- Test: `src/components/__tests__/DiceRoller.test.tsx`

**Interfaces:**
- Consumes: Task 4 `GameApi['roll']` signature `(target?: number) => void` (via `onRoll` prop); Task 3 key `dice.aiming`.
- Produces: `DiceRoller` prop `onRoll: (target: number) => void`; hold-to-roll button + `data-testid="dice-aim"` aiming readout.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/__tests__/DiceRoller.test.tsx` (extend imports: `import { screen, cleanup, fireEvent, act } from '@testing-library/react'`):

```tsx
  describe('hold-to-roll control', () => {
    it('rolls the locked target after press, tick, and release', () => {
      vi.useFakeTimers()
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      expect(screen.getByTestId('dice-aim')).toHaveTextContent('Aiming: 2')

      act(() => vi.advanceTimersByTime(240)) // 2 → 3 → 4 → 5
      expect(screen.getByTestId('dice-aim')).toHaveTextContent('Aiming: 5')

      fireEvent.pointerUp(button)
      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(5)
      vi.useRealTimers()
    })

    it('rolls the target via keyboard hold', () => {
      vi.useFakeTimers()
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.keyDown(button, { key: ' ' })
      act(() => vi.advanceTimersByTime(160)) // 2 → 3 → 4
      fireEvent.keyUp(button, { key: ' ' })

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(4)
      vi.useRealTimers()
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: FAIL — no `dice-aim` element and `onRoll` is never called (button still uses `onClick`).

- [ ] **Step 3: Rewrite `src/components/DiceRoller.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GamePhase, type GameState } from '../types/game'
import Dice from './Dice'
import Button from './Button'

interface Props {
  state: GameState
  onRoll: (target: number) => void
  isMyTurn?: boolean
}

const TICK_MS = 80
const MIN_TOTAL = 2
const MAX_TOTAL = 12

export default function DiceRoller({ state, onRoll, isMyTurn = true }: Props) {
  const { t } = useTranslation()
  const [rolling, setRolling] = useState(false)
  const [holding, setHolding] = useState(false)
  const [tickerValue, setTickerValue] = useState(MIN_TOTAL)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  useEffect(() => {
    if (!holding) return
    const id = setInterval(() => {
      setTickerValue((v) => {
        const next = v + directionRef.current
        if (next > MAX_TOTAL) directionRef.current = -1
        else if (next < MIN_TOTAL) directionRef.current = 1
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [holding])

  function startHold() {
    if (rolling) return
    directionRef.current = 1
    setTickerValue(MIN_TOTAL)
    setHolding(true)
  }

  function lockTarget() {
    if (!holding) return
    setHolding(false)
    setRolling(true)
    onRoll(tickerValue)
    setTimeout(() => setRolling(false), 500)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) startHold()
    }
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      lockTarget()
    }
  }

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center">
        <Dice value={state.dice?.[0]} rolling={rolling} />
        <Dice value={state.dice?.[1]} rolling={rolling} />
      </div>
      {holding && (
        <p data-testid="dice-aim" className="text-lg font-bold text-gold">
          {t('dice.aiming', { target: tickerValue })}
        </p>
      )}
      {(canRoll || canRollJail) && isMyTurn && (
        <Button
          variant="primary"
          size="lg"
          onPointerDown={(e) => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // ignore (e.g. jsdom / synthetic events)
            }
            startHold()
          }}
          onPointerUp={lockTarget}
          onPointerCancel={() => setHolding(false)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
        >
          {player.inJail ? t('dice.rollJail') : state.doublesCount > 0 ? t('action.rollAgain') : t('dice.roll')}
        </Button>
      )}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-base text-muted text-center">
          {t('dice.doubles', { result: state.dice[0] === state.dice[1] ? t('common.yes') : t('action.no'), n: 3 - player.jailTurns })}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: PASS — all 5 tests (3 existing + 2 new). Existing tests pass unchanged because `() => void` is assignable to `(target: number) => void`.

- [ ] **Step 5: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 6: Manual smoke check (optional)**

Run `npm run dev`, start a local 2-human game, confirm: press-and-hold the roll button shows "Aiming: N", the number ticks up and down 2–12, release rolls, and the log shows the aimed entry ("(aimed for N, luck M)").

- [ ] **Step 7: Commit**

```bash
git add src/components/DiceRoller.tsx src/components/__tests__/DiceRoller.test.tsx
git commit -m "feat: hold-and-release controlled dice UI"
```

---

### Task 7: Multiplayer e2e smoke (guarded)

**Files:**
- Modify: `e2e/multiplayer.spec.ts` (append one test)

**Interfaces:**
- Consumes: Tasks 4–6 end-to-end via the real server + two browser pages.

- [ ] **Step 1: Ensure dist is built**

Run: `npm run build`
Expected: build succeeds (the multiplayer spec serves `dist/`).

- [ ] **Step 2: Add an e2e test**

Append to `e2e/multiplayer.spec.ts` (same pattern as the existing tests: own `context` + `addInitScript` + `pageA`/`pageB`):

```ts
test('a player can hold-to-roll without breaking multiplayer', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()

  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')

  await pageA.click('button:has-text("Start")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Hold the roll button ~400ms, then release → a target locks and a roll resolves.
  const roll = pageA.locator('button:has-text("Roll")')
  const hostRolls = await roll.isVisible()
  const current = hostRolls ? pageA : pageB
  const roller = current.locator('button:has-text("Roll"), button:has-text("Roll Again")').first()
  const box = await roller.boundingBox()
  if (box) {
    await current.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await current.mouse.down()
    await current.waitForTimeout(400)
    await current.mouse.up()
  }
  await expect(current.locator('[data-testid="dice-pip"]').first()).toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 3: Run the multiplayer e2e spec**

Run: `npm run test:e2e -- --project=chromium e2e/multiplayer.spec.ts`
Expected: the new test passes alongside the existing ones.

- [ ] **Step 4: Commit**

```bash
git add e2e/multiplayer.spec.ts
git commit -m "test: e2e smoke for controlled dice in multiplayer"
```
