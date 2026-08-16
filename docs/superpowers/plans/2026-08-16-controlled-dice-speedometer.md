# Speedometer Gauge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain "Aiming: N" hold-to-roll readout with a speedometer-style gauge — a black panel with a white 150° arc, tick marks for 2–12, labels 2/7/12, and a gold needle that sweeps continuously while held, locking the nearest value on release.

**Architecture:** A new presentational `Speedometer` SVG component maps a `value` (2–12) to a needle angle (`valueToAngle`, exported for tests) and renders the dial deterministically. `DiceRoller` owns the sweep: while `holding`, it runs a 16ms interval computing `aimValue = 2 + 10 × triangle((now − start) / 800)` and hides the two `Dice` faces in favor of the gauge; release locks `Math.round(aimValue)`. `prefers-reduced-motion` falls back to the existing stepped 80ms ticker.

**Tech Stack:** React 19 + TypeScript (strict, `erasableSyntaxOnly`), Tailwind v4 tokens, Vitest + Testing Library (jsdom). Spec: `docs/superpowers/specs/2026-08-16-controlled-dice-speedometer-design.md`.

## Global Constraints

- No TS enums — `const` objects + derived union types (`erasableSyntaxOnly: true`).
- `verbatimModuleSyntax: true` — type-only imports must use `import type`.
- `noUnusedLocals` / `noUnusedParameters` are on.
- i18n: keys exist in **both** `src/i18n/locales/en/translation.json` and `id/translation.json`; removing a key means removing it from BOTH.
- Component files omit semicolons and use single quotes (match `DiceRoller.tsx`).
- Components using i18n must be tested with `renderWithProviders` from `src/test/test-utils.tsx` (test setup pins language to `en`).
- After each task, run `npm run typecheck`, `npm run lint`, and `npm run test:unit`.
- The color token `text-gold` (game accent) is used for the needle; white (`text-white`) for the arc/ticks/labels.

---

### Task 1: `Speedometer` component

**Files:**
- Create: `src/components/Speedometer.tsx`
- Test: `src/components/__tests__/Speedometer.test.tsx`

**Interfaces:**
- Produces: `export default function Speedometer({ value }: { value: number }): JSX.Element` — renders the gauge with `data-testid="speedometer"`, the needle in a `<g data-testid="speedometer-needle">` carrying SVG attribute `transform="rotate(<angle> 70 70)"`, 11 tick lines, and labels 2/7/12.
- Produces: `export function valueToAngle(value: number): number` → `165 − 150 × ((value − 2) / 10)` degrees (screen convention: 0° = right, 90° = up).
- Consumes: nothing (Tailwind tokens only).

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/Speedometer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Speedometer, { valueToAngle } from '../Speedometer'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('valueToAngle', () => {
  it('maps the scale linearly across the 150° arc', () => {
    expect(valueToAngle(2)).toBe(165) // left end
    expect(valueToAngle(7)).toBe(90) // top apex
    expect(valueToAngle(12)).toBe(15) // right end
    expect(valueToAngle(2 + 10 * 0.5)).toBe(90)
  })
})

describe('Speedometer', () => {
  it('renders the gauge with the three landmark labels', () => {
    renderWithProviders(<Speedometer value={7} />)
    expect(screen.getByTestId('speedometer')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders 11 tick marks (one per value 2..12)', () => {
    renderWithProviders(<Speedometer value={7} />)
    expect(screen.getAllByTestId('speedometer-tick')).toHaveLength(11)
  })

  it('points the needle at the value angle', () => {
    const { rerender } = renderWithProviders(<Speedometer value={2} />)
    expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(165 70 70)')

    rerender(<Speedometer value={7} />)
    expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(90 70 70)')

    rerender(<Speedometer value={12} />)
    expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(15 70 70)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Speedometer.test.tsx`
Expected: FAIL — module `../Speedometer` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/Speedometer.tsx`:

```tsx
const CX = 70
const CY = 70
const RADIUS = 52
const NEEDLE_LENGTH = 44

const TICKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const LABELED = new Set([2, 7, 12])

export function valueToAngle(value: number): number {
  return 165 - 150 * ((value - 2) / 10)
}

function pointOnArc(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180
  return [CX + radius * Math.cos(rad), CY - radius * Math.sin(rad)]
}

export default function Speedometer({ value }: { value: number }) {
  const [arcStartX, arcStartY] = pointOnArc(165, RADIUS)
  const [arcEndX, arcEndY] = pointOnArc(15, RADIUS)
  const needleAngle = valueToAngle(value)

  return (
    <svg
      data-testid="speedometer"
      viewBox="0 0 140 78"
      className="w-52 h-auto bg-bg-card rounded-xl text-white"
      role="img"
      aria-label="Dice gauge"
    >
      <path
        d={`M ${arcStartX} ${arcStartY} A ${RADIUS} ${RADIUS} 0 0 1 ${arcEndX} ${arcEndY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      {TICKS.map((v) => {
        const a = valueToAngle(v)
        const labeled = LABELED.has(v)
        const [innerX, innerY] = pointOnArc(a, RADIUS - (labeled ? 8 : 5))
        const [outerX, outerY] = pointOnArc(a, RADIUS + (labeled ? 6 : 3))
        return (
          <line
            key={v}
            data-testid="speedometer-tick"
            x1={innerX}
            y1={innerY}
            x2={outerX}
            y2={outerY}
            stroke="currentColor"
            strokeWidth={labeled ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        )
      })}
      {[...LABELED].map((v) => {
        const [x, y] = pointOnArc(valueToAngle(v), RADIUS + 10)
        return (
          <text key={v} x={x} y={y} fill="currentColor" fontSize="10" textAnchor="middle" dominantBaseline="middle">
            {v}
          </text>
        )
      })}
      <g data-testid="speedometer-needle" transform={`rotate(${needleAngle} ${CX} ${CY})`}>
        <line
          x1={CX}
          y1={CY}
          x2={CX + NEEDLE_LENGTH}
          y2={CY}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-gold"
        />
      </g>
      <circle cx={CX} cy={CY} r="3.5" fill="currentColor" className="text-gold" />
    </svg>
  )
}
```

> Note: `text-white` on the `<svg>` makes `currentColor` white for arc/ticks/labels; the needle line and hub carry `className="text-gold"` which overrides `currentColor` to the game's gold accent. SVG `transform="rotate(a cx cy)"` rotates in viewBox units, so the needle test asserts the exact attribute string.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Speedometer.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/Speedometer.tsx src/components/__tests__/Speedometer.test.tsx
git commit -m "feat: speedometer gauge component"
```

---

### Task 2: DiceRoller sweep integration + readout removal

**Files:**
- Modify: `src/components/DiceRoller.tsx`
- Modify: `src/i18n/locales/en/translation.json` (remove `dice.aiming`)
- Modify: `src/i18n/locales/id/translation.json` (remove `dice.aiming`)
- Test: `src/components/__tests__/DiceRoller.test.tsx`

**Interfaces:**
- Consumes: Task 1 `Speedometer` (default export) and `valueToAngle` (for needle-transform assertions in tests).
- Produces: final hold-to-roll behavior — hold shows the gauge (dice hidden), release calls `onRoll(target)` with an integer 2–12; `prefers-reduced-motion` uses the stepped 80ms ticker.

- [ ] **Step 1: Write the failing tests**

Replace the whole `describe('hold-to-roll control', ...)` block in `src/components/__tests__/DiceRoller.test.tsx` (lines 34–86) with:

```tsx
  describe('hold-to-roll control', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows the speedometer and hides the dice while holding', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      expect(screen.getByTestId('speedometer')).toBeInTheDocument()
      expect(screen.queryAllByTestId('dice')).toHaveLength(0)
      expect(screen.queryByTestId('dice-aim')).toBeNull()

      fireEvent.pointerUp(button)
    })

    it('rolls the locked target after a continuous sweep', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(240/800) = 5
      fireEvent.pointerUp(button)

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(5)
    })

    it('sweeps continuously (needle moves between whole values)', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(400)) // value = 2 + 10*(400/800) = 7 → top
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(90 70 70)')

      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(640/800) = 10
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe(
        `rotate(${valueToAngle(10)} 70 70)`,
      )
      fireEvent.pointerUp(button)
    })

    it('turns around at the top boundary without overshooting', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(800)) // apex 12
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(15 70 70)')

      act(() => vi.advanceTimersByTime(80)) // descending: 2 + 10*(880/800) = 11
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe(
        `rotate(${valueToAngle(11)} 70 70)`,
      )

      fireEvent.pointerUp(button)
      expect(onRoll).toHaveBeenCalledWith(11)
    })

    it('rolls the target via keyboard hold', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.keyDown(button, { key: ' ' })
      act(() => vi.advanceTimersByTime(160)) // value = 2 + 10*(160/800) = 4
      fireEvent.keyUp(button, { key: ' ' })

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(4)
    })

    it('falls back to the stepped ticker under prefers-reduced-motion', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(40)) // stepped: no 80ms tick yet → still 2
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(165 70 70)')

      act(() => vi.advanceTimersByTime(80)) // one tick → 3
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe(
        `rotate(${valueToAngle(3)} 70 70)`,
      )

      fireEvent.pointerUp(button)
      expect(onRoll).toHaveBeenCalledWith(3)
    })
  })
```

Update the import at the top of the test file (line 2) to add `beforeEach`:

```tsx
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
```

Add the `valueToAngle` import next to the `DiceRoller` import (import only the helper — the component itself is not rendered by this test file):

```tsx
import { valueToAngle } from '../Speedometer'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: FAIL — `dice-aim` assertions in the old tests + no `speedometer` element.

- [ ] **Step 3: Rewrite `src/components/DiceRoller.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GamePhase, type GameState } from '../types/game'
import Dice from './Dice'
import Button from './Button'
import Speedometer from './Speedometer'

interface Props {
  state: GameState
  onRoll: (target: number) => void
  isMyTurn?: boolean
}

const SWEEP_MS = 800
const FRAME_MS = 16
const MIN_TOTAL = 2
const MAX_TOTAL = 12
const STEPPED_TICK_MS = 80

function triangleFraction(elapsedMs: number): number {
  const phase = (elapsedMs / SWEEP_MS) % 2
  return phase <= 1 ? phase : 2 - phase
}

function sweepValue(elapsedMs: number): number {
  return MIN_TOTAL + (MAX_TOTAL - MIN_TOTAL) * triangleFraction(elapsedMs)
}

export default function DiceRoller({ state, onRoll, isMyTurn = true }: Props) {
  const { t } = useTranslation()
  const [rolling, setRolling] = useState(false)
  const [holding, setHolding] = useState(false)
  const [aimValue, setAimValue] = useState(MIN_TOTAL)
  const [reducedMotion, setReducedMotion] = useState(false)
  const aimValueRef = useRef(MIN_TOTAL)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  useEffect(() => {
    const mq = window.matchMedia
    setReducedMotion(mq ? mq('(prefers-reduced-motion: reduce)').matches : false)
  }, [])

  useEffect(() => {
    if (!holding) return
    aimValueRef.current = MIN_TOTAL
    setAimValue(MIN_TOTAL)
    if (reducedMotion) {
      directionRef.current = 1
      const id = setInterval(() => {
        setAimValue((v) => {
          const next = v + directionRef.current
          if (next > MAX_TOTAL) {
            directionRef.current = -1
            aimValueRef.current = MAX_TOTAL
            return MAX_TOTAL
          }
          if (next < MIN_TOTAL) {
            directionRef.current = 1
            aimValueRef.current = MIN_TOTAL
            return MIN_TOTAL
          }
          aimValueRef.current = next
          return next
        })
      }, STEPPED_TICK_MS)
      return () => clearInterval(id)
    }
    const start = Date.now()
    const id = setInterval(() => {
      const value = sweepValue(Date.now() - start)
      aimValueRef.current = value
      setAimValue(value)
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [holding, reducedMotion])

  function startHold() {
    if (rolling) return
    setHolding(true)
  }

  function lockTarget() {
    if (!holding) return
    setHolding(false)
    setRolling(true)
    onRoll(Math.round(aimValueRef.current))
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
        {holding ? (
          <Speedometer value={aimValue} />
        ) : (
          <>
            <Dice value={state.dice?.[0]} rolling={rolling} />
            <Dice value={state.dice?.[1]} rolling={rolling} />
          </>
        )}
      </div>
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
          onBlur={() => setHolding(false)}
        >
          {player.inJail ? t('dice.rollJail') : state.doublesCount > 0 ? t('action.rollAgain') : t('dice.roll')}
        </Button>
      )}
      {(canRoll || canRollJail) && isMyTurn && !holding && (
        <p className="text-sm text-muted text-center">{t('dice.holdHint')}</p>
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

- [ ] **Step 4: Remove the unused i18n key**

In BOTH `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json`, delete the line:

```json
  "dice.aiming": "Aiming: {{target}}",
```
(`id` value is `"Membidik: {{target}}",`.)

Verify no other code references it:

```bash
grep -rn "dice.aiming" src/ server/ e2e/
```
Expected: no matches.

Verify JSON still parses:

```bash
node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en/translation.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/id/translation.json','utf8')); console.log('JSON OK')"
```
Expected: `JSON OK`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx src/components/__tests__/Speedometer.test.tsx`
Expected: PASS (3 existing button tests + 6 new hold-to-roll tests + 4 Speedometer tests).

- [ ] **Step 6: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 7: Manual smoke check (optional)**

Run `npm run dev`, start a local game, press-and-hold the roll button: the two dice are replaced by the gauge, the gold needle sweeps 2 → 12 → 2, releasing rolls with the needle's value.

- [ ] **Step 8: Commit**

```bash
git add src/components/DiceRoller.tsx src/components/__tests__/DiceRoller.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: speedometer hold-to-roll gauge in DiceRoller"
```
