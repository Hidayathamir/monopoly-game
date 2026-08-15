# Gameplay Economics & UX Fixes — Design

Date: 2026-08-15
Status: Approved (pending implementation plan)

## Summary

Eight gameplay/economics/UX fixes, consolidated from an event-log review:

1. Card amounts (Dana Umum / Kesempatan) sometimes pay raw "Rp 25" instead of the scaled amount.
2. Selling assets should be more generous than mortgaging, and a fully-mortgaged player should still be able to liquidate.
3. Owning a complete color group should double base rent, and players must be told.
4. The "Bangun" (build) button appears before the player has rolled the dice.
5. Income/luxury tax logic is opaque; income tax should be 10% of total assets.
6. There is no way to see whether a player holds a "Bebas Penjara" card.
7. The Bali tooltip renders off-screen so its buttons are unclickable.
8. Dana Umum & Kesempatan cards are hardcoded in TypeScript instead of a JSON config.

## Economic rates (single source of truth)

Added to `src/data/game-config.json` (all raw; scaled by `priceMultiplier`):

| Key | Value | Meaning |
| --- | --- | --- |
| `incomeTaxRate` | `0.1` | Income tax = 10% of total assets |
| `mortgageRate` | `0.5` | Mortgage pays 50% of price |
| `sellRate` | `0.75` | Direct sell-to-bank pays 75% of price |
| `mortgagedSellExtra` | `0.1` | Selling an already-mortgaged property pays +10% of price on top of the mortgage already received |
| `houseSellRate` | `0.75` | Selling a house/hotel refunds 75% of its build cost |

Rationale (issue 2): a direct sale nets 75%. Mortgage already paid 50%; selling a
mortgaged property adds only 10% more, for a total of 60% — so "mortgage then sell"
(60%) clearly hurts more than selling directly (75%).

## Design by issue

### Issue 1 & 8 — Cards to JSON + central scaling

- New file `src/data/cards-data.json`:
  ```json
  {
    "chance":  [ { "id": 1, "description": "...", "effect": { "action": "goToSpace", "spaceId": 0 } }, ... ],
    "community": [ { "id": 101, "description": "...", "effect": { "action": "pay", "amount": 25 } }, ... ]
  }
  ```
  Amounts stay raw (pre-multiplier), mirroring `board-data.json`'s raw values.
- `src/data/cards.ts` becomes the sole loader: reads the JSON, infers `type`
  (`chance`/`community`), and scales `amount` / `perHouse` / `perHotel` by
  `config.priceMultiplier` once at module load. Exports `CHANCE_CARDS` and
  `COMMUNITY_CARDS` (already scaled).
- `src/logic/gameReducer.ts`: delete the local `scaleCards` helper and the
  `import config` if unused; `createInitialState` and the `DrawCard` refill path
  both use the already-scaled `CHANCE_CARDS` / `COMMUNITY_CARDS` constants.

Result: no code path can produce un-scaled card amounts.

### Issue 2 — Selling more generous than mortgage + sell mortgaged property

- `SellProperty` reducer (`src/logic/gameReducer.ts`):
  - Remove the `space.mortgaged || space.houses > 0` early-return so a mortgaged
    property can be sold (houses still must be 0).
  - Compute payout from config:
    - unmortgaged: `floor(price * sellRate)`
    - mortgaged: `floor(price * mortgagedSellExtra)`
  - After sale: `owner = null`, `mortgaged = false`, remove from `properties`.
- `SellHouse` reducer: refund `floor(houseCost * houseSellRate)` (was `/2`).
- `Mortgage` / `Unmortgage` unchanged (50% / 55%).
- `PropertyTooltip.tsx`: show "Jual ke Bank" for mortgaged properties too, with
  the correct payout label (`+10%` for mortgaged).

### Issue 3 — Monopoly 2× rent + notice

- Add `isMonopoly(ownerId, board, space)` (in `src/logic/rent.ts`): returns true
  when every `property`-type space sharing `space.color` is owned by `ownerId`.
- In `ResolveSpace` property branch (`gameReducer.ts`), when rent is computed for
  a property with `space.houses === 0` and `isMonopoly(...)` is true, rent = base × 2.
- `PropertyTooltip.tsx`: when the current owner has a monopoly on the color and
  the space has 0 houses, show a highlighted "Komplek lengkap: sewa 2×" line and
  the doubled base figure.
- Event log on rent payment includes the 2× marker (e.g. "sewa 2× (komplek lengkap)").

### Issue 4 — No build before roll

- `ActionSection.tsx`: add `state.dice !== null` to the `canBuild` condition, so
  the "Bangun" button only appears after the player has rolled this turn.

### Issue 5 — Tax verbose + 10% income

- `board-data.json`: tag the two tax spaces with `"taxType": "income"` (id 4) and
  `"taxType": "luxury"` (id 38). Luxury keeps `"price": 100` as its flat, scaled amount.
- `Space` type (`src/types/game.ts`): add optional `taxType?: 'income' | 'luxury'`.
- `createInitialBoard` (`src/data/board.ts`): pass `taxType` through.
- New `getPlayerNetWorth(player, board)` in `src/logic/rent.ts`: cash + sum of
  owned property prices + total house investment (purchase, not liquidation).
- `ResolveSpace` Tax branch:
  - income: `tax = floor(netWorth * incomeTaxRate)`
  - luxury: `tax = space.price` (scaled)
  - log message includes the breakdown, e.g. `"membayar pajak penghasilan Rp X (10% dari total aset Rp Y)"`.
- `PropertyTooltip.tsx`: for tax spaces, render the rule ("Bayar 10% dari total aset" / "Bayar Rp 100 Juta").

### Issue 6 — Free-jail card indicator

- `PlayerCard.tsx`: show a "🎴" badge next to the name when
  `player.hasGetOutOfJailFree` (with a `title` tooltip "Kartu Bebas Penjara").
- `PlayerPopup` also lists "Kartu Bebas Penjara" when held.

### Issue 7 — Tooltip clipping on Bali

- `BoardGrid.tsx`: portal the tooltip to `document.body` (like `PlayerCard`),
  instead of `[data-game-board]` (whose `overflow-hidden` can clip it).
- Add viewport clamping: measure the tooltip's rendered size and flip/clamp its
  anchor so it stays fully inside the viewport (Bali is bottom-right, so it should
  open left/up rather than center). Ensures the sell/gadai buttons remain clickable.

## Files touched

- `src/data/game-config.json` (new economic keys)
- `src/data/cards-data.json` (new)
- `src/data/cards.ts` (loader + scaling)
- `src/data/board-data.json` (`taxType` tags)
- `src/data/board.ts` (pass `taxType`, expose config values)
- `src/types/game.ts` (`Space.taxType`)
- `src/logic/gameReducer.ts` (card scaling removal, tax, sell, build-rent monopoly)
- `src/logic/rent.ts` (`isMonopoly`, `getPlayerNetWorth`)
- `src/components/ActionSection.tsx` (build gating)
- `src/components/PropertyTooltip.tsx` (tax/monopoly/sell labels)
- `src/components/PlayerCard.tsx` (free-jail badge)
- `src/components/BoardGrid.tsx` (tooltip portal + clamp)

## Testing

- `src/logic/__tests__/rent.test.ts`: monopoly 2× rent, net-worth calc.
- `src/logic/__tests__/cards.test.ts`: JSON-derived cards are scaled; refill uses scaled cards.
- `src/logic/__tests__/gameReducer.test.ts`: tax (income/luxury), sell (direct vs
  mortgaged payouts), build gating, sell-house refund.
- `src/components/__tests__/PropertyTooltip.test.tsx` / `PlayerCard.test.tsx` /
  `ActionSection.test.tsx`: new labels/badges/gating.

## Out of scope

- Mortgage/unmortgage percentages (unchanged: 50% / 55%).
- Trade mechanics.
- Board layout / styling beyond the tooltip fix.
