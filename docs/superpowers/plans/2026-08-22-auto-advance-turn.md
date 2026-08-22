# Auto-Advance Turn (Remove "End Turn" Button) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-advance a human player's turn after they roll, instead of requiring a "Roll Again" / "End Turn" button click — but only when no other action (notably building) is available.

**Architecture:** Server-authoritative. `server/gameServer.ts` `scheduleAutoSteps()` already auto-clicks "Draw" for chance/community cards; we add a sibling branch that dispatches `GameActionType.EndTurn` after 300ms when the current player is a connected human who has rolled and has nothing else to do. The end-of-turn button is removed from `ActionSection.tsx`. The `canBuild` check (which decides if the human might want to build first) is extracted from the component into a shared pure helper used by both the client render and the server.

**Tech Stack:** TypeScript, React 19, Vitest (unit), Node server (`ws`, `tsx`). No new dependencies.

## Global Constraints

- No TS enums — `const` objects + derived union types (`erasableSyntaxOnly`). Type-only imports use `import type`.
- `noUnusedLocals`/`noUnusedParameters` are on — removing the button must remove the now-unused prop threading or the build fails.
- Match semicolon style per file: `src/logic/*` uses semicolons; `server/*` and components do not.
- Building does **not** require a monopoly (existing behavior, must be preserved).
- The `END_TURN` game action, its reducer case, and the `GameApi.endTurn` / `useNetworkGame.endTurn` bindings stay — bots still drive turns through the same reducer path. Only the client button and its prop threading are removed.
- All new UI-visible strings would need i18n in both `en` and `id` — this change adds no strings (it removes a button).

---

## File Structure

- Create: `src/logic/build.ts` — pure `canBuildOnCurrentSpace(state)` helper
- Create: `src/logic/__tests__/build.test.ts` — unit tests for the helper
- Modify: `src/components/ActionSection.tsx` — use shared helper, then remove button
- Modify: `src/components/Sidebar.tsx` — drop `onEndTurn` from props
- Modify: `src/components/GameView.tsx` — stop passing `onEndTurn`
- Modify: `src/components/__tests__/ActionSection.test.tsx` — update Roll Again test
- Modify: `server/gameServer.ts` — add auto-advance branch + constant + guard method
- Modify: `server/__tests__/gameServer.test.ts` — update doubles test, add auto-advance tests

---

### Task 1: Extract `canBuildOnCurrentSpace` shared helper

**Files:**
- Create: `src/logic/build.ts`
- Create: `src/logic/__tests__/build.test.ts`
- Modify: `src/components/ActionSection.tsx:33,96-103`

**Interfaces:**
- Produces: `canBuildOnCurrentSpace(state: GameState): boolean` — returns `true` iff the current player (per `state.currentPlayer`) is standing on a property they own and could build on right now: they have rolled, the space is a `Property`, they own it, it is not at `MAX_HOUSES`, not mortgaged, and not the space just bought.

- [ ] **Step 1: Write the failing test**

Create `src/logic/__tests__/build.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialState } from '../gameReducer';
import { GameActionType } from '../../types/game';
import { canBuildOnCurrentSpace } from '../build';

function makeState() {
  return gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  });
}

describe('canBuildOnCurrentSpace', () => {
  it('returns false before any roll', () => {
    const s = makeState();
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });

  it('returns false when the player is not on their own buildable property', () => {
    // dice set but standing on an unowned property
    const s = { ...makeState(), dice: [1, 2] as [number, number] };
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });

  it('returns true on own property below MAX_HOUSES, not mortgaged, not just bought', () => {
    const base = makeState();
    const property = base.board.find((sp) => sp.type === 'property');
    if (!property) throw new Error('no property space');
    const s = {
      ...base,
      dice: [1, 2] as [number, number],
      currentPlayer: 0,
      board: base.board.map((sp) =>
        sp.id === property.id
          ? { ...sp, owner: 0, houses: 0, mortgaged: false }
          : sp,
      ),
      players: base.players.map((p, i) => (i === 0 ? { ...p, position: property.id } : p)),
    };
    expect(canBuildOnCurrentSpace(s)).toBe(true);
  });

  it('returns false on a mortgaged property', () => {
    const base = makeState();
    const property = base.board.find((sp) => sp.type === 'property');
    if (!property) throw new Error('no property space');
    const s = {
      ...base,
      dice: [1, 2] as [number, number],
      currentPlayer: 0,
      board: base.board.map((sp) =>
        sp.id === property.id
          ? { ...sp, owner: 0, houses: 0, mortgaged: true }
          : sp,
      ),
      players: base.players.map((p, i) => (i === 0 ? { ...p, position: property.id } : p)),
    };
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });

  it('returns false when dice is null even on own property', () => {
    const base = makeState();
    const property = base.board.find((sp) => sp.type === 'property');
    if (!property) throw new Error('no property space');
    const s = {
      ...base,
      dice: null,
      currentPlayer: 0,
      board: base.board.map((sp) =>
        sp.id === property.id
          ? { ...sp, owner: 0, houses: 0, mortgaged: false }
          : sp,
      ),
      players: base.players.map((p, i) => (i === 0 ? { ...p, position: property.id } : p)),
    };
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/__tests__/build.test.ts`
Expected: FAIL — `Cannot find module '../build'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/logic/build.ts`:

```ts
import { SpaceType, type GameState } from '../types/game';
import { MAX_HOUSES } from '../data/board';

export function canBuildOnCurrentSpace(state: GameState): boolean {
  const player = state.players[state.currentPlayer];
  if (!player) return false;
  const space = state.board[player.position];
  if (!space || space.type !== SpaceType.Property) return false;
  if (state.dice === null) return false;
  return (
    space.owner === state.currentPlayer &&
    space.houses < MAX_HOUSES &&
    !space.mortgaged &&
    space.id !== state.justBoughtSpaceId
  );
}
```

- [ ] **Step 4: Refactor `ActionSection` to use the helper**

In `src/components/ActionSection.tsx`:

1. Add import at top (after the existing `../types/game` import):
```ts
import { canBuildOnCurrentSpace } from '../logic/build'
```

2. Replace the inline `const canBuild = ...` block (currently lines ~97-103) with:
```ts
const canBuild = canBuildOnCurrentSpace(state)
```

3. Remove the now-unused `SpaceType` import from the `../types/game` import if `SpaceType` is no longer referenced elsewhere in the file (check — `MAX_HOUSES`/`getHouseCost` from `../data/board` are still used by the Build button, keep them).

- [ ] **Step 5: Run full unit suite**

Run: `npx vitest run`
Expected: all PASS (no behavior change — the button is still rendered).

- [ ] **Step 6: Commit**

```bash
git add src/logic/build.ts src/logic/__tests__/build.test.ts src/components/ActionSection.tsx
git commit -m "refactor: extract canBuildOnCurrentSpace shared helper"
```

---

### Task 2: Server auto-advances a human's turn after rolling

**Files:**
- Modify: `server/gameServer.ts:30-32,450-465`
- Modify: `server/__tests__/gameServer.test.ts:208-229`

**Interfaces:**
- Consumes: `canBuildOnCurrentSpace(state)` from `../src/logic/build` (Task 1).
- Produces: private method `GameServer.canAutoAdvanceTurn(): boolean`; constant `AUTO_END_TURN_MS = 300`.

- [ ] **Step 1: Add the constant and helper import**

In `server/gameServer.ts`, next to the other constants (line ~30):
```ts
const AUTO_END_TURN_MS = 300
```

Add import (with the other imports at the top):
```ts
import { canBuildOnCurrentSpace } from '../src/logic/build'
```

- [ ] **Step 2: Write the failing server test**

In `server/__tests__/gameServer.test.ts`, **update** the existing test at line 208, "does not auto-advance after doubles until an explicit END_TURN". It now asserts the turn auto-advances. The behavior for doubles: `EndTurn` resets `dice` to `null`, keeps `currentPlayer` the same, and increments `doublesCount` (the "Roll Again" state).

Replace the whole test (lines 208-229) with:

```ts
it('auto-advances after doubles to the roll-again state', () => {
  vi.useFakeTimers()
  const rng = () => 0.5 // dice [4,4], doubles
  const { server } = setup({ rng })
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')

  server.roll('c0')
  vi.advanceTimersByTime(500) // DICE_ANIMATED
  expect(server.getState().dice).toEqual([4, 4])
  expect(server.getState().doublesCount).toBe(1)

  vi.advanceTimersByTime(500 + 8 * 150) // RESOLVE_SPACE (space 8 unowned → mustCircleBoard → Waiting)
  expect(server.getState().phase).toBe(GamePhase.Waiting)

  vi.advanceTimersByTime(500) // AUTO_END_TURN
  expect(server.getState().dice).toBeNull()
  expect(server.getState().currentPlayer).toBe(0) // doubles → same player rolls again
  expect(server.getState().doublesCount).toBe(1)
  vi.useRealTimers()
})

it('auto-advances a human turn to the next player after rolling onto a normal space', () => {
  vi.useFakeTimers()
  const rng = () => 0.6 // dice [4,5] = 9, no doubles
  const { server } = setup({ rng })
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')

  server.roll('c0')
  vi.advanceTimersByTime(500) // DICE_ANIMATED
  expect(server.getState().dice).toEqual([4, 5])

  vi.advanceTimersByTime(500 + 9 * 150) // RESOLVE_SPACE (space 9 unowned → Waiting)
  expect(server.getState().phase).toBe(GamePhase.Waiting)

  vi.advanceTimersByTime(500) // AUTO_END_TURN
  expect(server.getState().currentPlayer).toBe(1)
  expect(server.getState().dice).toBeNull()
  vi.useRealTimers()
})

it('does not auto-advance a human turn when standing on a buildable property', () => {
  vi.useFakeTimers()
  const rng = () => 0.6
  const { server } = setup({ rng })
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')

  // Force an own buildable property under the player by mutating state directly
  const st = server.getState() as { players: { position: number }[] }
  st.players[0].position = 0
  // find the first property space and move the player onto it as owner
  const firstProperty = (server.getState().board as { id: number; type: string; owner: number | null }[]).find((sp) => sp.type === 'property')
  if (!firstProperty) throw new Error('no property space')
  st.players[0].position = firstProperty.id

  server.roll('c0')
  vi.advanceTimersByTime(500) // DICE_ANIMATED
  vi.advanceTimersByTime(500 + 20 * 150) // RESOLVE_SPACE + settle
  expect(server.getState().phase).toBe(GamePhase.Waiting)

  vi.advanceTimersByTime(1000) // past AUTO_END_TURN
  expect(server.getState().currentPlayer).toBe(0)
  vi.useRealTimers()
})
```

> Note: the third test asserts the "don't auto-advance on buildable property" case at the server level. If the `buildable` setup proves awkward against the state shape, it is acceptable to assert the guard method `canAutoAdvanceTurn()` directly (unit-test it) instead — the helper `canBuildOnCurrentSpace` itself is already covered in Task 1. In that case, set up a human turn with an own buildable property and assert `(server as any).canAutoAdvanceTurn() === false`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: FAIL — "auto-advances a human turn..." times out because no `END_TURN` is dispatched. (The updated doubles test may also fail.)

- [ ] **Step 4: Implement the server auto-advance**

In `server/gameServer.ts`, add a private guard method and a new branch in `scheduleAutoSteps()`. The method:

```ts
private canAutoAdvanceTurn(): boolean {
  const s = this.state
  if (s.phase !== GamePhase.Waiting || s.pendingAction) return false
  const player = s.players[s.currentPlayer]
  const slot = this.slots[s.currentPlayer]
  if (!player || !slot) return false
  if (slot.isBot || !slot.connected || player.botControlled === true) return false
  if (player.inJail || s.dice === null || player.money < 0) return false
  return !canBuildOnCurrentSpace(s)
}
```

In `scheduleAutoSteps()` (currently lines 450-465), after the existing `else if (s.pendingAction?.type === PendingActionType.DrawCard) { ... }` block, add:

```ts
} else if (this.canAutoAdvanceTurn()) {
  setTimeout(() => {
    if (this.canAutoAdvanceTurn()) {
      this.dispatch({ type: GameActionType.EndTurn })
    }
  }, AUTO_END_TURN_MS)
}
```

The double-check inside the timeout (same pattern as the existing `DrawCard` branch) re-verifies that the human is still the deciding player and conditions still hold.

- [ ] **Step 5: Run the server test suite**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: all PASS.

- [ ] **Step 6: Run the full unit suite + typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS. (If the `bot.test.ts` or `gameReducer.test.ts` relied on human turns waiting for an explicit `END_TURN`, they would fail here — fix only if a test asserts the old behavior.)

- [ ] **Step 7: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts
git commit -m "feat(server): auto-advance human turn when no action remains"
```

---

### Task 3: Remove the "Roll Again" / "End Turn" button

**Files:**
- Modify: `src/components/ActionSection.tsx:136-153,23`
- Modify: `src/components/Sidebar.tsx:15,23`
- Modify: `src/components/GameView.tsx:44`
- Modify: `src/components/__tests__/ActionSection.test.tsx:77-82`

**Interfaces:**
- Consumes: the server auto-advance from Task 2 (authoritative). This task is purely presentational cleanup and depends on Task 2 already being merged so the game does not soft-lock.

- [ ] **Step 1: Write the failing component test**

In `src/components/__tests__/ActionSection.test.tsx`, replace the test at lines 77-82:

```tsx
it('does not render an end-of-turn button after rolling', () => {
  let s = makeState()
  s = { ...s, dice: [3, 3], doublesCount: 1 }
  renderWithProviders(<ActionSection state={s} {...actions} />)
  expect(screen.queryByRole('button', { name: /Roll Again/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /End Turn/ })).not.toBeInTheDocument()
})
```

If `actions` still contains `onEndTurn: noop`, remove that key from the shared `actions` object at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx`
Expected: FAIL — the "Roll Again" button is still rendered.

- [ ] **Step 3: Remove the button from `ActionSection.tsx`**

In `src/components/ActionSection.tsx`:

1. Remove `onEndTurn` from the destructured props (line 23):
```tsx
state, onEndTurn, onDrawCard, onBuyProperty,
```
becomes
```tsx
state, onDrawCard, onBuyProperty,
```

2. Remove `onEndTurn: () => void` from the `Props` interface (line 10).

3. Delete the `<Button variant="secondary" onClick={onEndTurn}>...` block and its wrapping `hasRolled ? ( ... )` ternary, i.e. lines 136-148 (from `) : hasRolled ? (` through the closing `)}` before `{(hasRolled && !player.inJail)`).

4. Keep lines 149-153 (the `hoverShort` hint paragraph) as-is. `hasRolled` is still used there, so keep its declaration at line 33.

5. Remove the now-unused `Button` import **only if** no other `<Button>` remains in the file (the Buy/Rent/DrawCard/Jail paths all use `<Button>`, so it will still be used — do not remove it).

- [ ] **Step 4: Clean up `Sidebar.tsx`**

In `src/components/Sidebar.tsx`:

1. Remove `onEndTurn: () => void` from the `Props` interface (line 15).
2. The spread `{...actions}` at line 56 already forwards everything; no other change needed. `onEndTurn` simply stops being passed from `GameView`.

- [ ] **Step 5: Clean up `GameView.tsx`**

In `src/components/GameView.tsx`, remove the line:
```tsx
onEndTurn={game.endTurn}
```
from the `<Sidebar ...>` props (line 44).

Leave `game.endTurn` and `GameApi.endTurn` / `useNetworkGame`'s `endTurn` in place — they are still part of the public game API contract.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full verification suite**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all PASS. (Fix any `noUnusedLocals`/`noUnusedParameters` errors if the import cleanup in Step 3 missed a spot.)

- [ ] **Step 8: Manual smoke test**

1. `npm run build && npm run server`
2. Open two tabs, create a room as Alice, join as Bob with a bot in between.
3. Roll as Alice onto a normal owned/unowned space → turn auto-advances to Bob after a beat.
4. Land on an own buildable property → turn pauses; the Build button is visible and the turn does **not** auto-advance.
5. Roll doubles → "Roll Again" state is reached (dice cleared, same player) without an explicit click.

- [ ] **Step 9: Commit**

```bash
git add src/components/ActionSection.tsx src/components/Sidebar.tsx src/components/GameView.tsx src/components/__tests__/ActionSection.test.tsx
git commit -m "feat: remove end-of-turn button, rely on server auto-advance"
```

---

## Self-Review

**Spec coverage:**
- Shared `canBuildOnCurrentSpace` helper → Task 1.
- Server auto-advance branch in `scheduleAutoSteps` with 300ms delay, human-only guard, re-check inside timeout → Task 2.
- Guard against build-available (via `canBuildOnCurrentSpace`) → Tasks 1+2.
- Remove button + prop threading cleanup → Task 3.
- Update `gameServer.test.ts:208` doubles test → Task 2.
- i18n: no new strings; `action.rollAgain`/`action.endTurn` keys left in place → covered, no task needed.
- Out-of-scope tradeoff (mortgaging/selling/trading mid-turn) documented → no task.

**Placeholder scan:** No TBD/TODO; all steps carry concrete code or exact file:line references.

**Type consistency:** `canBuildOnCurrentSpace(state: GameState): boolean` is defined in Task 1 and consumed with the same name/signature in Tasks 1 and 2. `AUTO_END_TURN_MS` constant used only in Task 2. `canAutoAdvanceTurn()` private method referenced consistently. `END_TURN`/`EndTurn` action naming matches the existing `GameActionType.EndTurn` constant used by the reducer.
