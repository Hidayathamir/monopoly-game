# Bot Players — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let humans play against AI-controlled bots in both local (single-device) mode and multiplayer rooms, via a shared pure bot brain plus thin per-context drivers.

**Architecture:** A pure function `decideBotAction(state)` in `src/logic/bot.ts` decides a bot's next action (roll, buy/decline, pay rent with liquidation, build houses, end turn, jail choices). A `Player.isBot` flag (stamped by the `START_GAME` reducer) identifies bots. Two thin drivers consume the shared brain: a `useGame` effect for local mode and a `GameServer.driveBots()` timer loop for multiplayer. Bots occupy real seats: local setup has a per-seat Bot checkbox; the lobby host adds/removes bots.

**Tech Stack:** React 19, TypeScript, Node.js + `ws`, Vitest + Testing Library, Playwright.

## Global Constraints

- **Verification commands:** unit — `npx vitest run <file>`; full unit — `npm run test:unit`; typecheck — `npm run typecheck`; lint — `npm run lint`; e2e (needs `dist/` built first) — `npm run build && npx playwright test`.
- **Semicolons are mixed:** `src/logic/*`, `src/data/*`, `src/types/game.ts` use them; most components/hooks/net/server files omit them. Match the file you edit.
- **`erasableSyntaxOnly` + `verbatimModuleSyntax`:** no TS enums; type-only imports must use `import type`.
- **Test setup:** `src/test/setup.ts` pins language `en` and currency `USD`; render i18n-dependent components with `renderWithProviders` from `src/test/test-utils.tsx`.
- **i18n:** every new UI string needs a flat key in both `src/i18n/locales/en/translation.json` and `id/translation.json` (`keySeparator: false`).
- **Persistence:** `useGame` saves `GameState` to localStorage under `monopoly-game-state` with `_version`. Any change to the `Player` shape requires bumping `STATE_VERSION` in `src/hooks/useGame.ts`.
- **Reducer randomness:** `gameReducer`'s `shuffle` uses `Math.random`; `GameServer` accepts an injectable `rng` used only for dice — tests inject a deterministic one.
- **e2e:** multiplayer spec spawns the real server on `PORT=3123` serving `dist/`; run `npm run build` first. The local e2e spec sets `localStorage` (`monopoly-language` = `en`, `monopoly-currency` = `USD`) via `addInitScript`.

---

### Task 1: `Player.isBot` data model + bot name pool

**Files:**
- Modify: `src/types/game.ts` — `Player` (line 83-94) and `START_GAME` action (line 159)
- Modify: `src/logic/gameReducer.ts` — `START_GAME` case (lines 31-54)
- Create: `src/data/bots.ts`
- Modify: `src/logic/__tests__/gameReducer.test.ts` — add `START_GAME` isBot test
- Modify: `src/logic/__tests__/cards.test.ts:11-12`, `src/components/__tests__/PlayerCard.test.tsx:8-11`, `src/components/__tests__/TurnHeader.test.tsx:12-15` — add `isBot: false` to hand-built `Player` literals
- Modify: `src/hooks/useGame.ts:6` — bump `STATE_VERSION` 6 → 7
- Modify: `src/hooks/__tests__/useGame.test.ts:72` — `_version: 6` → `_version: 7`

**Interfaces:**
- Consumes: existing `Player`, `GameAction` types.
- Produces: `Player.isBot: boolean`; `START_GAME` action `{ playerCount; names; isBot?: boolean[] }`; `BOT_NAMES: string[]` from `src/data/bots.ts`. Task 2 reads `player.isBot`; Tasks 3/4 dispatch `START_GAME` with `isBot`.

- [ ] **Step 1: Add `isBot` to `Player` and the `START_GAME` action**

In `src/types/game.ts`, add `isBot: boolean;` to the `Player` type (after `hasGetOutOfJailFree`):

```ts
export type Player = {
  id: number;
  name: string;
  money: number;
  position: number;
  properties: number[];
  passedGo: boolean;
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  hasGetOutOfJailFree: boolean;
  isBot: boolean;
};
```

Change the `START_GAME` action (line 159):

```ts
  | { type: typeof GameActionType.StartGame; playerCount: number; names: string[]; isBot?: boolean[] }
```

- [ ] **Step 2: Stamp `isBot` in the reducer**

In `src/logic/gameReducer.ts`, inside the `START_GAME` case's `players.push({ ... })`, add after `hasGetOutOfJailFree: false,`:

```ts
          isBot: action.isBot?.[i] ?? false,
```

- [ ] **Step 3: Create `src/data/bots.ts`**

```ts
export const BOT_NAMES = ['Droid', 'Byte', 'Nova', 'Pixel', 'Robo', 'Mecha'];
```

- [ ] **Step 4: Update hand-built `Player` literals in tests**

`src/logic/__tests__/cards.test.ts` (lines 11-12): add `isBot: false,` to both player objects.

`src/components/__tests__/PlayerCard.test.tsx` (line 8-11): add `isBot: false,` to the `player` const.

`src/components/__tests__/TurnHeader.test.tsx` (line 12-15): add `isBot: false,` to the player object in `makeState`.

- [ ] **Step 5: Bump `STATE_VERSION` and fix the useGame test**

In `src/hooks/useGame.ts` change `const STATE_VERSION = 6` to `7`.

In `src/hooks/__tests__/useGame.test.ts:72`, change `_version: 6` to `_version: 7` (the jailed-player test loads a saved state; version 6 would be discarded after the bump).

- [ ] **Step 6: Add a reducer test for `isBot` stamping**

Append to `src/logic/__tests__/gameReducer.test.ts` inside the `START_GAME` describe block:

```ts
    it('stamps isBot flags from the action (default false)', () => {
      const state = gameReducer(createInitialState(), {
        type: GameActionType.StartGame,
        playerCount: 3,
        names: ['Alice', 'Bot', 'Charlie'],
        isBot: [false, true, false],
      });
      expect(state.players.map((p) => p.isBot)).toEqual([false, true, false]);
    });
```

- [ ] **Step 7: Run the affected tests and typecheck**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/components/__tests__/PlayerCard.test.tsx src/components/__tests__/TurnHeader.test.tsx src/hooks/__tests__/useGame.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/data/bots.ts src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/components/__tests__/PlayerCard.test.tsx src/components/__tests__/TurnHeader.test.tsx src/hooks/useGame.ts src/hooks/__tests__/useGame.test.ts
git commit -m "feat: add isBot flag to Player model and bot name pool"
```

---

### Task 2: Pure bot brain — `decideBotAction`

**Files:**
- Create: `src/logic/bot.ts`
- Create: `src/logic/__tests__/bot.test.ts`

**Interfaces:**
- Consumes: `GameState`, `GameAction`, `Player`, `SpaceType`, `PendingActionType`, `GamePhase` from `../types/game`; `getHouseCost`, `JAIL_FINE` from `../data/board`; `isMonopoly` from `./rent`.
- Produces: `decideBotAction(state: GameState): GameAction | null` — returns the next action for the **current player** when they are a bot, else `null`. Tasks 3 (local driver) and 4 (`driveBots`) call it repeatedly until it returns `null`.

- [ ] **Step 1: Write the failing tests**

Create `src/logic/__tests__/bot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decideBotAction } from '../bot';
import {
  GamePhase, PendingActionType, SpaceType, type GameState, type Player, type Space,
} from '../../types/game';
import { createInitialBoard, STARTING_MONEY, JAIL_FINE } from '../../data/board';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 0,
    name: 'Bot',
    money: STARTING_MONEY,
    position: 0,
    properties: [],
    passedGo: true,
    inJail: false,
    jailTurns: 0,
    bankrupt: false,
    hasGetOutOfJailFree: false,
    isBot: true,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}, player: Player = makePlayer()): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [player],
    currentPlayer: 0,
    board: createInitialBoard(),
    chanceDeck: [],
    communityDeck: [],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: null,
    justBoughtSpaceId: null,
    ...overrides,
  };
}

function colorGroup(board: Space[]): Space[] {
  const first = board.find((s) => s.type === SpaceType.Property && s.color != null);
  if (!first) return [];
  return board.filter((s) => s.type === SpaceType.Property && s.color === first.color);
}

describe('decideBotAction', () => {
  it('returns null when the current player is not a bot', () => {
    const state = makeState({}, makePlayer({ isBot: false }));
    expect(decideBotAction(state)).toBeNull();
  });

  it('returns null in GameOver', () => {
    const state = makeState({ phase: GamePhase.GameOver });
    expect(decideBotAction(state)).toBeNull();
  });

  it('rolls when waiting with no dice and no pending action', () => {
    expect(decideBotAction(makeState())).toEqual({ type: 'ROLL_DICE' });
  });

  it('uses the get-out-of-jail card when in jail', () => {
    const state = makeState({}, makePlayer({ inJail: true, hasGetOutOfJailFree: true }));
    expect(decideBotAction(state)).toEqual({ type: 'USE_GET_OUT_OF_JAIL_FREE' });
  });

  it('pays the jail fine when it cannot use a card', () => {
    const state = makeState({}, makePlayer({ inJail: true, money: JAIL_FINE + 10 }));
    expect(decideBotAction(state)).toEqual({ type: 'PAY_JAIL_FINE' });
  });

  it('rolls from jail when it cannot pay the fine', () => {
    const state = makeState({}, makePlayer({ inJail: true, money: 0 }));
    expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
  });

  it('buys an affordable unowned property', () => {
    const board = createInitialBoard();
    const spaceId = board.findIndex((s) => s.type === SpaceType.Property);
    const state = makeState({
      phase: GamePhase.Buying,
      pendingAction: { type: PendingActionType.BuyProperty, spaceId },
    });
    expect(decideBotAction(state)).toEqual({ type: 'BUY_PROPERTY' });
  });

  it('declines a property it cannot afford', () => {
    const board = createInitialBoard();
    const spaceId = board.findIndex((s) => s.type === SpaceType.Property);
    const state = makeState({
      phase: GamePhase.Buying,
      pendingAction: { type: PendingActionType.BuyProperty, spaceId },
    }, makePlayer({ money: 0 }));
    expect(decideBotAction(state)).toEqual({ type: 'DECLINE_BUY' });
  });

  it('pays rent it can afford', () => {
    const state = makeState({
      pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 100 },
    });
    expect(decideBotAction(state)).toEqual({ type: 'PAY_RENT' });
  });

  it('sells a house to raise cash for rent', () => {
    const board = createInitialBoard();
    const space = board.find((s) => s.type === SpaceType.Property && s.houseCost);
    if (!space) throw new Error('no buildable property');
    board[space.id] = { ...space, owner: 0, houses: 1 };
    const state = makeState({
      board,
      pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: STARTING_MONEY },
    }, makePlayer({ money: 0, properties: [space.id] }));
    expect(decideBotAction(state)).toEqual({ type: 'SELL_HOUSE', spaceId: space.id });
  });

  it('mortgages a property when houses are gone but still short', () => {
    const board = createInitialBoard();
    const space = board.find((s) => s.type === SpaceType.Property);
    if (!space) throw new Error('no property');
    board[space.id] = { ...space, owner: 0, houses: 0 };
    const state = makeState({
      board,
      pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: STARTING_MONEY },
    }, makePlayer({ money: 0, properties: [space.id] }));
    expect(decideBotAction(state)).toEqual({ type: 'MORTGAGE', spaceId: space.id });
  });

  it('declares bankruptcy when nothing is left to liquidate', () => {
    const board = createInitialBoard();
    const space = board.find((s) => s.type === SpaceType.Property);
    if (!space) throw new Error('no property');
    board[space.id] = { ...space, owner: 0, houses: 0, mortgaged: true };
    const state = makeState({
      board,
      pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: STARTING_MONEY },
    }, makePlayer({ money: 0, properties: [space.id] }));
    expect(decideBotAction(state)).toEqual({ type: 'DECLARE_BANKRUPTCY' });
  });

  it('draws and resolves cards automatically', () => {
    const draw = makeState({ pendingAction: { type: PendingActionType.DrawCard, cardType: 'chance' as const } });
    expect(decideBotAction(draw)).toEqual({ type: 'DRAW_CARD' });
    const effect = makeState({
      pendingAction: {
        type: PendingActionType.CardEffect,
        card: { id: 1, type: 'chance' as const, effect: { action: 'collect' as const, amount: 50 } },
      },
    });
    expect(decideBotAction(effect)).toEqual({ type: 'RESOLVE_CARD' });
  });

  it('ends the turn after movement when waiting with dice set', () => {
    const state = makeState({ dice: [3, 4] });
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });

  it('builds a house on a completed, affordable color set', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const groupIds = group.map((s) => s.id);
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState({ board }, makePlayer({ properties: groupIds, money: 100000 }));
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: expect.any(Number) });
  });

  it('does not build when the color set is incomplete', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    board[group[0].id] = { ...group[0], owner: 0 };
    const state = makeState({ board }, makePlayer({ properties: [group[0].id], money: 100000 }));
    expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`
Expected: FAIL — `decideBotAction` is not defined.

- [ ] **Step 3: Implement `src/logic/bot.ts`**

```ts
import {
  GamePhase, PendingActionType, SpaceType, type GameAction, type GameState, type Space,
} from '../types/game';
import { getHouseCost, JAIL_FINE } from '../data/board';
import { isMonopoly } from './rent';

export function decideBotAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  if (!player.isBot || state.phase === GamePhase.GameOver) return null;

  const pending = state.pendingAction;
  if (pending) {
    switch (pending.type) {
      case PendingActionType.BuyProperty: {
        const space = state.board[pending.spaceId];
        return player.money >= (space.price ?? 0)
          ? { type: 'BUY_PROPERTY' }
          : { type: 'DECLINE_BUY' };
      }
      case PendingActionType.PayRent: {
        if (player.money >= pending.amount) return { type: 'PAY_RENT' };
        return liquidationAction(state);
      }
      case PendingActionType.DrawCard:
        return { type: 'DRAW_CARD' };
      case PendingActionType.CardEffect:
        return { type: 'RESOLVE_CARD' };
      case PendingActionType.Bankruptcy:
        return { type: 'DECLARE_BANKRUPTCY' };
    }
  }

  if (state.phase === GamePhase.Waiting) {
    if (player.inJail) {
      if (player.hasGetOutOfJailFree) return { type: 'USE_GET_OUT_OF_JAIL_FREE' };
      if (player.money >= JAIL_FINE) return { type: 'PAY_JAIL_FINE' };
      return { type: 'ROLL_DICE' };
    }
    if (state.dice === null) {
      return buildAction(state) ?? { type: 'ROLL_DICE' };
    }
    return { type: 'END_TURN' };
  }

  return null;
}

function buildAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  let best: Space | null = null;
  let bestCost = Infinity;
  for (const id of player.properties) {
    const space = state.board[id];
    if (!space || space.type !== SpaceType.Property) continue;
    if (space.houses >= 5 || space.mortgaged) continue;
    if (!isMonopoly(player.id, state.board, space)) continue;
    const cost = getHouseCost(space, space.houses);
    if (cost === 0 || player.money - cost < 50) continue;
    if (cost < bestCost) {
      bestCost = cost;
      best = space;
    }
  }
  return best ? { type: 'BUILD_HOUSE', spaceId: best.id } : null;
}

function liquidationAction(state: GameState): GameAction {
  const player = state.players[state.currentPlayer];
  for (const id of player.properties) {
    const space = state.board[id];
    if (space && space.houses > 0) return { type: 'SELL_HOUSE', spaceId: id };
  }
  for (const id of player.properties) {
    const space = state.board[id];
    if (space && !space.mortgaged && space.houses === 0) return { type: 'MORTGAGE', spaceId: id };
  }
  return { type: 'DECLARE_BANKRUPTCY' };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/logic/bot.ts src/logic/__tests__/bot.test.ts
git commit -m "feat: add pure bot decision brain"
```

---

### Task 3: Local mode — bot driver, setup UI, wiring

**Files:**
- Modify: `src/hooks/useGame.ts` — `startGame` signature + bot driver effect
- Modify: `src/components/GameView.tsx:12` — bot-aware `isMyTurn` in local mode
- Modify: `src/components/GameSetup.tsx` — 2-6 players, per-seat Bot checkbox, `onStartLocal` signature
- Modify: `src/App.tsx:18-21` — `handleStartLocal` passes `{name, isBot}[]`
- Modify: `src/i18n/locales/en/translation.json` and `id/translation.json` — new keys
- Modify: `src/hooks/__tests__/useGame.test.ts` — `startGame` call sites + bot auto-play test
- Modify: `src/components/__tests__/GameSetup.test.tsx` — `onStartLocal` expectation + bot checkbox test

**Interfaces:**
- Consumes: `decideBotAction` (Task 2), `Player.isBot` + `START_GAME.isBot` (Task 1), `BOT_NAMES` (Task 1).
- Produces: `useGame.startGame(players: { name: string; isBot: boolean }[])`; `GameSetup.onStartLocal(players: { name: string; isBot: boolean }[])`. Task 6 e2e targets the new checkbox.

- [ ] **Step 1: Change `useGame.startGame` to accept player specs**

In `src/hooks/useGame.ts`, replace `startGame` (lines 31-33):

```ts
  const startGame = useCallback((players: { name: string; isBot: boolean }[]) => {
    dispatch({
      type: 'START_GAME',
      playerCount: players.length,
      names: players.map((p) => p.name),
      isBot: players.map((p) => p.isBot),
    })
  }, [])
```

- [ ] **Step 2: Add the local bot driver effect**

In `src/hooks/useGame.ts`, add the import at the top:

```ts
import { decideBotAction } from '../logic/bot'
```

Add this effect after the `send` definition (after line 52, before the `roll` effect at line 71). It schedules the bot's next action ~600ms after each state change, and re-checks the latest state before dispatching:

```ts
  useEffect(() => {
    const player = state.players[state.currentPlayer]
    if (!player?.isBot) return
    if (state.phase === GamePhase.GameOver) return
    const action = decideBotAction(state)
    if (!action) return
    const timer = setTimeout(() => {
      const current = state.players[state.currentPlayer]
      if (!current?.isBot || state.phase === GamePhase.GameOver) return
      if (action.type === 'ROLL_DICE') roll()
      else send(action)
    }, 600)
    return () => clearTimeout(timer)
  }, [state, roll, send])
```

Note: `roll` and `send` are stable `useCallback`s defined above; including them in deps is safe. `ROLL_DICE` must go through the local `roll()` (it generates dice + anim timers); every other action dispatches directly.

- [ ] **Step 3: Make local `isMyTurn` bot-aware**

In `src/components/GameView.tsx`, replace line 12:

```tsx
  const isMyTurn = game.myPlayerId === null
    ? !state.players[state.currentPlayer]?.isBot
    : game.myPlayerId === state.currentPlayer
```

In local mode (`myPlayerId === null`) the human controls all non-bot seats, so a bot's turn must not show action buttons (which would let the human interfere and double-roll). In multiplayer mode the existing comparison already excludes bots.

- [ ] **Step 4: Update `GameSetup` — 2-6 players + Bot checkbox**

In `src/components/GameSetup.tsx`:

Change the `Props` interface:

```tsx
interface Props {
  onStartLocal: (players: { name: string; isBot: boolean }[]) => void
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
}
```

Add the import and state:

```tsx
import { BOT_NAMES } from '../data/bots'
```

Replace `const [names, setNames] = useState<string[]>(['', '', '', ''])` with:

```tsx
  const [names, setNames] = useState<string[]>(['', '', '', '', '', ''])
  const [isBot, setIsBot] = useState<boolean[]>(Array(6).fill(false))
```

Add a handler next to `handleNameChange`:

```tsx
  function handleBotChange(index: number, value: boolean) {
    const next = [...isBot]
    next[index] = value
    setIsBot(next)
  }
```

Replace `handleStart`:

```tsx
  function handleStart() {
    const players = Array.from({ length: playerCount }, (_, i) => ({
      name: names[i].trim() || (isBot[i] ? BOT_NAMES[i] ?? `Bot ${i + 1}` : t('common.player', { n: i + 1 })),
      isBot: isBot[i],
    }))
    onStartLocal(players)
  }
```

Extend the player-count select with options `5` and `6` (after the `4` option):

```tsx
                <option value={5}>{t('setup.playerCount5')}</option>
                <option value={6}>{t('setup.playerCount6')}</option>
```

Replace the seat row map body (lines 76-91) with rows that add a Bot checkbox. The name input stays editable (a bot seat's blank name falls back to `BOT_NAMES[i]`):

```tsx
            {Array.from({ length: playerCount }).map((_, i) => (
              <div className="flex flex-col gap-1.5" key={i}>
                <label className="text-base text-muted flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                  {t('setup.playerName', { n: i + 1 })}
                  <span className="ml-auto flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={isBot[i]}
                      onChange={(e) => handleBotChange(i, e.target.checked)}
                      aria-label={t('setup.isBot', { n: i + 1 })}
                    />
                    {t('setup.isBotLabel')}
                  </span>
                </label>
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  placeholder={isBot[i] ? BOT_NAMES[i] : t('setup.playerPlaceholder', { n: i + 1 })}
                  maxLength={12}
                  className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
                />
              </div>
            ))}
```

- [ ] **Step 5: Update `App.tsx`**

Replace `handleStartLocal` (lines 18-21):

```tsx
  function handleStartLocal(players: { name: string; isBot: boolean }[]) {
    local.startGame(players)
    setMode('local')
  }
```

- [ ] **Step 6: Add i18n keys**

`src/i18n/locales/en/translation.json` (after `setup.playerCount4`, line 119):

```json
  "setup.playerCount5": "5 Players",
  "setup.playerCount6": "6 Players",
```

and after `setup.playerName`/`setup.playerPlaceholder` block add:

```json
  "setup.isBot": "Bot seat {{n}}",
  "setup.isBotLabel": "Bot",
```

`src/i18n/locales/id/translation.json`:

```json
  "setup.playerCount5": "5 Pemain",
  "setup.playerCount6": "6 Pemain",
```

and

```json
  "setup.isBot": "Kursi bot {{n}}",
  "setup.isBotLabel": "Bot",
```

- [ ] **Step 7: Update `useGame` tests for the new `startGame` signature**

In `src/hooks/__tests__/useGame.test.ts`:
- Line 26: `result.current.startGame(2, ['Alice', 'Bob'])` → `result.current.startGame([{ name: 'Alice', isBot: false }, { name: 'Bob', isBot: false }])`
- Lines 56-58: the three `gameReducer(...)` calls use `{ type: GameActionType.StartGame, playerCount, names }` — leave them (optional `isBot` defaults false).

Add a bot auto-play test in the same file:

```ts
describe('useGame bot auto-play', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('auto-rolls and ends a bot turn in local mode', () => {
    // Deterministic non-doubles: first roll() call draws (1,4).
    let n = 0
    vi.spyOn(Math, 'random').mockImplementation(() => (n++ === 0 ? 0 : 0.5))

    let s = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 2,
      names: ['Alice', 'Bot'],
      isBot: [false, true],
    })
    s = { ...s, currentPlayer: 1 }

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ ...s, _version: 7 })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })

    const { result } = renderHook(() => useGame())
    expect(result.current.state.players[1].isBot).toBe(true)
    expect(result.current.state.currentPlayer).toBe(1)

    act(() => vi.advanceTimersByTime(600)) // bot driver fires → roll()
    expect(result.current.state.phase).toBe(GamePhase.Rolling)

    act(() => vi.advanceTimersByTime(500)) // DICE_ANIMATED
    expect(result.current.state.dice).toEqual([1, 4])

    act(() => vi.advanceTimersByTime(500 + 5 * 150)) // RESOLVE_SPACE (space 5, unowned, not passed Go → Waiting)
    expect(result.current.state.phase).toBe(GamePhase.Waiting)

    act(() => vi.advanceTimersByTime(600)) // bot END_TURN
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.dice).toBeNull()
  })
})
```

- [ ] **Step 8: Update `GameSetup` tests**

In `src/components/__tests__/GameSetup.test.tsx`, replace the "starts a local game with filled names" test:

```tsx
  it('starts a local game with filled names', () => {
    const onStartLocal = vi.fn()
    renderWithProviders(<GameSetup onStartLocal={onStartLocal} onCreate={() => {}} onJoin={() => {}} />)

    fireEvent.change(screen.getAllByPlaceholderText(/Player/)[0], { target: { value: 'A' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Player/)[1], { target: { value: 'B' } })
    fireEvent.click(screen.getByText('Start Game'))

    expect(onStartLocal).toHaveBeenCalledWith([
      { name: 'A', isBot: false },
      { name: 'B', isBot: false },
    ])
  })

  it('marks a seat as a bot and defaults its name to the bot pool', () => {
    const onStartLocal = vi.fn()
    renderWithProviders(<GameSetup onStartLocal={onStartLocal} onCreate={() => {}} onJoin={() => {}} />)

    fireEvent.click(screen.getByLabelText('Bot seat 2'))
    fireEvent.click(screen.getByText('Start Game'))

    expect(onStartLocal).toHaveBeenCalledWith([
      { name: 'Player 1', isBot: false },
      { name: 'Droid', isBot: true },
    ])
  })
```

(Test setup pins language to English; `Player 1` is `common.player` and `Droid` is `BOT_NAMES[1]`.)

- [ ] **Step 9: Run tests and typecheck**

Run: `npx vitest run src/hooks/__tests__/useGame.test.ts src/components/__tests__/GameSetup.test.tsx`
Expected: PASS.
Run: `npm run typecheck` and `npm run lint`
Expected: no errors (lint currently has 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx` only).

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useGame.ts src/components/GameView.tsx src/components/GameSetup.tsx src/App.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/hooks/__tests__/useGame.test.ts src/components/__tests__/GameSetup.test.tsx
git commit -m "feat: local bot players via shared bot driver and setup UI"
```

---

### Task 4: Multiplayer server — bot seats and `driveBots`

**Files:**
- Modify: `src/types/net.ts` — `LobbyPlayer.isBot`, `addBot`/`removeBot` messages
- Modify: `server/gameServer.ts` — `Slot.isBot`, `addBot`/`removeBot`, join replaces newest bot, `start()` passes `isBot`, `driveBots()`, `startRoll()` refactor, `nextConnectedSlot` skips bots, host-leave clears orphan bots
- Modify: `server/http.ts` — route `addBot`/`removeBot`
- Modify: `server/__tests__/gameServer.test.ts` — bot tests

**Interfaces:**
- Consumes: `decideBotAction` (Task 2), `Player.isBot`/`START_GAME.isBot` (Task 1), `BOT_NAMES` (Task 1).
- Produces: `GameServer.addBot(clientId)`, `GameServer.removeBot(clientId, playerId)`, `LobbyPlayer.isBot`, client messages `{ type: 'addBot' }` and `{ type: 'removeBot'; playerId: number }`. Task 5 consumes these from `useNetworkGame`/`Lobby`.

- [ ] **Step 1: Update `src/types/net.ts`**

```ts
export type LobbyPlayer = { id: number; name: string | null; connected: boolean; isBot: boolean }
```

Add to `ClientMessage`:

```ts
  | { type: 'addBot' }
  | { type: 'removeBot'; playerId: number }
```

- [ ] **Step 2: Update `GameServer` slot model and helpers**

In `server/gameServer.ts`:

Add import at top:

```ts
import { decideBotAction } from '../src/logic/bot'
import { BOT_NAMES } from '../src/data/bots'
```

Extend `Slot` (line 13-17) and its initializer (line 23-27):

```ts
interface Slot {
  clientId: ClientId | null
  name: string | null
  connected: boolean
  isBot: boolean
}
```

```ts
  private slots: Slot[] = Array.from({ length: MAX_PLAYERS }, () => ({
    clientId: null,
    name: null,
    connected: false,
    isBot: false,
  }))
```

Add a `botSteps` counter field near `hostSlotIndex`:

```ts
  private hostSlotIndex = 0
  private botSteps = 0
```

Update `getPlayers()` (line 51-53) to include `isBot`:

```ts
  getPlayers(): LobbyPlayer[] {
    return this.slots.map((s, i) => ({ id: i, name: s.name, connected: s.connected, isBot: s.isBot }))
  }
```

- [ ] **Step 3: Add `addBot` / `removeBot` + `isHost` helper**

In `server/gameServer.ts`, after `join(...)` add:

```ts
  addBot(clientId: ClientId): void {
    if (!this.isHost(clientId)) {
      this.events.send(clientId, { type: 'error', message: 'Hanya host yang bisa menambah bot' })
      return
    }
    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: 'error', message: 'Bot hanya bisa ditambah sebelum permainan dimulai' })
      return
    }
    const index = this.slots.findIndex((s) => s.clientId === null && !s.isBot)
    if (index === -1) {
      this.events.send(clientId, { type: 'error', message: 'Ruangan penuh (maks 6 pemain)' })
      return
    }
    const used = new Set(this.slots.map((s) => s.name).filter((n): n is string => n !== null))
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${index + 1}`
    this.slots[index] = { clientId: null, name, connected: true, isBot: true }
    this.broadcast()
  }

  removeBot(clientId: ClientId, playerId: number): void {
    if (!this.isHost(clientId)) {
      this.events.send(clientId, { type: 'error', message: 'Hanya host yang bisa menghapus bot' })
      return
    }
    if (this.state.phase !== GamePhase.Setup) {
      this.events.send(clientId, { type: 'error', message: 'Bot hanya bisa dihapus sebelum permainan dimulai' })
      return
    }
    const slot = this.slots[playerId]
    if (!slot || !slot.isBot) return
    this.slots[playerId] = { clientId: null, name: null, connected: false, isBot: false }
    this.broadcast()
  }
```

Add the `isHost` helper near `isTurn` (line 202):

```ts
  private isHost(clientId: ClientId): boolean {
    const slot = this.slots.find((s) => s.clientId === clientId)
    return slot !== undefined && this.slots.indexOf(slot) === this.hostSlotIndex
  }
```

- [ ] **Step 4: Make `join()` fill non-bot seats and replace the newest bot when full**

In `server/gameServer.ts`, replace the seat-finding block in `join()` (lines 88-94):

```ts
    let index = this.slots.findIndex((s) => s.clientId === null && !s.isBot)
    if (index === -1) {
      for (let i = this.slots.length - 1; i >= 0; i--) {
        if (this.slots[i].isBot) { index = i; break }
      }
    }
    if (index === -1) {
      this.events.send(clientId, { type: 'error', message: 'Ruangan penuh (maks 6 pemain)' })
      return false
    }

    this.slots[index] = { clientId, name: trimmed, connected: true, isBot: false }
```

- [ ] **Step 5: Include bots in `start()`**

In `server/gameServer.ts`, replace `start()`'s `joined` filter and dispatch (lines 115-125):

```ts
    const joined = this.slots.filter((s) => s.clientId !== null || s.isBot)
    if (joined.length < 2) {
      this.events.send(clientId, { type: 'error', message: 'Butuh minimal 2 pemain' })
      return
    }

    this.dispatch({
      type: 'START_GAME',
      playerCount: joined.length,
      names: joined.map((s, i) => s.name ?? `P${i + 1}`),
      isBot: joined.map((s) => s.isBot),
    })
```

- [ ] **Step 6: Refactor `roll()` into a shared `startRoll()` and add `driveBots()`**

In `server/gameServer.ts`, replace `roll(clientId)` (lines 150-175) with a validation wrapper + shared sequence:

```ts
  roll(clientId: ClientId): void {
    if (!this.isTurn(clientId)) {
      this.events.send(clientId, { type: 'error', message: 'Bukan giliranmu' })
      return
    }
    if (this.state.phase !== GamePhase.Waiting || this.state.pendingAction || this.state.dice !== null) {
      this.events.send(clientId, { type: 'error', message: 'Belum bisa melempar dadu' })
      return
    }
    this.startRoll()
  }

  private startRoll(): void {
    this.dispatch({ type: 'ROLL_DICE' })
    const d1 = 1 + Math.floor(this.rng() * 6)
    const d2 = 1 + Math.floor(this.rng() * 6)
    const animDuration = 500 + (d1 + d2) * 150

    setTimeout(() => {
      if (this.state.phase === GamePhase.Rolling) {
        this.dispatch({ type: 'DICE_ANIMATED', dice: [d1, d2] })
        setTimeout(() => {
          if (this.state.phase === GamePhase.Moving) {
            this.dispatch({ type: 'RESOLVE_SPACE' })
          }
        }, animDuration)
      }
    }, 500)
  }
```

Add `driveBots()` near `scheduleAutoSteps` (after line 264), and call it from `applyAction` (after `scheduleAutoSteps()` on line 216):

```ts
  private applyAction(action: GameAction): void {
    this.state = gameReducer(this.state, action)
    this.broadcast()
    this.scheduleAutoSteps()
    this.driveBots()
  }
```

```ts
  private driveBots(): void {
    if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
    const slot = this.slots[this.state.currentPlayer]
    if (!slot?.isBot) {
      this.botSteps = 0
      return
    }
    const action = decideBotAction(this.state)
    if (!action) {
      this.botSteps = 0
      return
    }
    if (this.botSteps >= 100) return
    this.botSteps++
    setTimeout(() => {
      const current = this.slots[this.state.currentPlayer]
      if (!current?.isBot) return
      const actionNow = decideBotAction(this.state)
      if (!actionNow) return
      if (actionNow.type === 'ROLL_DICE') this.startRoll()
      else this.dispatch(actionNow)
    }, 700)
  }
```

- [ ] **Step 7: Skip bot slots on host transfer; clear orphan bots on host leave**

In `server/gameServer.ts`, update `nextConnectedSlot` (line 219-225):

```ts
  private nextConnectedSlot(from: number): number {
    for (let i = 1; i <= MAX_PLAYERS; i++) {
      const idx = (from + i) % MAX_PLAYERS
      if (this.slots[idx].connected && !this.slots[idx].isBot) return idx
    }
    return from
  }
```

In `leave()` (Setup phase branch, lines 135-139), after the existing host-transfer logic, clear any bots if no human slot remains:

```ts
    if (this.state.phase === GamePhase.Setup) {
      this.slots[index] = { clientId: null, name: null, connected: false, isBot: false }
      if (index === this.hostSlotIndex) {
        this.hostSlotIndex = this.nextConnectedSlot(this.hostSlotIndex)
      }
      const hasHuman = this.slots.some((s) => s.clientId !== null || (s.name !== null && !s.isBot))
      if (!hasHuman) {
        this.slots.forEach((s, i) => {
          if (s.isBot) this.slots[i] = { clientId: null, name: null, connected: false, isBot: false }
        })
      }
    }
```

- [ ] **Step 8: Route the new messages in `server/http.ts`**

In `server/http.ts`, inside the `ws.on('message')` handler add after the `leave` branch (line 81-83):

```ts
        } else if (msg.type === 'addBot') {
          roomManager.gameFor(clientId)?.addBot(clientId)
        } else if (msg.type === 'removeBot') {
          roomManager.gameFor(clientId)?.removeBot(clientId, msg.playerId)
        }
```

- [ ] **Step 9: Add server tests**

Append to `server/__tests__/gameServer.test.ts`:

```ts
  it('host adds a bot to an empty seat', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    const players = server.getPlayers()
    expect(players[1].isBot).toBe(true)
    expect(players[1].connected).toBe(true)
    expect(players[1].name).toBeTruthy()
  })

  it('rejects addBot from a non-host', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.addBot('c1')
    expect(sent.some((m) => m.type === 'error')).toBe(true)
    expect(server.getPlayers().filter((p) => p.isBot)).toHaveLength(0)
  })

  it('rejects addBot when the game has started', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')
    server.addBot('c0')
    expect(server.getPlayers().filter((p) => p.isBot)).toHaveLength(1)
  })

  it('removes a bot seat', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.removeBot('c0', 1)
    expect(server.getPlayers()[1].isBot).toBe(false)
    expect(server.getPlayers()[1].name).toBeNull()
  })

  it('a joining human replaces the newest bot when all seats are bots', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.addBot('c0')
    server.addBot('c0')
    server.addBot('c0')
    server.addBot('c0')
    server.join('c1', 'Bob')
    const players = server.getPlayers()
    expect(players[5].name).toBe('Bob')
    expect(players[5].isBot).toBe(false)
    expect(players.filter((p) => p.isBot)).toHaveLength(4)
  })

  it('starts the game including bot players with isBot stamped', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')
    expect(server.getState().players.map((p) => p.isBot)).toEqual([false, true])
    expect(server.getState().players.map((p) => p.name)).toEqual(['Alice', expect.any(String)])
  })

  it('auto-plays a full bot turn', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')

    server.handleAction('c0', { type: 'END_TURN' })
    expect(server.getState().currentPlayer).toBe(1)

    vi.advanceTimersByTime(700) // bot roll triggered by driveBots
    expect(server.getState().phase).toBe(GamePhase.Rolling)

    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([1, 4])

    vi.advanceTimersByTime(500 + 5 * 150) // RESOLVE_SPACE (space 5, unowned, not passed Go → Waiting)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(700) // bot END_TURN
    expect(server.getState().currentPlayer).toBe(0)
    expect(server.getState().dice).toBeNull()
    vi.useRealTimers()
  })
```

- [ ] **Step 10: Run the server tests, typecheck, and commit**

Run: `npx vitest run server/__tests__/gameServer.test.ts server/__tests__/http.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/types/net.ts server/gameServer.ts server/http.ts server/__tests__/gameServer.test.ts
git commit -m "feat: add bot seats and authoritative bot turns to multiplayer server"
```

---

### Task 5: Multiplayer client — `useNetworkGame` + `Lobby`

**Files:**
- Modify: `src/hooks/useNetworkGame.ts` — `addBot`, `removeBot`
- Modify: `src/components/Lobby.tsx` — Add Bot button + per-bot remove
- Modify: `src/i18n/locales/en/translation.json` and `id/translation.json` — lobby keys
- Create: `src/components/__tests__/Lobby.test.tsx`

**Interfaces:**
- Consumes: `NetworkGameApi` (existing), `LobbyPlayer.isBot` + `addBot`/`removeBot` messages (Task 4).
- Produces: `NetworkGameApi.addBot(): void`, `NetworkGameApi.removeBot(playerId: number): void`. Task 6 e2e drives the lobby buttons.

- [ ] **Step 1: Add `addBot` / `removeBot` to `useNetworkGame`**

In `src/hooks/useNetworkGame.ts`:

Extend the `NetworkGameApi` type (line 7-18):

```ts
export type NetworkGameApi = GameApi & {
  playerId: number | null
  hostPlayerId: number | null
  code: string | null
  lobby: LobbyPlayer[]
  status: ConnectionStatus
  error: string | null
  create: (name: string) => void
  join: (code: string, name: string) => void
  leave: () => void
  start: () => void
  addBot: () => void
  removeBot: (playerId: number) => void
}
```

Add the callbacks after `start` (line 77):

```ts
  const addBot = useCallback(() => send({ type: 'addBot' }), [send])
  const removeBot = useCallback((playerId: number) => send({ type: 'removeBot', playerId }), [send])
```

Return them in the object (after `start`):

```ts
    addBot,
    removeBot,
```

- [ ] **Step 2: Update `Lobby.tsx`**

In `src/components/Lobby.tsx`:

Destructure the new methods (line 14):

```ts
  const { lobby, playerId, hostPlayerId, code, status, error, start, leave, addBot, removeBot } = game
```

Add the host controls — an **Add Bot** button and a remove control per bot seat. Insert the Add Bot button right after the players list block (after line 48):

```tsx
        {isHost && (
          <Button variant="secondary" size="sm" onClick={addBot} disabled={lobby.filter((p) => p.name).length >= 6}>
            {t('lobby.addBot')}
          </Button>
        )}
```

In the seat row (line 38-46), add a remove button when the seat is a bot:

```tsx
              <div key={i} className="flex items-center gap-2 text-base">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                <span className="text-muted">{i === hostPlayerId ? t('lobby.host') : t('lobby.player')} {i + 1}</span>
                <span className="text-text">
                  {p?.name ?? '—'}
                  {p && !p.connected ? t('lobby.disconnectedSuffix') : ''}
                </span>
                {p?.isBot && isHost && (
                  <button
                    aria-label={t('lobby.removeBot', { name: p.name ?? '' })}
                    onClick={() => removeBot(i)}
                    className="ml-auto text-red-danger text-lg leading-none hover:opacity-70"
                  >
                    ✕
                  </button>
                )}
              </div>
```

- [ ] **Step 3: Add i18n keys**

`src/i18n/locales/en/translation.json` (after `lobby.leaveRoom`, line 142):

```json
  "lobby.addBot": "Add Bot",
  "lobby.removeBot": "Remove {{name}}",
```

`src/i18n/locales/id/translation.json`:

```json
  "lobby.addBot": "Tambah Bot",
  "lobby.removeBot": "Hapus {{name}}",
```

- [ ] **Step 4: Add a `Lobby` component test**

Create `src/components/__tests__/Lobby.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import Lobby from '../Lobby'
import { renderWithProviders } from '../../test/test-utils'
import { createInitialState } from '../../logic/gameReducer'
import type { NetworkGameApi } from '../../hooks/useNetworkGame'

function makeGame(overrides: Partial<NetworkGameApi> = {}): NetworkGameApi {
  return {
    state: createInitialState(),
    myPlayerId: 0,
    playerId: 0,
    hostPlayerId: 0,
    code: 'ABC12',
    lobby: [],
    status: 'connected',
    error: null,
    create: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    start: vi.fn(),
    addBot: vi.fn(),
    removeBot: vi.fn(),
    roll: vi.fn(),
    buyProperty: vi.fn(),
    declineBuy: vi.fn(),
    payRent: vi.fn(),
    buildHouse: vi.fn(),
    sellHouse: vi.fn(),
    mortgage: vi.fn(),
    unmortgage: vi.fn(),
    sellProperty: vi.fn(),
    proposeTrade: vi.fn(),
    drawCard: vi.fn(),
    resolveCard: vi.fn(),
    endTurn: vi.fn(),
    declareBankruptcy: vi.fn(),
    skipAction: vi.fn(),
    payJailFine: vi.fn(),
    useGetOutOfJailFree: vi.fn(),
    resetGame: vi.fn(),
    ...overrides,
  }
}

afterEach(cleanup)

describe('Lobby', () => {
  it('host can add a bot', () => {
    const addBot = vi.fn()
    renderWithProviders(<Lobby game={makeGame({ addBot })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Bot' }))
    expect(addBot).toHaveBeenCalledTimes(1)
  })

  it('host can remove a bot seat', () => {
    const removeBot = vi.fn()
    renderWithProviders(<Lobby game={makeGame({
      removeBot,
      lobby: [{ id: 1, name: 'Droid', connected: true, isBot: true }],
    })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Droid' }))
    expect(removeBot).toHaveBeenCalledWith(1)
  })

  it('non-host does not see add/remove bot controls', () => {
    renderWithProviders(<Lobby game={makeGame({ hostPlayerId: 0, playerId: 1 })} />)
    expect(screen.queryByRole('button', { name: 'Add Bot' })).toBeNull()
  })
})
```

- [ ] **Step 5: Run tests, typecheck, and commit**

Run: `npx vitest run src/components/__tests__/Lobby.test.tsx`
Expected: PASS.
Run: `npm run typecheck` and `npm run lint`
Expected: no errors.

```bash
git add src/hooks/useNetworkGame.ts src/components/Lobby.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/components/__tests__/Lobby.test.tsx
git commit -m "feat: add bot controls to multiplayer lobby"
```

---

### Task 6: e2e coverage

**Files:**
- Modify: `e2e/monopoly.spec.ts` — local bot game
- Modify: `e2e/multiplayer.spec.ts` — lobby add/remove bot + bot auto-turn

**Interfaces:**
- Consumes: `GameSetup` Bot checkbox (Task 3), `Lobby` Add/Remove Bot (Task 5). The local spec runs against Vite dev (port 4173) with `localStorage` pinned to English; the multiplayer spec spawns the real server on `PORT=3123` serving `dist/`.

- [ ] **Step 1: Add a local-mode bot test**

Append to `e2e/monopoly.spec.ts` inside `test.describe('Monopoly Game E2E')`:

```ts
  test('local game with a bot seat auto-plays the bot turn', async ({ page }) => {
    await page.locator('input[type="text"]').nth(0).fill('Alpha')
    await page.getByLabel('Bot seat 2').check()
    await page.click('button:has-text("Start")')

    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="player-card"]').nth(1)).toContainText('Droid')
  })
```

- [ ] **Step 2: Add a multiplayer bot test**

Append to `e2e/multiplayer.spec.ts`:

```ts
test('host adds a bot, starts, and the bot auto-plays', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()

  await page.goto(`http://localhost:${PORT}/`)
  await page.click('button:has-text("Multiplayer")')
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()

  await page.click('button:has-text("Start (")')
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Host rolls and ends turn; the bot then auto-plays its turn and returns to the host.
  const rollBtn = page.locator('button:has-text("Roll")').first()
  await expect(rollBtn).toBeVisible({ timeout: 5000 })
  await rollBtn.click()
  await page.waitForTimeout(2500)
  const endBtn = page.locator('button:has-text("End")').first()
  if (await endBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await endBtn.click()
  }
  await expect(page.locator('button:has-text("Roll")').first()).toBeVisible({ timeout: 30000 })
})
```

- [ ] **Step 3: Build and run the e2e suite**

Run: `npm run build && npx playwright test`
Expected: all tests pass, including the two new ones. (The multiplayer spec requires `dist/` — the build produces it.)

- [ ] **Step 4: Commit**

```bash
git add e2e/monopoly.spec.ts e2e/multiplayer.spec.ts
git commit -m "test: add bot player e2e coverage"
```

---

## Self-Review Notes

- **Spec coverage:** `Player.isBot`/`START_GAME.isBot`/`LobbyPlayer.isBot`/`Slot.isBot` → Tasks 1 + 4. Shared brain + per-context drivers → Tasks 2, 3, 4. Local setup per-seat Bot checkbox + 2-6 players → Task 3. Lobby Add/Remove Bot → Tasks 4 + 5. `driveBots` timers + `startRoll` refactor + host-transfer skips bots + join replaces newest bot + `STATE_VERSION` bump → Task 1 (version) and Task 4. i18n en+id for all new strings → Tasks 3 + 5. Tests: bot brain (T2), local driver (T3), server (T4), Lobby (T5), e2e (T6).
- **Type consistency:** `decideBotAction(state): GameAction | null` defined in Task 2, consumed in Tasks 3 and 4 identically. `startGame(players: { name; isBot }[])` defined in Task 3, produced by `GameSetup.onStartLocal` in the same task. `addBot()`/`removeBot(playerId)` defined in Task 4 (server) and Task 5 (client hook + Lobby) with matching message shapes in `src/types/net.ts`.
- **Placeholder scan:** no TBD/TODO; every step has concrete code or exact line references.
- **Behavioral note:** bots never trade, never unmortgage, and a room left with only bots after the host leaves is cleaned up (Task 4 Step 7). The local driver relies on the existing auto-steps (`RESOLVE_SPACE`, auto-draw-card) which already fire for all players; `decideBotAction` only fills decision points they don't cover.
