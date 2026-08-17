# Monopoly 2× at All House Levels

## Problem

The monopoly 2× rent multiplier only fires when `houses === 0` (`gameReducer.ts:314`). Once you build a house, the multiplier silently vanishes. The UI even hides the "Complete group" notice at that point (`PropertyTooltip.tsx:77`). This makes building on a monopoly feel like a punishment — the reward for completing a color set disappears the moment you improve it.

## Goal

The 2× monopoly bonus should apply to **all** rent levels — base, houses, and hotel. Completing a color set is a meaningful advantage that persists through the property's lifecycle, not just at the unimproved state.

## Scope

Two source files, two test files. No new types, no new data.

## Design

### 1. Core logic — `src/logic/gameReducer.ts:314`

Remove the `space.houses === 0 &&` guard from the monopoly check:

```ts
// before
monopoly = space.houses === 0 && isMonopoly(space.owner, state.board, space);

// after
monopoly = isMonopoly(space.owner, state.board, space);
```

The `if (monopoly) rent *= 2;` line stays unchanged — it now doubles whatever `calculatePropertyRent(space)` returns at any house level.

### 2. Tooltip — `src/components/PropertyTooltip.tsx:77`

Remove the `space.houses === 0` guard so the "Complete group" notice always shows when the owner has the full set. Update the displayed amount to reflect the current doubled rent rather than always showing `rent[0] * 2`:

```tsx
// before
{space.type === SpaceType.Property && space.owner !== null && space.houses === 0 && isMonopoly(space.owner, state.board, space) && (
  <div ...>{t('tooltip.monopoly', { amount: formatMoney((space.rent?.[0] ?? 0) * 2) })}</div>
)}

// after
{space.type === SpaceType.Property && space.owner !== null && isMonopoly(space.owner, state.board, space) && (
  <div ...>{t('tooltip.monopoly', { amount: formatMoney(calculatePropertyRent(space) * 2) })}</div>
)}
```

Import `calculatePropertyRent` from `../logic/rent` (new import).

### 3. Tests

**`src/components/__tests__/PropertyTooltip.test.tsx`** — Update the existing monopoly notice test:

- Change the test to verify the notice appears **with houses present** (not just at 0 houses).
- Verify the amount reflects the current house-level rent × 2 (e.g., at 2 houses, the notice shows `rent[2] * 2`).
- Add a second assertion: notice still shows at 0 houses (regression guard).

**`src/logic/__tests__/gameReducer.test.ts`** — Add a new test:

- Set up: player 0 owns both brown properties (Salvador + Rio), player 1 lands on Rio with 1 house.
- Assert: pending rent = `rent[1] * 2` (Rio 1-house rent is 20, so expected 40).
- This confirms the 2× applies at house level > 0.

### 4. What does NOT change

- `src/logic/rent.ts` / `isMonopoly()` — unchanged
- `src/components/ActionSection.tsx` — building gate unchanged (building stays allowed without full set)
- `src/logic/bot.ts` — already requires monopoly to build; no change
- Railroads/utilities — different rent system, unaffected
- i18n keys — `tooltip.monopoly` text unchanged ("Complete group: rent 2x ({{amount}})")

### 5. Balance implications

Completing a set is now a much bigger deal:

| Set | 1 house (before) | 1 house (after) | Hotel (before) | Hotel (after) |
|-----|------------------|-----------------|----------------|---------------|
| Brown | $20 | **$40** | $450 | **$900** |
| Light blue | $30 | **$60** | $600 | **$1200** |
| Pink | $50 | **$100** | $1000 | **$2000** |
| Orange | $100 | **$200** | $1400 | **$2800** |
| Red | $150 | **$300** | $1700 | **$3400** |
| Yellow | $175 | **$350** | $1900 | **$3800** |
| Green | $200 | **$400** | $2000 | **$4000** |
| Dark blue | $200 | **$400** | $2000 | **$4000** |

## Verification

- `npm run typecheck` — no new type errors
- `npm run test:unit` — all tests pass (including updated/new tests)
- Manual: own both brown properties, build a house on Salvador, land on it as the other player — rent should be $20 (1-house rent) × 2 = $40
