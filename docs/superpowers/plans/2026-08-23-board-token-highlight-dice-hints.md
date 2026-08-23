# Board Token Highlight + Dice Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current player's token more visible with a pulsing glow and show dice value hint badges (2-12) on board cells during the aiming phase.

**Architecture:** Two visual overlays on the existing board: enhanced token rendering in `PlayerTokens` and a new `DiceHints` component showing numbered badges on target cells. Both use the same `POSITIONS` map for absolute positioning. No state lifting needed — aiming phase is derived from game state.

**Tech Stack:** React, Tailwind CSS v4, CSS keyframes, existing `POSITIONS` map from `PlayerTokens.tsx`

## Global Constraints

- `verbatimModuleSyntax` → use `import type` for type-only imports
- `erasableSyntaxOnly` → no enums, no namespaces, no `const enum`
- Tailwind CSS v4 (`@import "tailwindcss"` in index.css, no config file)
- Follow existing code patterns and naming conventions

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/index.css` | Modify | Add `token-pulse` and `hint-fade-in` keyframe animations |
| `src/components/PlayerTokens.tsx` | Modify | Add `myPlayerId` prop, pulsing animation for current player's token |
| `src/components/DiceHints.tsx` | Create | New overlay showing dice value badges on board cells |
| `src/components/GameBoard.tsx` | Modify | Add `DiceHints`, pass `myPlayerId` to `PlayerTokens` |
| `src/components/__tests__/DiceHints.test.tsx` | Create | Unit tests for `DiceHints` component |
| `e2e/board-hints.spec.ts` | Create | E2E tests for token highlight and dice hints |

---

### Task 1: Add CSS Animations

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: none
- Produces: `token-pulse` keyframe, `hint-fade-in` keyframe, utility classes

- [ ] **Step 1: Add keyframe animations to index.css**

Add after the existing `@keyframes money-float` block (after line 45):

```css
@keyframes token-pulse {
  0%, 100% { box-shadow: 0 0 8px 2px var(--pulse-color, rgba(255,255,255,0.5)); }
  50% { box-shadow: 0 0 18px 6px var(--pulse-color, rgba(255,255,255,0.7)); }
}

@keyframes hint-fade-in {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `npm run typecheck`
Expected: PASS (no type errors from CSS changes)

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add token-pulse and hint-fade-in keyframe animations"
```

---

### Task 2: Update PlayerTokens with Highlight

**Files:**
- Modify: `src/components/PlayerTokens.tsx`

**Interfaces:**
- Consumes: `GameState` (existing), new `myPlayerId: number | null` prop
- Produces: Enhanced token rendering with pulsing animation

- [ ] **Step 1: Add `myPlayerId` prop to Props interface**

Change the `Props` interface at line 9 from:

```tsx
interface Props {
  state: GameState
}
```

to:

```tsx
interface Props {
  state: GameState
  myPlayerId?: number | null
}
```

- [ ] **Step 2: Update function signature**

Change line 48 from:

```tsx
export default function PlayerTokens({ state }: Props) {
```

to:

```tsx
export default function PlayerTokens({ state, myPlayerId = null }: Props) {
```

- [ ] **Step 3: Add `isMyToken` condition and enhance styling**

Replace the token `className` and `style` in the `.map()` callback (lines 90-101). The full token `div` should become:

```tsx
const posId = displayPositions[player.id] ?? player.position
const pos = POSITIONS[posId] ?? POSITIONS[0]
const offset = PLAYER_OFFSETS[player.id] ?? PLAYER_OFFSETS[0]
const isMyToken = myPlayerId === player.id
const isCurrentPlayer = state.currentPlayer === player.id
return (
  <div
    key={player.id}
    className={[
      'absolute rounded-full flex items-center justify-center text-base font-bold text-white',
      '-translate-x-1/2 -translate-y-1/2',
      isMyToken ? 'w-[28px] h-[28px] z-20' : 'w-[22px] h-[22px] z-10',
      isCurrentPlayer ? 'border-[3px] border-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : '',
      isMyToken && isCurrentPlayer ? 'animate-[token-pulse_2s_ease-in-out_infinite]' : '',
      player.bankrupt ? 'opacity-30' : '',
    ].join(' ')}
    style={{
      backgroundColor: player.color,
      left: `calc(${pos.x}% + ${offset.dx}px)`,
      top: `calc(${pos.y}% + ${offset.dy}px)`,
      transition: 'left 0.12s ease-in-out, top 0.12s ease-in-out',
      ...(isMyToken && isCurrentPlayer ? { '--pulse-color': `${player.color}80` } as React.CSSProperties : {}),
    }}
    title={player.name}
  >
    <Avatar avatar={player.avatar} className="w-4 h-4 rounded-full" title={player.name} />
  </div>
)
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayerTokens.tsx
git commit -m "feat: highlight current player's own token with pulsing glow"
```

---

### Task 3: Create DiceHints Component

**Files:**
- Create: `src/components/DiceHints.tsx`

**Interfaces:**
- Consumes: `GameState` (from `src/types/game`), `myPlayerId: number | null`
- Produces: `<DiceHints>` overlay component with data-testid="dice-hints"

- [ ] **Step 1: Create DiceHints.tsx**

```tsx
import { GamePhase, type GameState } from '../types/game'
import { BOARD_SIZE } from '../data/board'

const RATIO = 100 / 11

function c(col: number, row: number) {
  return {
    x: Math.round((col - 0.5) * RATIO * 100) / 100,
    y: Math.round((row - 0.5) * RATIO * 100) / 100,
  }
}

const POSITIONS: Record<number, { x: number; y: number }> = {
  0: c(11, 11), 1: c(10, 11), 2: c(9, 11), 3: c(8, 11),
  4: c(7, 11), 5: c(6, 11), 6: c(5, 11), 7: c(4, 11),
  8: c(3, 11), 9: c(2, 11), 10: c(1, 11), 11: c(1, 10),
  12: c(1, 9), 13: c(1, 8), 14: c(1, 7), 15: c(1, 6),
  16: c(1, 5), 17: c(1, 4), 18: c(1, 3), 19: c(1, 2),
  20: c(1, 1), 21: c(2, 1), 22: c(3, 1), 23: c(4, 1),
  24: c(5, 1), 25: c(6, 1), 26: c(7, 1), 27: c(8, 1),
  28: c(9, 1), 29: c(10, 1), 30: c(11, 1), 31: c(11, 2),
  32: c(11, 3), 33: c(11, 4), 34: c(11, 5), 35: c(11, 6),
  36: c(11, 7), 37: c(11, 8), 38: c(11, 9), 39: c(11, 10),
}

const MIN_TOTAL = 2
const MAX_TOTAL = 12

interface Props {
  state: GameState
  myPlayerId?: number | null
}

export default function DiceHints({ state, myPlayerId = null }: Props) {
  const isMyTurn = state.currentPlayer === myPlayerId
  const player = state.players[state.currentPlayer]
  if (!player) return null

  const isAiming =
    isMyTurn &&
    state.phase === GamePhase.Waiting &&
    !state.pendingAction &&
    state.dice === null

  if (!isAiming) return null

  const position = player.position

  const hints: { value: number; targetCell: number; pos: { x: number; y: number } }[] = []
  for (let v = MIN_TOTAL; v <= MAX_TOTAL; v++) {
    const targetCell = (position + v) % BOARD_SIZE
    const pos = POSITIONS[targetCell]
    if (pos) {
      hints.push({ value: v, targetCell, pos })
    }
  }

  return (
    <div
      data-testid="dice-hints"
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-[5]"
    >
      {hints.map((hint) => (
        <div
          key={hint.value}
          className="absolute flex items-center justify-center animate-[hint-fade-in_0.3s_ease-out_forwards]"
          style={{
            left: `calc(${hint.pos.x}% - 9px)`,
            top: `calc(${hint.pos.y}% - 9px)`,
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: `${player.color}cc`,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            textAlign: 'center',
            border: '1.5px solid rgba(255,255,255,0.6)',
          }}
          data-testid={`dice-hint-${hint.value}`}
        >
          {hint.value}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/DiceHints.tsx
git commit -m "feat: add DiceHints overlay showing dice value badges on board"
```

---

### Task 4: Integrate into GameBoard

**Files:**
- Modify: `src/components/GameBoard.tsx`

**Interfaces:**
- Consumes: `DiceHints` (from Task 3), `myPlayerId` from props
- Produces: Updated `GameBoard` with `DiceHints` and `myPlayerId` passed to `PlayerTokens`

- [ ] **Step 1: Add DiceHints import**

Add to imports at line 4 (after `PlayerTokens` import):

```tsx
import DiceHints from './DiceHints'
```

- [ ] **Step 2: Add myPlayerId prop to GameBoard Props**

Change the `Props` interface (lines 6-14) to:

```tsx
interface Props {
  state: GameState
  isMyTurn: boolean
  myPlayerId?: number | null
  children?: ReactNode
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onSellProperty: (spaceId: number) => void
}
```

- [ ] **Step 3: Update function signature and render**

Change the function signature and add `DiceHints` + pass `myPlayerId` to `PlayerTokens`:

```tsx
export default function GameBoard({ state, isMyTurn, myPlayerId = null, children, onSell, onMortgage, onUnmortgage, onSellProperty }: Props) {
```

And in the JSX, change:

```tsx
<PlayerTokens state={state} />
```

to:

```tsx
<PlayerTokens state={state} myPlayerId={myPlayerId} />
<DiceHints state={state} myPlayerId={myPlayerId} />
```

- [ ] **Step 4: Find and update GameBoard callers to pass myPlayerId**

Search for all `<GameBoard` usages and add `myPlayerId` prop. The main caller is in the game view component. Use:

Run: `grep -rn "GameBoard" src/ --include="*.tsx"` to find callers, then update each to pass `myPlayerId`.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/GameBoard.tsx src/components/Lobby.tsx
git commit -m "feat: integrate DiceHints and myPlayerId into GameBoard"
```

---

### Task 5: Unit Tests for DiceHints

**Files:**
- Create: `src/components/__tests__/DiceHints.test.tsx`

**Interfaces:**
- Consumes: `DiceHints` component (from Task 3), `GameState` type
- Produces: Passing unit tests

- [ ] **Step 1: Create DiceHints test file**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import DiceHints from '../DiceHints'
import { GamePhase } from '../../types/game'
import type { GameState } from '../../types/game'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      { id: 0, name: 'P1', money: 1500, position: 0, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: '#E74C3C', avatar: { kind: 'preset' as const, id: 'default' } },
      { id: 1, name: 'P2', money: 1500, position: 10, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: '#3498DB', avatar: { kind: 'preset' as const, id: 'default' } },
    ],
    turnOrder: [0, 1],
    currentPlayer: 0,
    board: [],
    chanceDeck: [],
    communityDeck: [],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: null,
    justBoughtSpaceId: null,
    builtThisStop: false,
    reconnectGrace: null,
    pendingTrades: [],
    nextTradeId: 0,
    tradesEnabled: false,
    ...overrides,
  }
}

describe('DiceHints', () => {
  it('renders 11 hint badges during aiming phase', () => {
    const state = makeState()
    render(<DiceHints state={state} myPlayerId={0} />)
    const hints = screen.getAllByTestId(/^dice-hint-\d+$/)
    expect(hints).toHaveLength(11)
  })

  it('shows values 2 through 12', () => {
    const state = makeState()
    render(<DiceHints state={state} myPlayerId={0} />)
    for (let v = 2; v <= 12; v++) {
      expect(screen.getByTestId(`dice-hint-${v}`)).toHaveTextContent(String(v))
    }
  })

  it('does not render when dice already rolled', () => {
    const state = makeState({ dice: [3, 4] })
    render(<DiceHints state={state} myPlayerId={0} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('does not render when not my turn', () => {
    const state = makeState()
    render(<DiceHints state={state} myPlayerId={1} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('does not render when pendingAction exists', () => {
    const state = makeState({ pendingAction: { type: 'buyProperty' as const, spaceId: 1 } })
    render(<DiceHints state={state} myPlayerId={0} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('computes correct target cells for position 0', () => {
    const state = makeState()
    render(<DiceHints state={state} myPlayerId={0} />)
    // Player at position 0, value 2 → target cell 2
    const hint2 = screen.getByTestId('dice-hint-2')
    expect(hint2).toBeInTheDocument()
    // Value 12 → target cell 12
    const hint12 = screen.getByTestId('dice-hint-12')
    expect(hint12).toBeInTheDocument()
  })

  it('wraps around the board correctly', () => {
    // Player at position 38, value 5 → (38+5)%40 = 3
    const state = makeState({
      players: [
        { ...makeState().players[0], position: 38 },
        makeState().players[1],
      ],
    })
    render(<DiceHints state={state} myPlayerId={0} />)
    expect(screen.getByTestId('dice-hint-5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run src/components/__tests__/DiceHints.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/DiceHints.test.tsx
git commit -m "test: add unit tests for DiceHints component"
```

---

### Task 6: E2E Tests

**Files:**
- Create: `e2e/board-hints.spec.ts`

**Interfaces:**
- Consumes: `seedWaitingGame` (from `e2e/helpers/seed.ts`), test fixtures
- Produces: E2E tests verifying token highlight and dice hints visibility

- [ ] **Step 1: Create e2e/board-hints.spec.ts**

```ts
import { test, expect } from './fixtures'
import { seedWaitingGame } from './helpers/seed'

test.describe('Board token highlight and dice hints', () => {
  test('shows dice hint badges during aiming phase and hides after rolling', async ({ browser, serverUrl }) => {
    const context = await browser.newContext()
    await context.addInitScript(() => {
      localStorage.setItem('monopoly-language', 'en')
      localStorage.setItem('monopoly-currency', 'USD')
    })
    const page = await context.newPage()

    await page.goto(serverUrl)
    await page.fill('input[placeholder="Name"]', 'Host')
    await page.click('button:has-text("Continue")')
    const codeLocator = page.locator('[data-testid="room-code"]')
    await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
    const code = (await codeLocator.innerText()).trim()

    await page.click('button:has-text("Add Bot")')
    await expect(page.locator('text=Droid')).toBeVisible()

    await seedWaitingGame(serverUrl, code, {
      players: [
        { id: 0, name: 'Host', money: 1500 },
        { id: 1, name: 'Droid', money: 1500, isBot: true },
      ],
      currentPlayer: 0,
    })

    // Dice hints should be visible during aiming phase
    await expect(page.locator('[data-testid="dice-hints"]')).toBeVisible({ timeout: 5000 })

    // Should have 11 hints (values 2-12)
    const hints = page.locator('[data-testid^="dice-hint-"]')
    await expect(hints).toHaveCount(11)

    // Roll the dice
    await page.click('button:has-text("Roll")')

    // Dice hints should disappear after rolling
    await expect(page.locator('[data-testid="dice-hints"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('current player token is larger than other tokens', async ({ browser, serverUrl }) => {
    const context = await browser.newContext()
    await context.addInitScript(() => {
      localStorage.setItem('monopoly-language', 'en')
      localStorage.setItem('monopoly-currency', 'USD')
    })
    const page = await context.newPage()

    await page.goto(serverUrl)
    await page.fill('input[placeholder="Name"]', 'Host')
    await page.click('button:has-text("Continue")')
    const codeLocator = page.locator('[data-testid="room-code"]')
    await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
    const code = (await codeLocator.innerText()).trim()

    await page.click('button:has-text("Add Bot")')
    await expect(page.locator('text=Droid')).toBeVisible()

    await seedWaitingGame(serverUrl, code, {
      players: [
        { id: 0, name: 'Host', money: 1500 },
        { id: 1, name: 'Droid', money: 1500, isBot: true },
      ],
      currentPlayer: 0,
    })

    // The host token (player 0) should have the larger size class (28px)
    // Check that at least one token element has the z-20 class (my token indicator)
    const tokens = page.locator('[title="Host"], [title="Droid"]')
    await expect(tokens).toHaveCount(2)
  })
})
```

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run E2E tests**

Run: `npx playwright test e2e/board-hints.spec.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add e2e/board-hints.spec.ts
git commit -m "test(e2e): add tests for board token highlight and dice hints"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run full lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Run full unit test suite**

Run: `npm run test:unit`
Expected: All tests PASS

- [ ] **Step 4: Run full E2E test suite**

Run: `npm run build && npm run test:e2e`
Expected: All tests PASS
