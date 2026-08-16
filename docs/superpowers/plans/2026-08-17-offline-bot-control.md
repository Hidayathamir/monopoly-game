# Offline Players Controlled by a Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a human player disconnects mid-game, an AI bot plays their turns (after a 30s grace period) with unmistakable `(bot)` labeling in the log and UI, and the human takes back control on rejoin.

**Architecture:** Add a `Player.botControlled` flag to shared `GameState`, flipped by the server through a new `SET_BOT_CONTROL` reducer action on disconnect/rejoin. `decideBotAction` (the existing bot brain) accepts bot-controlled players. The server's `driveBots` drives offline-human seats with a 30s grace before its first move (then normal 700ms steps) and the old `skipLeftPlayers` auto-skip is removed. Reducer log entries attributed to a bot-controlled actor carry `params.bot: true`; `resolveLogEntry` renders it as `hp (bot)`. UI shows a 🤖 BOT badge and a bot-playing turn status.

**Tech Stack:** React 19 + TypeScript + Vite 8 + Tailwind v4 client; authoritative Node.js `ws` server. Shared logic in `src/logic/gameReducer.ts` runs in both contexts.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-17-offline-bot-control-design.md` (approved).
- **No TS enums** — `erasableSyntaxOnly: true`; use `const` objects + derived union types. Wire values of `GameActionType` are a contract — never change existing values.
- **`verbatimModuleSyntax: true`** — type-only imports must use `import type`. `noUnusedLocals`/`noUnusedParameters` are on.
- **i18n** — every user-facing string in BOTH `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys, `keySeparator: false`).
- **Semicolon style** — match the file: `src/logic/*`, `src/data/*`, `src/types/*` use semicolons; `server/*`, `src/components/*`, `src/i18n/log.ts` omit them.
- **Verification** — run `npm run typecheck`, `npm run test:unit`, and `npm run lint`; all must pass. Unit tests live in colocated `__tests__/` dirs.
- `Player` shape changes ⇒ update every hand-built `Player` literal in tests (found via `npm run typecheck`). There is **no** `STATE_VERSION`: `useGame` was deleted (multiplayer-only; state rides WebSocket snapshots).
- Bots on real bot seats (`isBot: true`), `skipLeftPlayers` behavior, and the trade wire contract are explicitly out of scope to change beyond what each task states.

---

### Task 1: `Player.botControlled` + `SET_BOT_CONTROL` reducer action

**Files:**
- Modify: `src/types/game.ts` (`Player`, `GameActionType`, `GameAction`)
- Modify: `src/logic/gameReducer.ts` (`StartGame` init, new `SetBotControl` case)
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`
- Modify (fixtures): `src/logic/__tests__/cards.test.ts:11-12`, `src/logic/__tests__/bot.test.ts:10-25`, `src/components/__tests__/TurnHeader.test.tsx:12-15`, `src/components/__tests__/PlayerCard.test.tsx:10-13`
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Player.botControlled: boolean`; `GameActionType.SetBotControl = 'SET_BOT_CONTROL'`; union member `{ type: typeof GameActionType.SetBotControl; playerId: number; controlled: boolean }`; reducer case handles it (sets flag, appends `event.playerOffline`/`event.playerBack`, idempotent); `StartGame` initializes `botControlled: false`; i18n keys `event.playerOffline`, `event.playerBack`.

- [ ] **Step 1: Write the failing reducer tests**

Append a `describe('SET_BOT_CONTROL')` block to `src/logic/__tests__/gameReducer.test.ts` (after `makeStartedState` and the `setMoney`/`setPosition` helpers, inside the top-level `describe`):

```ts
describe('SET_BOT_CONTROL', () => {
  it('marks a player as bot-controlled and logs the offline notice', () => {
    const state = gameReducer(makeStartedState(2), {
      type: GameActionType.SetBotControl,
      playerId: 0,
      controlled: true,
    });
    expect(state.players[0].botControlled).toBe(true);
    expect(state.eventLog.at(-1)).toEqual({ key: 'event.playerOffline', params: { name: 'Alice' } });
  });

  it('is idempotent when the player is already bot-controlled', () => {
    let state = gameReducer(makeStartedState(2), { type: GameActionType.SetBotControl, playerId: 0, controlled: true });
    state = gameReducer(state, { type: GameActionType.SetBotControl, playerId: 0, controlled: true });
    expect(state.players[0].botControlled).toBe(true);
    expect(state.eventLog.filter((e) => e.key === 'event.playerOffline')).toHaveLength(1);
  });

  it('clears bot-control and logs the return notice', () => {
    let state = gameReducer(makeStartedState(2), { type: GameActionType.SetBotControl, playerId: 0, controlled: true });
    state = gameReducer(state, { type: GameActionType.SetBotControl, playerId: 0, controlled: false });
    expect(state.players[0].botControlled).toBe(false);
    expect(state.eventLog.at(-1)).toEqual({ key: 'event.playerBack', params: { name: 'Alice' } });
  });

  it('is idempotent clearing an already-human player', () => {
    const state = gameReducer(makeStartedState(2), { type: GameActionType.SetBotControl, playerId: 0, controlled: false });
    expect(state.eventLog.filter((e) => e.key === 'event.playerBack')).toHaveLength(0);
  });
});
```

Also add one `START_GAME` assertion (inside the existing `START_GAME` describe) that the new flag initializes false:

```ts
it('initializes botControlled to false', () => {
  const state = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] });
  expect(state.players.every((p) => p.botControlled === false)).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — `GameActionType.SetBotControl` is undefined (type error) and the tests cannot even compile.

- [ ] **Step 3: Add the type changes**

In `src/types/game.ts`:

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
  getOutOfJailFreeCards: number;
  isBot: boolean;
  botControlled: boolean;
};
```

Add to the `GameActionType` const object:

```ts
  SetBotControl: 'SET_BOT_CONTROL',
```

Add to the `GameAction` union:

```ts
  | { type: typeof GameActionType.SetBotControl; playerId: number; controlled: boolean }
```

- [ ] **Step 4: Implement the reducer**

In `src/logic/gameReducer.ts`, `StartGame` player construction, after `isBot`:

```ts
          isBot: action.isBot?.[i] ?? false,
          botControlled: false,
```

Add a new case before `default:` (after `UseGetOutOfJailFree`/before `default`):

```ts
    case GameActionType.SetBotControl: {
      const target = state.players[action.playerId];
      if (!target || target.botControlled === action.controlled) return state;
      const newPlayers = [...state.players];
      newPlayers[action.playerId] = { ...target, botControlled: action.controlled };
      const logKey = action.controlled ? 'event.playerOffline' : 'event.playerBack';
      return {
        ...state,
        players: newPlayers,
        eventLog: [...state.eventLog, { key: logKey, params: { name: target.name } }],
      };
    }
```

- [ ] **Step 5: Fix `Player` literals in test fixtures**

Add `botControlled: false,` to each hand-built `Player` literal:

- `src/logic/__tests__/cards.test.ts` lines 11 and 12 (both player objects).
- `src/logic/__tests__/bot.test.ts` `makePlayer` (after `isBot: true,` at line 22).
- `src/components/__tests__/TurnHeader.test.tsx` line 14 (after `isBot: false,`).
- `src/components/__tests__/PlayerCard.test.tsx` line 12 (after `isBot: false,`).

- [ ] **Step 6: Add the i18n keys**

In `src/i18n/locales/en/translation.json`:

```json
  "event.playerOffline": "{{name}} went offline — a bot will play their turn",
  "event.playerBack": "{{name}} is back — taking back control",
```

In `src/i18n/locales/id/translation.json`:

```json
  "event.playerOffline": "{{name}} offline — bot akan memainkan gilirannya",
  "event.playerBack": "{{name}} kembali — kendali diambil lagi",
```

(Place next to the existing `event.*` // flat keys; exact key order does not matter.)

- [ ] **Step 7: Run the tests and typecheck**

Run: `npm run typecheck`
Expected: PASS (no missing `botControlled` on any `Player` literal).

Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/logic/__tests__/cards.test.ts src/logic/__tests__/bot.test.ts src/logic/__tests__/gameReducer.test.ts src/components/__tests__/TurnHeader.test.tsx src/components/__tests__/PlayerCard.test.tsx
git commit -m "feat: add botControlled player flag and SET_BOT_CONTROL reducer action"
```

---

### Task 2: Label bot-controlled actors in the event log + render `(bot)`

**Files:**
- Create: `src/logic/logEntries.ts`
- Modify: `src/types/game.ts` (`LogEntry.params` widening)
- Modify: `src/logic/gameReducer.ts` (sweep actor log entries)
- Modify: `src/logic/cards.ts` (sweep actor log entries)
- Modify: `src/i18n/log.ts` (`bot` param handling)
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`
- Test (new): `src/i18n/__tests__/log.test.ts`
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `Player.botControlled` from Task 1.
- Produces: `actorEntry(key, player, extra?)` and `turnEntry(players, nextId)` from `src/logic/logEntries.ts`; `LogEntry.params` type `Record<string, string | number | boolean>`; `resolveLogEntry` renders `{{name}} (bot)` for `params.bot`; i18n key `log.botName`.

- [ ] **Step 1: Write the failing tests**

New file `src/i18n/__tests__/log.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import i18n from '../index';
import { resolveLogEntry } from '../log';
import type { LogEntry } from '../../types/game';

function formatMoney(n: number | undefined): string {
  return n == null ? '' : `$${n}`;
}

describe('resolveLogEntry', () => {
  it('appends (bot) to a bot-controlled actor', () => {
    const entry: LogEntry = { key: 'event.rolled', params: { name: 'hp', d1: 6, d2: 5, total: 11, bot: true } };
    expect(resolveLogEntry(entry, i18n.t.bind(i18n), formatMoney)).toBe('hp (bot) rolled 6+5=11');
  });

  it('leaves normal entries unchanged', () => {
    const entry: LogEntry = { key: 'event.rolled', params: { name: 'Hidayat', d1: 4, d2: 3, total: 7 } };
    expect(resolveLogEntry(entry, i18n.t.bind(i18n), formatMoney)).toBe('Hidayat rolled 4+3=7');
  });

  it('renders the offline notice with the player name', () => {
    const entry: LogEntry = { key: 'event.playerOffline', params: { name: 'hp' } };
    expect(resolveLogEntry(entry, i18n.t.bind(i18n), formatMoney)).toBe('hp went offline — a bot will play their turn');
  });
});
```

Add to `src/logic/__tests__/gameReducer.test.ts` (inside the top-level `describe`):

```ts
describe('event log bot labeling', () => {
  it('marks roll entries of a bot-controlled actor with bot: true', () => {
    let state = makeStartedState(2);
    state = gameReducer(state, { type: GameActionType.SetBotControl, playerId: 0, controlled: true });
    state = gameReducer(state, { type: GameActionType.RollDice });
    state = gameReducer(state, { type: GameActionType.DiceAnimated, dice: [4, 3] });
    const roll = state.eventLog.find((e) => e.key === 'event.rolled');
    expect(roll?.params?.bot).toBe(true);
  });

  it('does not mark entries of a human-controlled actor', () => {
    let state = makeStartedState(2);
    state = gameReducer(state, { type: GameActionType.RollDice });
    state = gameReducer(state, { type: GameActionType.DiceAnimated, dice: [4, 3] });
    const roll = state.eventLog.find((e) => e.key === 'event.rolled');
    expect(roll?.params?.bot).toBeUndefined();
  });

  it('labels the turn entry when the next player is bot-controlled', () => {
    let state = makeStartedState(2);
    state = gameReducer(state, { type: GameActionType.SetBotControl, playerId: 1, controlled: true });
    state = { ...state, turnOrder: [0, 1], currentPlayer: 0, dice: [4, 3] };
    state = gameReducer(state, { type: GameActionType.EndTurn });
    const turn = state.eventLog.find((e) => e.key === 'event.turn');
    expect(turn?.params?.bot).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit -- src/i18n/__tests__/log.test.ts`
Expected: FAIL — `resolveLogEntry` does not render `(bot)`; the roll-entry assertion returns `'hp rolled 6+5=11'`.

Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts`
Expected: the new `bot` assertions FAIL (params have no `bot`).

- [ ] **Step 3: Create the shared log-entry helpers**

New file `src/logic/logEntries.ts` (semicolons):

```ts
import type { LogEntry, Player } from '../types/game';

export function actorEntry(
  key: string,
  player: Player,
  extra: Record<string, string | number> = {},
): LogEntry {
  return {
    key,
    params: { name: player.name, ...(player.botControlled ? { bot: true } : {}), ...extra },
  };
}

export function turnEntry(players: Player[], nextId: number): LogEntry {
  const p = players[nextId];
  return { key: 'event.turn', params: { name: p.name, ...(p.botControlled ? { bot: true } : {}) } };
}
```

- [ ] **Step 4: Widen `LogEntry.params` and update `resolveLogEntry`**

In `src/types/game.ts`:

```ts
export type LogEntry = { key: string; params?: Record<string, string | number | boolean> };
```

In `src/i18n/log.ts` replace the body of `resolveLogEntry` (keep `MONEY_PARAM_KEYS`, `cardKeyForId`):

```ts
export function resolveLogEntry(
  entry: LogEntry,
  t: TFunction,
  formatMoney: (amount: number | undefined) => string,
): string {
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(entry.params ?? {})) {
    if (key === 'bot') continue
    if (key === 'spaceId') {
      params[key] = t(`board.space.${value}`)
    } else if (key === 'cardId') {
      params[key] = t(cardKeyForId(Number(value)))
    } else if (MONEY_PARAM_KEYS.has(key)) {
      params[key] = formatMoney(typeof value === 'number' ? value : Number(value))
    } else {
      params[key] = value as string | number
    }
  }
  if (entry.params?.bot && params.name !== undefined) {
    params.name = t('log.botName', { name: params.name })
  }
  return t(entry.key, params)
}
```

Add i18n key `log.botName` (`{{name}} (bot)`) to both `en` and `id` locale files (identical value in both).

- [ ] **Step 5: Sweep actor log entries in `gameReducer.ts`**

Add at the top of the file (after the imports):

```ts
import { actorEntry, turnEntry } from './logEntries';
```

Standard sites — replace each `{ key: 'event.X', params: { name: player.name, ... } }` entry with
`actorEntry('event.X', player, { ...extras })` (or `actorEntry('event.X', player)` when there are no extras).
Note the site at line 694 uses `state.players[state.currentPlayer]` (no local `player` binding) — pass that expression
directly as the player argument: `actorEntry('event.doublesAgain', state.players[state.currentPlayer])`.

| line | key | extra params passed to `actorEntry` |
|------|-----|--------------------------------------|
| 88   | `event.jailBreakDoubles` | — |
| 92   | `event.passedGo` | `{ amount: GO_SALARY }` |
| 116  | `event.jailForcedOut` | — |
| 120  | `event.passedGo` | `{ amount: GO_SALARY }` |
| 154* | `event.jailFailed` | `{ attempt: newTurns }` (see turn-table note below — also has a turn entry) |
| 166  | `event.rolledAimed` | `{ d1: dice[0], d2: dice[1], total, target, luck }` |
| 167  | `event.rolled` | `{ d1: dice[0], d2: dice[1], total }` |
| 175  | `event.passedGo` | `{ amount: GO_SALARY }` |
| 199* | `event.tripleDoubles` | — (also has a turn entry) |
| 250* | `event.toJail` | — (also has a turn entry) |
| 271  | `event.freeParkingJackpot` | `{ amount: pot }` |
| 286  | `event.incomeTax` | `{ amount: taxAmount, money: player.money }` |
| 287  | `event.luxuryTax` | `{ amount: taxAmount }` |
| 328  | `event.mustCircleBoard` | — |
| 375  | `event.bought` | `{ spaceId: space.id, amount: space.price ?? 0 }` |
| 426  | `event.builtHotel` / `event.builtHouse` | `{ spaceId: space.id, amount: cost }` |
| 443  | `event.soldHouse` | `{ spaceId: space.id, amount: refund }` |
| 460  | `event.mortgaged` | `{ spaceId: space.id, amount: mortgageValue }` |
| 478  | `event.unmortgaged` | `{ spaceId: space.id, amount: unmortgageCost }` |
| 502  | `event.soldToBank` | `{ spaceId: space.id, amount: sellValue }` |
| 635  | `event.freeParkingJackpot` | `{ amount: pot }` |
| 656* | `event.paidJailFine` | `{ amount: JAIL_FINE }` (also has a turn entry) |
| 676* | `event.usedJailCard` | — (also has a turn entry) |
| 694  | `event.doublesAgain` | — (player = `state.players[state.currentPlayer]`) |
| 739  | `event.bankruptcy` | — |

Multi-name entries — replace with the exact code (keeps `bot` on the actor's `name` only):

- Line 316 `event.ownerInJail`:
```ts
{ key: 'event.ownerInJail', params: { owner: owner.name, name: currentPlayer.name, ...(currentPlayer.botControlled ? { bot: true } : {}) } }
```
- Line 324 `event.monopolyRent`:
```ts
{ key: 'event.monopolyRent', params: { owner: owner.name, name: currentPlayer.name, ...(currentPlayer.botControlled ? { bot: true } : {}) } }
```
- Line 399 `event.paidRent`:
```ts
{ key: 'event.paidRent', params: { name: player.name, ...(player.botControlled ? { bot: true } : {}), amount: pending.amount, owner: state.players[space.owner!].name } }
```
- Line 742 `event.bankruptcyTransfer`:
```ts
{ key: 'event.bankruptcyTransfer', params: { name: player.name, ...(player.botControlled ? { bot: true } : {}), creditor: newPlayers[creditorId].name, amount: liquidationTotal } }
```
- Line 753 `event.bankruptcyWin`:
```ts
{ key: 'event.bankruptcyWin', params: { name: player.name, ...(player.botControlled ? { bot: true } : {}), winner: activePlayers[0]?.name ?? '' } }
```

`event.turn` sites — replace each with `turnEntry(<players>, <nextId>)`:

| line | expression |
|------|-----------|
| 154  | `turnEntry(state.players, nextPlayer)` |
| 199  | `turnEntry(state.players, nextPlayer)` |
| 250  | `turnEntry(state.players, next)` |
| 621  | `turnEntry(result.state.players, getNextPlayer(result.state))` |
| 656  | `turnEntry(state.players, nextPlayer)` |
| 676  | `turnEntry(state.players, nextPlayer)` |
| 704  | `turnEntry(state.players, nextPlayer)` |
| 767  | `turnEntry(newPlayers, next)` |

> Line numbers refer to the file BEFORE this task's edits; apply the sweep top-to-bottom and re-run `npm run typecheck` after completing all sites. The *starred rows above also carry a `event.turn` entry a few lines below them in the same action's `eventLog` array — those `event.turn` entries are converted separately in the `event.turn` table below. The multi-name sites (`event.ownerInJail`, `event.monopolyRent`, `event.paidRent`, `event.bankruptcyTransfer`, `event.bankruptcyWin`) and the `event.turn` pregnancies must manually keep the `bot` flag on the actor's `name`.

- [ ] **Step 6: Sweep actor log entries in `cards.ts`**

Add the import:

```ts
import { actorEntry } from './logEntries';
```

Replace each `{ key: 'event.X', params: { name: player.name, ... } }` with `actorEntry('event.X', player, { ... })`:

| line | key | extra params |
|------|-----|--------------|
| 17   | `event.cardCollect` | `{ cardId: card.id, amount: effect.amount }` |
| 22   | `event.cardPay` | `{ cardId: card.id, amount: effect.amount }` |
| 26   | `event.cardToJail` | `{ cardId: card.id }` |
| 34   | `event.gotJailCard` | `{ cardId: card.id }` |
| 60   | `event.cardCollectPlayers` | `{ cardId: card.id, amount: actualReceived, perPlayer: amount, playerCount: payingPlayers }` |
| 81   | `event.cardStreetRepairs` | `{ cardId: card.id, amount: totalRepairs, houseCount, hotelCount, perHouse: effect.perHouse, perHotel: effect.perHotel }` |
| 98   | `event.passedGo` | `{ amount: GO_SALARY }` (in `goToSpace`, `player` is the local `state.players[playerIndex]` binding) |
| 108  | `event.movedBack` / `event.movedForward` | `{ spaceId, cardId }` |

- [ ] **Step 7: Run the tests**

Run: `npm run test:unit -- src/i18n/__tests__/log.test.ts src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/logic/logEntries.ts src/types/game.ts src/logic/gameReducer.ts src/logic/cards.ts src/i18n/log.ts src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/i18n/__tests__/log.test.ts src/logic/__tests__/gameReducer.test.ts
git commit -m "feat: label bot-controlled actions with a (bot) suffix in the event log"
```

---

### Task 3: `decideBotAction` plays bot-controlled players

**Files:**
- Modify: `src/logic/bot.ts`
- Test: `src/logic/__tests__/bot.test.ts`

**Interfaces:**
- Consumes: `Player.botControlled` (Task 1).
- Produces: `decideBotAction(state)` returns actions for a current player who is `isBot` **or** `botControlled`.

- [ ] **Step 1: Write the failing tests**

Add to `src/logic/__tests__/bot.test.ts` inside `describe('decideBotAction', ...)`:

```ts
it('drives a bot-controlled human seat', () => {
  const state = makeState({}, makePlayer({ isBot: false, botControlled: true }));
  expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
});

it('does not drive a plain human seat', () => {
  const state = makeState({}, makePlayer({ isBot: false, botControlled: false }));
  expect(decideBotAction(state)).toBeNull();
});

it('buys for a bot-controlled player at a buy prompt', () => {
  const board = createInitialBoard();
  const spaceId = board.findIndex((s) => s.type === SpaceType.Property);
  const state = makeState({
    phase: GamePhase.Buying,
    pendingAction: { type: PendingActionType.BuyProperty, spaceId },
  }, makePlayer({ isBot: false, botControlled: true }));
  expect(decideBotAction(state)).toEqual({ type: 'BUY_PROPERTY' });
});
```

(`makePlayer` already defaults `botControlled: false` from Task 1.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit -- src/logic/__tests__/bot.test.ts`
Expected: FAIL — `decideBotAction` returns `null` for a bot-controlled non-bot player.

- [ ] **Step 3: Implement the gate**

In `src/logic/bot.ts` line 9:

```ts
  if ((!player.isBot && !player.botControlled) || state.phase === GamePhase.GameOver) return null;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:unit -- src/logic/__tests__/bot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logic/bot.ts src/logic/__tests__/bot.test.ts
git commit -m "feat: drive bot-controlled offline players with decideBotAction"
```

---

### Task 4: Server drives offline seats with a grace period

**Files:**
- Modify: `server/gameServer.ts`
- Test: `server/__tests__/gameServer.test.ts`

**Interfaces:**
- Consumes: `GameActionType.SetBotControl` + reducer `SetBotControl` (Task 1); `decideBotAction` accepts bot-controlled players (Task 3).
- Produces: On mid-game human disconnect, an offline-human seat is bot-driven after a 30s grace (`BOT_GRACE_MS`), then at 700ms steps; reconnect hands control back; `skipLeftPlayers` is removed; `SET_BOT_CONTROL` is rejected from clients.

- [ ] **Step 1: Write the failing tests**

In `server/__tests__/gameServer.test.ts`, replace the existing test `'skips the turn of a player who leaves mid-game'` (lines 213-221) with:

```ts
it('hands an offline player to the bot after a 30s grace period', () => {
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

  vi.advanceTimersByTime(29_000)
  expect(server.getState().phase).toBe(GamePhase.Waiting) // still inside the grace window

  vi.advanceTimersByTime(1_000) // grace elapsed → bot rolls
  expect(server.getState().phase).toBe(GamePhase.Rolling)

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

it('reconnect within the grace period hands control back to the human', () => {
  vi.useFakeTimers()
  const { server } = setup()
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')
  expect(server.getState().currentPlayer).toBe(0)

  server.leave('c0')
  expect(server.getState().players[0].botControlled).toBe(true)

  server.join('c9', 'Alice') // rejoins well within the 30s grace
  expect(server.getState().players[0].botControlled).toBe(false)
  expect(server.getState().currentPlayer).toBe(0)
  expect(server.getState().eventLog.some((e) => e.key === 'event.playerBack')).toBe(true)

  vi.advanceTimersByTime(30_000) // stale grace timer fires but the slot is connected → no roll
  expect(server.getState().phase).toBe(GamePhase.Waiting)
  expect(server.getState().dice).toBeNull()
  vi.useRealTimers()
})

it('ignores SET_BOT_CONTROL sent by a client', () => {
  const { server, sent } = setup()
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')
  const before = server.getState().players[0].botControlled
  server.handleAction('c0', { type: 'SET_BOT_CONTROL', playerId: 0, controlled: false })
  expect(server.getState().players[0].botControlled).toBe(before)
  expect(server.getState().eventLog.filter((e) => e.key === 'event.playerBack')).toHaveLength(0)
})
```

Add a `getState` import note: `GamePhase` is already imported at the top of the test file.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit -- server/__tests__/gameServer.test.ts`
Expected: FAIL — the leave test still advances to player 1 (old skip); the reconnect and client-guard tests fail; `BOT_GRACE_MS` behavior absent.

- [ ] **Step 3: Add constants and the driven-player tracker**

At the top of `server/gameServer.ts` (module scope):

```ts
const BOT_STEP_MS = 700
const BOT_GRACE_MS = 30_000
```

Add a field to the `GameServer` class (next to `private botSteps = 0`):

```ts
  private drivenPlayerId: number | null = null
```

- [ ] **Step 4: Rewrite `driveBots`**

Replace the entire current `driveBots` method (`server/gameServer.ts:365-387`) with:

```ts
  private driveBots(): void {
    if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
    const currentPlayer = this.state.currentPlayer
    const slot = this.slots[currentPlayer]
    if (!slot) {
      this.botSteps = 0
      this.drivenPlayerId = null
      return
    }
    const botControlled = this.state.players[currentPlayer]?.botControlled === true
    const isDriveable = slot.isBot || (!slot.connected && botControlled)
    if (!isDriveable) {
      this.botSteps = 0
      this.drivenPlayerId = null
      return
    }
    const action = decideBotAction(this.state)
    if (!action) {
      this.botSteps = 0
      return
    }
    if (this.botSteps >= 100) return
    this.botSteps++
    const isRealBot = slot.isBot
    const isFresh = this.drivenPlayerId !== currentPlayer
    if (isFresh) this.drivenPlayerId = currentPlayer
    const delay = !isRealBot && isFresh ? BOT_GRACE_MS : BOT_STEP_MS

    setTimeout(() => {
      if (this.state.phase === GamePhase.Setup || this.state.phase === GamePhase.GameOver) return
      const current = this.slots[currentPlayer]
      const stillBotControlled = this.state.players[currentPlayer]?.botControlled === true
      const stillDriveable =
        current?.isBot === true || (current !== undefined && !current.connected && stillBotControlled)
      if (!current || !stillDriveable) return
      const actionNow = decideBotAction(this.state)
      if (!actionNow) return
      if (actionNow.type === GameActionType.RollDice) this.startRoll()
      else this.dispatch(actionNow)
    }, delay)
  }
```

- [ ] **Step 5: Dispatch `SetBotControl` on disconnect, leave, and rejoin**

Replace the tail of `disconnect` (`server/gameServer.ts:288-292`) — currently:

```ts
    this.broadcast()
    this.skipLeftPlayers()
```

with:

```ts
    if (this.state.phase === GamePhase.Setup) {
      this.broadcast()
    } else {
      this.dispatch({ type: GameActionType.SetBotControl, playerId: index, controlled: true })
    }
```

In `leave` (`server/gameServer.ts:199-201`), replace:

```ts
    this.events.send(clientId, { type: ServerMessageType.Left })
    this.broadcast()
    this.skipLeftPlayers()
```

with:

```ts
    this.events.send(clientId, { type: ServerMessageType.Left })
    if (this.state.phase === GamePhase.Setup) {
      this.broadcast()
    } else {
      this.dispatch({ type: GameActionType.SetBotControl, playerId: index, controlled: true })
    }
```

In `join`, the reconnect branch (`server/gameServer.ts:70-84`), after `disconnected.connected = true`, add:

```ts
      if (this.state.phase !== GamePhase.Setup) {
        this.dispatch({ type: GameActionType.SetBotControl, playerId: this.slots.indexOf(disconnected), controlled: false })
      }
```

- [ ] **Step 6: Remove `skipLeftPlayers` and its callers, guard the action**

In `handleAction` (`server/gameServer.ts:241`), add as the first line of the method body:

```ts
    if (action.type === GameActionType.SetBotControl) return
```

In `dispatch` (`server/gameServer.ts:306-309`), remove the `skipLeftPlayers()` call:

```ts
  private dispatch(action: GameAction): void {
    this.applyAction(action)
  }
```

Delete the entire `skipLeftPlayers` private method (`server/gameServer.ts:326-346`).

- [ ] **Step 7: Run the server tests and full suite**

Run: `npm run test:unit -- server/__tests__/gameServer.test.ts`
Expected: PASS (new + all existing; the rewritten leave test, reconnect, client-guard, bot turn, reconnect-by-name tests all green).

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts
git commit -m "feat: drive offline players with the bot after a 30s grace period"
```

---

### Task 5: Client UI — bot badge and turn status

**Files:**
- Modify: `src/components/PlayerCard.tsx`
- Modify: `src/components/TurnHeader.tsx`
- Modify: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`
- Test: `src/components/__tests__/PlayerCard.test.tsx`, `src/components/__tests__/TurnHeader.test.tsx`

**Interfaces:**
- Consumes: `Player.botControlled` (Task 1).
- Produces: `PlayerCard` renders `🤖 BOT` when `player.botControlled`; `TurnHeader` status becomes `{{name}} — offline, a bot is playing`; i18n `card.botControl`, `turn.botControl`.

- [ ] **Step 1: Write the failing component tests**

Add to `src/components/__tests__/PlayerCard.test.tsx`:

```tsx
it('shows a bot-control badge when the player is bot-controlled', () => {
  renderWithProviders(<PlayerCard player={{ ...player, botControlled: true }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
  expect(screen.getByText(/BOT/)).toBeTruthy()
})

it('does not show the bot-control badge by default', () => {
  renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
  expect(screen.queryByText(/BOT/)).toBeNull()
})
```

Add to `src/components/__tests__/TurnHeader.test.tsx` (inside `describe('TurnHeader', ...)`):

```tsx
it('shows a bot-playing status when the current player is bot-controlled', () => {
  const players = makeState().players.map((p) => ({ ...p, botControlled: true }))
  renderWithProviders(<TurnHeader state={{ ...makeState(), players }} />)
  expect(screen.getByText('Alpha — offline, a bot is playing')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit -- src/components/__tests__/PlayerCard.test.tsx src/components/__tests__/TurnHeader.test.tsx`
Expected: FAIL — no badge text and no bot status (normal roll prompt shows).

- [ ] **Step 3: Add the i18n keys**

In `src/i18n/locales/en/translation.json`:

```json
  "card.botControl": "BOT",
  "turn.botControl": "{{name}} — offline, a bot is playing",
```

In `src/i18n/locales/id/translation.json`:

```json
  "card.botControl": "BOT",
  "turn.botControl": "{{name}} — offline, bot sedang bermain",
```

- [ ] **Step 4: Implement `PlayerCard`**

In `src/components/PlayerCard.tsx`, inside the name row (after the `{!connected && ...}` OFFLINE span, around line 89):

```tsx
          {player.botControlled && <span className="text-xs font-bold text-gold">🤖 {t('card.botControl')}</span>}
```

- [ ] **Step 5: Implement `TurnHeader`**

In `src/components/TurnHeader.tsx`, at the top of `statusText` (before the `pending` checks):

```ts
  if (p.botControlled) return t('turn.botControl', { name: p.name })
```

- [ ] **Step 6: Run the tests**

Run: `npm run test:unit -- src/components/__tests__/PlayerCard.test.tsx src/components/__tests__/TurnHeader.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/PlayerCard.tsx src/components/TurnHeader.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/components/__tests__/PlayerCard.test.tsx src/components/__tests__/TurnHeader.test.tsx
git commit -m "feat: show bot-control badge and turn status for offline players"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `Player.botControlled` + `SET_BOT_CONTROL` (idempotent, offline/back logs) | Task 1 |
| `StartGame` init `botControlled: false` | Task 1 |
| `decideBotAction` accepts `botControlled` | Task 3 |
| Server dispatch on disconnect/leave/rejoin | Task 4 (Step 5) |
| `driveBots` grace 30s → 700ms; `drivenPlayerId`; reconnect re-check | Task 4 (Steps 4) |
| Remove `skipLeftPlayers` | Task 4 (Step 6) |
| `(bot)` label on every actor entry + `event.turn`; `resolveLogEntry` | Task 2 |
| Trade auto-response `isBot \|\| botControlled` | ⚠️ **not yet covered** — added below |
| `PlayerCard` 🤖 badge + `TurnHeader` status | Task 5 |
| i18n `log.botName`, `event.playerOffline`, `event.playerBack`, `card.botControl`, `turn.botControl` | Tasks 1/2/5 |
| Tests (reducer, bot, server, components, i18n) | throughout |

**Self-review fixes applied inline:**

1. **Trade auto-response gap** — the spec requires the reducer's `ProposeTrade` guard to auto-answer `botControlled` recipients. Add this as **Step 2b within Task 1** (after Step 2's red test):

   - [ ] **Step 2b: Write the failing trade test + implement**

   Append to `src/logic/__tests__/gameReducer.test.ts` (uses the existing `makeStartedState` helper):

   ```ts
   it('auto-answers a trade from a bot-controlled recipient', () => {
     const started = makeStartedState(2);
     const state = gameReducer({ ...started, tradesEnabled: true }, {
       type: GameActionType.SetBotControl,
       playerId: 1,
       controlled: true,
     });
     const next = gameReducer(state, {
       type: GameActionType.ProposeTrade,
       offer: { fromId: 0, toId: 1, offerProperties: [], offerCash: 300, requestProperties: [], requestCash: 0 },
     });
     expect(next.eventLog.some((e) => e.key === 'event.tradeAccepted' || e.key === 'event.tradeRejected')).toBe(true);
     expect(next.pendingTrades).toHaveLength(0);
   });

   it('does not auto-answer a trade from a human recipient', () => {
     const state = gameReducer({ ...makeStartedState(2), tradesEnabled: true }, {
       type: GameActionType.ProposeTrade,
       offer: { fromId: 0, toId: 1, offerProperties: [], offerCash: 300, requestProperties: [], requestCash: 0 },
     });
     expect(state.pendingTrades).toHaveLength(1);
   });
   ```

   In `gameReducer.ts`, change the `ProposeTrade` guard (line 516) from `if (to.isBot) {` to:

   ```ts
   if (to.isBot || to.botControlled) {
   ```

   Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts` → PASS.
   Fold this change into Task 1's commit (amend the commit step or include the edits and files in Step 8).

2. **`Player` literal in `server/__tests__/gameServer.test.ts`** — the server test file has no hand-built `Player` literals, so no fixture change there; verified via the Task 1 typecheck run.

3. **Type consistency** — `actorEntry`/`turnEntry` signatures are defined once (Task 2 Step 3) and both `gameReducer.ts` and `cards.ts` consume them the same way; `GameActionType.SetBotControl` value is `'SET_BOT_CONTROL'` everywhere (server tests dispatch that literal string directly, matching the reducer's produced wire value).

**Execution handoff:**

Plan complete and saved to `docs/superpowers/plans/2026-08-17-offline-bot-control.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?