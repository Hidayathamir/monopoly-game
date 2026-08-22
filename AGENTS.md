# Monopoly Game — Agent Instructions

## Project
Multiplayer Monopoly: React SPA (Vite) + Node WebSocket server. No Express/Fastify — custom `node:http` server.

## Key commands (exact — do not guess flags)

| Command | What |
|---|---|
| `npm run server` | Game server via `tsx server/main.ts` (port 3001) |
| `npm run build` | `tsc -b` + `vite build` (produces `dist/`) |
| `npm run start` | build then server (full prod stack on 3001) |
| `npm test` | vitest run **then** playwright test |
| `npm run test:unit` | vitest run only |
| `npm run test:e2e` | playwright test only |
| `npm run lint` | eslint . |
| `npm run typecheck` | `tsc -b` (project references) |
| `npm run preview` | vite preview (static dist/ only) |
| `npm run tunnel` | cloudflared tunnel for live testing |

## Running tests
- **Unit tests**: `npm run test:unit` (vitest, excludes `e2e/`)
- **Single unit test file**: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
- **E2E tests**: requires `npm run build` first (serves `dist/`); tests spawn per-worker servers on ports 4000+/4100+
- **Full test suite**: `npm test` (runs vitest first, then playwright)

## Architecture
- **Client entry**: `src/main.tsx` — React + i18n + CurrencyProvider
- **Server entry**: `server/main.ts` — HTTP + WebSocket, env-configurable
- **Game logic**: `src/logic/gameReducer.ts` — pure reducer (GameState, GameAction)
- **Network protocol**: typed discriminated unions in `src/types/net.ts` (ClientMessage / ServerMessage)
- **Room manager**: `server/roomManager.ts` — 5-char alphanumeric room codes, auto-teardown
- **Bot AI**: `src/logic/bot.ts`
- **Seed (E2E state injection)**: `POST /seed` — validates structure + room, only when `E2E_SEED_ENABLED=true`

## TypeScript constraints
- `verbatimModuleSyntax` → use `import type` for type-only imports
- `erasableSyntaxOnly` → **no enums, no namespaces, no `const enum`**. Use `as const` objects + type aliases (see `src/types/game.ts`)

## Env vars (server)
| Var | Default | Note |
|---|---|---|
| `PORT` | 3001 | |
| `DIST_DIR` | `dist` | Static files to serve |
| `TRADES_ENABLED` | `true` | Set `'false'` to disable trades |
| `E2E_SEED_ENABLED` | `false` | Enables `POST /seed` for deterministic E2E |
| `AFK_TIMEOUT_MS` | 30000 | |
| `ROOM_EMPTY_GRACE_MS` | 30000 | |

## Env vars (vite/client)
- `VITE_ID_IDR_ENABLED` — set `'true'` to enable Indonesian locale + IDR currency

## UI stack
- Tailwind CSS v4 (`@import "tailwindcss"` in `index.css`, no config file, `@tailwindcss/vite` plugin)
- i18next + react-i18next (en/id locales, localStorage persistence)
- Sound via Web Audio API (`src/audio/`)
- WebSocket client in `src/net/client.ts`

## Design specs
`docs/superpowers/` and `.superpowers/sdd/` contain design specs for features (date-prefixed directories).

## E2E test quirks
- `e2e/fixtures.ts` provides per-worker `serverUrl` (trades disabled) and `serverUrlTrades` (trades enabled, AFK=120s)
- Seed fixtures in `e2e/fixtures/*-seed.ts` are imported by spec files
- E2E helpers: `e2e/helpers/` (gameplay.ts, server.ts, seed.ts, trade.ts)
- Tests set localStorage via `context.addInitScript` (language + currency)