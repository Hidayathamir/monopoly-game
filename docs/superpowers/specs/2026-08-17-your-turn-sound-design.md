# Your-Turn Sound Design

Date: 2026-08-17

## Problem

With sound effects shipped, dice rolls and all event-driven actions are
audible — but there is no cue when the turn passes to the local player. In a
multiplayer game (or a local game against bots), a player can be waiting and
not notice that it is now their turn to act. The `Turn` event-log entry is
deliberately silent (too noisy for every player's turn), so no signal exists.

## Goals

- Play a distinct, synthesized "your turn" chime the moment it becomes the
  local player's turn to act, in both local (vs bots) and multiplayer games.
- The sound fires once per turn start — never on mount, never repeatedly while
  the turn is still the player's.
- The first turn of a game does not double-chime: the game-start jingle already
  announces the opening turn.
- Rejoin-safe: rejoining a mid-game room must not replay the chime.
- Zero changes to the game rules, the client/server contract, the reducer, the
  event log, `soundMap`, or i18n.
- A sound failure must never throw or break gameplay.

## Non-Goals

- No sound for other players' turns (their actions are already audible via
  event-log sounds).
- No per-player sound settings.
- No changes to existing sounds or their volume.

## Design

### 1. New sound — `SoundId.YourTurn`

In `src/audio/soundEngine.ts`, add `YourTurn: 'yourTurn'` to the `SoundId`
const object (derived union type follows, per repo `erasableSyntaxOnly`
convention) with a new two-note ascending chime generator:

- Two short sine blips, ascending (e.g. C5 ~523 Hz then G5 ~784 Hz), each with
  a quick attack/decay envelope, totaling roughly 0.3s.
- A modest gain so it is clearly audible over gameplay but not jarring (per-sound
  gain pattern already used by the engine).
- Distinct from `diceRoll`, `diceLand`, `roomJoin`, and `gameStart` so it reads
  as a turn notification.

The `soundEngine.test.ts` pattern (fake AudioContext/oscillators) covers the new
generator the same way the existing sounds are covered.

### 2. New hook — `src/audio/useMyTurnSound.ts`

`useMyTurnSound(isMyTurn: boolean): void`

- Uses `useSound()` (the imperative API from `SoundContext`) and a ref baseline.
- On mount, records the current `isMyTurn` value as the baseline and does **not**
  play.
- On every subsequent render, plays `SoundId.YourTurn` **only** on the
  `false → true` transition of `isMyTurn`; then updates the baseline.
- Because the baseline is per-mount, a rejoin (which remounts `GameView`) never
  replays the chime.

Follows the ref-baseline pattern already used for `roomJoin`/`gameStart` in
`src/components/MultiplayerGame.tsx`.

### 3. Wiring — `src/components/GameView.tsx`

`GameView` already computes `isMyTurn` (with the local-game fallback for
`myPlayerId === null`, i.e. turns vs bots):

```ts
const isMyTurn = game.myPlayerId === null
  ? !state.players[state.currentPlayer]?.isBot
  : game.myPlayerId === state.currentPlayer
```

Call `useMyTurnSound(isMyTurn)` once, alongside the existing `GameSounds`
mount. No other UI changes.

## Testing

- `useMyTurnSound.test.ts`: mount with `isMyTurn === false` → no play;
  `false → true` → plays `SoundId.YourTurn` once; stays `true` → no re-fire;
  `true → false → true` → plays again; mount with `isMyTurn === true` → no play
  (baseline).
- `soundEngine.test.ts`: `SoundId.YourTurn` produces audio (oscillator count /
  envelope) like the other sounds.

## Verification

- `npm run typecheck`, `npm run test:unit`, `npm run lint` all green.
