# Monopoly 2× at All House Levels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the monopoly 2× rent multiplier apply at all house levels, not just when `houses === 0`.

**Architecture:** Remove one guard (`space.houses === 0`) from two locations — the reducer that charges rent and the tooltip that displays it. Add a new gameReducer test to cover the previously-untested monopoly-with-houses path.

**Tech Stack:** TypeScript, React, Vitest

## Global Constraints

- No TypeScript enums (`erasableSyntaxOnly: true`); use `const` objects + union types
- `verbatimModuleSyntax: true` → type-only imports use `import type`
- i18n keys must exist in both `en` and `id` translation files (no change needed here — existing key reused)
- Run `npm run typecheck` and `npm run test:unit` after changes

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/logic/gameReducer.ts:314` | Modify | Remove `space.houses === 0 &&` from monopoly guard |
| `src/logic/__tests__/gameReducer.test.ts` | Modify | Add test: monopoly with 1 house pays `rent[1] * 2` |
| `src/components/PropertyTooltip.tsx:77` | Modify | Remove `space.houses === 0` guard; import + use `calculatePropertyRent` |
| `src/components/__tests__/PropertyTooltip.test.tsx:33` | Modify | Update test to cover monopoly notice with houses |

---

### Task 1: Reducer — monopoly 2× at all house levels

**Files:**
- Modify: `src/logic/gameReducer.ts:314`
- Modify: `src/logic/__tests__/gameReducer.test.ts`

**Interfaces:**
- Consumes: `isMonopoly(ownerId, board, space)` from `src/logic/rent.ts` (unchanged)
- Produces: rent amount in `PendingActionType.PayRent` — now `calculatePropertyRent(space) * 2` when monopoly, regardless of house count

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('land on property')` block in `src/logic/__tests__/gameReducer.test.ts`, after the railroad/utility tests (around line 894):

```ts
it('monopoly with houses → rent doubled', () => {
  let state = makeStartedState();
  // player 1 owns both brown properties (Salvador=1, Rio=3)
  state = buyProperty(state, 1, 1);
  state = buyProperty(state, 1, 3);
  // build 1 house on Rio
  state = { ...state, board: state.board.map((s) => (s.id === 3 ? { ...s, houses: 1 } : s)) };
  // player 0 lands on Rio
  state = setPosition(state, 0, 3);
  state = { ...state, phase: GamePhase.Resolving, dice: [1, 2] };

  const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
  // Rio 1-house rent = 20, doubled by monopoly = 40
  expect(s1.pendingAction?.type).toBe(PendingActionType.PayRent);
  expect((s1.pendingAction as Record<string, unknown>)?.amount).toBe(40);
});
```

Also add this helper near the top of the file if `buyProperty` and `setPosition` are not already defined (they appear to be — verify before adding):

```ts
function buyProperty(state: GameState, playerId: number, spaceId: number): GameState {
  return gameReducer(
    { ...state, currentPlayer: playerId, phase: GamePhase.Buying, pendingAction: { type: PendingActionType.BuyProperty, spaceId } },
    { type: GameActionType.BuyProperty }
  );
}

function setPosition(state: GameState, playerId: number, position: number): GameState {
  const players = [...state.players];
  players[playerId] = { ...players[playerId], position };
  return { ...state, players };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts -t "monopoly with houses"`
Expected: FAIL — rent is 20 (not doubled), not 40

- [ ] **Step 3: Implement the reducer change**

In `src/logic/gameReducer.ts`, line 314, change:

```ts
// before
monopoly = space.houses === 0 && isMonopoly(space.owner, state.board, space);

// after
monopoly = isMonopoly(space.owner, state.board, space);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts -t "monopoly with houses"`
Expected: PASS

- [ ] **Step 5: Run full reducer test suite**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: all tests pass (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/logic/gameReducer.ts src/logic/__tests__/gameReducer.test.ts
git commit -m "feat: apply monopoly 2x rent at all house levels"
```

---

### Task 2: Tooltip — show monopoly notice with houses

**Files:**
- Modify: `src/components/PropertyTooltip.tsx:77`
- Modify: `src/components/__tests__/PropertyTooltip.test.tsx:33`

**Interfaces:**
- Consumes: `calculatePropertyRent(space)` from `src/logic/rent.ts` (new import)
- Consumes: `isMonopoly(ownerId, board, space)` from `src/logic/rent.ts` (existing import)
- Produces: UI text "Complete group: rent 2x ($X)" where X is the current doubled rent

- [ ] **Step 1: Write the failing test**

Replace the existing monopoly test in `src/components/__tests__/PropertyTooltip.test.tsx` (line 33) with:

```ts
it('shows monopoly 2x notice when owner has full color group', () => {
  const s = makeState(100)
  const board = s.board.map((b) => {
    if (b.color === '#8B4513' && b.type === 'property') return { ...b, owner: 0 }
    return b
  })
  // 0 houses — notice shows
  const space0 = { ...board[1], houses: 0, owner: 0 }
  const { unmount } = renderWithProviders(
    <PropertyTooltip space={space0} state={{ ...s, board }} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />
  )
  expect(screen.getByText(/Complete group/)).toBeTruthy()
  unmount()

  // 2 houses — notice still shows
  const space2 = { ...board[1], houses: 2, owner: 0 }
  renderWithProviders(
    <PropertyTooltip space={space2} state={{ ...s, board }} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />
  )
  expect(screen.getByText(/Complete group/)).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/PropertyTooltip.test.tsx -t "shows monopoly 2x notice"`
Expected: FAIL at the "2 houses" assertion — notice doesn't appear when `houses > 0`

- [ ] **Step 3: Implement the tooltip change**

In `src/components/PropertyTooltip.tsx`:

**a)** Add import at the top (after existing `rent` import line 5):

```ts
import { isMonopoly, calculatePropertyRent } from '../logic/rent'
```

(Remove `isMonopoly` from the existing import if it's there alone, or just add `calculatePropertyRent` to the existing import.)

**b)** At line 77, change:

```tsx
// before
{space.type === SpaceType.Property && space.owner !== null && space.houses === 0 && isMonopoly(space.owner, state.board, space) && (
  <div className="my-1 p-1 bg-bg-darker rounded text-sm text-gold font-semibold">
    {t('tooltip.monopoly', { amount: formatMoney((space.rent?.[0] ?? 0) * 2) })}
  </div>
)}

// after
{space.type === SpaceType.Property && space.owner !== null && isMonopoly(space.owner, state.board, space) && (
  <div className="my-1 p-1 bg-bg-darker rounded text-sm text-gold font-semibold">
    {t('tooltip.monopoly', { amount: formatMoney(calculatePropertyRent(space) * 2) })}
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/PropertyTooltip.test.tsx -t "shows monopoly 2x notice"`
Expected: PASS

- [ ] **Step 5: Run full tooltip test suite**

Run: `npx vitest run src/components/__tests__/PropertyTooltip.test.tsx`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/PropertyTooltip.tsx src/components/__tests__/PropertyTooltip.test.tsx
git commit -m "feat: show monopoly 2x notice at all house levels in tooltip"
```

---

### Task 3: Final verification

**Files:** None modified — verification only

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 2: Full unit test suite**

Run: `npm run test:unit`
Expected: all tests pass

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors (2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx` are expected)
