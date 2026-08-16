# Accurate Press-to-Lock Dice Aim Design

Date: 2026-08-16

## Problem

In the click-to-stop speedometer roll (`2026-08-16-speedometer-click-stop-design.md`),
the recorded aim target can differ from what the player actually saw. The player
presses "Roll Dice" when the needle appears to be at 7, but the event log records
`aimed for 9` (or nearby). Two independent causes:

1. **Software desync:** the sweep writes `aimValueRef` on a raw
   `setInterval(16ms)` timer, while the visible needle is driven by the
   `aimValue` state, which only updates when React actually paints a frame.
   Whenever a frame is dropped or a render stalls, the ref runs **ahead** of the
   painted needle (during the upward sweep), so the click reads a later value
   than the one displayed. At 800ms per 10 units, ~160ms of visual lag = 2
   units — exactly the reported "aim 7, recorded 9".
2. **Release travel:** capture currently happens on `onClick` (mouse-up), so the
   value read includes press + hold + release time (~100–200ms of extra needle
   travel after the player's decision to stop).

The network and server are **not** involved: the target is read client-side at
the click instant and sent as a plain number in the WebSocket message.

## Goals

- The recorded aim target always equals the needle position the player **saw**
  at the moment they pressed the button.
- Capture on **press** (pointer down), so there is no press + hold + release
  travel after the decision to stop.
- Keep the timing-skill mechanic, the sweep speed (800ms), and the existing
  luck-based dice precision unchanged.
- Freeze the needle at the locked value when pressed, so the chosen target stays
  visible while the server processes the roll.
- Keyboard (Enter/Space) still rolls; a single press cannot roll twice.

## Non-Goals

- No change to the sweep speed (80ms per integer) or the skill difficulty.
- No change to `Speedometer.tsx`, `Button.tsx`, `controlledDice.ts`, the reducer,
  the wire contract (`src/types/net.ts`), or the luck algorithm.
- No change to button labels or i18n strings.
- No server-side changes.

## Design

All changes live in `src/components/DiceRoller.tsx` and its test.

### 1. Recorded value = painted value

Stop writing the ref from the sweep. The sweep only calls `setAimValue`; a
`useEffect` mirrors the last committed `aimValue` into `aimValueRef`:

```tsx
const [aimValue, setAimValue] = useState(MIN_TOTAL)
useEffect(() => {
  aimValueRef.current = aimValue
}, [aimValue])
```

`stopAndRoll` still reads `Math.round(aimValueRef.current)`, but the ref can now
never run ahead of what was displayed — if React didn't paint a frame, the ref
keeps the previously painted value, which is exactly what the player was looking
at. This is the core fix for the desync.

### 2. Sweep driver: requestAnimationFrame + freeze on press

Replace the `setInterval(FRAME_MS)` sweep with `requestAnimationFrame`, so the
needle advances only on real paint frames. The effect deps become
`[canAim, rolling, reducedMotion]`; when `rolling` turns true the effect returns
early, canceling the loop and freezing the needle at the locked value.

The seed stays `start = Date.now() - msForValue(aimValueRef.current)` (now the
last painted value) so the sweep resumes seamlessly when re-entered.

The `prefers-reduced-motion` path keeps the stepped 80ms ticker, but it no
longer writes the ref (the mirror effect handles that) and is gated on
`!rolling` too. Its `setAimValue` updater still mutates `directionRef` to
reverse direction at the boundaries, as today.

### 3. Capture on press

```tsx
const rollingRef = useRef(false)
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

function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
  if (e.button !== 0) return // primary button only
  stopAndRoll()
}

function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
  if (e.detail !== 0) return // pointer presses already handled by pointerdown
  stopAndRoll() // keyboard Enter/Space fire click with detail === 0
}
```

- `onPointerDown` (primary button) locks the aim and rolls immediately on press.
- `onClick` is kept **only** for keyboard activation: real pointer clicks carry
  `detail >= 1` and are ignored (already handled); Enter/Space and assistive-tech
  activation fire `detail === 0`.
- `rollingRef` is a synchronous guard, so a press followed by its compatibility
  click (or a press held past the 500ms reset) cannot roll twice.
- `Button` spreads extra props onto `<button>`, so `onPointerDown`/`onClick`
  pass through unchanged.

## Testing

`src/components/__tests__/DiceRoller.test.tsx`:

- Existing click-to-stop tests keep passing: `fireEvent.click(button)` produces
  `detail === 0` (keyboard path), and sweep values are time-based, so the
  rAF-driven sweep yields identical numbers under fake timers
  (`vi.advanceTimersByTime(240)` → 5, `400` → 7, `640` → 10, `880` → 11, etc.).
- New regression tests:
  - pointerdown (button 0) after advancing → `onRoll` called once with the
    painted value.
  - non-primary pointerdown (`button: 2`) → no roll.
  - mouse-style click (`fireEvent.click(button, { detail: 1 })`) → no roll.
  - pointerdown then click → `onRoll` still called exactly once.
- `npm run typecheck`, `npm run lint`, `npm run test:unit` green.

## Files

- Modify: `src/components/DiceRoller.tsx`
- Modify: `src/components/__tests__/DiceRoller.test.tsx`
