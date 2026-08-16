# Real Trade Negotiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn trades into real negotiations — offers sit in a shared `pendingTrades` inbox, the recipient accepts/rejects (and proposer cancels), an accepted offer transfers cash + property both directions, and bots respond instantly via value comparison. Gameplay never blocks.

**Architecture:** `GameState` gains `pendingTrades: PendingTrade[]` and `nextTradeId`. The shared `gameReducer` owns all rules (propose/accept/reject/cancel + asset transfer), so single-player and multiplayer behave identically. A pure `shouldAcceptTrade` helper in `bot.ts` lets the reducer resolve offers to bots instantly. The server's `handleAction` gains a trade-action exception so the non-current-player recipient may respond. New UI: a "Trades" badge button in the sidebar and a `TradeInboxModal`; `TradeModal` gets request-side property checkboxes.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4, Vitest (jsdom), Node `ws` server via `tsx`, Playwright e2e.

## Global Constraints

- Shared `gameReducer` is the single source of truth; new rules must work in both local (`useGame`) and multiplayer (`server/gameServer.ts`).
- No TS enums; `verbatimModuleSyntax` → type-only imports via `import type`. `noUnusedLocals`/`noUnusedParameters` are on.
- Semicolon style per file: `src/logic/*`, `src/types/*` use semicolons; components/hooks/server files omit them. Match the file you edit.
- Every UI string must exist in both `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys).
- Bump `STATE_VERSION` in `src/hooks/useGame.ts` when `GameState` shape changes incompatibly.
- No auto-expiry; trades persist until accepted/rejected/cancelled.
- No trades with mortgaged or house-owning properties (existing filter reused).
- Bots only respond to offers — they never initiate trades.
- Each task must leave `npm run typecheck` and `npm run test:unit` green.

---

### Task 1: GameState shape — pendingTrades, nextTradeId, action variants

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/logic/gameReducer.ts:11-27` (`createInitialState`)
- Modify: `src/hooks/useGame.ts:7` (`STATE_VERSION`)
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `TradeOffer` (exists).
- Produces:
  - `export type PendingTrade = TradeOffer & { id: number }` in `src/types/game.ts`.
  - `GameState.pendingTrades: PendingTrade[]` and `GameState.nextTradeId: number`.
  - `GameAction` variants change: `{ type: GameActionType.AcceptTrade; tradeId: number }`, `{ type: GameActionType.RejectTrade; tradeId: number }`, new `{ type: GameActionType.CancelTrade; tradeId: number }` + `GameActionType.CancelTrade = 'CANCEL_TRADE'`.
  - `createInitialState` initializes `pendingTrades: [], nextTradeId: 0`.
  - `STATE_VERSION = 8`.

- [ ] **Step 1: Write the failing test**

Add to `src/logic/__tests__/gameReducer.test.ts`:

```ts
it('initializes an empty trade inbox', () => {
  const state = createInitialState();
  expect(state.pendingTrades).toEqual([]);
  expect(state.nextTradeId).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — `state.pendingTrades` is `undefined` (property does not exist on `GameState`).

- [ ] **Step 3: Implement the type + initial state**

In `src/types/game.ts`:

1. Add after `TradeOffer`:

```ts
export type PendingTrade = TradeOffer & { id: number };
```

2. Add to `GameState` (after `justBoughtSpaceId`):

```ts
pendingTrades: PendingTrade[];
nextTradeId: number;
```

3. Add to `GameActionType`:

```ts
CancelTrade: 'CANCEL_TRADE',
```

4. Change the two existing action variants and add the third:

```ts
| { type: typeof GameActionType.AcceptTrade; tradeId: number }
| { type: typeof GameActionType.RejectTrade; tradeId: number }
| { type: typeof GameActionType.CancelTrade; tradeId: number }
```

In `src/logic/gameReducer.ts`, add to `createInitialState`:

```ts
pendingTrades: [],
nextTradeId: 0,
```

In `src/hooks/useGame.ts`, change `const STATE_VERSION = 7` to `const STATE_VERSION = 8`.

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts && npm run typecheck`
Expected: PASS — typecheck confirms every `GameAction` construction of `ACCEPT_TRADE`/`REJECT_TRADE`/`CANCEL_TRADE` now carries `tradeId` (the reducer's existing cases ignore payload fields, so they still compile).

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/hooks/useGame.ts
git commit -m "feat: add pendingTrades inbox and trade action ids to game state"
```

---

### Task 2: Bot trade valuation — `shouldAcceptTrade`

**Files:**
- Modify: `src/logic/bot.ts`
- Test: `src/logic/__tests__/bot.test.ts`

**Interfaces:**
- Consumes: `GameState`, `TradeOffer` (from `../types/game`).
- Produces: `export function shouldAcceptTrade(state: GameState, offer: TradeOffer): boolean` — true when the recipient's received value (requested cash + requested property prices) is ≥ the value they give (offered cash + offered property prices). Used by Task 3's reducer.

- [ ] **Step 1: Write the failing test**

Append to `src/logic/__tests__/bot.test.ts`:

```ts
import { shouldAcceptTrade } from '../bot';
import type { TradeOffer } from '../../types/game';

describe('shouldAcceptTrade', () => {
  function offer(overrides: Partial<TradeOffer> = {}): TradeOffer {
    return {
      fromId: 0, toId: 1,
      offerProperties: [], offerCash: 0,
      requestProperties: [], requestCash: 0,
      ...overrides,
    };
  }

  it('accepts when received value equals given value', () => {
    const state = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['A', 'B'] });
    expect(shouldAcceptTrade(state, offer({ requestProperties: [1], offerCash: 60 }))).toBe(true);
  });

  it('accepts when received value exceeds given value', () => {
    const state = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['A', 'B'] });
    expect(shouldAcceptTrade(state, offer({ requestProperties: [1], offerCash: 40 }))).toBe(true);
  });

  it('rejects a losing deal', () => {
    const state = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['A', 'B'] });
    expect(shouldAcceptTrade(state, offer({ requestProperties: [3], requestCash: 0, offerCash: 61 }))).toBe(false);
  });
});
```

Add these imports to the top of `bot.test.ts` if not already present:
`import { gameReducer, createInitialState } from '../gameReducer';`
`import { GameActionType } from '../../types/game';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`
Expected: FAIL — `shouldAcceptTrade is not a function`.

- [ ] **Step 3: Implement**

In `src/logic/bot.ts`, add `TradeOffer` to the type import from `'../types/game'` and append:

```ts
export function shouldAcceptTrade(state: GameState, offer: TradeOffer): boolean {
  const received =
    offer.requestCash +
    offer.requestProperties.reduce((sum, id) => sum + (state.board[id]?.price ?? 0), 0);
  const given =
    offer.offerCash +
    offer.offerProperties.reduce((sum, id) => sum + (state.board[id]?.price ?? 0), 0);
  return received >= given;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`
Expected: PASS (3 new + existing).

- [ ] **Step 5: Commit**

```bash
git add src/logic/bot.ts src/logic/__tests__/bot.test.ts
git commit -m "feat: add bot trade valuation helper"
```

---

### Task 3: Reducer trade rules — propose/accept/reject/cancel + transfer

**Files:**
- Modify: `src/logic/gameReducer.ts`
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `PendingTrade` (Task 1), `shouldAcceptTrade` (Task 2).
- Produces:
  - `PROPOSE_TRADE`: validates; stores `{ ...offer, id: state.nextTradeId }` for human targets (logs `event.tradeProposed`, advances `nextTradeId`); for bot targets resolves instantly via `shouldAcceptTrade` + `applyTrade` (logs `event.tradeAccepted`/`event.tradeRejected`, never stores).
  - `ACCEPT_TRADE { tradeId }`: recipient role; validates `isTradeValid`; transfers assets both directions; removes from inbox; logs `event.tradeAccepted` (or `event.tradeRejected` when the offer went stale).
  - `REJECT_TRADE { tradeId }`: removes from inbox; logs `event.tradeRejected`.
  - `CANCEL_TRADE { tradeId }`: removes from inbox; logs `event.tradeCancelled`.
  - Private helpers in `gameReducer.ts`: `isTradeValid(state, trade): boolean`, `applyTrade(state, trade): GameState`.

- [ ] **Step 1: Write the failing tests**

Replace the existing `ProposeTrade` event-log test (which asserts `pendingAction` is null after proposing — the new behavior keeps `pendingAction` null AND stores the offer) with:

```ts
describe('trade negotiation', () => {
  function makeSubjects() {
    let state = makeStartedState();
    state = buyProperty(state, 0, 1);
    state = buyProperty(state, 1, 3);
    state = setMoney(state, 0, 2000);
    state = setMoney(state, 1, 2000);
    return state;
  }

  function proposeTradeForId(state: GameState): GameState {
    return gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [1], offerCash: 50, requestProperties: [3], requestCash: 100 },
    });
  }

  it('stores a proposed offer in the inbox for a human target', () => {
    const state = proposeTradeForId(makeSubjects());
    expect(state.pendingTrades).toHaveLength(1);
    expect(state.pendingTrades[0]).toMatchObject({ id: 0, fromId: 0, toId: 1, offerProperties: [1], offerCash: 50, requestProperties: [3], requestCash: 100 });
    expect(state.nextTradeId).toBe(1);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeProposed', params: { from: 'Alice', to: 'Bob' } });
  });

  it('rejects a proposal whose offered property is not owned by the proposer', () => {
    const state = makeSubjects();
    const s1 = gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [3], offerCash: 0, requestProperties: [], requestCash: 0 },
    });
    expect(s1.pendingTrades).toHaveLength(0);
  });

  it('accept transfers property and cash in both directions and clears the inbox', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.AcceptTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.board[1].owner).toBe(1);
    expect(state.board[3].owner).toBe(0);
    expect(state.players[0].money).toBe(2000 - 50 + 100);
    expect(state.players[1].money).toBe(2000 + 50 - 100);
    expect(state.players[0].properties).toContain(3);
    expect(state.players[0].properties).not.toContain(1);
    expect(state.players[1].properties).toContain(1);
    expect(state.players[1].properties).not.toContain(3);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeAccepted', params: { from: 'Alice', to: 'Bob' } });
  });

  it('reject removes the offer and logs rejection', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.RejectTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeRejected', params: { from: 'Alice', to: 'Bob' } });
    expect(state.players[0].money).toBe(2000);
    expect(state.board[1].owner).toBe(0);
  });

  it('cancel removes the offer and logs cancellation', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.CancelTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeCancelled', params: { from: 'Alice', to: 'Bob' } });
  });

  it('accept on a stale deal drops it and re-logs as rejected', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
    state = gameReducer(state, { type: GameActionType.AcceptTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeRejected', params: { from: 'Alice', to: 'Bob' } });
  });

  it('resolves a proposal to a bot instantly with an accept', () => {
    let state = makeSubjects();
    state = { ...state, players: state.players.map((p, i) => (i === 1 ? { ...p, isBot: true } : p)) };
    const s1 = gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [1], offerCash: 60, requestProperties: [3], requestCash: 0 },
    });
    expect(s1.pendingTrades).toHaveLength(0);
    expect(s1.eventLog).toContainEqual({ key: 'event.tradeAccepted', params: { from: 'Alice', to: 'Bob' } });
    expect(s1.board[1].owner).toBe(1);
    expect(s1.board[3].owner).toBe(0);
  });

  it('resolves a proposal to a bot instantly with a reject on a losing deal', () => {
    let state = makeSubjects();
    state = { ...state, players: state.players.map((p, i) => (i === 1 ? { ...p, isBot: true } : p)) };
    const s1 = gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [1], offerCash: 10, requestProperties: [3], requestCash: 0 },
    });
    expect(s1.pendingTrades).toHaveLength(0);
    expect(s1.eventLog).toContainEqual({ key: 'event.tradeRejected', params: { from: 'Alice', to: 'Bob' } });
    expect(s1.board[1].owner).toBe(0);
    expect(s1.board[3].owner).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — the new trade cases have no matching reducer cases yet, so state is unchanged (e.g. `pendingTrades` empty after propose).

- [ ] **Step 3: Implement the reducer cases + helpers**

In `src/logic/gameReducer.ts`:

1. Add `PendingTrade` to the `'../types/game'` import, and import `shouldAcceptTrade`:

```ts
import { ... type LogEntry, type PendingTrade } from '../types/game';
import { shouldAcceptTrade } from './bot';
```

2. Replace the existing `ProposeTrade` / `AcceptTrade` / `RejectTrade` cases with:

```ts
    case GameActionType.ProposeTrade: {
      const offer = action.offer;
      const from = state.players[offer.fromId];
      const to = state.players[offer.toId];
      if (!from || !to || offer.fromId === offer.toId || to.bankrupt) return state;
      const validOffer = offer.offerProperties.every(
        (id) => state.board[id]?.owner === offer.fromId && !state.board[id].mortgaged && state.board[id].houses === 0,
      );
      if (!validOffer) return state;
      if (to.isBot) {
        const trade: PendingTrade = { ...offer, id: state.nextTradeId };
        if (shouldAcceptTrade(state, trade)) {
          const applied = applyTrade(state, trade);
          return {
            ...applied,
            pendingTrades: applied.pendingTrades.filter((t) => t.id !== trade.id),
            eventLog: [...applied.eventLog, { key: 'event.tradeAccepted', params: { from: from.name, to: to.name } }],
          };
        }
        return { ...state, eventLog: [...state.eventLog, { key: 'event.tradeRejected', params: { from: from.name, to: to.name } }] };
      }
      return {
        ...state,
        pendingTrades: [...state.pendingTrades, { ...offer, id: state.nextTradeId }],
        nextTradeId: state.nextTradeId + 1,
        eventLog: [...state.eventLog, { key: 'event.tradeProposed', params: { from: from.name, to: to.name } }],
      };
    }

    case GameActionType.AcceptTrade: {
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      if (!trade) return state;
      const from = state.players[trade.fromId];
      const to = state.players[trade.toId];
      if (!isTradeValid(state, trade)) {
        return {
          ...state,
          pendingTrades: state.pendingTrades.filter((t) => t.id !== trade.id),
          eventLog: [...state.eventLog, { key: 'event.tradeRejected', params: { from: from.name, to: to.name } }],
        };
      }
      const applied = applyTrade(state, trade);
      return {
        ...applied,
        pendingTrades: applied.pendingTrades.filter((t) => t.id !== trade.id),
        eventLog: [...applied.eventLog, { key: 'event.tradeAccepted', params: { from: from.name, to: to.name } }],
      };
    }

    case GameActionType.RejectTrade: {
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      if (!trade) return state;
      return {
        ...state,
        pendingTrades: state.pendingTrades.filter((t) => t.id !== trade.id),
        eventLog: [...state.eventLog, { key: 'event.tradeRejected', params: { from: state.players[trade.fromId].name, to: state.players[trade.toId].name } }],
      };
    }

    case GameActionType.CancelTrade: {
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      if (!trade) return state;
      return {
        ...state,
        pendingTrades: state.pendingTrades.filter((t) => t.id !== trade.id),
        eventLog: [...state.eventLog, { key: 'event.tradeCancelled', params: { from: state.players[trade.fromId].name, to: state.players[trade.toId].name } }],
      };
    }
```

3. Add the private helpers at the end of the file (after `getNextPlayer`):

```ts
function isTradeValid(state: GameState, trade: PendingTrade): boolean {
  for (const id of trade.offerProperties) {
    const space = state.board[id];
    if (!space || space.owner !== trade.fromId || space.mortgaged || space.houses > 0) return false;
  }
  for (const id of trade.requestProperties) {
    const space = state.board[id];
    if (!space || space.owner !== trade.toId || space.mortgaged || space.houses > 0) return false;
  }
  if (state.players[trade.fromId].money < trade.offerCash) return false;
  if (state.players[trade.toId].money < trade.requestCash) return false;
  return true;
}

function applyTrade(state: GameState, trade: PendingTrade): GameState {
  const board = state.board.map((space) => {
    if (trade.offerProperties.includes(space.id)) return { ...space, owner: trade.toId };
    if (trade.requestProperties.includes(space.id)) return { ...space, owner: trade.fromId };
    return space;
  });
  const players = state.players.map((p) => {
    if (p.id === trade.fromId) {
      return {
        ...p,
        money: p.money - trade.offerCash + trade.requestCash,
        properties: p.properties.filter((id) => !trade.offerProperties.includes(id)).concat(trade.requestProperties),
      };
    }
    if (p.id === trade.toId) {
      return {
        ...p,
        money: p.money + trade.offerCash - trade.requestCash,
        properties: p.properties.filter((id) => !trade.requestProperties.includes(id)).concat(trade.offerProperties),
      };
    }
    return p;
  });
  return { ...state, board, players };
}
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts && npm run typecheck`
Expected: PASS — all new trade tests and the full reducer suite pass.

- [ ] **Step 5: Commit**

```bash
git add src/logic/gameReducer.ts src/logic/__tests__/gameReducer.test.ts
git commit -m "feat: implement trade inbox propose/accept/reject/cancel with asset transfer"
```

---

### Task 4: GameApi trade methods through both hooks

**Files:**
- Modify: `src/types/game.ts` (GameApi)
- Modify: `src/hooks/useGame.ts`
- Modify: `src/hooks/useNetworkGame.ts`
- Test: `src/components/__tests__/Lobby.test.tsx` (mock gains the methods)

**Interfaces:**
- Consumes: `AcceptTrade`/`RejectTrade`/`CancelTrade` action shapes from Task 1.
- Produces: `acceptTrade: (tradeId: number) => void`, `rejectTrade: (tradeId: number) => void`, `cancelTrade: (tradeId: number) => void` on `GameApi`, implemented in both `useGame` and `useNetworkGame`.

- [ ] **Step 1: Write the failing test**

In `src/components/__tests__/Lobby.test.tsx`, add the three methods to `makeGame()`:

```tsx
acceptTrade: vi.fn(),
rejectTrade: vi.fn(),
cancelTrade: vi.fn(),
```

- [ ] **Step 2: Verify it fails**

Run: `npm run typecheck`
Expected: FAIL — `Type '...' is missing the following properties from type 'GameApi': acceptTrade, rejectTrade, cancelTrade`.

- [ ] **Step 3: Implement**

In `src/types/game.ts`, add to `GameApi`:

```ts
acceptTrade: (tradeId: number) => void;
rejectTrade: (tradeId: number) => void;
cancelTrade: (tradeId: number) => void;
```

In `src/hooks/useGame.ts`, add beside `proposeTrade`:

```ts
const acceptTrade = useCallback((tradeId: number) => send({ type: 'ACCEPT_TRADE', tradeId }), [send])
const rejectTrade = useCallback((tradeId: number) => send({ type: 'REJECT_TRADE', tradeId }), [send])
const cancelTrade = useCallback((tradeId: number) => send({ type: 'CANCEL_TRADE', tradeId }), [send])
```

and add all three to the returned object.

In `src/hooks/useNetworkGame.ts`, add beside `proposeTrade`:

```ts
const acceptTrade = useCallback((tradeId: number) => sendAction({ type: 'ACCEPT_TRADE', tradeId }), [sendAction])
const rejectTrade = useCallback((tradeId: number) => sendAction({ type: 'REJECT_TRADE', tradeId }), [sendAction])
const cancelTrade = useCallback((tradeId: number) => sendAction({ type: 'CANCEL_TRADE', tradeId }), [sendAction])
```

and add all three to the returned object.

- [ ] **Step 4: Verify typecheck + unit tests pass**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts src/hooks/useGame.ts src/hooks/useNetworkGame.ts src/components/__tests__/Lobby.test.tsx
git commit -m "feat: expose accept/reject/cancel trade actions on the game api"
```

---

### Task 5: Server — allow the recipient to respond to trades

**Files:**
- Modify: `server/gameServer.ts:231-241` (`handleAction`)
- Test: `server/__tests__/gameServer.test.ts`

**Interfaces:**
- Consumes: `GameState.pendingTrades`, action `tradeId` payloads from Task 1.
- Produces: `handleAction` accepts `ACCEPT_TRADE`/`REJECT_TRADE` from the client whose slot index equals the trade's `toId`, and `CANCEL_TRADE` from the client whose slot index equals `fromId`, bypassing the `isTurn` guard.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/gameServer.test.ts`:

```ts
it('lets the recipient accept a trade even when it is not their turn', () => {
  const { server } = setup()
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')

  server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
    fromId: 0, toId: 1, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
  } })
  const tradeId = server.getState().pendingTrades[0].id
  // c0 is current player; c1 is NOT. The accept must bypass the turn gate.
  server.handleAction('c1', { type: 'ACCEPT_TRADE', tradeId })
  expect(server.getState().pendingTrades).toHaveLength(0)
  expect(server.getState().currentPlayer).toBe(0)
})

it('rejects a trade response from a player who is not a party', () => {
  const { server, sent } = setup()
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.join('c2', 'Charlie')
  server.start('c0')
  server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
    fromId: 0, toId: 1, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
  } })
  const tradeId = server.getState().pendingTrades[0].id
  server.handleAction('c2', { type: 'ACCEPT_TRADE', tradeId })
  expect(sent.some((m) => m.type === 'error')).toBe(true)
  expect(server.getState().pendingTrades).toHaveLength(1)
})
```

Note: the offer uses empty `offerProperties` so proposal validation passes (the
property-ownership check is vacuous over an empty list) and a real pending trade
exists. An empty-cash, empty-property trade is valid per `isTradeValid`, so the
accept clears the inbox.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: FAIL — `handleAction` rejects `ACCEPT_TRADE` from `c1` because `isTurn('c1')` is false; the inbox stays populated.

- [ ] **Step 3: Implement**

Edit `server/gameServer.ts` `handleAction` — insert before the `!this.isTurn` guard:

```ts
    const slotIndex = this.slots.findIndex((s) => s.clientId === clientId)
    if (action.type === 'ACCEPT_TRADE' || action.type === 'REJECT_TRADE') {
      const trade = this.state.pendingTrades.find((t) => t.id === action.tradeId)
      if (trade && trade.toId === slotIndex) {
        this.dispatch(action)
        return
      }
      this.events.send(clientId, { type: 'error', message: 'Bukan giliranmu' })
      return
    }
    if (action.type === 'CANCEL_TRADE') {
      const trade = this.state.pendingTrades.find((t) => t.id === action.tradeId)
      if (trade && trade.fromId === slotIndex) {
        this.dispatch(action)
        return
      }
      this.events.send(clientId, { type: 'error', message: 'Bukan giliranmu' })
      return
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/gameServer.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts
git commit -m "feat: allow the trade recipient to accept/reject out of turn server-side"
```

---

### Task 6: i18n keys for trade events and inbox

**Files:**
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: log keys emitted by Task 3 (`event.tradeProposed`, `event.tradeAccepted`, `event.tradeRejected`, `event.tradeCancelled`) and inbox UI keys consumed by Task 7/8.
- Produces: translation keys available in both locales.

- [ ] **Step 1: Add the English keys**

In `src/i18n/locales/en/translation.json` add (place `event.tradeAccepted`, `event.tradeRejected`, `event.tradeCancelled` next to `event.tradeProposed` at line 98):

```json
"event.tradeAccepted": "{{from}} and {{to}} completed a trade",
"event.tradeRejected": "{{to}} declined {{from}}'s trade offer",
"event.tradeCancelled": "{{from}} cancelled their trade offer to {{to}}",
```

Add under the `trade.*` block:

```json
"trade.inbox": "Trades",
"trade.noOffers": "No pending trade offers",
"trade.accept": "Accept",
"trade.reject": "Reject",
```

- [ ] **Step 2: Add the Indonesian keys**

In `src/i18n/locales/id/translation.json`:

```json
"event.tradeAccepted": "{{from}} dan {{to}} menyelesaikan pertukaran",
"event.tradeRejected": "{{to}} menolak tawaran pertukaran {{from}}",
"event.tradeCancelled": "{{from}} membatalkan tawaran pertukaran ke {{to}}",
```

```json
"trade.inbox": "Pertukaran",
"trade.noOffers": "Tidak ada tawaran pertukaran",
"trade.accept": "Terima",
"trade.reject": "Tolak",
```

- [ ] **Step 3: Verify keys resolve**

Run: `npx vitest run src/components/__tests__/EventLog.test.tsx && npm run test:unit`
Expected: PASS. The trade event keys use only `from`/`to` (player names, passed through by `resolveLogEntry` unchanged), so no `MONEY_PARAM_KEYS` change is needed in `log.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: add i18n keys for trade events and inbox"
```

---

### Task 7: TradeModal — request-side property checkboxes

**Files:**
- Modify: `src/components/Modals/TradeModal.tsx`
- Test: `src/components/__tests__/TradeModal.test.tsx`

**Interfaces:**
- Consumes: `targetPlayerId: number` (required, from the popup trade flow).
- Produces: `TradeModal` renders a "You request" section listing the recipient's unmortgaged house-free properties as checkboxes, stored in a `requestProperties` state array, included in the `TradeOffer` passed to `onPropose`.

- [ ] **Step 1: Write the failing test**

Append to `src/components/__tests__/TradeModal.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react'

function makeStateWithRecipientProperties(): GameState {
  const s = makeState()
  return {
    ...s,
    board: s.board.map((b) => (b.id === 1 ? { ...b, owner: 0 } : b.id === 3 ? { ...b, owner: 1 } : b)),
    players: s.players.map((p, i) => (i === 1 ? { ...p, properties: [3] } : p)),
  }
}

it('renders the recipient\'s tradeable properties as request checkboxes', () => {
  renderWithProviders(<TradeModal state={makeStateWithRecipientProperties()} targetPlayerId={1} onPropose={() => {}} onClose={() => {}} />)
  expect(screen.getByText('You request:')).toBeVisible()
  expect(screen.getByRole('checkbox', { name: /^board\.space\.3/ })).toBeTruthy()
})

it('includes the selected request property in the proposed offer', () => {
  const onPropose = vi.fn()
  renderWithProviders(<TradeModal state={makeStateWithRecipientProperties()} targetPlayerId={1} onPropose={onPropose} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /^board\.space\.3/ }))
  screen.getByRole('button', { name: /Propose/i }).click()
  expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ requestProperties: [3] }))
})
```

Note: the checkbox `name` is the raw i18n key because the request-side label uses `t('board.space.' + s.id)` at render; adjust the matcher to the resolved English space name if the test helper resolves it (check how `renderWithProviders` sets up i18n — if translations load, match `/Cirebon/` for space 1 and `/Tegal/` for space 3 instead).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/TradeModal.test.tsx`
Expected: FAIL — the "You request" section has no property checkboxes today.

- [ ] **Step 3: Implement**

In `src/components/Modals/TradeModal.tsx`:

1. Change `const [requestProperties] = useState<number[]>([])` to a settable state:

```tsx
const [requestProperties, setRequestProperties] = useState<number[]>([])
```

2. Add the recipient's tradeable properties beside `currentProps`:

```tsx
const targetProps = state.board.filter(
  (s) => s.owner === targetPlayerId && !s.mortgaged && s.houses === 0
)
```

3. In the "You request" column (after the money input), render the checkboxes:

```tsx
{targetProps.map((s) => (
  <label key={s.id} className="text-base flex items-center gap-1 text-text-dim">
    <input
      type="checkbox"
      checked={requestProperties.includes(s.id)}
      onChange={() =>
        setRequestProperties((prev) =>
          prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
        )
      }
      className="mr-1"
    />
    {t('board.space.' + s.id)}
  </label>
))}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/TradeModal.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Modals/TradeModal.tsx src/components/__tests__/TradeModal.test.tsx
git commit -m "feat: let trade requests include the recipient's properties"
```

---

### Task 8: TradeInboxModal + sidebar badge + GameView wiring

**Files:**
- Create: `src/components/Modals/TradeInboxModal.tsx`
- Test: `src/components/__tests__/TradeInboxModal.test.tsx` (new)
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/GameView.tsx`
- Modify: `src/components/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `GameApi.acceptTrade/rejectTrade/cancelTrade` (Task 4), `GameState.pendingTrades` (Task 1), i18n keys (Task 6).
- Produces:
  - `TradeInboxModal({ state, myPlayerId, onAccept, onReject, onCancel, onClose })` — lists pending trades; Accept/Reject buttons for trades where `toId === myPlayerId` (all trades when `myPlayerId === null`), Cancel for trades where `fromId === myPlayerId` (all trades when null).
  - `Sidebar` gains `tradeCount: number` and `onOpenTrades: () => void` props, rendering a "Trades" button with a badge (always visible, not turn-gated).
  - `GameView` owns `showTrades` state, computes `tradeCount`, renders `TradeInboxModal`, and wires the three callbacks to `game`.

- [ ] **Step 1: Write the failing component test**

Create `src/components/__tests__/TradeInboxModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import TradeInboxModal from '../Modals/TradeInboxModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeStateWithTrades(): GameState {
  let state = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 3,
    names: ['Alice', 'Bob', 'Charlie'],
  })
  state = {
    ...state,
    pendingTrades: [
      { id: 0, fromId: 0, toId: 1, offerProperties: [], offerCash: 50, requestProperties: [], requestCash: 0 },
      { id: 1, fromId: 2, toId: 0, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 100 },
    ],
  }
  return state
}

afterEach(cleanup)

describe('TradeInboxModal', () => {
  it('shows incoming offers with accept/reject and outgoing offers with cancel for a specific player', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <TradeInboxModal state={makeStateWithTrades()} myPlayerId={0} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={() => {}} />,
    )
    // Trade 0 (from Alice to Bob) is not for us; trade 1 (from Charlie to Alice) is incoming; trade 0 is outgoing.
    expect(screen.getByText('Charlie')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Accept/ }))
    expect(onAccept).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(onCancel).toHaveBeenCalledWith(0)
  })

  it('shows a no-offers message when the inbox is empty', () => {
    const state = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 2,
      names: ['Alice', 'Bob'],
    })
    renderWithProviders(<TradeInboxModal state={state} myPlayerId={0} onAccept={() => {}} onReject={() => {}} onCancel={() => {}} onClose={() => {}} />)
    expect(screen.getByText('No pending trade offers')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/TradeInboxModal.test.tsx`
Expected: FAIL — `TradeInboxModal` module does not exist.

- [ ] **Step 3: Create `TradeInboxModal`**

Create `src/components/Modals/TradeInboxModal.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { GameState } from '../../types/game'
import { useCurrency } from '../../i18n/CurrencyContext'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  myPlayerId: number | null
  onAccept: (tradeId: number) => void
  onReject: (tradeId: number) => void
  onCancel: (tradeId: number) => void
  onClose: () => void
}

export default function TradeInboxModal({ state, myPlayerId, onAccept, onReject, onCancel, onClose }: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()

  const relevant = myPlayerId === null
    ? state.pendingTrades
    : state.pendingTrades.filter((tr) => tr.fromId === myPlayerId || tr.toId === myPlayerId)

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">{t('trade.inbox')}</h3>
      {relevant.length === 0 && <p className="text-base text-muted">{t('trade.noOffers')}</p>}
      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
        {relevant.map((tr) => {
          const from = state.players[tr.fromId]?.name ?? '?'
          const to = state.players[tr.toId]?.name ?? '?'
          const offerProps = tr.offerProperties.map((id) => t('board.space.' + id)).join(', ')
          const requestProps = tr.requestProperties.map((id) => t('board.space.' + id)).join(', ')
          const canAccept = myPlayerId === null || tr.toId === myPlayerId
          const canCancel = myPlayerId === null || tr.fromId === myPlayerId
          return (
            <div key={tr.id} className="bg-bg-darker rounded p-2">
              <p className="text-sm text-text-dim">
                <strong>{from}</strong> → <strong>{to}</strong>
              </p>
              <p className="text-sm text-text-dim">
                {t('trade.youOffer')} {offerProps || '—'} + {formatMoney(tr.offerCash)}
              </p>
              <p className="text-sm text-text-dim">
                {t('trade.youRequest')} {requestProps || '—'} + {formatMoney(tr.requestCash)}
              </p>
              <div className="flex gap-1 mt-1">
                {canAccept && (
                  <Button size="sm" variant="success" onClick={() => onAccept(tr.id)}>{t('trade.accept')}</Button>
                )}
                {canAccept && (
                  <Button size="sm" variant="secondary" onClick={() => onReject(tr.id)}>{t('trade.reject')}</Button>
                )}
                {canCancel && (
                  <Button size="sm" variant="danger" onClick={() => onCancel(tr.id)}>{t('trade.cancel')}</Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <Modal.Actions>
        <Button variant="secondary" onClick={onClose}>{t('trade.cancel')}</Button>
      </Modal.Actions>
    </Modal>
  )
}
```

Note: `trade.cancel` (the close label) already exists. If the English/Indonesian test names collide with the Accept/Reject buttons in a single trade, the close button text differs ("Cancel"/"Batal"); the tests above use `/Accept/` and `/Cancel/` role matchers — adjust to `getByText` on the per-trade action if ambiguous.

- [ ] **Step 4: Add the Sidebar badge**

In `src/components/Sidebar.tsx`:

1. Add to `Props`:

```tsx
tradeCount: number
onOpenTrades: () => void
```

2. Destructure from `actions` isn't possible (it's not an ActionSection prop) — add explicit parameters:

```tsx
export default function Sidebar({ state, isMyTurn, onLeave, tradeCount, onOpenTrades, ...actions }: Props) {
```

3. Render the badge button above `PlayerPanel` (after `ActionSection`):

```tsx
<button
  type="button"
  onClick={onOpenTrades}
  className="relative w-full py-1.5 rounded-lg border border-border bg-bg-dark text-sm font-semibold hover:opacity-90"
>
  {t('trade.inbox')}
  {tradeCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-danger text-white text-xs font-bold rounded-full px-1.5">
      {tradeCount}
    </span>
  )}
</button>
```

Note: `t` is already destructured in `Sidebar`; the button uses the `trade.inbox` key from Task 6.

- [ ] **Step 5: Wire `GameView`**

In `src/components/GameView.tsx`:

1. Import `TradeInboxModal`:

```tsx
import TradeInboxModal from './Modals/TradeInboxModal'
```

2. Add state and derive the count:

```tsx
const [showTrades, setShowTrades] = useState(false)
const tradeCount = state.pendingTrades.filter((tr) =>
  game.myPlayerId === null || tr.fromId === game.myPlayerId || tr.toId === game.myPlayerId
).length
```

3. Pass the new props to `Sidebar`:

```tsx
<Sidebar
  ...
  tradeCount={tradeCount}
  onOpenTrades={() => setShowTrades(true)}
/>
```

4. Render the inbox (near the other modals):

```tsx
{showTrades && (
  <TradeInboxModal
    state={state}
    myPlayerId={game.myPlayerId}
    onAccept={(id) => game.acceptTrade(id)}
    onReject={(id) => game.rejectTrade(id)}
    onCancel={(id) => game.cancelTrade(id)}
    onClose={() => setShowTrades(false)}
  />
)}
```

- [ ] **Step 6: Update `Sidebar.test.tsx`**

In `src/components/__tests__/Sidebar.test.tsx`, add to `makeProps()`:

```tsx
tradeCount: 0,
onOpenTrades: noop,
```

and add an assertion that the badge shows a count:

```tsx
it('shows the trade inbox badge count', () => {
  renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} tradeCount={3} />)
  expect(screen.getByText('Trades')).toBeVisible()
  expect(screen.getByText('3')).toBeVisible()
})
```

- [ ] **Step 7: Run all tests + typecheck**

Run: `npx vitest run src/components/__tests__/TradeInboxModal.test.tsx src/components/__tests__/Sidebar.test.tsx && npm run typecheck && npm run test:unit`
Expected: PASS — all unit tests (214 + new) pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/Modals/TradeInboxModal.tsx src/components/__tests__/TradeInboxModal.test.tsx src/components/Sidebar.tsx src/components/GameView.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat: add trade inbox with badge and accept/reject/cancel actions"
```

---

## Self-Review

**Spec coverage:**
- GameState inbox (`pendingTrades`, `nextTradeId`) → Task 1 ✓
- Reducer propose (human stores / bot instant resolve), accept transfers both directions, reject, cancel → Task 3 ✓
- `shouldAcceptTrade` value helper → Task 2 ✓
- Server gate bypass for recipient → Task 5 ✓
- Badge + offers window (non-blocking, local shows all) → Task 8 ✓
- TradeModal request-side properties → Task 7 ✓
- GameApi `acceptTrade`/`rejectTrade`/`cancelTrade` through both hooks → Task 4 ✓
- i18n keys both locales → Task 6 ✓
- `STATE_VERSION` bump 7→8 → Task 1 ✓
- Tests: reducer (Task 3), bot (Task 2), inbox (Task 8), TradeModal (Task 7), server (Task 5) ✓

**Placeholder scan:** All steps contain concrete code; the two "Note:" blocks in Task 5 and Task 8 are decision guidance for a test-env quirk (proposal validation with empty assets; i18n resolution in test matchers), not placeholders — each gives a concrete fallback. No TBDs.

**Type consistency:** `PendingTrade = TradeOffer & { id: number }` used identically in Tasks 1/3; action shapes `{ type: 'ACCEPT_TRADE', tradeId }` match between Tasks 1/3/4/5; `shouldAcceptTrade(state, offer)` signature matches Task 2/3; `TradeInboxModal` props match Task 8 test and GameView wiring; `Sidebar` props `tradeCount`/`onOpenTrades` match Task 8 test. `GameState.pendingTrades` referenced in Tasks 1, 3, 5, 8 consistently.

**Consistency notes for the implementer:**
- Task 3 Step 1 replaces the existing `ProposeTrade` event-log test (added in the popup-trade-button plan) — delete it to avoid a duplicate/conflicting assertion.
- `import { shouldAcceptTrade } from './bot'` in `gameReducer.ts` creates no cycle (`bot.ts` imports only `types`, `data/board`, `rent`).
