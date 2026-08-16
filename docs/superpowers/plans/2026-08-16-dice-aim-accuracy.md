# Accurate Press-to-Lock Dice Aim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the click-to-stop speedometer roll record the aim the player actually saw: capture on pointer press instead of mouse-up, and never let the recorded value run ahead of the painted needle.

**Architecture:** All changes live in `DiceRoller.tsx` and its test. The sweep stops writing the ref from the timer; a `useEffect` mirrors the last committed `aimValue` into `aimValueRef`, so the click reads exactly what was painted. The sweep switches from `setInterval(16ms)` to `requestAnimationFrame` (advances only on real paint frames) and is gated on `!rolling` so the needle freezes at the locked value on press. The button captures on primary `onPointerDown`; keyboard activation goes through `onClick` with an `e.detail === 0` guard (real pointer clicks carry `detail >= 1`), and a synchronous `rollingRef` prevents double-rolls.

**Tech Stack:** React 19 + TypeScript (strict, `erasableSyntaxOnly`), Tailwind v4, Vitest 4 + Testing Library (jsdom). Spec: `docs/superpowers/specs/2026-08-16-dice-aim-accuracy-design.md`.

## Global Constraints

- Component files omit semicolons and use single quotes (match `DiceRoller.tsx`).
- No TS enums; `verbatimModuleSyntax` (type-only imports via `import type`); `noUnusedLocals`/`noUnusedParameters` on.
- The sweep effect body must contain NO direct `setState` calls (all `setAimValue` calls stay inside timer/rAF callbacks); no `react-hooks/set-state-in-effect` suppression.
- Do NOT modify `Speedometer.tsx`, `Button.tsx`, `controlledDice.ts`, the reducer, `src/types/net.ts`, or any i18n string.
- Keep `SWEEP_MS = 800` and `STEPPED_TICK_MS = 80`; the skill difficulty is unchanged.
- Verified: Vitest 4's default `vi.useFakeTimers()` fakes `requestAnimationFrame` at a 16ms cadence, so existing test advances (240/400/640/800/880ms, all multiples of 16) land on exact sweep values. Do NOT change the test timer setup.
- After the task, run `npm run typecheck`, `npm run lint`, and `npm run test:unit`.

---

### Task 1: Accurate press-to-lock roll in DiceRoller

**Files:**
- Modify: `src/components/DiceRoller.tsx`
- Modify: `src/components/__tests__/DiceRoller.test.tsx`

**Interfaces:**
- Consumes: `Speedometer({ value, label })` (unchanged), `Button` (spreads all button props, so `onPointerDown`/`onClick` pass through), `onRoll(target: number)` from the parent, `t('dice.gauge')`, `t('dice.stopHint')`.
- Produces: `DiceRoller` where a primary-button press instantly locks the current needle value and rolls it; Enter/Space still roll via keyboard; a press can never roll twice; the recorded target always equals the last painted needle value; the needle freezes at the locked value while `rolling`.

- [ ] **Step 1: Add the failing tests**

Append these tests inside the existing `describe('click-to-stop control', ...)` block in `src/components/__tests__/DiceRoller.test.tsx`, after the `'stops the needle and rolls the locked target on click'` test:

```tsx
    it('locks the target on primary pointer press', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(240/800) = 5
      fireEvent.pointerDown(button, { button: 0 })

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(5)
    })

    it('ignores non-primary pointer presses', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(240))
      fireEvent.pointerDown(button, { button: 2 })

      expect(onRoll).not.toHaveBeenCalled()
    })

    it('ignores pointer-driven clicks (detail > 0)', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(240))
      fireEvent.click(button, { detail: 1 })

      expect(onRoll).not.toHaveBeenCalled()
    })

    it('does not double-roll when a press is followed by its compat click', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(240))
      fireEvent.pointerDown(button, { button: 0 })
      fireEvent.click(button) // detail 0 → keyboard path, blocked by the rolling guard

      expect(onRoll).toHaveBeenCalledTimes(1)
    })

    it('does not re-roll after the button is held past the rolling reset', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button, { button: 0 })
      act(() => vi.advanceTimersByTime(600)) // 500ms rolling reset fires
      fireEvent.click(button, { detail: 1 }) // mouse-up after the long hold

      expect(onRoll).toHaveBeenCalledTimes(1)
    })

    it('freezes the needle at the locked value after pressing', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(240)) // needle at 5
      const before = needleTip()
      fireEvent.pointerDown(button, { button: 0 })
      act(() => vi.advanceTimersByTime(400)) // sweep must be frozen now

      expect(needleTip()).toEqual(before)
      expect(onRoll).toHaveBeenCalledWith(5)
    })
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: FAIL — the old component has no `onPointerDown` handler (so `'locks the target on primary pointer press'` and `'freezes the needle at the locked value after pressing'` fail), and its plain `onClick` rolls on `detail: 1` (so `'ignores pointer-driven clicks (detail > 0)'` fails). The existing click-to-stop tests still pass.

- [ ] **Step 3: Rewrite `src/components/DiceRoller.tsx`**

Replace the whole file with:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
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
  const rollingRef = useRef(false)
  const directionRef = useRef(1)
  const player = state.players[state.currentPlayer]

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail && state.dice === null
  const canAim = (canRoll || canRollJail) && isMyTurn

  useEffect(() => {
    aimValueRef.current = aimValue
  }, [aimValue])

  useEffect(() => {
    if (!canAim || rolling) return
    if (reducedMotion) {
      directionRef.current = 1
      const id = setInterval(() => {
        setAimValue((v) => {
          const next = v + directionRef.current
          if (next > MAX_TOTAL) {
            directionRef.current = -1
            return MAX_TOTAL
          }
          if (next < MIN_TOTAL) {
            directionRef.current = 1
            return MIN_TOTAL
          }
          return next
        })
      }, STEPPED_TICK_MS)
      return () => clearInterval(id)
    }
    const start = Date.now() - msForValue(aimValueRef.current)
    let rafId = 0
    const tick = () => {
      const value = sweepValue(Date.now() - start)
      setAimValue(value)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [canAim, rolling, reducedMotion])

  function stopAndRoll() {
    if (rollingRef.current) return
    rollingRef.current = true
    setRolling(true)
    onRoll(Math.round(aimValueRef.current))
    setTimeout(() => {
      rollingRef.current = false
      setRolling(false)
    }, 500)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    stopAndRoll()
  }

  function handleClick(e: ReactMouseEvent<HTMLButtonElement>) {
    if (e.detail !== 0) return
    stopAndRoll()
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
        <Button variant="primary" size="lg" onPointerDown={handlePointerDown} onClick={handleClick}>
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

Key points (read before writing):
- `FRAME_MS` is deleted; the rAF path has no interval.
- The first `useEffect` mirrors the last committed `aimValue` into `aimValueRef` — this is the accuracy fix. The sweep effect only calls `setAimValue` and never touches `aimValueRef`.
- The sweep effect early-returns when `rolling` is true, so the needle freezes at the locked value on press.
- `rollingRef` is a synchronous guard; `onClick` only handles keyboard activation (`detail === 0`); primary pointer presses are handled by `onPointerDown`.
- The reduced-motion branch no longer writes `aimValueRef` (the mirror effect owns it) but still mutates `directionRef` inside the updater, as before.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: PASS — all existing click-to-stop tests plus the six new regression tests.

- [ ] **Step 5: Run the full checks**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green (lint only the 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx`).

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`, start a local game: on your turn the gauge appears with the needle sweeping; press the roll button — the needle freezes at the value under the needle at the exact moment of the press, and the roll fires; pressing with the right mouse button does nothing; Enter/Space on the button also rolls. After the roll, dice faces appear as before.

- [ ] **Step 7: Commit**

```bash
git add src/components/DiceRoller.tsx src/components/__tests__/DiceRoller.test.tsx
git commit -m "fix: accurate press-to-lock dice aim (rAF sweep, capture on press)"
```
