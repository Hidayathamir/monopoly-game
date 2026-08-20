# Enum-Candidate Survey Design

Date: 2026-08-20

## Problem

The repo has a codified "enum" convention — `const` object + derived union
type (see `src/types/game.ts`, `src/types/net.ts`, `src/data/currency.ts`;
TS `enum` is forbidden by `erasableSyntaxOnly`). Two prior rounds already
converted the big, obvious sets: wire/net message types, game action types,
phases, connection status, `LogEventKey`, `Currency`, `SoundId` (audio), and
`MpAction` (GameSetup).

But the full universe of values that *could* be treated as enum has never been
enumerated. This session produces a **candidate catalog only** — a document
listing every place in production code where a fixed, finite set of string /
number / boolean / other values is used without a backing `const` object.
No conversions happen in this session.

## Scope

- **In scope**: production code under `src/` and `server/`. The catalog may
  flag things in `e2e/`/`scripts/` only as incidental notes.
- **Out of scope**: writing conversions; changing any value; `docs/*` edits
  beyond the new catalog/design/plan files; test files.
- **False positives are acceptable** — the user explicitly wants the net cast
  wide. Every entry carries a confidence label instead of being silently
  dropped.

## Goals

- A single catalog document listing every enum-like candidate with: location
  (`file:line`), the exact value set, a proposed `const`-object name + derived
  union type, and a confidence rating (High/Medium/Low).
- Categories enumerated so nothing is missed by construction.
- Zero behavior change; no code modified.

## Non-Goals

- No conversion of any candidate.
- No TS `enum` (repo constraint).
- No change to existing `enums.test.ts` value locks.
- No change to AGENTS.md convention text (the convention already exists).

## Definition of "enum candidate"

A value, or set of values, that satisfies:

- It is a fixed, finite set of **string** literals used in type position or in
  comparisons/emissions, **or**
- a fixed, finite set of **number** literals (ranges or enumerated maps), **or**
- a **boolean** used as a discriminator (not a plain flag), **or**
- any other literal set treated as a vocabulary (storage keys, i18n codes,
  endpoint paths, param keys).

Excluded by definition:

- Free-form values (player names, messages, money amounts, CSS class strings,
  space `color` names).
- Plain boolean flags that are not discriminators (`bankrupt`, `inJail`,
  `mortgaged`, `isBot`, `afk`, `passedGo`, `botControlled`) — two-state
  flags that are already `boolean`; converting them to a 2-member enum is an
  anti-pattern (they are noted only where they act as a discriminator).
- Browser/DOM API vocabularies (`AudioContext.state`, `OscillatorType`,
  `KeyboardEvent.key`, `Intl` locales, `URL.protocol`) — owned by the platform,
  not the app; noted with Low/Likely-No confidence where the user may disagree.
- Data-driven lookup maps whose key set is *already* the value set of an
  existing const (`TYPE_MAP` in `src/data/board.ts` keys `SpaceType`) — noted
  as covered-by-existing.

## Candidate Categories

The survey enumerates these categories (initial candidate seed list from the
exploration pass; subagents expand/verify):

### A. String unions / vocabularies (production)

| # | Candidate | Location | Value set | Confidence |
|---|-----------|----------|-----------|------------|
| A1 | `SetBotControl.reason` | `src/types/game.ts:258` (`reason?: 'offline' \| 'afk'`); used in `src/logic/gameReducer.ts:809-812`, `server/gameServer.ts`, `src/logic/bot.ts` | `'offline' \| 'afk'` | **High** (domain, wire-facing action payload) |
| A2 | Button `variant` | `src/components/Button.tsx:6`, `HoldToConfirmButton.tsx:11` | `'primary' \| 'success' \| 'secondary' \| 'danger' \| 'start'` | Low (design token) |
| A3 | Button `size` | `src/components/Button.tsx:7`, `HoldToConfirmButton.tsx:12` | `'sm' \| 'md' \| 'lg'` | Low (design token) |
| A4 | `RoomExit` `variant` | `src/components/RoomExit.tsx:8` | `'icon' \| 'button'` | Low (design token) |
| A5 | LoadScenarioPanel message `kind` | `src/components/LoadScenarioPanel.tsx:16` | `'ok' \| 'error'` | Low |
| A6 | Language codes | `src/i18n/index.ts:8` (`DEFAULT_LANGUAGE = 'en'`), `src/components/LanguageCurrencyBar.tsx:49-50`, `src/test/setup.ts` | `'en' \| 'id'` | Medium |
| A7 | localStorage keys | `src/i18n/index.ts:7`, `src/i18n/CurrencyContext.tsx:5`, `src/net/session.ts:7` | `'monopoly-language'`, `'monopoly-currency'`, `'monopoly-mp-session'` | Medium |
| A8 | LogEntry param keys | `src/i18n/log.ts:4,17-23` | `'bot'`, `'spaceId'`, `'cardId'`, money keys `'amount' \| 'money' \| 'perHouse' \| 'perHotel' \| 'perPlayer'` | Medium |
| A9 | HTTP endpoint paths | `server/http.ts:45,51,101`, `src/net/client.ts` (`/config`, `/seed`, `/rooms`, `/ws`) | fixed path set | Low |
| A10 | Env `'true'` parsing | `src/config/features.ts:1`, `server/main.ts:5-6` | `'true'` | Low |
| A11 | URL protocols | `src/net/client.ts:26`, `server/http.ts` | `'wss' \| 'ws'`, `'https:'` | Low / Likely-No |
| A12 | Keyboard event keys | `src/components/LanguageCurrencyBar.tsx:22`, `HoldToConfirmButton.tsx:82,89` | `'Escape'`, `' '`, `'Enter'` | Low / Likely-No |
| A13 | HTTP MIME map keys | `server/http.ts:11` | extension→mime | Low / Likely-No |

### B. Number sets

| # | Candidate | Location | Value set | Confidence |
|---|-----------|----------|-----------|------------|
| B1 | Dice faces | `src/logic/gameReducer.ts`, `src/logic/controlledDice.ts:47-49`, `src/components/Dice.tsx` (PIPS keys) | `1..6` | Medium |
| B2 | Dice totals | `src/logic/controlledDice.ts:3` | `2..12` (already `as const` `TOTALS`) | Reference (already const) |
| B3 | Player slots | `server/gameServer.ts:26` (`MAX_PLAYERS = 6`), `src/logic/seed.ts:6` (`MAX_SLOTS = 6`) | `0..5` | Low (already constants) |
| B4 | Board size | `src/logic/seed.ts:5` (`BOARD_SIZE = 40`), `src/data/board.ts` | `0..39` | Low |
| B5 | Jail turns | `src/data/board.ts:51` (`MAX_JAIL_TURNS = 3`), `src/logic/gameReducer.ts:117` | `0..3` | Low |
| B6 | `PIPS` keys | `src/components/Dice.tsx:6-13` | `1..6` | Low (data map; overlaps B1) |
| B7 | `STANDARD_COUNTS` keys | `src/logic/controlledDice.ts:5-7` | `2..12` | Low (data map; overlaps B2) |
| B8 | `PEAK_WEIGHTS` keys | `src/logic/controlledDice.ts:9` | `0..3` | Low (data map) |
| B9 | `POSITIONS` keys | `src/components/PlayerTokens.tsx:21` | `0..39` | Low (data map; overlaps B4) |
| B10 | `PLAYER_OFFSETS` keys | `src/data/players.ts:10` | player id slots | Low (data map; overlaps B3) |

### C. Boolean discriminators

| # | Candidate | Location | Value set | Confidence |
|---|-----------|----------|-----------|------------|
| C1 | `ValidationResult.ok` | `src/logic/seed.ts:97` | `true \| false` (discriminator) | Medium |

### D. Reference — already-converted consts (NOT candidates)

`SpaceType`, `CardType`, `CardActionType`, `TaxType`, `GamePhase`,
`PendingActionType`, `GameActionType`, `LogEventKey` (`src/types/game.ts`),
`ConnectionStatus`, `ClientMessageType`, `ServerMessageType`
(`src/types/net.ts`), `Currency` (`src/data/currency.ts`), `SoundId`
(`src/audio/soundEngine.ts`), `MpAction` (`src/components/GameSetup.tsx`),
`TOTALS` (`src/logic/controlledDice.ts`).

## Catalog schema

Each catalog entry:

```md
### C-01 (A1) `reason` on SetBotControl
- **Location**: `src/types/game.ts:258` (+ usages: gameReducer.ts:809-812, server, bot.ts)
- **Value set**: `'offline' | 'afk'`
- **Proposed const**: `BotControlReason = { Offline: 'offline', Afk: 'afk' } as const`
  + `type BotControlReason = (typeof BotControlReason)[keyof typeof BotControlReason]`
- **Confidence**: High — domain value, wire-facing action payload, string-union already
```

## Methodology

1. **Raw dump (script)**: a throwaway Node script under `/tmp` scans
   `src/` + `server/` (`.ts`/`.tsx`, excluding `__tests__`/`e2e`) and emits:
   - inline string-literal unions in type positions,
   - `as const` declarations (to classify done vs candidate),
   - `Record<string|number, ...>` / `Set<string>` / `Map<string|number, ...>`
     keys with small fixed domains,
   - comparison literals (`=== '...'`, `!== '...'`),
   - literal maps keyed by numbers,
   - boolean discriminators (`{ ok: true } | { ok: false; ... }` shape).
2. **Curation (subagents, in parallel)**: one subagent per category
   (A strings / B numbers / C booleans / D verify-done-list) verifies each
   raw hit against the live code (codegraph + targeted reads), filters
   free-form/excluded cases, and fills in the proposed const names + confidence.
3. **Assembly**: the final catalog is written to
   `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md` (design-adjacent
   doc) with the schema above, plus a summary table grouped by confidence.
4. **Verification**: the catalog is cross-checked for (a) every prior-spec
   non-goal surfaced (they appear as Low/Likely-No entries), (b) all
   already-converted consts present in the reference section, (c) no
   production file edited.

## Files

- New: `docs/superpowers/specs/2026-08-20-enum-candidate-catalog.md` (the
  deliverable).
- New: `docs/superpowers/specs/2026-08-20-enum-candidate-survey-design.md`
  (this file).
- New: `docs/superpowers/plans/2026-08-20-enum-candidate-survey.md`
  (implementation plan, produced by writing-plans skill).
- No production code changes.

## Verification

- `git status` clean of any `src/`/`server/` edits (only `docs/` changes).
- Catalog cross-check pass described in Methodology step 4.
- `npm run typecheck` and `npm run lint` untouched-but-green to confirm no
  accidental edits.
