# Gameplay Economics & UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 gameplay/economics/UX issues: un-scaled card amounts, sell/mortgage economics, monopoly 2× rent, build-before-roll, opaque tax, hidden free-jail card, off-screen tooltip, and move cards into a JSON config.

**Architecture:** Centralize economic rates in `game-config.json` (exposed as constants in `data/board.ts`), move card definitions into a new `cards-data.json` (loaded + scaled once in `data/cards.ts`), add monopoly/tax/net-worth helpers in `logic/rent.ts`, and wire the UI (ActionSection, PropertyTooltip, PlayerCard, BoardGrid) to the new state.

**Tech Stack:** TypeScript + React 19 + Vite + Vitest (jsdom for component tests) + Tailwind CSS v4. JSON is imported directly (already used by `board-data.json`; `tsc` and Vite both resolve it).

## Global Constraints

- All raw economic amounts are scaled by `config.priceMultiplier` (`1000000`) at load time in `data/board.ts` / `data/cards.ts`. Never hardcode a scaled value in a reducer.
- Copy language is Bahasa Indonesia; currency via `formatMoney` from `src/utils/format.ts`.
- Tests use `vitest` + `@testing-library/react`; component tests start with `// @vitest-environment jsdom`.
- Run unit tests with `npm run test:unit`, typecheck with `npm run typecheck`, lint with `npm run lint`.
- Commit after each task with a `feat:`/`fix:`/`docs:` message.
- No comments in code unless a non-obvious rule requires one.

---

### Task 1: Add economic config keys + constants

**Files:**
- Modify: `src/data/game-config.json`
- Modify: `src/data/board.ts`

**Interfaces:**
- Produces (used by Tasks 3 and 5): `INCOME_TAX_RATE: number`, `SELL_RATE: number`, `MORTGAGED_SELL_EXTRA: number`, `HOUSE_SELL_RATE: number` — all exported from `src/data/board.ts`.

- [ ] **Step 1: Add the keys to config**

Replace the contents of `src/data/game-config.json` with:

```json
{
  "goSalary": 200,
  "jailFine": 50,
  "startingMoney": 1500,
  "priceMultiplier": 1000000,
  "incomeTaxRate": 0.1,
  "sellRate": 0.75,
  "mortgagedSellExtra": 0.1,
  "houseSellRate": 0.75
}
```

- [ ] **Step 2: Export constants**

In `src/data/board.ts`, after the existing `export const MAX_JAIL_TURNS = 3;` line, add:

```ts
export const INCOME_TAX_RATE = config.incomeTaxRate;
export const SELL_RATE = config.sellRate;
export const MORTGAGED_SELL_EXTRA = config.mortgagedSellExtra;
export const HOUSE_SELL_RATE = config.houseSellRate;
```

(`config` is already imported at the top of `board.ts`.)

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: passes with no errors (JSON fields are inferred from the file).

- [ ] **Step 4: Commit**

```bash
git add src/data/game-config.json src/data/board.ts
git commit -m "feat: add economic rate config keys"
```

---

### Task 2: Move cards to JSON + central scaling (fixes issue 1 & 8)

**Files:**
- Create: `src/data/cards-data.json`
- Modify: `src/data/cards.ts` (rewrite as loader)
- Modify: `src/logic/gameReducer.ts` (remove local scaling)
- Test: `src/data/__tests__/cards.test.ts` (new)

**Interfaces:**
- Consumes: `config.priceMultiplier` from `src/data/game-config.json`.
- Produces: `CHANCE_CARDS: Card[]` and `COMMUNITY_CARDS: Card[]` (already scaled by `priceMultiplier`), exported from `src/data/cards.ts`. `gameReducer` relies on these being pre-scaled.

- [ ] **Step 1: Write the failing test**

Create `src/data/__tests__/cards.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../cards';
import { CardActionType, CardType } from '../../types/game';

describe('cards data', () => {
  it('exports 10 chance and 10 community cards', () => {
    expect(CHANCE_CARDS).toHaveLength(10);
    expect(COMMUNITY_CARDS).toHaveLength(10);
  });

  it('scales collect/pay amounts by priceMultiplier', () => {
    const dividend = CHANCE_CARDS.find((c) => c.id === 5)!;
    expect(dividend.effect).toMatchObject({ action: CardActionType.Collect, amount: 50000000 });

    const parkingFine = COMMUNITY_CARDS.find((c) => c.id === 110)!;
    expect(parkingFine.effect).toMatchObject({ action: CardActionType.Pay, amount: 25000000 });
  });

  it('scales street repairs per-house/per-hotel amounts', () => {
    const repairs = CHANCE_CARDS.find((c) => c.id === 8)!;
    expect(repairs.effect).toMatchObject({ perHouse: 25000000, perHotel: 100000000 });
  });

  it('sets the correct deck type on each card', () => {
    expect(CHANCE_CARDS.every((c) => c.type === CardType.Chance)).toBe(true);
    expect(COMMUNITY_CARDS.every((c) => c.type === CardType.Community)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/data/__tests__/cards.test.ts`
Expected: FAIL — `src/data/__tests__/cards.test.ts` does not exist / import fails.

- [ ] **Step 3: Create the JSON data**

Create `src/data/cards-data.json` with the exact card contents currently in `cards.ts`, raw (unscaled), keyed by deck:

```json
{
  "chance": [
    { "id": 1, "description": "Majulah ke MULAI.", "effect": { "action": "goToSpace", "spaceId": 0 } },
    { "id": 2, "description": "Majulah ke Jakarta.", "effect": { "action": "goToSpace", "spaceId": 37 } },
    { "id": 3, "description": "Majulah ke Bali.", "effect": { "action": "goToSpace", "spaceId": 39 } },
    { "id": 4, "description": "Majulah ke Stasiun Gambir.", "effect": { "action": "goToSpace", "spaceId": 5 } },
    { "id": 5, "description": "Bank membayar dividen.", "effect": { "action": "collect", "amount": 50 } },
    { "id": 6, "description": "Pergilah ke Masuk Penjara. Langsung menuju Penjara tanpa melewati MULAI.", "effect": { "action": "goToJail" } },
    { "id": 7, "description": "Anda bebas dari Penjara. Simpan kartu ini sampai diperlukan.", "effect": { "action": "getOutOfJailFree" } },
    { "id": 8, "description": "Bayar perbaikan jalan.", "effect": { "action": "streetRepairs", "perHouse": 25, "perHotel": 100 } },
    { "id": 9, "description": "Anda berulang tahun! Dapatkan dari setiap pemain.", "effect": { "action": "collectFromPlayers", "amount": 10 } },
    { "id": 10, "description": "Mundurlah 3 langkah.", "effect": { "action": "goToSpace", "spaceId": -3 } }
  ],
  "community": [
    { "id": 101, "description": "Kesalahan bank! Dapatkan uang.", "effect": { "action": "collect", "amount": 200 } },
    { "id": 102, "description": "Biaya rumah sakit.", "effect": { "action": "pay", "amount": 100 } },
    { "id": 103, "description": "Biaya sekolah.", "effect": { "action": "pay", "amount": 50 } },
    { "id": 104, "description": "Anda bebas dari Penjara. Simpan kartu ini sampai diperlukan.", "effect": { "action": "getOutOfJailFree" } },
    { "id": 105, "description": "Pergilah ke Masuk Penjara. Langsung menuju Penjara tanpa melewati MULAI.", "effect": { "action": "goToJail" } },
    { "id": 106, "description": "Dapatkan warisan.", "effect": { "action": "collect", "amount": 100 } },
    { "id": 107, "description": "Asuransi jiwa jatuh tempo.", "effect": { "action": "collect", "amount": 100 } },
    { "id": 108, "description": "Kontes kecantikan: Dapatkan hadiah.", "effect": { "action": "collect", "amount": 50 } },
    { "id": 109, "description": "Bayar premi asuransi.", "effect": { "action": "pay", "amount": 50 } },
    { "id": 110, "description": "Bayar denda parkir.", "effect": { "action": "pay", "amount": 25 } }
  ]
}
```

- [ ] **Step 4: Rewrite `src/data/cards.ts` as a loader**

Replace the entire contents of `src/data/cards.ts` with:

```ts
import { CardType, type Card, type CardEffect } from '../types/game';
import config from './game-config.json';
import cardsData from './cards-data.json';

const m = config.priceMultiplier;

type RawEffect = {
  action: string;
  amount?: number;
  spaceId?: number;
  perHouse?: number;
  perHotel?: number;
};

type RawCard = { id: number; description: string; effect: RawEffect };

interface CardsData {
  chance: RawCard[];
  community: RawCard[];
}

const data = cardsData as unknown as CardsData;

function scaleEffect(effect: RawEffect): CardEffect {
  const scaled = { ...effect };
  if ('amount' in scaled && scaled.amount !== undefined) scaled.amount *= m;
  if ('perHouse' in scaled && scaled.perHouse !== undefined) scaled.perHouse *= m;
  if ('perHotel' in scaled && scaled.perHotel !== undefined) scaled.perHotel *= m;
  return scaled as unknown as CardEffect;
}

function toCards(raw: RawCard[], type: CardType): Card[] {
  return raw.map((c) => ({ id: c.id, description: c.description, type, effect: scaleEffect(c.effect) }));
}

export const CHANCE_CARDS: Card[] = toCards(data.chance, CardType.Chance);
export const COMMUNITY_CARDS: Card[] = toCards(data.community, CardType.Community);
```

- [ ] **Step 5: Remove local scaling from `gameReducer`**

In `src/logic/gameReducer.ts`:
1. Delete the `scaleCards` function (lines 15-23).
2. Delete the `const m = config.priceMultiplier;` line and the `import config from '../data/game-config.json';` line (no longer used).
3. In `createInitialState`, change `chanceDeck: scaleCards(shuffle([...CHANCE_CARDS]))` to `chanceDeck: shuffle([...CHANCE_CARDS])` and `communityDeck: scaleCards(shuffle([...COMMUNITY_CARDS]))` to `communityDeck: shuffle([...COMMUNITY_CARDS])`.
4. In the `DrawCard` refill path, the `freshDeck` lines already use `[...CHANCE_CARDS]` / `[...COMMUNITY_CARDS]` — now those constants are pre-scaled, so no further change is needed there.

- [ ] **Step 6: Run the tests**

Run: `npm run test:unit`
Expected: all unit tests pass, including the new `src/data/__tests__/cards.test.ts`.

- [ ] **Step 7: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/data/cards-data.json src/data/cards.ts src/logic/gameReducer.ts src/data/__tests__/cards.test.ts
git commit -m "fix: move cards to JSON and scale once at load"
```

---

### Task 3: Sell economics — sell mortgaged property + 75% rates (issue 2)

**Files:**
- Modify: `src/logic/gameReducer.ts`
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `SELL_RATE`, `MORTGAGED_SELL_EXTRA`, `HOUSE_SELL_RATE` from `src/data/board.ts`.
- Produces: updated `SellProperty`, `SellHouse` reducer behavior (values only; action shapes unchanged).

- [ ] **Step 1: Write the failing tests**

In `src/logic/__tests__/gameReducer.test.ts`, update the `SELL_HOUSE` describe block's first test and add a new `SELL_PROPERTY` describe block.

Replace the existing `SELL_HOUSE` test body:

```ts
  describe('SELL_HOUSE', () => {
    it('sells a house for 75% of its build cost', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 2 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.SellHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(1);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60000000 + 37500000);
    });
  });
```

Add a new describe block (after `UNMORTGAGE`):

```ts
  describe('SELL_PROPERTY', () => {
    it('sells an unmortgaged property for 75% of price', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);

      const s1 = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
      expect(s1.board[1].owner).toBeNull();
      expect(s1.board[1].mortgaged).toBe(false);
      expect(s1.players[0].properties).not.toContain(1);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60000000 + 45000000);
    });

    it('sells a mortgaged property for an extra 10% on top of mortgage', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, mortgaged: true } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
      expect(s1.board[1].owner).toBeNull();
      expect(s1.board[1].mortgaged).toBe(false);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60000000 + 6000000);
    });

    it('cannot sell a property that still has houses', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 1 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
      expect(s1.board[1].owner).toBe(0);
      expect(s1.players[0].properties).toContain(1);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — SELL_HOUSE expects `37500000` but code refunds `25000000`; SELL_PROPERTY tests fail (mortgaged sell returns early; unmortgaged sell pays `30000000` not `45000000`).

- [ ] **Step 3: Update the reducer**

In `src/logic/gameReducer.ts`, update the `SellHouse` and `SellProperty` cases.

Import the new constants (add to the existing `../data/board` import):
```ts
import { createInitialBoard, getHouseCost, GO_SALARY, JAIL_SPACE, STARTING_MONEY, MAX_JAIL_TURNS, JAIL_FINE, SELL_RATE, MORTGAGED_SELL_EXTRA, HOUSE_SELL_RATE } from '../data/board';
```

`SellHouse`: change the refund line from:
```ts
const refund = Math.floor(getHouseCost(space, space.houses - 1) / 2);
```
to:
```ts
const refund = Math.floor(getHouseCost(space, space.houses - 1) * HOUSE_SELL_RATE);
```

`SellProperty`: replace the whole case body:
```ts
    case GameActionType.SellProperty: {
      const space = state.board[action.spaceId];
      const player = state.players[state.currentPlayer];
      if (space.owner !== state.currentPlayer) return state;
      if (space.houses > 0) return state;
      const sellValue = space.mortgaged
        ? Math.floor((space.price ?? 0) * MORTGAGED_SELL_EXTRA)
        : Math.floor((space.price ?? 0) * SELL_RATE);
      const newBoard = [...state.board];
      newBoard[action.spaceId] = { ...space, owner: null, mortgaged: false };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        money: player.money + sellValue,
        properties: player.properties.filter((id) => id !== action.spaceId),
      };
      return {
        ...state,
        board: newBoard,
        players: newPlayers,
        eventLog: [...state.eventLog, `${player.name} menjual ${space.name} ke bank seharga ${formatMoney(sellValue)}`],
      };
    }
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && git add src/logic/gameReducer.ts src/logic/__tests__/gameReducer.test.ts && git commit -m "feat: allow selling mortgaged property; 75% sell/house rates"
```

---

### Task 4: Monopoly 2× rent + notice (issue 3)

**Files:**
- Modify: `src/logic/rent.ts`
- Modify: `src/logic/gameReducer.ts`
- Modify: `src/components/PropertyTooltip.tsx`
- Test: `src/logic/__tests__/rent.test.ts`
- Test: `src/components/__tests__/PropertyTooltip.test.tsx`

**Interfaces:**
- Produces: `isMonopoly(ownerId: number, board: Space[], space: Space): boolean` exported from `src/logic/rent.ts`.

- [ ] **Step 1: Write the failing test**

In `src/logic/__tests__/rent.test.ts`, add an import and a new describe block:

```ts
import { calculatePropertyRent, isMonopoly } from '../rent';
```

```ts
describe('isMonopoly', () => {
  function boardWithColor(color: string, owner: number, count: number): Space[] {
    return Array.from({ length: count }, (_, i) =>
      makeSpace({ id: i, color, owner, type: SpaceType.Property })
    );
  }

  it('is a monopoly when all properties of a color are owned', () => {
    const board = boardWithColor('#8B4513', 0, 2);
    expect(isMonopoly(0, board, board[0])).toBe(true);
  });

  it('is not a monopoly when a color group is split between owners', () => {
    const board = boardWithColor('#8B4513', 0, 2);
    board[1] = { ...board[1], owner: 1 };
    expect(isMonopoly(0, board, board[0])).toBe(false);
  });

  it('is not a monopoly for non-property (railroad) spaces', () => {
    const railroad = makeSpace({ type: SpaceType.Railroad, color: undefined });
    expect(isMonopoly(0, [railroad], railroad)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/logic/__tests__/rent.test.ts`
Expected: FAIL — `isMonopoly` is not exported.

- [ ] **Step 3: Implement `isMonopoly`**

Add to `src/logic/rent.ts` (after `calculatePropertyRent`):

```ts
export function isMonopoly(ownerId: number, board: Space[], space: Space): boolean {
  if (space.type !== SpaceType.Property || space.color == null) return false;
  const group = board.filter((s) => s.type === SpaceType.Property && s.color === space.color);
  return group.length > 0 && group.every((s) => s.owner === ownerId);
}
```

- [ ] **Step 4: Apply 2× in the reducer + announce**

In `src/logic/gameReducer.ts`, import `isMonopoly` (add to the existing `../rent` import) and replace the property-rent branch inside `ResolveSpace`. Replace the block from `if (space.owner !== null && space.owner !== state.currentPlayer && !space.mortgaged) {` through its closing `}` (the first `} else if (space.owner === null) {` stays) with:

```ts
          if (space.owner !== null && space.owner !== state.currentPlayer && !space.mortgaged) {
            let rent: number;
            let monopoly = false;
            if (space.type === SpaceType.Railroad) {
              rent = calculateRailroadRentFromBoard(space.owner, state.board, space.id);
            } else if (space.type === SpaceType.Utility) {
              rent = calculateUtilityRentFromBoard(space.owner, state.board, space.id, state.dice ?? [1, 1]);
            } else {
              rent = calculatePropertyRent(space);
              monopoly = space.houses === 0 && isMonopoly(space.owner, state.board, space);
              if (monopoly) rent *= 2;
            }

            const currentPlayer = state.players[state.currentPlayer];
            const owner = state.players[space.owner];
            if (owner.inJail) {
              return { ...state, phase: GamePhase.Waiting, eventLog: [...state.eventLog, `${owner.name} di penjara — tidak mendapat sewa dari ${currentPlayer.name}`] };
            }

            return {
              ...state,
              phase: GamePhase.Resolving,
              pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: rent },
              eventLog: monopoly
                ? [...state.eventLog, `${owner.name} memiliki komplek lengkap — sewa ${currentPlayer.name} jadi 2x!`]
                : state.eventLog,
            };
          } else if (space.owner === null) {
```

- [ ] **Step 5: Tooltip notice**

In `src/components/PropertyTooltip.tsx`, import `isMonopoly` from `../logic/rent` and add a highlighted line inside the `isBuyable && space.price` block, right after the rent table, before the house-cost line. Add:

```tsx
          {space.type === 'property' && space.owner !== null && space.houses === 0 && isMonopoly(space.owner, state.board, space) && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm text-gold font-semibold">
              Komplek lengkap: sewa 2x ({formatMoney((space.rent?.[0] ?? 0) * 2)})
            </div>
          )}
```

- [ ] **Step 6: Component test**

In `src/components/__tests__/PropertyTooltip.test.tsx`, add an import for `isMonopoly` usage via state and a new test. Provide a state whose board has a full color group owned by player 0:

```tsx
  it('shows monopoly 2x notice when owner has full color group with no houses', () => {
    const s = makeState(100000000)
    const board = s.board.map((b) => {
      if (b.color === '#8B4513' && b.type === 'property') return { ...b, owner: 0 }
      return b
    })
    const space = { ...board[1], houses: 0, owner: 0 }
    render(<PropertyTooltip space={space} state={{ ...s, board }} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByText(/Komplek lengkap/)).toBeTruthy()
  })
```

- [ ] **Step 7: Run all unit tests, typecheck, lint**

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/logic/rent.ts src/logic/gameReducer.ts src/components/PropertyTooltip.tsx src/logic/__tests__/rent.test.ts src/components/__tests__/PropertyTooltip.test.tsx
git commit -m "feat: double base rent on a complete color group and announce it"
```

---

### Task 5: Tax — 10% income, flat luxury, verbose (issue 5)

**Files:**
- Modify: `src/data/board-data.json`
- Modify: `src/types/game.ts`
- Modify: `src/data/board.ts`
- Modify: `src/logic/rent.ts` (add `getPlayerNetWorth`)
- Modify: `src/logic/gameReducer.ts`
- Modify: `src/components/PropertyTooltip.tsx`
- Test: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `INCOME_TAX_RATE` from `src/data/board.ts`.
- Produces: `getPlayerNetWorth(player: Player, board: Space[]): number` exported from `src/logic/rent.ts`; `Space.taxType?: 'income' | 'luxury'`.

- [ ] **Step 1: Tag tax spaces in board data**

In `src/data/board-data.json`:
- Change `{ "id": 4, "name": "Pajak Penghasilan", "type": "tax", "price": 200 }` to `{ "id": 4, "name": "Pajak Penghasilan", "type": "tax", "taxType": "income" }`.
- Change `{ "id": 38, "name": "Pajak Mewah", "type": "tax", "price": 100 }` to `{ "id": 38, "name": "Pajak Mewah", "type": "tax", "taxType": "luxury", "price": 100 }`.

- [ ] **Step 2: Add `taxType` to the Space type**

In `src/types/game.ts`, add to the `Space` type (after `mortgaged: boolean;`):

```ts
  taxType?: 'income' | 'luxury';
```

- [ ] **Step 3: Pass `taxType` through `createInitialBoard`**

In `src/data/board.ts`, in `createInitialBoard`, add a field to the mapped object (after `mortgaged: false,`):

```ts
    taxType: item.taxType as Space['taxType'] | undefined,
```

Import the `Space` type if not already imported (add `type Space` to the existing `../types/game` import).

- [ ] **Step 4: Add `getPlayerNetWorth`**

In `src/logic/rent.ts`, add (after `getPlayerTotalAssets`):

```ts
export function getPlayerNetWorth(player: Player, board: Space[]): number {
  let total = player.money;
  for (const pid of player.properties) {
    const space = board[pid];
    if (!space) continue;
    total += space.price ?? 0;
    total += getTotalHouseInvestment(space);
  }
  return total;
}
```

- [ ] **Step 5: Update the Tax branch in the reducer**

In `src/logic/gameReducer.ts`, import `getPlayerNetWorth` (add to the `../rent` import) and `INCOME_TAX_RATE` (add to the `../data/board` import).

Replace the `case SpaceType.Tax:` block:

```ts
        case SpaceType.Tax: {
          const isIncome = space.taxType === 'income';
          const netWorth = isIncome ? getPlayerNetWorth(player, state.board) : 0;
          const taxAmount = isIncome
            ? Math.floor(netWorth * INCOME_TAX_RATE)
            : (space.price ?? 0);
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            money: player.money - taxAmount,
          };
          const message = isIncome
            ? `${player.name} membayar pajak penghasilan ${formatMoney(taxAmount)} (10% dari total aset ${formatMoney(netWorth)})`
            : `${player.name} membayar pajak mewah ${formatMoney(taxAmount)}`;
          return {
            ...state,
            phase: GamePhase.Waiting,
            players: newPlayers,
            freeParkingPot: state.freeParkingPot + taxAmount,
            eventLog: [...state.eventLog, message],
          };
        }
```

- [ ] **Step 6: Tooltip rule text**

In `src/components/PropertyTooltip.tsx`, add a block for tax spaces. Insert before the `{isBuyable && space.price && (` line (tax spaces are not `isBuyable`):

```tsx
      {space.type === 'tax' && (
        <div className="text-sm text-text-dim">
          {space.taxType === 'income'
            ? 'Bayar 10% dari total aset (uang + properti + rumah)'
            : `Bayar ${formatMoney(space.price)} (pajak tetap)`}
        </div>
      )}
```

- [ ] **Step 7: Update the existing income-tax test and add a luxury test**

In `src/logic/__tests__/gameReducer.test.ts`, replace the `tax handling` describe block:

```ts
  describe('tax handling', () => {
    it('pays income tax (10% of net worth) to free parking', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 4);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(STARTING_MONEY - 150000000);
      expect(s1.freeParkingPot).toBe(150000000);
      expect(s1.eventLog.some((e) => e.includes('pajak penghasilan') && e.includes('10%'))).toBe(true);
    });

    it('pays flat luxury tax to free parking', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 38);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(STARTING_MONEY - 100000000);
      expect(s1.freeParkingPot).toBe(100000000);
      expect(s1.eventLog.some((e) => e.includes('pajak mewah'))).toBe(true);
    });

    it('collects free parking jackpot', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 20);
      state = { ...state, phase: GamePhase.Resolving, freeParkingPot: 350000000, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(STARTING_MONEY + 350000000);
      expect(s1.freeParkingPot).toBe(0);
    });
  });
```

(150,000,000 = 10% of the starting 1,500,000,000 with no properties.)

- [ ] **Step 8: Run all unit tests, typecheck, lint**

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/data/board-data.json src/types/game.ts src/data/board.ts src/logic/rent.ts src/logic/gameReducer.ts src/components/PropertyTooltip.tsx src/logic/__tests__/gameReducer.test.ts
git commit -m "feat: 10% income tax and flat luxury tax with verbose messaging"
```

---

### Task 6: Gate build button behind a dice roll (issue 4)

**Files:**
- Modify: `src/components/ActionSection.tsx`
- Test: `src/components/__tests__/ActionSection.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Update the tests**

In `src/components/__tests__/ActionSection.test.tsx`, update the "shows a build button" test to set a rolled dice, and add a new test for the pre-roll case.

Replace the "shows a build button when on own buildable property" test:

```tsx
  it('shows a build button when on own buildable property after rolling', () => {
    let s = makeState()
    s = {
      ...s,
      players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
      board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
      dice: [2, 3],
    }
    const onBuild = vi.fn()
    render(<ActionSection state={s} {...actions} onBuild={onBuild} />)
    const btn = screen.getByRole('button', { name: /Bangun/ })
    btn.click()
    expect(onBuild).toHaveBeenCalledWith(8)
  })

  it('does not show a build button before the player has rolled', () => {
    let s = makeState()
    s = {
      ...s,
      players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
      board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
      dice: null,
    }
    render(<ActionSection state={s} {...actions} onBuild={() => {}} />)
    expect(screen.queryByRole('button', { name: /Bangun/ })).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/components/__tests__/ActionSection.test.tsx`
Expected: FAIL — the new "does not show before roll" test finds a `Bangun` button (current code ignores `dice`).

- [ ] **Step 3: Add the gate**

In `src/components/ActionSection.tsx`, change the `canBuild` condition to include the rolled-dice check:

```ts
  const canBuild =
    state.dice !== null &&
    space?.type === 'property' &&
    space.owner === state.currentPlayer &&
    space.houses < 5 &&
    !space.mortgaged &&
    space.id !== state.justBoughtSpaceId
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- src/components/__tests__/ActionSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && git add src/components/ActionSection.tsx src/components/__tests__/ActionSection.test.tsx && git commit -m "fix: require a dice roll before allowing house builds"
```

---

### Task 7: Free-jail card indicator (issue 6)

**Files:**
- Modify: `src/components/PlayerCard.tsx`
- Test: `src/components/__tests__/PlayerCard.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test**

In `src/components/__tests__/PlayerCard.test.tsx`, add:

```tsx
  it('shows a free-jail badge when the player holds the card', () => {
    render(<PlayerCard player={{ ...player, hasGetOutOfJailFree: true }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByTitle('Kartu Bebas Penjara')).toBeTruthy()
  })

  it('does not show the free-jail badge by default', () => {
    render(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.queryByTitle('Kartu Bebas Penjara')).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- src/components/__tests__/PlayerCard.test.tsx`
Expected: FAIL — no element with `title="Kartu Bebas Penjara"` exists.

- [ ] **Step 3: Add the badge**

In `src/components/PlayerCard.tsx`, in the name row (next to the `inJail`/`bankrupt` indicators), add:

```tsx
          {player.hasGetOutOfJailFree && <span title="Kartu Bebas Penjara">🎴</span>}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- src/components/__tests__/PlayerCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && git add src/components/PlayerCard.tsx src/components/__tests__/PlayerCard.test.tsx && git commit -m "feat: show a badge when a player holds a free-jail card"
```

---

### Task 8: Tooltip portal + viewport clamp (issue 7)

**Files:**
- Modify: `src/components/BoardGrid.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Portal to `document.body` and switch to top-left positioning**

In `src/components/BoardGrid.tsx`:

1. Change the `TooltipPos` type (near the top of the file) from:
   ```ts
   interface TooltipPos {
     top: number
     left: number
     transform: string
   }
   ```
   to:
   ```ts
   interface TooltipPos {
     top: number
     left: number
   }
   ```

2. Change the `useEffect` that sets `portalTarget` to:
   ```tsx
   useEffect(() => {
     setPortalTarget(document.body)
   }, [])
   ```

3. Add a ref near the other refs:
   ```tsx
   const tooltipRef = useRef<HTMLDivElement | null>(null)
   ```

4. Replace the `handleEnter` function with a version that computes an absolute top-left corner (no `transform`) and clamps it within the viewport:
   ```tsx
   function handleEnter(id: number, e: React.MouseEvent<HTMLDivElement>) {
     if (timerRef.current) clearTimeout(timerRef.current)
     setHoveredId(id)
     const rect = e.currentTarget.getBoundingClientRect()
     const pos = getCellPosition(id)
     const gap = TOOLTIP_MARGIN
     const tipW = tooltipRef.current?.offsetWidth ?? 260
     const tipH = tooltipRef.current?.offsetHeight ?? 300
     const vw = window.innerWidth
     const vh = window.innerHeight

     let top: number
     let left: number

     if (pos?.gridColumn === 11) {
       top = rect.top + rect.height / 2 - tipH / 2
       left = rect.left - gap - tipW
     } else if (pos?.gridColumn === 1) {
       top = rect.top + rect.height / 2 - tipH / 2
       left = rect.right + gap
     } else if (pos?.gridRow === 1) {
       top = rect.bottom + gap
       left = rect.left + rect.width / 2 - tipW / 2
     } else {
       top = rect.top - gap - tipH
       left = rect.left + rect.width / 2 - tipW / 2
     }

     top = Math.max(0, Math.min(top, vh - tipH))
     left = Math.max(0, Math.min(left, vw - tipW))

     setTooltipPos({ top, left })
   }
   ```

5. In the portaled tooltip wrapper, remove the `transform` from the inline `style` and attach the ref:
   ```tsx
         <div
           ref={tooltipRef}
           onMouseEnter={handleTooltipEnter}
           onMouseLeave={handleTooltipLeave}
           style={{
             position: 'fixed',
             top: tooltipPos.top,
             left: tooltipPos.left,
             zIndex: 999,
           }}
         >
   ```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`
Expected: hovering Bali (bottom-right) keeps the tooltip fully on screen with the "Jual ke Bank" / "Gadai" buttons visible and clickable. Also check Jakarta (left column) and the bottom row.

- [ ] **Step 3: Typecheck, lint, and full unit suite**

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/BoardGrid.tsx
git commit -m "fix: portal tooltip to body and clamp within viewport"
```

---

## Final verification

After all tasks:

```bash
npm run test:unit && npm run typecheck && npm run lint
```

Then manually spot-check the game in `npm run dev`: draw cards past a deck refill (un-scaled amounts gone), build button absent before rolling, Bali tooltip on-screen, free-jail badge visible, monopoly 2× rent announced, and verbose tax messages in the event log.
