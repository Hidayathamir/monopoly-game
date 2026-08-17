# Sound Effects Design

Date: 2026-08-17

## Problem

The game is currently silent. Every meaningful moment — dice rolls, buying
property, paying rent, drawing cards, jail, bankruptcy, trades, the game
ending — happens without any audio feedback, and pre-game screens (setup,
lobby) are silent too.

The client already has the signal needed to drive sound: the server broadcasts
full `GameState` snapshots whose `state.eventLog` grows one `LogEntry` per
event (`LogEventKey` values like `event.rolled`, `event.bought`,
`event.paidRent`, `event.bankruptcy`). Because every room member receives the
same snapshots, watching the event log lets a client hear **all** players'
actions, not just its own.

## Goals

- Synthesized UI/event sounds via the Web Audio API — no audio asset files, no
  new runtime dependencies, no download/load concerns.
- A sound for every meaningful gameplay event, driven by new
  `eventLog` entries so all players' actions are heard.
- Sound for the pre-game flow: room-join chime, game-start jingle, and a soft
  click on every button.
- Always-on (no mute/volume UI) with a sane default volume; each sound has its
  own gain so nothing is jarring.
- Rejoin-safe: rejoining a mid-game room must not replay the room's past sound
  history.
- Zero behavior change to the game rules; a sound failure must never break or
  delay gameplay.

## Non-Goals

- No background/ambient music.
- No volume/mute controls or settings UI.
- No audio asset files (mp3/ogg/wav) this round; if the synthesized tones are
  not good enough after a test, a follow-up can swap the sound engine's
  generators for real files behind the same `playSound(id)` interface.
- No changes to the client/server contract (`src/types/net.ts`), the server,
  or the reducer — `eventLog` already encodes every event.
- No sounds for `Turn`, `PlayerOffline`, `PlayerBack`, `ReconnectWait`,
  `OwnerInJail`, `MonopolyRent`, `MustCircleBoard` — too noisy or unhelpful.
- No mobile/haptics work.

## Design

### 1. Sound engine — `src/audio/soundEngine.ts`

A module (not a React component) holding a lazy singleton:

- **AudioContext:** created lazily on first `playSound` call, feature-detected
  (`window.AudioContext ?? window.webkitAudioContext`); if unavailable,
  `playSound` no-ops. `unlockAudio()` resumes the context (autoplay policy) and
  is invoked from a one-time document `pointerdown` listener.
- **`SoundId`:** enum-like `const` object + derived union (repo convention, no
  TS enums), e.g.:
  `click, diceRoll, diceLand, buy, build, card, moneyGain, moneyLoss, jail,
  bankruptcy, win, trade, roomJoin, gameStart`.
- **`playSound(id)`:** looks up the sound's generator and runs it. Each
  generator builds oscillator(s) (+ gain envelope) through a shared `ctx`
  and `masterGain` (~0.3). Generators are small pure functions taking `ctx`
  and `destination`, so the AudioContext can be injected for tests.
- **Synthesis palette** (short, distinct, non-jarring):
  - `click` — single short high blip (~1 kHz, 30 ms)
  - `diceRoll` — brief noise/ratcheting burst (~250 ms)
  - `diceLand` — short low thud
  - `buy` — two-tone cash-register blip
  - `build` — rising knock/plop
  - `card` — noise sweep "swish"
  - `moneyGain` — rising two/three-note arpeggio
  - `moneyLoss` — descending two-note tone
  - `jail` — low buzz
  - `bankruptcy` — descending sad tones
  - `win` — ascending 3–4-note jingle
  - `trade` — soft two-note ping
  - `roomJoin` — two-note chime
  - `gameStart` — short 3-note jingle

### 2. Event-log → sound mapping — `src/audio/soundMap.ts`

A pure function `soundForLogKey(key: LogEventKey): SoundId | null` with an
exhaustive mapping; keys not mapped (or mapped to `null`) are silent. The
groupings (subject to ear-test tuning in the plan):

- Dice land: `Rolled`, `RolledAimed`, `DoublesAgain`, `JailFailed` → `diceLand`
- Money gain: `PassedGo`, `CardCollect`, `CardCollectPlayers`,
  `FreeParkingJackpot` → `moneyGain`
- Money loss: `PaidRent`, `CardPay`, `IncomeTax`, `LuxuryTax`,
  `CardStreetRepairs`, `SoldHouse`, `SoldToBank`, `BankruptcyTransfer` →
  `moneyLoss`
- Buy/build: `Bought` → `buy`; `BuiltHouse`, `BuiltHotel` → `build`
- Cards: `MovedForward`, `MovedBack`, `GotJailCard` → `card`
- Jail: `ToJail`, `CardToJail` → `jail`; `PaidJailFine`, `UsedJailCard`,
  `JailBreakDoubles` → `moneyGain`
- Trade: `TradeProposed`, `TradeAccepted` → `trade`
- End: `Bankruptcy` → `bankruptcy`; `BankruptcyWin` → `win`
- Start: `GameStarted` → `gameStart`
- Silent: `Turn`, `PlayerOffline`, `PlayerBack`, `ReconnectWait`,
  `MustCircleBoard`, `OwnerInJail`, `MonopolyRent`, plus anything unmapped

This file is the single place that knows which event makes which sound, and it
is fully unit-testable without an AudioContext.

### 3. Game-sound hook — `src/audio/useGameSounds.ts`

`useGameSounds(state: GameState)` (implemented as a component
`<GameSounds state={state}/>` rendered in `GameView`):

- Keeps a `useRef` of the last-seen `eventLog.length`, initialized to the full
  length on first render (mount/baseline).
- On each render where `eventLog` grew, calls `soundForLogKey` for every new
  entry in order and `playSound`s each non-null result.
- Because `eventLog` entries are appended in chronological order and the ref
  baseline resets on mount, a rejoin mid-game (fresh mount, full log) plays
  nothing.
- Guards: if the log ever shrank (shouldn't happen), re-baseline instead of
  playing.

### 4. UI/imperative sounds — `SoundContext`

- `src/audio/SoundContext.tsx` exposes `useSound()` returning a stable
  `play(id)` wrapper; provider wraps the app in `App.tsx`.
- **Button click:** the shared `Button` component plays `click` on activation
  by default, with a `sound?: SoundId | null` prop (`null` = silent) for
  buttons whose own action sound replaces the click (e.g. the roll button
  plays `diceRoll` instead of `click`). Raw `<button>`s that matter (trade
  inbox toggle, event-log expand/collapse) get the click via `useSound()`.
- **Room-join chime:** `play('roomJoin')` once when the client receives the
  `Welcome` message (handled in `MultiplayerGame`/the sound wiring, not the
  reducer).
- **Dice roll start:** the roll button plays `diceRoll` on press; the
  corresponding "dice land" sound comes from the `Rolled`/`RolledAimed` log
  entries so everyone hears each roll resolve.

### 5. Error handling

- AudioContext unavailable or suspended → `playSound` silently no-ops; no
  throw path from any sound call.
- Autoplay: context starts suspended; the first `pointerdown` unlocks it.
  Sounds attempted before any gesture are skipped silently — the first click
  unlocks everything thereafter.
- `unlockAudio` uses `{ once: true }` on the listener.

## Files

- New: `src/audio/soundEngine.ts` (engine + `SoundId` const + generators)
- New: `src/audio/soundMap.ts` (`soundForLogKey`)
- New: `src/audio/useGameSounds.ts` (hook + `GameSounds` component)
- New: `src/audio/SoundContext.tsx` (provider + `useSound`)
- Modify: `src/components/GameView.tsx` (render `<GameSounds state={state}/>`)
- Modify: `src/components/Button.tsx` (default click sound + `sound` prop)
- Modify: `src/components/DiceRoller.tsx` (roll button → `diceRoll`, not click)
- Modify: `src/components/EventLog.tsx` + `src/components/Sidebar.tsx`
  (click sound on raw buttons)
- Modify: `src/components/MultiplayerGame.tsx` (room-join chime on Welcome)
- Modify: `src/App.tsx` (wrap with `SoundProvider`)

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit` — new tests:
  - `soundMap` exhaustive over `LogEventKey` union
  - `useGameSounds` (mock `playSound`): new entries play in order; no replay on
    remount/rejoin; log shrink re-baselines
  - `soundEngine` (injected fake AudioContext/oscillator): each `SoundId`
    builds expected nodes; missing context no-ops
- `npm run build` (multiplayer e2e serves `dist/`)
- Manual ear test: `npm run dev` (or `npm run live`) — confirm tone quality and
  volume; if unsatisfied, revisit with real audio files (Non-Goals note).