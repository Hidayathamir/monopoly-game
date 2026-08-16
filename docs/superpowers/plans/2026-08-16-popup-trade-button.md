# Popup Trade Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar trade button with a "Trade" button inside each player's hover popup that opens TradeModal locked to that player.

**Architecture:** The trade entry point moves from `ActionSection` into `PlayerCard`'s `PlayerPopup`. `GameView` owns a `tradeTargetId` state and a `canTrade` boolean computed from `isMyTurn` + game phase; `canTrade` and an `onProposeTrade(playerId)` callback are threaded `GameView → Sidebar → PlayerPanel → PlayerCard`. `TradeModal` gains an optional `targetPlayerId` prop that locks the target and hides the dropdown.

**Tech Stack:** React 19 + TypeScript + Tailwind v4, Vitest + Testing Library (jsdom).

## Global Constraints

- No new i18n keys — reuse existing `action.trade` (`"🤝 Trade"` / `"🤝 Tukar"`).
- No changes to `gameReducer` `PROPOSE_TRADE` logic or the server contract.
- No TS enums; type-only imports use `import type`; match the file's existing semicolon style (components are semicolon-free).
- Each task must leave `npm run typecheck` and `npm run test:unit` green.
- i18n-safe: render plain player names via `state.players[id].name`, not translated board names.

---

### Task 1: Remove the sidebar trade button

**Files:**
- Modify: `src/components/ActionSection.tsx:11,23,139`
- Test: `src/components/__tests__/ActionSection.test.tsx:12`

**Interfaces:**
- Consumes: nothing (pure removal).
- Produces: `ActionSection` no longer accepts `onProposeTrade`; `Sidebar` keeps accepting it and passes it down separately (wired in Task 4).

- [ ] **Step 1: Write the failing test (update mock)**

Edit `src/components/__tests__/ActionSection.test.tsx` line 12 — remove `onProposeTrade: noop` from the `actions` object:

```tsx
const actions = {
  onEndTurn: noop, onDrawCard: noop, onBuyProperty: noop,
  onDeclineBuy: noop, onPayRent: noop, onDeclareBankruptcy: noop,
  onPayJailFine: noop, onUseGetOutOfJailFree: noop,
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx`
Expected: FAIL — TS/jsdom error that `ActionSection` props include `onProposeTrade` not in its `Props` type. (The existing tests don't assert the trade button, so only a type error surfaces; that's the failing signal.)

- [ ] **Step 3: Remove the prop and button**

In `src/components/ActionSection.tsx`:
1. Delete `onProposeTrade: () => void` from the `Props` interface (line 11).
2. Delete `onProposeTrade,` from the destructure (line 23).
3. Delete the trade button (line 139), leaving only the End Turn / Roll Again button:

```tsx
<Button variant="secondary" onClick={onEndTurn}>{t(state.doublesCount > 0 ? 'action.rollAgain' : 'action.endTurn')}</Button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/ActionSection.test.tsx && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ActionSection.tsx src/components/__tests__/ActionSection.test.tsx
git commit -m "refactor: remove sidebar trade button (moving to player popup)"
```

---

### Task 2: TradeModal supports a locked target player

**Files:**
- Modify: `src/components/Modals/TradeModal.tsx`
- Test: `src/components/__tests__/TradeModal.test.tsx` (new)

**Interfaces:**
- Consumes: `GameState`, `TradeOffer` from `../../types/game` (already imported).
- Produces: `TradeModal({ state, onPropose, onClose, targetPlayerId? })`. When `targetPlayerId` is provided, the modal shows that player's name instead of the `<select>` and `onPropose` is called with `toId = targetPlayerId`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/TradeModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import TradeModal from '../Modals/TradeModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

afterEach(cleanup)

describe('TradeModal', () => {
  it('locks the target player and omits the dropdown when targetPlayerId is set', () => {
    const onPropose = vi.fn()
    renderWithProviders(
      <TradeModal state={makeState()} targetPlayerId={1} onPropose={onPropose} onClose={() => {}} />,
    )
    expect(screen.getByText('Bob')).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('proposes the trade to the locked target player', () => {
    const onPropose = vi.fn()
    renderWithProviders(
      <TradeModal state={makeState()} targetPlayerId={1} onPropose={onPropose} onClose={() => {}} />,
    )
    screen.getByRole('button', { name: /Propose/i }).click()
    expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ toId: 1 }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/TradeModal.test.tsx`
Expected: FAIL — `targetPlayerId` is not an accepted prop (TS error), and no dropdown-free rendering exists.

- [ ] **Step 3: Implement the locked-target prop**

Edit `src/components/Modals/TradeModal.tsx`:

1. Add to `Props`:

```tsx
interface Props {
  state: GameState
  onPropose: (offer: TradeOffer) => void
  onClose: () => void
  targetPlayerId?: number
}
```

2. Update the component signature and state:

```tsx
export default function TradeModal({ state, onPropose, onClose, targetPlayerId }: Props) {
  const { t } = useTranslation()
  const [targetPlayer, setTargetPlayer] = useState<number | null>(targetPlayerId ?? null)
```

3. Update `handlePropose` to prefer the locked id:

```tsx
function handlePropose() {
  const toId = targetPlayerId ?? targetPlayer
  if (toId === null) return
  onPropose({
    fromId: state.currentPlayer,
    toId,
    offerProperties,
    offerCash,
    requestProperties,
    requestCash,
  })
}
```

4. Replace the target `<select>` (lines 41-54) with a locked-name branch:

```tsx
<label className="text-base text-text-dim">{t('trade.with')}</label>
{targetPlayerId !== undefined ? (
  <p className="text-base text-gold">{state.players[targetPlayerId]?.name}</p>
) : (
  <select
    value={targetPlayer ?? ''}
    onChange={(e) => setTargetPlayer(Number(e.target.value))}
    className="p-2 rounded-md border border-border bg-input-bg text-text"
  >
    <option value="">{t('trade.selectPlayer')}</option>
    {state.players
      .filter((p) => p.id !== state.currentPlayer && !p.bankrupt)
      .map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
  </select>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/TradeModal.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Modals/TradeModal.tsx src/components/__tests__/TradeModal.test.tsx
git commit -m "feat: allow TradeModal to lock the target player"
```

---

### Task 3: Add the Trade button to the player hover popup

**Files:**
- Modify: `src/components/PlayerCard.tsx`
- Test: `src/components/__tests__/PlayerCard.test.tsx`

**Interfaces:**
- Consumes: `Button` from `./Button` (new import).
- Produces: `PlayerCard` accepts optional `canTrade?: boolean`, `currentPlayerId?: number`, `onProposeTrade?: (playerId: number) => void`. `PlayerPopup` renders a "Trade" button when `player.id !== currentPlayerId`, disabled when `!canTrade`, and clicking it calls `onProposeTrade(player.id)` and closes the popup.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/__tests__/PlayerCard.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react'

describe('PlayerCard popup trade button', () => {
  const otherPlayer = { ...player, id: 1, name: 'Beta' }

  function openPopup(props: Partial<React.ComponentProps<typeof PlayerCard>> = {}) {
    renderWithProviders(
      <PlayerCard
        player={otherPlayer}
        isCurrent={false}
        color="#E74C3C"
        diff={null}
        board={board}
        currentPlayerId={0}
        canTrade
        onProposeTrade={() => {}}
        {...props}
      />,
    )
    fireEvent.mouseEnter(screen.getByTestId('player-card'))
  }

  it('shows a Trade button in the popup for another player', () => {
    openPopup()
    expect(screen.getByRole('button', { name: /Trade/ })).toBeVisible()
  })

  it('hides the Trade button on your own card', () => {
    openPopup({ player, currentPlayerId: 0 })
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })

  it('disables the Trade button when canTrade is false', () => {
    openPopup({ canTrade: false })
    expect(screen.getByRole('button', { name: /Trade/ })).toBeDisabled()
  })

  it('calls onProposeTrade with the hovered player id and closes the popup', () => {
    const onProposeTrade = vi.fn()
    openPopup({ onProposeTrade })
    screen.getByRole('button', { name: /Trade/ }).click()
    expect(onProposeTrade).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/PlayerCard.test.tsx`
Expected: FAIL — no Trade button rendered in the popup.

- [ ] **Step 3: Implement the popup Trade button**

Edit `src/components/PlayerCard.tsx`:

1. Import `Button`:

```tsx
import Button from './Button'
```

2. Add optional props to `PlayerCardProps`:

```tsx
interface PlayerCardProps {
  player: Player
  isCurrent: boolean
  color: string
  diff?: { diff: number; key: number } | null
  board: Space[]
  canTrade?: boolean
  currentPlayerId?: number
  onProposeTrade?: (playerId: number) => void
}
```

3. Update the `PlayerCard` signature and add a handler:

```tsx
export default function PlayerCard({ player, isCurrent, color, diff, board, canTrade = true, currentPlayerId, onProposeTrade }: PlayerCardProps) {
```

```tsx
function handleTrade() {
  clearTimeout(timerRef.current)
  setPopupRect(null)
  onProposeTrade?.(player.id)
}
```

4. Pass the new props into `PlayerPopup`:

```tsx
{popupRect &&
  createPortal(
    <PlayerPopup
      player={player}
      owned={owned}
      color={color}
      rect={popupRect}
      onEnter={() => clearTimeout(timerRef.current)}
      onLeave={handleLeave}
      canTrade={canTrade}
      currentPlayerId={currentPlayerId}
      onProposeTrade={handleTrade}
    />,
    document.body,
  )
}
```

5. Update `PlayerPopup` signature and add the button (after the properties block, inside the popup container):

```tsx
function PlayerPopup({ player, owned, color, rect, onEnter, onLeave, canTrade, currentPlayerId, onProposeTrade }: {
  player: Player
  owned: Space[]
  color: string
  rect: DOMRect
  onEnter: () => void
  onLeave: () => void
  canTrade: boolean
  currentPlayerId?: number
  onProposeTrade?: () => void
}) {
```

```tsx
{player.id !== currentPlayerId && (
  <Button size="sm" disabled={!canTrade} onClick={onProposeTrade} className="w-full mt-2">
    {t('action.trade')}
  </Button>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/PlayerCard.test.tsx && npm run typecheck`
Expected: PASS (existing 4 PlayerCard tests still pass; new 4 pass).

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayerCard.tsx src/components/__tests__/PlayerCard.test.tsx
git commit -m "feat: add trade button to player hover popup"
```

---

### Task 4: Thread trade props through PlayerPanel and Sidebar

**Files:**
- Modify: `src/components/PlayerPanel.tsx`
- Modify: `src/components/Sidebar.tsx:15,47-52`
- Test: `src/components/__tests__/PlayerPanel.test.tsx:19-21`
- Test: `src/components/__tests__/Sidebar.test.tsx:24-38`

**Interfaces:**
- Consumes: `onProposeTrade`/`canTrade` from Task 3's `PlayerCard`.
- Produces:
  - `PlayerPanel({ state, playerColors, onProposeTrade, canTrade })` — required props.
  - `Sidebar({ ..., onProposeTrade: (playerId: number) => void, canTrade?: boolean })` — `onProposeTrade` signature changes to take a player id; `canTrade` optional (default `true`) until Task 5 supplies it.

- [ ] **Step 1: Write the failing tests (update mocks)**

1. `src/components/__tests__/PlayerPanel.test.tsx` — pass the new required props:

```tsx
renderWithProviders(
  <PlayerPanel
    state={makeState(1000, 38)}
    playerColors={COLORS}
    onProposeTrade={() => {}}
    canTrade
  />,
)
rerender(
  <PlayerPanel
    state={makeState(1000 + GO_SALARY, 5)}
    playerColors={COLORS}
    onProposeTrade={() => {}}
    canTrade
  />,
)
```

2. `src/components/__tests__/Sidebar.test.tsx` — `makeProps()` already passes `onProposeTrade: noop`; that's still assignable (`() => void` satisfies `(id: number) => void`). Add `canTrade: true` to `makeProps()` so the prop is exercised:

```tsx
onProposeTrade: noop,
canTrade: true,
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/PlayerPanel.test.tsx src/components/__tests__/Sidebar.test.tsx`
Expected: FAIL — `PlayerPanel` type error: missing `onProposeTrade`/`canTrade` props.

- [ ] **Step 3: Implement PlayerPanel pass-through**

Edit `src/components/PlayerPanel.tsx`:

```tsx
interface Props {
  state: GameState
  playerColors: string[]
  onProposeTrade: (playerId: number) => void
  canTrade: boolean
}

export default function PlayerPanel({ state, playerColors, onProposeTrade, canTrade }: Props) {
```

Pass to each `PlayerCard` (inside the `.map`):

```tsx
<PlayerCard
  key={player.id}
  player={player}
  isCurrent={isCurrent}
  color={playerColors[player.id]}
  diff={diffs[player.id] ?? null}
  board={board}
  canTrade={canTrade && !player.bankrupt}
  currentPlayerId={currentPlayer}
  onProposeTrade={onProposeTrade}
/>
```

- [ ] **Step 4: Implement Sidebar pass-through**

Edit `src/components/Sidebar.tsx`:

1. Change the `onProposeTrade` prop type (line 15) and add `canTrade`:

```tsx
onProposeTrade: (playerId: number) => void
canTrade?: boolean
```

2. Update the signature with a default:

```tsx
export default function Sidebar({ state, isMyTurn, onLeave, onProposeTrade, canTrade = true, ...actions }: Props) {
```

3. Pass both to `PlayerPanel` (line 53):

```tsx
<PlayerPanel
  state={state}
  playerColors={PLAYER_COLORS}
  onProposeTrade={onProposeTrade}
  canTrade={canTrade}
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/PlayerPanel.test.tsx src/components/__tests__/Sidebar.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayerPanel.tsx src/components/Sidebar.tsx src/components/__tests__/PlayerPanel.test.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat: thread trade callback and canTrade through player panel"
```

---

### Task 5: Wire the popup trade flow in GameView

**Files:**
- Modify: `src/components/GameView.tsx`

**Interfaces:**
- Consumes: `Sidebar` props from Task 4 (`onProposeTrade(playerId)`, `canTrade`), `TradeModal` `targetPlayerId` from Task 2.
- Produces: `GameView` renders `TradeModal` only when `tradeTargetId !== null`, passing `targetPlayerId={tradeTargetId}`; computes `canTrade` from `isMyTurn` + phase.

- [ ] **Step 1: Verify current behavior manually (baseline)**

Run: `npm run dev`, start a local game, hover a player card, confirm no Trade button yet. This is the observable gap this task closes.

- [ ] **Step 2: Implement the wiring**

Edit `src/components/GameView.tsx`:

1. Update imports (GamePhase is a value, use a value import):

```tsx
import { GamePhase, type GameApi, type TradeOffer } from '../types/game'
```

2. Replace the `showTrade` state with a target-id state and compute `canTrade`:

```tsx
const isMyTurn = game.myPlayerId === null
  ? !state.players[state.currentPlayer]?.isBot
  : game.myPlayerId === state.currentPlayer
const canTrade = isMyTurn && state.phase === GamePhase.Waiting && !state.pendingAction
const [tradeTargetId, setTradeTargetId] = useState<number | null>(null)
```

3. Pass the new props to `Sidebar`:

```tsx
<Sidebar
  state={state}
  isMyTurn={isMyTurn}
  onRoll={game.roll}
  onEndTurn={game.endTurn}
  onProposeTrade={(id: number) => setTradeTargetId(id)}
  canTrade={canTrade}
  ...
/>
```

4. Render `TradeModal` locked to the target:

```tsx
{tradeTargetId !== null && (
  <TradeModal
    state={state}
    targetPlayerId={tradeTargetId}
    onPropose={(offer: TradeOffer) => {
      game.proposeTrade(offer)
      setTradeTargetId(null)
    }}
    onClose={() => setTradeTargetId(null)}
  />
)}
```

- [ ] **Step 3: Verify typecheck and full unit suite**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS — all 200+ tests including the new TradeModal/PlayerCard popup tests.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`.
1. Start a local game (2+ players).
2. Hover your own card → no Trade button.
3. Hover an opponent's card → Trade button visible; click → TradeModal opens showing the opponent's name, no dropdown.
4. Not your turn → Trade button disabled.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameView.tsx
git commit -m "feat: open trade modal locked to the hovered player"
```

---

## Self-Review

**Spec coverage:**
- Remove sidebar button → Task 1 ✓
- Popup trade button, hidden on own card, disabled when not my turn / mid-resolution → Task 3 (button) + Task 4 (canTrade thread) + Task 5 (canTrade computed in GameView) ✓
- TradeModal locked target, no dropdown → Task 2 ✓
- Wiring GameView → Sidebar → PlayerPanel → PlayerCard → Task 4/5 ✓
- Testing each area → Task 1-5 each have test steps ✓
- Edge case: bankrupt target hidden → Task 4 (`canTrade && !player.bankrupt`) ✓

**Placeholder scan:** All code steps contain concrete code; no TBDs. `npm run dev` verification in Task 5 Step 1/4 is a manual baseline/check, not a stub.

**Type consistency:** `onProposeTrade` is `(playerId: number) => void` everywhere from Task 4 onward; `canTrade` is boolean throughout; `TradeModal` prop is `targetPlayerId?: number` in Task 2 and passed as `targetPlayerId={tradeTargetId}` in Task 5 where `tradeTargetId` is `number | null` (guarded by `!== null`). `handleTrade` in Task 3 closes the popup by clearing `timerRef` and `popupRect` — consistent with existing `handleEnter`/`handleLeave`.
