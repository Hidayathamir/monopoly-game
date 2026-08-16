# TRADES_ENABLED Feature Config Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a server operator disable the whole trade feature per process via a `TRADES_ENABLED` env var (default disabled; literal `'true'` enables).

**Architecture:** `GameState` gains `tradesEnabled: boolean`, seeded once at room creation from the env var through `main.ts → createServer → RoomManager → GameServer`. The shared `gameReducer` is the source of truth: all four trade actions (`PROPOSE_TRADE`/`ACCEPT_TRADE`/`REJECT_TRADE`/`CANCEL_TRADE`) no-op when the flag is false. `GameServer.handleAction` rejects trade actions early with an error for feedback. The client derives `tradesEnabled` from the broadcast state snapshot and hides the popup Trade button and the Trades inbox button when false.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4, Vitest (jsdom), Node `ws` server via `tsx`.

## Global Constraints

- `TRADES_ENABLED`: the literal string `'true'` enables trades; unset/anything else disables. Default disabled.
- Shared `gameReducer` is the single source of truth; new rules must work in both local (`useGame`) and multiplayer (`server/gameServer.ts`) contexts.
- No TS enums; `verbatimModuleSyntax` → type-only imports via `import type`. `noUnusedLocals`/`noUnusedParameters` are on.
- Semicolon style per file: `src/logic/*`, `src/types/*`, `src/data/*` use semicolons; components/hooks/server files omit them. Match the file you edit.
- No `STATE_VERSION` bump: the `useGame` localStorage hook is deleted; the app is multiplayer-only and `GameState` rides over WebSocket snapshots.
- Server error strings are hardcoded Indonesian and rendered raw by the client — the new error follows that existing convention.
- Each task must leave `npm run typecheck` and `npm run test:unit` green.

---

## File Structure

- `src/types/game.ts` — `GameState.tradesEnabled: boolean`.
- `src/logic/gameReducer.ts` — `createInitialState({ tradesEnabled })` + gate on the 4 trade cases.
- `server/gameServer.ts` — constructor opts `tradesEnabled`; seeds initial state; `handleAction` rejects trade actions when disabled.
- `server/roomManager.ts` — constructor opts `tradesEnabled`; forwards to `GameServer`.
- `server/http.ts` — `createServer(distDir, opts)` forwards to `RoomManager`.
- `server/main.ts` — reads the env var and passes it down.
- `src/components/GameView.tsx` — derives `tradesEnabled` from state; gates `canTrade`; threads the flag.
- `src/components/Sidebar.tsx` — `tradesEnabled` prop; hides the Trades button; forwards.
- `src/components/PlayerPanel.tsx` — forwards `tradesEnabled`.
- `src/components/PlayerCard.tsx` — hides the popup Trade button when disabled.
- `AGENTS.md` — documents the env var.
- Tests: `src/logic/__tests__/gameReducer.test.ts`, `server/__tests__/gameServer.test.ts`, `server/__tests__/roomManager.test.ts`, `server/__tests__/http.test.ts`, `src/components/__tests__/Sidebar.test.tsx`, `src/components/__tests__/PlayerCard.test.tsx`.

---

### Task 1: GameState flag, reducer gate, GameServer seeding

**Files:**
- Modify: `src/types/game.ts` (`GameState` at lines 134-151)
- Modify: `src/logic/gameReducer.ts:12-31` (`createInitialState`), `:505,533,554,564` (the 4 trade cases)
- Modify: `server/gameServer.ts:26-44` (class field + constructor)
- Test: `src/logic/__tests__/gameReducer.test.ts:6-10,39-43,891-989`
- Test: `server/__tests__/gameServer.test.ts:6-18,334-391`

**Interfaces:**
- Consumes: nothing (Task 1 is the foundation).
- Produces:
  - `GameState.tradesEnabled: boolean` in `src/types/game.ts`.
  - `createInitialState({ tradesEnabled = false }: { tradesEnabled?: boolean } = {}): GameState`.
  - `new GameServer(events, { rng?, code?, tradesEnabled? })` — `tradesEnabled?: boolean`, defaults `false`.
  - The 4 trade reducer cases return `state` unchanged when `state.tradesEnabled` is false.

- [ ] **Step 1: Write the failing tests**

Edit `src/logic/__tests__/gameReducer.test.ts`:

1. Give `makeStartedState` an optional initial-state param (lines 6-10):

```ts
function makeStartedState(playerCount = 2, initialState: GameState = createInitialState()): GameState {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana'];
  const s = gameReducer(initialState, { type: GameActionType.StartGame, playerCount, names });
  return { ...s, turnOrder: s.players.map((_, i) => i), currentPlayer: 0 };
}
```

2. In the `trade negotiation` describe (line 891), make `makeSubjects` opt in:

```ts
  function makeSubjects() {
    let state = makeStartedState(2, createInitialState({ tradesEnabled: true }));
    state = buyProperty(state, 0, 1);
    state = buyProperty(state, 1, 3);
    state = setMoney(state, 0, 2000);
    state = setMoney(state, 1, 2000);
    return state;
  }
```

3. Extend the `initializes an empty trade inbox` test (lines 39-43) to assert the default flag:

```ts
  it('initializes an empty trade inbox', () => {
    const state = createInitialState();
    expect(state.pendingTrades).toEqual([]);
    expect(state.nextTradeId).toBe(0);
    expect(state.tradesEnabled).toBe(false);
  });
```

4. Append a new describe block at the end of the file (after the `trade negotiation` describe):

```ts
describe('trade feature disabled', () => {
  function makeSubjectsWithTrade() {
    let state = makeStartedState();
    state = buyProperty(state, 0, 1);
    state = buyProperty(state, 1, 3);
    state = setMoney(state, 0, 2000);
    state = setMoney(state, 1, 2000);
    return { ...state, pendingTrades: [{ id: 0, fromId: 0, toId: 1, offerProperties: [], offerCash: 50, requestProperties: [], requestCash: 0 }] };
  }

  it('PROPOSE_TRADE is a no-op when trades are disabled', () => {
    const state = makeStartedState();
    const s1 = gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [1], offerCash: 50, requestProperties: [], requestCash: 0 },
    });
    expect(s1.pendingTrades).toHaveLength(0);
    expect(s1.nextTradeId).toBe(0);
    expect(s1.eventLog).not.toContainEqual(expect.objectContaining({ key: 'event.tradeProposed' }));
  });

  it('ACCEPT_TRADE is a no-op when trades are disabled', () => {
    const state = makeSubjectsWithTrade();
    const s1 = gameReducer(state, { type: GameActionType.AcceptTrade, tradeId: 0 });
    expect(s1.pendingTrades).toHaveLength(1);
    expect(s1.players[0].money).toBe(state.players[0].money);
    expect(s1.players[1].money).toBe(state.players[1].money);
    expect(s1.eventLog).not.toContainEqual(expect.objectContaining({ key: 'event.tradeAccepted' }));
  });

  it('REJECT_TRADE and CANCEL_TRADE are no-ops when trades are disabled', () => {
    const state = makeSubjectsWithTrade();
    const s1 = gameReducer(state, { type: GameActionType.RejectTrade, tradeId: 0 });
    expect(s1.pendingTrades).toHaveLength(1);
    expect(s1.eventLog).not.toContainEqual(expect.objectContaining({ key: 'event.tradeRejected' }));
    const s2 = gameReducer(state, { type: GameActionType.CancelTrade, tradeId: 0 });
    expect(s2.pendingTrades).toHaveLength(1);
    expect(s2.eventLog).not.toContainEqual(expect.objectContaining({ key: 'event.tradeCancelled' }));
  });
});
```

Edit `server/__tests__/gameServer.test.ts` — extend the `setup()` helper's opts type (lines 6-18) to accept the flag:

```ts
function setup(opts?: { rng?: () => number; code?: string; tradesEnabled?: boolean }) {
```

The four trade tests (lines 334, 350, 362, 378) must opt in by changing their `setup()` call:

```ts
    const { server } = setup({ tradesEnabled: true })
```

and

```ts
    const { server, sent } = setup({ tradesEnabled: true })
```

(lines 335, 351, 363, 379 respectively — keep every other `setup()` call unchanged.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run typecheck && npx vitest run src/logic/__tests__/gameReducer.test.ts server/__tests__/gameServer.test.ts`
Expected: FAIL — type errors (`GameState` has no `tradesEnabled`; `createInitialState` accepts no options; `GameServer` constructor opts reject `tradesEnabled`), plus the disabled-no-op reducer tests fail because `PROPOSE_TRADE` still stores offers.

- [ ] **Step 3: Implement the flag, gate, and seeding**

1. `src/types/game.ts` — add to `GameState` (after `nextTradeId: number;`):

```ts
  tradesEnabled: boolean;
```

2. `src/logic/gameReducer.ts` — `createInitialState`:

```ts
export function createInitialState({ tradesEnabled = false }: { tradesEnabled?: boolean } = {}): GameState {
  return {
    phase: GamePhase.Setup,
    players: [],
    turnOrder: [],
    currentPlayer: 0,
    board: createInitialBoard(),
    chanceDeck: shuffle([...CHANCE_CARDS]),
    communityDeck: shuffle([...COMMUNITY_CARDS]),
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: null,
    justBoughtSpaceId: null,
    pendingTrades: [],
    nextTradeId: 0,
    tradesEnabled,
  };
}
```

3. `src/logic/gameReducer.ts` — gate the four trade cases. Insert as the first statement of each case body (lines 505, 533, 554, 564):

```ts
    case GameActionType.ProposeTrade: {
      if (!state.tradesEnabled) return state;
      const offer = action.offer;
      ...
    case GameActionType.AcceptTrade: {
      if (!state.tradesEnabled) return state;
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      ...
    case GameActionType.RejectTrade: {
      if (!state.tradesEnabled) return state;
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      ...
    case GameActionType.CancelTrade: {
      if (!state.tradesEnabled) return state;
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      ...
```

4. `server/gameServer.ts` — change the field initializer to a declaration (line 27) and seed from the constructor:

```ts
  private state: GameState
```

and the constructor (lines 40-44):

```ts
  constructor(events: GameServerEvents, opts?: { rng?: () => number; code?: string; tradesEnabled?: boolean }) {
    this.state = createInitialState({ tradesEnabled: opts?.tradesEnabled ?? false });
    this.events = events
    this.rng = opts?.rng ?? Math.random
    this.code = opts?.code ?? ''
  }
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS — all reducer trade tests (opt-in + new disabled no-ops) and all server tests (incl. the four trade tests with `tradesEnabled: true`) pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts server/gameServer.ts src/logic/__tests__/gameReducer.test.ts server/__tests__/gameServer.test.ts
git commit -m "feat: add GameState.tradesEnabled flag and gate trade actions in the reducer"
```

---

### Task 2: Env var plumbing + server gate

**Files:**
- Modify: `server/main.ts` (whole file, 6 lines)
- Modify: `server/http.ts:19,29` (`createServer` signature + `RoomManager` construction)
- Modify: `server/roomManager.ts:17-23,25-40` (constructor + `create`)
- Modify: `server/gameServer.ts:240` (`handleAction`)
- Test: `server/__tests__/gameServer.test.ts` (append)
- Test: `server/__tests__/roomManager.test.ts` (append)
- Test: `server/__tests__/http.test.ts` (append)

**Interfaces:**
- Consumes: `createInitialState({ tradesEnabled })` and `GameServer` constructor opts from Task 1.
- Produces:
  - `createServer(distDir = 'dist', opts?: { tradesEnabled?: boolean })`.
  - `new RoomManager(events, { rng?, tradesEnabled? })`.
  - `handleAction` sends `{ type: 'error', message: 'Fitur pertukaran tidak tersedia' }` and returns for any of the 4 trade actions when `!this.state.tradesEnabled`.

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/gameServer.test.ts`:

```ts
  it('rejects trade actions when trades are disabled', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
      fromId: 0, toId: 1, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
    } })
    expect(sent.some((m) => m.type === 'error' && m.message === 'Fitur pertukaran tidak tersedia')).toBe(true)
    expect(server.getState().pendingTrades).toHaveLength(0)
  })
```

(`setup()` with no opts defaults `tradesEnabled` to `false` after Task 1.)

Append to `server/__tests__/roomManager.test.ts`:

```ts
  it('seeds created games with tradesEnabled from config (default false)', () => {
    const { rm } = setup()
    expect(rm.create().game.getState().tradesEnabled).toBe(false)
  })

  it('seeds created games with tradesEnabled true', () => {
    const sent: { clientId: string; message: ServerMessage }[] = []
    const rm = new RoomManager({ send: (clientId, message) => sent.push({ clientId, message }) }, { tradesEnabled: true })
    expect(rm.create().game.getState().tradesEnabled).toBe(true)
  })
```

Append to `server/__tests__/http.test.ts`:

```ts
  it('seeds rooms with the configured tradesEnabled flag', () => {
    const enabled = createServer(dir, { tradesEnabled: true })
    expect(enabled.roomManager.create().game.getState().tradesEnabled).toBe(true)
    const disabled = createServer(dir)
    expect(disabled.roomManager.create().game.getState().tradesEnabled).toBe(false)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run typecheck && npx vitest run server/__tests__/gameServer.test.ts server/__tests__/roomManager.test.ts server/__tests__/http.test.ts`
Expected: FAIL — type errors (`createServer`/`RoomManager` opts don't exist) and the disabled-rejection test fails (no error sent yet).

- [ ] **Step 3: Implement the plumbing and gate**

1. `server/main.ts`:

```ts
import { createServer } from './http'

const port = Number(process.env.PORT ?? 3001)
const distDir = process.env.DIST_DIR ?? 'dist'
const tradesEnabled = process.env.TRADES_ENABLED === 'true'
const { httpServer } = createServer(distDir, { tradesEnabled })
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Monopoli server aktif di http://0.0.0.0:${port}`)
})
```

2. `server/http.ts` — signature and `RoomManager` construction:

```ts
export function createServer(distDir = 'dist', opts?: { tradesEnabled?: boolean }) {
  ...
  const roomManager = new RoomManager({ send }, { tradesEnabled: opts?.tradesEnabled ?? false })
```

3. `server/roomManager.ts` — constructor and `create`:

```ts
  private tradesEnabled: boolean

  constructor(
    events: { send(clientId: ClientId, message: ServerMessage): void },
    opts?: { rng?: () => number; tradesEnabled?: boolean },
  ) {
    this.events = events
    this.rng = opts?.rng ?? Math.random
    this.tradesEnabled = opts?.tradesEnabled ?? false
  }

  create(): { code: string; game: GameServer } {
    const code = this.generateCode()
    const game = new GameServer(
      {
        broadcastState: (state) =>
          this.broadcastToRoom(code, { type: ServerMessageType.State, state }),
        broadcastLobby: (players, hostPlayerId) =>
          this.broadcastToRoom(code, { type: ServerMessageType.Lobby, players, hostPlayerId }),
        send: (clientId, msg) => this.events.send(clientId, msg),
      },
      { code, rng: this.rng, tradesEnabled: this.tradesEnabled },
    )
    ...
  }
```

4. `server/gameServer.ts` — at the very top of `handleAction` (line 240), before the `RollDice` branch:

```ts
  handleAction(clientId: ClientId, action: GameAction): void {
    if (
      !this.state.tradesEnabled &&
      (action.type === GameActionType.ProposeTrade ||
        action.type === GameActionType.AcceptTrade ||
        action.type === GameActionType.RejectTrade ||
        action.type === GameActionType.CancelTrade)
    ) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Fitur pertukaran tidak tersedia' })
      return
    }
    if (action.type === GameActionType.RollDice) {
    ...
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/main.ts server/http.ts server/roomManager.ts server/gameServer.ts server/__tests__/gameServer.test.ts server/__tests__/roomManager.test.ts server/__tests__/http.test.ts
git commit -m "feat: plumb TRADES_ENABLED env var and reject trade actions when disabled"
```

---

### Task 3: Client UI gating

**Files:**
- Modify: `src/components/GameView.tsx:16,33-53`
- Modify: `src/components/Sidebar.tsx:11-33,57-69`
- Modify: `src/components/PlayerPanel.tsx:6-13,41-52`
- Modify: `src/components/PlayerCard.tsx:30-41,97-127,171-175`
- Test: `src/components/__tests__/Sidebar.test.tsx:24-42` (makeProps) + append
- Test: `src/components/__tests__/PlayerCard.test.tsx:45-87` (append)

**Interfaces:**
- Consumes: `GameState.tradesEnabled` from Task 1.
- Produces:
  - `Sidebar({ ..., tradesEnabled?: boolean })` (default `true`); hides the Trades button when `false`.
  - `PlayerPanel({ ..., tradesEnabled?: boolean })` (default `true`); forwards.
  - `PlayerCard({ ..., tradesEnabled?: boolean })` (default `true`); popup Trade button renders only when `player.id !== currentPlayerId && tradesEnabled`.

- [ ] **Step 1: Write the failing tests**

`src/components/__tests__/Sidebar.test.tsx` — add `tradesEnabled: true` to `makeProps()` (lines 24-42) and append:

```tsx
  it('hides the trades button when trades are disabled', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} tradesEnabled={false} />)
    expect(screen.queryByText('Trades')).toBeNull()
  })
```

`src/components/__tests__/PlayerCard.test.tsx` — append inside the `PlayerCard popup trade button` describe:

```tsx
  it('hides the Trade button when trades are disabled', () => {
    openPopup({ tradesEnabled: false })
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/Sidebar.test.tsx src/components/__tests__/PlayerCard.test.tsx`
Expected: FAIL — type error (`tradesEnabled` is not a prop) and the new assertions find the buttons still rendered.

- [ ] **Step 3: Implement the gating**

1. `src/components/GameView.tsx` — derive the flag and gate `canTrade` (line 16) and add the prop to `Sidebar`:

```tsx
  const tradesEnabled = state.tradesEnabled
  const canTrade = tradesEnabled && isMyTurn && state.phase === GamePhase.Waiting && !state.pendingAction
```

and in the `<Sidebar ...>` props (near `canTrade={canTrade}` at line 39):

```tsx
          tradesEnabled={tradesEnabled}
```

2. `src/components/Sidebar.tsx` — add the prop to `Props` (after `canTrade?: boolean`), destructure with a default, hide the button, and forward:

```tsx
  tradesEnabled?: boolean
```

```tsx
export default function Sidebar({ state, isMyTurn, onLeave, exitKeys, onProposeTrade, canTrade = true, tradesEnabled = true, tradeCount, onOpenTrades, ...actions }: Props) {
```

Wrap the badge button (lines 57-68) in a guard:

```tsx
        {tradesEnabled && (
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
        )}
```

Forward to `PlayerPanel` (line 69):

```tsx
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} onProposeTrade={onProposeTrade} canTrade={canTrade} tradesEnabled={tradesEnabled} />
```

3. `src/components/PlayerPanel.tsx` — add the prop, destructure with a default, forward:

```tsx
interface Props {
  state: GameState
  playerColors: string[]
  onProposeTrade: (playerId: number) => void
  canTrade: boolean
  tradesEnabled?: boolean
}
```

```tsx
export default function PlayerPanel({ state, playerColors, onProposeTrade, canTrade, tradesEnabled = true }: Props) {
```

and pass to `PlayerCard` (in the `.map`):

```tsx
              canTrade={canTrade && !player.bankrupt}
              tradesEnabled={tradesEnabled}
```

4. `src/components/PlayerCard.tsx` — add the prop to `PlayerCardProps`, destructure with a default, pass to `PlayerPopup`, and gate the button:

```tsx
interface PlayerCardProps {
  player: Player
  isCurrent: boolean
  color: string
  diff?: { diff: number; key: number } | null
  board: Space[]
  canTrade?: boolean
  currentPlayerId?: number
  onProposeTrade?: (playerId: number) => void
  tradesEnabled?: boolean
}
```

```tsx
export default function PlayerCard({ player, isCurrent, color, diff, board, canTrade = true, currentPlayerId, onProposeTrade, tradesEnabled = true }: PlayerCardProps) {
```

```tsx
            canTrade={canTrade}
            currentPlayerId={currentPlayerId}
            onProposeTrade={handleTrade}
            tradesEnabled={tradesEnabled}
```

`PlayerPopup` signature and body (lines 117-127, 171-175):

```tsx
function PlayerPopup({ player, owned, color, rect, onEnter, onLeave, canTrade, currentPlayerId, onProposeTrade, tradesEnabled }: {
  player: Player
  owned: Space[]
  color: string
  rect: DOMRect
  onEnter: () => void
  onLeave: () => void
  canTrade: boolean
  currentPlayerId?: number
  onProposeTrade?: () => void
  tradesEnabled: boolean
}) {
```

```tsx
      {player.id !== currentPlayerId && tradesEnabled && (
        <Button size="sm" disabled={!canTrade} onClick={onProposeTrade} className="w-full mt-2">
          {t('action.trade')}
        </Button>
      )}
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS — the new hidden-button tests pass and every existing component test still passes (`Sidebar`/`PlayerPanel`/`PlayerCard` default `tradesEnabled` to `true`).

- [ ] **Step 5: Commit**

```bash
git add src/components/GameView.tsx src/components/Sidebar.tsx src/components/PlayerPanel.tsx src/components/PlayerCard.tsx src/components/__tests__/Sidebar.test.tsx src/components/__tests__/PlayerCard.test.tsx
git commit -m "feat: hide trade UI when the trades feature is disabled"
```

---

### Task 4: Document TRADES_ENABLED

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the env var from Task 2.
- Produces: a documented operator-facing config.

- [ ] **Step 1: Edit AGENTS.md**

In the `## Commands` section, directly under the `npm run server` bullet, add:

```markdown
- `TRADES_ENABLED=true npm run server` — enables the trade feature (env `TRADES_ENABLED`, default disabled; anything other than the literal `true` disables trades for every room on the server)
```

- [ ] **Step 2: Verify nothing broke**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS (unchanged).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document TRADES_ENABLED server config"
```

---

## Self-Review

**Spec coverage:**
- Env var → plumbing (main/http/roomManager/gameServer) → Task 2 ✓
- `GameState.tradesEnabled` + `createInitialState({ tradesEnabled })` default false → Task 1 ✓
- Reducer no-ops all 4 trade actions when disabled → Task 1 ✓
- Server `handleAction` rejects trade actions with the Indonesian error → Task 2 ✓
- Client hides popup Trade button + Trades inbox button from the state snapshot → Task 3 ✓
- `canTrade` gated by `tradesEnabled` → Task 3 ✓
- Tests: reducer disabled no-ops (Task 1), server rejection (Task 2), propagation roomManager/http (Task 2), Sidebar/PlayerCard hidden (Task 3) ✓
- AGENTS.md documentation → Task 4 ✓
- No `STATE_VERSION` bump (useGame deleted) — noted in Global Constraints ✓
- e2e note: no e2e touches trades today; future trade e2e must set `TRADES_ENABLED=true` — carried in the AGENTS.md bullet ✓

**Placeholder scan:** Every step has concrete code or an exact edit target with current line numbers; no TBDs. The `...` in Task 1 Step 3 reducer cases means "keep the rest of the existing case body unchanged" — the insertion point is the first statement of each case.

**Type consistency:** `tradesEnabled: boolean` on `GameState` (Task 1) is read in `GameView` (Task 3) via `state.tradesEnabled`. `createInitialState({ tradesEnabled })` is called in `gameReducer.test.ts` (Task 1) and `gameServer.ts` (Task 1). `GameServer`/`RoomManager`/`createServer` constructor opts all use the same `tradesEnabled?: boolean` shape (Tasks 1-2). `Sidebar`/`PlayerPanel`/`PlayerCard` all use `tradesEnabled?: boolean` defaulting `true` (Task 3). The four trade action types in the `handleAction` gate (Task 2) match `GameActionType.ProposeTrade`/`AcceptTrade`/`RejectTrade`/`CancelTrade` used by the reducer cases (Task 1).
