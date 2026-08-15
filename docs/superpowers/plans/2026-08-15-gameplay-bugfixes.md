# Gameplay Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four gameplay bugs — token animating backward on forward card moves, cards not setting `passedGo`, building available too early, and an incomplete jail pay option — plus make the center panel fit the board on phone screens.

**Architecture:** Two new signed/flag fields on the shared `GameState` (`lastMoveSteps`, `justBoughtSpaceId`) drive correct animation and build gating in both local and multiplayer (the reducer + cards logic are shared). `PlayerTokens` animates in the recorded direction instead of guessing.

**Tech Stack:** React 19 + TypeScript + Vite 8; Node.js `ws` server; Vitest (jsdom via `// @vitest-environment jsdom`); Playwright.

## Global Constraints

- TypeScript `verbatimModuleSyntax` ON (`import type`); `erasableSyntaxOnly` ON; `noUnusedLocals`/`noUnusedParameters` ON.
- UI copy is Indonesian.
- Server code must not import DOM modules.
- Existing unit + e2e suites stay green.
- New `GameState` fields are additive; bump `STATE_VERSION` in `useGame.ts` from 4 to 5 so stale saved states are invalidated.

---

### Task 1: Movement direction + GO-pass correctness (issues 1a + 1b)

**Files:**
- Modify: `src/types/game.ts` (add `lastMoveSteps: number | null` to `GameState`)
- Modify: `src/logic/gameReducer.ts` (init + set `lastMoveSteps` in `DiceAnimated`/`ResolveSpace`)
- Modify: `src/logic/cards.ts` (`goToSpace` direction + `passedGo` + `lastMoveSteps`)
- Modify: `src/hooks/useGame.ts` (bump `STATE_VERSION` to 5)
- Modify: `src/components/PlayerTokens.tsx` (direction-aware `getPath`, export it)
- Test: `src/logic/__tests__/gameReducer.test.ts` (add cases)
- Test: `src/logic/__tests__/cards.test.ts` (add cases)
- Test: `src/components/__tests__/PlayerTokens.test.tsx` (new)

**Interfaces:**
- Produces: `GameState.lastMoveSteps: number | null` (signed: `+N` forward, `-N` backward, `null` teleport); `getPath(from, to, backward)` exported from `PlayerTokens.tsx`.

- [ ] **Step 1: Add the field to GameState**

In `src/types/game.ts`, add to the `GameState` type (near `doublesCount`):

```ts
lastMoveSteps: number | null;
```

In `src/logic/gameReducer.ts` `createInitialState()`, add `lastMoveSteps: null,` to the returned object.

- [ ] **Step 2: Set lastMoveSteps in dice moves**

In `src/logic/gameReducer.ts`, add `lastMoveSteps` to each `DiceAnimated` return and the `ResolveSpace` GoToJail return:

- Jail escape via doubles (`phase: Moving`): add `lastMoveSteps: total,`
- Forced jail exit (`phase: Moving`): add `lastMoveSteps: total,`
- Jail escape failed (`phase: Waiting`, player unchanged): add `lastMoveSteps: null,`
- Three doubles → jail (`phase: Waiting`, `position: JAIL_SPACE`): add `lastMoveSteps: null,`
- Normal move (`phase: Moving`): add `lastMoveSteps: total,`

In the `ResolveSpace` `GoToJail` return (`position: JAIL_SPACE`): add `lastMoveSteps: null,`.

- [ ] **Step 3: Fix goToSpace (direction + passedGo + lastMoveSteps)**

In `src/logic/cards.ts`, refactor the `GoToSpace` case and `goToSpace`:

```ts
case CardActionType.GoToSpace: {
  const isBackward = effect.spaceId < 0;
  const targetSpace = isBackward
    ? (player.position + effect.spaceId + 40) % 40
    : effect.spaceId;
  return goToSpace(newState, state.currentPlayer, targetSpace, isBackward);
}
```

```ts
function goToSpace(state: GameState, playerIndex: number, spaceId: number, isBackward: boolean): CardResolution {
  const player = state.players[playerIndex];
  let newState = { ...state };
  let message = '';

  const passesGo = !isBackward && spaceId < player.position;
  if (passesGo) {
    newState = updatePlayerMoney(newState, playerIndex, GO_SALARY);
    newState = setPlayerPassedGo(newState, playerIndex);
    message += `${player.name} melewati MULAI, dapat ${formatMoney(GO_SALARY)}. `;
  }

  const steps = isBackward ? spaceId - player.position : (spaceId - player.position + 40) % 40;
  const newPlayers = [...newState.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], position: spaceId };
  newState = { ...newState, players: newPlayers, lastMoveSteps: steps };

  const spaceName = state.board[spaceId].name;
  message += `${player.name} ${isBackward ? 'mundur' : 'maju'} ke ${spaceName}.`;

  return { state: newState, message };
}

function setPlayerPassedGo(state: GameState, playerIndex: number): GameState {
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], passedGo: true };
  return { ...state, players: newPlayers };
}
```

In `sendPlayerToJail`, add `lastMoveSteps: null` to the returned state.

- [ ] **Step 4: Direction-aware getPath**

In `src/components/PlayerTokens.tsx`, replace `getPath` and export it:

```ts
export function getPath(from: number, to: number, backward: boolean): number[] {
  if (from === to) return []
  const steps = backward ? (from - to + 40) % 40 : (to - from + 40) % 40
  const path: number[] = []
  let current = from
  for (let i = 0; i < steps; i++) {
    current = backward ? (current - 1 + 40) % 40 : (current + 1) % 40
    path.push(current)
  }
  return path
}
```

In the `useEffect` where `getPath` is called, use the recorded direction:

```ts
const backward = (state.lastMoveSteps ?? 0) < 0
const path = getPath(displayPositions[player.id] ?? prevTarget, player.position, backward)
```

- [ ] **Step 5: Write the failing tests**

Add to `src/logic/__tests__/gameReducer.test.ts`:

```ts
it('records forward lastMoveSteps on a dice move', () => {
  const state = makeStartedState()
  const s1 = gameReducer(state, { type: GameActionType.RollDice })
  const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 4] })
  expect(s2.lastMoveSteps).toBe(7)
})
```

Add to `src/logic/__tests__/cards.test.ts` (reusing its existing `makeState(overrides)` helper, whose players have `money: 500000`):

```ts
it('a forward card that wraps sets passedGo and positive lastMoveSteps', () => {
  const state = makeState({ players: [{ ...makeState().players[0], position: 7, passedGo: false }] })
  const card: Card = { id: 4, description: 'Majulah ke Stasiun Gambir.', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } }
  const result = resolveCardEffect(state, card)
  expect(result.state.players[0].passedGo).toBe(true)
  expect(result.state.players[0].money).toBe(500000 + GO_SALARY)
  expect(result.state.lastMoveSteps).toBe(38) // (5 - 7 + 40) % 40
})

it('a backward card sets negative lastMoveSteps and no passedGo', () => {
  const state = makeState({ players: [{ ...makeState().players[0], position: 20, passedGo: false }] })
  const card: Card = { id: 10, description: 'Mundurlah 3 langkah.', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } }
  const result = resolveCardEffect(state, card)
  expect(result.state.players[0].position).toBe(17)
  expect(result.state.players[0].passedGo).toBe(false)
  expect(result.state.players[0].money).toBe(500000) // no GO salary on a backward move
  expect(result.state.lastMoveSteps).toBe(-3)
})
```

Create `src/components/__tests__/PlayerTokens.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { getPath } from '../PlayerTokens'

describe('getPath', () => {
  it('walks forward wrapping past GO', () => {
    expect(getPath(7, 5, false)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 0, 1, 2, 3, 4, 5])
  })
  it('walks backward', () => {
    expect(getPath(20, 17, true)).toEqual([19, 18, 17])
  })
  it('returns empty for no move', () => {
    expect(getPath(10, 10, false)).toEqual([])
  })
})
```

**Cross-cutting (required for typecheck):** `GameState` gains a required field, so the full `GameState` object-literal helpers in `src/logic/__tests__/cards.test.ts` (`makeState`) and `src/components/__tests__/TurnHeader.test.tsx` (`makeState`) must add `lastMoveSteps: null,` to their base object in this task.

- [ ] **Step 6: Run tests (expect FAIL), implement, re-run (expect PASS)**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/components/__tests__/PlayerTokens.test.tsx && npm run typecheck`
Expected: the new tests pass (and the refactor is already in place from Steps 1–4).

- [ ] **Step 7: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/logic/cards.ts src/hooks/useGame.ts src/components/PlayerTokens.tsx src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/components/__tests__/PlayerTokens.test.tsx
git commit -m "fix: correct token move direction and set passedGo on card GO-pass"
```

---

### Task 2: Build only on a later visit (issue 2)

**Files:**
- Modify: `src/types/game.ts` (add `justBoughtSpaceId: number | null`)
- Modify: `src/logic/gameReducer.ts` (init; set on `BUY_PROPERTY`, clear on `ROLL_DICE`)
- Modify: `src/components/ActionSection.tsx` (exclude just-bought property from `canBuild`)
- Test: `src/logic/__tests__/gameReducer.test.ts` (add case)
- Test: `src/components/__tests__/ActionSection.test.tsx` (add case)

- [ ] **Step 1: Add field + reducer wiring**

In `src/types/game.ts` `GameState`, add `justBoughtSpaceId: number | null;`.

In `src/logic/gameReducer.ts` `createInitialState()`, add `justBoughtSpaceId: null,`.

In the `BUY_PROPERTY` return, add `justBoughtSpaceId: pending.spaceId,`.

In the `ROLL_DICE` return, add `justBoughtSpaceId: null,`.

**Cross-cutting (required for typecheck):** also add `justBoughtSpaceId: null,` to the `makeState` helpers in `src/logic/__tests__/cards.test.ts` and `src/components/__tests__/TurnHeader.test.tsx`.

- [ ] **Step 2: Gate the build button**

In `src/components/ActionSection.tsx`, extend `canBuild`:

```ts
const canBuild =
  space?.type === 'property' &&
  space.owner === state.currentPlayer &&
  space.houses < 5 &&
  !space.mortgaged &&
  space.id !== state.justBoughtSpaceId
```

- [ ] **Step 3: Write the failing tests**

Add to `src/logic/__tests__/gameReducer.test.ts`:

```ts
it('tracks justBoughtSpaceId between buy and next roll', () => {
  let state = makeStartedState()
  state = setPosition(state, 0, 1)
  state = { ...state, phase: GamePhase.Buying, pendingAction: { type: PendingActionType.BuyProperty, spaceId: 1 } }
  const bought = gameReducer(state, { type: GameActionType.BuyProperty })
  expect(bought.justBoughtSpaceId).toBe(1)
  const rolled = gameReducer(bought, { type: GameActionType.RollDice })
  expect(rolled.justBoughtSpaceId).toBeNull()
})
```

Add to `src/components/__tests__/ActionSection.test.tsx`:

```tsx
it('hides build button on a just-bought property', () => {
  let s = makeState()
  s = {
    ...s,
    players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
    board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
    justBoughtSpaceId: 8,
  }
  render(<ActionSection state={s} {...actions} onBuild={() => {}} />)
  expect(screen.queryByRole('button', { name: /Bangun/ })).toBeNull()
})
```

- [ ] **Step 4: Run (expect FAIL), implement, re-run (expect PASS)**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts src/components/__tests__/ActionSection.test.tsx && npm run typecheck`
Expected: PASS after Steps 1–2.

- [ ] **Step 5: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/components/ActionSection.tsx src/logic/__tests__/gameReducer.test.ts src/components/__tests__/ActionSection.test.tsx
git commit -m "fix: allow building only on a later visit"
```

---

### Task 3: Jail pay option from the first turn (issue 4)

**Files:**
- Modify: `src/components/ActionSection.tsx`
- Test: `src/components/__tests__/ActionSection.test.tsx` (add case)

- [ ] **Step 1: Write the failing test**

Add to `src/components/__tests__/ActionSection.test.tsx`:

```tsx
it('shows the pay option on the first turn in jail', () => {
  let s = makeState()
  s = { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, inJail: true, position: 10, jailTurns: 0 } : p) }
  render(<ActionSection state={s} {...actions} />)
  expect(screen.getByRole('button', { name: /Bayar/ })).toBeVisible()
})
```

- [ ] **Step 2: Run (expect FAIL)**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx`
Expected: FAIL — no "Bayar" button when `jailTurns === 0`.

- [ ] **Step 3: Implement**

In `src/components/ActionSection.tsx`, replace the jail branch so the pay button (and the "atau lempar dadu ganda (Nx lagi)" hint) always render when `player.inJail`, removing the `jailTurns > 0` / `=== 0` split:

```tsx
{player.inJail ? (
  <>
    <p className="text-base text-muted text-center mt-1">Di Penjara — pilih:</p>
    {player.hasGetOutOfJailFree && (
      <Button variant="success" size="sm" onClick={onUseGetOutOfJailFree}>
        🎴 Gunakan Kartu Bebas Penjara
      </Button>
    )}
    <Button variant="success" size="sm" onClick={onPayJailFine} disabled={player.money < JAIL_FINE}>
      Bayar {formatMoney(JAIL_FINE)}
    </Button>
    {player.money < JAIL_FINE && (
      <p className="text-base text-muted text-center mt-1">Uang tidak cukup</p>
    )}
    <p className="text-base text-muted text-center mt-1">
      atau lempar dadu ganda ({3 - player.jailTurns}x lagi)
    </p>
  </>
) : ...}
```

- [ ] **Step 4: Run (expect PASS) + typecheck**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionSection.tsx src/components/__tests__/ActionSection.test.tsx
git commit -m "fix: show jail pay option from the first turn"
```

---

### Task 4: Center panel fits board on phones (issue 3)

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/index.css` (if a `min-h-0` helper is needed)
- Test: `e2e/monopoly.spec.ts` (extend the viewport test to portrait + landscape)

- [ ] **Step 1: Reproduce + constrain the card**

Reproduce at phone portrait (≈375×667) and landscape (≈667×375). The card must stay within the board's inner 9×9 area on both axes. Apply:

- Constrain width to the inner area: keep `w-[min(380px,calc((100vw-16px)*9/11-16px))]`.
- Constrain height to the inner area on BOTH orientations: `max-h-[calc((100vh-16px)*9/11-16px)]` below `md`, `md:max-h-[calc(100vh-32px)]` above.
- Ensure the flex-column children cannot force the card taller than `max-h`: add `min-h-0` to the card and `shrink` to the tall child (`EventLog`) so `overflow-y-auto` actually scrolls instead of overflowing.

(Adjust exact classes after reproducing — the goal is: at 375×667 and 667×375, the card's bounding box lies inside the board's inner 9/11 region with no overlap of the outer ring cells.)

- [ ] **Step 2: Extend the e2e viewport test**

In `e2e/monopoly.spec.ts`, extend the "center panel fits" test to loop over both orientations:

```ts
for (const viewport of [{ width: 375, height: 667 }, { width: 667, height: 375 }]) {
  test(`center panel fits on ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.click('button:has-text("Mulai")')
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

    const board = await page.locator('[data-game-board]').boundingBox()
    const sidebar = await page.locator('[data-testid="sidebar"]').boundingBox()
    expect(board).not.toBeNull()
    expect(sidebar).not.toBeNull()
    if (!board || !sidebar) return

    const innerW = (board.width * 9) / 11
    const innerH = (board.height * 9) / 11
    expect(sidebar.width).toBeLessThanOrEqual(innerW)
    expect(sidebar.height).toBeLessThanOrEqual(innerH)
  })
}
```

- [ ] **Step 3: Run build + e2e + typecheck + lint**

Run: `npm run build && npx playwright test e2e/monopoly.spec.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/index.css e2e/monopoly.spec.ts
git commit -m "fix: center panel fits board on phone portrait and landscape"
```

---

## Notes

- Tasks are sequential (Tasks 1–3 touch `src/logic/`/`ActionSection`; do not dispatch in parallel).
- After all tasks, run `npm test` (unit + e2e) and `npm run lint` once more.
