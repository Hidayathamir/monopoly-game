# Monopoly Game

Multiplayer Monopoly played in the browser. Real-time WebSocket, bots, trades, and full game logic.

## Features

- Real-time multiplayer via WebSocket (play with friends online)
- Bot players (AI fills empty slots)
- Property trading, house building, mortgaging
- Chance & Community Chest cards
- Jail, bankruptcy, auctions
- Indonesian locale + IDR currency mode (`VITE_ID_IDR_ENABLED=true`)
- Custom player colors and avatars
- E2E-tested with Playwright (seed-driven deterministic states)

## Tech stack

**Client** — React 19, Vite 8, TypeScript 6, Tailwind CSS v4, i18next
**Server** — Node.js (`node:http` + `ws` WebSocket), tsx runner
**Testing** — Vitest (unit), Playwright (E2E)

No Express, no Fastify, no React Router, no state management library.

## Getting started

```bash
npm install

npm run start
```

Open `http://localhost:3001`.

## Commands

| Command | What |
|---|---|
| `npm run server` | Game server on port 3001 |
| `npm run build` | TypeScript + Vite build |
| `npm run start` | Build + server (production) |
| `npm run test` | Unit tests then E2E tests |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project references |

## Architecture

```
server/main.ts        → HTTP + WebSocket server (env-configurable)
server/gameServer.ts  → Game session per room
server/roomManager.ts → Room lifecycle (5-char codes, auto-teardown)

src/main.tsx          → React entry
src/logic/gameReducer.ts → Pure game state reducer
src/types/net.ts      → Typed WebSocket protocol (ClientMessage / ServerMessage)
src/logic/bot.ts      → Bot AI decision-making
```

Game state is a single reducer (`GameState`, `GameAction`). The server runs one `GameServer` per room. E2E tests inject state via `POST /seed` (requires `E2E_SEED_ENABLED=true`).

## Environment variables

| Var | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `DIST_DIR` | `dist` | Static files directory |
| `TRADES_ENABLED` | `true` | Disable with `'false'` |
| `E2E_SEED_ENABLED` | `false` | Enable `POST /seed` for testing |
| `AFK_TIMEOUT_MS` | `30000` | AFK kick timeout |
| `ROOM_EMPTY_GRACE_MS` | `30000` | Grace before empty room deletion |
| `VITE_ID_IDR_ENABLED` | — | Set `'true'` for IDR + Indonesian locale |

## Board

The board uses cities from around the world (Salvador, Tel Aviv, Venice, Milan, Berlin, Shenzhen, Shanghai, Tokyo, Lyon, etc.) with a standard Monopoly property layout — 28 properties, 4 railroads, 2 utilities, Chance/Community Chest, Income/Luxury Tax.

## Tests

- **Unit tests** run with Vitest (`npm run test:unit`)
- **E2E tests** use Playwright with per-worker server instances (`npm run test:e2e`, requires `npm run build` first)
- E2E uses seed-driven state injection for deterministic scenarios (bankruptcy, trades, monopoly rent)

## License

MIT