# Seed Defined State Design

Date: 2026-08-18

## Problem

The game can only ever start from a single canned state: `StartGame` gives every
player `STARTING_MONEY`, zero properties, position 0. There is no way to begin
(or re-set) a game from a defined state. Consequences:

- An e2e test cannot reliably stage a scenario like "player B lands on player
  A's property with rent he can't pay, then declares bankruptcy" — it can only
  click through random play and assert the app survives. Bankruptcy and every
  other rule resolution are therefore untested end-to-end.
- A developer cannot hand-test a specific game situation (a rich opponent with
  hotels, a player in jail, an impending game-over) without grinding through
  gameplay or hand-crafting unit-level state.

## Goals

- Generic capability to seed **any full `GameState`** into a running room,
  at **any phase** (lobby or mid-game), replacing the state wholesale and
  broadcasting it to all clients.
- A dev-only browser panel for **manual playtesting**: paste/validate/apply a
  state JSON from the room.
- A first seed-based e2e test: **bankruptcy on unpayable rent**, driven through
  the real client/server/UI path.
- Seeding is **impossible in production**: enabled only by an env flag, same
  contract as `TRADES_ENABLED` / `VITE_ID_IDR_ENABLED`.

## Non-Goals

- No change to the game rules or the reducer — `gameReducer` is untouched.
- No change to the websocket wire contract (`src/types/net.ts` untouched; new
  traffic is plain HTTP only).
- No gameplay UI changes — the panel lives on the lobby/setup screen only.
- No new seed scenarios in this pass beyond the bankruptcy e2e (the seed
  mechanism is generic so more can be added later without new plumbing).

## Design

### 0. The slot invariant (verified precondition)

`GameServer` treats `state.currentPlayer` as a **slot index**: `isTurn` compares
the acting client's slot index against it, and `driveBots` reads
`slots[currentPlayer]`. It follows that seeded states must satisfy:

> `players[i].id === i` for every joined slot `i`, and `state.currentPlayer`
> must be one of those player ids.

The builder constructs states that satisfy this by construction; the validator
enforces it; manual seeds that violate it are rejected with a readable message.

### 1. Shared module — `src/logic/seed.ts` (NEW)

Pure, runs in server, client, and tests. No `enum`, matches repo conventions
(`const` objects + derived union types, semicolons like other `src/logic/*`).

**`createSeededState(partial): GameState`** — builds a complete, valid
`GameState` from a partial spec. Fills every non-meaningful field with safe
defaults:

- `board: createInitialBoard()` then applies `partial.board` overrides
  (`owner`, `houses`, `mortgaged` per space id)
- `players` derived from a per-slot spec: `{ id, name, money, properties,
  position, ... }` with defaults `passedGo: true`, `inJail: false`,
  `getOutOfJailFreeCards: 0`, `isBot: false`, `botControlled: false`,
  `bankrupt: false`
- `turnOrder` defaults to `[0..n-1]`; `currentPlayer` required from partial
- `phase` defaults to `GamePhase.Waiting`; `pendingAction` optional (default
  `null`) so a decision-point seed can stage e.g. a rent payment
- `dice: null`, `eventLog: []`, `freeParkingPot: 0`, `doublesCount: 0`,
  `lastMoveSteps: null`, `justBoughtSpaceId: null`, `builtThisStop: false`,
  `reconnectGrace: null`, `pendingTrades: []`, `nextTradeId: 0`;
  `chanceDeck`/`communityDeck` from a copied default deck; `tradesEnabled` from
  the partial or room value.
- Guarantees `players[i].id === i`.

Validation is split so the client panel can run a pure structural check
without knowing the server's slot state:

**`validateStateStructure(state): { ok: true } | { ok: false; message: string }`**
— pure structural + invariant checks (runs on both client and server):

- `board.length === 40`
- player ids unique, `0 ≤ id < MAX_PLAYERS`; `turnOrder` is a permutation of
  exactly the player ids; `currentPlayer ∈ turnOrder`
- each player's `properties` equals the set of board spaces whose `owner` is
  that player id (no orphaned owner, no claimed-but-unowned space)
- `owner ∈ playerIds ∪ { null }`; `houses` only on property spaces; defensive
  checks on numeric fields (money, positions)
- phase/state sanity: `Waiting` ⇒ `pendingAction === null && dice === null`;
  `Resolving` ⇒ `pendingAction !== null` (the server auto-resolves an
  unhandled Resolving state)

**`validateStateForRoom(state, slots)`** — room-aware layer (server only; the
client panel cannot know the server's slot state):

- `players.length` equals the number of joined slots and `players[i].id === i`
  for each joined slot
- `currentPlayer`'s slot is either connected (a live client) or a bot — the
  state must be actionable

### 2. Server plumbing

- `server/main.ts`: read `const seedEnabled = process.env.E2E_SEED_ENABLED === 'true'`
  and pass into `createServer`.
- `server/http.ts`:
  - `createServer(distDir, opts)` accepts `seedEnabled`; passes to
    `new RoomManager({ send }, { tradesEnabled, seedEnabled })`.
  - `GET /config` → `200 { seedEnabled: boolean }` (public, like `GET /rooms`).
  - `POST /seed` body `{ code, state }`:
    - `seedEnabled === false` → `403`
    - `roomManager.get(code)` undefined → `404`
    - `validateStateStructure(state)` then `validateStateForRoom(state, game slots)`
      fails → `400 { message }`
    - success → `game.seedState(state)` → `200 { ok: true }`
- `server/roomManager.ts`: accept `seedEnabled` in opts, forward to each
  `GameServer`.
- `server/gameServer.ts`:
  - constructor opts gain `seedEnabled`
  - `seedState(state)`:
    1. throw `Error('seeding disabled')` if `!this.seedEnabled` (defense in depth)
    2. `validateStateStructure(state)` then `validateStateForRoom(state, this.slots)`;
       throw on failure
    3. `this.clearBotTimer()` and reset `this.botSteps = 0` so a stale bot
       dispatch never fires into the new state
    4. `this.state = state; this.broadcast()` — full state + lobby to the room

### 3. Client — config discovery + dev panel

- NEW `src/hooks/useServerConfig.ts`: fetches `GET /config` once; exposes
  `{ seedEnabled: boolean | null, loading: boolean }`.
- NEW `src/components/LoadScenarioPanel.tsx`: rendered on the lobby/setup
  screen only when `seedEnabled === true`. Fields: **room code**, **JSON
  textarea**, **Validate** (runs `validateStateStructure` client-side, lists
  inline errors), **Apply** (`POST /seed`, surfaces non-200 `message`; on 200
  resets and collapses). Reuses existing `Button`/tile styling. Never rendered
  in a normal launch (no flag → `seedEnabled: false`).
- Helper `scripts/print-seed.mjs` (NEW): runs `createSeededState` via `tsx`,
  prints a seed JSON to stdout for copy-paste into the panel.

### 4. e2e — `e2e/seed.spec.ts` (NEW), bankruptcy on unpayable rent

Approach: seed the **decision point** — no dice. The state has Bravo
mid-resolution owing rent on Alpha's Boardwalk, so the test drives the
bankruptcy UI directly and deterministically (aimed dice are luck-weighted and
would make the landing flaky).

- `e2e/helpers/server.ts`: spawn the server with `E2E_SEED_ENABLED=true`
  (test harness only; harmless to existing specs).
- `e2e/helpers/seed.ts` (NEW): `seedGame(url, code, state)` (POST `/seed`,
  throws with the server message on failure) and
  `waitForSeedApplied(page, predicate)`.
- `e2e/fixtures/bankruptcy-seed.ts` (NEW, generated once by
  `scripts/print-seed.ts` and checked in — Playwright's ESM loader rejects the
  JSON imports in `src/data`, so the fixture is a plain typed `GameState`
  literal with type-only imports):
  - Alpha (slot 0): `$1,000`, owns **Boardwalk (39) with 4 houses** ($1,700
    rent) plus a few other properties to read as "rich", `passedGo: true`
  - Bravo (slot 1): `$1`, `passedGo: true`
  - `currentPlayer: 1`, `turnOrder: [1, 0]`, `phase: Resolving`,
    `pendingAction: { type: 'payRent', spaceId: 39, amount: 1700 }`

Flow:

1. Two contexts join (Alpha host, Bravo) via the same local-stream flow as
   `multiplayer.spec.ts`; read the room code.
2. `seedGame(url, code, scenario)`.
3. Bravo's page shows the pay-rent action ("Pay Rent" + "Declare Bankruptcy").
   Bravo clicks **Pay Rent** — since $1 < $1,700 the reducer transitions to
   `pendingAction: bankruptcy` and the **BankruptcyModal** appears ("⚠️
   Bankruptcy", cannot pay $1,700 on $1).
4. Bravo clicks **Declare Bankruptcy** in the modal.
5. Assert Bravo's player card shows the bankrupt badge and GameOverModal
   declares Alpha the winner on both clients.

## Testing

- `src/logic/__tests__/seed.test.ts` (NEW): builder round-trip through both
  validators; one test per rejection — `validateStateStructure`: bad board
  length, duplicate ids, bad turnOrder, owner without property list, unowned
  claimed space, Waiting-with-pending state; `validateStateForRoom`: player
  count vs joined slots, id/slot mismatch, currentPlayer not actionable.
- `server/__tests__/gameServer.test.ts` (+): `seedState` broadcasts state and
  lobby; refuses when disabled; cancels a pending bot timer on re-seed.
- `server/__tests__/http.test.ts` (+): `GET /config` reflects the flag; `POST
  /seed` returns 403 when disabled, 404 unknown room, 400 invalid state, 200 +
  broadcast on success.
- `server/__tests__/roomManager.test.ts` (+): `seedEnabled` forwarded to games.
- `e2e/seed.spec.ts` (NEW): the bankruptcy scenario above. Requires
  `npm run build` first (existing e2e contract).

## Files

- NEW: `src/logic/seed.ts`, `src/hooks/useServerConfig.ts`,
  `src/components/LoadScenarioPanel.tsx`, `scripts/print-seed.mjs`
- NEW: `e2e/seed.spec.ts`, `e2e/helpers/seed.ts`, `e2e/fixtures/bankruptcy-seed.ts`
- Modify: `server/main.ts`, `server/http.ts`, `server/roomManager.ts`,
  `server/gameServer.ts`
- Modify: `e2e/helpers/server.ts`
- Modify: `AGENTS.md` (document `E2E_SEED_ENABLED=true npm run server`)
- Tests: new `seed.test.ts`, `seed.spec.ts`; updated `gameServer.test.ts`,
  `http.test.ts`, `roomManager.test.ts`

## Commands / Docs

- `E2E_SEED_ENABLED=true npm run server` — enables `GET /config` +
  `POST /seed` and the client Load Scenario panel on all rooms.
- `npm run build` still typechecks all three TS projects (`tsconfig.server`
  now includes `src/logic/seed.ts` and the server wiring).