# Your-Turn Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a distinct synthesized chime the moment the local player's turn starts, in both local (vs bots) and multiplayer games.

**Architecture:** Add a new `SoundId.YourTurn` generator to the existing sound engine, then a small `useMyTurnSound(isMyTurn)` hook that fires it on the `false → true` transition of `isMyTurn` using a ref baseline (same pattern as `roomJoin`/`gameStart` in `MultiplayerGame.tsx`). `GameView.tsx` already computes `isMyTurn` — one hook call wires it in. No reducer, wire, eventLog, `soundMap`, or i18n changes.

**Tech Stack:** TypeScript, React 19, Vitest + React Testing Library (`renderHook`).

## Global Constraints

- No TS `enum` — `SoundId` stays a `const` object + derived union (`erasableSyntaxOnly: true`).
- `verbatimModuleSyntax: true` → type-only imports must use `import type`.
- `noUnusedLocals`/`noUnusedParameters` are on.
- Semicolons: `src/audio/soundEngine.ts` and `src/audio/__tests__/soundEngine.test.ts` use semicolons (match existing file). `src/audio/useMyTurnSound.ts`, `src/audio/__tests__/useMyTurnSound.test.tsx`, and `src/components/GameView.tsx` omit them (match existing files).
- A sound failure must never throw or break gameplay.
- `npm run lint` must pass with no NEW warnings (only the 2 pre-existing `PlayerTokens.tsx` warnings may remain).
- No changes to the reducer, `src/types/net.ts`, the server, `src/audio/soundMap.ts`, `src/audio/useGameSounds.ts`, `src/audio/SoundContext.tsx`, or i18n files.
- The chime must be distinct from `roomJoin` (C5→G5 sine) and `moneyGain` (523→659→784 triangle).

---

### Task 1: Your-turn chime in the sound engine

**Files:**
- Modify: `src/audio/soundEngine.ts` — add `YourTurn` to the `SoundId` const and a generator to `SOUND_GENERATORS`
- Test: `src/audio/__tests__/soundEngine.test.ts`

**Interfaces:**
- Consumes: the existing `tone(ctx, dest, opts)` helper (`soundEngine.ts:28`) and `SOUND_GENERATORS` record (`soundEngine.ts:62`).
- Produces: `SoundId.YourTurn` = `'yourTurn'` (used by Task 2 via `playSound(SoundId.YourTurn)`).

- [ ] **Step 1: Write the failing test**

Add this test to `src/audio/__tests__/soundEngine.test.ts`, inside the `describe('soundEngine', ...)` block after the existing `'creates noise buffers for the dice roll'` test:

```ts
it('creates oscillators for the your-turn chime', async () => {
  const FakeAC = vi.fn(function () { return new FakeAudioContext() })
  vi.stubGlobal('AudioContext', FakeAC)
  const { playSound, SoundId } = await loadEngine()
  playSound(SoundId.YourTurn)
  const ctx = FakeAC.mock.results[0].value as FakeAudioContext
  expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
  expect(ctx.createGain).toHaveBeenCalledTimes(3)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/__tests__/soundEngine.test.ts`
Expected: FAIL (type error — `SoundId.YourTurn` does not exist).

- [ ] **Step 3: Add `SoundId.YourTurn`**

In `src/audio/soundEngine.ts`, add `YourTurn: 'yourTurn',` as the last entry of the `SoundId` const (after `GameStart`):

```ts
export const SoundId = {
  Click: 'click',
  DiceRoll: 'diceRoll',
  DiceLand: 'diceLand',
  Buy: 'buy',
  Build: 'build',
  Card: 'card',
  MoneyGain: 'moneyGain',
  MoneyLoss: 'moneyLoss',
  Jail: 'jail',
  Bankruptcy: 'bankruptcy',
  Win: 'win',
  Trade: 'trade',
  RoomJoin: 'roomJoin',
  GameStart: 'gameStart',
  YourTurn: 'yourTurn',
} as const;
```

- [ ] **Step 4: Add the generator**

In `src/audio/soundEngine.ts`, add `SoundId.YourTurn` to `SOUND_GENERATORS` as the last entry (after `GameStart`). A two-note ascending D5→A5 triangle chime — distinct from `roomJoin` (sine C5→G5) and `moneyGain` (523→659→784):

```ts
[SoundId.YourTurn]: (ctx, dest) => {
  tone(ctx, dest, { freq: 587, duration: 0.1, type: 'triangle', gain: 0.3 });
  tone(ctx, dest, { freq: 880, duration: 0.22, type: 'triangle', gain: 0.3, delay: 0.14 });
},
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/audio/__tests__/soundEngine.test.ts`
Expected: PASS (all 4 tests in the file, including the new one).

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck` and `npm run lint`
Expected: both clean (lint may show only the 2 pre-existing `PlayerTokens.tsx` warnings).

- [ ] **Step 7: Commit**

```bash
git add src/audio/soundEngine.ts src/audio/__tests__/soundEngine.test.ts
git commit -m "feat: add your-turn chime sound to the sound engine"
```

---

### Task 2: `useMyTurnSound` hook + GameView wiring

**Files:**
- Create: `src/audio/useMyTurnSound.ts`
- Test: `src/audio/__tests__/useMyTurnSound.test.tsx`
- Modify: `src/components/GameView.tsx`

**Interfaces:**
- Consumes: `SoundId.YourTurn` from `src/audio/soundEngine` (Task 1) and `useSound()` from `src/audio/SoundContext`.
- Produces: `useMyTurnSound(isMyTurn: boolean): void` — mounted once in `GameView`.

- [ ] **Step 1: Write the failing test**

Create `src/audio/__tests__/useMyTurnSound.test.tsx` with exactly this content (no semicolons, matching `SoundContext.test.tsx` style):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { useMyTurnSound } from '../useMyTurnSound'
import { SoundProvider } from '../SoundContext'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

function wrapper({ children }: { children: ReactNode }) {
  return <SoundProvider>{children}</SoundProvider>
}

describe('useMyTurnSound', () => {
  beforeEach(() => {
    playSoundMock.mockClear()
  })

  it('does not play on mount (baseline)', () => {
    renderHook(() => useMyTurnSound(true), { wrapper })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('does not play when it is not your turn', () => {
    renderHook(() => useMyTurnSound(false), { wrapper })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('plays once when your turn starts', () => {
    const { rerender } = renderHook(({ isMyTurn }: { isMyTurn: boolean }) => useMyTurnSound(isMyTurn), {
      initialProps: { isMyTurn: false },
      wrapper,
    })
    expect(playSoundMock).not.toHaveBeenCalled()
    rerender({ isMyTurn: true })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('yourTurn')
  })

  it('does not re-play while still your turn', () => {
    const { rerender } = renderHook(({ isMyTurn }: { isMyTurn: boolean }) => useMyTurnSound(isMyTurn), {
      initialProps: { isMyTurn: true },
      wrapper,
    })
    playSoundMock.mockClear()
    rerender({ isMyTurn: true })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('plays again on the next turn', () => {
    const { rerender } = renderHook(({ isMyTurn }: { isMyTurn: boolean }) => useMyTurnSound(isMyTurn), {
      initialProps: { isMyTurn: true },
      wrapper,
    })
    playSoundMock.mockClear()
    rerender({ isMyTurn: false })
    expect(playSoundMock).not.toHaveBeenCalled()
    rerender({ isMyTurn: true })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('yourTurn')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/__tests__/useMyTurnSound.test.tsx`
Expected: FAIL (cannot resolve `../useMyTurnSound` — module does not exist yet).

- [ ] **Step 3: Create the hook**

Create `src/audio/useMyTurnSound.ts` with exactly this content (no semicolons, matching `SoundContext.tsx`/`useGameSounds.ts` style). Refs the `roomJoin`/`gameStart` baseline pattern from `src/components/MultiplayerGame.tsx`:

```ts
import { useEffect, useRef } from 'react'
import { useSound } from './SoundContext'
import { SoundId } from './soundEngine'

export function useMyTurnSound(isMyTurn: boolean): void {
  const play = useSound()
  const prevIsMyTurnRef = useRef(isMyTurn)

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current) play(SoundId.YourTurn)
    prevIsMyTurnRef.current = isMyTurn
  }, [isMyTurn, play])
}
```

Note: do not change the deps array — `[isMyTurn, play]` keeps `react-hooks/exhaustive-deps` happy (both values are read).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/__tests__/useMyTurnSound.test.tsx`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Wire into GameView**

In `src/components/GameView.tsx`, add the import after the `GameSounds` import:

```tsx
import GameSounds from '../audio/useGameSounds'
import { useMyTurnSound } from '../audio/useMyTurnSound'
```

And call the hook immediately after `isMyTurn` is computed (after line `const isMyTurn = ...`, before `const tradesEnabled = ...`):

```tsx
  const isMyTurn = game.myPlayerId === null
    ? !state.players[state.currentPlayer]?.isBot
    : game.myPlayerId === state.currentPlayer
  useMyTurnSound(isMyTurn)
```

Do not touch `<GameSounds state={state} />` — it stays as is. The mount baseline of `useMyTurnSound` swallows the first turn of a game (the game-start jingle already covers it) and any mid-game rejoin.

- [ ] **Step 6: Run the full verification**

Run: `npx vitest run src/audio/__tests__/useMyTurnSound.test.tsx src/audio/__tests__/soundEngine.test.ts`, then `npm run typecheck`, then `npm run test:unit`, then `npm run lint`
Expected: all pass — full unit suite green, lint shows only the 2 pre-existing `PlayerTokens.tsx` warnings.

- [ ] **Step 7: Commit**

```bash
git add src/audio/useMyTurnSound.ts src/audio/__tests__/useMyTurnSound.test.tsx src/components/GameView.tsx
git commit -m "feat: play your-turn chime when the local player's turn starts"
```
