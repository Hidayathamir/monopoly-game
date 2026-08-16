# Controlled Dice Speedometer Gauge Design

Date: 2026-08-16

## Problem

The hold-to-roll control (added in `2026-08-16-controlled-dice-design.md`) currently
aims with a plain number that ticks 2 → 12 → 2 → 12… and a small "Aiming: N"
text readout. The player wants the aiming interaction presented as a
**speedometer-style gauge** instead: while holding the roll button, a needle
sweeps smoothly across a dial and the release locks the value under it.

## Goals

- While holding the roll button, replace the two dice faces with a
  speedometer gauge: a black panel, a white arc sweeping bottom-left →
  top → bottom-right, tick marks for every value 2–12, labels **2** (left),
  **7** (top), **12** (right), and a **gold needle** that sweeps back and
  forth continuously (smooth, pendulum-style) while held.
- No numeric readout anywhere on the gauge — the player aims by the needle
  and tick marks alone.
- Release locks the integer value nearest the needle (2–12) and rolls exactly
  as today (`onRoll(target)`), server-authoritative logic unchanged.
- Keyboard hold (Space/Enter) shows the same gauge.
- Respect `prefers-reduced-motion`: fall back to the current stepped 80ms
  ticker instead of the continuous sweep.

## Non-Goals

- No change to game rules, actions, wire contract, or `controlledDice.ts`
  algorithm — this is presentation-only, inside `DiceRoller`.
- No change to the roll button, the hold/release gesture, or the
  `dice.holdHint` hint line.
- No change to the two `Dice` faces when not holding (dice still shown idle
  and while rolling).

## Design

### 1. New component — `src/components/Speedometer.tsx`

A pure, presentational SVG component:

- Props: `value: number` (the current aim value 2–12). It renders the needle
  pointing at that value and is fully deterministic — the same `value` always
  draws the same gauge. Animation timing lives in the parent.
- Geometry (screen coordinates, `viewBox="0 0 120 70"`):
  - Pivot at bottom-center `(60, 62)`.
  - Arc radius `52`, arc from screen angle `165°` (left end, value 2) to
    `15°` (right end, value 12) — a **150°** span (between 90° and 180° as
    specified), with the apex at `90°` = straight up = **value 7**.
  - White arc stroke (~2.5px), rounded linecap, faint opacity on the rest of
    the dial.
  - 11 white tick marks (one per integer 2–12) at the same screen angles as
    the needle would point for that value; the three labeled values get
    longer/thicker ticks.
  - Labels **2**, **7**, **12** as small white text just outside the ticks at
    the three landmarks.
  - Gold needle: a line from the pivot to radius `44`, plus a small gold hub
    circle at the pivot (`text-gold`/`bg-gold`, the game's accent — the single
    colored element on the black + white gauge).
  - Black panel behind it (`bg-bg-card`, `rounded-xl` to match the dice).
- Mapping helper exported for reuse/tests:
  `valueToAngle(value) = 165 − 150 × (value − 2) / 10` (degrees, screen).

### 2. Sweep loop in `DiceRoller.tsx`

Replace the stepped `setInterval` ticker with a continuous sweep while
holding:

- One-way period `SWEEP_MS = 800`; the aim value follows a **linear triangle
  wave**: `fraction = triangle((now − start) / SWEEP_MS)` going 0 → 1 → 0,
  and `aimValue = 2 + 10 × fraction`.
  - At 0ms → 2, 400ms → 7 (top), 800ms → 12 (right), 1600ms → 2 (left), etc.
  - Linear (not eased) keeps the value a simple invertible function of time,
    so tests can assert exact values at exact times; the needle reads smooth
    at 60fps because its angle updates every frame.
- Drive with `requestAnimationFrame` while `holding`; each frame compute
  `aimValue` and store it in state to re-render the `Speedometer`. The
  re-render cost is a tiny focused tree (a few SVG nodes), acceptable.
- Start each hold at `aimValue = 2` (needle at the left end), matching the
  current ticker's reset behavior.
- `lockTarget()`: `onRoll(Math.round(aimValue))`, clamped to 2–12 by the
  triangle wave (never exceeds the range — no off-by-one, the old boundary
  clamp becomes unnecessary). Keep the existing `rolling` guard and the
  500ms `setRolling(false)` timeout.
- Reduced motion: read `window.matchMedia('(prefers-reduced-motion: reduce)')`
  once; when it matches, run the existing 80ms stepped ticker instead of the
  rAF sweep (aiming stays fully functional).

### 3. Replace the readout + hide dice while holding

- Remove the `dice-aim` `<p>` and the `dice.aiming` i18n key from both
  locales (no numeric readout).
- While `holding`, render `<Speedometer value={aimValue} />` in place of the
  two `<Dice>` faces; render the dice again otherwise (idle and rolling).
- Keep `dice.holdHint` and the roll button exactly as-is.

## Testing

- `src/components/__tests__/Speedometer.test.tsx` (NEW): renders the gauge;
  the needle position (`data-testid="speedometer-needle"`) has
  `transform: rotate(...)` matching `valueToAngle(value)` for a few values
  (2 → 165°, 7 → 90°, 12 → 15°); labels 2/7/12 present; tick marks count is
  11.
- `src/components/__tests__/DiceRoller.test.tsx` (update):
  - Holding shows the `speedometer` testid and hides the dice; releasing
    calls `onRoll` with the value at the release time. With `SWEEP_MS = 800`
    and fake timers: at 240ms → 5, at 160ms → 4 (values carry over from the
    current tests because `2 + 10×(t/800)` reproduces the old stepped
    positions at those timestamps).
  - At 800ms → 12, and further frames never exceed 12 or drop below 2
    (triangle-wave bounds — replaces the old boundary-clamp test).
  - Keyboard hold still works.
  - Reduced-motion path: stub `matchMedia('(prefers-reduced-motion: reduce)')`
    to match and assert the stepped behavior returns (240ms → 5, per the
    old ticker math).
- `npm run typecheck`, `npm run lint`, `npm run test:unit` green.

## Files

- NEW: `src/components/Speedometer.tsx`
- NEW: `src/components/__tests__/Speedometer.test.tsx`
- Modify: `src/components/DiceRoller.tsx` (sweep loop, hide dice, show gauge)
- Modify: `src/components/__tests__/DiceRoller.test.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `id/translation.json`
  (remove `dice.aiming`; keep `dice.holdHint`)
