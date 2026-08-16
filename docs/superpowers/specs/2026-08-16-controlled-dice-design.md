# Controlled Dice Design

Date: 2026-08-16

## Problem

The roll button throws fully random dice every turn. The desired interaction: a
player presses-and-holds the roll button, a number ticks back and forth
(2 → 12 → 2 → 12…), and releasing locks in a target total. The actual dice are
then influenced by a random per-roll "luck" value: high luck concentrates the
result near the target (often exactly on it); low luck is basically a normal
random roll. No persistent luck stat — luck is re-rolled every turn.

## Goals

- Replace the plain roll button with a hold-and-release target selector for
  human players, in both local and multiplayer modes.
- Each roll draws a luck value 0–100; the higher it is, the more the result
  clusters around the player's chosen total (see Algorithm below).
- Low luck never *penalizes* the player — it just means a standard random 2d6.
- Works with the existing two-dice model: the target is a total, and the actual
  pair is sampled randomly among pairs summing to that total. Doubles happen
  only when the sampled pair is naturally doubles (aiming even does not
  guarantee doubles).
- Bots keep rolling plain random 2d6 (no target, no luck).
- Server-authoritative in multiplayer: the client sends only its intended
  total; the server rolls luck + dice.

## Non-Goals

- No new persistent player stat (no luck on `Player`).
- No change to `GameState` shape → no `STATE_VERSION` bump.
- No change to game rules (doubles/jail/buy flows all stay as-is in the
  reducer; only how `dice` values get produced changes).
- No change to bot behavior.

## Design

### 1. Core algorithm — `src/logic/controlledDice.ts` (NEW)

Pure, shared module used by both local client and server.

```ts
rollControlledDice(target: number, rng: () => number): { dice: [number, number]; luck: number }
```

1. `luck = Math.floor(rng() * 101)` → 0–100.
2. Build a **target-neighborhood weight table** over totals 2–12 peaking at
   `target`: weight 10 at `target`, 4 at `target ± 1`, 2 at `target ± 2`,
   1 at `target ± 3`; entries outside 2–12 are dropped; normalized to a
   probability distribution.
3. **Blend** the peak with the standard 2d6 distribution:
   `P = (luck / 100) · peak + (1 − luck / 100) · standard2d6`, where
   `standard2d6` uses counts `{2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:5, 9:4, 10:3,
   11:2, 12:1} / 36`.
4. Sample a total `t` from `P`.
5. Sample an ordered pair `(d1, d2)` uniformly among all pairs with
   `d1 + d2 = t`.

At luck 0 this is exactly standard 2d6 (each of the 36 ordered pairs equally
likely); at luck 100 the result is maximally concentrated at the target —
mostly the target, occasionally adjacent totals.

### 2. Hold-and-release UI — `src/components/DiceRoller.tsx`

- `onRoll` prop changes from `() => void` to `(target: number) => void`.
- The roll button becomes a hold control:
  - Pointer down starts a ticker cycling `2 → 12 → 2 → 12…` (~80 ms/step),
    showing the live value (e.g. "Aiming: 8").
  - Pointer up locks the current value as the target and calls
    `onRoll(target)`.
  - `setPointerCapture` on the button so releasing outside still resolves.
  - Keyboard: holding Space/Enter starts the ticker; releasing locks the
    target.
- The two `Dice` pips still show the final result with the existing roll
  animation. Existing `rolling` state guards against double interaction.
- Jail rolls use the same control (aim for an even total, hope the sampled pair
  is doubles).

### 3. Actions and wiring

- `GameAction.RollDice` gains optional `target?: number`; `GameAction.DiceAnimated`
  gains optional `target?: number; luck?: number`. Additive, wire-compatible.
- Reducer: `RollDice` handler unchanged (still flips to `Rolling`); `DiceAnimated`
  includes `target`/`luck` in the `event.rolled` log params when present.
- `src/hooks/useGame.ts`: `roll(target?)` — with `target`, computes dice via
  `rollControlledDice(target, Math.random)`; without (bots), keeps the current
  random 2d6 generation. Same animation timers.
- `server/gameServer.ts`: `roll(clientId, target?)` and `startRoll(target?)` —
  with `target` (from a human slot), use `rollControlledDice(target, this.rng)`;
  bots call `startRoll()` with no target → random.
- Wire (`src/types/net.ts`, `src/net/client.ts`): `ROLL_DICE` message gains
  optional `target`.

### 4. i18n

New keys in both `src/i18n/locales/en/translation.json` and `id/translation.json`:
- hold-to-roll button label (e.g. "Hold to roll" / "Tahan untuk melempar")
- live readout "Aiming: {{n}}"
- release hint (e.g. "Release to lock your target")
- aimed log template for `event.rolled` when target/luck present (see
  `src/i18n/log.ts`).

### 5. Logging

`event.rolled` params gain `target` and `luck` when the roll was aimed, so the
log reads e.g. "Alice rolled 8 (aimed for 8, luck 80)". The plain roll log is
unchanged.

## Testing

- `src/logic/__tests__/controlledDice.test.ts` (NEW) — deterministic rng:
  - luck 0 ≈ standard 2d6 distribution;
  - luck 100 concentrates results at the target (mostly the target, occasionally adjacent totals);
  - mid-luck frequencies cluster near target;
  - sampled pair always sums to the sampled total, values within 1–6.
- `src/components/__tests__/DiceRoller.test.tsx` — hold runs the ticker,
  release calls `onRoll(target)` with the locked value.
- `server/__tests__/gameServer.test.ts` — target-based roll produces dice
  summing to an aimed-at total; bot rolls stay random.
- `src/hooks/__tests__/useGame.test.ts` — update for `roll(target?)` signature.

## Files

- NEW: `src/logic/controlledDice.ts`
- Modify: `src/components/DiceRoller.tsx`
- Modify: `src/hooks/useGame.ts`
- Modify: `server/gameServer.ts`
- Modify: `src/types/game.ts`
- Modify: `src/types/net.ts`
- Modify: `src/net/client.ts`
- Modify: `src/logic/gameReducer.ts` (log params only)
- Modify: `src/i18n/locales/en/translation.json`, `id/translation.json`
- Modify: `src/i18n/log.ts`
- Tests: new `controlledDice.test.ts`; updated `DiceRoller.test.tsx`,
  `gameServer.test.ts`, `useGame.test.ts`
