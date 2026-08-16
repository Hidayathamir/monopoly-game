# Exit, Reconnect, Fair Start, Jail Cards & Bankruptcy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven play-tested bugs: single-player exit, multiplayer auto-rejoin on refresh, Get Out of Jail Free cards as a count, randomized turn order with the player list following it, bankruptcy turn-flow bugs (leftover dice / wrong next player), and bankrupt-asset liquidation to the creditor.

**Architecture:** The shared reducer in `src/logic/gameReducer.ts` is the single source of truth and runs both client-side (local mode) and server-side (authoritative multiplayer). All rule changes go there. UI copy is i18n-driven (`src/i18n/locales/{en,id}/translation.json`, flat keys, `keySeparator: false`). Session persistence uses `localStorage`.

**Tech Stack:** React 19 + TypeScript + Vite 8; Node `ws` server via `tsx`; Vitest (unit, `src/test/setup.ts`); Playwright e2e. Commands: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, `npm run test:e2e`.

## Global Constraints

- No TS `enum`s — `erasableSyntaxOnly: true`. Use `const` objects + derived union types. Type-only imports use `import type`.
- `noUnusedLocals` / `noUnusedParameters` are on — remove dead code.
- Semicolon style matches the file being edited (`src/logic/*`, `src/data/*`, `src/types/*` use semicolons; components/hooks/net/server omit them).
- Every UI string must exist in BOTH `en` and `id` translation files.
- Wire values in `src/types/net.ts` must never change.
- Bump `STATE_VERSION` in `src/hooks/useGame.ts` whenever the `GameState`/`Player` shape changes incompatibly.
- Run `npm run typecheck && npm run lint && npm run test:unit` after every task.
- `npm run test:e2e` requires `npm run build` first (multiplayer spec serves `dist/`).

---

### Task 1: Get Out of Jail Free cards as a count

Replaces the `Player.hasGetOutOfJailFree: boolean` field with `getOutOfJailFreeCards: number` so holding two cards and using one leaves one. Touches the shared type, both logic modules, the UI, i18n, and all test fixtures (the field rename is a compile-time break everywhere).

**Files:**
- Modify: `src/types/game.ts:100`
- Modify: `src/logic/cards.ts:28-35`
- Modify: `src/logic/gameReducer.ts:47` and `:646-664`
- Modify: `src/logic/bot.ts:37`
- Modify: `src/components/ActionSection.tsx:118`
- Modify: `src/components/PlayerCard.tsx:83` and `:144`
- Modify: `src/hooks/useGame.ts:7` (`STATE_VERSION` 8 → 9)
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`
- Test: `src/logic/__tests__/cards.test.ts`, `src/logic/__tests__/gameReducer.test.ts`, `src/logic/__tests__/bot.test.ts`, `src/components/__tests__/PlayerCard.test.tsx`, `src/components/__tests__/TurnHeader.test.tsx`, `src/hooks/__tests__/useGame.test.ts`

**Interfaces:**
- Consumes: `Player` type from `src/types/game.ts`.
- Produces: `Player.getOutOfJailFreeCards: number`; all production code references `getOutOfJailFreeCards`; `STATE_VERSION = 9`.

- [ ] **Step 1: Update the type and all production references**

`src/types/game.ts` line 100:
```ts
  hasGetOutOfJailFree: boolean;
```
becomes:
```ts
  getOutOfJailFreeCards: number;
```

`src/logic/gameReducer.ts` — in the `StartGame` case, player init (line ~47):
```ts
          hasGetOutOfJailFree: false,
```
becomes:
```ts
          getOutOfJailFreeCards: 0,
```

`src/logic/cards.ts` `GetOutOfJailFree` case (lines 28-35) — increment, not set-true:
```ts
    case CardActionType.GetOutOfJailFree: {
      const newPlayers = [...newState.players];
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        getOutOfJailFreeCards: (newPlayers[state.currentPlayer].getOutOfJailFreeCards ?? 0) + 1,
      };
      return { state: { ...newState, players: newPlayers }, log: [{ key: 'event.gotJailCard', params: { name: player.name, cardId: card.id } }] };
    }
```

`src/logic/gameReducer.ts` `UseGetOutOfJailFree` case (lines 646-664) — guard `> 0`, decrement:
```ts
    case GameActionType.UseGetOutOfJailFree: {
      const player = state.players[state.currentPlayer];
      if (!player.inJail || player.getOutOfJailFreeCards <= 0) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        inJail: false,
        jailTurns: 0,
        getOutOfJailFreeCards: player.getOutOfJailFreeCards - 1,
      };
      const nextPlayer = getNextPlayer({ ...state, currentPlayer: state.currentPlayer });
      return {
        ...state,
        players: newPlayers,
        currentPlayer: nextPlayer,
        dice: null,
        eventLog: [...state.eventLog, { key: 'event.usedJailCard', params: { name: player.name } }, { key: 'event.turn', params: { name: state.players[nextPlayer].name } }],
      };
    }
```

`src/logic/bot.ts` line 37:
```ts
      if (player.hasGetOutOfJailFree) return { type: GameActionType.UseGetOutOfJailFree };
```
becomes:
```ts
      if (player.getOutOfJailFreeCards > 0) return { type: GameActionType.UseGetOutOfJailFree };
```

`src/components/ActionSection.tsx` line 118:
```tsx
          {player.hasGetOutOfJailFree && (
```
becomes:
```tsx
          {player.getOutOfJailFreeCards > 0 && (
```

`src/hooks/useGame.ts` line 7:
```ts
const STATE_VERSION = 8
```
becomes:
```ts
const STATE_VERSION = 9
```

- [ ] **Step 2: Update PlayerCard indicators to show the count**

`src/components/PlayerCard.tsx` line 83 (the 🎴 badge in the name row):
```tsx
          {player.hasGetOutOfJailFree && <span title={t('card.jailFreeTitle')}>🎴</span>}
```
becomes:
```tsx
          {player.getOutOfJailFreeCards > 0 && (
            <span title={player.getOutOfJailFreeCards > 1 ? t('card.jailFreeCount', { count: player.getOutOfJailFreeCards }) : t('card.jailFreeTitle')}>🎴</span>
          )}
```

`src/components/PlayerCard.tsx` lines 144-146 (popup line):
```tsx
      {player.hasGetOutOfJailFree && (
        <div className="text-sm text-gold mb-1.5">{t('card.jailFree')}</div>
      )}
```
becomes:
```tsx
      {player.getOutOfJailFreeCards > 0 && (
        <div className="text-sm text-gold mb-1.5">
          {player.getOutOfJailFreeCards > 1 ? t('card.jailFreeCount', { count: player.getOutOfJailFreeCards }) : t('card.jailFree')}
        </div>
      )}
```

- [ ] **Step 3: Add the i18n key in both locales**

`src/i18n/locales/en/translation.json` — add before the final closing brace:
```json
  "card.jailFreeCount": "Get Out of Jail Free ×{{count}}"
```

`src/i18n/locales/id/translation.json` — add before the final closing brace:
```json
  "card.jailFreeCount": "Kartu Bebas Penjara ×{{count}}"
```

- [ ] **Step 4: Update all test fixtures and add new tests**

`src/logic/__tests__/cards.test.ts` — both player literals (lines 11-12): replace `hasGetOutOfJailFree: false` with `getOutOfJailFreeCards: 0`. Line 106 assertion:
```ts
    expect(result.state.players[0].hasGetOutOfJailFree).toBe(true);
```
becomes:
```ts
    expect(result.state.players[0].getOutOfJailFreeCards).toBe(1);
```
Add a test after it (within the `GetOutOfJailFree` describe block — locate the existing block by the assertion above):
```ts
  it('stacks multiple jail cards as a count', () => {
    let state = makeState();
    const card: Card = { id: 7, type: CardType.Chance, effect: { action: CardActionType.GetOutOfJailFree } };
    state = resolveCardEffect(state, card).state;
    state = resolveCardEffect(state, card).state;
    expect(state.players[0].getOutOfJailFreeCards).toBe(2);
  });
```

`src/logic/__tests__/bot.test.ts` — `makePlayer` line 21: replace `hasGetOutOfJailFree: false` with `getOutOfJailFreeCards: 0`. Line 70:
```ts
    const state = makeState({}, makePlayer({ inJail: true, hasGetOutOfJailFree: true }));
```
becomes:
```ts
    const state = makeState({}, makePlayer({ inJail: true, getOutOfJailFreeCards: 1 }));
```

`src/components/__tests__/PlayerCard.test.tsx` line 12: replace `hasGetOutOfJailFree: false` with `getOutOfJailFreeCards: 0`. Line 25 (`hasGetOutOfJailFree: true`): replace with `getOutOfJailFreeCards: 1`.

`src/components/__tests__/TurnHeader.test.tsx` line 14: replace `hasGetOutOfJailFree: false` with `getOutOfJailFreeCards: 0`.

`src/hooks/__tests__/useGame.test.ts` — two stored-state fixtures use `_version: 8` (lines 72 and 117); change both to `_version: 9`.

Add to `src/logic/__tests__/gameReducer.test.ts` (new describe near the existing jail mechanics block, or appended inside the top `describe('gameReducer')`):
```ts
  describe('GET_OUT_OF_JAIL_FREE', () => {
    it('initially has no jail cards', () => {
      const state = makeStartedState();
      expect(state.players[0].getOutOfJailFreeCards).toBe(0);
    });

    it('uses one card and keeps the second', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [
          { ...state.players[0], inJail: true, position: 10, getOutOfJailFreeCards: 2 },
          state.players[1],
        ],
      };
      const s1 = gameReducer(state, { type: GameActionType.UseGetOutOfJailFree });
      expect(s1.players[0].inJail).toBe(false);
      expect(s1.players[0].getOutOfJailFreeCards).toBe(1);
      expect(s1.currentPlayer).toBe(1);
    });

    it('does nothing without a jail card', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [{ ...state.players[0], inJail: true, position: 10, getOutOfJailFreeCards: 0 }, state.players[1]],
      };
      const s1 = gameReducer(state, { type: GameActionType.UseGetOutOfJailFree });
      expect(s1.players[0].inJail).toBe(true);
    });
  });
```

- [ ] **Step 5: Run the full check**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green (the new reducer/cards tests pass; existing suites updated compile and pass).

- [ ] **Step 6: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/logic/cards.ts src/logic/bot.ts src/components/ActionSection.tsx src/components/PlayerCard.tsx src/hooks/useGame.ts src/i18n/locales src/logic/__tests__ src/components/__tests__ src/hooks/__tests__
git commit -m "feat: make Get Out of Jail Free cards a count instead of a boolean"
```

---

### Task 2: Randomized turn order, player list follows it

Adds `GameState.turnOrder: number[]` (player IDs in turn order), shuffles it at game start, makes `getNextPlayer` advance within it, and renders the sidebar player list in `turnOrder` order.

**Files:**
- Modify: `src/types/game.ts` (`GameState`, ~line 134)
- Modify: `src/logic/gameReducer.ts` (`createInitialState`, `StartGame`, `getNextPlayer`)
- Modify: `src/components/PlayerPanel.tsx`
- Test: `src/logic/__tests__/gameReducer.test.ts`, `src/logic/__tests__/bot.test.ts`, `src/logic/__tests__/cards.test.ts`, `src/components/__tests__/TurnHeader.test.tsx`, `src/components/__tests__/PlayerPanel.test.tsx`, `server/__tests__/gameServer.test.ts`, `src/hooks/__tests__/useGame.test.ts`

**Interfaces:**
- Consumes: `GameState` from `src/types/game.ts`; existing `shuffle<T>` helper in `src/logic/gameReducer.ts:8`.
- Produces: `GameState.turnOrder: number[]`; `getNextPlayer(state: GameState): number` advances within `turnOrder`, skipping bankrupt players. `state.currentPlayer` remains a player ID (== array index, since `players[i].id === i`).

- [ ] **Step 1: Write failing tests**

In `src/logic/__tests__/gameReducer.test.ts`, inside `describe('START_GAME')`, replace the `currentPlayer` assertion in "creates players with 1500 each":
```ts
      expect(state.currentPlayer).toBe(0);
```
with:
```ts
      expect(state.turnOrder).toEqual(expect.arrayContaining(state.players.map((_, i) => i)));
      expect(state.currentPlayer).toBe(state.turnOrder[0]);
```
Add to the same describe:
```ts
    it('turnOrder is a permutation of every player id', () => {
      const state = makeStartedState(4);
      expect([...state.turnOrder].sort()).toEqual([0, 1, 2, 3]);
    });

    it('advances through turnOrder and wraps around', () => {
      let state = makeStartedState(3);
      state = { ...state, turnOrder: [2, 0, 1], currentPlayer: 2 };
      state = { ...state, currentPlayer: state.turnOrder[0] };
      const s1 = gameReducer(state, { type: GameActionType.EndTurn });
      expect(s1.currentPlayer).toBe(0);
      state = { ...state, currentPlayer: 1 };
      const s2 = gameReducer(state, { type: GameActionType.EndTurn });
      expect(s2.currentPlayer).toBe(2);
    });

    it('getNextPlayer skips bankrupt players in turn order', () => {
      let state = makeStartedState(3);
      state = {
        ...state,
        turnOrder: [0, 1, 2],
        currentPlayer: 0,
        players: [
          state.players[0],
          { ...state.players[1], bankrupt: true },
          state.players[2],
        ],
      };
      const s1 = gameReducer(state, { type: GameActionType.EndTurn });
      expect(s1.currentPlayer).toBe(2);
    });
```
(In the "advances through turnOrder" test, EndTurn only advances when `state.dice === null`, which holds for the started state — verified by the existing "advances to the next player when dice is null" test.)

In `src/components/__tests__/PlayerPanel.test.tsx`, add:
```tsx
  it('renders players in turn order', () => {
    const s = makeState(1000, 0)
    renderWithProviders(
      <PlayerPanel
        state={{ ...s, turnOrder: [1, 0], currentPlayer: 1 }}
        playerColors={COLORS}
        onProposeTrade={() => {}}
        canTrade
      />,
    )
    const names = screen.getAllByText(/Alice|Bob/).map((el) => el.textContent)
    expect(names.indexOf('Bob')).toBeLessThan(names.indexOf('Alice'))
  })
```
(Import `screen` if not already imported — it is.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts src/components/__tests__/PlayerPanel.test.tsx`
Expected: FAIL — `turnOrder` is not defined on `GameState` (TypeScript error) or the new assertions fail.

- [ ] **Step 3: Implement**

`src/types/game.ts` — add to `GameState` (after `players`, line ~137):
```ts
  turnOrder: number[];
```

`src/logic/gameReducer.ts` `createInitialState` — add after `players: [],`:
```ts
    turnOrder: [],
```

`src/logic/gameReducer.ts` `StartGame` case — replace the `return` block (lines 51-57):
```ts
      return {
        ...state,
        phase: GamePhase.Waiting,
        players,
        currentPlayer: 0,
        eventLog: [{ key: 'event.gameStarted' }],
      };
```
with:
```ts
      const turnOrder = shuffle(Array.from({ length: action.playerCount }, (_, i) => i));
      return {
        ...state,
        phase: GamePhase.Waiting,
        players,
        turnOrder,
        currentPlayer: turnOrder[0],
        eventLog: [{ key: 'event.gameStarted' }],
      };
```

`src/logic/gameReducer.ts` `getNextPlayer` — replace (lines 737-745):
```ts
function getNextPlayer(state: GameState): number {
  let next = (state.currentPlayer + 1) % state.players.length;
  let safety = 0;
  while (state.players[next]?.bankrupt && safety < state.players.length) {
    next = (next + 1) % state.players.length;
    safety++;
  }
  return next;
}
```
with:
```ts
function getNextPlayer(state: GameState): number {
  const order = state.turnOrder.length > 0 ? state.turnOrder : state.players.map((_, i) => i);
  const idx = order.indexOf(state.currentPlayer);
  for (let i = 1; i <= order.length; i++) {
    const id = order[(idx + i) % order.length];
    if (!state.players[id]?.bankrupt) return id;
  }
  return state.currentPlayer;
}
```

`src/components/PlayerPanel.tsx` — replace the `players.map(...)` rendering block (lines 36-53):
```tsx
      <div className="flex flex-wrap gap-2 justify-center">
        {players.map((player) => {
          const isCurrent = player.id === currentPlayer
          return (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrent={isCurrent}
              color={playerColors[player.id]}
              diff={diffs[player.id] ?? null}
              board={board}
              canTrade={canTrade && !player.bankrupt}
              currentPlayerId={currentPlayer}
              onProposeTrade={onProposeTrade}
            />
          )
        })}
      </div>
```
with:
```tsx
      <div className="flex flex-wrap gap-2 justify-center">
        {(state.turnOrder.length > 0 ? state.turnOrder : players.map((p) => p.id)).map((id) => {
          const player = players[id]
          const isCurrent = player.id === currentPlayer
          return (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrent={isCurrent}
              color={playerColors[player.id]}
              diff={diffs[player.id] ?? null}
              board={board}
              canTrade={canTrade && !player.bankrupt}
              currentPlayerId={currentPlayer}
              onProposeTrade={onProposeTrade}
            />
          )
        })}
      </div>
```

- [ ] **Step 4: Make every existing order-dependent test deterministic**

The reducer now shuffles `turnOrder` with `Math.random`, so tests that assumed player 0 goes first must pin the order. `Math.random` stubbed to `0.5` makes the `sort(() => Math.random() - 0.5)` shuffle the identity (stable sort), and the server's dice use the injected `rng`, not `Math.random` — so a stub is safe there.

`src/logic/__tests__/gameReducer.test.ts` — `makeStartedState` (lines 6-9):
```ts
function makeStartedState(playerCount = 2): GameState {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana'];
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount, names });
  return { ...s, turnOrder: s.players.map((_, i) => i), currentPlayer: 0 };
}
```

`server/__tests__/gameServer.test.ts` — in `setup()` (lines 6-17), add the Math.random stub, and restore mocks in `afterEach`:
```ts
function setup(opts?: { rng?: () => number; code?: string }) {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  ...
}
```
and change the existing `afterEach`:
```ts
  afterEach(() => vi.useRealTimers())
```
to:
```ts
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
```

`src/hooks/__tests__/useGame.test.ts` — in the "does not auto-skip a jailed player's turn" test, add a stub at the top of the test body so `StartGame`'s shuffle is identity (Alice first):
```ts
  it('does not auto-skip a jailed player\'s turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    // Drive Alice into jail via triple doubles, then let Bob end his turn so it is Alice's turn again.
```
(The "does not auto-advance after rolling doubles" test already stubs `Math.random` to `0.5` before `startGame()`, so it stays deterministic.)

`src/logic/__tests__/bot.test.ts` — `makeState` needs `turnOrder` (GameState now requires it). Add after `currentPlayer: 0,`:
```ts
    turnOrder: [0],
```
`src/logic/__tests__/cards.test.ts` — `makeState` add after `currentPlayer: 0,`:
```ts
    turnOrder: [0],
```
`src/components/__tests__/TurnHeader.test.tsx` — the GameState literal (around line 21) needs `turnOrder`. Add after the `currentPlayer` line in that literal:
```ts
    turnOrder: [0],
```

- [ ] **Step 5: Run the full check**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/components/PlayerPanel.tsx src/logic/__tests__ src/components/__tests__ src/hooks/__tests__ server/__tests__
git commit -m "feat: randomize starting turn order and render player list in turn order"
```

---

### Task 3: Bankruptcy — reset turn state, advance correctly, liquidate to creditor

Reworks `DeclareBankruptcy` so the next player gets a fresh turn (issues 5+6) and the creditor receives the bankrupt player's net worth in cash (issue 9).

**Files:**
- Modify: `src/logic/gameReducer.ts` (`DeclareBankruptcy` case, import line)
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `getNextPlayer`, `PendingActionType`, `SELL_RATE`, `MORTGAGED_SELL_EXTRA`, `HOUSE_SELL_RATE` (already imported in `gameReducer.ts`), plus new import `getTotalHouseInvestment` from `../data/board`.
- Produces: `DeclareBankruptcy` clears `dice`/`doublesCount`/`lastMoveSteps`, sets `currentPlayer` to the next non-bankrupt player, and pays the landlord (from `pendingAction.spaceId`'s owner) the liquidated value of the bankrupt player's assets.

- [ ] **Step 1: Write failing tests**

In `src/logic/__tests__/gameReducer.test.ts`, replace the `describe('DECLARE_BANKRUPTCY', ...)` block's contents. Add these tests inside it:
```ts
    it('resets dice so the next player gets a fresh turn', () => {
      let state = makeStartedState();
      state = { ...state, dice: [3, 4], doublesCount: 1, lastMoveSteps: 7 };
      const s1 = gameReducer(state, { type: GameActionType.DeclareBankruptcy });
      expect(s1.dice).toBeNull();
      expect(s1.doublesCount).toBe(0);
      expect(s1.lastMoveSteps).toBeNull();
    });

    it('passes the turn to the next player in turn order, not the first active player', () => {
      let state = makeStartedState(3);
      state = { ...state, turnOrder: [0, 1, 2], currentPlayer: 1 };
      const s1 = gameReducer(state, { type: GameActionType.DeclareBankruptcy });
      expect(s1.players[1].bankrupt).toBe(true);
      expect(s1.currentPlayer).toBe(2);
      expect(s1.eventLog).toContainEqual({ key: 'event.turn', params: { name: 'Charlie' } });
    });

    it('pays the creditor the liquidated assets', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 100);
      state = buyProperty(state, 0, 3);
      const creditor = 1;
      const pending = { type: PendingActionType.Bankruptcy, amount: 9999, spaceId: 1 };
      state = {
        ...state,
        board: state.board.map((s) => (s.id === 1 ? { ...s, owner: creditor } : s)),
        players: state.players.map((p, i) => (i === creditor ? { ...p, properties: [1] } : p)),
        pendingAction: pending,
      };
      const s1 = gameReducer(state, { type: GameActionType.DeclareBankruptcy });
      const liquidatedProperty = Math.floor((state.board[3].price ?? 0) * SELL_RATE);
      expect(s1.players[0].bankrupt).toBe(true);
      expect(s1.players[0].money).toBe(0);
      expect(s1.board[3].owner).toBeNull();
      expect(s1.players[1].money).toBe(STARTING_MONEY - 60 + 100 + liquidatedProperty);
      expect(s1.eventLog).toContainEqual({
        key: 'event.bankruptcyTransfer',
        params: { name: 'Alice', creditor: 'Bob', amount: 100 + liquidatedProperty },
      });
    });

    it('winner receives the liquidated cash when only the creditor remains', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 50);
      state = {
        ...state,
        players: [{ ...state.players[0], money: 50 }, state.players[1]],
        pendingAction: { type: PendingActionType.Bankruptcy, amount: 9999, spaceId: 1 },
      };
      const s1 = gameReducer(state, { type: GameActionType.DeclareBankruptcy });
      expect(s1.phase).toBe(GamePhase.GameOver);
      expect(s1.players[1].bankrupt).toBe(false);
      expect(s1.players[1].money).toBe(STARTING_MONEY + 50);
    });
```
Add imports at the top of the file (the test file currently imports `STARTING_MONEY, GO_SALARY` from `'../../data/board'`):
```ts
import { STARTING_MONEY, GO_SALARY, SELL_RATE } from '../../data/board';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — new bankruptcy tests fail (dice not cleared, wrong next player, no transfer).

- [ ] **Step 3: Implement**

`src/logic/gameReducer.ts` — add `getTotalHouseInvestment` to the board import (line 2):
```ts
import { createInitialBoard, getHouseCost, getTotalHouseInvestment, GO_SALARY, JAIL_SPACE, STARTING_MONEY, MAX_JAIL_TURNS, JAIL_FINE, SELL_RATE, MORTGAGED_SELL_EXTRA, HOUSE_SELL_RATE, INCOME_TAX_RATE } from '../data/board';
```

Replace the `DeclareBankruptcy` case (lines 694-730):
```ts
    case GameActionType.DeclareBankruptcy: {
      const player = state.players[state.currentPlayer];
      const pending = state.pendingAction;
      const creditorId =
        pending?.type === PendingActionType.Bankruptcy
          ? state.board[pending.spaceId]?.owner ?? null
          : null;

      let liquidationTotal = Math.max(0, player.money);
      const newBoard = state.board.map((s) => {
        if (s.owner !== player.id) return s;
        if (s.houses > 0) liquidationTotal += Math.floor(getTotalHouseInvestment(s) * HOUSE_SELL_RATE);
        if (s.mortgaged) {
          liquidationTotal += Math.floor((s.price ?? 0) * MORTGAGED_SELL_EXTRA);
        } else {
          liquidationTotal += Math.floor((s.price ?? 0) * SELL_RATE);
        }
        return { ...s, owner: null, houses: 0, mortgaged: false };
      });

      const newPlayers = state.players.map((p, i) => {
        if (i === state.currentPlayer) {
          return { ...p, money: 0, properties: [], bankrupt: true, getOutOfJailFreeCards: 0 };
        }
        if (creditorId !== null && i === creditorId) {
          return { ...p, money: p.money + liquidationTotal };
        }
        return p;
      });

      const activePlayers = newPlayers.filter((p) => !p.bankrupt);
      const baseLog: LogEntry[] = [{ key: 'event.bankruptcy', params: { name: player.name } }];
      const transferLog: LogEntry | null =
        creditorId !== null
          ? { key: 'event.bankruptcyTransfer', params: { name: player.name, creditor: newPlayers[creditorId].name, amount: liquidationTotal } }
          : null;
      const logs: LogEntry[] = [...baseLog, ...(transferLog ? [transferLog] : [])];

      if (activePlayers.length <= 1) {
        return {
          ...state,
          phase: GamePhase.GameOver,
          board: newBoard,
          players: newPlayers,
          pendingAction: null,
          eventLog: [...state.eventLog, ...logs, { key: 'event.bankruptcyWin', params: { name: player.name, winner: activePlayers[0]?.name ?? '' } }],
        };
      }
      const next = getNextPlayer({ ...state, board: newBoard, players: newPlayers });
      return {
        ...state,
        phase: GamePhase.Waiting,
        board: newBoard,
        players: newPlayers,
        currentPlayer: next,
        pendingAction: null,
        dice: null,
        doublesCount: 0,
        lastMoveSteps: null,
        eventLog: [...state.eventLog, ...logs, { key: 'event.turn', params: { name: newPlayers[next].name } }],
      };
    }
```
(`LogEntry` is already imported in `gameReducer.ts`.)

- [ ] **Step 4: Add the i18n key in both locales**

`src/i18n/locales/en/translation.json` — add before the final closing brace:
```json
  "event.bankruptcyTransfer": "{{name}}'s assets were liquidated to {{creditor}} for {{amount}}"
```
`src/i18n/locales/id/translation.json` — add before the final closing brace:
```json
  "event.bankruptcyTransfer": "Aset {{name}} dilikuidasi untuk {{creditor}} sebesar {{amount}}"
```
(`amount` is auto-formatted as money by `resolveLogEntry` in `src/i18n/log.ts`.)

- [ ] **Step 5: Run the full check**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/logic/gameReducer.ts src/i18n/locales src/logic/__tests__
git commit -m "fix: reset dice on bankruptcy, advance in turn order, liquidate assets to creditor"
```

---

### Task 4: Single-player exit button

Wires an exit button into local mode so the player can leave the game and start fresh.

**Files:**
- Modify: `src/components/RoomExit.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/GameView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`
- Test: `src/components/__tests__/RoomExit.test.tsx`

**Interfaces:**
- Consumes: `GameApi.resetGame` (exists), `Sidebar`/`GameView` `onLeave` props (exist).
- Produces: `RoomExit` optional props `labelKey?`, `titleKey?`, `messageKey?`, `confirmKey?` (i18n key strings, defaulting to lobby copy); `Sidebar` and `GameView` forward optional `exitKeys?: { labelKey?: string; titleKey?: string; messageKey?: string; confirmKey?: string }`; `App` passes `onLeave={local.resetGame}` plus the `exit.*` keys to the local `GameView`.

- [ ] **Step 1: Write a failing test**

Add to `src/components/__tests__/RoomExit.test.tsx`:
```tsx
  it('uses the provided copy keys for the exit button and modal', () => {
    renderWithProviders(
      <RoomExit
        onLeave={() => {}}
        variant="icon"
        labelKey="exit.label"
        titleKey="exit.title"
        messageKey="exit.message"
        confirmKey="exit.confirm"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Exit Game' }))
    expect(screen.getByText('Leave the current game? Progress will be lost and a new game will start.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/RoomExit.test.tsx`
Expected: FAIL — the button name is "Leave Room", not "Exit Game".

- [ ] **Step 3: Implement**

`src/components/RoomExit.tsx` — add optional copy-key props and use them. Replace the interface and usages:
```tsx
interface Props {
  onLeave: () => void
  variant?: 'icon' | 'button'
  labelKey?: string
  titleKey?: string
  messageKey?: string
  confirmKey?: string
}

export default function RoomExit({ onLeave, variant = 'button', labelKey, titleKey, messageKey, confirmKey }: Props) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const label = t(labelKey ?? 'lobby.leaveRoom')
  const title = t(titleKey ?? 'confirm.leaveTitle')
  const message = t(messageKey ?? 'confirm.leaveMessage')
  const confirmLabel = t(confirmKey ?? 'confirm.leave')
```
Then replace `t('lobby.leaveRoom')` with `label` (both in the icon `aria-label`/`title` and the button variant), and replace `{t('confirm.leaveTitle')}`, `{t('confirm.leaveMessage')}`, `{t('confirm.leave')}` with `{title}`, `{message}`, `{confirmLabel}` respectively.

`src/components/Sidebar.tsx` — add an optional `exitKeys` prop and forward it. Add to the `Props` interface:
```tsx
  exitKeys?: { labelKey?: string; titleKey?: string; messageKey?: string; confirmKey?: string }
```
Destructure it from `Props` and pass to `RoomExit`:
```tsx
          {onLeave && (
            <div className="absolute top-0 right-0">
              <RoomExit onLeave={onLeave} variant="icon" {...exitKeys} />
            </div>
          )}
```
(`exitKeys` spreads the four keys.)

`src/components/GameView.tsx` — add an optional `exitKeys` prop (same type as Sidebar's), forward it to `Sidebar`:
```tsx
export default function GameView({ game, onLeave, exitKeys }: { game: GameApi; onLeave?: () => void; exitKeys?: { labelKey?: string; titleKey?: string; messageKey?: string; confirmKey?: string } }) {
```
and in the `<Sidebar ... onLeave={onLeave} ...>` JSX add `exitKeys={exitKeys}`.

`src/App.tsx` — local `GameView` (line 59):
```tsx
      <GameView game={local} />
```
becomes:
```tsx
      <GameView
        game={local}
        onLeave={local.resetGame}
        exitKeys={{ labelKey: 'exit.label', titleKey: 'exit.title', messageKey: 'exit.message', confirmKey: 'exit.confirm' }}
      />
```

- [ ] **Step 4: Add the i18n keys in both locales**

`src/i18n/locales/en/translation.json` — add before the final closing brace:
```json
  "exit.label": "Exit Game",
  "exit.title": "Exit Game",
  "exit.message": "Leave the current game? Progress will be lost and a new game will start.",
  "exit.confirm": "Exit"
```
`src/i18n/locales/id/translation.json` — add before the final closing brace:
```json
  "exit.label": "Keluar Permainan",
  "exit.title": "Keluar Permainan",
  "exit.message": "Keluar dari permainan saat ini? Progres akan hilang dan permainan baru akan dimulai.",
  "exit.confirm": "Keluar"
```

- [ ] **Step 5: Run the full check**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/RoomExit.tsx src/components/Sidebar.tsx src/components/GameView.tsx src/App.tsx src/i18n/locales src/components/__tests__
git commit -m "feat: add single-player exit button that starts a fresh game"
```

---

### Task 5: Multiplayer auto-rejoin after refresh

Persists `{ name, code }` in `localStorage` and auto-joins the same room on refresh, using the server's existing name-based slot reclamation.

**Files:**
- Create: `src/net/session.ts`
- Modify: `src/components/MultiplayerGame.tsx`
- Modify: `src/App.tsx`
- Test: `src/net/__tests__/session.test.ts` (new), `src/components/__tests__/Lobby.test.tsx`

**Interfaces:**
- Consumes: `JoinInfo` from `src/components/MultiplayerGame.tsx`; `GameApi.state.phase` / `GamePhase` from `src/types/game.ts`.
- Produces: `src/net/session.ts` exports `saveSession({ name, code }: { name: string; code: string })`, `loadSession(): { name: string; code: string } | null`, `clearSession(): void`. localStorage key `monopoly-mp-session`.

- [ ] **Step 1: Write failing tests**

Create `src/net/__tests__/session.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { saveSession, loadSession, clearSession } from '../session'

describe('mp session', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves and loads a session', () => {
    saveSession({ name: 'Alice', code: 'ABC12' })
    expect(loadSession()).toMatchObject({ name: 'Alice', code: 'ABC12' })
  })

  it('returns null when nothing is saved', () => {
    expect(loadSession()).toBeNull()
  })

  it('returns null for corrupt data', () => {
    localStorage.setItem('monopoly-mp-session', 'not json')
    expect(loadSession()).toBeNull()
  })

  it('clears the session', () => {
    saveSession({ name: 'Alice', code: 'ABC12' })
    clearSession()
    expect(loadSession()).toBeNull()
  })
})
```
(`src/test/setup.ts` installs an in-memory `localStorage`; the `@vitest-environment jsdom` annotation matches the other net test. No component test for `MultiplayerGame` — it opens a real WebSocket; coverage for the restore/clear wiring is the `session.test.ts` unit tests plus the e2e test in Task 6.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/net/__tests__/session.test.ts`
Expected: FAIL — module `../session` does not exist.

- [ ] **Step 3: Implement**

Create `src/net/session.ts`:
```ts
export interface MPSession {
  name: string
  code: string
  savedAt: number
}

const KEY = 'monopoly-mp-session'

export function saveSession(session: { name: string; code: string }): void {
  const value: MPSession = { ...session, savedAt: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(value))
}

export function loadSession(): { name: string; code: string } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MPSession
    if (!parsed.name || !parsed.code) return null
    return { name: parsed.name, code: parsed.code }
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}
```

`src/components/MultiplayerGame.tsx` — import the session helpers and `GamePhase`, then add a save effect and a game-over cleanup. Replace the top imports and the component body:
```tsx
import { useEffect } from 'react'
import { GamePhase } from '../types/game'
import { useNetworkGame } from '../hooks/useNetworkGame'
import { saveSession, clearSession } from '../net/session'
import Lobby from './Lobby'
import GameView from './GameView'
```
After the existing `useEffect` that joins/creates, add:
```tsx
  useEffect(() => {
    if (game.code && name) saveSession({ name, code: game.code })
  }, [game.code, name, game.state.phase])

  useEffect(() => {
    if (game.state.phase === GamePhase.GameOver) clearSession()
  }, [game.state.phase])
```
(`game.code` is non-null only after a `Welcome`; `name` is the join-form name.)

`src/App.tsx` — import the session helpers, restore on mount, clear on leave, and pass exit keys. Changes:
```tsx
import { saveSession, loadSession, clearSession } from './net/session'
```
Replace the two state initializers:
```tsx
  const [mode, setMode] = useState<Mode>(() =>
    local.state.phase !== GamePhase.Setup ? Mode.Local : null,
  )
  const [joinInfo, setJoinInfo] = useState<JoinInfo>({ name: '', code: null })
```
with:
```tsx
  const [mode, setMode] = useState<Mode>(() => {
    if (loadSession()) return Mode.Multiplayer
    return local.state.phase !== GamePhase.Setup ? Mode.Local : null
  })
  const [joinInfo, setJoinInfo] = useState<JoinInfo>(() => {
    const session = loadSession()
    return session ? { name: session.name, code: session.code } : { name: '', code: null }
  })
```
Replace the multiplayer `onLeft`:
```tsx
        <MultiplayerGame joinInfo={joinInfo} onLeft={() => setMode(null)} />
```
with:
```tsx
        <MultiplayerGame
          joinInfo={joinInfo}
          onLeft={() => {
            clearSession()
            setMode(null)
          }}
        />
```

- [ ] **Step 4: Run the full check**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/net/session.ts src/net/__tests__/session.test.ts src/components/MultiplayerGame.tsx src/App.tsx
git commit -m "feat: auto-rejoin a multiplayer room after a page refresh"
```

---

### Task 6: E2E coverage for exit and rejoin

Adds Playwright coverage: single-player exit returns to setup, and a multiplayer player refreshes mid-game and reconnects to the same room.

**Files:**
- Modify: `e2e/monopoly.spec.ts`
- Modify: `e2e/multiplayer.spec.ts`

**Interfaces:**
- Consumes: the features from Tasks 1-5; `npm run build` output in `dist/` for the multiplayer spec.

**Constraints:** `e2e/multiplayer.spec.ts` spawns the real server on port 3123 and serves `dist/`. Run `npm run build` before `npm run test:e2e`. The language default is English, but existing specs set `monopoly-language`/`monopoly-currency` via `addInitScript`.

- [ ] **Step 1: Add a single-player exit e2e test**

In `e2e/monopoly.spec.ts`, add this test inside the existing `test.describe('Monopoly Game E2E')` block (after the "start game with 2 players" test) so it inherits the `beforeEach` that sets `en`/`USD` and navigates to `/`:
```ts
  test('single player can exit a game and return to the setup screen', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Alpha')
    await page.locator('input[type="text"]').nth(1).fill('Beta')
    await page.click('button:has-text("Start")')

    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
    await page.click('button[aria-label="Exit Game"]')
    await page.getByRole('button', { name: 'Exit', exact: true }).click()

    await expect(page.locator('h1')).toHaveText('Monopoly')
  })
```

- [ ] **Step 2: Add a refresh-rejoin multiplayer e2e test**

In `e2e/multiplayer.spec.ts`, add this test (matches the file's exact selectors: `input[placeholder="Name"]`, `input[placeholder="Code"]`, `button:has-text("Join Room")`):
```ts
test('a player who refreshes mid-game rejoins the same room', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()

  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')

  await pageA.click('button:has-text("Start")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await pageB.reload()
  // The session in localStorage makes the refreshed page auto-rejoin as Tamu.
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 10000 })
  await expect(pageB.getByText('Tamu').first()).toBeVisible()
})
```

- [ ] **Step 3: Build and run e2e**

Run: `npm run build && npm run test:e2e`
Expected: all specs pass, including the two new ones.

- [ ] **Step 4: Commit**

```bash
git add e2e/monopoly.spec.ts e2e/multiplayer.spec.ts
git commit -m "test: e2e coverage for single-player exit and multiplayer refresh-rejoin"
```

---

## Self-review notes

- Spec coverage: issue 1 → Task 4; issue 2 → Task 5 + Task 6; issue 3 → Task 1; issue 4 → Task 2; issues 5+6 → Task 3; issue 9 → Task 3. i18n `exit.*`, `event.bankruptcyTransfer`, `card.jailFreeCount` all land with their tasks. `STATE_VERSION` bump → Task 1.
- Out-of-scope items (card-effect bankruptcy, replacing reducer `Math.random` with the injected rng, turn-based reconnect takeover) are intentionally not covered.
