# Monopoly Game — Indonesian Edition (React)

**Date**: 2026-08-11
**Stack**: React 19 + TypeScript + Vite 8, plain CSS (no external libs)

## Scope

2-4 player pass-and-play Monopoly on a single device. Indonesian cities replace classic Atlantic City properties. No backend — all state in React `useReducer`.

## Rules

| Rule | Behavior |
|------|----------|
| Players | 2-4, pass-and-play single device |
| Dice | 2d6. Rolling doubles grants an extra turn. |
| Buying | Land on unowned property → offered to buy at listed price |
| Auction | None. If not bought, property stays unowned. |
| Rent | Land on another's property → pay rent (scales with houses/hotel) |
| Building | Land on your own property → offered to build house/hotel. No color group required. No global supply limits. Max 4 houses → then hotel. |
| Selling houses | Sell to bank at half the purchase price. Hotel reverts to 4 houses. |
| Mortgaging | Mortgage property to bank for half its price. Must repay mortgage + 10% interest to unmortgage. No rent collected on mortgaged properties. |
| Trading | Propose offer (properties + cash) ↔ request (properties + cash). Other player accepts or rejects. |
| Chance / Dana Umum | Draw card, resolve immediately. ~10 cards each deck. |
| GO | Collect $200 when passing or landing on GO. |
| Jail | Only "Masuk Penjara" space sends you there. Token moves to jail. Must roll doubles to get out. Max 3 attempts. Cannot pay to leave. While jailed, you collect no rent. Can still trade, mortgage, build. |
| Free Parking | Jackpot — all tax/fine/penalty money accumulates. Player landing on it collects the pot. |
| Bankruptcy | Can't pay debt → must sell houses, mortgage, liquidate to raise money. If still can't pay → bankrupt, eliminated, properties return to bank (unowned, no houses). |
| Winning | Last player remaining wins. |

## Architecture

### State Management

Single `useReducer` with a clean state machine. No routing — everything is a phase within the reducer.

### Game State

```ts
type GameState = {
  phase: 'setup' | 'rolling' | 'moving' | 'resolving' | 'buying' | 'building' | 'gameOver';
  players: Player[];
  currentPlayer: number;
  board: Space[];
  chanceDeck: Card[];
  communityDeck: Card[];
  freeParkingPot: number;
  dice: [number, number];
  doublesCount: number;
  eventLog: string[];
};

type Player = {
  id: number;
  name: string;
  money: number;
  position: number;
  properties: number[];
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  hasGetOutOfJailFree: boolean;
};

type Space = {
  id: number;
  name: string;
  type: 'property' | 'railroad' | 'utility' | 'chance' | 'community' | 'tax' | 'go' | 'jail' | 'goToJail' | 'freeParking';
  price?: number;
  rent?: number[];
  houseCost?: number;
  color?: string;
  owner?: number;
  houses: number;
  mortgaged: boolean;
};
```

### Turn Sequence

1. **Roll** → 2d6, show dice result, check doubles
2. **Move** → animate token step-by-step, $200 if passing GO
3. **Resolve space** (based on type):
   - `property` (owned by other) → pay rent
   - `property` (unowned) → prompt to buy
   - `property` (own) → prompt to build
   - `railroad` / `utility` → pay rent (scales by count owned)
   - `chance` / `community` → draw card, resolve
   - `tax` → pay to Free Parking pot
   - `goToJail` → send to jail
   - `freeParking` → collect pot
   - `go` → collect $200
   - `jail` → just visiting
4. **Actions** → player can build, sell houses, mortgage, trade at any point in their turn
5. **End Turn** → next player (if doubles rolled, same player rolls again, unless it's 3rd double = jail)

### Component Tree

```
App
├── GameSetup          (player count + names)
├── GameBoard
│   ├── BoardGrid      (CSS grid of 40 spaces with Indonesian city names)
│   ├── PlayerTokens   (colored tokens on board spaces)
│   └── PropertyCard   (hover tooltip with property details)
├── Sidebar
│   ├── DiceRoller     (animated dice + roll button)
│   ├── ActionButtons  (buy, build, sell, mortgage, trade, end turn)
│   └── PlayerPanel    (money, properties, current player highlight)
├── Modals
│   ├── BuyPropertyModal
│   ├── BuildModal
│   ├── TradeModal
│   ├── MortgageModal
│   ├── CardModal       (Chance/Dana Umum)
│   ├── BankruptcyModal
│   └── GameOverModal
└── EventLog           (scrollable action history)
```

## Board Data — Indonesian Edition

### Property Tiers

| Color | Cities | Price | Rent Base → Hotel | House Cost |
|-------|--------|-------|-------------------|------------|
| Brown | Cirebon, Tegal | $60 | $4 → $450 | $50 |
| Light Blue | Pekalongan, Semarang, Surakarta | $100-$120 | $6 → $600 | $50 |
| Pink | Malang, Surabaya, Denpasar | $140-$160 | $10 → $900 | $100 |
| Orange | Yogyakarta, Bandung, Medan | $180-$200 | $14 → $1000 | $100 |
| Red | Palembang, Makassar, Balikpapan | $220-$240 | $18 → $1100 | $150 |
| Yellow | Manado, Pontianak, Banjarmasin | $260-$280 | $22 → $1200 | $150 |
| Green | Batam, Padang, Bogor | $300-$320 | $26 → $1300 | $200 |
| Dark Blue | Jakarta, Bali | $350-$400 | $35 → $2000 | $200 |

### Railroads (Stasiun)
Gambir, Pasar Senen, Tanjung Priok, Soekarno-Hatta — $200 each. Rent: $25 / $50 / $100 / $200 based on count owned.

### Utilities
PLN (Listrik), PDAM (Air) — $150 each. Rent: 4× dice roll if one owned, 10× if both.

### Board Order (40 spaces)
0=MULAI, 1=Cirebon, 2=Dana Umum, 3=Tegal, 4=Pajak Penghasilan ($200), 5=Gambir, 6=Pekalongan, 7=Kesempatan, 8=Semarang, 9=Surakarta, 10=Penjara, 11=Malang, 12=PLN, 13=Surabaya, 14=Denpasar, 15=Pasar Senen, 16=Yogyakarta, 17=Dana Umum, 18=Bandung, 19=Medan, 20=Parkir Gratis, 21=Palembang, 22=Kesempatan, 23=Makassar, 24=Balikpapan, 25=Tanjung Priok, 26=Manado, 27=Pontianak, 28=PDAM, 29=Banjarmasin, 30=Masuk Penjara, 31=Batam, 32=Padang, 33=Dana Umum, 34=Bogor, 35=Soekarno-Hatta, 36=Kesempatan, 37=Jakarta, 38=Pajak Mewah ($100), 39=Bali

## Chance / Dana Umum Cards (~10 each)

**Kesempatan (Chance)**: go to space, collect/pay money, go to jail, get out of jail free, street repairs, advance to GO, birthday money.

**Dana Umum (Community Chest)**: collect/pay money, go to jail, get out of jail free, bank error, hospital fees, school fees, life insurance, beauty contest.

## Edge Cases

- Landing exactly on GO → collect $200 (not double)
- Mortgaged properties: no rent, no building, must repay +10% to unmortgage
- Bankruptcy: cannot trade with other players as bankruptcy resolution (too complex). Must sell/mortgage to bank.
- Player in jail can still trade, buy/sell houses, mortgage, collect from unmortgaged properties? No — rule says no rent collection while jailed.
- Three doubles in a row → jail (even if not on "Masuk Penjara" space)
- Property with houses cannot be mortgaged until houses are sold
- Property with houses cannot be traded — houses must be sold to bank first

## File Structure

```
src/
├── main.tsx
├── App.tsx
├── App.css
├── data/
│   ├── board.ts          (40 spaces data)
│   ├── chanceCards.ts
│   └── communityCards.ts
├── types/
│   └── game.ts           (all type definitions)
├── logic/
│   ├── gameReducer.ts    (useReducer logic + actions)
│   ├── rent.ts           (rent calculation)
│   └── cards.ts          (card effect resolution)
├── components/
│   ├── GameSetup.tsx
│   ├── GameBoard.tsx
│   ├── BoardGrid.tsx
│   ├── PlayerTokens.tsx
│   ├── Sidebar.tsx
│   ├── DiceRoller.tsx
│   ├── ActionButtons.tsx
│   ├── PlayerPanel.tsx
│   ├── EventLog.tsx
│   ├── Modals/
│   │   ├── BuyPropertyModal.tsx
│   │   ├── BuildModal.tsx
│   │   ├── TradeModal.tsx
│   │   ├── MortgageModal.tsx
│   │   ├── CardModal.tsx
│   │   ├── BankruptcyModal.tsx
│   │   └── GameOverModal.tsx
│   └── PropertyCard.tsx
├── hooks/
│   └── useGame.ts        (wraps useReducer)
└── styles/
    └── board.css
```

## Testing

Unit tests for:
- Rent calculation by property tier + houses
- Mortgage/unmortgage logic
- Jail mechanics (max 3 turns, doubles to escape)
- Bankruptcy resolution
- Railroad/utility rent
- Card effects

Component tests with `@testing-library/react` for key modals and actions.
