# Design: Bankruptcy Hold-to-Confirm (5-second)

> Date: 2026-08-19
> Branch: `feature/bankruptcy-hold-confirm`

## Problem

Declaring bankruptcy ends a player's game irreversibly. Today both the
"Declare Bankruptcy" buttons (in the bankruptcy modal and in the sidebar's
action section) fire on a single click. One accidental tap eliminates a
player from the match. The requirement: the player must **press and hold the
button for 5 full seconds** before the bankruptcy action runs. If the player
releases earlier, nothing happens.

## Assumptions

The following were decided without user input (user unavailable); each is
reported back for review:

1. **Scope — both bankruptcy buttons.** "Button bankrupt" is read as *the
   declare-bankruptcy action*, which is reachable from two places that both
   fire the same irreversible reducer action:
   - `BankruptcyModal` → `bankruptcy.declare` (danger button)
   - `ActionSection` → `action.declareBankruptcy` (danger button)
   Both get the hold requirement so the guard is consistent. The modal's
   Close button and every other button are untouched.
2. **Client-side only.** The hold is a UX guard against accidental taps. The
   reducer/server/wire protocol are unchanged; the server remains
   authoritative over rules (a client could in principle still send the
   message directly — the same trust model as the rest of this game). No
   state, type, or `net.ts` changes.
3. **Exactly 5 seconds, continuous.** Measured from pointer-down (or
   key-down). Releasing (or cancelling) before 5s resets progress and fires
   nothing. At ≥5s the action fires once.
4. **Animation.** A progress fill sweeps across the button over the 5 seconds
   and the button label shows a live "Hold {n}s" countdown, so the hold
   requirement is visible before and during the gesture. The numeric
   countdown is the primary communicator and works under
   `prefers-reduced-motion` (no extra motion added).
5. **Keyboard accessible.** Holding Space/Enter for 5 seconds also triggers
   it (keydown starts, keyup cancels). A quick keyboard activation does
   nothing, matching the pointer behavior.
6. **Reusable component.** A `HoldToConfirmButton` component is created so
   the pattern can be reused later (reset-game, leave-room, etc.). It
   composes the existing `Button` so styling stays consistent.
7. **No new sound.** The bankruptcy sound already plays from `GameSounds` on
   the bankruptcy event. The hold button is silent (`sound={null}`) so a
   cancelled hold does not emit a click sound.
8. **i18n.** New UI strings go into both `en/translation.json` and
   `id/translation.json` (flat keys, `keySeparator: false`).
9. **Tests.** New unit tests for `HoldToConfirmButton`; existing
   `BankruptcyModal` / `ActionSection` tests keep passing (the button's
   accessible name stays the label text while idle). No e2e changes — there
   is no existing bankruptcy e2e spec.

## Design

### New component: `src/components/HoldToConfirmButton.tsx`

Composes the existing `Button` (variants, sizes, styling stay identical).

Props (extends `Button`'s props where sensible):

```ts
interface HoldToConfirmButtonProps {
  onConfirm: () => void
  holdMs?: number            // default 5000
  hint?: string              // aria-describedby text, rendered under the button
  children: ReactNode        // idle label
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'start'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
}
```

Behavior:

- **Idle:** renders a normal danger/success/… `Button` with `children` as the
  label and a small helper line below (`hint`) when provided. The helper text
  tells the player to press and hold.
- **Holding:** on `pointerdown` (primary button only, `e.button === 0`) starts
  a countdown. The button gets `touch-action: none`, `relative overflow-hidden`
  and an absolutely-positioned fill overlay (`data-testid="hold-fill"`) whose
  width goes 0→100% over `holdMs`. The label swaps to `Hold {n}s`
  (`ceil(remaining/1000)`). Uses pointer capture so drifting off the button
  does not cancel.
- **Complete:** when the fill reaches 100%, `onConfirm()` fires exactly once
  and the state resets.
- **Cancel:** `pointerup`/`pointercancel` before 100% cancels and resets to
  0. `blur` also cancels (keyboard focus loss).
- **Keyboard:** `keydown` on Space/Enter (not repeat) starts the hold;
  `keyup`/`blur` cancels unless complete. `aria-disabled` never set — the
  button remains operable; the hold is the guard.
- **Cleanup:** all timers/RAF cleaned up on unmount.
- **Reduced motion:** no motion beyond the fill width change; the numeric
  countdown already carries the information. No special branch needed, but the
  implementation must not add transition animations that fight the countdown.

Implementation notes:

- Time is measured via `Date.now()` against a start ref, ticked by a
  `setInterval` (~50ms) — testable with `vi.useFakeTimers()` (vitest's fake
  timers mock `Date` too). `Math.min(1, elapsed/holdMs)` drives both the fill
  width and the remaining-seconds label.
- Reuses `Button` from `src/components/Button.tsx`, which forwards
  `onPointerDown`/`onPointerUp`/`onPointerCancel`/`onKeyDown`/`onKeyUp` via
  its `...props` spread, and accepts `sound={null}` to silence the default
  click sound.
- Semicolon style: components omit semicolons — match the file being edited.

### Integration

**`src/components/Modals/BankruptcyModal.tsx`** — replace the
`bankruptcy.declare` `Button` with `HoldToConfirmButton`:

- `onConfirm={onBankruptcy}`
- `hint={t('bankruptcy.holdHint')}`
- `variant="danger"` (unchanged)
- label `t('bankruptcy.declare')` (unchanged)
- Only rendered when `!canPayAfterLiquidation && isMyTurn` (unchanged logic).

**`src/components/ActionSection.tsx`** — replace the
`action.declareBankruptcy` `Button` in the PayRent/Bankruptcy branch with
`HoldToConfirmButton`:

- `onConfirm={onDeclareBankruptcy}`
- `hint={t('action.holdHint')}`
- `variant="danger"` (unchanged)
- label `t('action.declareBankruptcy')` (unchanged)
- Rendered whenever the branch is active (it is inside
  `pending PayRent | Bankruptcy`), matching today's always-on button.

### i18n

New flat keys in **both** locales:

| key | en | id |
|-----|----|----|
| `bankruptcy.holdHint` | "Press and hold for 5 seconds to declare bankruptcy." | "Tahan tombol selama 5 detik untuk menyatakan bangkrut." |
| `action.holdHint` | "Press and hold for 5 seconds to declare bankruptcy." | "Tahan tombol selama 5 detik untuk menyatakan bangkrut." |
| `hold.countdown` | "Hold {n}s" | "Tahan {n}d" |

The countdown key is shared because the pattern is generic; the two hints are
namespaced by where they render.

### Testing

**`src/components/__tests__/HoldToConfirmButton.test.tsx`** (new):
- `vi.useFakeTimers()` + `renderWithProviders`.
- Fires `onConfirm` exactly once when held ≥5s (pointerdown → advance 5000 →
  pointerup).
- Does **not** fire on a quick tap (pointerdown → pointerup immediately).
- Does **not** fire on cancel (pointerdown → advance 2500 → pointerup) and
  progress resets (a second full hold still fires).
- Keyboard: `keydown` Space, advance 5000, `keyup` → fires; quick keypress →
  not fired.
- Shows the helper hint and the countdown label while holding.
- `onConfirm` not called when `disabled`.
- Render `hint` text when provided.

**`BankruptcyModal.test.tsx`**: existing assertions remain valid (button name
still matches `/Declare Bankruptcy/` while idle). No changes required — verify
the suite stays green.

**`ActionSection.test.tsx`**: no bankruptcy-button tests exist; unchanged.

### Out of scope

- Server-side enforcement / wire changes.
- Any other hold-to-confirm consumers.
- e2e specs (none cover bankruptcy today).
- New sounds / animation framework.

## Success criteria

1. Holding either "Declare Bankruptcy" button for 5s fires bankruptcy.
2. Releasing before 5s does nothing, and progress visibly resets.
3. Both en and id locales show the hint + countdown.
4. `npm run typecheck`, `npm run lint`, `npm run test:unit` all pass.
5. No changes to `src/types/*`, `src/logic/*`, `server/*`, or `net.ts`.
