# Speedometer Click-to-Stop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the speedometer from a hold-to-aim interaction to a click-to-stop one: the gauge is always visible when it's the player's turn to roll, the needle sweeps continuously on its own, and clicking the roll button freezes it at the target number and rolls.

**Architecture:** All changes live in `DiceRoller.tsx` (plus its test and the two locale files). The `holding` state is replaced by a `canAim = (canRoll || canRollJail) && isMyTurn` gate: the sweep effect runs while `canAim`, seeding its start time from the current needle position so motion continues seamlessly (no restart, no `setState` in the effect body), and the button becomes a plain `onClick` that stops the needle and rolls. `Speedometer` and the luck/reducer logic are untouched.

**Tech Stack:** React 19 + TypeScript (strict, `erasableSyntaxOnly`), Tailwind v4, Vitest + Testing Library (jsdom). Spec: `docs/superpowers/specs/2026-08-16-speedometer-click-stop-design.md`.

## Global Constraints

- Component files omit semicolons and use single quotes (match `DiceRoller.tsx`).
- No TS enums; `verbatimModuleSyntax` (type-only imports via `import type`); `noUnusedLocals`/`noUnusedParameters` on.
- i18n: keys exist in **both** `src/i18n/locales/en/translation.json` and `id/translation.json`; removing/renaming a key affects BOTH locales.
- The effect body must contain NO direct `setState` calls (the repo's `react-hooks/set-state-in-effect` rule is enforced and the previous feature deliberately removed all suppressions for it).
- `Speedometer` component and its geometry must not change.
- After the task, run `npm run typecheck`, `npm run lint`, and `npm run test:unit`.

---

### Task 1: Click-to-stop DiceRoller

**Files:**
- Modify: `src/components/DiceRoller.tsx`
- Modify: `src/components/__tests__/DiceRoller.test.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `id/translation.json`

**Interfaces:**
- Consumes: `Speedometer({ value, label })` (existing), `t('dice.gauge')`, `t('dice.stopHint')` (new key), `onRoll(target)`.
- Produces: final click-to-stop behavior — gauge shown while `canAim`, needle sweeping; click (or keyboard Enter/Space, which the native `<button onClick>` handles) stops and rolls `Math.round(aimValue)`.

- [ ] **Step 1: Rewrite the failing tests**

In `src/components/__tests__/DiceRoller.test.tsx`, replace the whole `describe('hold-to-roll control', ...)` block (currently lines 39–175) with:

```tsx
  describe('click-to-stop control', () => {
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

    it('shows the speedometer and hides the dice when it is the player turn to roll', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      expect(screen.getByTestId('speedometer')).toBeInTheDocument()
      expect(screen.queryAllByTestId('dice')).toHaveLength(0)
    })

    it('shows the dice faces instead of the gauge after a roll', () => {
      const s = { ...makeState(), dice: [3, 4] as [number, number] }
      renderWithProviders(<DiceRoller state={s} onRoll={() => {}} isMyTurn={true} />)
      expect(screen.queryByTestId('speedometer')).toBeNull()
      expect(screen.queryAllByTestId('dice')).toHaveLength(2)
    })

    it('shows no gauge when it is not the player turn', () => {
      renderWithProviders(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={false} />)
      expect(screen.queryByTestId('speedometer')).toBeNull()
    })

    it('stops the needle and rolls the locked target on click', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(240/800) = 5
      fireEvent.click(button)

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(5)
    })

    it('sweeps continuously (needle moves between whole values)', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)

      act(() => vi.advanceTimersByTime(400)) // value = 2 + 10*(400/800) = 7 → top
      expect(needleTip()).toEqual({ x: 70, y: 26 }) // straight up, into the arc

      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(640/800) = 10
      const tip = needleTip()
      expect(tip.x).toBeCloseTo(101.11, 2) // moved up-right, past the apex
      expect(tip.y).toBeCloseTo(38.89, 2)
    })

    it('turns around at the top boundary without overshooting', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(800)) // apex 12
      const apex = needleTip()
      expect(apex.x).toBeCloseTo(112.5, 1) // 12 → up-right at 15°
      expect(apex.y).toBeCloseTo(58.61, 2)
      expect(apex.y).toBeLessThan(70) // never pointing down away from the arc

      act(() => vi.advanceTimersByTime(80)) // descending: 2 + 10*(880/800) = 11
      const tip = needleTip()
      expect(tip.x).toBeCloseTo(108.11, 2)
      expect(tip.y).toBeCloseTo(48, 1)
      expect(tip.y).toBeLessThan(70)

      fireEvent.click(button)
      expect(onRoll).toHaveBeenCalledWith(11)
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

      act(() => vi.advanceTimersByTime(40)) // stepped: no 80ms tick yet → still 2
      const low = needleTip()
      expect(low.x).toBeCloseTo(27.5, 1) // 2 → up-left at 165°
      expect(low.y).toBeCloseTo(58.61, 2)
      expect(low.y).toBeLessThan(70)

      act(() => vi.advanceTimersByTime(80)) // one tick → 3
      const stepped = needleTip()
      expect(stepped.x).toBeCloseTo(31.89, 2) // 3 → up-left at 150°
      expect(stepped.y).toBeCloseTo(48, 1)

      fireEvent.click(button)
      expect(onRoll).toHaveBeenCalledWith(3)
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
  })
```

> Note: there is intentionally no dedicated keyboard test — the button is a standard `<button onClick>`, and Enter/Space natively fire `click` in real browsers (and in Playwright), so the click test covers the keyboard path. There is no `@testing-library/user-event` dependency in this repo.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: FAIL — the old code renders the gauge only while `holding` (so the new no-hold tests fail), the button has no `onClick`, and `dice.stopHint` doesn't exist yet.

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

function msForValue(value: number): number {
  return ((value - MIN_TOTAL) / (MAX_TOTAL - MIN_TOTAL)) * SWEEP_MS
}

export default function DiceRoller({ state, onRoll, isMyTurn = true }: Props) {
  const { t } = useTranslation()
  const [rolling, setRolling] = useState(false)
  const [aimValue, setAimValue] = useState(MIN_TOTAL)
  const [reducedMotion] = useState(() => {
    const mq = window.matchMedia
    return mq ? mq('(prefers-reduced-motion: reduce)').matches : false
  })
  const aimValueRef = useRef(MIN_TOTAL)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null
  const canAim = (canRoll || canRollJail) && isMyTurn

  useEffect(() => {
    if (!canAim) return
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
    const start = Date.now() - msForValue(aimValueRef.current)
    const id = setInterval(() => {
      const value = sweepValue(Date.now() - start)
      aimValueRef.current = value
      setAimValue(value)
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [canAim, reducedMotion])

  function stopAndRoll() {
    if (rolling) return
    setRolling(true)
    onRoll(Math.round(aimValueRef.current))
    setTimeout(() => setRolling(false), 500)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 justify-center">
        {canAim ? (
          <Speedometer value={aimValue} label={t('dice.gauge')} />
        ) : (
          <>
            <Dice value={state.dice?.[0]} rolling={rolling} />
            <Dice value={state.dice?.[1]} rolling={rolling} />
          </>
        )}
      </div>
      {canAim && (
        <Button variant="primary" size="lg" onClick={stopAndRoll}>
          {player.inJail ? t('dice.rollJail') : state.doublesCount > 0 ? t('action.rollAgain') : t('dice.roll')}
        </Button>
      )}
      {canAim && <p className="text-sm text-muted text-center">{t('dice.stopHint')}</p>}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-base text-muted text-center">
          {t('dice.doubles', { result: state.dice[0] === state.dice[1] ? t('common.yes') : t('action.no'), n: 3 - player.jailTurns })}
        </p>
      )}
    </div>
  )
}
```

> The sweep effect contains NO direct `setState` calls (all `setAimValue` calls are inside interval callbacks), so no `react-hooks/set-state-in-effect` suppression is needed. The seam `start = Date.now() − msForValue(aimValueRef.current)` makes the needle continue from its current position when `canAim` turns true, so there is no restart-at-2 and no one-frame jump.

- [ ] **Step 4: Update the locale files**

In `src/i18n/locales/en/translation.json`, replace:
```json
  "dice.holdHint": "Hold to aim, release to roll",
```
with:
```json
  "dice.stopHint": "Watch the needle — click to stop",
```

In `src/i18n/locales/id/translation.json`, replace:
```json
  "dice.holdHint": "Tahan untuk membidik, lepas untuk melempar",
```
with:
```json
  "dice.stopHint": "Amati jarumnya — klik untuk berhenti",
```

Then verify no lingering references and valid JSON:

```bash
grep -rn "holdHint" src/ server/ e2e/
node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en/translation.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/id/translation.json','utf8')); console.log('JSON OK')"
```
Expected: `holdHint` has no matches; `JSON OK`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: PASS (3 top-level button tests + 7 click-to-stop tests).

- [ ] **Step 6: Run checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green (lint only the 2 pre-existing `PlayerTokens.tsx` warnings).

- [ ] **Step 7: Manual smoke check (optional)**

Run `npm run dev`, start a local game: on your turn the gauge appears with the needle sweeping on its own; click the button to stop it and roll; the dice faces show the result; the gauge returns on the next roll.

- [ ] **Step 8: Commit**

```bash
git add src/components/DiceRoller.tsx src/components/__tests__/DiceRoller.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: click-to-stop speedometer roll"
```
