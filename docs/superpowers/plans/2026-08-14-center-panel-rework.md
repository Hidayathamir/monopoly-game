# Center Panel Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four-box center overlay (dice, actions, players, log) with one cohesive, floating glass HUD card centered on the board.

**Architecture:** Pure presentation rework. `Sidebar` becomes a single glass card containing five sections in order: `TurnHeader` (new), `DiceRoller` (pip dice + roll button), `PlayerPanel` (horizontal chips), `ActionSection` (flat buttons), `EventLog` (collapsed mini-log). All game logic, handlers, reducers, and prop wiring stay unchanged.

**Tech Stack:** React 19 + TypeScript + Vite 8, Tailwind CSS v4 (`@theme` tokens in `src/index.css`), Vitest + @testing-library/react for unit tests, Playwright for e2e.

## Global Constraints

- Styling is Tailwind v4 utilities + `@theme` tokens (NOT plain CSS files). Do not add new CSS files.
- Keep these test selectors working (Playwright `e2e/monopoly.spec.ts` depends on them):
  - `[data-testid="sidebar"]` — visible during the game.
  - `button:has-text("Lempar")` — the roll button must contain the substring `Lempar`.
  - `[data-testid="player-card"]` — one per player; must contain `Rp` (money) and the player name.
  - `button:has-text("Beli (")`, `"Tidak"`, `"Ambil"`, `"Bayar"`, `"Akhiri"` — action button labels must stay.
- Copy stays in Indonesian, sentence case. Drop the `🎲` emoji from the roll button (dice are now visual).
- Keep every existing prop name and handler signature (`onRoll`, `onEndTurn`, `onBuyProperty`, etc.) unchanged.
- **Pre-existing WIP:** the working tree already has uncommitted changes to `Sidebar.tsx` (landscape/portrait branch), `PlayerCard.tsx` (hover popup added, money moved to popup), and `PlayerPanel.tsx` (passes `board`). Treat the working tree as the baseline. Per task, `git add` ONLY the files that task lists — do not stage unrelated files like `board-data.json`, `useGame.ts`, `BoardGrid.tsx`, `PropertyTooltip.tsx`, `GameBoard.tsx`, or the `*.png` screenshots.
- Verification commands: `npm run typecheck` (tsc -b), `npm run lint`, `npm run test:unit` (vitest), `npm run test:e2e` (playwright).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/index.css` | Design tokens (`@theme`) | Modify: add glass tokens |
| `src/components/Dice.tsx` | Pip-faced die | Rewrite |
| `src/components/TurnHeader.tsx` | Turn/status header | Create |
| `src/components/DiceRoller.tsx` | Dice + roll button | Rewrite visuals |
| `src/components/PlayerCard.tsx` | Player chip (name + money + popup) | Modify: add money line |
| `src/components/PlayerPanel.tsx` | Horizontal chip row | Rewrite |
| `src/components/ActionSection.tsx` | Contextual actions, flat | Rewrite visuals |
| `src/components/EventLog.tsx` | Collapsed mini-log + expand | Rewrite |
| `src/components/Sidebar.tsx` | Glass card shell, sections in order | Rewrite |

---

## Task 1: Pip-faced dice

**Files:**
- Modify: `src/components/Dice.tsx`
- Test: `src/components/__tests__/Dice.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Dice` default export, props `{ value?: number | null; rolling: boolean }`. Pip spans carry `data-testid="dice-pip"`. Placeholder `?` shown when `value` is `null`/`undefined`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/Dice.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Dice from '../Dice'

describe('Dice', () => {
  it('renders the correct number of pips for a value', () => {
    const { getAllByTestId } = render(<Dice value={5} rolling={false} />)
    expect(getAllByTestId('dice-pip')).toHaveLength(5)
  })

  it('renders a placeholder when there is no value', () => {
    const { container } = render(<Dice value={null} rolling={false} />)
    expect(container.textContent).toContain('?')
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/__tests__/Dice.test.tsx`
Expected: FAIL (current `Dice` renders a number, no `dice-pip` testids).

- [ ] **Step 3: Rewrite `Dice.tsx`**

Replace the whole file:

```tsx
interface DiceProps {
  value?: number | null
  rolling: boolean
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

export default function Dice({ value, rolling }: DiceProps) {
  return (
    <div
      data-testid="dice"
      className={[
        'w-14 h-14 rounded-xl flex items-center justify-center shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]',
        value == null ? 'bg-bg-card' : 'bg-white',
        rolling ? 'animate-dice-shake' : '',
      ].join(' ')}
    >
      {value == null ? (
        <span className="text-2xl font-bold text-muted">?</span>
      ) : (
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-2 gap-0.5">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="flex items-center justify-center">
              {PIPS[value].includes(i) && (
                <span data-testid="dice-pip" className="w-2 h-2 rounded-full bg-bg-main" />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/__tests__/Dice.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Dice.tsx src/components/__tests__/Dice.test.tsx
git commit -m "feat: pip-faced dice component"
```

---

## Task 2: Turn header

**Files:**
- Create: `src/components/TurnHeader.tsx`
- Test: `src/components/__tests__/TurnHeader.test.tsx`

**Interfaces:**
- Consumes: `GamePhase`, `PendingActionType`, `GameState`, `Player` from `../types/game`.
- Produces: `TurnHeader` default export, props `{ state: GameState }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/TurnHeader.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TurnHeader from '../TurnHeader'
import { GamePhase, type GameState } from '../../types/game'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      {
        id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
        passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false,
      },
    ],
    currentPlayer: 0,
    board: [],
    chanceDeck: [],
    communityDeck: [],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    eventLog: [],
    pendingAction: null,
    ...overrides,
  }
}

describe('TurnHeader', () => {
  it('shows the current player name', () => {
    render(<TurnHeader state={makeState()} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('shows a roll prompt before the roll', () => {
    render(<TurnHeader state={makeState()} />)
    expect(screen.getByText('Lempar dadu')).toBeTruthy()
  })

  it('shows the dice total after the roll', () => {
    render(<TurnHeader state={makeState({ dice: [3, 4] })} />)
    expect(screen.getByText('Dadu 3 + 4 = 7')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/__tests__/TurnHeader.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `TurnHeader.tsx`**

```tsx
import { GamePhase, PendingActionType, type GameState } from '../types/game'

interface Props {
  state: GameState
}

function statusText(state: GameState): string {
  const p = state.players[state.currentPlayer]
  const pending = state.pendingAction
  if (pending?.type === PendingActionType.BuyProperty) return 'Tawaran beli properti'
  if (pending?.type === PendingActionType.PayRent) return 'Bayar sewa'
  if (pending?.type === PendingActionType.Bankruptcy) return 'Uang tidak cukup'
  if (pending?.type === PendingActionType.DrawCard) return 'Ambil kartu'
  if (pending?.type === PendingActionType.CardEffect) return 'Efek kartu'
  if (p.inJail) return 'Di penjara'
  if (state.dice) return `Dadu ${state.dice[0]} + ${state.dice[1]} = ${state.dice[0] + state.dice[1]}`
  return 'Lempar dadu'
}

export default function TurnHeader({ state }: Props) {
  const player = state.players[state.currentPlayer]
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-[0.25em] text-muted">Giliran</div>
      <div className="text-2xl font-bold text-gold leading-tight">{player.name}</div>
      <div className="text-sm text-muted mt-0.5">{statusText(state)}</div>
    </div>
  )
}
```

Note: `GamePhase` is imported and referenced by type through `GameState`; it is intentionally listed in the import so lint's no-unused check passes only if used. If `GamePhase` ends up unused in `statusText`, remove it from the import.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/__tests__/TurnHeader.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TurnHeader.tsx src/components/__tests__/TurnHeader.test.tsx
git commit -m "feat: turn/status header for center panel"
```

---

## Task 3: Dice roller visual rework

**Files:**
- Modify: `src/components/DiceRoller.tsx`

**Interfaces:**
- Consumes: `Dice` (Task 1), `Button`, `GamePhase`, `GameState` from `../types/game`.
- Produces: `DiceRoller` default export, props `{ state: GameState; onRoll: () => void }`. Roll button label must contain `Lempar`.

- [ ] **Step 1: Rewrite `DiceRoller.tsx`**

Replace the whole file:

```tsx
import { useState } from 'react'
import { GamePhase, type GameState } from '../types/game'
import Dice from './Dice'
import Button from './Button'

interface Props {
  state: GameState
  onRoll: () => void
}

export default function DiceRoller({ state, onRoll }: Props) {
  const [rolling, setRolling] = useState(false)
  const player = state.players[state.currentPlayer]

  function handleRoll() {
    setRolling(true)
    onRoll()
    setTimeout(() => setRolling(false), 500)
  }

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center">
        <Dice value={state.dice?.[0]} rolling={rolling} />
        <Dice value={state.dice?.[1]} rolling={rolling} />
      </div>
      {(canRoll || canRollJail) && (
        <Button variant="primary" size="lg" onClick={handleRoll}>
          {player.inJail ? 'Lempar Dadu (Penjara)' : 'Lempar Dadu'}
        </Button>
      )}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-base text-muted text-center">
          Ganda? {state.dice[0] === state.dice[1] ? 'Ya!' : 'Tidak'} — {3 - player.jailTurns}x lagi
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/DiceRoller.tsx
git commit -m "refactor: dice roller visuals for glass panel"
```

---

## Task 4: Player chips with money

**Files:**
- Modify: `src/components/PlayerCard.tsx`
- Modify: `src/components/PlayerPanel.tsx`
- Test: `src/components/__tests__/PlayerCard.test.tsx`

**Interfaces:**
- Consumes: `Player`, `Space` from `../types/game`; `formatMoney` from `../utils/format`; `PlayerCard` props unchanged (`player`, `isCurrent`, `color`, `diff`, `board`).
- Produces: `PlayerCard` body includes a money line (restores `Rp` for Playwright), keeps the hover popup. `PlayerPanel` renders `PlayerCard`s in a horizontal wrap.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/PlayerCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerCard from '../PlayerCard'
import type { Player, Space } from '../../types/game'

const player: Player = {
  id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
  passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false,
}
const board: Space[] = []

describe('PlayerCard', () => {
  it('shows the player money', () => {
    render(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByText(/Rp/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/__tests__/PlayerCard.test.tsx`
Expected: FAIL (current card body shows no `Rp`).

- [ ] **Step 3: Modify `PlayerCard.tsx`**

Replace the outer card element and body (keep `PlayerPopup` and `MoneyChange` unchanged). The card body becomes:

```tsx
      <div
        data-testid="player-card"
        ref={ref}
        className={[
          'px-2 py-1.5 rounded-lg bg-bg-dark/70 border border-border-light overflow-hidden flex-1 min-w-[130px]',
          isCurrent ? 'ring-2 ring-gold/80 bg-[#1a4a7a]/70' : '',
          player.bankrupt ? 'opacity-50' : '',
        ].join(' ')}
        style={{ borderLeft: `3px solid ${color}` }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="flex items-center gap-1.5 text-base">
          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
          <strong className="truncate">{player.name}</strong>
          {player.inJail && <span>🔒</span>}
          {player.bankrupt && <span className="text-xs font-bold text-red-danger">BANGKRUT</span>}
        </div>
        <div className="text-sm text-green-money font-semibold flex items-center">
          <span>{formatMoney(player.money)}</span>
          {diff && <MoneyChange key={diff.key} diff={diff.diff} />}
        </div>
      </div>
```

- [ ] **Step 4: Modify `PlayerPanel.tsx`**

Replace the `return` block so it renders a horizontal wrap (keep the diff-effect `useEffect` and imports unchanged):

```tsx
  return (
    <div className="w-full">
      <div className="text-xs uppercase tracking-[0.25em] text-muted mb-1.5 text-center">Pemain</div>
      <div className="flex flex-wrap gap-2 justify-center">
        {players.map((player) => {
          const isCurrent = player.id === currentPlayer
          return (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrent={isCurrent}
              color={playerColors[player.id]}
              diff={diffs[player.id] ?? null}
              board={board}
            />
          )
        })}
      </div>
    </div>
  )
```

- [ ] **Step 5: Run unit tests + typecheck**

Run: `npx vitest run src/components/__tests__/PlayerCard.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayerCard.tsx src/components/PlayerPanel.tsx src/components/__tests__/PlayerCard.test.tsx
git commit -m "refactor: player chips with money in center panel"
```

---

## Task 5: Action section flat styling

**Files:**
- Modify: `src/components/ActionSection.tsx`

**Interfaces:**
- Consumes: `Button`, `formatMoney`, `JAIL_FINE`, `GamePhase`, `PendingActionType`, `GameState`.
- Produces: same `ActionSection` default export and props (unchanged). All branch logic preserved; only the per-branch wrapper `<div>` classes change from boxed cards to flat `flex` stacks. Button labels unchanged.

- [ ] **Step 1: Replace each wrapper**

Replace every occurrence of the wrapper class

```
className="bg-bg-card rounded-lg p-2 flex-shrink-0 w-full"
```

with

```
className="flex flex-col gap-1.5 w-full items-stretch"
```

There are four such wrappers (BuyProperty, PayRent/Bankruptcy, DrawCard, CardEffect) plus the final default branch wrapper. For the BuyProperty, PayRent/Bankruptcy, and CardEffect branches, keep the inner `flex flex-col gap-1 items-center` div as-is. The DrawCard branch keeps its single `Button`.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ActionSection.tsx
git commit -m "refactor: flat action section styling"
```

---

## Task 6: Collapsed mini-log

**Files:**
- Modify: `src/components/EventLog.tsx`
- Test: `src/components/__tests__/EventLog.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EventLog` default export, props `{ log: string[] }`. Collapsed shows last 2 entries; a toggle button labeled `Riwayat penuh ▾` / `Tutup ▴` appears only when `log.length > 2`. Entry elements keep `data-testid="event-entry"`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/EventLog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import EventLog from '../EventLog'

describe('EventLog', () => {
  it('shows only the last two entries when collapsed', () => {
    const { getAllByTestId } = render(<EventLog log={['a', 'b', 'c']} />)
    expect(getAllByTestId('event-entry')).toHaveLength(2)
  })

  it('shows all entries when expanded', () => {
    const { getByRole, getAllByTestId } = render(<EventLog log={['a', 'b', 'c']} />)
    fireEvent.click(getByRole('button', { name: /Riwayat penuh/ }))
    expect(getAllByTestId('event-entry')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/__tests__/EventLog.test.tsx`
Expected: FAIL (current `EventLog` renders all entries, no toggle).

- [ ] **Step 3: Rewrite `EventLog.tsx`**

Replace the whole file:

```tsx
import { useRef, useEffect, useState } from 'react'

interface Props {
  log: string[]
}

export default function EventLog({ log }: Props) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log, expanded])

  const visible = expanded ? log : log.slice(-2)

  return (
    <div className="w-full border-t border-border pt-2">
      <div
        data-testid="event-log"
        ref={ref}
        className={expanded ? 'max-h-32 overflow-y-auto' : ''}
      >
        {visible.map((entry, i) => (
          <div
            key={expanded ? i : log.length - visible.length + i}
            data-testid="event-entry"
            className="text-xs text-muted leading-snug py-0.5"
          >
            {entry}
          </div>
        ))}
        {log.length === 0 && <div className="text-xs text-muted">Belum ada kejadian</div>}
      </div>
      {log.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gold mt-1 hover:opacity-80"
        >
          {expanded ? 'Tutup ▴' : 'Riwayat penuh ▾'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/__tests__/EventLog.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EventLog.tsx src/components/__tests__/EventLog.test.tsx
git commit -m "feat: collapsed mini event log with expand toggle"
```

---

## Task 7: Glass panel shell + design tokens

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `TurnHeader` (Task 2), `DiceRoller` (Task 3), `PlayerPanel` (Task 4), `ActionSection` (Task 5), `EventLog` (Task 6). `GameState` from `../types/game`.
- Produces: `Sidebar` default export, same props as today. Renders `data-testid="sidebar"` as a centered glass card. Drops the landscape/portrait branching.

- [ ] **Step 1: Add glass tokens to `src/index.css`**

Inside the existing `@theme { ... }` block, add after the `--color-cell-free-parking` line:

```css
  --color-panel: rgba(22, 33, 62, 0.72);
  --color-panel-border: rgba(240, 192, 64, 0.18);
```

(The `--color-glass-highlight` token from the spec is intentionally omitted — unused; YAGNI.)

- [ ] **Step 2: Rewrite `Sidebar.tsx`**

Replace the whole file:

```tsx
import type { GameState } from '../types/game'
import TurnHeader from './TurnHeader'
import DiceRoller from './DiceRoller'
import PlayerPanel from './PlayerPanel'
import ActionSection from './ActionSection'
import EventLog from './EventLog'

interface Props {
  state: GameState
  onRoll: () => void
  onEndTurn: () => void
  onProposeTrade: () => void
  onDrawCard: () => void
  onBuyProperty: () => void
  onDeclineBuy: () => void
  onPayRent: () => void
  onDeclareBankruptcy: () => void
  onSkipAction: () => void
  onPayJailFine: () => void
  onUseGetOutOfJailFree: () => void
}

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']

export default function Sidebar({ state, ...actions }: Props) {
  return (
    <div
      data-testid="sidebar"
      className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none"
    >
      <div className="pointer-events-auto w-[min(380px,92%)] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-panel-border bg-panel backdrop-blur-md shadow-2xl px-5 py-4 flex flex-col gap-4">
        <TurnHeader state={state} />
        <DiceRoller state={state} onRoll={actions.onRoll} />
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} />
        <ActionSection state={state} {...actions} />
        <EventLog log={state.eventLog} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/components/Sidebar.tsx
git commit -m "feat: unified glass center panel"
```

---

## Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Unit tests**

Run: `npm run test:unit`
Expected: all vitest tests PASS (existing logic tests + the 4 new component tests).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: E2E**

Run: `npm run test:e2e`
Expected: PASS — confirms `sidebar` visible, `Lempar` button, `player-card` count and `Rp` money, and a multi-turn game without crash.

- [ ] **Step 4: Visual check**

Run: `npm run dev -- --port 4173`, open the app, start a 2-player game, and take screenshots to confirm: single centered glass card, pip dice, gold-highlighted current player chip, no nested boxes. If any spacing/sizing is off, adjust classes in `Sidebar.tsx` and re-run Step 1–3.

- [ ] **Step 5: Commit any visual fixes**

```bash
git add -A
git commit -m "chore: center panel visual polish"
```

---

## Self-Review Notes

- **Spec coverage:** tokens → Task 7; pip dice → Task 1; header → Task 2; dice/roll → Task 3; player chips → Task 4; flat actions → Task 5; mini-log → Task 6; single glass shell → Task 7. All spec sections covered.
- **Selector contract:** `sidebar` (Task 7), `Lempar` (Task 3), `player-card` + `Rp` (Task 4), action labels (Task 5) all preserved.
- **Placeholders:** none — all steps contain full code.
- **Type consistency:** `Dice` props `{ value?: number | null; rolling: boolean }` used identically in Task 1 and Task 3. `PlayerCard` props `{ player, isCurrent, color, diff, board }` used identically in Task 4 and `PlayerPanel`. `EventLog` `data-testid="event-entry"` consistent between Task 6 and its test.
