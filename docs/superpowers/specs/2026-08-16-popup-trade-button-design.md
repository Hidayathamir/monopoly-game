# Popup Trade Button Design

Date: 2026-08-16

## Problem

The generic "Trade" button in the sidebar `ActionSection` only appears after the
current player rolls, and it forces the player to pick a target in the modal
afterward. It's awkward. The desired interaction: hover over a player's card in
the sidebar, the existing hover popup (`PlayerPopup`) shows a "Trade" button for
that specific player, and clicking it opens the trade modal pre-locked to that
player.

## Goals

- Replace the sidebar `ActionSection` trade button with a per-player trade button
  in the player hover popup.
- The popup button opens `TradeModal` locked to the hovered player (no dropdown
  to change target).
- The popup button is always visible (for tradeable targets) but disabled when it
  is not the local player's turn, and disabled while the game is mid-resolution
  (a pending action exists) so a trade proposal can't clobber an in-progress
  buy/rent pending action.

## Non-Goals

- No change to `PROPOSE_TRADE` reducer logic or the server contract. The proposal
  still just logs `event.tradeProposed` and returns to `Waiting`.
- No change to trade offer semantics (cash/properties requested vs offered).
- No change to multiplayer server behavior; trades remain a proposal-only log
  entry, exactly as today.

## Design

### 1. Remove sidebar trade button

`src/components/ActionSection.tsx`:
- Delete the `onProposeTrade` prop from `Props` (line 11) and the destructure
  (line 23).
- Delete the trade `<Button>` at line 139.

The `action.trade` i18n key stays and is reused by the popup button, so no locale
file changes.

### 2. Trade button in the player popup

`src/components/PlayerCard.tsx`:
- `PlayerCardProps` gains optional props:
  - `isMyTurn?: boolean`
  - `currentPlayerId?: number`
  - `onProposeTrade?: (playerId: number) => void`
- `PlayerPopup` receives these and renders a `Button` with label `t('action.trade')`
  when `player.id !== currentPlayerId` (hidden on your own card).
- Disabled when `!isMyTurn` OR `state.phase !== Waiting || pendingAction !== null`.
  To know this, `PlayerCard`/`PlayerPopup` need the phase/pendingAction — pass a
  single `canTrade: boolean` boolean down from `PlayerPanel`/`Sidebar` instead of
  threading phase+pendingAction, keeping the components decoupled from game state
  shape beyond what they already get.
- Clicking calls `onProposeTrade?.(player.id)` and closes the popup
  (`setPopupRect(null)`), since the modal opens over the board.

### 3. TradeModal locked target

`src/components/Modals/TradeModal.tsx`:
- Add required prop `targetPlayerId: number`.
- `targetPlayer` state initializes from `targetPlayerId`.
- Remove the `<select>` dropdown (lines 41-54); render the target player's name
  instead (same `t('board...')`-free plain name as elsewhere).
- `handlePropose` uses the locked `targetPlayerId` (no null guard needed).

### 4. Wiring

- `src/components/GameView.tsx`:
  - Replace `showTrade: boolean` state with `tradeTargetId: number | null`.
  - Pass `onProposeTrade={(id) => setTradeTargetId(id)}` to `Sidebar`.
  - Render `TradeModal targetPlayerId={tradeTargetId}` when non-null.
  - Compute `canTrade` in `GameView` (it already computes `isMyTurn`) and thread it
    down with the callback.
- `src/components/Sidebar.tsx`: `onProposeTrade` signature changes from
  `() => void` to `(playerId: number) => void`; add `canTrade` prop; forward both
  to `PlayerPanel`.
- `src/components/PlayerPanel.tsx`: accept `onProposeTrade` + `canTrade`, forward
  to each `PlayerCard` (`canTrade={canTrade && !p.bankrupt}`, and
  `currentPlayerId={state.currentPlayer}`).

### 5. Edge cases

- **Own card**: button hidden (`player.id === currentPlayerId`).
- **Bankrupt target**: button hidden via `canTrade && !p.bankrupt`; TradeModal's
  existing `!p.bankrupt` filter is now moot but stays harmless.
- **Not my turn / mid-resolution**: button rendered but disabled (`!canTrade`).

## Testing

- `src/components/__tests__/ActionSection.test.tsx`: drop `onProposeTrade` from
  the `actions` mock.
- `src/components/__tests__/Sidebar.test.tsx`: `makeProps()` uses
  `onProposeTrade: () => {}` (accepts an ignored arg) or
  `onProposeTrade: (id: number) => {}`; add `canTrade` prop.
- `src/components/__tests__/PlayerCard.test.tsx`: add cases — hover shows Trade
  button for another player; button hidden on own card; disabled when
  `canTrade={false}`; clicking calls `onProposeTrade` with the player id.
- `src/components/__tests__/TradeModal.test.tsx` (new): renders the locked target
  player's name; no player dropdown; propose callback receives the locked id.
- `src/components/__tests__/PlayerPanel.test.tsx`: passes through new props
  (defaults keep existing test passing).

## Files

- Modify: `src/components/ActionSection.tsx`
- Modify: `src/components/PlayerCard.tsx`
- Modify: `src/components/Modals/TradeModal.tsx`
- Modify: `src/components/GameView.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/PlayerPanel.tsx`
- Tests: `ActionSection.test.tsx`, `Sidebar.test.tsx`, `PlayerCard.test.tsx`,
  `PlayerPanel.test.tsx`, new `TradeModal.test.tsx`
