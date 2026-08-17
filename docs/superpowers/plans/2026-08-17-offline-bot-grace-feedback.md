# Offline Bot Reconnect-Grace Feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten the offline-player reconnect grace to 3s, make it apply only once per disconnect, and give the other players a live countdown + event-log notice while the bot waits.

**Architecture:** The server drives bot turns. A new transient `GameState.reconnectGrace` field (set by the server, rendered by the client) carries the countdown deadline. A per-slot `gracePending` flag (server-only) replaces the old `drivenPlayerId` so the grace fires once per disconnect instead of every turn. A new `SetReconnectGrace` reducer action sets/clears the field and emits the `event.reconnectWait` log entry.

**Tech Stack:** React 19 + TypeScript, Vite 8, Node `ws` server, `tsx`, vitest, Playwright.

## Global Constraints

- No TS `enum`; use `const` objects + derived union types (`erasableSyntaxOnly: true`).
- `verbatimModuleSyntax: true` → type-only imports must use `import type`.
- `noUnusedLocals`/`noUnusedParameters` are on.
- New wire value `SET_RECONNECT_GRACE` is part of the client/server contract — add it, never rename existing values.
- Semicolons: `src/types/*`, `src/logic/*`, `src/data/*` use them; `server/*`, `src/components/*`, `src/hooks/*` omit them. Match the file you edit.
- i18n: every new UI string must exist in both `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys, `keySeparator: false`).
- Verify with `npm run typecheck`, `npm run test:unit`, `npm run lint`.
- Server tests use injected `rng` + `vi.useFakeTimers()`; `Date.now()` is faked by `vi.useFakeTimers()`.

---

## File Structure

- `src/types/game.ts` — shared types: add `ReconnectGrace`, `GameActionType.SetReconnectGrace`, `GameAction` union entry, `GameState.reconnectGrace`.
- `src/logic/gameReducer.ts` — single source of truth: `createInitialState`, new `SetReconnectGrace` case, `SetBotControl` clears grace.
- `server/gameServer.ts` — authoritative driver: `BOT_GRACE_MS`, `Slot.gracePending`, drop `drivenPlayerId`, `driveBots` grace scheduling, `clearReconnectGrace`, `handleAction` guard.
- `src/components/TurnHeader.tsx` — live countdown status.
- `src/i18n/locales/{en,id}/translation.json` — `event.reconnectWait`, `turn.reconnectWait`.
- Tests: `server/__tests__/gameServer.test.ts`, `src/logic/__tests__/gameReducer.test.ts`, `src/components/__tests__/TurnHeader.test.tsx`, plus `reconnectGrace: null` in three full-literal test helpers.

---

### Task 1: Shared types

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/logic/__tests__/cards.test.ts:7-31`
- Modify: `src/logic/__tests__/bot.test.ts:28-49`
- Modify: `src/components/__tests__/TurnHeader.test.tsx:8-34`
- Modify: `src/logic/gameReducer.ts:13-33` (`createInitialState`)

**Interfaces:**
- Produces: `export type ReconnectGrace = { playerId: number; until: number }`; `GameState.reconnectGrace: ReconnectGrace | null`; `GameActionType.SetReconnectGrace = 'SET_RECONNECT_GRACE'`; `GameAction` union entry `{ type: typeof GameActionType.SetReconnectGrace; playerId: number; until: number | null }`; `createInitialState()` returns `reconnectGrace: null`.

- [ ] **Step 1: Add the `ReconnectGrace` type**

In `src/types/game.ts`, after the `LogEntry` type (line 125), add:

```ts
export type ReconnectGrace = { playerId: number; until: number };
```

- [ ] **Step 2: Add the `SetReconnectGrace` action constant**

In `src/types/game.ts`, in the `GameActionType` const object (after `SetBotControl: 'SET_BOT_CONTROL',` on line 87), add a new line:

```ts
  SetReconnectGrace: 'SET_RECONNECT_GRACE',
```

- [ ] **Step 3: Add the `GameState.reconnectGrace` field**

In `src/types/game.ts`, in the `GameState` type, after `justBoughtSpaceId: number | null;` (line 150), add:

```ts
  reconnectGrace: ReconnectGrace | null;
```

- [ ] **Step 4: Add the `GameAction` union entry**

In `src/types/game.ts`, at the end of the `GameAction` union (after the `SetBotControl` line, line 202), change the trailing `;` to a new union member:

```ts
  | { type: typeof GameActionType.SetBotControl; playerId: number; controlled: boolean }
  | { type: typeof GameActionType.SetReconnectGrace; playerId: number; until: number | null };
```

- [ ] **Step 5: Fix the three full-literal test helpers**

Each of these test files builds a `GameState` object literal directly (they have a `tradesEnabled:` line), so they must gain the new required field. Add `reconnectGrace: null,` immediately before the `tradesEnabled:` line in each:

1. `src/logic/__tests__/cards.test.ts` — before `tradesEnabled: false,` (line 28).
2. `src/logic/__tests__/bot.test.ts` — before `tradesEnabled: false,` (line 46).
3. `src/components/__tests__/TurnHeader.test.tsx` — before `tradesEnabled: false,` (line 31).

Example (`cards.test.ts`):

```ts
    nextTradeId: 0,
    reconnectGrace: null,
    tradesEnabled: false,
```

- [ ] **Step 6: Add `reconnectGrace: null` to `createInitialState`**

In `src/logic/gameReducer.ts`, in `createInitialState`, after `justBoughtSpaceId: null,` (line 28), add:

```ts
    reconnectGrace: null,
```

(This keeps `createInitialState` returning a valid `GameState` now that the field is required — it must land here in Task 1, not in Task 2.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 8: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/logic/__tests__/cards.test.ts src/logic/__tests__/bot.test.ts src/components/__tests__/TurnHeader.test.tsx
git commit -m "chore: add ReconnectGrace + SetReconnectGrace to shared game state"
```

---

### Task 2: Reducer

**Files:**
- Modify: `src/logic/gameReducer.ts:13-33` (`createInitialState`), `:773-784` (`SetBotControl` case)
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `GameActionType.SetReconnectGrace`, `GameState.reconnectGrace`, `ReconnectGrace` (Task 1).
- Produces: `gameReducer` handles `SetReconnectGrace` (set with `event.reconnectWait` log; clear with no log); `createInitialState()` returns `reconnectGrace: null`; `SetBotControl(controlled:false)` clears a matching grace.

- [ ] **Step 1: Write the failing reducer tests**

In `src/logic/__tests__/gameReducer.test.ts`, inside the `describe('SET_BOT_CONTROL', ...)` block is fine to leave as-is; add a new top-level `describe` block after it (after line 144). Insert:

```ts
  describe('SET_RECONNECT_GRACE', () => {
    it('sets the grace and logs a reconnect notice', () => {
      const state = gameReducer(makeStartedState(2), {
        type: GameActionType.SetReconnectGrace,
        playerId: 0,
        until: 123456789,
      });
      expect(state.reconnectGrace).toEqual({ playerId: 0, until: 123456789 });
      expect(state.eventLog.at(-1)).toEqual({ key: 'event.reconnectWait', params: { name: 'Alice' } });
    });

    it('clears the grace without logging', () => {
      let state = gameReducer(makeStartedState(2), { type: GameActionType.SetReconnectGrace, playerId: 0, until: 123 });
      state = gameReducer(state, { type: GameActionType.SetReconnectGrace, playerId: 0, until: null });
      expect(state.reconnectGrace).toBeNull();
      expect(state.eventLog.filter((e) => e.key === 'event.reconnectWait')).toHaveLength(1);
    });

    it('is idempotent for the same player', () => {
      let state = gameReducer(makeStartedState(2), { type: GameActionType.SetReconnectGrace, playerId: 0, until: 123 });
      state = gameReducer(state, { type: GameActionType.SetReconnectGrace, playerId: 0, until: 456 });
      expect(state.reconnectGrace).toEqual({ playerId: 0, until: 123 });
      expect(state.eventLog.filter((e) => e.key === 'event.reconnectWait')).toHaveLength(1);
    });

    it('clears grace when the player reconnects', () => {
      let state = gameReducer(makeStartedState(2), { type: GameActionType.SetBotControl, playerId: 0, controlled: true });
      state = gameReducer(state, { type: GameActionType.SetReconnectGrace, playerId: 0, until: 123 });
      state = gameReducer(state, { type: GameActionType.SetBotControl, playerId: 0, controlled: false });
      expect(state.reconnectGrace).toBeNull();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — the `SetReconnectGrace` case is not implemented, so `state.reconnectGrace` stays `null` and the `event.reconnectWait` log is never appended.

- [ ] **Step 3: Add the `SetReconnectGrace` reducer case**

In `src/logic/gameReducer.ts`, immediately before `case GameActionType.SetBotControl:` (line 773), insert:

```ts
    case GameActionType.SetReconnectGrace: {
      if (action.until == null) {
        if (!state.reconnectGrace) return state;
        return { ...state, reconnectGrace: null };
      }
      if (state.reconnectGrace?.playerId === action.playerId) return state;
      const player = state.players[action.playerId];
      return {
        ...state,
        reconnectGrace: { playerId: action.playerId, until: action.until },
        eventLog: player ? [...state.eventLog, { key: 'event.reconnectWait', params: { name: player.name } }] : state.eventLog,
      };
    }
```

- [ ] **Step 4: Clear grace on reconnect in `SetBotControl`**

In `src/logic/gameReducer.ts`, in the `SetBotControl` case (lines 779-783), add a `reconnectGrace` key to the returned object so it reads:

```ts
      return {
        ...state,
        players: newPlayers,
        reconnectGrace: !action.controlled && state.reconnectGrace?.playerId === action.playerId ? null : state.reconnectGrace,
        eventLog: [...state.eventLog, { key: logKey, params: { name: target.name } }],
      };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/logic/gameReducer.ts src/logic/__tests__/gameReducer.test.ts
git commit -m "feat: add SetReconnectGrace reducer case with reconnectWait log"
```

---

### Task 3: Server

**Files:**
- Modify: `server/gameServer.ts`
- Test: `server/__tests__/gameServer.test.ts`

**Interfaces:**
- Consumes: `GameActionType.SetReconnectGrace`, `GameState.reconnectGrace` (Tasks 1-2).
- Produces: `BOT_GRACE_MS = 3_000`; `Slot.gracePending: boolean`; `driveBots` schedules a grace (dispatching `SetReconnectGrace` with `until`) only on the first turn after disconnect; private `clearReconnectGrace(playerId)`; `handleAction` ignores client `SetReconnectGrace`.

- [ ] **Step 1: Update `Slot` and the constants/constructor**

In `server/gameServer.ts`:

1. Change `const BOT_GRACE_MS = 30_000` (line 27) to:
```ts
const BOT_GRACE_MS = 3_000
```
2. Add `gracePending: boolean` to the `Slot` interface (after `isBot: boolean`, line 21):
```ts
  gracePending: boolean
```
3. Add `gracePending: false,` to the constructor's slot initializer (lines 31-36), after `isBot: false,`.
4. Delete the `drivenPlayerId` field declaration (line 42).

- [ ] **Step 2: Set `gracePending` at every slot construction / lifecycle point**

Add `gracePending: false` to every remaining `Slot` object literal, and set `gracePending` on connect/disconnect:

1. `join()` new-slot branch (line 115): `this.slots[index] = { clientId, name: trimmed, connected: true, isBot: false }` → add `gracePending: false`.
2. `join()` reconnect branch (after `disconnected.connected = true`, line 78): add `disconnected.gracePending = false`.
3. `addBot()` (line 144): add `gracePending: false` to the literal.
4. `removeBot()` (line 159): add `gracePending: false` to the literal.
5. `leave()` setup branch (line 192) and its bot-clear loop (lines 198-200): add `gracePending: false` to both literals.
6. `leave()` mid-game `else` branch (lines 202-205), after `this.slots[index].clientId = null`, add `this.slots[index].gracePending = true`.
7. `disconnect()` (lines 294-308), after `slot.clientId = null`, add `slot.gracePending = true`.

- [ ] **Step 3: Rewrite `driveBots` to use `gracePending`**

Replace the `driveBots` body's `isFresh`/`drivenPlayerId` logic and the timer callback. The full new `driveBots` (lines 357-405) plus a new `clearReconnectGrace` helper:

```ts
  private driveBots(): void {
    if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) {
      this.clearBotTimer()
      return
    }
    const currentPlayer = this.state.currentPlayer
    const slot = this.slots[currentPlayer]
    if (!slot) {
      this.clearBotTimer()
      this.botSteps = 0
      return
    }
    const botControlled = this.state.players[currentPlayer]?.botControlled === true
    const isDriveable = slot.isBot || (!slot.connected && botControlled)
    if (!isDriveable) {
      this.clearBotTimer()
      this.botSteps = 0
      return
    }
    const action = decideBotAction(this.state)
    if (!action) {
      this.clearBotTimer()
      this.botSteps = 0
      return
    }
    if (this.botSteps >= 100) return
    if (this.botTimer !== null) return
    this.botSteps++
    const isRealBot = slot.isBot
    const isGraceTurn = !isRealBot && slot.gracePending
    if (isGraceTurn) slot.gracePending = false
    const delay = isGraceTurn ? BOT_GRACE_MS : BOT_STEP_MS

    this.botTimer = setTimeout(() => {
      this.botTimer = null
      if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
      const current = this.slots[currentPlayer]
      const stillBotControlled = this.state.players[currentPlayer]?.botControlled === true
      const stillDriveable =
        current?.isBot === true || (current !== undefined && !current.connected && stillBotControlled)
      if (!current || !stillDriveable) return
      const actionNow = decideBotAction(this.state)
      if (!actionNow) {
        this.clearReconnectGrace(currentPlayer)
        return
      }
      if (actionNow.type === GameActionType.RollDice) this.startRoll()
      else this.dispatch(actionNow)
      this.clearReconnectGrace(currentPlayer)
    }, delay)

    if (isGraceTurn) {
      this.dispatch({
        type: GameActionType.SetReconnectGrace,
        playerId: currentPlayer,
        until: Date.now() + BOT_GRACE_MS,
      })
    }
  }

  private clearReconnectGrace(playerId: number): void {
    if (this.state.reconnectGrace?.playerId === playerId) {
      this.dispatch({ type: GameActionType.SetReconnectGrace, playerId, until: null })
    }
  }
```

(Remove the two old `this.drivenPlayerId = null` resets from the `!slot` and `!isDriveable` branches — the replacement above already omits them.)

- [ ] **Step 4: Ignore client-sent `SetReconnectGrace` in `handleAction`**

In `server/gameServer.ts`, in `handleAction` (line 253), change:

```ts
    if (action.type === GameActionType.SetBotControl) return
```

to:

```ts
    if (action.type === GameActionType.SetBotControl) return
    if (action.type === GameActionType.SetReconnectGrace) return
```

- [ ] **Step 5: Update the three existing grace tests**

In `server/__tests__/gameServer.test.ts`, replace the three grace tests (lines 213-295) with the 3s versions below.

Test 1 (lines 213-245) becomes:

```ts
  it('hands an offline player to the bot after a 3s grace period', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)

    server.leave('c0')
    expect(server.getState().currentPlayer).toBe(0) // no auto-skip anymore
    expect(server.getState().players[0].botControlled).toBe(true)
    expect(server.getState().eventLog.some((e) => e.key === 'event.playerOffline')).toBe(true)
    expect(server.getState().reconnectGrace?.playerId).toBe(0)

    vi.advanceTimersByTime(2_000)
    expect(server.getState().phase).toBe(GamePhase.Waiting) // still inside the grace window
    expect(server.getState().reconnectGrace?.playerId).toBe(0)

    vi.advanceTimersByTime(1_000) // grace elapsed → bot rolls
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    expect(server.getState().reconnectGrace).toBeNull()

    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([1, 4])
    const roll = server.getState().eventLog.filter((e) => e.key === 'event.rolled').at(-1)
    expect(roll?.params?.bot).toBe(true)

    vi.advanceTimersByTime(500 + 5 * 150) // RESOLVE_SPACE (space 5 unowned, not passed Go → Waiting)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(700) // next bot step → END_TURN
    expect(server.getState().currentPlayer).toBe(1)
    vi.useRealTimers()
  })
```

Test 2 (lines 247-267) becomes:

```ts
  it('reconnect within the grace period hands control back to the human', () => {
    vi.useFakeTimers()
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)

    server.leave('c0')
    expect(server.getState().players[0].botControlled).toBe(true)
    expect(server.getState().reconnectGrace?.playerId).toBe(0)

    server.join('c9', 'Alice') // rejoins within the 3s grace
    expect(server.getState().players[0].botControlled).toBe(false)
    expect(server.getState().currentPlayer).toBe(0)
    expect(server.getState().eventLog.some((e) => e.key === 'event.playerBack')).toBe(true)
    expect(server.getState().reconnectGrace).toBeNull()

    vi.advanceTimersByTime(3_000) // stale grace timer fires but the slot is connected → no roll
    expect(server.getState().phase).toBe(GamePhase.Waiting)
    expect(server.getState().dice).toBeNull()
    vi.useRealTimers()
  })
```

Test 3 (lines 269-295) becomes:

```ts
  it('does not let a concurrent action cancel the offline player grace period', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)

    server.leave('c0') // Alice offline; grace timer scheduled (3s)
    expect(server.getState().players[0].botControlled).toBe(true)

    // A different player disconnects and reconnects during Alice's grace window — each
    // dispatches an action (SetBotControl), which previously rescheduled the bot to 700ms.
    server.disconnect('c1')
    server.join('c9', 'Bob')
    expect(server.getState().players[1].botControlled).toBe(false)

    vi.advanceTimersByTime(700) // the old buggy behavior would roll here
    expect(server.getState().phase).toBe(GamePhase.Waiting) // still inside the grace window
    expect(server.getState().dice).toBeNull()

    vi.advanceTimersByTime(2_300) // grace elapsed → bot rolls
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    vi.useRealTimers()
  })
```

- [ ] **Step 6: Add new server tests**

Add the following two tests after the `ignores SET_BOT_CONTROL sent by a client` test (after line 311):

```ts
  it('applies the reconnect grace only on the first turn after a disconnect', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.leave('c0') // Alice offline → grace pending
    expect(server.getState().reconnectGrace?.playerId).toBe(0)
    expect(server.getState().eventLog.filter((e) => e.key === 'event.reconnectWait')).toHaveLength(1)

    // First turn: grace then the bot plays it out.
    vi.advanceTimersByTime(3_000) // grace elapsed → bot rolls
    vi.advanceTimersByTime(500) // DICE_ANIMATED
    vi.advanceTimersByTime(500 + 5 * 150) // RESOLVE_SPACE (space 5 → must circle → Waiting)
    vi.advanceTimersByTime(700) // END_TURN → Bob's turn
    expect(server.getState().currentPlayer).toBe(1)
    expect(server.getState().reconnectGrace).toBeNull()

    // Bob ends his turn without rolling.
    server.handleAction('c1', { type: 'END_TURN' })
    expect(server.getState().currentPlayer).toBe(0)

    // Second turn: no grace — the bot steps at 700ms.
    expect(server.getState().reconnectGrace).toBeNull()
    expect(server.getState().eventLog.filter((e) => e.key === 'event.reconnectWait')).toHaveLength(1)
    vi.advanceTimersByTime(700) // bot rolls immediately (no 3s grace)
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    vi.useRealTimers()
  })

  it('ignores SET_RECONNECT_GRACE sent by a client', () => {
    vi.useFakeTimers()
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.handleAction('c0', { type: 'SET_RECONNECT_GRACE', playerId: 0, until: 999999999 })
    expect(server.getState().reconnectGrace).toBeNull()
    vi.useRealTimers()
  })
```

- [ ] **Step 7: Run the server tests**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts
git commit -m "feat: 3s reconnect grace applied once per disconnect"
```

---

### Task 4: i18n + client countdown

**Files:**
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`
- Modify: `src/components/TurnHeader.tsx`
- Test: `src/components/__tests__/TurnHeader.test.tsx`

**Interfaces:**
- Consumes: `GameState.reconnectGrace` (Task 1).
- Produces: `TurnHeader` renders `turn.reconnectWait` (with a `seconds` param) when the current player is in grace; new i18n keys `event.reconnectWait`, `turn.reconnectWait`.

- [ ] **Step 1: Add the i18n keys (en)**

In `src/i18n/locales/en/translation.json`, after `"event.playerBack"` (line 117), add:

```json
  "event.reconnectWait": "Waiting for {{name}} to reconnect…",
```

And after `"turn.botControl"` (line 160), add:

```json
  "turn.reconnectWait": "Waiting for {{name}} to reconnect… {{seconds}}s",
```

- [ ] **Step 2: Add the i18n keys (id)**

In `src/i18n/locales/id/translation.json`, after `"event.playerBack"` (line 117), add:

```json
  "event.reconnectWait": "Menunggu {{name}} untuk terhubung kembali…",
```

And after `"turn.botControl"` (line 160), add:

```json
  "turn.reconnectWait": "Menunggu {{name}} untuk terhubung kembali… {{seconds}}s",
```

- [ ] **Step 3: Write the failing component test**

In `src/components/__tests__/TurnHeader.test.tsx`, add after the existing `shows a bot-playing status` test (line 58):

```tsx
  it('shows a reconnect countdown when the current player is in grace', () => {
    const base = makeState()
    const state: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, botControlled: true })),
      reconnectGrace: { playerId: 0, until: Date.now() + 3000 },
    }
    renderWithProviders(<TurnHeader state={state} />)
    expect(screen.getByText(/Waiting for Alpha to reconnect/)).toBeTruthy()
  })
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/TurnHeader.test.tsx`
Expected: FAIL — the grace branch is not rendered (still shows `Alpha — offline, a bot is playing`).

- [ ] **Step 5: Implement the countdown in `TurnHeader`**

Replace `src/components/TurnHeader.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { PendingActionType, type GameState } from '../types/game'

interface Props {
  state: GameState
}

function statusText(state: GameState, t: TFunction, now: number): string {
  const p = state.players[state.currentPlayer]
  const pending = state.pendingAction
  const grace = state.reconnectGrace
  if (grace && grace.playerId === p.id) {
    const seconds = Math.max(0, Math.ceil((grace.until - now) / 1000))
    return t('turn.reconnectWait', { name: p.name, seconds })
  }
  if (p.botControlled) return t('turn.botControl', { name: p.name })
  if (pending?.type === PendingActionType.BuyProperty) return t('turn.buyOffer')
  if (pending?.type === PendingActionType.PayRent) return t('turn.payRent')
  if (pending?.type === PendingActionType.Bankruptcy) return t('turn.notEnough')
  if (pending?.type === PendingActionType.DrawCard) return t('turn.drawCard')
  if (pending?.type === PendingActionType.CardEffect) return t('turn.cardEffect')
  if (p.inJail) return t('turn.inJail')
  if (state.dice) return t('turn.dice', { a: state.dice[0], b: state.dice[1], total: state.dice[0] + state.dice[1] })
  return t('turn.roll')
}

export default function TurnHeader({ state }: Props) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const graceActive = state.reconnectGrace != null

  useEffect(() => {
    if (!graceActive) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [graceActive])

  const player = state.players[state.currentPlayer]
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-[0.25em] text-muted">{t('turn.label')}</div>
      <div className="text-2xl font-bold text-gold leading-tight">{player.name}</div>
      <div className="text-sm text-muted mt-0.5">{statusText(state, t, now)}</div>
    </div>
  )
}
```

- [ ] **Step 6: Run the component test**

Run: `npx vitest run src/components/__tests__/TurnHeader.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm run test:unit && npm run lint`
Expected: all PASS (lint may still show the 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx`; no new warnings).

- [ ] **Step 8: Commit**

```bash
git add src/components/TurnHeader.tsx src/components/__tests__/TurnHeader.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: show reconnect countdown and log notice during bot grace"
```

---

## Manual verification (optional, multiplayer)

1. `npm run build` (required for server-backed multiplayer — `dist/` is gitignored).
2. `TRADES_ENABLED=true npm run server`.
3. Two browser contexts join the same room; one closes the tab mid-game.
4. On the offline player's turn, confirm the other player sees the `event.reconnectWait` log entry and a ~3s `Waiting for … to reconnect…` countdown, then the bot acts with `(bot)` log labels.
5. Confirm the 3s wait does not repeat on the offline player's next turn.
