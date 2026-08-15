# Gameplay & UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply six play-tested refinements to the Monopoly game (LAN multiplayer + shared gameplay): skip the end-turn click on doubles, move "Bangun" to the center panel, disable "Tebus" when unaffordable, animate the GO salary, fix the small-screen center-panel overlap, and gate actions to the current player in multiplayer.

**Architecture:** Logic changes go in the shared `gameReducer` consumers (`useGame` for local, `GameServer.scheduleAutoSteps` for multiplayer); UI changes go in the React components that already render the board/sidebar. Turn gating is added via a new `myPlayerId` field on `GameApi` so local mode (null) is unaffected.

**Tech Stack:** React 19 + TypeScript + Vite 8; Node.js `ws` server; Vitest (unit, jsdom via `// @vitest-environment jsdom`); Playwright (e2e).

## Global Constraints

- TypeScript `verbatimModuleSyntax` ON: use `import type` for type-only imports.
- `erasableSyntaxOnly` ON (no enums/namespaces/param-properties).
- `noUnusedLocals` / `noUnusedParameters` ON: remove now-unused locals (e.g. `passedGO`, `prevPos`, `GO_SALARY` import in `PlayerPanel`).
- UI copy is Indonesian.
- Server code must not import DOM/browser modules.
- Existing e2e (`e2e/monopoly.spec.ts`, `e2e/multiplayer.spec.ts`) and unit suite must stay green.
- Verify each task with `npm run typecheck`, `npm run lint`, and the focused test.

---

### Task 1: Skip "Akhiri Giliran" on doubles (auto roll-again)

**Files:**
- Modify: `server/gameServer.ts`
- Modify: `src/hooks/useGame.ts`
- Test: `server/__tests__/gameServer.test.ts` (add case)
- Test: `src/hooks/__tests__/useGame.test.ts` (new)

**Interfaces:**
- Consumes: `GamePhase`, `GameState`; existing `END_TURN` doubles branch in the reducer (clears dice, keeps `currentPlayer`, logs "main lagi (dadu ganda)!").
- Produces: an auto-step that dispatches `END_TURN` ~500ms after a resolved space when dice are doubles and `doublesCount > 0`.

- [ ] **Step 1: Add the server test (RED)**

In `server/__tests__/gameServer.test.ts`, add:

```ts
it('auto-advances to roll again after doubles (no explicit end turn)', () => {
  vi.useFakeTimers()
  const rng = () => 0.5 // dice [4,4], doubles
  const { server } = setup(rng)
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')

  server.roll('c0')
  vi.advanceTimersByTime(500) // DICE_ANIMATED
  expect(server.getState().dice).toEqual([4, 4])
  expect(server.getState().doublesCount).toBe(1)

  vi.advanceTimersByTime(500 + 8 * 150) // RESOLVE_SPACE (space 8 = Semarang, unowned)
  expect(server.getState().phase).toBe(GamePhase.Waiting)

  vi.advanceTimersByTime(500) // auto END_TURN
  expect(server.getState().dice).toBeNull()
  expect(server.getState().currentPlayer).toBe(0)
  expect(server.getState().eventLog.some((e) => e.includes('main lagi'))).toBe(true)
  vi.useRealTimers()
})
```

- [ ] **Step 2: Run it (expect FAIL)**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: the new test FAILS (dice stays `[4,4]` after 500ms; no auto `END_TURN`).

- [ ] **Step 3: Implement the server auto-step**

In `server/gameServer.ts`, extend `scheduleAutoSteps` with a third branch:

```ts
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
  } else if (
    s.phase === GamePhase.Waiting &&
    !s.pendingAction &&
    s.dice !== null &&
    s.dice[0] === s.dice[1] &&
    s.doublesCount > 0
  ) {
    setTimeout(() => {
      const st = this.state
      if (
        st.phase === GamePhase.Waiting &&
        !st.pendingAction &&
        st.dice !== null &&
        st.dice[0] === st.dice[1] &&
        st.doublesCount > 0
      ) {
        this.dispatch({ type: 'END_TURN' })
      }
    }, 500)
  }
}
```

- [ ] **Step 4: Add the local hook test (RED)**

Create `src/hooks/__tests__/useGame.test.ts`:

```ts
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useGame } from '../useGame'
import { GamePhase } from '../../types/game'

describe('useGame doubles auto-advance', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('auto ends turn (keeps player) after rolling doubles', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // dice [4,4]
    const { result } = renderHook(() => useGame())
    act(() => result.current.startGame(2, ['Alice', 'Bob']))

    act(() => result.current.roll())
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toEqual([4, 4])
    expect(result.current.state.doublesCount).toBe(1)

    act(() => vi.advanceTimersByTime(500 + 8 * 150))
    expect(result.current.state.phase).toBe(GamePhase.Waiting)

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toBeNull()
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.eventLog.some((e) => e.includes('main lagi'))).toBe(true)
  })
})
```

- [ ] **Step 5: Run it (expect FAIL)**

Run: `npx vitest run src/hooks/__tests__/useGame.test.ts`
Expected: FAIL — dice not cleared (no auto `END_TURN`).

- [ ] **Step 6: Implement the local auto-step**

In `src/hooks/useGame.ts`, add an effect (after the existing draw-card effect):

```ts
useEffect(() => {
  const dice = state.dice
  const isDoubles = dice !== null && dice[0] === dice[1]
  if (state.phase === GamePhase.Waiting && !state.pendingAction && isDoubles && state.doublesCount > 0) {
    const t = setTimeout(() => dispatch({ type: 'END_TURN' }), 500)
    return () => clearTimeout(t)
  }
}, [state.phase, state.pendingAction, state.dice, state.doublesCount])
```

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run server/__tests__/gameServer.test.ts src/hooks/__tests__/useGame.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/gameServer.ts src/hooks/useGame.ts server/__tests__/gameServer.test.ts src/hooks/__tests__/useGame.test.ts
git commit -m "feat: skip end-turn click on doubles (auto roll-again)"
```

---

### Task 2: Turn gating via myPlayerId (multiplayer only)

**Files:**
- Modify: `src/types/game.ts` (add `myPlayerId` to `GameApi`)
- Modify: `src/hooks/useGame.ts` (return `myPlayerId: null`)
- Modify: `src/hooks/useNetworkGame.ts` (return `myPlayerId: playerId`)
- Modify: `src/components/GameView.tsx` (compute `isMyTurn`, pass down)
- Modify: `src/components/Sidebar.tsx` (accept + pass `isMyTurn`)
- Modify: `src/components/DiceRoller.tsx` (accept `isMyTurn`, disable roll button)
- Modify: `src/components/ActionSection.tsx` (accept `isMyTurn`, return null when false)
- Test: `src/components/__tests__/DiceRoller.test.tsx` (new)
- Test: `src/components/__tests__/ActionSection.test.tsx` (new)

**Interfaces:**
- Produces: `GameApi.myPlayerId: number | null`; `DiceRoller`/`ActionSection`/`Sidebar` accept `isMyTurn: boolean` (default `true`).
- `useGame` → `myPlayerId: null`; `useNetworkGame` → `myPlayerId: playerId`.

- [ ] **Step 1: Add `myPlayerId` to `GameApi`**

In `src/types/game.ts`, in the `GameApi` type, add `myPlayerId: number | null;` as the first member after `state`.

- [ ] **Step 2: Thread through hooks**

In `src/hooks/useGame.ts`, add `myPlayerId: null,` to the returned object.
In `src/hooks/useNetworkGame.ts`, add `myPlayerId: playerId,` to the returned object.

- [ ] **Step 3: Write the failing component tests**

Create `src/components/__tests__/DiceRoller.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import DiceRoller from '../DiceRoller'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

describe('DiceRoller', () => {
  it('disables the roll button when it is not the current player turn', () => {
    render(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={false} />)
    expect(screen.getByRole('button', { name: 'Lempar Dadu' })).toBeDisabled()
  })

  it('enables the roll button on the current player turn', () => {
    render(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={true} />)
    expect(screen.getByRole('button', { name: 'Lempar Dadu' })).toBeEnabled()
  })
})
```

Create `src/components/__tests__/ActionSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ActionSection from '../ActionSection'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

const noop = () => {}
const actions = {
  onEndTurn: noop, onDrawCard: noop, onProposeTrade: noop, onBuyProperty: noop,
  onDeclineBuy: noop, onPayRent: noop, onDeclareBankruptcy: noop,
  onPayJailFine: noop, onUseGetOutOfJailFree: noop,
}

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

describe('ActionSection', () => {
  it('renders nothing when it is not the current player turn', () => {
    const { container } = render(<ActionSection state={makeState()} {...actions} isMyTurn={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 4: Run tests (expect FAIL)**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx src/components/__tests__/ActionSection.test.tsx`
Expected: FAIL — `isMyTurn` prop doesn't exist yet.

- [ ] **Step 5: Implement the gating**

`src/components/DiceRoller.tsx` — add `isMyTurn?: boolean` to `Props`, and set `disabled={!isMyTurn}` on the roll `Button`:

```tsx
interface Props {
  state: GameState
  onRoll: () => void
  isMyTurn?: boolean
}
export default function DiceRoller({ state, onRoll, isMyTurn = true }: Props) {
  ...
  <Button variant="primary" size="lg" onClick={handleRoll} disabled={!isMyTurn}>
```

`src/components/ActionSection.tsx` — add `isMyTurn?: boolean` and `onBuild` are covered in Task 3; for THIS task only add `isMyTurn` and early-return:

```tsx
interface Props {
  ...
  isMyTurn?: boolean
}
export default function ActionSection({ ..., isMyTurn = true }: Props) {
  const player = state.players[state.currentPlayer]
  if (!isMyTurn) return null
  ...
}
```

`src/components/Sidebar.tsx` — add `isMyTurn: boolean` to `Props`, pass to both `DiceRoller` and `ActionSection`:

```tsx
<DiceRoller state={state} onRoll={actions.onRoll} isMyTurn={isMyTurn} />
<ActionSection state={state} {...actions} isMyTurn={isMyTurn} />
```

`src/components/GameView.tsx` — compute and pass:

```tsx
const isMyTurn = game.myPlayerId === null || game.myPlayerId === state.currentPlayer
...
<Sidebar state={state} isMyTurn={isMyTurn} ... />
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx src/components/__tests__/ActionSection.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/game.ts src/hooks/useGame.ts src/hooks/useNetworkGame.ts src/components/GameView.tsx src/components/Sidebar.tsx src/components/DiceRoller.tsx src/components/ActionSection.tsx src/components/__tests__/DiceRoller.test.tsx src/components/__tests__/ActionSection.test.tsx
git commit -m "feat: gate actions to current player in multiplayer"
```

---

### Task 3: Move "Bangun" to the center panel

**Files:**
- Modify: `src/components/ActionSection.tsx` (add build button)
- Modify: `src/components/Sidebar.tsx` (thread `onBuild`)
- Modify: `src/components/GameView.tsx` (pass `onBuild` to Sidebar)
- Modify: `src/components/PropertyTooltip.tsx` (remove build button)
- Test: `src/components/__tests__/ActionSection.test.tsx` (add case)

**Interfaces:**
- Consumes: `getHouseCost` from `src/data/board`; `PendingActionType`.
- Produces: `ActionSection` accepts `onBuild: (spaceId: number) => void`; `Sidebar` accepts and forwards `onBuild`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/__tests__/ActionSection.test.tsx`:

```tsx
it('shows a build button when on own buildable property', () => {
  let s = makeState()
  s = {
    ...s,
    players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
    board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
  }
  const onBuild = vi.fn()
  render(<ActionSection state={s} {...actions} onBuild={onBuild} />)
  const btn = screen.getByRole('button', { name: /Bangun/ })
  btn.click()
  expect(onBuild).toHaveBeenCalledWith(8)
})
```

Also add the missing imports (`vi`, `screen`) to that test file.

- [ ] **Step 2: Run it (expect FAIL)**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx`
Expected: FAIL — no "Bangun" button in ActionSection.

- [ ] **Step 3: Implement**

`src/components/ActionSection.tsx`:
- Add `onBuild?: (spaceId: number) => void` to `Props` (optional so the Task 2 test that omits it still typechecks).
- Add `import { getHouseCost } from '../data/board'`.
- In the default branch (the `else` when `canAct`), before the jail/end-turn block, compute and render the build button:

```tsx
const space = state.board[player.position]
const canBuild =
  space?.type === 'property' &&
  space.owner === state.currentPlayer &&
  space.houses < 5 &&
  !space.mortgaged

// inside the default branch return, before the jail check:
{canBuild && (
  <Button
    variant="success"
    size="sm"
    onClick={() => onBuild?.(space.id)}
    disabled={player.money < getHouseCost(space, space.houses)}
  >
    Bangun ({formatMoney(getHouseCost(space, space.houses))})
    {player.money < getHouseCost(space, space.houses) ? ' - uang kurang' : ''}
  </Button>
)}
```

`src/components/Sidebar.tsx` — add `onBuild: (spaceId: number) => void` to `Props` and pass `onBuild={actions.onBuild}` to `ActionSection`.

`src/components/GameView.tsx` — add `onBuild={game.buildHouse}` to the `<Sidebar ...>` element.

`src/components/PropertyTooltip.tsx` — remove the `canBuildBase`, `canAffordBuild`, `nextHouseCost` computation and the entire `{canBuildBase && (...)}` build-button block (the `getHouseCost` import becomes unused → remove it too).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionSection.tsx src/components/Sidebar.tsx src/components/GameView.tsx src/components/PropertyTooltip.tsx src/components/__tests__/ActionSection.test.tsx
git commit -m "feat: move build button to center panel"
```

---

### Task 4: Disable "Tebus" when unaffordable + animate GO salary

**Files:**
- Modify: `src/components/PropertyTooltip.tsx` (disable Tebus)
- Modify: `src/components/PlayerPanel.tsx` (remove passedGO suppression)
- Test: `src/components/__tests__/PropertyTooltip.test.tsx` (new)
- Test: `src/components/__tests__/PlayerPanel.test.tsx` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/PropertyTooltip.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PropertyTooltip from '../PropertyTooltip'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState, type Space } from '../../types/game'

function makeState(money: number): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, money, properties: [8] } : p) }
}

const mortgagedSpace: Space = {
  id: 8, name: 'Semarang', type: 'property', price: 100000000, owner: 0,
  houses: 0, mortgaged: true,
}

describe('PropertyTooltip', () => {
  it('disables Tebus when money is insufficient', () => {
    render(<PropertyTooltip space={mortgagedSpace} state={makeState(1000)} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onBuild={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByRole('button', { name: /Tebus/ })).toBeDisabled()
  })

  it('enables Tebus when money is sufficient', () => {
    render(<PropertyTooltip space={mortgagedSpace} state={makeState(100000000)} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onBuild={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByRole('button', { name: /Tebus/ })).toBeEnabled()
  })
})
```

Create `src/components/__tests__/PlayerPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerPanel from '../PlayerPanel'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { GO_SALARY } from '../../data/board'

const COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#E67E22']

function makeState(money: number): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, money } : p) }
}

describe('PlayerPanel', () => {
  it('shows a money float when a player passes GO (salary increase)', () => {
    const { rerender } = render(<PlayerPanel state={makeState(1000000)} playerColors={COLORS} />)
    rerender(<PlayerPanel state={makeState(1000000 + GO_SALARY)} playerColors={COLORS} />)
    expect(screen.getAllByText(/^\+/).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `npx vitest run src/components/__tests__/PropertyTooltip.test.tsx src/components/__tests__/PlayerPanel.test.tsx`
Expected: Tebus is NOT disabled; the GO float does NOT appear.

- [ ] **Step 3: Implement**

`src/components/PropertyTooltip.tsx` — add `const unmortgageCost = Math.floor((space.price ?? 0) / 2 * 1.1)` near the top, and change the Tebus button:

```tsx
{space.mortgaged && (
  <Button
    size="sm"
    disabled={state.players[state.currentPlayer]?.money < unmortgageCost}
    onClick={(e) => { e.stopPropagation(); onUnmortgage(space.id) }}
  >
    Tebus (-{formatMoney(unmortgageCost)}){state.players[state.currentPlayer]?.money < unmortgageCost ? ' - uang kurang' : ''}
  </Button>
)}
```

`src/components/PlayerPanel.tsx` — remove the `passedGO` suppression: delete `const prevPos = useRef<Record<number, number>>({})`, the `oldPos` lookup, the `passedGO` computation, the `if (!passedGO)` wrapper (always emit the diff), the `prevPos.current[p.id] = p.position` line, and the now-unused `import { GO_SALARY } from '../data/board'`.

The effect becomes:

```ts
useEffect(() => {
  const newDiffs: Record<number, { diff: number; key: number }> = {}
  players.forEach((p) => {
    const prev = prevMoney.current[p.id]
    if (prev !== undefined && prev !== p.money) {
      diffCounter.current += 1
      newDiffs[p.id] = { diff: p.money - prev, key: diffCounter.current }
    }
    prevMoney.current[p.id] = p.money
  })
  if (Object.keys(newDiffs).length > 0) setDiffs(newDiffs)
}, [players])
```

- [ ] **Step 4: Run tests + typecheck + lint**

Run: `npx vitest run src/components/__tests__/PropertyTooltip.test.tsx src/components/__tests__/PlayerPanel.test.tsx && npm run typecheck && npm run lint`
Expected: PASS (lint must be clean — no leftover unused `GO_SALARY` import).

- [ ] **Step 5: Commit**

```bash
git add src/components/PropertyTooltip.tsx src/components/PlayerPanel.tsx src/components/__tests__/PropertyTooltip.test.tsx src/components/__tests__/PlayerPanel.test.tsx
git commit -m "fix: disable Tebus when unaffordable and animate GO salary"
```

---

### Task 5: Center panel responsive fix (small screens)

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Test: `e2e/monopoly.spec.ts` (add a viewport case)

- [ ] **Step 1: Reproduce + constrain the card**

In `src/components/Sidebar.tsx`, constrain the center card to the board's inner 9×9 area on small screens (below `md`), while keeping the existing size on desktop:

```tsx
<div
  className="pointer-events-auto w-[min(380px,calc((100vw-16px)*9/11-16px))] max-h-[calc((100vh-16px)*9/11-16px)] md:max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-panel-border bg-panel backdrop-blur-md shadow-2xl px-5 py-4 flex flex-col gap-4"
>
```

(The `w-[min(380px,…)]` already caps desktop at 380px; the new `max-h` inner-area cap applies below `md`.)

- [ ] **Step 2: Add a viewport e2e check**

Append to `e2e/monopoly.spec.ts`:

```ts
test('center panel fits within board on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  await page.click('button:has-text("Mulai")')
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  const board = await page.locator('[data-game-board]').boundingBox()
  const sidebar = await page.locator('[data-testid="sidebar"]').boundingBox()
  expect(board).not.toBeNull()
  expect(sidebar).not.toBeNull()
  if (!board || !sidebar) return

  const innerWidth = (board.width * 9) / 11
  const innerLeft = board.x + board.width / 11
  const innerRight = board.x + (board.width * 10) / 11
  expect(sidebar.width).toBeLessThanOrEqual(innerWidth)
  expect(sidebar.x).toBeGreaterThanOrEqual(innerLeft)
  expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(innerRight)
})
```

- [ ] **Step 3: Run e2e + full suite**

Run: `npm run build && npx playwright test e2e/monopoly.spec.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx e2e/monopoly.spec.ts
git commit -m "fix: center panel fits board on small screens"
```

---

## Notes

- Tasks are sequential (several touch the same files — `ActionSection`, `Sidebar`, `GameView`); do not dispatch in parallel.
- After all tasks, run `npm test` (unit + e2e) and `npm run lint` once more to confirm the full suite is green.
