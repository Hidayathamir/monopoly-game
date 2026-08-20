# Enum Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the enum-like candidates from `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md` into `const`-object / `const`-array / named-numeric constants, where a candidate can genuinely be treated as an enum.

**Architecture:** Each candidate becomes a `const` object with a derived union type, an `as const` array, or a named numeric constant living in its domain module. Consumers across `src/` and `server/` are re-pointed at the constant. No runtime or wire-value changes — this is a behavior-preserving refactor whose safety net is the existing unit suite.

**Tech Stack:** TypeScript (`verbatimModuleSyntax`, `erasableSyntaxOnly`, no TS `enum`), React 19, Vite, vitest, Playwright.

## Global Constraints

- **Never introduce a TS `enum`.** Use `const` objects + derived union types (repo enforces `erasableSyntaxOnly`). For numeric domains use `as const` arrays or named numeric constants. No numeric VALUE changes.
- **No behavior or wire-value changes.** Wire values are part of the client/server contract and must not change. Literal values written into the consts are copied verbatim from the code they replace.
- **No new tests** — this is a refactor; the existing unit suite is the regression net. The ONLY test file that must be edited is `src/logic/__tests__/seed.test.ts` (C-28 changes the `ValidationResult` shape it asserts on).
- **Type-only imports** use `import type` (`verbatimModuleSyntax`).
- **Semicolons follow the file being edited**: `src/logic/*`, `src/types/*`, `src/data/board.ts`, `src/data/players.ts` use them; `src/components/*`, `src/i18n/*`, `src/net/*`, `src/hooks/*`, `server/*` omit them. Match the file.
- **Every task ends with**: `npm run typecheck` AND `npm run lint` AND `npm run test:unit` all passing, then a commit. Run typecheck/lint even for pure doc/comment changes.
- Verify no behavior drift by running the full unit suite; e2e is run once in the final task.
- `MAX_JAIL_TURNS` (C-16) already exists — no task for it. Data maps (C-22..C-27) are intentionally NOT converted except `PIPS` typing (folded into Task 3). Platform vocabularies (C-11..C-13) are intentionally NOT converted. C-20/C-21 are intentionally NOT converted (data-derived).

---

### Task 1: Board numeric constants — `BOARD_SIZE`, `MAX_HOUSES`, `BOARD_CORNER_SPACES`

**Files:**
- Modify: `src/data/board.ts`
- Modify: `src/logic/gameReducer.ts`, `src/logic/cards.ts`, `src/logic/rent.ts`, `src/logic/bot.ts`, `src/logic/seed.ts`
- Modify: `src/components/PlayerTokens.tsx`, `src/components/BoardGrid.tsx`, `src/components/ActionSection.tsx`, `src/components/PropertyTooltip.tsx`

**Interfaces:**
- Produces: `BOARD_SIZE: 40`, `MAX_HOUSES: 5`, `BOARD_CORNER_SPACES: readonly [0, 10, 20, 30]`, `type BoardCornerSpace = 0 | 10 | 20 | 30` — all exported from `src/data/board.ts`. Later tasks import these.

- [ ] **Step 1: Add the constants to `src/data/board.ts`**

Append after the existing constants block (keep the file's semicolon style):

```ts
export const BOARD_SIZE = 40;
export const MAX_HOUSES = 5;
export const BOARD_CORNER_SPACES = [0, 10, 20, 30] as const;
export type BoardCornerSpace = (typeof BOARD_CORNER_SPACES)[number];
```

- [ ] **Step 2: Re-point consumers at `BOARD_SIZE`**

Replace the board-wrap arithmetic (the `% 40` / `+ 40` modulo-40 idiom):

- `src/logic/gameReducer.ts:92,120,166` — `% 40` → `% BOARD_SIZE`. Add `BOARD_SIZE` to the existing `import ... from '../data/board'` (line 2).
- `src/logic/cards.ts:40` — `(player.position + effect.spaceId + 40) % 40` → `(player.position + effect.spaceId + BOARD_SIZE) % BOARD_SIZE`; `:103` — `(player.position - spaceId + 40) % 40` → `(... + BOARD_SIZE) % BOARD_SIZE`; `:104` — `(spaceId - player.position + 40) % 40` → `(... + BOARD_SIZE) % BOARD_SIZE`. Add `BOARD_SIZE` to the `import { GO_SALARY } from '../data/board'` (line 2).
- `src/components/PlayerTokens.tsx:37` — `(to - from + 40) % 40` → `(to - from + BOARD_SIZE) % BOARD_SIZE`; `:41` — `(current - 1 + 40) % 40` / `(current + 1) % 40` → `% BOARD_SIZE`. Import `BOARD_SIZE` from `'../data/board'`.
- `src/logic/seed.ts:5` — delete `const BOARD_SIZE = 40;`, import `BOARD_SIZE` from `'../data/board'` (extend the existing `createInitialBoard` import on line 2).

- [ ] **Step 3: Re-point consumers at `MAX_HOUSES`**

Replace the hardcoded hotel-level `5` comparisons:

- `src/logic/rent.ts:15` — `space.houses === 5` → `space.houses === MAX_HOUSES`. Extend `import { getTotalHouseInvestment } from '../data/board'` (line 2).
- `src/logic/cards.ts:70` — `space.houses === 5` → `=== MAX_HOUSES`.
- `src/logic/gameReducer.ts:423` — `space.houses >= 5` → `>= MAX_HOUSES`; `:443` — `space.houses === 4 ? LogEventKey.BuiltHotel : LogEventKey.BuiltHouse` → `space.houses === MAX_HOUSES - 1 ? ...`.
- `src/logic/bot.ts:54` — `space.houses >= 5` → `>= MAX_HOUSES`. Extend `import { getHouseCost, JAIL_FINE } from '../data/board'` (line 4).
- `src/logic/seed.ts:121` — `s.houses < 0 || s.houses > 5` → `s.houses < 0 || s.houses > MAX_HOUSES`.
- `src/components/ActionSection.tsx:101` — `space.houses < 5` → `< MAX_HOUSES`. Extend `import { JAIL_FINE, getHouseCost } from '../data/board'` (line 4).
- `src/components/BoardGrid.tsx:151` — `space.houses > 0 && space.houses < 5` → `space.houses > 0 && space.houses < MAX_HOUSES`; `:161` — `space.houses === 5` → `=== MAX_HOUSES`. Add `MAX_HOUSES` import from `'../data/board'`.
- `src/components/PropertyTooltip.tsx:85` and `:103` — `space.houses === 5` → `=== MAX_HOUSES`. Extend the `'../data/board'` import (line 4).

- [ ] **Step 4: Re-point `BOARD_CORNER_SPACES` in `BoardGrid.tsx`**

Replace `getCellPosition` (lines 17-26) with a corner lookup keyed by the enum type, keeping identical output coordinates:

```tsx
import { BOARD_CORNER_SPACES, MAX_HOUSES, type BoardCornerSpace } from '../data/board'

const CORNER_CELL: Record<BoardCornerSpace, { gridColumn: number; gridRow: number }> = {
  [BOARD_CORNER_SPACES[0]]: { gridColumn: 11, gridRow: 11 },
  [BOARD_CORNER_SPACES[1]]: { gridColumn: 1, gridRow: 11 },
  [BOARD_CORNER_SPACES[2]]: { gridColumn: 1, gridRow: 1 },
  [BOARD_CORNER_SPACES[3]]: { gridColumn: 11, gridRow: 1 },
}

function getCellPosition(id: number): { gridColumn: number; gridRow: number } | null {
  const corner = CORNER_CELL[id as BoardCornerSpace]
  if (corner) return corner
  if (id >= 1 && id <= 9) return { gridColumn: 10 - (id - 1), gridRow: 11 }
  if (id >= 11 && id <= 19) return { gridColumn: 1, gridRow: 10 - (id - 11) }
  if (id >= 21 && id <= 29) return { gridColumn: 2 + (id - 21), gridRow: 1 }
  return { gridColumn: 11, gridRow: 2 + (id - 31) }
}
```

Also convert the two remaining hardcoded jail-space literals (bonus within this domain, already-consted `JAIL_SPACE`):
- `src/logic/cards.ts:137` — `position: 10` → `position: JAIL_SPACE` (add `JAIL_SPACE` to the cards import).
- `src/components/PlayerTokens.tsx:61` — `player.position === 10` → `player.position === JAIL_SPACE`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass, no remaining `% 40`, `houses === 5`, `houses >= 5`, `houses < 5`, or `id === 0/10/20/30` corner literals in non-test source (`grep -rn "houses [=<>]=* 5\|% 40\|=== 10" src --include="*.ts" --include="*.tsx" | grep -v __tests__` should be empty).

- [ ] **Step 6: Commit**

```bash
git add src/data/board.ts src/logic/gameReducer.ts src/logic/cards.ts src/logic/rent.ts src/logic/bot.ts src/logic/seed.ts src/components/PlayerTokens.tsx src/components/BoardGrid.tsx src/components/ActionSection.tsx src/components/PropertyTooltip.tsx
git commit -m "refactor: add BOARD_SIZE, MAX_HOUSES, BOARD_CORNER_SPACES constants"
```

---

### Task 2: Player slots — `MAX_PLAYERS`

**Files:**
- Modify: `src/data/players.ts`
- Modify: `server/gameServer.ts`, `src/logic/seed.ts`, `src/components/Lobby.tsx`

**Interfaces:**
- Produces: `MAX_PLAYERS: 6` exported from `src/data/players.ts`.

- [ ] **Step 1: Add the constant to `src/data/players.ts`**

```ts
export const MAX_PLAYERS = 6
```

- [ ] **Step 2: Re-point consumers**

- `server/gameServer.ts:26` — delete `const MAX_PLAYERS = 6`; import `{ MAX_PLAYERS }` from `'../src/data/players'`. Uses at `:34`, `:367`, `:368` keep the same identifier.
- `src/logic/seed.ts:6` — delete `const MAX_SLOTS = 6;`; import `MAX_PLAYERS` from `'../data/players'`; replace `MAX_SLOTS` at `:107` and `:108` with `MAX_PLAYERS`.
- `src/components/Lobby.tsx:39` — `Array.from({ length: 6 })` → `Array.from({ length: MAX_PLAYERS })`; `:64` — `lobby.filter((p) => p.name).length >= 6` → `>= MAX_PLAYERS`. Extend the existing `import { PLAYER_COLORS } from '../data/players'` (line 5).

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass. Confirm no remaining `length: 6`/`MAX_SLOTS`/local `MAX_PLAYERS = 6` in `src/`/`server/` non-test source.

- [ ] **Step 4: Commit**

```bash
git add src/data/players.ts server/gameServer.ts src/logic/seed.ts src/components/Lobby.tsx
git commit -m "refactor: unify MAX_PLAYERS constant"
```

---

### Task 3: Dice faces — `DICE_FACES` + `DieFace`

**Files:**
- Modify: `src/logic/controlledDice.ts`
- Modify: `src/components/Dice.tsx`

**Interfaces:**
- Produces: `DICE_FACES: readonly [1, 2, 3, 4, 5, 6]` and `type DieFace = 1 | 2 | 3 | 4 | 5 | 6` exported from `src/logic/controlledDice.ts`. Task uses `DieFace` to type `PIPS`.

- [ ] **Step 1: Add the constants to `src/logic/controlledDice.ts`**

```ts
export const DICE_FACES = [1, 2, 3, 4, 5, 6] as const;
export type DieFace = (typeof DICE_FACES)[number];
```

- [ ] **Step 2: Use `DICE_FACES` in the pair-splitting loop**

Replace lines 47-49:

```ts
  const pairs: [number, number][] = [];
  for (const a of DICE_FACES) {
    const b = total - a;
    if (DICE_FACES.includes(b as DieFace)) pairs.push([a, b]);
  }
```

- [ ] **Step 3: Type `PIPS` with `DieFace` in `src/components/Dice.tsx`**

```tsx
import type { DieFace } from '../logic/controlledDice'

const PIPS: Record<DieFace, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}
```

The `PIPS[value]` access at line 33 must become `PIPS[value as DieFace] ?? []` (the `value == null` branch renders the `?` placeholder and never reaches the access, so the cast is safe — it mirrors the `b as DieFace` cast in `controlledDice.ts`). No other change; `value` is `number | null` and stays that way.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/logic/controlledDice.ts src/components/Dice.tsx
git commit -m "refactor: add DICE_FACES constant and DieFace type"
```

---

### Task 4: SetBotControl reason — `BotControlReason`

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/logic/gameReducer.ts`, `server/gameServer.ts`

**Interfaces:**
- Produces: `BotControlReason` const + derived type exported from `src/types/game.ts` (values `'offline' | 'afk'`, wire-identical).

- [ ] **Step 1: Add the const to `src/types/game.ts`**

Place next to the other top-level consts (after `GameActionType`, semicolon style):

```ts
export const BotControlReason = { Offline: 'offline', Afk: 'afk' } as const;
export type BotControlReason = (typeof BotControlReason)[keyof typeof BotControlReason];
```

- [ ] **Step 2: Type the action payload**

`src/types/game.ts:258` — `reason?: 'offline' | 'afk'` → `reason?: BotControlReason`.

- [ ] **Step 3: Re-point consumers**

- `src/logic/gameReducer.ts:809` — `action.controlled ? action.reason === 'afk' : false` → `action.controlled ? action.reason === BotControlReason.Afk : false`; `:812` — `action.reason === 'afk'` → `action.reason === BotControlReason.Afk`. Add `BotControlReason` to the `'../types/game'` value import (line 1).
- `server/gameServer.ts:471` — `reason: 'afk'` → `reason: BotControlReason.Afk`. Add `BotControlReason` to the `'../src/types/game'` import (line 2).

Do NOT edit test files — `reason: 'afk'` string literals in `src/logic/__tests__/gameReducer.test.ts` remain valid (assignable to the union).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts server/gameServer.ts
git commit -m "refactor: add BotControlReason const"
```

---

### Task 5: Validation discriminator — `ValidationKind` (C-28) + `ScenarioMessageKind` (C-05)

**Files:**
- Modify: `src/logic/seed.ts`
- Modify: `src/components/LoadScenarioPanel.tsx`
- Modify: `server/http.ts`, `server/gameServer.ts`
- Test: `src/logic/__tests__/seed.test.ts`

**Interfaces:**
- Produces: `ValidationKind = { Ok: 'ok', Error: 'error' }` + `type ValidationKind` and the new `type ValidationResult = { kind: typeof ValidationKind.Ok } | { kind: typeof ValidationKind.Error; message: string }` from `src/logic/seed.ts`; `ScenarioMessageKind = { Ok: 'ok', Error: 'error' }` (component-local) from `LoadScenarioPanel.tsx`.

- [ ] **Step 1: Add the const and change the type in `src/logic/seed.ts`**

```ts
export const ValidationKind = { Ok: 'ok', Error: 'error' } as const;
export type ValidationKind = (typeof ValidationKind)[keyof typeof ValidationKind];

export type ValidationResult =
  | { kind: typeof ValidationKind.Ok }
  | { kind: typeof ValidationKind.Error; message: string };
```

- [ ] **Step 2: Update every return in `validateStateStructure` and `validateStateForRoom`**

Replace all `{ ok: false, message: ... }` → `{ kind: ValidationKind.Error, message: ... }` (16 sites, lines 101, 105, 108, 113, 116, 119, 122, 128, 132, 135, 138, 141, 155, 159, 163, 168) and both `{ ok: true }` (lines 143, 170) → `{ kind: ValidationKind.Ok }`.

- [ ] **Step 3: Update consumers**

- `server/http.ts:80` — `if (!structural.ok) throw new Error(structural.message)` → `if (structural.kind !== ValidationKind.Ok) throw new Error(structural.message)`; `:90` — `if (!roomCheck.ok)` → `if (roomCheck.kind !== ValidationKind.Ok)`. Add `ValidationKind` to the `'../src/logic/seed'` import (line 9).
- `server/gameServer.ts:198` — `if (!structural.ok) {` → `if (structural.kind !== ValidationKind.Ok) {`; `:202` — `if (!roomCheck.ok) {` → `if (roomCheck.kind !== ValidationKind.Ok) {`. Add `ValidationKind` to the `'../src/logic/seed'` import (line 8).
- `src/components/LoadScenarioPanel.tsx`:
  - Add near the top (component-local, no semicolons): `const ScenarioMessageKind = { Ok: 'ok', Error: 'error' } as const` and `type ScenarioMessageKind = (typeof ScenarioMessageKind)[keyof typeof ScenarioMessageKind]`.
  - Line 16 — `useState<{ kind: 'ok' | 'error'; text: string } | null>` → `useState<{ kind: ScenarioMessageKind; text: string } | null>`.
  - Line 26 — `setMessage({ kind: 'error', ... })` → `{ kind: ScenarioMessageKind.Error, ... }`; line 44 → `ScenarioMessageKind.Ok`; line 47 and 50 → `ScenarioMessageKind.Error`.
  - Line 30 — `setMessage(result.ok ? { kind: 'ok', text: t('seed.validJson') } : { kind: 'error', text: result.message })` → `setMessage(result.kind === ValidationKind.Ok ? { kind: ScenarioMessageKind.Ok, text: t('seed.validJson') } : { kind: ScenarioMessageKind.Error, text: result.message })`. Add `import { validateStateStructure, ValidationKind } from '../logic/seed'` (line 4).
  - Line 84 — `message.kind === 'ok'` → `message.kind === ScenarioMessageKind.Ok`.

- [ ] **Step 4: Update `src/logic/__tests__/seed.test.ts`**

- Add `ValidationKind` to the import from `'../seed'` (line 4).
- `:40` and `:56` — `validateStateStructure(s).ok` → `validateStateStructure(s).kind`, asserting `.toBe(ValidationKind.Ok)`.
- `:64` — `toEqual({ ok: false, message: expect.stringContaining('40') })` → `toEqual({ kind: ValidationKind.Error, message: expect.stringContaining('40') })`.
- Lines 70, 76, 82, 88, 90, 96, 102, 108, 114 — `.ok).toBe(false)` → `.kind).toBe(ValidationKind.Error)`.
- Lines 121, 140 — `.ok).toBe(true)` → `.kind).toBe(ValidationKind.Ok)`.
- Lines 126, 134, 148 — `.ok).toBe(false)` → `.kind).toBe(ValidationKind.Error)`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass, including `seed.test.ts`. Grep to confirm no `.ok`-shaped `ValidationResult` consumers remain in `src/`+`server/` non-test source.

- [ ] **Step 6: Commit**

```bash
git add src/logic/seed.ts src/components/LoadScenarioPanel.tsx server/http.ts server/gameServer.ts src/logic/__tests__/seed.test.ts
git commit -m "refactor: ValidationResult to kind-tagged union via ValidationKind"
```

---

### Task 6: Language codes + storage keys — `Language` + `StorageKey` (C-06, C-07)

**Files:**
- Create: `src/i18n/constants.ts`
- Modify: `src/i18n/index.ts`, `src/i18n/CurrencyContext.tsx`, `src/net/session.ts`, `src/components/LanguageCurrencyBar.tsx`, `src/test/setup.ts`
- Test (plan amendment 2026-08-20, to satisfy the no-literal grep): `src/net/__tests__/session.test.ts`, `src/i18n/__tests__/id-idr-feature-flag.test.ts`

**Interfaces:**
- Produces: from `src/i18n/constants.ts`: `Language = { En: 'en', Id: 'id' }`, `type Language`, `DEFAULT_LANGUAGE: Language = Language.En`, `StorageKey = { Language: 'monopoly-language', Currency: 'monopoly-currency', MpSession: 'monopoly-mp-session' }`, `type StorageKey`. No side effects at import time (must be safe to import from vitest setup).

- [ ] **Step 1: Create `src/i18n/constants.ts`** (no semicolons)

```ts
export const Language = { En: 'en', Id: 'id' } as const
export type Language = (typeof Language)[keyof typeof Language]

export const DEFAULT_LANGUAGE: Language = Language.En

export const StorageKey = {
  Language: 'monopoly-language',
  Currency: 'monopoly-currency',
  MpSession: 'monopoly-mp-session',
} as const
export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey]
```

- [ ] **Step 2: `src/i18n/index.ts`**

- Delete line 7 `const STORAGE_KEY = 'monopoly-language'` and line 8 `export const DEFAULT_LANGUAGE = 'en'`.
- Import `{ DEFAULT_LANGUAGE, Language, StorageKey }` from `'./constants'`.
- Replace `localStorage.getItem(STORAGE_KEY)` → `localStorage.getItem(StorageKey.Language)` (line 12) and `localStorage.setItem(STORAGE_KEY, lng)` → `localStorage.setItem(StorageKey.Language, lng)` (line 35).
- Line 24-25 — `en: { translation: en },` → `[Language.En]: { translation: en },`; `id: ...` → `[Language.Id]: { translation: id },`.
- `resolveInitialLanguage` return type `: string` may stay `string` (i18next accepts arbitrary strings).

- [ ] **Step 3: `src/i18n/CurrencyContext.tsx`**

- Delete line 5 `const STORAGE_KEY = 'monopoly-currency'`.
- Import `StorageKey` from `'./constants'`; replace `localStorage.getItem(STORAGE_KEY)` (line 19) → `localStorage.getItem(StorageKey.Currency)` and `localStorage.setItem(STORAGE_KEY, next)` (line 33) → `localStorage.setItem(StorageKey.Currency, next)`.

- [ ] **Step 4: `src/net/session.ts`**

- Delete line 7 `const KEY = 'monopoly-mp-session'`.
- Import `StorageKey` from `'../i18n/constants'`; replace `KEY` at lines 11, 16, 27 with `StorageKey.MpSession`.

- [ ] **Step 5: `src/components/LanguageCurrencyBar.tsx`**

- Line 49-50 — `<option value="en">EN</option>` → `<option value={Language.En}>EN</option>`; `<option value="id">ID</option>` → `<option value={Language.Id}>ID</option>`. Import `Language` from `'../i18n/constants'`.

- [ ] **Step 6: `src/test/setup.ts`**

- Lines 31-32 — `localStorage.setItem('monopoly-language', 'en')` → `localStorage.setItem(StorageKey.Language, Language.En)`; `localStorage.setItem('monopoly-currency', 'USD')` → `localStorage.setItem(StorageKey.Currency, 'USD')` (USD stays a `Currency` literal — leave it). Import `{ Language, StorageKey }` from `'../i18n/constants'`.

- [ ] **Step 7: Update the storage-key literals in the two unit-test files** (plan amendment — required so the acceptance grep below is meaningful)

- `src/net/__tests__/session.test.ts:23` — `'monopoly-mp-session'` → `StorageKey.MpSession` (import `{ StorageKey }` from `'../../i18n/constants'`).
- `src/i18n/__tests__/id-idr-feature-flag.test.ts:10-11` — `'monopoly-language'` → `StorageKey.Language`; `'monopoly-currency'` → `StorageKey.Currency` (import `{ StorageKey }` from `'../constants'`).
- Only the exact monopoly storage-key literals are converted; other assertions untouched.

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass. Grep confirms no remaining literal `'monopoly-` keys outside `src/i18n/constants.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/i18n/constants.ts src/i18n/index.ts src/i18n/CurrencyContext.tsx src/net/session.ts src/components/LanguageCurrencyBar.tsx src/test/setup.ts src/net/__tests__/session.test.ts src/i18n/__tests__/id-idr-feature-flag.test.ts
git commit -m "refactor: add Language and StorageKey constants"
```

---

### Task 7: Log param keys — `LogParamKey` (C-08)

**Files:**
- Modify: `src/types/game.ts`
- Modify: `src/i18n/log.ts`, `src/logic/logEntries.ts`, `src/logic/cards.ts`, `src/logic/gameReducer.ts`

**Interfaces:**
- Produces: `LogParamKey = { Bot: 'bot', SpaceId: 'spaceId', CardId: 'cardId', Amount: 'amount', Money: 'money', PerHouse: 'perHouse', PerHotel: 'perHotel', PerPlayer: 'perPlayer' }` + `type LogParamKey` exported from `src/types/game.ts`, placed immediately after the `LogEventKey` block (its sibling log vocabulary). Home is `src/types/game.ts` — NOT `src/i18n/log.ts` — so `gameReducer` (compiled by `tsconfig.server.json`) can import it without dragging i18n into the server build.

- [ ] **Step 1: Add the const to `src/types/game.ts`** (semicolon style, next to `LogEventKey`)

```ts
export const LogParamKey = {
  Bot: 'bot',
  SpaceId: 'spaceId',
  CardId: 'cardId',
  Amount: 'amount',
  Money: 'money',
  PerHouse: 'perHouse',
  PerHotel: 'perHotel',
  PerPlayer: 'perPlayer',
} as const;
export type LogParamKey = (typeof LogParamKey)[keyof typeof LogParamKey];
```

- [ ] **Step 2: Re-point the interpreter** (`src/i18n/log.ts`)

Add `LogParamKey` to the existing `import { CardType, type LogEntry } from '../types/game'` (line 2, value import).

- Line 4 — `const MONEY_PARAM_KEYS = new Set(['amount', 'money', 'perHouse', 'perHotel', 'perPlayer'])` → `const MONEY_PARAM_KEYS = new Set<string>([LogParamKey.Amount, LogParamKey.Money, LogParamKey.PerHouse, LogParamKey.PerHotel, LogParamKey.PerPlayer])`.
- Line 17 — `key === 'bot'` → `key === LogParamKey.Bot`.
- Line 18 — `key === 'spaceId'` → `key === LogParamKey.SpaceId`.
- Line 20 — `key === 'cardId'` → `key === LogParamKey.CardId`.

- [ ] **Step 3: Re-point the emitters**

Every log-param object key that is one of the 8 const members becomes a computed key referencing `LogParamKey`. Add `LogParamKey` to the existing `'../types/game'` value import in each file:

- `src/logic/logEntries.ts` (line 1 import). Line 10 and line 16: `{ bot: true }` → `{ [LogParamKey.Bot]: true }`.
- `src/logic/cards.ts` (line 1 import). Line 18, 23, 27, 35: `cardId` → `[LogParamKey.CardId]` and `amount` → `[LogParamKey.Amount]` where present; line 61: `cardId`/`amount`/`perPlayer` → const refs (leave `playerCount` literal); line 82: `cardId`/`amount`/`perHouse`/`perHotel` → const refs (leave `houseCount`, `hotelCount` literal); line 99: `amount` → `[LogParamKey.Amount]`; line 109: `spaceId` → `[LogParamKey.SpaceId]`, `cardId` → `[LogParamKey.CardId]`.
- `src/logic/gameReducer.ts` (line 1 import). Replace the const-member keys in `actorEntry(..., { ... })` param objects at the sites listed by the catalog: lines 98, 126, 181 (`amount`); 172 is OUT of scope (`d1/d2/total/target/luck` pass-through — leave); 292-293 (`amount`, `money`); 322, 330, 405, 759, 770 (`bot` marker → `[LogParamKey.Bot]: true`; also `amount` at 405 and 759); 381, 443, 460, 477, 495 (`spaceId` + `amount`); 519-521 SellProperty `{ spaceId: space.id, amount: sellValue }` → const refs. Leave free-form keys literal (`name`, `owner`, `creditor`, `winner`, `from`, `to`, `houseCount`, `hotelCount`, `playerCount`, `d1`, `d2`, `total`, `target`, `luck`, `attempt`).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass (log translation unit tests exercise `resolveLogEntry`). The wire/translation behavior is byte-identical because the const values equal the original strings.

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts src/i18n/log.ts src/logic/logEntries.ts src/logic/cards.ts src/logic/gameReducer.ts
git commit -m "refactor: add LogParamKey shared vocabulary"
```

---

### Task 8: HTTP endpoint paths — `HttpPath` (C-09)

**Files:**
- Modify: `src/types/net.ts`
- Modify: `server/http.ts`, `src/net/client.ts`, `src/hooks/useServerConfig.ts`, `src/hooks/useRoomList.ts`, `src/components/LoadScenarioPanel.tsx`

**Interfaces:**
- Produces: `HttpPath = { Config: '/config', Seed: '/seed', Rooms: '/rooms', Ws: '/ws' }` + `type HttpPath` exported from `src/types/net.ts` (shared client/server contract module — `tsconfig.server.json` includes `src/types`).

- [ ] **Step 1: Add the const to `src/types/net.ts`** (no semicolons; match file style)

```ts
export const HttpPath = {
  Config: '/config',
  Seed: '/seed',
  Rooms: '/rooms',
  Ws: '/ws',
} as const
export type HttpPath = (typeof HttpPath)[keyof typeof HttpPath]
```

- [ ] **Step 2: Re-point the server** (`server/http.ts`)

- Line 45 — `url.pathname === '/config'` → `url.pathname === HttpPath.Config`.
- Line 51 — `url.pathname === '/seed'` → `url.pathname === HttpPath.Seed`.
- Line 101 — `url.pathname === '/rooms'` → `url.pathname === HttpPath.Rooms`.
- Line 134 — `new WebSocketServer({ server: httpServer, path: '/ws' })` → `path: HttpPath.Ws`.
- Add `HttpPath` to the existing `import { ClientMessageType, ServerMessageType } from '../src/types/net'` (line 6).

- [ ] **Step 3: Re-point the client**

- `src/net/client.ts:26` — `` `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws` `` → `` `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${HttpPath.Ws}` ``. Add `import { HttpPath } from '../types/net'` (merge with the existing type import on line 1 — note `HttpPath` is a value, so it goes in a non-`type` import; keep `ClientMessage`/`ServerMessage` as `import type`).
- `src/hooks/useServerConfig.ts:9` — `fetch('/config')` → `fetch(HttpPath.Config)`. Import `HttpPath` from `'../types/net'`.
- `src/hooks/useRoomList.ts:19` — `fetch('/rooms')` → `fetch(HttpPath.Rooms)`. Import from `'../types/net'` (line 2 already has a `type` import — add a value import or extend with a separate import).
- `src/components/LoadScenarioPanel.tsx:37` — `fetch('/seed', {...})` → `fetch(HttpPath.Seed, {...})`. Import `HttpPath` from `'../types/net'`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass. Server compiles via `npm run typecheck` (tsc -b covers `tsconfig.server.json`).

- [ ] **Step 5: Commit**

```bash
git add src/types/net.ts server/http.ts src/net/client.ts src/hooks/useServerConfig.ts src/hooks/useRoomList.ts src/components/LoadScenarioPanel.tsx
git commit -m "refactor: add HttpPath shared path constants"
```

---

### Task 9: Button design tokens — `ButtonVariant` + `ButtonSize` (C-02, C-03)

**Files:**
- Modify: `src/components/Button.tsx`
- Modify: `src/components/HoldToConfirmButton.tsx`

**Interfaces:**
- Produces: `ButtonVariant = { Primary: 'primary', Success: 'success', Secondary: 'secondary', Danger: 'danger', Start: 'start' }` + `type ButtonVariant`, and `ButtonSize = { Sm: 'sm', Md: 'md', Lg: 'lg' }` + `type ButtonSize`, exported from `src/components/Button.tsx`.

- [ ] **Step 1: Add the consts to `src/components/Button.tsx`** (no semicolons)

```ts
export const ButtonVariant = {
  Primary: 'primary',
  Success: 'success',
  Secondary: 'secondary',
  Danger: 'danger',
  Start: 'start',
} as const
export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant]

export const ButtonSize = { Sm: 'sm', Md: 'md', Lg: 'lg' } as const
export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize]
```

- [ ] **Step 2: Update `Button.tsx`**

- Line 6 — `variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'start'` → `variant?: ButtonVariant`.
- Line 7 — `size?: 'sm' | 'md' | 'lg'` → `size?: ButtonSize`.
- Lines 12-18 — type the lookup maps with the enum keys and switch to const refs:

```tsx
const variantClasses: Record<ButtonVariant, string> = {
  [ButtonVariant.Primary]: 'bg-blue-primary text-white',
  [ButtonVariant.Success]: 'bg-green-success text-white',
  [ButtonVariant.Secondary]: 'bg-orange text-white',
  [ButtonVariant.Danger]: 'bg-red-danger text-white',
  [ButtonVariant.Start]: 'bg-gold text-bg-main',
}

const sizeClasses: Record<ButtonSize, string> = {
  [ButtonSize.Sm]: 'px-2.5 py-1 text-base',
  [ButtonSize.Md]: 'px-3.5 py-1.5 text-base',
  [ButtonSize.Lg]: 'px-5 py-2.5 text-xl',
}
```

- Line 27-28 — defaults `variant = 'primary'` → `variant = ButtonVariant.Primary`; `size = 'md'` → `size = ButtonSize.Md`.

- [ ] **Step 3: Update `HoldToConfirmButton.tsx`**

- Lines 11-12 — `variant?: 'primary' | ...` → `variant?: ButtonVariant`; `size?: 'sm' | 'md' | 'lg'` → `size?: ButtonSize`. Import `type ButtonVariant, type ButtonSize` from `'./Button'` (line 4).
- Lines 24-25 — defaults `variant = 'primary'` → `ButtonVariant.Primary`; `size = 'md'` → `ButtonSize.Md`.

Do NOT convert the `variant="danger"`/`size="sm"` usages in OTHER components (they're already string literals assignable to the union — out of scope for this refactor).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Button.tsx src/components/HoldToConfirmButton.tsx
git commit -m "refactor: add ButtonVariant and ButtonSize consts"
```

---

### Task 10: `RoomExitVariant` (C-04) + `parseEnvFlag` (C-10)

**Files:**
- Modify: `src/components/RoomExit.tsx`
- Create: `src/utils/env.ts`
- Modify: `src/config/features.ts`, `server/main.ts`

**Interfaces:**
- Produces: `RoomExitVariant` (component-local) from `RoomExit.tsx`; `parseEnvFlag(value: string | undefined): boolean` exported from `src/utils/env.ts` (server-safe: `tsconfig.server.json` already includes `src/utils`).

- [ ] **Step 1: `RoomExit.tsx`** (no semicolons)

```tsx
const RoomExitVariant = { Icon: 'icon', Button: 'button' } as const
type RoomExitVariant = (typeof RoomExitVariant)[keyof typeof RoomExitVariant]

interface Props {
  onLeave: () => void
  variant?: RoomExitVariant
  labelKey?: string
  titleKey?: string
  messageKey?: string
  confirmKey?: string
}
```

Line 15 — default `variant = 'button'` → `variant = RoomExitVariant.Button`. Lines 24-25 — `variant === 'icon'` → `variant === RoomExitVariant.Icon` (both occurrences).

- [ ] **Step 2: Create `src/utils/env.ts`** (no semicolons)

```ts
export function parseEnvFlag(value: string | undefined): boolean {
  return value === 'true'
}
```

- [ ] **Step 3: `src/config/features.ts`**

```ts
import { parseEnvFlag } from '../utils/env'

export const ID_IDR_ENABLED = parseEnvFlag(import.meta.env.VITE_ID_IDR_ENABLED)
```

- [ ] **Step 4: `server/main.ts`**

```ts
import { parseEnvFlag } from '../src/utils/env'
...
const tradesEnabled = parseEnvFlag(process.env.TRADES_ENABLED)
const seedEnabled = parseEnvFlag(process.env.E2E_SEED_ENABLED)
```

(Line 5-6 replacements; behavior identical — anything other than the literal `'true'` is `false`, matching the documented env semantics.)

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/RoomExit.tsx src/utils/env.ts src/config/features.ts server/main.ts
git commit -m "refactor: add RoomExitVariant const and parseEnvFlag helper"
```

---

### Task 11: Catalog annotation + full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md`

- [ ] **Step 1: Annotate the catalog**

At the top of the file (below the `Purpose:` line), insert a one-line status note:

```markdown
Status: conversions applied 2026-08-20 on branch `enum-conversion` — converted:
C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08, C-09, C-14, C-15, C-17, C-18,
C-19, C-28 (C-10 → `parseEnvFlag` helper, not an enum; C-16 already consted;
C-11..C-13, C-20..C-27 intentionally not converted).
```

- [ ] **Step 2: Full verification**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run build`
Expected: all green. Then run the e2e suite (server-backed specs need the built `dist/`, which `npm run build` just produced): `npm run test:e2e`
Expected: all green. If any e2e spec fails on flaky/environment grounds, record the exact failure and rerun once; a genuine regression must be fixed before finishing.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md
git commit -m "docs: annotate enum-candidate catalog with conversion status"
```
