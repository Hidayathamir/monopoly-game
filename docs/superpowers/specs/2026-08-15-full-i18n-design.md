# Full Internationalization (EN default, ID) — Design

Date: 2026-08-15
Status: Approved (pending implementation plan)

## Summary

Localize the game for English (default) and Indonesian, with a user-facing
language toggle, and decouple **currency** from **language**. Today all text is
hardcoded Indonesian across the UI, the board data, the card data, and the event
log. Money is scaled by `priceMultiplier` (1,000,000 for rupiah) at state-creation
time, so language and currency are entangled.

Goals:

1. English is the default language; Indonesian is preserved.
2. A language toggle (EN/ID) and a currency toggle (USD/IDR), both persisted and
   switchable instantly with no game reset.
3. Currency is independent of language (English + rupiah, or Indonesian + dollars,
   are both valid).
4. Board names and card text localize too, not just UI chrome.
5. The multiplayer server stays language- and currency-agnostic.

## Approach

- **react-i18next** for all translatable text (UI strings, board names, card
  descriptions, event-log messages).
- **Money stored in canonical base units** (dollars — the raw values already in
  `board-data.json`). Currency multiplier + number formatting applied only at
  display time via a single `formatMoney`.
- **Structured event log** — `eventLog` entries become `{ key, params }` instead of
  pre-formatted strings, so the reducer (which runs on the server too) never
  formats text or money.
- **Convention-correct file layout**: translatable text lives in i18n resources;
  structural data stays language-neutral.

## File layout

```
src/i18n/
  index.ts                    # i18next init: resources, language detection (localStorage), default 'en'
  locales/
    en/translation.json       # UI strings + board names + card text (English)
    id/translation.json       # UI strings + board names + card text (Indonesian)
src/data/
  board-data.json             # language-neutral: structure only (id/type/price/rent/houseCost/color/taxType)
  cards-data.json             # language-neutral: structure only (id/effect)
  game-config.json            # language-neutral economics in base units (no priceMultiplier)
  board.ts                    # loads neutral data; no scaling; exports constants in base units
  cards.ts                    # loads neutral data; no scaling
  currency.ts                 # currency definitions + currency-aware formatMoney
  players.ts                  # unchanged
src/
  i18n/CurrencyContext.tsx    # currency state (USD/IDR), persisted, provider + hook
  components/LanguageCurrencyBar.tsx  # the two toggles
```

`board-data.json` and `cards-data.json` lose their `name`/`description` fields;
those move to `translation.json` keyed by id (`board.space.0` … `board.space.39`,
`card.chance.1` … `card.chance.10`, `card.community.101` … `card.community.110`).
`game-config.json` drops `priceMultiplier`.

## Money model (decoupled currency)

- Canonical unit = base dollar (raw values unchanged: starting money 1500,
  GO salary 200, prices 60–400).
- `src/data/board.ts` stops multiplying by `m`; `src/data/cards.ts` stops scaling
  effects. Constants (`STARTING_MONEY`, `GO_SALARY`, `JAIL_FINE`) are base units.
- `src/data/currency.ts`:
  ```ts
  type Currency = 'USD' | 'IDR'
  const CURRENCIES = {
    USD: { code: 'USD', multiplier: 1,        locale: 'en-US', currency: 'USD' },
    IDR: { code: 'IDR', multiplier: 1_000_000, locale: 'id-ID', currency: 'IDR' },
  }
  formatMoney(amount: number, currency: Currency): string
  ```
  `formatMoney` multiplies `amount` by `multiplier` and formats via
  `Intl.NumberFormat(locale, { style: 'currency', currency, ... })`. This is the
  **only** place the multiplier and number formatting are applied.
- `CurrencyContext.tsx` provides the active currency (default `USD`) and a setter,
  persisted to `localStorage`. It exposes a `useCurrency()` hook returning
  `{ currency, setCurrency, formatMoney }` so components re-render and format
  amounts correctly on currency change.
- `STATE_VERSION` in `src/hooks/useGame.ts` bumps (5 → 6) to invalidate old
  saved games whose money is already multiplier-scaled.

## Event log → structured entries

`src/types/game.ts`:

```ts
export type LogEntry = { key: string; params?: Record<string, string | number> }
// GameState.eventLog: LogEntry[]
```

Every `eventLog` string in `gameReducer.ts` and the `message` string returned by
`resolveCardEffect` (`src/logic/cards.ts`) become `LogEntry`s. Examples:

| Today | New |
| --- | --- |
| `` `${name} membeli ${space.name} seharga ${formatMoney(price)}` `` | `{ key: 'event.bought', params: { name, spaceId, price } }` |
| `` `Giliran ${name}` `` | `{ key: 'event.turn', params: { name } }` |
| `` `${name} melewati MULAI, dapat ${formatMoney(GO_SALARY)}` `` | `{ key: 'event.passedGo', params: { name, amount } }` |

`resolveCardEffect` returns `{ state, log: LogEntry | LogEntry[] }` instead of
`{ state, message }`; space names are passed as `spaceId` params, card descriptions
as `cardId` params, and money as raw numbers. The reducer no longer imports
`formatMoney`.

`EventLog.tsx` renders each entry through a shared `resolveLogEntry(entry)`
helper: it passes `key` + `params` to `t()` for interpolation, but first replaces
`spaceId` params with the translated board name (`t('board.space.' + id)`) and
`cardId` params with the translated card text, and formats money params through
the active currency. It keeps its expand/collapse behavior.

## Language & currency toggles

- `src/i18n/index.ts` initializes i18next with both locales' resources, detects the
  saved language from `localStorage` (default `en`), and exposes `changeLanguage`.
- `LanguageCurrencyBar.tsx` renders a language selector (EN/ID) and a currency
  selector (USD/IDR). Placed on the setup screen (`GameSetup`) and in the in-game
  header (`GameView`). Changing either is instant (i18next re-render / context
  update); no game reset.
- The app is wrapped in `I18nextProvider` + `CurrencyProvider` at the root
  (`src/main.tsx` or `src/App.tsx`).

## UI string migration

All hardcoded Indonesian strings move to `translation.json` and are referenced via
`useTranslation()` in these components (non-exhaustive; the plan enumerates each):

`GameSetup`, `GameView`, `TurnHeader`, `ActionSection`, `Sidebar`, `EventLog`,
`PlayerCard`, `PlayerPanel`, `PropertyTooltip`, `BoardGrid` (via board-name keys),
`DiceRoller`, `Lobby`, `MultiplayerGame`, and modals (`BuyPropertyModal`,
`CardModal`, `TradeModal`, `BankruptcyModal`, `GameOverModal`, `Modal`).

Board names render via `t('board.space.' + space.id)`; card text via
`t('card.' + deck + '.' + card.id)`. `Space` and `Card` types drop their
`name`/`description` fields.

Player default names (`Pemain N` / `Player N`) are localized via a key
(`common.player`, `common.playerNumber`).

## English content

- **Board** (`en/translation.json` `board.space.*`): classic US Monopoly —
  GO, Mediterranean Avenue, Community Chest, Baltic Avenue, Income Tax,
  Reading Railroad, Oriental Avenue, Chance, Vermont Avenue, Connecticut Avenue,
  Jail, St. Charles Place, Electric Company, States Avenue, Virginia Avenue,
  Pennsylvania Railroad, St. James Place, Community Chest, Tennessee Avenue,
  New York Avenue, Free Parking, Kentucky Avenue, Chance, Indiana Avenue,
  Illinois Avenue, B&O Railroad, Atlantic Avenue, Ventnor Avenue, Water Works,
  Marvin Gardens, Go To Jail, Pacific Avenue, North Carolina Avenue, Community
  Chest, Pennsylvania Avenue, Short Line, Chance, Park Place, Luxury Tax,
  Boardwalk. Prices/rents/houseCost/colors stay the current ladder (base units).
- **Cards** (`en/translation.json` `card.*`): standard English Chance / Community
  Chest text matching the current effect structure.
- **UI** (`en/translation.json`): English equivalents of every Indonesian label.
- Indonesian `id/translation.json` carries the current Indonesian text unchanged.

## Server / multiplayer

No server changes required. The reducer emits language-neutral structured logs and
base-unit money; currency and language are resolved client-side at render. This
keeps multiplayer players independent of each other's language/currency choices.

## Testing

- Update `src/data/__tests__/cards.test.ts`: amounts asserted in base units
  (e.g. `50` instead of `50000000`), no scaling.
- Update `src/logic/__tests__/*`: `eventLog` assertions become `LogEntry`
  objects; money constants in base units.
- Update `src/components/__tests__/*`: wrap render in `I18nextProvider` +
  `CurrencyProvider` (add a test helper); assert against `t()` keys or default
  (EN) strings.
- Add `src/data/__tests__/currency.test.ts`: `formatMoney` for USD/IDR,
  multiplier and formatting correctness.
- Add `src/i18n`/`LanguageCurrencyBar` tests: toggling updates `i18n.language`
  and currency, and persists to `localStorage`.
- e2e: verify default EN rendering and a toggle to ID updates visible text.

## Out of scope

- RTL/bidi, date/time localization, plural rules beyond i18next defaults.
- Auto-detection from `navigator.language` (manual toggle + persisted default only).
- Storing language/currency per-room on the server (each client renders its own).
