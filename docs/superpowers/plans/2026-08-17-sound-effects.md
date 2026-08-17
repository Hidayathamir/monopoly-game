# Sound Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add synthesized sound effects (Web Audio API) for all gameplay events — driven by `state.eventLog` so every player's actions are heard — plus button clicks, a room-join chime, and a game-start jingle.

**Architecture:** A pure `soundEngine.ts` synthesizes sounds (no audio files, no dependencies). A pure `soundMap.ts` maps `LogEventKey` → `SoundId`. `useGameSounds` diffs `state.eventLog` between snapshots and plays one sound per new entry (baselining on mount so a rejoin never replays history). A `SoundContext` provider exposes imperative `play()` for clicks, the room-join chime, and the game-start jingle (the jingle is driven by the phase transition Setup → in-progress, because the `GameStarted` log entry arrives inside the first snapshot `GameView` sees and would be swallowed by the baseline). All sounds are client-side; nothing in the reducer, server, or wire contract changes.

**Tech Stack:** React 19 + TypeScript, Vite 8, Web Audio API, vitest.

## Global Constraints

- No TS `enum`; use `const` objects + derived union types (`erasableSyntaxOnly: true`). `SoundId` follows this.
- `verbatimModuleSyntax: true` → type-only imports must use `import type`.
- `noUnusedLocals`/`noUnusedParameters` are on — no unused imports in test or source code.
- Semicolons: `src/audio/soundEngine.ts`, `src/audio/soundMap.ts`, and `src/types/*`/`src/logic/*` use semicolons; `src/components/*`, `src/hooks/*`, `src/audio/useGameSounds.ts`, `src/audio/SoundContext.tsx`, and `server/*` omit them. Match the file you edit.
- No new i18n strings — sounds introduce no user-facing text.
- A sound failure must never throw or break gameplay: every `playSound`/`unlockAudio` path no-ops when `AudioContext` is unavailable.
- Verify with `npm run typecheck`, `npm run test:unit`, `npm run lint`. Multiplayer e2e needs `npm run build` (dist is gitignored) — not required for this feature's tests.
- Wire values (`event.*` log keys) are unchanged; this feature only *reads* them.

---

## File Structure

- `src/audio/soundEngine.ts` — new. `SoundId` const + union, `playSound(id)`, `unlockAudio()`, synthesis helpers + 14 generators, lazy AudioContext.
- `src/audio/soundMap.ts` — new. Pure `soundForLogKey(key): SoundId | null`.
- `src/audio/useGameSounds.ts` — new. `useGameSounds(state)` hook + default `GameSounds` component.
- `src/audio/SoundContext.tsx` — new. `SoundProvider` + `useSound()`, first-gesture unlock listener.
- `src/components/Button.tsx` — modify. Click sound by default, `sound?: SoundId | null` prop.
- `src/components/DiceRoller.tsx` — modify. Roll button plays `diceRoll` (button `sound={null}`).
- `src/components/EventLog.tsx` — modify. Expand/collapse button plays `click`.
- `src/components/Sidebar.tsx` — modify. Trade-inbox button plays `click`.
- `src/components/GameView.tsx` — modify. Render `<GameSounds state={state}/>`.
- `src/components/MultiplayerGame.tsx` — modify. `roomJoin` on Welcome, `gameStart` on Setup→in-progress.
- `src/App.tsx` — modify. Wrap tree in `SoundProvider`.
- Tests (new): `src/audio/__tests__/soundEngine.test.ts`, `src/audio/__tests__/soundMap.test.ts`, `src/audio/__tests__/useGameSounds.test.ts`, `src/audio/__tests__/SoundContext.test.tsx`, `src/components/__tests__/Button.test.tsx`.
- Tests (modified): `src/components/__tests__/DiceRoller.test.tsx`, `src/components/__tests__/EventLog.test.tsx`, `src/components/__tests__/Sidebar.test.tsx`.

---

### Task 1: Sound engine

**Files:**
- Create: `src/audio/soundEngine.ts`
- Test: `src/audio/__tests__/soundEngine.test.ts`

**Interfaces:**
- Produces: `export const SoundId = { Click: 'click', DiceRoll: 'diceRoll', DiceLand: 'diceLand', Buy: 'buy', Build: 'build', Card: 'card', MoneyGain: 'moneyGain', MoneyLoss: 'moneyLoss', Jail: 'jail', Bankruptcy: 'bankruptcy', Win: 'win', Trade: 'trade', RoomJoin: 'roomJoin', GameStart: 'gameStart' } as const`; `export type SoundId = (typeof SoundId)[keyof typeof SoundId]`; `export function playSound(id: SoundId): void`; `export function unlockAudio(): void`.

- [ ] **Step 1: Write the failing engine test**

Create `src/audio/__tests__/soundEngine.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'

class FakeOscillator {
  type = 'sine'
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeGain {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn()
}

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  sampleRate = 44100
  destination = {}
  resume = vi.fn()
  createGain = vi.fn(() => new FakeGain())
  createOscillator = vi.fn(() => new FakeOscillator())
  createBuffer = vi.fn((_channels: number, length: number, _rate: number) => ({
    getChannelData: () => new Float32Array(length),
  }))
  createBufferSource = vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn() }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function loadEngine() {
  vi.resetModules()
  return await import('../soundEngine')
}

describe('soundEngine', () => {
  it('no-ops when AudioContext is unavailable', async () => {
    const { playSound, SoundId } = await loadEngine()
    expect(() => playSound(SoundId.Click)).not.toThrow()
  })

  it('creates an oscillator for a tonal sound', async () => {
    const FakeAC = vi.fn(() => new FakeAudioContext())
    vi.stubGlobal('AudioContext', FakeAC)
    const { playSound, SoundId } = await loadEngine()
    playSound(SoundId.Buy)
    const ctx = FakeAC.mock.results[0].value as FakeAudioContext
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2)
    expect(ctx.createGain).toHaveBeenCalledTimes(3)
  })

  it('creates noise buffers for the dice roll', async () => {
    const FakeAC = vi.fn(() => new FakeAudioContext())
    vi.stubGlobal('AudioContext', FakeAC)
    const { playSound, SoundId } = await loadEngine()
    playSound(SoundId.DiceRoll)
    const ctx = FakeAC.mock.results[0].value as FakeAudioContext
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/__tests__/soundEngine.test.ts`
Expected: FAIL — module `../soundEngine` cannot be resolved.

- [ ] **Step 3: Write the minimal implementation**

Create `src/audio/soundEngine.ts` (semicolons, matches `src/logic` style):

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
} as const;
export type SoundId = (typeof SoundId)[keyof typeof SoundId];

interface ToneOpts {
  freq: number;
  endFreq?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone(ctx: AudioContext, dest: AudioNode, opts: ToneOpts): void {
  const { freq, endFreq, duration, type = 'sine', gain = 0.5, delay = 0 } = opts;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(ctx: AudioContext, dest: AudioNode, duration: number, gain = 0.3, delay = 0): void {
  const t0 = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(g);
  g.connect(dest);
  src.start(t0);
}

const SOUND_GENERATORS: Record<SoundId, (ctx: AudioContext, dest: AudioNode) => void> = {
  [SoundId.Click]: (ctx, dest) => tone(ctx, dest, { freq: 900, duration: 0.05, type: 'triangle', gain: 0.4 }),
  [SoundId.DiceRoll]: (ctx, dest) => {
    noise(ctx, dest, 0.25, 0.25);
    noise(ctx, dest, 0.18, 0.2, 0.08);
    noise(ctx, dest, 0.12, 0.15, 0.16);
  },
  [SoundId.DiceLand]: (ctx, dest) =>
    tone(ctx, dest, { freq: 160, endFreq: 90, duration: 0.12, type: 'square', gain: 0.3 }),
  [SoundId.Buy]: (ctx, dest) => {
    tone(ctx, dest, { freq: 660, duration: 0.08, type: 'square', gain: 0.25 });
    tone(ctx, dest, { freq: 880, duration: 0.12, type: 'square', gain: 0.25, delay: 0.09 });
  },
  [SoundId.Build]: (ctx, dest) => {
    tone(ctx, dest, { freq: 300, endFreq: 500, duration: 0.09, type: 'triangle', gain: 0.35 });
    tone(ctx, dest, { freq: 420, endFreq: 700, duration: 0.12, type: 'triangle', gain: 0.35, delay: 0.08 });
  },
  [SoundId.Card]: (ctx, dest) => {
    noise(ctx, dest, 0.15, 0.18);
    tone(ctx, dest, { freq: 700, endFreq: 400, duration: 0.12, type: 'sine', gain: 0.2, delay: 0.02 });
  },
  [SoundId.MoneyGain]: (ctx, dest) => {
    tone(ctx, dest, { freq: 523, duration: 0.07, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 659, duration: 0.07, type: 'triangle', gain: 0.3, delay: 0.07 });
    tone(ctx, dest, { freq: 784, duration: 0.14, type: 'triangle', gain: 0.3, delay: 0.14 });
  },
  [SoundId.MoneyLoss]: (ctx, dest) => {
    tone(ctx, dest, { freq: 400, duration: 0.1, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 300, duration: 0.16, type: 'triangle', gain: 0.3, delay: 0.1 });
  },
  [SoundId.Jail]: (ctx, dest) => {
    tone(ctx, dest, { freq: 130, endFreq: 110, duration: 0.3, type: 'sawtooth', gain: 0.18 });
    tone(ctx, dest, { freq: 180, duration: 0.12, type: 'square', gain: 0.2, delay: 0.32 });
  },
  [SoundId.Bankruptcy]: (ctx, dest) => {
    tone(ctx, dest, { freq: 330, duration: 0.14, type: 'sawtooth', gain: 0.22 });
    tone(ctx, dest, { freq: 262, duration: 0.14, type: 'sawtooth', gain: 0.22, delay: 0.15 });
    tone(ctx, dest, { freq: 196, duration: 0.3, type: 'sawtooth', gain: 0.22, delay: 0.3 });
  },
  [SoundId.Win]: (ctx, dest) => {
    tone(ctx, dest, { freq: 523, duration: 0.1, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 659, duration: 0.1, type: 'triangle', gain: 0.3, delay: 0.11 });
    tone(ctx, dest, { freq: 784, duration: 0.1, type: 'triangle', gain: 0.3, delay: 0.22 });
    tone(ctx, dest, { freq: 1046, duration: 0.3, type: 'triangle', gain: 0.3, delay: 0.33 });
  },
  [SoundId.Trade]: (ctx, dest) => {
    tone(ctx, dest, { freq: 880, duration: 0.08, type: 'sine', gain: 0.25 });
    tone(ctx, dest, { freq: 1100, duration: 0.14, type: 'sine', gain: 0.25, delay: 0.09 });
  },
  [SoundId.RoomJoin]: (ctx, dest) => {
    tone(ctx, dest, { freq: 523, duration: 0.12, type: 'sine', gain: 0.3 });
    tone(ctx, dest, { freq: 784, duration: 0.2, type: 'sine', gain: 0.3, delay: 0.13 });
  },
  [SoundId.GameStart]: (ctx, dest) => {
    tone(ctx, dest, { freq: 392, duration: 0.1, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 523, duration: 0.1, type: 'triangle', gain: 0.3, delay: 0.12 });
    tone(ctx, dest, { freq: 659, duration: 0.22, type: 'triangle', gain: 0.3, delay: 0.24 });
  },
};

const MASTER_GAIN = 0.3;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AC ? new AC() : null;
}

export function playSound(id: SoundId): void {
  if (!ctx) ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'closed') return;
  if (ctx.state === 'suspended') void ctx.resume();
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(ctx.destination);
  SOUND_GENERATORS[id](ctx, master);
}

export function unlockAudio(): void {
  if (!ctx) ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/__tests__/soundEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/soundEngine.ts src/audio/__tests__/soundEngine.test.ts
git commit -m "feat: add Web Audio sound engine with synthesized SoundId set"
```

---

### Task 2: Event-log → sound map

**Files:**
- Create: `src/audio/soundMap.ts`
- Test: `src/audio/__tests__/soundMap.test.ts`

**Interfaces:**
- Consumes: `SoundId` (Task 1), `LogEventKey` from `src/types/game.ts`.
- Produces: `export function soundForLogKey(key: LogEventKey): SoundId | null` — returns a `SoundId` for mapped keys, `null` for the silent set (and any unmapped key).

- [ ] **Step 1: Write the failing map test**

Create `src/audio/__tests__/soundMap.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { soundForLogKey } from '../soundMap'
import { SoundId } from '../soundEngine'
import { LogEventKey } from '../../types/game'

describe('soundForLogKey', () => {
  const cases: Array<[LogEventKey, SoundId | null]> = [
    [LogEventKey.GameStarted, SoundId.GameStart],
    [LogEventKey.Rolled, SoundId.DiceLand],
    [LogEventKey.RolledAimed, SoundId.DiceLand],
    [LogEventKey.DoublesAgain, SoundId.DiceLand],
    [LogEventKey.JailFailed, SoundId.DiceLand],
    [LogEventKey.Bought, SoundId.Buy],
    [LogEventKey.BuiltHouse, SoundId.Build],
    [LogEventKey.BuiltHotel, SoundId.Build],
    [LogEventKey.PaidRent, SoundId.MoneyLoss],
    [LogEventKey.CardPay, SoundId.MoneyLoss],
    [LogEventKey.IncomeTax, SoundId.MoneyLoss],
    [LogEventKey.LuxuryTax, SoundId.MoneyLoss],
    [LogEventKey.CardStreetRepairs, SoundId.MoneyLoss],
    [LogEventKey.SoldHouse, SoundId.MoneyLoss],
    [LogEventKey.SoldToBank, SoundId.MoneyLoss],
    [LogEventKey.BankruptcyTransfer, SoundId.MoneyLoss],
    [LogEventKey.PassedGo, SoundId.MoneyGain],
    [LogEventKey.CardCollect, SoundId.MoneyGain],
    [LogEventKey.CardCollectPlayers, SoundId.MoneyGain],
    [LogEventKey.FreeParkingJackpot, SoundId.MoneyGain],
    [LogEventKey.PaidJailFine, SoundId.MoneyGain],
    [LogEventKey.UsedJailCard, SoundId.MoneyGain],
    [LogEventKey.JailBreakDoubles, SoundId.MoneyGain],
    [LogEventKey.ToJail, SoundId.Jail],
    [LogEventKey.CardToJail, SoundId.Jail],
    [LogEventKey.TradeProposed, SoundId.Trade],
    [LogEventKey.TradeAccepted, SoundId.Trade],
    [LogEventKey.Bankruptcy, SoundId.Bankruptcy],
    [LogEventKey.BankruptcyWin, SoundId.Win],
    [LogEventKey.MovedForward, SoundId.Card],
    [LogEventKey.MovedBack, SoundId.Card],
    [LogEventKey.GotJailCard, SoundId.Card],
    [LogEventKey.Turn, null],
    [LogEventKey.TripleDoubles, null],
    [LogEventKey.JailForcedOut, null],
    [LogEventKey.OwnerInJail, null],
    [LogEventKey.MonopolyRent, null],
    [LogEventKey.MustCircleBoard, null],
    [LogEventKey.Mortgaged, null],
    [LogEventKey.Unmortgaged, null],
    [LogEventKey.TradeRejected, null],
    [LogEventKey.TradeCancelled, null],
    [LogEventKey.PlayerOffline, null],
    [LogEventKey.PlayerBack, null],
    [LogEventKey.ReconnectWait, null],
  ]

  it.each(cases)('maps %s', (key, expected) => {
    expect(soundForLogKey(key)).toBe(expected)
  })

  it('returns a SoundId or null for every log key (exhaustive)', () => {
    for (const key of Object.values(LogEventKey)) {
      const sound = soundForLogKey(key)
      expect(sound === null || Object.values(SoundId).includes(sound)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/__tests__/soundMap.test.ts`
Expected: FAIL — module `../soundMap` cannot be resolved.

- [ ] **Step 3: Write the minimal implementation**

Create `src/audio/soundMap.ts` (semicolons):

```ts
import { LogEventKey, type LogEventKey as LogEventKeyType } from '../types/game';
import { SoundId, type SoundId as SoundIdType } from './soundEngine';

export function soundForLogKey(key: LogEventKeyType): SoundIdType | null {
  switch (key) {
    case LogEventKey.Rolled:
    case LogEventKey.RolledAimed:
    case LogEventKey.DoublesAgain:
    case LogEventKey.JailFailed:
      return SoundId.DiceLand;
    case LogEventKey.PassedGo:
    case LogEventKey.CardCollect:
    case LogEventKey.CardCollectPlayers:
    case LogEventKey.FreeParkingJackpot:
    case LogEventKey.PaidJailFine:
    case LogEventKey.UsedJailCard:
    case LogEventKey.JailBreakDoubles:
      return SoundId.MoneyGain;
    case LogEventKey.PaidRent:
    case LogEventKey.CardPay:
    case LogEventKey.IncomeTax:
    case LogEventKey.LuxuryTax:
    case LogEventKey.CardStreetRepairs:
    case LogEventKey.SoldHouse:
    case LogEventKey.SoldToBank:
    case LogEventKey.BankruptcyTransfer:
      return SoundId.MoneyLoss;
    case LogEventKey.Bought:
      return SoundId.Buy;
    case LogEventKey.BuiltHouse:
    case LogEventKey.BuiltHotel:
      return SoundId.Build;
    case LogEventKey.MovedForward:
    case LogEventKey.MovedBack:
    case LogEventKey.GotJailCard:
      return SoundId.Card;
    case LogEventKey.ToJail:
    case LogEventKey.CardToJail:
      return SoundId.Jail;
    case LogEventKey.TradeProposed:
    case LogEventKey.TradeAccepted:
      return SoundId.Trade;
    case LogEventKey.Bankruptcy:
      return SoundId.Bankruptcy;
    case LogEventKey.BankruptcyWin:
      return SoundId.Win;
    case LogEventKey.GameStarted:
      return SoundId.GameStart;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/__tests__/soundMap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/soundMap.ts src/audio/__tests__/soundMap.test.ts
git commit -m "feat: map event log keys to sound ids"
```

---

### Task 3: GameSounds hook

**Files:**
- Create: `src/audio/useGameSounds.ts`
- Test: `src/audio/__tests__/useGameSounds.test.ts`

**Interfaces:**
- Consumes: `GameState` (from `src/types/game.ts`), `playSound` (Task 1), `soundForLogKey` (Task 2).
- Produces: `export function useGameSounds(state: GameState): void` (plays one sound per new `eventLog` entry, baselining on mount and re-baselining if the log shrinks); `export default function GameSounds({ state }: { state: GameState })` — renders nothing, calls the hook.

- [ ] **Step 1: Write the failing hook test**

Create `src/audio/__tests__/useGameSounds.test.ts` (no semicolons, hooks style):

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGameSounds } from '../useGameSounds'
import { createInitialState } from '../../logic/gameReducer'
import type { GameState } from '../../types/game'
import { LogEventKey } from '../../types/game'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

function withLog(keys: LogEventKey[]): GameState {
  return { ...createInitialState(), eventLog: keys.map((key) => ({ key })) }
}

describe('useGameSounds', () => {
  it('plays nothing on first mount (baseline)', () => {
    const { rerender } = renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([LogEventKey.Rolled, LogEventKey.Bought]) },
    })
    expect(playSoundMock).not.toHaveBeenCalled()
    rerender({ state: withLog([LogEventKey.Rolled, LogEventKey.Bought]) })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('plays one sound per new log entry, in order', () => {
    const { rerender } = renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([]) },
    })
    expect(playSoundMock).not.toHaveBeenCalled()

    rerender({ state: withLog([LogEventKey.Rolled, LogEventKey.Bought]) })
    expect(playSoundMock).toHaveBeenNthCalledWith(1, 'diceLand')
    expect(playSoundMock).toHaveBeenNthCalledWith(2, 'buy')

    playSoundMock.mockClear()
    rerender({ state: withLog([LogEventKey.Rolled, LogEventKey.Bought, LogEventKey.BankruptcyWin]) })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('win')
  })

  it('does not replay history on a fresh mount (rejoin)', () => {
    renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([LogEventKey.GameStarted, LogEventKey.Turn, LogEventKey.Rolled]) },
    })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('re-baselines if the log ever shrinks', () => {
    const { rerender } = renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([]) },
    })
    rerender({ state: withLog([LogEventKey.Bought]) })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    playSoundMock.mockClear()

    rerender({ state: withLog([]) })
    expect(playSoundMock).not.toHaveBeenCalled()

    rerender({ state: withLog([LogEventKey.PaidRent]) })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('moneyLoss')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/__tests__/useGameSounds.test.ts`
Expected: FAIL — module `../useGameSounds` cannot be resolved.

- [ ] **Step 3: Write the minimal implementation**

Create `src/audio/useGameSounds.ts` (no semicolons):

```ts
import { useEffect, useRef } from 'react'
import type { GameState } from '../types/game'
import { playSound } from './soundEngine'
import { soundForLogKey } from './soundMap'

export function useGameSounds(state: GameState): void {
  const lastLengthRef = useRef<number | null>(null)

  useEffect(() => {
    const log = state.eventLog
    const last = lastLengthRef.current
    if (last === null || log.length < last) {
      lastLengthRef.current = log.length
      return
    }
    lastLengthRef.current = log.length
    for (let i = last; i < log.length; i++) {
      const sound = soundForLogKey(log[i].key)
      if (sound !== null) playSound(sound)
    }
  }, [state.eventLog])
}

export default function GameSounds({ state }: { state: GameState }) {
  useGameSounds(state)
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/__tests__/useGameSounds.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/useGameSounds.ts src/audio/__tests__/useGameSounds.test.ts
git commit -m "feat: play sounds for new event log entries via useGameSounds"
```

---

### Task 4: SoundContext

**Files:**
- Create: `src/audio/SoundContext.tsx`
- Test: `src/audio/__tests__/SoundContext.test.tsx`

**Interfaces:**
- Consumes: `playSound`, `unlockAudio` (Task 1).
- Produces: `export function SoundProvider({ children }: { children: ReactNode })` (registers a one-time `pointerdown` unlock listener); `export function useSound(): (id: SoundId) => void` (context default is a no-op so consumers render without a provider).

- [ ] **Step 1: Write the failing context test**

Create `src/audio/__tests__/SoundContext.test.tsx` (no semicolons):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SoundProvider, useSound } from '../SoundContext'
import { SoundId } from '../soundEngine'

const { playSoundMock, unlockMock } = vi.hoisted(() => ({ playSoundMock: vi.fn(), unlockMock: vi.fn() }))
vi.mock('../soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../soundEngine')>()
  return { ...mod, playSound: playSoundMock, unlockAudio: unlockMock }
})

function Consumer() {
  const play = useSound()
  return <button onClick={() => play(SoundId.RoomJoin)}>beep</button>
}

beforeEach(() => {
  playSoundMock.mockClear()
  unlockMock.mockClear()
  cleanup()
})

describe('SoundProvider', () => {
  it('plays a sound through useSound', () => {
    render(<SoundProvider><Consumer /></SoundProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'beep' }))
    expect(playSoundMock).toHaveBeenCalledWith('roomJoin')
  })

  it('unlocks audio on the first pointerdown only', () => {
    render(<SoundProvider><div /></SoundProvider>)
    fireEvent.pointerDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(document.body)
    expect(unlockMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/__tests__/SoundContext.test.tsx`
Expected: FAIL — module `../SoundContext` cannot be resolved.

- [ ] **Step 3: Write the minimal implementation**

Create `src/audio/SoundContext.tsx` (no semicolons):

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { playSound, unlockAudio } from './soundEngine'
import type { SoundId } from './soundEngine'

const SoundContext = createContext<(id: SoundId) => void>(() => {})

export function SoundProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const unlock = () => unlockAudio()
    document.addEventListener('pointerdown', unlock, { once: true })
    return () => document.removeEventListener('pointerdown', unlock)
  }, [])
  const play = useCallback((id: SoundId) => playSound(id), [])
  const value = useMemo(() => play, [play])
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound(): (id: SoundId) => void {
  return useContext(SoundContext)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/__tests__/SoundContext.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/SoundContext.tsx src/audio/__tests__/SoundContext.test.tsx
git commit -m "feat: add SoundContext with imperative play and gesture unlock"
```

---

### Task 5: Button click sound

**Files:**
- Modify: `src/components/Button.tsx`
- Test: `src/components/__tests__/Button.test.tsx`

**Interfaces:**
- Consumes: `useSound` (Task 4), `SoundId` (Task 1).
- Produces: `Button` gains prop `sound?: SoundId | null` — `undefined`/omitted → plays `SoundId.Click` on click; a `SoundId` → plays that sound; `null` → silent. `onClick` still fires.

- [ ] **Step 1: Write the failing Button test**

Create `src/components/__tests__/Button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Button from '../Button'
import { SoundProvider } from '../../audio/SoundContext'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../../audio/soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../audio/soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

function renderButton(children: ReactNode, props: ComponentProps<typeof Button> = {}) {
  return render(<SoundProvider><Button {...props}>{children}</Button></SoundProvider>)
}

beforeEach(() => {
  playSoundMock.mockClear()
  cleanup()
})

describe('Button sound', () => {
  it('plays a click by default', () => {
    renderButton('Go')
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(playSoundMock).toHaveBeenCalledWith('click')
  })

  it('plays a custom sound when provided', () => {
    renderButton('Go', { sound: 'buy' })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(playSoundMock).toHaveBeenCalledWith('buy')
  })

  it('is silent when sound is null', () => {
    renderButton('Go', { sound: null })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('still fires onClick', () => {
    const onClick = vi.fn()
    renderButton('Go', { onClick })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Button.test.tsx`
Expected: FAIL — `playSoundMock` is not called (no sound wiring yet).

- [ ] **Step 3: Modify `Button`**

Replace `src/components/Button.tsx` with (no semicolons):

```tsx
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { useSound } from '../audio/SoundContext'
import { SoundId, type SoundId as SoundIdType } from '../audio/soundEngine'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'start'
  size?: 'sm' | 'md' | 'lg'
  sound?: SoundIdType | null
  children?: ReactNode
}

const variantClasses: Record<string, string> = {
  primary: 'bg-blue-primary text-white',
  success: 'bg-green-success text-white',
  secondary: 'bg-orange text-white',
  danger: 'bg-red-danger text-white',
  start: 'bg-gold text-bg-main',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-2.5 py-1 text-base',
  md: 'px-3.5 py-1.5 text-base',
  lg: 'px-5 py-2.5 text-xl',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  sound,
  onClick,
  ...props
}: ButtonProps) {
  const play = useSound()
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (sound !== null) play(sound ?? SoundId.Click)
    onClick?.(e)
  }
  return (
    <button
      className={[
        'rounded-lg border-none font-semibold w-full my-[3px] transition-transform duration-150',
        variantClasses[variant],
        sizeClasses[size],
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-px hover:opacity-90',
        className,
      ].join(' ')}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `npx vitest run src/components/__tests__/`
Expected: PASS — existing component tests render `Button` without `SoundProvider`, and `useSound`'s default no-op keeps them silent and green.

- [ ] **Step 6: Commit**

```bash
git add src/components/Button.tsx src/components/__tests__/Button.test.tsx
git commit -m "feat: play click sound on Button with sound override prop"
```

---

### Task 6: Dice roll sound

**Files:**
- Modify: `src/components/DiceRoller.tsx`
- Modify: `src/components/__tests__/DiceRoller.test.tsx`

**Interfaces:**
- Consumes: `useSound` (Task 4), `SoundId` (Task 1).
- Produces: `DiceRoller` plays `SoundId.DiceRoll` exactly once per roll press; its roll `Button` uses `sound={null}` so no double click sound fires.

- [ ] **Step 1: Add the failing test**

In `src/components/__tests__/DiceRoller.test.tsx`, add after the imports (after line 8):

```tsx
const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../../audio/soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../audio/soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})
```

Add `SoundProvider` to the import from test-utils area — add a new import after line 8:

```tsx
import { SoundProvider } from '../../audio/SoundContext'
```

And add this new `describe` block at the end of the file (after the final `})` of the outer `describe`, i.e. after line 234):

```tsx
describe('roll sound', () => {
  beforeEach(() => {
    playSoundMock.mockClear()
    vi.useFakeTimers()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('plays the dice roll sound when the roll button is pressed', () => {
    const onRoll = vi.fn()
    renderWithProviders(
      <SoundProvider>
        <DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />
      </SoundProvider>,
    )
    const button = screen.getByRole('button', { name: 'Roll Dice' })
    act(() => vi.advanceTimersByTime(240))
    fireEvent.pointerDown(button, { button: 0 })
    expect(playSoundMock).toHaveBeenCalledWith('diceRoll')
  })

  it('does not also play the generic click on the roll button', () => {
    const onRoll = vi.fn()
    renderWithProviders(
      <SoundProvider>
        <DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />
      </SoundProvider>,
    )
    const button = screen.getByRole('button', { name: 'Roll Dice' })
    act(() => vi.advanceTimersByTime(240))
    fireEvent.pointerDown(button, { button: 0 })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('diceRoll')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: FAIL — `playSoundMock` never called (no sound wiring in `DiceRoller`).

- [ ] **Step 3: Modify `DiceRoller`**

In `src/components/DiceRoller.tsx`:

1. Add imports after line 5 (`import Speedometer from './Speedometer'`):

```tsx
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'
```

2. In the component body, after line 44 (`const player = state.players[state.currentPlayer]`), add:

```tsx
const play = useSound()
```

3. In `stopAndRoll`, change the body so it reads (the `play(...)` line is new):

```tsx
  function stopAndRoll() {
    if (rollingRef.current) return
    rollingRef.current = true
    setRolling(true)
    play(SoundId.DiceRoll)
    onRoll(Math.round(aimValueRef.current))
    setTimeout(() => {
      rollingRef.current = false
      setRolling(false)
    }, 500)
  }
```

4. On the roll `Button` (line 123), add `sound={null}`:

```tsx
        <Button variant="primary" size="lg" onPointerDown={handlePointerDown} onClick={handleClick} sound={null}>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/DiceRoller.test.tsx`
Expected: PASS (all existing tests + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/components/DiceRoller.tsx src/components/__tests__/DiceRoller.test.tsx
git commit -m "feat: play dice roll sound on roll, suppress click on roll button"
```

---

### Task 7: Raw button clicks (EventLog + Sidebar)

**Files:**
- Modify: `src/components/EventLog.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/__tests__/EventLog.test.tsx`
- Modify: `src/components/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `useSound` (Task 4), `SoundId` (Task 1).
- Produces: EventLog expand/collapse button and Sidebar trade-inbox button each play `SoundId.Click`.

- [ ] **Step 1: Add the failing tests**

In `src/components/__tests__/EventLog.test.tsx`, after the existing imports (after line 4), add:

```tsx
import { SoundProvider } from '../../audio/SoundContext'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../../audio/soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../audio/soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})
```

`vi` is already imported in that file (line 4 imports `afterEach, describe, it, expect` — add `vi` to that import). Add this test inside the existing `describe('EventLog', ...)`:

```tsx
  it('plays a click sound when toggling the log', () => {
    playSoundMock.mockClear()
    const log = [
      { key: 'event.turn', params: { name: 'A' } },
      { key: 'event.turn', params: { name: 'B' } },
      { key: 'event.turn', params: { name: 'C' } },
    ]
    renderWithProviders(<SoundProvider><EventLog log={log} /></SoundProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Full history/ }))
    expect(playSoundMock).toHaveBeenCalledWith('click')
  })
```

Add `screen` to the `@testing-library/react` import in that file (currently imports `fireEvent, cleanup`).

In `src/components/__tests__/Sidebar.test.tsx`, after the existing imports (after line 8), add:

```tsx
import { SoundProvider } from '../../audio/SoundContext'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../../audio/soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../audio/soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})
```

Add `vi` to the vitest import (line 2 imports `afterEach, describe, it, expect`). Add this test inside the existing `describe('Sidebar', ...)`:

```tsx
  it('plays a click sound when opening the trade inbox', () => {
    playSoundMock.mockClear()
    renderWithProviders(
      <SoundProvider>
        <Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} />
      </SoundProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Trades' }))
    expect(playSoundMock).toHaveBeenCalledWith('click')
  })
```

Add `fireEvent` to the `@testing-library/react` import in Sidebar.test.tsx (currently imports `cleanup, screen, within`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/EventLog.test.tsx src/components/__tests__/Sidebar.test.tsx`
Expected: FAIL — `playSoundMock` never called.

- [ ] **Step 3: Modify `EventLog`**

In `src/components/EventLog.tsx`:

1. Add imports after line 5 (`import { resolveLogEntry } from '../i18n/log'`):

```tsx
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'
```

2. In the component body, after line 13 (`const { formatMoney } = useCurrency()`), add:

```tsx
const play = useSound()
```

3. Change the expand/collapse button's `onClick` (line 42) to:

```tsx
          onClick={() => {
            setExpanded(!expanded)
            play(SoundId.Click)
          }}
```

- [ ] **Step 4: Modify `Sidebar`**

In `src/components/Sidebar.tsx`:

1. Add imports after line 9 (`import EventLog from './EventLog'`):

```tsx
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'
```

2. In the component body, after line 36 (`const { t } = useTranslation()`), add:

```tsx
const play = useSound()
```

3. Change the trade-inbox button's `onClick` (line 62) to:

```tsx
            onClick={() => {
              onOpenTrades()
              play(SoundId.Click)
            }}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/EventLog.test.tsx src/components/__tests__/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/EventLog.tsx src/components/Sidebar.tsx src/components/__tests__/EventLog.test.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat: play click sound on event-log and trade-inbox buttons"
```

---

### Task 8: Wire provider, room join, game start, GameSounds

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/MultiplayerGame.tsx`
- Modify: `src/components/GameView.tsx`

**Interfaces:**
- Consumes: `SoundProvider`, `useSound` (Task 4), `SoundId` (Task 1), `GameSounds` (Task 3), `GamePhase`.
- Produces: whole app wrapped in `SoundProvider`; `roomJoin` plays once when `game.code` first becomes non-null (Welcome received); `gameStart` plays when the phase transitions Setup → in-progress **only after the client has a room code** (so a rejoin never fires it); `GameView` renders `<GameSounds state={state}/>`.

- [ ] **Step 1: Wrap the app in `SoundProvider`**

Replace `src/App.tsx` with (no semicolons):

```tsx
import { useState } from 'react'
import GameSetup from './components/GameSetup'
import MultiplayerGame, { type JoinInfo } from './components/MultiplayerGame'
import LanguageCurrencyBar from './components/LanguageCurrencyBar'
import { SoundProvider } from './audio/SoundContext'
import { loadSession, clearSession } from './net/session'

export default function App() {
  const [session] = useState(loadSession)
  const [started, setStarted] = useState(() => session !== null)
  const [joinInfo, setJoinInfo] = useState<JoinInfo>(() =>
    session ? { name: session.name, code: session.code } : { name: '', code: null },
  )

  function handleCreate(name: string) {
    setJoinInfo({ name, code: null })
    setStarted(true)
  }

  function handleJoin(name: string, code: string) {
    setJoinInfo({ name, code })
    setStarted(true)
  }

  return (
    <SoundProvider>
      {started ? (
        <>
          <MultiplayerGame
            joinInfo={joinInfo}
            onLeft={() => {
              clearSession()
              setStarted(false)
            }}
          />
          <LanguageCurrencyBar />
        </>
      ) : (
        <>
          <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
            <GameSetup onCreate={handleCreate} onJoin={handleJoin} />
          </div>
          <LanguageCurrencyBar />
        </>
      )}
    </SoundProvider>
  )
}
```

- [ ] **Step 2: Add room-join chime and game-start jingle in `MultiplayerGame`**

In `src/components/MultiplayerGame.tsx`:

1. Add imports after line 6 (`import GameView from './GameView'`):

```tsx
import { useRef } from 'react'
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'
```

2. Add `useRef` to the existing `useEffect` import on line 1 (change `import { useEffect } from 'react'` to `import { useEffect, useRef } from 'react'`).

3. Inside the component body, after line 20 (`const name = joinInfo.name`), add:

```tsx
  const play = useSound()
  const prevCodeRef = useRef(game.code)
  const prevPhaseRef = useRef<GamePhase | null>(null)

  useEffect(() => {
    if (game.code !== null && prevCodeRef.current === null) play(SoundId.RoomJoin)
    prevCodeRef.current = game.code
  }, [game.code, play])

  useEffect(() => {
    if (game.code === null) return
    if (prevPhaseRef.current === null) {
      prevPhaseRef.current = game.state.phase
      return
    }
    const prev = prevPhaseRef.current
    prevPhaseRef.current = game.state.phase
    if (prev === GamePhase.Setup && game.state.phase !== GamePhase.Setup) {
      play(SoundId.GameStart)
    }
  }, [game.code, game.state.phase, play])
```

- [ ] **Step 3: Mount `GameSounds` in `GameView`**

In `src/components/GameView.tsx`:

1. Add an import after line 10 (`import GameOverModal from './Modals/GameOverModal'`):

```tsx
import GameSounds from '../audio/useGameSounds'
```

2. At the top of the returned JSX (inside the outer `<div>`, before `<GameBoard ...>`), add:

```tsx
      <GameSounds state={state} />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS (all suites, including the new audio tests).

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: PASS — may still show the 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx`; no new warnings.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/MultiplayerGame.tsx src/components/GameView.tsx
git commit -m "feat: wire sound provider, room-join chime, game-start jingle, and GameSounds"
```

---

## Manual verification (optional)

1. `npm run dev` — open the setup screen, click around: every button clicks.
2. Create a room → hear the `roomJoin` chime.
3. Add a bot or a second player, start the game → hear the `gameStart` jingle.
4. Roll dice (hold/press the roll button) → `diceRoll` rattle on press, `diceLand` when the result resolves (also heard for opponents/bots).
5. Trigger buy, rent, cards, jail, money in/out, trade, bankruptcy, and the game-over jingle — confirm tone quality and volume (default master gain 0.3). If any sound is unpleasant, adjust its generator in `src/audio/soundEngine.ts` (frequencies/durations/gains) — no other file changes needed.
6. Multiplayer rejoin test: with two browser contexts, leave the tab and rejoin mid-game → no replay of the room's past sounds.