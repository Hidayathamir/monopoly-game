# Speedometer Click-to-Stop Design

Date: 2026-08-16

## Problem

The speedometer gauge (added in `2026-08-16-controlled-dice-speedometer-design.md`)
only appears while the player presses-and-holds the roll button, and the needle
sweeps only during that hold. The desired interaction is inverted: the gauge
should be visible whenever the player is about to roll, with the needle
sweeping continuously on its own, and the player **clicks** the button to stop
the needle at the number they want.

## Goals

- The speedometer appears automatically when it is the current player's turn to
  roll (`Waiting`, no pending action, dice not yet rolled), with the needle
  sweeping 2 → 12 → 2 → 12… continuously — no pressing-and-holding.
- Clicking the roll button (mouse/tap, or Enter/Space on keyboard) **freezes
  the needle at the current number** → that value is the aimed target → the
  dice roll happens with the existing luck-based precision.
- After the roll, the two **dice faces appear** showing the result (as today);
  the gauge returns the next time the player needs to roll (roll-again after
  doubles, next turn).
- When it is **not** the player's turn, or the roll is done, the gauge is
  hidden and the dice area renders as today.
- `prefers-reduced-motion` keeps the stepped 80ms ticker; clicking still stops
  it.
- The interaction hint text is updated to describe the new click-to-stop
  gesture.

## Non-Goals

- No change to the `Speedometer` component's geometry or the needle-direction
  fix from `2026-08-16-controlled-dice-speedometer` — the gauge still renders
  via `value` → `pointOnArc` tip coordinates.
- No change to game rules, actions, wire contract, or `controlledDice.ts`
  luck algorithm — this is interaction/presentation only, inside `DiceRoller`.
- No change to button labels ("Roll Dice" / "Roll Again" / "Roll Dice (Jail)").

## Design

### 1. Gauge visibility

`src/components/DiceRoller.tsx`:

- Introduce `const canAim = (canRoll || canRollJail) && isMyTurn`.
- Render `<Speedometer value={aimValue} label={t('dice.gauge')} />` in place
  of the two `Dice` faces when `canAim`; render the two `Dice` faces otherwise
  (idle, mid-roll, result shown, or not the player's turn).
- Remove the `holding` state entirely.

### 2. Continuous sweep

- The sweep effect runs while `canAim` instead of `while (holding)`. On each
  `canAim` becoming true, seed the sweep's start time from the current needle
  position (`start = Date.now() − msFor(aimValueRef.current)` where
  `msFor(v) = (v − 2) / 10 × 800`), so the needle continues sweeping
  seamlessly — no jump and no restart-at-2, and no `setState` call in the
  effect body. Then run the 16ms interval computing
  `sweepValue(Date.now() − start)`; `prefers-reduced-motion` runs the stepped
  80ms ticker, also continuing from the current value. Cleanup clears the
  interval when `canAim` turns false or the component unmounts.

### 3. Click to stop

- Replace the hold gesture (`onPointerDown`/`onPointerUp`/`onPointerCancel`,
  keyboard `onKeyDown`/`onKeyUp`, `onBlur`) with a plain `onClick` on the roll
  button (Enter/Space already trigger click natively).
- `stopAndRoll()`: guard `if (rolling) return`; set `rolling` true; call
  `onRoll(Math.round(aimValueRef.current))`; reset `rolling` after 500ms (as
  today). The stopped needle value becomes the aimed target.

### 4. Hint text

- Rename the i18n key `dice.holdHint` → `dice.stopHint` in **both** locales,
  with new values: en `"Watch the needle — click to stop"`, id
  `"Amati jarumnya — klik untuk berhenti"`. Render it under the button while
  `canAim` (the previous `!holding` condition is now unconditional when the
  button shows).

## Testing

- `src/components/__tests__/DiceRoller.test.tsx`:
  - Gauge shown (no hold needed) and dice hidden when it is the player's turn
    to roll.
  - Gauge hidden when `isMyTurn={false}` or when `state.dice !== null` (dice
    faces shown instead).
  - Click stops the sweep: with `SWEEP_MS = 800` and fake timers, advance to a
    known value (400ms → 7, 640ms → 10) then click → `onRoll` called once with
    the rounded value at click time; the needle-tip assertions from the
    direction fix (`needleTip()` helper) still verify upward motion.
  - Boundary: at 800ms the needle is at 12 (up-right, `y < 70`), and after
    +80ms it is descending at 11 — no overshoot, `onRoll` never receives
    outside 2–12.
  - Keyboard: Enter/Space on the button stops and rolls.
  - Reduced-motion: stepped sweep; clicking stops at the current integer
    (40ms → 2, +80ms → 3), needle tip up.
- `src/components/__tests__/Speedometer.test.tsx`: unchanged (geometry already
  covered).
- Remove the hold-related tests; verify `dice.holdHint` has no lingering
  references and `dice.stopHint` exists in both locales.
- `npm run typecheck`, `npm run lint`, `npm run test:unit` green.

## Files

- Modify: `src/components/DiceRoller.tsx`
- Modify: `src/components/__tests__/DiceRoller.test.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `id/translation.json`
  (rename `dice.holdHint` → `dice.stopHint` with new values)
