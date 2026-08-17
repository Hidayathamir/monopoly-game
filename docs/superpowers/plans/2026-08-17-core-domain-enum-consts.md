# Core Domain Enum-like String Constants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining raw enum-like string literals in core domain code (`event.*` log keys, currency codes, `taxType === 'income'`, `cardKeyForId`) with the repo's `const`-object + derived-union "enum" pattern.

**Architecture:** Add a `LogEventKey` const object (45 `event.*` keys) to `src/types/game.ts`, derive its union, and type `LogEntry.key` with it. Convert `Currency` from a bare literal union to a const object + derived union. Replace every literal site in `gameReducer.ts`, `cards.ts`, `logEntries.ts`, `CurrencyContext.tsx`, and `log.ts`. Values stay byte-identical — pure refactor, no behavior change.

**Tech Stack:** TypeScript (`erasableSyntaxOnly`, `verbatimModuleSyntax`), React, Node/`ws` server, Vitest.

## Global Constraints

- **No TypeScript `enum`** — repo enforces `erasableSyntaxOnly: true`. Use `const` object + derived union type only (pattern in `src/types/game.ts`).
- **No value changes** — every string value (event log keys in the server/client `GameState` snapshot contract, i18n keys, persisted `monopoly-currency`) stays byte-identical.
- **Semicolons**: `src/types/game.ts`, `src/logic/gameReducer.ts`, `src/logic/cards.ts`, `src/logic/logEntries.ts`, `src/data/*` use semicolons. `src/i18n/log.ts`, `src/i18n/CurrencyContext.tsx`, `*.test.ts` under `src/types/` do not. Match the file you edit.
- **`verbatimModuleSyntax`**: added consts are **values** — import them as values, never inside `import type`. Type-only imports must stay `import type`.
- **Do not modify** `server/**`, `e2e/**`, other test files, or `docs/superpowers/*` — raw literals in tests still typecheck because the literal is assignable to the derived union.
- **Verification commands** used throughout: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.

---

### Task 1: Add `LogEventKey` const, type `LogEntry.key`, and lock wire values

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/logic/logEntries.ts`
- Modify: `src/types/__tests__/enums.test.ts`
- Test: `src/types/__tests__/enums.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LogEventKey` const object (45 keys) + same-named derived union type; `LogEntry.key` typed as `LogEventKey`; `actorEntry(key: LogEventKey, ...)` and `turnEntry(...)` whose `key` param is narrowed to `LogEventKey`. `logEntries.ts` is converted here (not Task 3) because narrowing `LogEntry.key` immediately breaks `npm run typecheck` on `actorEntry`'s `key: string` parameter — the two-file Task 1 commit and the typecheck must pass together.

- [ ] **Step 1: Write the failing test**

Check out a fresh working tree (or commit first). Add to `src/types/__tests__/enums.test.ts`. It currently imports consts from `'../game'`:

```ts
import { expect, test } from 'vitest'
import {
  CardActionType, CardType, GameActionType, GamePhase, LogEventKey, PendingActionType, SpaceType, TaxType,
} from '../game';
```

Add inside the existing `test('wire values are locked for all enum-like consts', ...)` block, after the `ConnectionStatus` assertion:

```ts
  expect(Object.values(LogEventKey)).toEqual([
    'event.gameStarted', 'event.turn', 'event.rolled', 'event.rolledAimed', 'event.passedGo',
    'event.jailBreakDoubles', 'event.jailForcedOut', 'event.jailFailed', 'event.tripleDoubles',
    'event.toJail', 'event.freeParkingJackpot', 'event.incomeTax', 'event.luxuryTax',
    'event.ownerInJail', 'event.monopolyRent', 'event.mustCircleBoard', 'event.bought',
    'event.paidRent', 'event.builtHouse', 'event.builtHotel', 'event.soldHouse',
    'event.mortgaged', 'event.unmortgaged', 'event.soldToBank', 'event.tradeProposed',
    'event.tradeAccepted', 'event.tradeRejected', 'event.tradeCancelled', 'event.paidJailFine',
    'event.usedJailCard', 'event.doublesAgain', 'event.cardCollect', 'event.cardPay',
    'event.cardToJail', 'event.gotJailCard', 'event.cardCollectPlayers', 'event.cardStreetRepairs',
    'event.movedForward', 'event.movedBack', 'event.bankruptcy', 'event.bankruptcyWin',
    'event.bankruptcyTransfer', 'event.playerOffline', 'event.playerBack', 'event.reconnectWait',
  ]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/types/__tests__/enums.test.ts`
Expected: FAIL — `Cannot find name 'LogEventKey'`.

- [ ] **Step 3: Add the const and update `LogEntry`**

Append to `src/types/game.ts`, after the `GameActionType` block (line ~90), using semicolons:

```ts
export const LogEventKey = {
  GameStarted: 'event.gameStarted',
  Turn: 'event.turn',
  Rolled: 'event.rolled',
  RolledAimed: 'event.rolledAimed',
  PassedGo: 'event.passedGo',
  JailBreakDoubles: 'event.jailBreakDoubles',
  JailForcedOut: 'event.jailForcedOut',
  JailFailed: 'event.jailFailed',
  TripleDoubles: 'event.tripleDoubles',
  ToJail: 'event.toJail',
  FreeParkingJackpot: 'event.freeParkingJackpot',
  IncomeTax: 'event.incomeTax',
  LuxuryTax: 'event.luxuryTax',
  OwnerInJail: 'event.ownerInJail',
  MonopolyRent: 'event.monopolyRent',
  MustCircleBoard: 'event.mustCircleBoard',
  Bought: 'event.bought',
  PaidRent: 'event.paidRent',
  BuiltHouse: 'event.builtHouse',
  BuiltHotel: 'event.builtHotel',
  SoldHouse: 'event.soldHouse',
  Mortgaged: 'event.mortgaged',
  Unmortgaged: 'event.unmortgaged',
  SoldToBank: 'event.soldToBank',
  TradeProposed: 'event.tradeProposed',
  TradeAccepted: 'event.tradeAccepted',
  TradeRejected: 'event.tradeRejected',
  TradeCancelled: 'event.tradeCancelled',
  PaidJailFine: 'event.paidJailFine',
  UsedJailCard: 'event.usedJailCard',
  DoublesAgain: 'event.doublesAgain',
  CardCollect: 'event.cardCollect',
  CardPay: 'event.cardPay',
  CardToJail: 'event.cardToJail',
  GotJailCard: 'event.gotJailCard',
  CardCollectPlayers: 'event.cardCollectPlayers',
  CardStreetRepairs: 'event.cardStreetRepairs',
  MovedForward: 'event.movedForward',
  MovedBack: 'event.movedBack',
  Bankruptcy: 'event.bankruptcy',
  BankruptcyWin: 'event.bankruptcyWin',
  BankruptcyTransfer: 'event.bankruptcyTransfer',
  PlayerOffline: 'event.playerOffline',
  PlayerBack: 'event.playerBack',
  ReconnectWait: 'event.reconnectWait',
} as const;
export type LogEventKey = (typeof LogEventKey)[keyof typeof LogEventKey];
```

Then narrow the `LogEntry` type (line ~126):

```ts
export type LogEntry = { key: LogEventKey; params?: Record<string, string | number | boolean> };
```

- [ ] **Step 4: Narrow `logEntries.ts` (required for typecheck to pass)**

`src/logic/logEntries.ts` builds `LogEntry` objects; its `key` parameter is typed `string` and no longer assignable to `LogEntry.key`. Convert it here (semicolons):

Replace the import (line 1):

```ts
import { LogEventKey, type LogEntry, type Player } from '../types/game';
```

Replace the `actorEntry` signature `key: string` (line 4) with `key: LogEventKey`.

Replace line 16 `key: 'event.turn'` → `key: LogEventKey.Turn`

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/types/__tests__/enums.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS — existing `'event.*'` literals in `gameReducer.ts`/`cards.ts` still assign to `LogEventKey`, and all log keys already exist (verified: the 45 keys in the const exactly match translation + production usage).

- [ ] **Step 7: Commit**

```bash
git add src/types/game.ts src/logic/logEntries.ts src/types/__tests__/enums.test.ts
git commit -m "feat: add LogEventKey const and type LogEntry.key with it"
```

---

### Task 2: Replace `event.*` literals + `'income'` in `gameReducer.ts`

**Files:**
- Modify: `src/logic/gameReducer.ts`
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `LogEventKey`, `TaxType` (added to the existing `'../types/game'` import in step 1).
- Produces: no new exports; every `'event.*'` literal and the `'income'` literal replaced.

- [ ] **Step 1: Update the import**

Replace line 1:

```ts
import { GamePhase, GameActionType, PendingActionType, SpaceType, CardType, CardActionType, LogEventKey, TaxType, type GameState, type GameAction, type Player, type LogEntry, type PendingTrade } from '../types/game';
```

(`LogEventKey` and `TaxType` are added as value imports, in alphabetical position among the values.)

- [ ] **Step 2: Replace every `'event.*'` literal**

Do a global find-and-replace of each exact quoted literal with its `LogEventKey.*` reference (order doesn't matter; all occurrences must be replaced):

| literal | replacement |
|---|---|
| `'event.gameStarted'` | `LogEventKey.GameStarted` |
| `'event.jailBreakDoubles'` | `LogEventKey.JailBreakDoubles` |
| `'event.passedGo'` | `LogEventKey.PassedGo` |
| `'event.jailForcedOut'` | `LogEventKey.JailForcedOut` |
| `'event.jailFailed'` | `LogEventKey.JailFailed` |
| `'event.rolledAimed'` | `LogEventKey.RolledAimed` |
| `'event.rolled'` | `LogEventKey.Rolled` |
| `'event.tripleDoubles'` | `LogEventKey.TripleDoubles` |
| `'event.toJail'` | `LogEventKey.ToJail` |
| `'event.freeParkingJackpot'` | `LogEventKey.FreeParkingJackpot` |
| `'event.incomeTax'` | `LogEventKey.IncomeTax` |
| `'event.luxuryTax'` | `LogEventKey.LuxuryTax` |
| `'event.ownerInJail'` | `LogEventKey.OwnerInJail` |
| `'event.monopolyRent'` | `LogEventKey.MonopolyRent` |
| `'event.mustCircleBoard'` | `LogEventKey.MustCircleBoard` |
| `'event.bought'` | `LogEventKey.Bought` |
| `'event.paidRent'` | `LogEventKey.PaidRent` |
| `'event.builtHouse'` | `LogEventKey.BuiltHouse` |
| `'event.builtHotel'` | `LogEventKey.BuiltHotel` |
| `'event.soldHouse'` | `LogEventKey.SoldHouse` |
| `'event.mortgaged'` | `LogEventKey.Mortgaged` |
| `'event.unmortgaged'` | `LogEventKey.Unmortgaged` |
| `'event.soldToBank'` | `LogEventKey.SoldToBank` |
| `'event.tradeProposed'` | `LogEventKey.TradeProposed` |
| `'event.tradeAccepted'` | `LogEventKey.TradeAccepted` |
| `'event.tradeRejected'` | `LogEventKey.TradeRejected` |
| `'event.tradeCancelled'` | `LogEventKey.TradeCancelled` |
| `'event.paidJailFine'` | `LogEventKey.PaidJailFine` |
| `'event.usedJailCard'` | `LogEventKey.UsedJailCard` |
| `'event.doublesAgain'` | `LogEventKey.DoublesAgain` |
| `'event.bankruptcy'` | `LogEventKey.Bankruptcy` |
| `'event.bankruptcyTransfer'` | `LogEventKey.BankruptcyTransfer` |
| `'event.bankruptcyWin'` | `LogEventKey.BankruptcyWin` |
| `'event.reconnectWait'` | `LogEventKey.ReconnectWait` |
| `'event.playerOffline'` | `LogEventKey.PlayerOffline` |
| `'event.playerBack'` | `LogEventKey.PlayerBack` |

Two literals appear only **inside a ternary expression** — replace them without disturbing the ternary branches:

- Line 429: `actorEntry(space.houses === 4 ? 'event.builtHotel' : 'event.builtHouse', player, ...)` → `actorEntry(space.houses === 4 ? LogEventKey.BuiltHotel : LogEventKey.BuiltHouse, player, ...)`
- Line 793: `const logKey = action.controlled ? 'event.playerOffline' : 'event.playerBack';` → `const logKey = action.controlled ? LogEventKey.PlayerOffline : LogEventKey.PlayerBack;` (no annotation needed — the ternary's result type is already assignable to `LogEventKey`)

- [ ] **Step 3: Replace the `'income'` literal**

Line 279: `const isIncome = space.taxType === 'income';` → `const isIncome = space.taxType === TaxType.Income;`

- [ ] **Step 4: Verify no raw literals remain**

Run:
```bash
grep -nE "'event\.[a-z]+'" src/logic/gameReducer.ts
```
Expected: no matches.

- [ ] **Step 5: Typecheck + reducer tests**

Run: `npm run typecheck && npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: PASS both.

- [ ] **Step 6: Commit**

```bash
git add src/logic/gameReducer.ts
git commit -m "refactor: use LogEventKey and TaxType consts in gameReducer"
```

---

### Task 3: Replace `event.*` literals in `cards.ts`

**Files:**
- Modify: `src/logic/cards.ts`
- Test: `src/logic/__tests__/cards.test.ts`

**Interfaces:**
- Consumes: `LogEventKey` value import from `'../types/game'` (const defined in Task 1). `actorEntry(key: LogEventKey, player: Player, extra?: Record<string, string | number>)` (narrowed in Task 1).
- Produces: no new exports.

- [ ] **Step 1: `cards.ts` — import + replace literals**

Replace the import (line 1) with:

```ts
import { CardActionType, LogEventKey, type Card, type GameState, type LogEntry } from '../types/game';
```

Do a global find-and-replace of each exact literal:

| literal | replacement |
|---|---|
| `'event.cardCollect'` | `LogEventKey.CardCollect` |
| `'event.cardPay'` | `LogEventKey.CardPay` |
| `'event.cardToJail'` | `LogEventKey.CardToJail` |
| `'event.gotJailCard'` | `LogEventKey.GotJailCard` |
| `'event.cardCollectPlayers'` | `LogEventKey.CardCollectPlayers` |
| `'event.cardStreetRepairs'` | `LogEventKey.CardStreetRepairs` |
| `'event.passedGo'` | `LogEventKey.PassedGo` |
| `'event.movedForward'` | `LogEventKey.MovedForward` |
| `'event.movedBack'` | `LogEventKey.MovedBack` |

Line 109 is a ternary — replace its two branches, keeping the structure:
`actorEntry(isBackward ? 'event.movedBack' : 'event.movedForward', player, { spaceId, cardId })` → `actorEntry(isBackward ? LogEventKey.MovedBack : LogEventKey.MovedForward, player, { spaceId, cardId })`

- [ ] **Step 2: Verify no raw literals remain**

Run:
```bash
grep -nE "'event\.[a-z]+'" src/logic/cards.ts
```
Expected: no matches.

- [ ] **Step 3: Typecheck + cards tests**

Run: `npm run typecheck && npx vitest run src/logic/__tests__/cards.test.ts`
Expected: PASS all.

- [ ] **Step 4: Commit**

```bash
git add src/logic/cards.ts
git commit -m "refactor: use LogEventKey consts in cards"
```

---

### Task 4: Convert `Currency` to a const object and fix `CurrencyContext.tsx`

**Files:**
- Modify: `src/data/currency.ts`
- Modify: `src/i18n/CurrencyContext.tsx`
- Modify: `src/types/__tests__/enums.test.ts`
- Test: `src/data/__tests__/currency.test.ts`, `src/types/__tests__/enums.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Currency` const object + same-named derived union type (replaces the bare `type Currency = 'USD' | 'IDR'`). Interfaces `CurrencyDef.code: Currency`, `CURRENCIES: Record<Currency, CurrencyDef>`, `DEFAULT_CURRENCY: Currency` keep the same shape.

- [ ] **Step 1: Write the failing test**

Add to `src/types/__tests__/enums.test.ts` — add `Currency` to the imports (it lives in `src/data/currency.ts`; note the path from `src/types/__tests__/` is `../../data/currency`):

```ts
import { Currency } from '../../data/currency';
```

(Keep the existing import block from `'../game'` as-is.) Add inside the `test('wire values are locked...', ...)` block, after the `LogEventKey` assertion:

```ts
  expect(Object.values(Currency)).toEqual(['USD', 'IDR']);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/types/__tests__/enums.test.ts`
Expected: FAIL — `'expected ..., received undefined'` because `Object.values(Currency)` is `[]` (the current `Currency` is type-only, so `Currency` is not a value).

- [ ] **Step 3: Convert `Currency` to a const object**

In `src/data/currency.ts`, replace line 1:

```ts
export type Currency = 'USD' | 'IDR'
```

with:

```ts
export const Currency = {
  USD: 'USD',
  IDR: 'IDR',
} as const
export type Currency = (typeof Currency)[keyof typeof Currency]
```

No other change in this file — `CurrencyDef.code`, `CURRENCIES` keys (`USD:`/`IDR:`), and `DEFAULT_CURRENCY` already match. (`DEFAULT_CURRENCY: Currency = 'USD'` still typechecks.)

- [ ] **Step 4: Fix `CurrencyContext.tsx` literals**

Replace the import (line 3):

```ts
import { Currency, DEFAULT_CURRENCY, formatMoney as formatMoneyFor } from '../data/currency'
```

(Remove the old `type Currency` — the value import doubles as the type, so `CurrencyContextValue` still resolves `currency: Currency`.)

Replace line 20:

```ts
    return saved === 'IDR' || saved === 'USD' ? saved : DEFAULT_CURRENCY
```

with:

```ts
    return saved === Currency.IDR || saved === Currency.USD ? saved : DEFAULT_CURRENCY
```

- [ ] **Step 5: Run tests**

Run: `npm run typecheck && npx vitest run src/types/__tests__/enums.test.ts src/data/__tests__/currency.test.ts`
Expected: PASS all (the currency test's raw `'USD'`/`'IDR'` literals are assignable to the derived union and the assertions are unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/data/currency.ts src/i18n/CurrencyContext.tsx src/types/__tests__/enums.test.ts
git commit -m "refactor: convert Currency to enum-like const object"
```

---

### Task 5: Use `CardType` refs in `cardKeyForId`

**Files:**
- Modify: `src/i18n/log.ts`
- Test: `src/i18n/__tests__/log.test.ts`

**Interfaces:**
- Consumes: `CardType` value import from `'../types/game'`.
- Produces: `cardKeyForId(id: number): string` — same return values, composed via `CardType` refs.

- [ ] **Step 1: Update import + replace literals**

Replace the import (line 2):

```ts
import { CardType, type LogEntry } from '../types/game'
```

Replace lines 6-8:

```ts
export function cardKeyForId(id: number): string {
  return id >= 100 ? `card.${CardType.Community}.${id}` : `card.${CardType.Chance}.${id}`
}
```

(Wire values unchanged: `CardType.Community` = `'community'`, `CardType.Chance` = `'chance'`.)

- [ ] **Step 2: Typecheck + log tests**

Run: `npm run typecheck && npx vitest run src/i18n/__tests__/log.test.ts`
Expected: PASS both.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/log.ts
git commit -m "refactor: use CardType refs in cardKeyForId"
```

---

### Task 6: Final verification

**Files:**
- No code changes.

- [ ] **Step 1: Verify no raw enum-like literals remain in production code**

Run:
```bash
grep -rnE "'event\.[a-z]+'" src server | grep -v __tests__
grep -rnE "'income'|'luxury'" src/logic/gameReducer.ts
```
Expected: no matches (test files may still contain `'event.*'` — that's expected and fine).

- [ ] **Step 2: Full verification suite**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run build`
Expected: all PASS.

- [ ] **Step 3: Commit anything stray**

If Task 5's `npm run build` produced only `dist/` (gitignored), there is nothing to commit. Otherwise commit any accidental changes with an appropriate message.

---

## Self-Review

- **Spec coverage**: Task 1 = spec §1 (`LogEventKey` + `LogEntry.key`, plus the required `logEntries.ts` signature narrowing), §4 (`LogEventKey` lock). Task 2 = spec §1 report on `gameReducer` + spec §3 (`'income'` → `TaxType.Income`). Task 3 = spec §1 report on `cards`. Task 4 = spec §2 (`Currency` const + `CurrencyContext`) + §4 (`Currency` lock). Task 5 = spec §3 (`cardKeyForId`). Task 6 = spec **Verification**. No spec section is left without a task.
- **Placeholder scan**: every replacement is enumerated in a mapping table or explicit code block; the const definitions and test additions are full code. No "TBD"/"similar to".
- **Type consistency**: `LogEventKey.*` names match the const defined in Task 1 across all tasks; the 45-value `LogEventKey` test array matches the const declaration order in Task 1; `Currency.USD`/`Currency.IDR` match the Task 4 const. `actorEntry` is narrowed to `LogEventKey` in Task 1 (where the const exists and where typecheck requires it), so no task depends on a type from a later task.