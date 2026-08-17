# Build Rule Parity & Player Popup Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bots follow the same build rule as players (build only on the property you're standing on, once per landing) and fix the player popup that renders half off-screen on mobile portrait, adding tap-to-dismiss.

**Architecture:** Enforce the "build only while standing on your own property" rule in `gameReducer` (the shared source of truth, authoritative on the server), driven by a new `builtThisStop` flag on `GameState` that also implements the bot's "build once per landing". The bot brain (`decideBotAction`) drops its pre-roll anywhere-build and only builds on the space under the bot. Separately, `PlayerPopup` in `PlayerCard.tsx` is measured after render and clamped/flipped inside the viewport, with a document `pointerdown` handler for tap-to-dismiss.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind v4, Vitest.

## Global Constraints

- **No TS enums** — `erasableSyntaxOnly: true`; use `const` objects + derived unions (see `src/types/game.ts`). Type-only imports must use `import type`; `noUnusedLocals`/`noUnusedParameters` are on.
- **Wire values are contract** — `GameActionType.BuildHouse` and all other wire strings must not change. `builtThisStop` is internal state, not part of the client/server message contract.
- **Semicolon style** — `src/logic/*`, `src/types/game.ts`, `src/data/*` use semicolons; components/hooks/net/server files do not. Match the file being edited.
- **i18n** — no new UI strings needed for this work; no translation file changes.
- **Reducer is the single source of truth** — it runs on both client and server; the server (`server/gameServer.ts`) rejects actions only by turn, so all rule checks must live in the reducer.
- **Verification** — `npm run test:unit`, `npm run typecheck`, `npm run lint`. Server-backed e2e (`npm run test:e2e`) requires `npm run build` first (`dist/` is gitignored).

---

### Task 1: Enforce the build rule in the reducer with a `builtThisStop` flag

**Files:**
- Modify: `src/types/game.ts` — add `builtThisStop: boolean` to `GameState`
- Modify: `src/logic/gameReducer.ts` — `createInitialState`, `RollDice` case, `BuildHouse` case
- Modify: `src/logic/__tests__/gameReducer.test.ts` — `BUILD_HOUSE` block (lines ~407-450) and event-log cases (lines ~963-976)
- Modify: `src/logic/__tests__/cards.test.ts:26` — add field to `GameState` literal
- Modify: `src/components/__tests__/TurnHeader.test.tsx:28` — add field to `GameState` literal

**Interfaces:**
- Consumes: existing `GameState`, `GameActionType.BuildHouse`, `LogEventKey.BuiltHouse`/`BuiltHotel`.
- Produces: `GameState.builtThisStop: boolean` (init `false`; set `true` in `BuildHouse`; reset to `false` in `RollDice`). Task 2 consumes `state.builtThisStop`.

- [ ] **Step 1: Add the field to the type**

In `src/types/game.ts`, inside the `GameState` type (after `justBoughtSpaceId: number | null;`, line 202):

```ts
  justBoughtSpaceId: number | null;
  builtThisStop: boolean;
```

- [ ] **Step 2: Add the field to the two GameState literals**

`src/logic/__tests__/cards.test.ts`, in `makeState` after the `justBoughtSpaceId: null,` line (line 25):

```ts
    justBoughtSpaceId: null,
    builtThisStop: false,
```

`src/components/__tests__/TurnHeader.test.tsx`, in `makeState` after the `justBoughtSpaceId: null,` line (line 28):

```ts
    justBoughtSpaceId: null,
    builtThisStop: false,
```

> `src/components/__tests__/Sidebar.test.tsx` needs **no** change — its `makeState` builds via `gameReducer`, and its `tradesEnabled: true` at line 37 is a props object, not a `GameState` literal.

- [ ] **Step 3: Write the failing reducer tests**

In `src/logic/__tests__/gameReducer.test.ts`, replace the `BUILD_HOUSE` describe block (lines 407-450) with:

```ts
  describe('BUILD_HOUSE', () => {
    function landedOnOwnProperty(state: GameState): GameState {
      state = buyProperty(state, 0, 1);
      state = setPosition(state, 0, 1);
      return { ...state, dice: [2, 3] };
    }

    it('builds a house on the property the player is standing on', () => {
      let state = landedOnOwnProperty(makeStartedState());

      state = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(state.board[1].houses).toBe(1);
      expect(state.players[0].money).toBe(STARTING_MONEY - 60 - 25);
      expect(state.builtThisStop).toBe(true);
    });

    it('cannot build if not enough money', () => {
      let state = landedOnOwnProperty(makeStartedState());
      state = setMoney(state, 0, 10);

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(0);
    });

    it('builds hotel at 5 houses', () => {
      let state = landedOnOwnProperty(makeStartedState());
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 4 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(5);
    });

    it('cannot build beyond hotel (6+)', () => {
      let state = landedOnOwnProperty(makeStartedState());
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 5 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(5);
    });

    it('cannot build when not standing on the property', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, dice: [2, 3] };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(0);
    });

    it('cannot build before rolling', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = setPosition(state, 0, 1);

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(0);
    });

    it('cannot build on a mortgaged property', () => {
      let state = landedOnOwnProperty(makeStartedState());
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, mortgaged: true } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(0);
    });
  });
```

Then update the two event-log cases (lines 963-976) so the player is standing on the property with dice rolled:

```ts
    it('build house produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = setPosition(state, 0, 1);
      state = { ...state, dice: [2, 3] };
      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.eventLog).toContainEqual({ key: 'event.builtHouse', params: { name: 'Alice', spaceId: 1, amount: 25 } });
    });

    it('build hotel produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = setPosition(state, 0, 1);
      state = { ...state, dice: [2, 3], board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 4 } : s)) };
      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.eventLog).toContainEqual({ key: 'event.builtHotel', params: { name: 'Alice', spaceId: 1, amount: 150 } });
    });
```

> Note: the existing `buyProperty` test helper sets the owner directly and never sets `justBoughtSpaceId`, so the reducer's just-bought guard does not reject these builds.

- [ ] **Step 4: Run the tests to verify the new failures**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/components/__tests__/TurnHeader.test.tsx`
Expected: `gameReducer.test.ts` fails on the new build guards ("expected ... houses ... to be 1" etc.) and `cards.test.ts`/`TurnHeader.test.tsx` fail to compile with `Property 'builtThisStop' is missing`.

- [ ] **Step 5: Implement the reducer changes**

In `src/logic/gameReducer.ts`:

`createInitialState` (after `justBoughtSpaceId: null,`, line 28):

```ts
    justBoughtSpaceId: null,
    builtThisStop: false,
```

`RollDice` case (lines 67-73) — clear the flag on a new roll:

```ts
    case GameActionType.RollDice: {
      return {
        ...state,
        phase: GamePhase.Rolling,
        justBoughtSpaceId: null,
        builtThisStop: false,
      };
    }
```

`BuildHouse` case (lines 411-431) — replace the whole case body:

```ts
    case GameActionType.BuildHouse: {
      const space = state.board[action.spaceId];
      const player = state.players[state.currentPlayer];
      const cost = getHouseCost(space, space.houses);
      if (
        space.id !== player.position ||
        space.owner !== state.currentPlayer ||
        state.dice === null ||
        state.pendingAction !== null ||
        space.houses >= 5 ||
        space.mortgaged ||
        cost === 0 ||
        player.money < cost ||
        space.id === state.justBoughtSpaceId
      ) return state;
      const newHouses = space.houses + 1;
      const newMoney = player.money - cost;
      const newBoard = [...state.board];
      newBoard[action.spaceId] = { ...space, houses: newHouses };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = { ...player, money: newMoney };

      return {
        ...state,
        phase: GamePhase.Waiting,
        board: newBoard,
        players: newPlayers,
        pendingAction: null,
        builtThisStop: true,
        eventLog: [...state.eventLog, actorEntry(space.houses === 4 ? LogEventKey.BuiltHotel : LogEventKey.BuiltHouse, player, { spaceId: space.id, amount: cost })],
      };
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/components/__tests__/TurnHeader.test.tsx`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/game.ts src/logic/gameReducer.ts src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/components/__tests__/TurnHeader.test.tsx
git commit -m "feat: enforce build-while-standing rule in the reducer"
```

---

### Task 2: Make the bot build only while standing on its own property, once per landing

**Files:**
- Modify: `src/logic/bot.ts` — `decideBotAction` waiting branch and `buildAction`
- Modify: `src/logic/__tests__/bot.test.ts` — `makeState` literal (line 43) and build-related tests

**Interfaces:**
- Consumes: `GameState.builtThisStop` (from Task 1), `isMonopoly` from `./rent`, `getHouseCost` from `../data/board`.
- Produces: `decideBotAction(state)` returns `{ type: GameActionType.BuildHouse; spaceId }` only for the space at `player.position`; otherwise `END_TURN` after landing.

- [ ] **Step 1: Write the failing bot tests**

In `src/logic/__tests__/bot.test.ts`:

Add `builtThisStop: false` to `makeState` after `justBoughtSpaceId: null,` (line 43):

```ts
    justBoughtSpaceId: null,
    builtThisStop: false,
```

Replace the two build tests (lines 168-185):

```ts
  it('builds a house when standing on an owned, completed, affordable property', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board, dice: [3, 4] },
      makePlayer({ properties: group.map((s) => s.id), money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
  });

  it('does not build before rolling', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board },
      makePlayer({ properties: group.map((s) => s.id), money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
  });

  it('does not build on an incomplete color set', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    board[group[0].id] = { ...group[0], owner: 0 };
    const state = makeState(
      { board, dice: [3, 4] },
      makePlayer({ properties: [group[0].id], money: 100000, position: group[0].id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });

  it('builds only once per landing', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board, dice: [3, 4], builtThisStop: true },
      makePlayer({ properties: group.map((s) => s.id), money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`
Expected: FAIL — the standing/dice/builtThisStop conditions are not yet honored (e.g. "builds a house when standing..." gets a different `spaceId`, "does not build before rolling" returns `BUILD_HOUSE`, "builds only once per landing" returns `BUILD_HOUSE`).

- [ ] **Step 3: Implement the bot changes**

In `src/logic/bot.ts`, change the `GamePhase.Waiting` branch of `decideBotAction` (lines 35-45) so the build only happens **after** landing:

```ts
  if (state.phase === GamePhase.Waiting) {
    if (player.inJail) {
      if (player.getOutOfJailFreeCards > 0) return { type: GameActionType.UseGetOutOfJailFree };
      if (player.money >= JAIL_FINE) return { type: GameActionType.PayJailFine };
      return { type: GameActionType.RollDice };
    }
    if (state.dice === null) {
      return { type: GameActionType.RollDice };
    }
    return buildAction(state) ?? { type: GameActionType.EndTurn };
  }
```

Replace `buildAction` (lines 50-67) with a standing-property-only version:

```ts
function buildAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  const space = state.board[player.position];
  if (!space || space.type !== SpaceType.Property) return null;
  if (space.owner !== state.currentPlayer) return null;
  if (space.houses >= 5 || space.mortgaged) return null;
  if (space.id === state.justBoughtSpaceId) return null;
  if (state.builtThisStop) return null;
  if (!isMonopoly(player.id, state.board, space)) return null;
  const cost = getHouseCost(space, space.houses);
  if (cost === 0 || player.money < cost) return null;
  return { type: GameActionType.BuildHouse, spaceId: space.id };
}
```

> The old `player.money - cost < 50` buffer is dropped so the bot's build decision mirrors the human Build button (`money >= cost`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/logic/__tests__/bot.test.ts src/logic/__tests__/gameReducer.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logic/bot.ts src/logic/__tests__/bot.test.ts
git commit -m "fix: bot builds only while standing on its own property"
```

---

### Task 3: Clamp the player popup inside the viewport and add tap-to-dismiss

**Files:**
- Modify: `src/components/PlayerCard.tsx` — add a pure `computePopupPosition` helper, measure+clamp in `PlayerPopup`, document `pointerdown` dismissal
- Modify: `src/components/__tests__/PlayerCard.test.tsx` — unit tests for `computePopupPosition` and tap-to-dismiss

**Interfaces:**
- Consumes: `DOMRect` from the card's `getBoundingClientRect()` (existing `popupRect` state), `createPortal` (existing).
- Produces: exported `computePopupPosition(rect, width, height, viewport, margin?)` returning `{ left: number; top: number }`; `PlayerPopup` renders fully inside the viewport; tapping outside card+popup closes it.

- [ ] **Step 1: Write the failing tests**

Modify the existing import on line 6 of `src/components/__tests__/PlayerCard.test.tsx`:

```tsx
import PlayerCard, { computePopupPosition } from '../PlayerCard'
```

Append new describe blocks:

```tsx
describe('computePopupPosition', () => {
  const viewport = { width: 375, height: 667 }

  it('places the popup to the right of the card when there is room', () => {
    const rect = { left: 40, right: 150, top: 40 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.left).toBe(158)
    expect(pos.top).toBe(36)
  })

  it('flips to the left when the right side would overflow', () => {
    const rect = { left: 220, right: 300, top: 40 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.left).toBe(12)
    expect(pos.left).toBeLessThan(rect.left)
    expect(pos.top).toBe(36)
  })

  it('clamps into the viewport when there is no room on either side', () => {
    const rect = { left: 170, right: 205, top: 40 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.left).toBeGreaterThanOrEqual(8)
    expect(pos.left + 200).toBeLessThanOrEqual(375 - 8)
  })

  it('clamps the top so the popup stays fully on screen', () => {
    const rect = { left: 100, right: 260, top: 620 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.top).toBeLessThanOrEqual(667 - 120 - 8)
    expect(pos.top).toBeGreaterThanOrEqual(8)
  })
})
```

And a tap-to-dismiss test inside the existing `PlayerCard popup trade button` describe (after the `calls onProposeTrade...` test):

```tsx
  it('closes the popup when tapping outside the card', () => {
    openPopup()
    expect(screen.getByRole('button', { name: /Trade/ })).toBeVisible()
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })

  it('keeps the popup open when tapping inside the card', () => {
    openPopup()
    act(() => {
      screen.getByTestId('player-card').dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(screen.getByRole('button', { name: /Trade/ })).toBeVisible()
  })
```

> Use `dispatchEvent(new Event('pointerdown', { bubbles: true }))` rather than `fireEvent.pointerDown` — jsdom does not guarantee a `PointerEvent` constructor. The dispatch MUST be wrapped in `act(...)` from `@testing-library/react`: React 18/19 batches the state update, so without `act` the immediate assertion reads stale DOM. Add `act` to the existing `@testing-library/react` import in the test file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/PlayerCard.test.tsx`
Expected: FAIL — `computePopupPosition` is not exported; tap-to-dismiss behavior does not exist yet.

- [ ] **Step 3: Implement the popup position clamping**

In `src/components/PlayerCard.tsx`:

Add an exported pure helper above the `PlayerCard` component:

```tsx
export function computePopupPosition(
  rect: Pick<DOMRect, 'left' | 'right' | 'top'>,
  width: number,
  height: number,
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number } {
  let left = rect.right + margin
  if (left + width > viewport.width - margin) left = rect.left - width - margin
  left = Math.max(margin, Math.min(left, viewport.width - width - margin))
  const top = Math.max(margin, Math.min(rect.top - 4, viewport.height - height - margin))
  return { left, top }
}
```

In `PlayerCard`, add a card ref and a popup ref, and the dismiss effect. Replace the component body pieces:

```tsx
export default function PlayerCard({ player, isCurrent, color, diff, board, connected = true, canTrade = true, currentPlayerId, onProposeTrade, tradesEnabled = true }: PlayerCardProps) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const [popupRect, setPopupRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cardRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const owned = player.properties
    .map((id) => board[id])
    .filter((s): s is Space => s !== undefined)

  function handleEnter(e: React.MouseEvent<HTMLDivElement>) {
    clearTimeout(timerRef.current)
    setPopupRect(e.currentTarget.getBoundingClientRect())
  }

  function handleLeave() {
    timerRef.current = setTimeout(() => setPopupRect(null), 200)
  }

  function handleTrade() {
    clearTimeout(timerRef.current)
    setPopupRect(null)
    onProposeTrade?.(player.id)
  }

  useEffect(() => {
    if (!popupRect) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (cardRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setPopupRect(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [popupRect])
```

Attach `cardRef` to the card div (`onMouseEnter={handleEnter}` line) and pass `popupRef` and an `onDismiss` to `PlayerPopup`:

```tsx
      <div
        ref={cardRef}
        data-testid="player-card"
        ...
```

```tsx
      {popupRect &&
        createPortal(
          <PlayerPopup
            player={player}
            owned={owned}
            color={color}
            rect={popupRect}
            popupRef={popupRef}
            onEnter={() => clearTimeout(timerRef.current)}
            onLeave={handleLeave}
            canTrade={canTrade}
            currentPlayerId={currentPlayerId}
            onProposeTrade={handleTrade}
            tradesEnabled={tradesEnabled}
          />,
          document.body,
        )
      }
```

Update the `PlayerPopup` signature to accept `popupRef` and measure/clamp in a `useLayoutEffect`. Add `useLayoutEffect` to the existing react import (`import { useEffect, useRef, useLayoutEffect, useState } from 'react'`). Replace the `PlayerPopup` function:

```tsx
function PlayerPopup({ player, owned, color, rect, popupRef, onEnter, onLeave, canTrade, currentPlayerId, onProposeTrade, tradesEnabled }: {
  player: Player
  owned: Space[]
  color: string
  rect: DOMRect
  popupRef: React.RefObject<HTMLDivElement | null>
  onEnter: () => void
  onLeave: () => void
  canTrade: boolean
  currentPlayerId?: number
  onProposeTrade?: () => void
  tradesEnabled: boolean
}) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = popupRef.current
    if (!el) return
    setPos(computePopupPosition(rect, el.offsetWidth, el.offsetHeight, {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
  }, [rect, popupRef])

  return (
    <div
      ref={popupRef}
      className="fixed bg-bg-dark border border-border-light rounded-lg px-3 py-2.5 min-w-[180px] max-w-[min(260px,calc(100vw-16px))] max-h-[60vh] overflow-y-auto z-[999] shadow-lg"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      ...unchanged popup content...
    </div>
  )
}
```

The popup's inner content (player name, money, jail-free cards, properties, trade button) stays exactly as it is today — only the outer div's `ref`, `style`, and `max-w` class change, plus the `useLayoutEffect` above it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/PlayerCard.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayerCard.tsx src/components/__tests__/PlayerCard.test.tsx
git commit -m "fix: keep player popup on-screen and dismiss on outside tap"
```

---

### Task 4: Full verification

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS (all 3 TS projects).

- [ ] **Step 2: Unit tests**

Run: `npm run test:unit`
Expected: all PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: only the 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx`.

- [ ] **Step 4: Build + e2e**

Run: `npm run build && npm run test:e2e`
Expected: all PASS (build produces `dist/` required by server-backed specs).

- [ ] **Step 5: Commit any fixups**

```bash
git add -A
git commit -m "fix: verification cleanup"
```
(Skip if nothing changed.)
