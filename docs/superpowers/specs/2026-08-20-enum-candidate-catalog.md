# Enum-Candidate Catalog

Date: 2026-08-20

Purpose: Survey only — no conversions performed. Every enum-like candidate in
`src/` + `server/` that lacks a backing `const` object, rated by confidence.
Design: [enum-candidate-survey-design.md](./2026-08-20-enum-candidate-survey-design.md).

## Summary

28 candidates across three categories (A strings, B numbers, C booleans),
sequentially numbered `C-01`..`C-28` (original letter-slug kept as a tag),
plus 15 already-converted reference consts (Category D, NOT candidates).

### High

| ID | Candidate | Value set | Location |
|----|-----------|-----------|----------|
| C-01 (A01) | `SetBotControl.reason` | `'offline' \| 'afk'` | `src/types/game.ts:258` |
| C-14 (B01) | Dice faces | `1..6` | `src/logic/controlledDice.ts:47-49` |
| C-15 (B02) | House levels | `0..5` (0 bare .. 4 houses, 5 hotel) | `src/logic/rent.ts:15` |
| C-16 (B03) | Jail turns | `0..3` | `src/data/board.ts:51` |
| C-17 (B04) | Board spaces | `0..39` | `src/logic/seed.ts:5` |
| C-18 (B05) | Player slots | `0..5` | `server/gameServer.ts:26` |

### Medium

| ID | Candidate | Value set | Location |
|----|-----------|-----------|----------|
| C-06 (A06) | Language codes | `'en' \| 'id'` | `src/i18n/index.ts:8` |
| C-07 (A07) | localStorage keys | `'monopoly-language'`, `'monopoly-currency'`, `'monopoly-mp-session'` | `src/i18n/index.ts:7` |
| C-08 (A08) | LogEntry param keys | `'bot' \| 'spaceId' \| 'cardId'` + money keys | `src/i18n/log.ts:4` |
| C-19 (B06) | Board corners | `0, 10, 20, 30` | `src/components/BoardGrid.tsx:18` |
| C-28 (C01) | `ValidationResult.ok` | `true \| false` (discriminator) | `src/logic/seed.ts:97` |

### Low

| ID | Candidate | Value set | Location |
|----|-----------|-----------|----------|
| C-02 (A02) | Button `variant` | `'primary' \| 'success' \| 'secondary' \| 'danger' \| 'start'` | `src/components/Button.tsx:6` |
| C-03 (A03) | Button `size` | `'sm' \| 'md' \| 'lg'` | `src/components/Button.tsx:7` |
| C-04 (A04) | `RoomExit` `variant` | `'icon' \| 'button'` | `src/components/RoomExit.tsx:8` |
| C-05 (A05) | LoadScenarioPanel message `kind` | `'ok' \| 'error'` | `src/components/LoadScenarioPanel.tsx:16` |
| C-09 (A09) | HTTP endpoint paths | `'/config' \| '/seed' \| '/rooms' \| '/ws'` | `server/http.ts:45` |
| C-10 (A10) | Env `'true'` flag | `'true'` | `src/config/features.ts:1` |
| C-20 (B07) | Railroad count | `1..4` | `src/logic/rent.ts:22` |
| C-21 (B08) | Utility count | `1..2` | `src/logic/rent.ts:28` |
| C-22 (B09) | PIPS map keys | `1..6` → pip positions | `src/components/Dice.tsx:6` |
| C-23 (B10) | POSITIONS map keys | `0..39` → {x, y} | `src/components/PlayerTokens.tsx:21` |
| C-24 (B11) | PLAYER_OFFSETS keys | `0..5` → {dx, dy} | `src/data/players.ts:10` |
| C-25 (B12) | PLAYER_COLORS | `0..5` → hex color | `src/data/players.ts:1` |
| C-26 (B13) | STANDARD_COUNTS keys | `2..12` | `src/logic/controlledDice.ts:5` |
| C-27 (B14) | PEAK_WEIGHTS keys | `0..3` | `src/logic/controlledDice.ts:9` |

### Low / Likely-No

| ID | Candidate | Value set | Location |
|----|-----------|-----------|----------|
| C-11 (A11) | URL protocols | `'https:' \| 'wss' \| 'ws'` | `src/net/client.ts:26` |
| C-12 (A12) | Keyboard event keys | `'Escape' \| 'Enter' \| ' '` | `src/components/LanguageCurrencyBar.tsx:22` |
| C-13 (A13) | HTTP MIME map keys | `.html \| .js \| .css \| .svg \| .png \| .ico \| .json` | `server/http.ts:11` |

---

## Category A — strings

String unions and string vocabularies used in type position or in
comparisons/emissions without a backing `const` object.

### C-01 (A01) set-bot-control-reason
- **Location**: `src/types/game.ts:258` (`reason?: 'offline' | 'afk'` on the `SetBotControl` action). Usages: `src/logic/gameReducer.ts:809` (`action.reason === 'afk'`), `src/logic/gameReducer.ts:812` (`? action.reason === 'afk'`), `server/gameServer.ts:471` (emits `reason: 'afk'`). `'offline'` is declared in the union but is never emitted anywhere in current code (grep for `'offline'` finds only the type); `src/logic/bot.ts` does NOT use `reason` despite the design seed's mention.
- **Value set**: `'offline' | 'afk'`
- **Proposed const**: `BotControlReason = { Offline: 'offline', Afk: 'afk' } as const` + `type BotControlReason = (typeof BotControlReason)[keyof typeof BotControlReason]`
- Confidence: High — domain value in a wire-facing action payload, already a string-union; both reducer comparisons and the server emission would key off one const.

### C-02 (A02) button-variant
- **Location**: `src/components/Button.tsx:6` (`variant?: 'primary' | ... | 'start'`); duplicated in `src/components/HoldToConfirmButton.tsx:11`. Lookup map `variantClasses` at `src/components/Button.tsx:12-18` keys this exact set.
- **Value set**: `'primary' | 'success' | 'secondary' | 'danger' | 'start'`
- **Proposed const**: `ButtonVariant = { Primary: 'primary', Success: 'success', Secondary: 'secondary', Danger: 'danger', Start: 'start' } as const` + `type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant]`
- Confidence: Low — design-token vocabulary; duplicated across two components, so a shared const removes drift, but values map to Tailwind classes and never cross a wire.

### C-03 (A03) button-size
- **Location**: `src/components/Button.tsx:7` (`size?: 'sm' | 'md' | 'lg'`); duplicated in `src/components/HoldToConfirmButton.tsx:12`. Lookup map `sizeClasses` at `src/components/Button.tsx:20-24` keys this exact set.
- **Value set**: `'sm' | 'md' | 'lg'`
- **Proposed const**: `ButtonSize = { Sm: 'sm', Md: 'md', Lg: 'lg' } as const` + `type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize]`
- Confidence: Low — design-token vocabulary; same duplication rationale as C-02.

### C-04 (A04) room-exit-variant
- **Location**: `src/components/RoomExit.tsx:8` (`variant?: 'icon' | 'button'`); compared at `src/components/RoomExit.tsx:24-25` (`variant === 'icon'`).
- **Value set**: `'icon' | 'button'`
- **Proposed const**: `RoomExitVariant = { Icon: 'icon', Button: 'button' } as const` + `type RoomExitVariant = (typeof RoomExitVariant)[keyof typeof RoomExitVariant]`
- Confidence: Low — design-token/local UI variant; component-internal.

### C-05 (A05) load-scenario-message-kind
- **Location**: `src/components/LoadScenarioPanel.tsx:16` (`useState<{ kind: 'ok' | 'error'; text: string } | null>`); compared at `src/components/LoadScenarioPanel.tsx:84` (`message.kind === 'ok'`).
- **Value set**: `'ok' | 'error'`
- **Proposed const**: `ScenarioMessageKind = { Ok: 'ok', Error: 'error' } as const` + `type ScenarioMessageKind = (typeof ScenarioMessageKind)[keyof typeof ScenarioMessageKind]`
- Confidence: Low — local component state discriminator, tiny blast radius; worth a const only for consistency.

### C-06 (A06) language-codes
- **Location**: `src/i18n/index.ts:8` (`DEFAULT_LANGUAGE = 'en'`), `src/i18n/index.ts:25` (`id: { translation: id }` resource registration); select options at `src/components/LanguageCurrencyBar.tsx:49-50` (`<option value="en">`, `<option value="id">`); also `src/test/setup.ts:31` (`localStorage.setItem('monopoly-language', 'en')`).
- **Value set**: `'en' | 'id'`
- **Proposed const**: `Language = { En: 'en', Id: 'id' } as const` + `type Language = (typeof Language)[keyof typeof Language]`
- Confidence: Medium — a fixed two-value domain vocabulary in this app, but consumed through i18next's `changeLanguage`/`lng`, which accepts arbitrary strings; a const would centralize the codes across the option list, the default, and the test setup.

### C-07 (A07) localstorage-keys
- **Location**: `src/i18n/index.ts:7` (`'monopoly-language'`), `src/i18n/CurrencyContext.tsx:5` (`'monopoly-currency'`), `src/net/session.ts:7` (`'monopoly-mp-session'`). Usages/`localStorage` calls: `src/i18n/index.ts:12,35`, `src/i18n/CurrencyContext.tsx:19,33`, `src/net/session.ts:11,16,27`, plus test mirrors at `src/test/setup.ts:31-32`.
- **Value set**: `'monopoly-language' | 'monopoly-currency' | 'monopoly-mp-session'`
- **Proposed const**: `StorageKey = { Language: 'monopoly-language', Currency: 'monopoly-currency', MpSession: 'monopoly-mp-session' } as const` + `type StorageKey = (typeof StorageKey)[keyof typeof StorageKey]`
- Confidence: Medium — three fixed storage keys currently each declared as a local `const STORAGE_KEY`/`const KEY`; a shared const object gives one source of truth across three modules (and the test setup), though keys are stable by nature.

### C-08 (A08) logentry-param-keys
- **Location**: interpreter `src/i18n/log.ts:4` (`MONEY_PARAM_KEYS = new Set(['amount', 'money', 'perHouse', 'perHotel', 'perPlayer'])`), `src/i18n/log.ts:17` (`key === 'bot'`), `:18` (`key === 'spaceId'`), `:20` (`key === 'cardId'`). Emitters: `src/logic/gameReducer.ts:98,126,181,292-293,381,443,460,477,495,519,759`, `src/logic/cards.ts:18,23,27,35,61,82,109`, `src/logic/logEntries.ts:10,16`.
- **Value set**: special-cased param keys `'bot' | 'spaceId' | 'cardId'` + money keys `'amount' | 'money' | 'perHouse' | 'perHotel' | 'perPlayer'`. (Other emitted params — `name`, `creditor`, `houseCount`, `hotelCount`, `playerCount` — are pass-through/free-form and excluded.)
- **Proposed const**: `LogParamKey = { Bot: 'bot', SpaceId: 'spaceId', CardId: 'cardId', Amount: 'amount', Money: 'money', PerHouse: 'perHouse', PerHotel: 'perHotel', PerPlayer: 'perPlayer' } as const` + `type LogParamKey = (typeof LogParamKey)[keyof typeof LogParamKey]`
- Confidence: Medium — the money keys already form a Set and the `'bot'`/`'spaceId'`/`'cardId'` checks are hardcoded; a const lets emitters and the interpreter share one vocabulary. Keys are stable wire/translation params, so churn is low.

### C-09 (A09) http-endpoint-paths
- **Location**: server routes `server/http.ts:45` (`'/config'`), `:51` (`'/seed'`), `:101` (`'/rooms'`), `:134` (`path: '/ws'`), `:106` (root `'/'` → `'index.html'`). Client fetches: `src/hooks/useServerConfig.ts:9` (`/config`), `src/hooks/useRoomList.ts:19` (`/rooms`), `src/components/LoadScenarioPanel.tsx:37` (`/seed`), `src/net/client.ts:26` (`/ws`).
- **Value set**: `'/config' | '/seed' | '/rooms' | '/ws'`
- **Proposed const**: `HttpPath = { Config: '/config', Seed: '/seed', Rooms: '/rooms', Ws: '/ws' } as const` + `type HttpPath = (typeof HttpPath)[keyof typeof HttpPath]`
- Confidence: Low — same literal set is hand-copied between four client fetch sites and four server handlers across two process boundaries (browser vs Node), so a shared const removes drift; routes are low-churn and never change values.

### C-10 (A10) env-true-flag
- **Location**: `src/config/features.ts:1` (`VITE_ID_IDR_ENABLED === 'true'`), `server/main.ts:5` (`TRADES_ENABLED === 'true'`), `server/main.ts:6` (`E2E_SEED_ENABLED === 'true'`).
- **Value set**: `'true'` (single literal; the accepted env-string encoding of a boolean flag)
- **Proposed const**: `EnvTrue = 'true'` — or, better, a shared helper `parseEnvFlag(v: string | undefined): boolean`. A single-member const object is awkward; a `const` literal alias would do.
- Confidence: Low — this is an env-parsing idiom rather than a vocabulary; three duplicated sites, but the real fix is a helper, not a union type.

### C-11 (A11) url-protocols
- **Location**: `src/net/client.ts:26` (`location.protocol === 'https:' ? 'wss' : 'ws'`); `'ws'` string also at `server/http.ts:134` as the WebSocketServer `path` (path form, see C-09).
- **Value set**: `'https:' | 'wss' | 'ws'` (protocol literals)
- **Proposed const**: `WsProtocol = { Secure: 'wss', Plain: 'ws' } as const` + `type WsProtocol = (typeof WsProtocol)[keyof typeof WsProtocol]`
- Confidence: Low / Likely-No — `location.protocol` and `WebSocket` scheme strings are browser/platform vocabularies (`URL.protocol`); converting is possible but adds little and could obscure the platform contract.

### C-12 (A12) keyboard-event-keys
- **Location**: `src/components/LanguageCurrencyBar.tsx:22` (`e.key === 'Escape'`), `src/components/HoldToConfirmButton.tsx:82,89` (`e.key !== ' ' && e.key !== 'Enter'`).
- **Value set**: `'Escape' | 'Enter' | ' '`
- **Proposed const**: `KeyboardKey = { Escape: 'Escape', Enter: 'Enter', Space: ' ' } as const` + `type KeyboardKey = (typeof KeyboardKey)[keyof typeof KeyboardKey]`
- Confidence: Low / Likely-No — `KeyboardEvent.key` is a platform vocabulary owned by the DOM spec, and `' '` as a key const reads poorly; the two sites are isolated.

### C-13 (A13) http-mime-extensions
- **Location**: `server/http.ts:11` (`const MIME: Record<string, string>` map; keys consumed via `extname` at `server/http.ts:116`).
- **Value set**: `'.html' | '.js' | '.css' | '.svg' | '.png' | '.ico' | '.json'` (file extensions → MIME types)
- **Proposed const**: `FileExtension = { Html: '.html', Js: '.js', Css: '.css', Svg: '.svg', Png: '.png', Ico: '.ico', Json: '.json' } as const` + `type FileExtension = (typeof FileExtension)[keyof typeof FileExtension]`
- Confidence: Low / Likely-No — static data-driven lookup map keyed by platform-defined extensions; values are dictated by MIME standards, not app logic.

---

## Category B — numbers

Fixed bounded numeric domains, numeric-keyed literal maps, and bounded loops
over a small integer range. "enum" = `const` object with derived union, or
`as const` array. Never a TS `enum`. No numeric VALUE changes proposed.

### C-14 (B01) dice-faces
- **Location**: `src/logic/controlledDice.ts:47-49` (`for (let a = 1; a <= 6; a++)`, `if (b >= 1 && b <= 6)`) + `src/logic/gameReducer.ts:312` (`state.dice ?? [1, 1]`) + `src/components/Dice.tsx:6-13` (PIPS keys 1..6, see C-22)
- **Value set**: `{1, 2, 3, 4, 5, 6}` (single die face)
- **Proposed const**: `DICE_FACES = [1, 2, 3, 4, 5, 6] as const` (or `MAX_DIE = 6`)
- Confidence: High — canonical rule; the same 6-face set is encoded at three independent sites (loop bounds, fallback literal, PIPS map keys).

### C-15 (B02) house-levels
- **Location**: `src/logic/rent.ts:15` (`houses === 5`), `src/logic/cards.ts:70`, `src/logic/gameReducer.ts:423,443` (`>= 5`, `=== 4`), `src/logic/bot.ts:54`, `src/components/ActionSection.tsx:101`, `src/components/BoardGrid.tsx:151,161`, `src/components/PropertyTooltip.tsx:85,103`, `src/logic/seed.ts:121` (`< 0 || > 5` validation)
- **Value set**: `{0, 1, 2, 3, 4, 5}` (0 bare .. 4 houses, 5 hotel)
- **Proposed const**: `MAX_HOUSES = 5` (hotel level) or `HOUSE_LEVELS = [0, 1, 2, 3, 4, 5] as const`
- Confidence: High — 8+ hardcoded `=== 5` / `>= 5` / `< 5` / `> 5` comparisons across logic, bot, components, and seed validation; `space.rent` arrays are length 6 (5 levels) and `houseCost` arrays length 5, confirming the 0..5 domain.

### C-16 (B03) jail-turns
- **Location**: `src/data/board.ts:51` (`MAX_JAIL_TURNS = 3`), `src/logic/gameReducer.ts:116-117` (`newTurns >= MAX_JAIL_TURNS`); `jailTurns` field `src/types/game.ts:150`; assignments `gameReducer.ts:50,89,131,149,193,245,664,684`, `src/logic/cards.ts:139`, `src/logic/seed.ts:16,59`
- **Value set**: `{0, 1, 2, 3}` (jail turn counter; forced out at 3)
- **Proposed const**: existing `MAX_JAIL_TURNS` is already a const — optional `JAIL_TURNS = [0, 1, 2, 3] as const` if the full domain is ever needed
- Confidence: High — bounded 0..3 counter; partially consted already (`MAX_JAIL_TURNS`), but the 0..3 domain itself is not a set.

### C-17 (B04) board-spaces
- **Location**: `src/logic/seed.ts:5` (`BOARD_SIZE = 40`) + uses `:100,:134`; `% 40` wrap in `gameReducer.ts:92,120,166`, `cards.ts:40,103-104`, `PlayerTokens.tsx:37,41`; `POSITIONS` keys 0..39 (`PlayerTokens.tsx:21-32`, see C-23); corner ids `BoardGrid.tsx:18-24` (see C-19)
- **Value set**: `{0, 1, ..., 39}` (board space indices)
- **Proposed const**: promote a shared `BOARD_SIZE = 40` (currently only local to `seed.ts`); optional `BOARD_SPACES = [0..39] as const`
- Confidence: High — the 40-space board is the fundamental domain; `% 40` appears 7+ times and position bounds are validated against BOARD_SIZE only in seed.ts.

### C-18 (B05) player-slots
- **Location**: `server/gameServer.ts:26` (`MAX_PLAYERS = 6`, uses `:34,:367-368`), `src/logic/seed.ts:6` (`MAX_SLOTS = 6`, use `:107`), `src/components/Lobby.tsx:39,64` (`Array.from({ length: 6 })`, `>= 6`), `src/data/players.ts:1,10` (PLAYER_COLORS length 6, PLAYER_OFFSETS keys 0..5)
- **Value set**: `{0, 1, ..., 5}` (player slot / player id)
- **Proposed const**: `MAX_PLAYERS = 6` — unify `gameServer.ts` and `seed.ts` (both currently hardcode 6) plus the Lobby renderer's `6`
- Confidence: High — the same 6-slot domain is encoded by two named constants (`MAX_PLAYERS`, `MAX_SLOTS`) and a hardcoded `6` in the Lobby.

### C-19 (B06) board-corners
- **Location**: `src/components/BoardGrid.tsx:18,20,22,24` (`id === 0`, `id === 10`, `id === 20`, `id === 30`)
- **Value set**: `{0, 10, 20, 30}` (GO, Jail, Free Parking, Go To Jail)
- **Proposed const**: `BOARD_CORNER_SPACES = [0, 10, 20, 30] as const`
- Confidence: Medium — fixed, domain-relevant set of corner board ids, but a single call site and partly layout-mapping logic.

### C-20 (B07) railroad-count
- **Location**: `src/logic/rent.ts:22,49` (`space.rent?.[count - 1] ?? 25`); railroad rent arrays length 4 in `src/data/board-data.json`
- **Value set**: `{1, 2, 3, 4}` (number of railroads owned)
- **Proposed const**: `MAX_RAILROADS = 4` / `RAILROAD_COUNTS = [1, 2, 3, 4] as const`
- Confidence: Low — derived from board data (4 railroad spaces); `count - 1` indexing bounds it naturally.

### C-21 (B08) utility-count
- **Location**: `src/logic/rent.ts:28,58` (`count === 2 ? total * 10 : total * 4`)
- **Value set**: `{1, 2}` (number of utilities owned)
- **Proposed const**: `MAX_UTILITIES = 2` / `UTILITY_COUNTS = [1, 2] as const`
- Confidence: Low — 2-space board set expressed as a ternary on the upper bound rather than a vocabulary.

### C-22 (B09) pips-map (data map)
- **Location**: `src/components/Dice.tsx:6-13` (use `:31`)
- **Value set**: keys `{1..6}` → pips positions (subset of 0..8)
- **Proposed const**: none (data map) — or type as `Record<DieFace, number[]>`
- Confidence: Low — pure visual data; keys exactly the dice-face domain → overlaps **C-14 (B01) dice-faces**.

### C-23 (B10) board-positions-map (data map)
- **Location**: `src/components/PlayerTokens.tsx:21-32` (use `:84`)
- **Value set**: keys `{0..39}` → {x, y} percent coordinates
- **Proposed const**: none (data map) — or type as `Record<BoardSpaceId, { x: number; y: number }>`
- Confidence: Low — visual layout data; keys exactly the board-space domain → overlaps **C-17 (B04) board-spaces**.

### C-24 (B11) player-offsets-map (data map)
- **Location**: `src/data/players.ts:10-17` (use `PlayerTokens.tsx:85`)
- **Value set**: keys `{0..5}` → {dx, dy}
- **Proposed const**: none (data map) — or type as `Record<PlayerSlot, { dx: number; dy: number }>`
- Confidence: Low — token offset data; keys exactly the player-slot domain → overlaps **C-18 (B05) player-slots**.

### C-25 (B12) player-colors (data array)
- **Location**: `src/data/players.ts:1-8` (uses `Lobby.tsx:43`, `PlayerTokens.tsx:96`)
- **Value set**: array index `{0..5}` → hex color
- **Proposed const**: none (data array) — optionally `string[]` of length 6 with a `PlayerSlot` index type
- Confidence: Low — color palette; implicit keys are the player-slot domain → overlaps **C-18 (B05) player-slots**.

### C-26 (B13) standard-counts (data map)
- **Location**: `src/logic/controlledDice.ts:5-7` (use `:31`)
- **Value set**: keys `{2..12}` → standard 2d6 distribution counts
- **Proposed const**: none (data map) — if `TOTALS` is exported, type as `Record<(typeof TOTALS)[number], number>`
- Confidence: Low — probability data; keys overlap **`TOTALS`** (`controlledDice.ts:3`, already const, see Category D).

### C-27 (B14) peak-weights (data map)
- **Location**: `src/logic/controlledDice.ts:9` (use `:13-17`)
- **Value set**: keys `{0..3}` → weight multipliers (offsets from target)
- **Proposed const**: none (data map)
- Confidence: Low — arbitrary distribution-tuning offsets, not a game domain.

---

## Category C — boolean discriminators

Booleans used as a **discriminant** to narrow a discriminated union (not plain
two-state flags). Production booleans like `bankrupt`, `inJail`, `mortgaged`,
`isBot`, `afk`, `botControlled`, `passedGo`, `connected`, `gracePending` are
plain flags and are intentionally NOT listed.

### C-28 (C01) validation-result-ok
- **Location**: `src/logic/seed.ts:97` (`export type ValidationResult = { ok: true } | { ok: false; message: string }`). Consumer sites: `src/components/LoadScenarioPanel.tsx:30` (`result.ok ? { kind: 'ok', ... } : { kind: 'error', text: result.message }` — narrows to read `result.message`), `server/gameServer.ts:198,202` (`if (!structural.ok)` / `if (!roomCheck.ok)`), `server/http.ts:80,90` (`if (!structural.ok) throw new Error(structural.message)`). Emitters: `src/logic/seed.ts:101-170` (16 `{ ok: false, message }` returns + 2 `{ ok: true }`).
- **Value set**: `true | false` (boolean tag `ok` discriminating `{ ok: true }` — no payload — vs `{ ok: false; message: string }` — carries the error text)
- **Proposed const**: `ValidationKind = { Ok: 'ok', Error: 'error' } as const` + `type ValidationKind = (typeof ValidationKind)[keyof typeof ValidationKind]`, applied as a `kind`-tagged union `{ kind: 'ok' } | { kind: 'error'; message: string }`. (A boolean const object is unusable here: `{ Ok: true, Error: false } as const` collapses `(typeof X)[keyof typeof X]` to plain `boolean`, defeating narrowing. A string `kind` tag mirrors the existing `LoadScenarioPanel` message `kind` (`'ok' | 'error'`) and keeps the repo's const-object convention.)
- Confidence: Medium — the boolean genuinely discriminates and narrows the union at three independent consumer sites, but the value set is only `true | false` and the idiomatic conversion is a string `kind` tag rather than a boolean const; blast radius is contained to the seed-validation flow.

Note: no other `ok: true | false`-shaped discriminated unions found in
`src/` + `server/`. The remaining boolean-literal hits are plain flags
(log-param `{ bot: true }` marker at `src/logic/logEntries.ts:10,16`,
`gameReducer.ts:322,330,405,759,770`; `passedGo`/`mortgaged` state flags; the
server's `{ ok: true }` JSON response at `server/http.ts:93` is a lone success
marker, not a union) and are dropped.

---

## Category D — reference (already converted)

Already-converted consts — NOT candidates. Listed for completeness; values are
part of the client/server contract or module-local consts and must not change.

- `SpaceType` — `src/types/game.ts:1` — NOT a candidate
- `CardType` — `src/types/game.ts:15` — NOT a candidate
- `CardActionType` — `src/types/game.ts:21` — NOT a candidate
- `TaxType` — `src/types/game.ts:32` — NOT a candidate
- `GamePhase` — `src/types/game.ts:38` — NOT a candidate
- `PendingActionType` — `src/types/game.ts:50` — NOT a candidate
- `GameActionType` — `src/types/game.ts:59` — NOT a candidate
- `LogEventKey` — `src/types/game.ts:92` — NOT a candidate
- `ConnectionStatus` — `src/types/net.ts:7` — NOT a candidate
- `ClientMessageType` — `src/types/net.ts:14` — NOT a candidate
- `ServerMessageType` — `src/types/net.ts:25` — NOT a candidate
- `Currency` — `src/data/currency.ts:1` — NOT a candidate
- `SoundId` — `src/audio/soundEngine.ts:1` — NOT a candidate
- `MpAction` — `src/components/GameSetup.tsx:7` (module-local `const`, derived union at `:11`) — NOT a candidate
- `TOTALS` — `src/logic/controlledDice.ts:3` (module-local `const ... as const`) — NOT a candidate

---

## Methodology

1. **Raw dump (script)**: a throwaway Node script under `/tmp` scans `src/` +
   `server/` (`.ts`/`.tsx`, excluding `__tests__`/`e2e`) and emits inline
   string-literal unions in type positions, `as const` declarations (to
   classify done vs candidate), small fixed-domain `Record`/`Set`/`Map` keys,
   comparison literals (`=== '...'`, `!== '...'`), number-keyed literal maps,
   and boolean discriminators (`{ ok: true } | { ok: false; ... }` shape).
2. **Curation (subagents, in parallel)**: one subagent per category (A strings /
   B numbers / C booleans / D verify-done-list) verified each raw hit against
   the live code (codegraph + targeted reads), filtered free-form/excluded
   cases, and filled in proposed const names + confidence.
3. **Assembly**: this catalog, entries sequentially re-numbered `C-01`..`C-28`
   across the whole catalog (original A/B/C letter-slugs preserved as tags),
   with a summary table grouped by confidence.
4. **Verification**: catalog cross-checked — every design-seed candidate
   (A1-A13, B1-B10, C1) present; all 15 already-converted consts in the
   reference section; `npm run typecheck` and `npm run lint` green to prove no
   accidental `src/`/`server/` edits.

## Confidence legend

- **High**: canonical, domain-relevant rule (rule constant, wire-facing action
  payload, cross-module counter) encoded at multiple independent sites; a
  shared const removes real drift risk. Convert first.
- **Medium**: fixed vocabulary with several consumption sites, but consumed
  through a broad API (e.g. i18next accepts arbitrary strings) or the
  idiomatic conversion is non-trivial (e.g. boolean discriminator → string
  `kind` tag). Real but moderate benefit.
- **Low**: localized design-token / component-internal / data-map vocabulary;
  single call site or pure visual data. A const is consistency-only.
- **Low / Likely-No**: platform-owned vocabularies (DOM/browser APIs, MIME
  standards, URL protocols) or env-parsing idioms; conversion adds little and
  may obscure the platform contract. Listed because the user may disagree.
