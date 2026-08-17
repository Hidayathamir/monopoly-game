# Token-Step Sound Design

Date: 2026-08-17

## Problem

Tokens already animate by hopping from square to square (one hop every 150ms,
in `src/components/PlayerTokens.tsx`), and dice rolls play a `diceRoll` noise —
but the token movement itself is silent. Adding a short "step" sound per hop
makes the movement feel tactile and matches the hopping animation rhythm.

## Goals

- Play a short, synthesized "wooden tap/knock" tick on every hop of every
  player's token during the movement animation.
- The tick plays in sync with the visual hops (same timer that moves the
  token), for all players' tokens, in both local (vs bots) and multiplayer.
- The jail "teleport" case (no hopping) stays silent.
- Zero changes to the game rules, the reducer, the client/server contract, the
  event log, `soundMap`, or i18n.
- A sound failure must never throw or break gameplay.

## Non-Goals

- No single "move whoosh" or rising plink — per-step tick only.
- No per-player sound settings.
- No changes to existing sounds, their volumes, or the animation timing.

## Design

### 1. New sound — `SoundId.TokenStep`

In `src/audio/soundEngine.ts`, add `TokenStep: 'tokenStep'` to the `SoundId`
const object (derived union type follows, per repo `erasableSyntaxOnly`
convention) with a short low wooden knock generator:

- A single short triangle tone dropping in pitch, e.g. `~280 Hz → ~150 Hz`
  over `~0.05s`, gain `~0.3` (kept quiet since it repeats several times per
  move).
- Distinct from `diceRoll`/`diceLand` so it reads as the token walking, not
  rolling.
- The `SoundId` string value (`'tokenStep'`) is effectively part of the sound
  engine's contract and must never change once shipped.

The `soundEngine.test.ts` pattern (fake AudioContext/oscillators) covers the
new generator the same way the existing sounds are covered.

### 2. Wiring — `src/components/PlayerTokens.tsx`

- `const play = useSound()` from `../audio/SoundContext`.
- In `step()`, call `play(SoundId.TokenStep)` on every hop, before scheduling
  the next hop.
- No changes to the path logic, timing (150ms), or the jail teleport branch
  (which sets the position directly and stays silent).
- `useSound` returns a no-op when no `SoundProvider` is present, so existing
  tests that render `PlayerTokens` without a provider keep working.

## Testing

- `soundEngine.test.ts`: `SoundId.TokenStep` produces audio (oscillator count /
  envelope) like the other sounds — one oscillator, two gain nodes (per-sound +
  master).
- `PlayerTokens` has no existing test coverage; none is added (sound only
  affects audio, which requires no DOM assertion).

## Verification

- `npm run typecheck`, `npm run test:unit`, `npm run lint` all green.
- Manual: roll dice locally and in a multiplayer room; confirm a soft tick per
  hop for every moving token, silence on jail teleport, and no change to dice
  roll sounds.
