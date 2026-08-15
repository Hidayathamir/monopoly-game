# Room Exit Collapse & Verbose Card Logs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the in-game leave-room button behind an icon with a confirmation modal, rename Indonesian "kamar"→"ruangan", and make card money effects verbose (with breakdowns for computed amounts) in the event log.

**Architecture:** A new reusable `RoomExit` component (collapsed icon toggle + themed confirm modal) replaces the always-visible leave buttons in `Sidebar` and `Lobby`. Server and i18n strings are renamed in place. Card effect logs in `src/logic/cards.ts` gain `cardId` + breakdown params, rendered by the existing `resolveLogEntry` (which money-formats known keys).

**Tech Stack:** React 19 + TypeScript + Vite 8; vitest (jsdom + node); Playwright e2e; i18next (en/id).

## Global Constraints

- Indonesian user-facing strings use "ruangan" (never "kamar"); English "Room" unchanged.
- Do NOT change any card effect amounts, game rules, or the `event.toJail` key (shared with the GoToJail space — `gameReducer.test.ts:718` asserts it).
- The generic `event.drewCard` log entry is removed; every card effect logs its own `cardId`.
- Test setup (`src/test/setup.ts`) forces language `en` / currency `USD`; component tests assert English text.
- Follow existing patterns: Tailwind utility classes from current components, `renderWithProviders` in component tests, `Modal` + `Modal.Actions` from `src/components/Modals/Modal.tsx`.

---

### Task 1: Server error strings — "kamar" → "ruangan"

**Files:**
- Modify: `server/gameServer.ts:90`
- Modify: `server/http.ts:75`
- Test: `server/__tests__/gameServer.test.ts:42`, `server/__tests__/http.test.ts:86`

**Interfaces:**
- Consumes: none.
- Produces: server now emits "Ruangan penuh (maks 6 pemain)" and "Ruangan tidak ditemukan" error messages.

- [ ] **Step 1: Update the two server tests to expect the new strings**

In `server/__tests__/gameServer.test.ts:42`, change:
```ts
expect(sent.some((m) => m.type === 'error' && m.message === 'Kamar penuh (maks 6 pemain)')).toBe(true)
```
to:
```ts
expect(sent.some((m) => m.type === 'error' && m.message === 'Ruangan penuh (maks 6 pemain)')).toBe(true)
```

In `server/__tests__/http.test.ts:86`, change:
```ts
if (msg.type === 'error') expect(msg.message).toBe('Kamar tidak ditemukan')
```
to:
```ts
if (msg.type === 'error') expect(msg.message).toBe('Ruangan tidak ditemukan')
```

- [ ] **Step 2: Run the server tests to verify they fail**

Run: `npx vitest run server/__tests__/gameServer.test.ts server/__tests__/http.test.ts`
Expected: FAIL — both assertions still see the old "Kamar…" messages.

- [ ] **Step 3: Update the server source strings**

In `server/gameServer.ts:90`, change `'Kamar penuh (maks 6 pemain)'` → `'Ruangan penuh (maks 6 pemain)'`.

In `server/http.ts:75`, change `'Kamar tidak ditemukan'` → `'Ruangan tidak ditemukan'`.

- [ ] **Step 4: Run the server tests to verify they pass**

Run: `npx vitest run server/__tests__/gameServer.test.ts server/__tests__/http.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/gameServer.ts server/http.ts server/__tests__/gameServer.test.ts server/__tests__/http.test.ts
git commit -m "refactor: rename server room error strings from kamar to ruangan"
```

---

### Task 2: Indonesian i18n — "kamar" → "ruangan"

**Files:**
- Modify: `src/i18n/locales/id/translation.json` (values only)

**Interfaces:**
- Consumes: none.
- Produces: Indonesian setup/lobby UI shows "ruangan".

- [ ] **Step 1: Update the five Indonesian strings**

In `src/i18n/locales/id/translation.json`:
- `"setup.createRoom": "Buat Kamar"` → `"Buat Ruangan"`
- `"setup.joinRoom": "Masuk Kamar"` → `"Masuk Ruangan"`
- `"setup.roomCode": "Kode Kamar"` → `"Kode Ruangan"`
- `"lobby.roomCode": "Kode Kamar:"` → `"Kode Ruangan:"`
- `"lobby.leaveRoom": "Keluar Kamar"` → `"Keluar Ruangan"`

Leave `en/translation.json` untouched (already "Room").

- [ ] **Step 2: Verify no test depends on the old Indonesian strings**

Run: `npx vitest run`
Expected: PASS. (Unit tests run in `en`; no test asserts the Indonesian values.)

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/id/translation.json
git commit -m "feat: rename Indonesian room wording from kamar to ruangan"
```

---

### Task 3: Verbose card money logs — logic + unit tests

**Files:**
- Modify: `src/logic/cards.ts` (`resolveCardEffect`, `goToSpace`)
- Modify: `src/logic/gameReducer.ts:525` (DRAW_CARD — remove `event.drewCard`)
- Modify: `src/i18n/log.ts:4` (MONEY_PARAM_KEYS)
- Test: `src/logic/__tests__/cards.test.ts`

**Interfaces:**
- Consumes: `Card`, `GameState`, `LogEntry` from `../types/game`; `GO_SALARY` from `../data/board`.
- Produces: `resolveCardEffect(state, card)` now returns `log` entries whose `params` always include `cardId`, and for `CollectFromPlayers` also `perPlayer`/`playerCount`, and for `StreetRepairs` also `houseCount`/`hotelCount`/`perHouse`/`perHotel`. `goToSpace` takes a 5th `cardId: number` argument and includes `cardId` on its `movedForward`/`movedBack` log entries.

- [ ] **Step 1: Update `cards.test.ts` for the new log shapes**

Replace the whole `describe('resolveCardEffect', ...)` body's assertions (keep the same states/cards) with the following test cases (this is the TDD red state):

```ts
  it('collect money', () => {
    const state = makeState();
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.Collect, amount: 200 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(700);
    expect(result.log).toEqual([{ key: 'event.cardCollect', params: { name: 'Alice', cardId: 1, amount: 200 } }])
  });

  it('pay money adds to free parking and names the card', () => {
    const state = makeState();
    const card: Card = { id: 101, type: CardType.Community, effect: { action: CardActionType.Pay, amount: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(400);
    expect(result.state.freeParkingPot).toBe(100);
    expect(result.log).toEqual([{ key: 'event.cardPay', params: { name: 'Alice', cardId: 101, amount: 100 } }]);
  });

  it('go to jail sends player to position 10 and logs cardToJail', () => {
    const state = makeState();
    const card: Card = { id: 6, type: CardType.Chance, effect: { action: CardActionType.GoToJail } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(10);
    expect(result.state.players[0].inJail).toBe(true);
    expect(result.log).toEqual([{ key: 'event.cardToJail', params: { name: 'Alice', cardId: 6 } }]);
  });

  it('go to space (forward) collects salary if passes GO', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 35 }] });
    const card: Card = { id: 2, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(5);
    expect(result.state.players[0].money).toBe(500 + GO_SALARY);
    expect(result.log).toContainEqual({ key: 'event.movedForward', params: { name: 'Alice', spaceId: 5, cardId: 2 } });
  });

  it('go to space (back 3 steps)', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 10 }] });
    const card: Card = { id: 10, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(7);
    expect(result.log).toContainEqual({ key: 'event.movedBack', params: { name: 'Alice', spaceId: 7, cardId: 10 } });
  });

  it('a forward card that wraps sets passedGo and positive lastMoveSteps', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 7, passedGo: false }] })
    const card: Card = { id: 4, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } }
    const result = resolveCardEffect(state, card)
    expect(result.state.players[0].passedGo).toBe(true)
    expect(result.state.players[0].money).toBe(500 + GO_SALARY)
    expect(result.state.lastMoveSteps).toBe(38) // (5 - 7 + 40) % 40
  })

  it('a backward card that wraps past GO records negative lastMoveSteps', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 2, passedGo: false }] })
    const card: Card = { id: 10, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } }
    const result = resolveCardEffect(state, card)
    expect(result.state.players[0].position).toBe(39)
    expect(result.state.lastMoveSteps).toBe(-3)
  })

  it('a backward card sets negative lastMoveSteps and no passedGo', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 20, passedGo: false }] })
    const card: Card = { id: 10, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } }
    const result = resolveCardEffect(state, card)
    expect(result.state.players[0].position).toBe(17)
    expect(result.state.players[0].passedGo).toBe(false)
    expect(result.state.players[0].money).toBe(500) // no GO salary on a backward move
    expect(result.state.lastMoveSteps).toBe(-3)
  })

  it('get out of jail free card', () => {
    const state = makeState();
    const card: Card = { id: 7, type: CardType.Chance, effect: { action: CardActionType.GetOutOfJailFree } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].hasGetOutOfJailFree).toBe(true);
    expect(result.log).toEqual([{ key: 'event.gotJailCard', params: { name: 'Alice', cardId: 7 } }]);
  });

  it('collect from players logs a per-player breakdown', () => {
    const state = makeState();
    const card: Card = { id: 9, type: CardType.Chance, effect: { action: CardActionType.CollectFromPlayers, amount: 10 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(510);
    expect(result.state.players[1].money).toBe(490);
    expect(result.log).toEqual([{ key: 'event.cardCollectPlayers', params: { name: 'Alice', cardId: 9, amount: 10, perPlayer: 10, playerCount: 1 } }]);
  });

  it('street repairs logs the house/hotel breakdown', () => {
    const board = createInitialBoard();
    board[1].owner = 0;
    board[1].houses = 2;
    const state = makeState({ board, players: [{ ...makeState().players[0], properties: [1] }] });
    const card: Card = { id: 8, type: CardType.Chance, effect: { action: CardActionType.StreetRepairs, perHouse: 25, perHotel: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(450);
    expect(result.state.freeParkingPot).toBe(50);
    expect(result.log).toEqual([{ key: 'event.cardStreetRepairs', params: { name: 'Alice', cardId: 8, amount: 50, houseCount: 2, hotelCount: 0, perHouse: 25, perHotel: 100 } }]);
  });

  it('street repairs counts hotels separately', () => {
    const board = createInitialBoard();
    board[1].owner = 0;
    board[1].houses = 5; // hotel
    board[3].owner = 0;
    board[3].houses = 2;
    const state = makeState({ board, players: [{ ...makeState().players[0], properties: [1, 3] }] });
    const card: Card = { id: 8, type: CardType.Chance, effect: { action: CardActionType.StreetRepairs, perHouse: 25, perHotel: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(500 - 100 - 50);
    expect(result.log).toEqual([{ key: 'event.cardStreetRepairs', params: { name: 'Alice', cardId: 8, amount: 150, houseCount: 2, hotelCount: 1, perHouse: 25, perHotel: 100 } }]);
  });

  it('player money does not go below 0 on pay', () => {
    const state = makeState({ players: [{ ...makeState().players[0], money: 30 }] });
    const card: Card = { id: 101, type: CardType.Community, effect: { action: CardActionType.Pay, amount: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(-70);
  });
```

- [ ] **Step 2: Run the cards tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/cards.test.ts`
Expected: FAIL — log params mismatch (no `cardId` yet), and `event.cardToJail`/breakdown keys don't exist.

- [ ] **Step 3: Update `src/logic/cards.ts`**

Rewrite `resolveCardEffect` so every log entry includes `cardId: card.id`, and add breakdown params. Full new bodies:

```ts
export function resolveCardEffect(state: GameState, card: Card): CardResolution {
  const effect = card.effect;
  const player = state.players[state.currentPlayer];
  let newState = { ...state };

  switch (effect.action) {
    case CardActionType.Collect: {
      newState = updatePlayerMoney(newState, state.currentPlayer, effect.amount);
      return { state: newState, log: [{ key: 'event.cardCollect', params: { name: player.name, cardId: card.id, amount: effect.amount } }] };
    }
    case CardActionType.Pay: {
      newState = addToFreeParking(newState, effect.amount);
      newState = updatePlayerMoney(newState, state.currentPlayer, -effect.amount);
      return { state: newState, log: [{ key: 'event.cardPay', params: { name: player.name, cardId: card.id, amount: effect.amount } }] };
    }
    case CardActionType.GoToJail: {
      newState = sendPlayerToJail(newState, state.currentPlayer);
      return { state: newState, log: [{ key: 'event.cardToJail', params: { name: player.name, cardId: card.id } }] };
    }
    case CardActionType.GetOutOfJailFree: {
      const newPlayers = [...newState.players];
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        hasGetOutOfJailFree: true,
      };
      return { state: { ...newState, players: newPlayers }, log: [{ key: 'event.gotJailCard', params: { name: player.name, cardId: card.id } }] };
    }
    case CardActionType.GoToSpace: {
      const isBackward = effect.spaceId < 0;
      const targetSpace = isBackward
        ? (player.position + effect.spaceId + 40) % 40
        : effect.spaceId;
      return goToSpace(newState, state.currentPlayer, targetSpace, isBackward, card.id);
    }
    case CardActionType.CollectFromPlayers: {
      const amount = effect.amount;
      const newPlayers = newState.players.map((p, i) => {
        if (i === state.currentPlayer) return p;
        return { ...p, money: Math.max(0, p.money - amount) };
      });
      const totalReceived = (newState.players.length - 1) * amount;
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        money: newPlayers[state.currentPlayer].money + totalReceived,
      };
      return {
        state: { ...newState, players: newPlayers },
        log: [{ key: 'event.cardCollectPlayers', params: { name: player.name, cardId: card.id, amount: totalReceived, perPlayer: amount, playerCount: newState.players.length - 1 } }],
      };
    }
    case CardActionType.StreetRepairs: {
      let totalRepairs = 0;
      let houseCount = 0;
      let hotelCount = 0;
      for (const pid of player.properties) {
        const space = newState.board[pid];
        if (space.houses === 5) {
          hotelCount += 1;
          totalRepairs += effect.perHotel;
        } else {
          houseCount += space.houses;
          totalRepairs += space.houses * effect.perHouse;
        }
      }
      newState = addToFreeParking(newState, totalRepairs);
      newState = updatePlayerMoney(newState, state.currentPlayer, -totalRepairs);
      return {
        state: newState,
        log: [{ key: 'event.cardStreetRepairs', params: { name: player.name, cardId: card.id, amount: totalRepairs, houseCount, hotelCount, perHouse: effect.perHouse, perHotel: effect.perHotel } }],
      };
    }
    default:
      return { state: newState, log: [] };
  }
}
```

Update `goToSpace` to accept and forward `cardId`:

```ts
function goToSpace(state: GameState, playerIndex: number, spaceId: number, isBackward: boolean, cardId: number): CardResolution {
  const player = state.players[playerIndex];
  let newState = { ...state };
  const log: LogEntry[] = [];

  const passesGo = !isBackward && spaceId < player.position;
  if (passesGo) {
    newState = updatePlayerMoney(newState, playerIndex, GO_SALARY);
    newState = setPlayerPassedGo(newState, playerIndex);
    log.push({ key: 'event.passedGo', params: { name: player.name, amount: GO_SALARY } });
  }

  const steps = isBackward
    ? -((player.position - spaceId + 40) % 40)
    : (spaceId - player.position + 40) % 40;
  const newPlayers = [...newState.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], position: spaceId };
  newState = { ...newState, players: newPlayers, lastMoveSteps: steps };

  log.push({ key: isBackward ? 'event.movedBack' : 'event.movedForward', params: { name: player.name, spaceId, cardId } });

  return { state: newState, log };
}
```

- [ ] **Step 4: Remove the generic `event.drewCard` push in `gameReducer.ts`**

In `src/logic/gameReducer.ts`, the `DRAW_CARD` case (currently around line 519-526) returns `eventLog: [...state.eventLog, { key: 'event.drewCard', ... }]`. Change that return so `eventLog: state.eventLog` (drop the `event.drewCard` entry entirely):

```ts
      return {
        ...state,
        phase: GamePhase.Resolving,
        chanceDeck: isChance ? deck : state.chanceDeck,
        communityDeck: isChance ? state.communityDeck : deck,
        pendingAction: { type: PendingActionType.CardEffect, card },
        eventLog: state.eventLog,
      };
```

- [ ] **Step 5: Extend `MONEY_PARAM_KEYS` in `src/i18n/log.ts`**

```ts
const MONEY_PARAM_KEYS = new Set(['amount', 'money', 'perHouse', 'perHotel', 'perPlayer'])
```

- [ ] **Step 6: Run the cards tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/cards.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full unit suite + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: PASS (no other test asserts `event.drewCard` or the old card-log shapes — `gameReducer.test.ts` only asserts space-based `event.toJail`, which is untouched).

- [ ] **Step 8: Commit**

```bash
git add src/logic/cards.ts src/logic/gameReducer.ts src/i18n/log.ts src/logic/__tests__/cards.test.ts
git commit -m "feat: verbose card money logs with card id and computed breakdowns"
```

---

### Task 4: i18n verbose card-log strings (en + id)

**Files:**
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: the new `event.*` keys + `cardId`/`perHouse`/`perHotel`/`perPlayer` params produced by Task 3.
- Produces: localized verbose card-log lines rendered by `EventLog` → `resolveLogEntry`.

- [ ] **Step 1: Update `en/translation.json`**

Replace the following keys (currently at lines ~99-109):

```json
  "event.drewCard": "{{name}} drew a card: {{cardId}}",
```
→ remove this line entirely (unused now).

```json
  "event.cardCollect": "{{name}} drew {{cardId}} and collected {{amount}}",
  "event.cardPay": "{{name}} drew {{cardId}} and paid {{amount}} to Free Parking",
  "event.cardToJail": "{{name}} drew {{cardId}} and went to Jail!",
  "event.gotJailCard": "{{name}} drew {{cardId}} and received a Get Out of Jail Free card!",
  "event.cardCollectPlayers": "{{name}} drew {{cardId}} and collected {{amount}} from all players ({{playerCount}} players × {{perPlayer}})",
  "event.cardStreetRepairs": "{{name}} drew {{cardId}} and paid {{amount}} in repairs ({{houseCount}} houses × {{perHouse}} + {{hotelCount}} hotels × {{perHotel}})",
  "event.movedForward": "{{name}} drew {{cardId}} and moved forward to {{spaceId}}",
  "event.movedBack": "{{name}} drew {{cardId}} and moved back to {{spaceId}}",
```

Keep every other key byte-identical.

- [ ] **Step 2: Update `id/translation.json`**

Replace the same keys with the Indonesian equivalents, and remove `event.drewCard`:

```json
  "event.cardCollect": "{{name}} menarik kartu {{cardId}} dan mendapat {{amount}}",
  "event.cardPay": "{{name}} menarik kartu {{cardId}} dan membayar {{amount}} ke Parkir Gratis",
  "event.cardToJail": "{{name}} menarik kartu {{cardId}} dan masuk Penjara!",
  "event.gotJailCard": "{{name}} menarik kartu {{cardId}} dan mendapat Kartu Bebas Penjara!",
  "event.cardCollectPlayers": "{{name}} menarik kartu {{cardId}} dan menerima {{amount}} dari semua pemain ({{playerCount}} pemain × {{perPlayer}})",
  "event.cardStreetRepairs": "{{name}} menarik kartu {{cardId}} dan membayar {{amount}} untuk perbaikan ({{houseCount}} rumah × {{perHouse}} + {{hotelCount}} hotel × {{perHotel}})",
  "event.movedForward": "{{name}} menarik kartu {{cardId}} dan maju ke {{spaceId}}",
  "event.movedBack": "{{name}} menarik kartu {{cardId}} dan mundur ke {{spaceId}}",
```

- [ ] **Step 3: Verify the app builds**

Run: `npx tsc -b`
Expected: PASS (JSON imports are type-checked; keys are free-form so no TS error).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: verbose localized card-log strings with card id and breakdowns"
```

---

### Task 5: `RoomExit` component (collapsed toggle + confirmation)

**Files:**
- Create: `src/components/RoomExit.tsx`
- Test: `src/components/__tests__/RoomExit.test.tsx`

**Interfaces:**
- Consumes: `Button` from `./Button`, `Modal` from `./Modals/Modal`, `useTranslation`, i18n keys `confirm.leaveTitle` / `confirm.leaveMessage` / `confirm.cancel` / `confirm.leave` / `confirm.leaveExpand` / `lobby.leaveRoom`.
- Produces: `RoomExit({ onLeave: () => void; collapsed?: boolean })` — when `collapsed`, renders an icon-only toggle button; clicking it reveals the danger "Leave Room" button; clicking that opens a confirm `Modal`; only the confirm button calls `onLeave`.

- [ ] **Step 1: Write the failing component test**

Create `src/components/__tests__/RoomExit.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import RoomExit from '../RoomExit'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('RoomExit', () => {
  it('renders only the collapse toggle when collapsed (no leave button)', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} collapsed />)
    expect(screen.getByRole('button', { name: 'Leave Room Options' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Leave Room' })).toBeNull()
  })

  it('expands to reveal the leave button when the toggle is clicked', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} collapsed />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room Options' }))
    expect(screen.getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })

  it('shows the leave button directly when not collapsed', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} />)
    expect(screen.getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })

  it('opens the confirmation modal and does not leave on cancel', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    expect(screen.getByText('Are you sure you want to leave this room?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('calls onLeave only after confirming', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/RoomExit.test.tsx`
Expected: FAIL — module not found / component missing.

- [ ] **Step 3: Create `src/components/RoomExit.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import Modal from './Modals/Modal'

interface Props {
  onLeave: () => void
  collapsed?: boolean
}

export default function RoomExit({ onLeave, collapsed = false }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-col items-stretch gap-1.5 w-full">
      {collapsed && (
        <button
          type="button"
          aria-label={t('confirm.leaveExpand')}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1 text-xs text-text cursor-pointer hover:opacity-90"
        >
          <span aria-hidden>⚙</span>
        </button>
      )}
      {(!collapsed || open) && (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          {t('lobby.leaveRoom')}
        </Button>
      )}
      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <h3 className="text-2xl text-gold m-0">{t('confirm.leaveTitle')}</h3>
          <p className="text-base text-text">{t('confirm.leaveMessage')}</p>
          <Modal.Actions>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button variant="danger" onClick={onLeave}>
              {t('confirm.leave')}
            </Button>
          </Modal.Actions>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the `confirm.*` i18n keys (en + id)**

In `en/translation.json`, add:

```json
  "confirm.leaveTitle": "Leave Room",
  "confirm.leaveMessage": "Are you sure you want to leave this room?",
  "confirm.cancel": "Cancel",
  "confirm.leave": "Leave",
  "confirm.leaveExpand": "Leave Room Options",
```

In `id/translation.json`, add:

```json
  "confirm.leaveTitle": "Keluar Ruangan",
  "confirm.leaveMessage": "Yakin ingin keluar dari ruangan ini?",
  "confirm.cancel": "Batal",
  "confirm.leave": "Keluar",
  "confirm.leaveExpand": "Opsi Keluar Ruangan",
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/RoomExit.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/RoomExit.tsx src/components/__tests__/RoomExit.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: add RoomExit component with collapse toggle and leave confirmation"
```

---

### Task 6: Wire `RoomExit` into `Sidebar` and `Lobby`

**Files:**
- Modify: `src/components/Sidebar.tsx` (remove `Button` import if unused; replace leave block)
- Modify: `src/components/Lobby.tsx` (replace leave button)

**Interfaces:**
- Consumes: `RoomExit` from `./RoomExit`.
- Produces: Sidebar shows collapsed ⚙ toggle (multiplayer); Lobby shows visible "Leave Room"/"Keluar Ruangan" button; both require confirmation to actually leave.

- [ ] **Step 1: Update `Sidebar.tsx`**

Add the import at the top:

```tsx
import RoomExit from './RoomExit'
```

Replace the leave block (currently lines 48-52):

```tsx
        {onLeave && (
          <Button variant="danger" size="sm" onClick={onLeave}>
            {t('lobby.leaveRoom')}
          </Button>
        )}
```

with:

```tsx
        {onLeave && <RoomExit onLeave={onLeave} collapsed />}
```

If `Button` is no longer referenced anywhere else in `Sidebar.tsx`, remove its import (check first — it is imported at line 5).

- [ ] **Step 2: Update `Lobby.tsx`**

Add the import:

```tsx
import RoomExit from './RoomExit'
```

Replace the leave button (currently lines 54-56):

```tsx
        <Button variant="secondary" onClick={leave}>
          {t('lobby.leave')}
        </Button>
```

with:

```tsx
        <RoomExit onLeave={leave} />
```

`Button` is still used for the Start button, so keep its import.

- [ ] **Step 3: Run the full unit suite + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Lobby.tsx
git commit -m "feat: use RoomExit with collapse and confirmation in sidebar and lobby"
```

---

### Task 7: Update the multiplayer e2e leave flow

**Files:**
- Modify: `e2e/multiplayer.spec.ts` (the "a player can leave the room mid-game and return to the menu" test, around lines 105-106)

**Interfaces:**
- Consumes: the collapsed `RoomExit` toggle (aria-label `Leave Room Options` in EN) + confirm modal buttons.
- Produces: e2e that leaves a room via expand → leave → confirm.

- [ ] **Step 1: Update the leave steps in the e2e test**

The current test ends with:

```ts
  await pageB.click('button:has-text("Leave Room")')
  await expect(pageB.locator('button:has-text("Multiplayer")')).toBeVisible({ timeout: 5000 })
```

Replace with the collapsed-toggle flow (the e2e forces `monopoly-language=en`):

```ts
  await pageB.click('button[aria-label="Leave Room Options"]')
  await pageB.click('button:has-text("Leave Room")')
  await pageB.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(pageB.locator('button:has-text("Multiplayer")')).toBeVisible({ timeout: 5000 })
```

- [ ] **Step 2: Build and run the multiplayer e2e spec**

Run: `npm run build && npx playwright test e2e/multiplayer.spec.ts`
Expected: PASS (both the create/join test and the leave test).

- [ ] **Step 3: Run the full test command**

Run: `npm test`
Expected: PASS (unit + e2e).

- [ ] **Step 4: Commit**

```bash
git add e2e/multiplayer.spec.ts
git commit -m "test: update e2e leave flow for collapsed RoomExit and confirmation"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 (server strings), Task 2 (i18n values), Task 3-4 (verbose card logs incl. breakdowns), Task 5-6 (collapse + confirmation), Task 7 (e2e). Issue 4 explicitly dropped per user.
- **Placeholder check:** every step has concrete code or an exact expected result.
- **Type consistency:** `goToSpace(..., cardId: number)` signature is updated in the same task that calls it with `card.id`; `RoomExit` props `{ onLeave, collapsed }` match all three usages; i18n param names (`perHouse`, `perHotel`, `perPlayer`, `houseCount`, `hotelCount`, `playerCount`) match between `cards.ts`, `log.ts` `MONEY_PARAM_KEYS`, and the translation templates.
- **Shared-key guard:** the `event.toJail` key is preserved for the GoToJail space; the GoToJail card now uses the new `event.cardToJail` key.
