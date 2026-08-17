# Token-Step Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a short synthesized "wooden tap" tick on every hop of every player's token during the movement animation.

**Architecture:** Add a new `SoundId.TokenStep` generator to the existing WebAudio sound engine, then call `useSound()` from the animation component (`PlayerTokens`) inside its existing per-hop `step()` timer so sound stays perfectly in sync with the visual hops.

**Tech Stack:** React 19, TypeScript (project references), Vitest, WebAudio (synthesized tones, no audio assets).

## Global Constraints

- `erasableSyntaxOnly` is on — no TS `enum`; add `TokenStep: 'tokenStep'` to the `SoundId` const object with the derived union type (pattern already in `src/audio/soundEngine.ts`).
- Wire values are contract — the `'tokenStep'` string must never change once shipped.
- The `SoundId` string is not user-facing — no i18n keys needed.
- `src/audio/soundEngine.ts` uses semicolons; `src/components/PlayerTokens.tsx` does not — match each file's existing style.
- `noUnusedLocals`/`noUnusedParameters` are on — no unused imports.
- No changes to the game reducer, rules, event log, `soundMap`, client/server contract, animation timing, or existing sounds/volumes.
- A sound failure must never throw or break gameplay (`playSound` already guards context availability).

---

### Task 1: Add `SoundId.TokenStep` to the sound engine

**Files:**
- Modify: `src/audio/soundEngine.ts:1-18` (add `TokenStep` to `SoundId`)
- Modify: `src/audio/soundEngine.ts:63-125` (add generator to `SOUND_GENERATORS`)
- Test: `src/audio/__tests__/soundEngine.test.ts`

**Interfaces:**
- Consumes: existing `tone(ctx, dest, opts)` helper (already in `soundEngine.ts`).
- Produces: `SoundId.TokenStep` (string `'tokenStep'`) usable by Task 2 via `play(SoundId.TokenStep)`.

- [ ] **Step 1: Write the failing test**

Append to `src/audio/__tests__/soundEngine.test.ts` after the existing `your-turn chime` test (line 73):

```ts
  it('creates oscillators for the token-step tick', async () => {
    const FakeAC = vi.fn(function () { return new FakeAudioContext() })
    vi.stubGlobal('AudioContext', FakeAC)
    const { playSound, SoundId } = await loadEngine()
    playSound(SoundId.TokenStep)
    const ctx = FakeAC.mock.results[0].value as FakeAudioContext
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1)
    expect(ctx.createGain).toHaveBeenCalledTimes(2)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- soundEngine`
Expected: FAIL — `SoundId.TokenStep` is `undefined`, so `playSound` throws `TypeError: SOUND_GENERATORS[id] is not a function`.

- [ ] **Step 3: Add the sound id**

In `src/audio/soundEngine.ts`, add to the `SoundId` const object (after `DiceLand` on line 4, keeping the `as const` / derived union intact):

```ts
  TokenStep: 'tokenStep',
```

- [ ] **Step 4: Add the generator**

In `src/audio/soundEngine.ts`, add to `SOUND_GENERATORS` (after the `DiceLand` entry on line 71, same style):

```ts
  [SoundId.TokenStep]: (ctx, dest) =>
    tone(ctx, dest, { freq: 280, endFreq: 150, duration: 0.05, type: 'triangle', gain: 0.3 }),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- soundEngine`
Expected: PASS (all soundEngine tests, including the new one).

- [ ] **Step 6: Commit**

```bash
git add src/audio/soundEngine.ts src/audio/__tests__/soundEngine.test.ts
git commit -m "feat: add token-step tap sound to the sound engine"
```

---

### Task 2: Play the tick on each hop in PlayerTokens

**Files:**
- Modify: `src/components/PlayerTokens.tsx:1-3` (imports)
- Modify: `src/components/PlayerTokens.tsx:45-50` (add `useSound` hook)
- Modify: `src/components/PlayerTokens.tsx:65-71` (play in `step`)

**Interfaces:**
- Consumes: `SoundId.TokenStep` from Task 1; `useSound()` from `src/audio/SoundContext` (returns `(id: SoundId) => void`).
- Produces: audibly ticked movement animation; no new exported symbols.

- [ ] **Step 1: Add imports**

In `src/components/PlayerTokens.tsx`, add after the existing imports (line 3, matching the file's no-semicolon style):

```tsx
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'
```

- [ ] **Step 2: Get the play function**

In `PlayerTokens`, add at the top of the component body (line 46, before `const { players } = state`):

```tsx
  const play = useSound()
```

- [ ] **Step 3: Play the tick on every hop**

In the `step` function (currently lines 65-69), play the tick as the first action of each hop:

```tsx
      function step(index: number) {
        if (index >= path.length) { animating.current[player.id] = false; return }
        play(SoundId.TokenStep)
        setDisplayPositions((prev) => ({ ...prev, [player.id]: path[index] }))
        setTimeout(() => step(index + 1), 150)
      }
```

The jail teleport branch (line 57-61) is untouched — it sets the position directly and never calls `step`, so it stays silent.

- [ ] **Step 4: Verify no regressions**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green. `useSound` is a no-op without a `SoundProvider`, so the existing render paths (no PlayerTokens tests exist) are unaffected.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open the board, and roll dice:
- A soft low tap plays for every hop of every moving token (bots included), in sync with the 150ms hops.
- A single-square move plays exactly one tap.
- Landing in jail (teleport to `10`) is silent.
- The `diceRoll` noise and other sounds are unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayerTokens.tsx
git commit -m "feat: play a tap sound on each token hop"
```
