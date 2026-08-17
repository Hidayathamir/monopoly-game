# AGENTS.md

Monopoly web game: React 19 + Vite 8 + TypeScript + Tailwind v4 client, plus a Node WebSocket server for multiplayer. Indonesian and English i18n (default English; currency USD).

## Commands

- `npm run dev` — Vite dev server (client only, no multiplayer server)
- `npm run server` — `tsx server/main.ts`, serves `dist/` + WebSocket at `ws://<host>/ws` on port `3001` (env `PORT`, `DIST_DIR`)
- `TRADES_ENABLED=true npm run server` — enables the trade feature (env `TRADES_ENABLED`, default disabled; anything other than the literal `true` disables trades for every room on the server)
- `VITE_ID_IDR_ENABLED=true npm run dev`/`npm run build` — enables the Indonesian language and IDR currency options (env `VITE_ID_IDR_ENABLED`, default disabled; anything other than the literal `true` leaves only English/USD available)
- `npm run build` — `tsc -b && vite build` (typechecks all 3 TS projects, then builds `dist/`)
- `npm run typecheck` — `tsc -b`
- `npm run lint` — eslint (currently passes with 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx`)
- `npm run test:unit` — vitest; `npm run test:e2e` — Playwright; `npm run test` — both
- `npm run start` — build then serve; `npm run live` — build + server + cloudflared tunnel (remote multiplayer)

## Architecture

- **Shared game logic**: `src/logic/gameReducer.ts` (the reducer + `createInitialState`) is the single source of truth for rules. It runs on the server, authoritatively, for multiplayer (`server/gameServer.ts`). New rules/actions go in `src/logic` + `src/types/game.ts` and must work in both contexts.
- **Multiplayer**: Node server (`server/`) uses `tsx` and the `ws` lib. `RoomManager` issues 5-char join codes; `GameServer` owns state per room (max 6 players) and broadcasts full `GameState` snapshots over JSON. Server rejects actions out of turn. Board/card data lives in `src/data/*.json`; shared types in `src/types/*`.
- **Server/client contract**: `src/types/net.ts` defines `ClientMessage`/`ServerMessage`. Server sends full state snapshots; the client's `src/net/client.ts` (`GameClient`) wraps the WebSocket and `src/hooks/useNetworkGame.ts` applies snapshots directly.
- **Bots**: `src/logic/bot.ts` (`decideBotAction`) drives bot seats on the server; `src/data/bots.ts` supplies `BOT_NAMES`. Bot turns auto-play through the server reducer.
- **Two tsconfig projects beyond the app/node split**: `tsconfig.server.json` compiles `server/` plus `src/{types,logic,data,utils}` (no DOM); `tsconfig.app.json` covers `src/`. `npm run build`/`typecheck` build all via project references.

## Tests

- **Vitest**: config lives inside `vite.config.ts` (setup `src/test/setup.ts`, excludes `e2e/**`). Unit tests colocated in `__tests__/` dirs next to source.
- `src/test/setup.ts` installs an in-memory `localStorage` if absent and pins language/currency to `en`/`USD`. Components using i18n/currency must be rendered with `renderWithProviders` from `src/test/test-utils.tsx`.
- **Playwright** (`e2e/`): config auto-starts Vite dev on port 4173. **Server-backed specs use the shared worker-scoped `serverUrl` fixture (`e2e/fixtures.ts`), which spawns `tsx server/main.ts` on port `4000 + workerIndex` serving `dist/` — run `npm run build` first or those specs fail** (`dist/` is gitignored).
- e2e tests targeting English UI set `localStorage` (`monopoly-language` = `en`) via `addInitScript`; the default language is English. UI test hooks: `data-testid`s (`sidebar`, `room-code`, `player-card`, `waiting-for`, ...), `aria-label`s, and visible button text.
- Multiplayer e2e uses the real server + two browser contexts sharing nothing; don't skip the `dist/` requirement.

## Conventions

- **No TS enums** — `erasableSyntaxOnly: true` across projects; use `const` objects + derived union types (see `src/types/game.ts`). Also `verbatimModuleSyntax: true` → type-only imports must use `import type`. `noUnusedLocals`/`noUnusedParameters` are on.
- **Enum-like string constants**: Any fixed set of string values (wire message
  types, phases, action types, statuses, etc.) must be declared as a `const`
  object with a derived union type (see `src/types/game.ts` and
  `src/types/net.ts`). Do not use raw string literals in production code where
  a constant exists; do not introduce TypeScript `enum` (repo enforces
  `erasableSyntaxOnly`). Wire values are part of the client/server contract and
  must never change when refactoring.
- **Semicolons are mixed**: `src/logic/*`, `src/types/game.ts`, and most of `src/data/*` (`board.ts`, `cards.ts`, `bots.ts`) use them; `src/data/currency.ts`, `src/data/players.ts`, and most components/hooks/net/server files omit them. Match the file you're editing; eslint does not enforce.
- **i18n**: every UI string must exist in both `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys, `keySeparator: false`). Server-side error strings are hardcoded Indonesian and rendered raw by the client — don't add new hardcoded UI strings; route user-facing text through i18n keys or `LogEntry` keys (see `src/i18n/log.ts`).
- **Multiplayer session persistence**: the client stores the active room session under `monopoly-mp-session` (`src/net/session.ts`) so a refresh auto-rejoins the same room.
- **Design workflow**: specs and implementation plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (dated). Before implementing a feature, check for the latest related spec/plan there.

## Gotchas

- `npm run server`/`live` serve the **built** `dist/` — the client dev server and the multiplayer server are separate processes; multiplayer won't work through Vite alone.
- `gameReducer`'s `shuffle` uses `Math.random`; `GameServer` accepts an injectable `rng` — tests should inject a deterministic one.
- Board has 40 spaces; rules constants (`GO_SALARY`, rent tables, mortgage/sell rates) are in `src/data/board.ts`, not in the reducer.
