# Bot Multi-Build on Land Scarcity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When land is scarce (fewer than 25% of buyable spaces unowned), a bot that lands on one of its own buildable properties keeps building houses on it — up to `MAX_HOUSES` or a cash-reserve floor — instead of the current one-build-per-landing cap.

**Architecture:** Pure bot-brain change in `src/logic/bot.ts`. The engine (`gameReducer` `BuildHouse`) already accepts repeated builds — it only sets `builtThisStop`, never reads it — and the server's `driveBots` loop (`server/gameServer.ts:390`) re-calls `decideBotAction` after every action, so multiple `BUILD_HOUSE` actions in one turn work with zero engine/server changes. `buildAction` bypasses the `state.builtThisStop` guard only when `isLandScarce(state)` is true, and adds a reserve check (`player.money - cost >= BUILD_CASH_RESERVE`) only in scarce mode. Normal-mode behavior is byte-for-byte unchanged.

**Tech Stack:** TypeScript, Vitest, existing Monopoly game logic.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-20-bot-multi-build-on-scarcity-design.md` (approved 2026-08-20).
- No TS enums — `erasableSyntaxOnly: true`; `verbatimModuleSyntax: true` (type-only imports must use `import type`); `noUnusedLocals`/`noUnusedParameters` are on.
- Semicolons: `src/logic/*` and `src/logic/__tests__/*` use semicolons. Match the file.
- Wire values (action types, etc.) must never change — we are not touching them.
- No engine, `GameState`, wire-type, or server changes. The reserve applies **only** in scarce mode; normal-mode bot behavior stays exactly as today.
- Buyable spaces = `Property` (22) + `Railroad` (4) + `Utility` (2) = 28. "Scarce" = `unowned * 4 < 28`, i.e. unowned ≤ 6.
- Verification required before completion: `npm run typecheck`, `npm run lint`, `npm run test:unit` (all pass cleanly).

---

### Task 1: Scarcity trigger — bypass the one-per-landing guard when land is scarce

**Files:**
- Modify: `src/logic/__tests__/bot.test.ts` (add helper + 2 tests; imports unchanged for this task)
- Modify: `src/logic/bot.ts` (add `isLandScarce` + guard change)
- Verify only: `src/logic/gameReducer.ts:414-445` (`BuildHouse` case — already accepts repeated builds; no change)

**Interfaces:**
- Consumes: `GameState` (`board`, `currentPlayer`), `SpaceType` (`Property`/`Railroad`/`Utility`), `MAX_HOUSES`.
- Produces: `function isLandScarce(state: GameState): boolean` (internal, not exported) — true when `unowned * 4 < buyable.length`. `buildAction(state)` now returns `BUILD_HOUSE` even when `state.builtThisStop === true`, provided `isLandScarce(state)` is true.

- [ ] **Step 1: Add the `boardWithUnowned` helper to `bot.test.ts`**

Add after the `colorGroup` helper (after line 58 in `src/logic/__tests__/bot.test.ts`):

```typescript
function boardWithUnowned(unowned: number, target: Space): Space[] {
  const board = createInitialBoard();
  const buyable = board.filter((s) =>
    [SpaceType.Property, SpaceType.Railroad, SpaceType.Utility].includes(s.type),
  );
  const owned = buyable.length - unowned;
  let count = 0;
  for (const s of buyable) {
    if (s.id === target.id) {
      board[s.id] = { ...s, owner: 0 };
      count++;
    } else if (count < owned) {
      board[s.id] = { ...s, owner: 1 };
      count++;
    } else {
      board[s.id] = { ...s, owner: null };
    }
  }
  return board;
}
```

The helper owns exactly `28 - unowned` buyable spaces (always including `target`, owned by player 0) and leaves `unowned` buyable spaces with `owner: null`. `Space` is already imported in the test file.

- [ ] **Step 2: Add the failing tests for the boundary**

Add these two tests inside the `describe('decideBotAction')` block in `bot.test.ts` (after the existing `builds only once per landing` test at line 220):

```typescript
  it('builds only once per landing when land is not scarce (7 unowned)', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    const state = makeState(
      { board: boardWithUnowned(7, target), dice: [3, 4], builtThisStop: true },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });

  it('builds again despite builtThisStop when land is scarce (6 unowned)', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    const state = makeState(
      { board: boardWithUnowned(6, target), dice: [3, 4], builtThisStop: true },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`

Expected: FAIL on `builds again despite builtThisStop when land is scarce (6 unowned)` — `decideBotAction` returns `{ type: 'END_TURN' }` because `buildAction` hits the unconditional `if (state.builtThisStop) return null;`. The `7 unowned` test PASSES (not scarce → `END_TURN`).

- [ ] **Step 4: Add `isLandScarce` and update the guard in `bot.ts`**

In `src/logic/bot.ts`, after the import block (line 4), add:

```typescript
const BUYABLE_TYPES = [SpaceType.Property, SpaceType.Railroad, SpaceType.Utility];

function isLandScarce(state: GameState): boolean {
  const buyable = state.board.filter((s) => BUYABLE_TYPES.includes(s.type));
  const unowned = buyable.filter((s) => s.owner === null).length;
  return unowned * 4 < buyable.length;
}
```

Then in `buildAction` (line 56), replace:

```typescript
  if (state.builtThisStop) return null;
```

with:

```typescript
  if (state.builtThisStop && !isLandScarce(state)) return null;
```

`SpaceType` is already imported from `../types/game`. The resulting `buildAction`:

```typescript
function buildAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  const space = state.board[player.position];
  if (!space || space.type !== SpaceType.Property) return null;
  if (space.owner !== state.currentPlayer) return null;
  if (space.houses >= MAX_HOUSES || space.mortgaged) return null;
  if (space.id === state.justBoughtSpaceId) return null;
  if (state.builtThisStop && !isLandScarce(state)) return null;
  const cost = getHouseCost(space, space.houses);
  if (cost === 0 || player.money < cost) return null;
  return { type: GameActionType.BuildHouse, spaceId: space.id };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`

Expected: PASS — both new boundary tests pass, and all existing bot tests still pass (they use fully-unowned boards → not scarce → unchanged behavior).

- [ ] **Step 6: Commit**

```bash
git add src/logic/bot.ts src/logic/__tests__/bot.test.ts
git commit -m "feat: let bots multi-build when land is scarce"
```

---

### Task 2: Multi-build loop end-to-end

**Files:**
- Modify: `src/logic/__tests__/bot.test.ts` (imports + 1 test)
- Verify only: `server/gameServer.ts:390-458` (`driveBots` loop — re-calls `decideBotAction` after each action; no change)

**Interfaces:**
- Consumes: `gameReducer(state, action)` from `../gameReducer` (already imported in test), `GameActionType` (already imported), `MAX_HOUSES` from `../../data/board`.
- Produces: (none — verifies Task 1's behavior holds across a full loop of reducer applications, mirroring the server's `driveBots` loop.)

- [ ] **Step 1: Add `GameAction` and `MAX_HOUSES` imports to `bot.test.ts`**

Change line 8 of `src/logic/__tests__/bot.test.ts` from:

```typescript
import { createInitialBoard, STARTING_MONEY, JAIL_FINE } from '../../data/board';
```

to:

```typescript
import { createInitialBoard, STARTING_MONEY, JAIL_FINE, MAX_HOUSES } from '../../data/board';
```

And the type-only line inside the `../../types/game` import (line 6) from:

```typescript
  type GameState, type Player, type Space, type TradeOffer,
```

to:

```typescript
  type GameState, type Player, type Space, type TradeOffer, type GameAction,
```

(`GameActionType` stays in the value import on line 5; `GameAction` is added to the type-only line 6.)

- [ ] **Step 2: Add the failing multi-build loop test**

Add after the scarce-boundary tests from Task 1:

```typescript
  it('builds up to MAX_HOUSES in scarce land when it can afford it', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    let state = makeState(
      { board: boardWithUnowned(6, target), dice: [3, 4] },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    const actions: GameAction[] = [];
    let action = decideBotAction(state);
    while (action && action.type === 'BUILD_HOUSE') {
      actions.push(action);
      state = gameReducer(state, action);
      action = decideBotAction(state);
    }
    expect(actions.length).toBe(MAX_HOUSES);
    expect(state.board[target.id].houses).toBe(MAX_HOUSES);
    expect(action).toEqual({ type: 'END_TURN' });
  });
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`

Expected: PASS — this is a behavioral lock on Task 1's work: the loop issues 5 `BUILD_HOUSE` actions (one per `driveBots`-style re-call), reaches `houses === 5`, then `END_TURN`. If it FAILS with `actions.length === 1`, the `builtThisStop` bypass from Task 1 is missing or regressed — fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/logic/__tests__/bot.test.ts
git commit -m "test: cover bot multi-build loop to MAX_HOUSES"
```

---

### Task 3: Cash reserve floor in scarce mode

**Files:**
- Modify: `src/logic/bot.ts` (export `BUILD_CASH_RESERVE`; add reserve guard)
- Modify: `src/logic/__tests__/bot.test.ts` (imports + 1 test)

**Interfaces:**
- Consumes: `STARTING_MONEY` from `../data/board` (new import), `getHouseCost` (already imported in `bot.ts`).
- Produces: `export const BUILD_CASH_RESERVE: number` — `Math.floor(STARTING_MONEY * 0.1)` (= 150 at default config). In scarce mode, `buildAction` refuses a build when `player.money - cost < BUILD_CASH_RESERVE`.

- [ ] **Step 1: Add the failing reserve test**

Add imports to `bot.test.ts`. Change line 2 from:

```typescript
import { decideBotAction, shouldAcceptTrade } from '../bot';
```

to:

```typescript
import { decideBotAction, shouldAcceptTrade, BUILD_CASH_RESERVE } from '../bot';
```

And add `getHouseCost` to the `../../data/board` import (alongside `MAX_HOUSES` from Task 2):

```typescript
import { createInitialBoard, STARTING_MONEY, JAIL_FINE, MAX_HOUSES, getHouseCost } from '../../data/board';
```

Add this test after the multi-build loop test:

```typescript
  it('stops before breaching the cash reserve in scarce land', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    const cost = getHouseCost(board[target.id], 0);
    const state = makeState(
      { board: boardWithUnowned(6, target), dice: [3, 4] },
      makePlayer({ properties: [target.id], money: BUILD_CASH_RESERVE + cost, position: target.id }),
    );
    const first = decideBotAction(state);
    if (!first) throw new Error('expected a build');
    expect(first).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
    const after = gameReducer(state, first);
    expect(after.players[0].money).toBe(BUILD_CASH_RESERVE);
    expect(decideBotAction(after)).toEqual({ type: 'END_TURN' });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`

Expected: FAIL on `stops before breaching the cash reserve in scarce land` — without the reserve guard, `decideBotAction(after)` returns `{ type: 'BUILD_HOUSE', spaceId: target.id }` (the bot builds again despite dropping below $150), not `END_TURN`. Also the test file fails to compile (`BUILD_CASH_RESERVE` is not exported yet) — that is the expected red state.

- [ ] **Step 3: Add `BUILD_CASH_RESERVE` and the reserve guard in `bot.ts`**

In `src/logic/bot.ts`, change line 4 from:

```typescript
import { getHouseCost, JAIL_FINE, MAX_HOUSES } from '../data/board';
```

to:

```typescript
import { getHouseCost, JAIL_FINE, MAX_HOUSES, STARTING_MONEY } from '../data/board';
```

Add after the import block (before `BUYABLE_TYPES` from Task 1):

```typescript
export const BUILD_CASH_RESERVE = Math.floor(STARTING_MONEY * 0.1);
```

In `buildAction`, replace:

```typescript
  if (cost === 0 || player.money < cost) return null;
```

with:

```typescript
  if (cost === 0 || player.money < cost) return null;
  if (isLandScarce(state) && player.money - cost < BUILD_CASH_RESERVE) return null;
```

The resulting `buildAction`:

```typescript
function buildAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  const space = state.board[player.position];
  if (!space || space.type !== SpaceType.Property) return null;
  if (space.owner !== state.currentPlayer) return null;
  if (space.houses >= MAX_HOUSES || space.mortgaged) return null;
  if (space.id === state.justBoughtSpaceId) return null;
  if (state.builtThisStop && !isLandScarce(state)) return null;
  const cost = getHouseCost(space, space.houses);
  if (cost === 0 || player.money < cost) return null;
  if (isLandScarce(state) && player.money - cost < BUILD_CASH_RESERVE) return null;
  return { type: GameActionType.BuildHouse, spaceId: space.id };
}
```

Note: the second `isLandScarce(state)` call is intentional — the guard only applies in scarce mode, keeping normal-mode behavior identical to today. (`isLandScarce` is pure and cheap; the double call is fine, but for clarity assign it to a local at the top of the function if preferred.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`

Expected: PASS — reserve test passes (builds exactly once, money lands exactly at `BUILD_CASH_RESERVE`, then `END_TURN`); all other bot tests pass.

- [ ] **Step 5: Run the full verification suite**

Run:
- `npm run typecheck` — expected PASS (no unused imports; `verbatimModuleSyntax` honored)
- `npm run lint` — expected PASS
- `npm run test:unit` — expected PASS (all tests, including `gameReducer` build tests which we did not touch)

- [ ] **Step 6: Commit**

```bash
git add src/logic/bot.ts src/logic/__tests__/bot.test.ts
git commit -m "feat: keep cash reserve when bots multi-build on scarce land"
```

---

## Self-Review Notes

- **Spec coverage:** scarcity trigger (Task 1), multi-build loop to `MAX_HOUSES` (Task 2), reserve floor (Task 3), normal-mode unchanged (covered by existing `builds only once per landing` and boundary tests). No engine/server changes (explicitly out of scope, verified).
- **Boundary math:** `boardWithUnowned(7)` → 21 owned / 7 unowned → `7*4 = 28 < 28` false → not scarce; `boardWithUnowned(6)` → 22 owned / 6 unowned → `6*4 = 24 < 28` true → scarce. Exact spec boundary.
- **Type consistency:** `isLandScarce(state: GameState): boolean` used identically in Tasks 1 and 3; `BUILD_CASH_RESERVE` exported once and imported by name in Task 3 tests; `boardWithUnowned(unowned, target)` signature consistent across all tests; `GameAction` type import added in Task 2 and used only there.
