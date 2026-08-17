# Core Domain Enum-like String Constants Design

Date: 2026-08-17

## Problem

The repo's enum-like constant convention (const object + derived union type,
see `src/types/game.ts` and `src/types/net.ts`, codified in AGENTS.md) was
rolled out to wire message types, game action types, phases, connection status
and more. Several **core domain** string sets in production code still use raw
string literals:

- **Event log keys**: ~45 distinct `'event.*'` keys emitted from
  `src/logic/gameReducer.ts`, `src/logic/cards.ts`, `src/logic/logEntries.ts`.
  `LogEntry.key` is typed `string`, so nothing catches a typo and every site is
  a raw literal.
- **Currency codes**: `src/data/currency.ts` declares
  `type Currency = 'USD' | 'IDR'` — a union type with no const object, so
  `src/i18n/CurrencyContext.tsx` compares against raw `'IDR'`/`'USD'` literals.
- **One literal where a const already exists**: `gameReducer.ts:279` compares
  `space.taxType === 'income'` instead of `TaxType.Income`.

Real TypeScript `enum` stays a non-option (`erasableSyntaxOnly: true`); the
"enum" convention is `const` object + derived union type.

## Goals

- Introduce `LogEventKey` const object + derived union; type
  `LogEntry.key` with it; every `'event.*'` literal in production logic is
  replaced with a reference.
- Introduce `Currency` const object + derived union; `'IDR'`/`'USD'` literals
  in `CurrencyContext.tsx` replaced with refs.
- Replace the `'income'` literal in `gameReducer.ts` with `TaxType.Income`.
- Replace the `'chance'`/`'community'` literals in `src/i18n/log.ts`
  `cardKeyForId` with `CardType` refs.
- Zero behavior change: all string **values** stay byte-identical (event log
  keys are part of the server/client `GameState` snapshot contract and of the
  i18n key space; currency codes are persisted in localStorage).

## Non-Goals

- No new const objects for LogEntry **param** keys (`'bot'`, `'spaceId'`,
  `'cardId'`, money keys in `src/i18n/log.ts`) — out of scope this round.
- No const objects for localStorage keys (`monopoly-language`,
  `monopoly-currency`, `monopoly-mp-session`).
- No const objects for component design-token unions (`Button` variant/size,
  `RoomExit` variant).
- No const objects for language codes (`en`/`id`), env `'true'` parsing, URL
  protocols, keyboard event keys (`'Escape'`), Intl locale/code strings.
- No change to test files except adding value-lock assertions for the new
  consts (raw literals in existing tests still typecheck because the literal is
  assignable to the derived union).
- No change to `docs/superpowers/*` plan files.
- No introduction of TypeScript `enum`.

## Design

### 1. `LogEventKey` const in `src/types/game.ts`

Declare a const object with the full set of event keys (PascalCase keys,
`'event.*'` values) alongside the other const objects, then derive the union
and type `LogEntry.key` with it:

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

Change the `LogEntry` type (semicolon style, matches `game.ts`):

```ts
export type LogEntry = { key: LogEventKey; params?: Record<string, string | number | boolean> };
```

Note: `authorEntry`/`turnEntry` signatures in `logEntries.ts` currently take
`key: string`; narrowing those to `LogEventKey` is part of the change but their
`params` object stays `Record<string, string | number>`.

### 2. `Currency` const in `src/data/currency.ts`

```ts
export const Currency = {
  USD: 'USD',
  IDR: 'IDR',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];
```

`CurrencyDef.code`, `CURRENCIES: Record<Currency, CurrencyDef>` and
`DEFAULT_CURRENCY` keep the same shape/values (keys `USD:`/`IDR:` already
match the constants). Replace the raw literals in `CurrencyContext.tsx`
`readSavedCurrency` with `Currency.IDR`/`Currency.USD`.

### 3. Literal fixes where a const already exists

- `src/logic/gameReducer.ts:279`: `space.taxType === 'income'` →
  `space.taxType === TaxType.Income` (ensure `TaxType` is imported).
- `src/i18n/log.ts` `cardKeyForId`: `id >= 100 ? 'card.community.…'` →
  use `CardType.Community`/`CardType.Chance` when composing the key
  (`card.chance.${id}` / `card.community.${id}` values unchanged).

### 4. Wire-value lock tests

Extend the existing "wire values are locked" test in
`src/types/__tests__/enums.test.ts` (and/or the currency test in
`src/data/__tests__/currency.test.ts`) so the new consts' values are locked:

- `LogEventKey` — all 45 values in the exact order declared above.
- `Currency` — `['USD', 'IDR']` (add to `enums.test.ts`; the currency test
  already asserts `DEFAULT_CURRENCY === 'USD'`).

## Files

- Modify: `src/types/game.ts` (`LogEventKey` const + `LogEntry` type)
- Modify: `src/logic/gameReducer.ts` (replace ~45 `'event.*'` literals + the
  `'income'` literal)
- Modify: `src/logic/cards.ts` (replace `'event.*'` literals)
- Modify: `src/logic/logEntries.ts` (replace `'event.turn'`, narrow key param)
- Modify: `src/data/currency.ts` (`Currency` const object)
- Modify: `src/i18n/CurrencyContext.tsx` (`Currency.IDR`/`Currency.USD`)
- Modify: `src/i18n/log.ts` (`CardType` refs in `cardKeyForId`)
- Modify: `src/types/__tests__/enums.test.ts` (lock new const values)
- Modify: `src/data/__tests__/currency.test.ts` (lock `Currency` values)

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
- `npm run build` (multiplayer e2e spec serves `dist/`)