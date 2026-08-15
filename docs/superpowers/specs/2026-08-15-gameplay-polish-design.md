# Monopoly — Gameplay & UX Polish

**Date**: 2026-08-15
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (existing)

## Goal

Six refinements to the LAN-multiplayer feature (and shared gameplay) surfaced from play-testing. No new systems — targeted fixes to turn flow, action placement, disabled-state correctness, an animation gap, a responsive-layout bug, and per-player turn gating.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Doubles skip end-turn | Auto-dispatch `END_TURN` after a resolved space when dice are doubles and `doublesCount > 0` (~500ms delay); keep the "main lagi (dadu ganda)!" log |
| 2 | Build button location | Move "Bangun" out of `PropertyTooltip` into the center `ActionSection`; show only when current player stands on their own buildable property |
| 3 | "Tebus" disabled state | Disable when `money < floor(price/2 * 1.1)`; show "uang kurang" |
| 4 | GO money animation | Remove the `passedGO` suppression in `PlayerPanel` so the money float fires on GO pass/land |
| 5 | Responsive overlap | Fix center panel so it doesn't bleed over board cells at small (phone) widths |
| 6 | Turn gating | Add `myPlayerId` to `GameApi`; disable roll/action buttons for non-current players in multiplayer only |

## Change details

### 1. Doubles skip end-turn

**Where:** `src/hooks/useGame.ts` (local auto-effects) and `server/gameServer.ts` (`scheduleAutoSteps`).

After any dispatch, when `phase === Waiting && !pendingAction && dice !== null && dice[0] === dice[1] && doublesCount > 0`, schedule `END_TURN` after ~500ms (re-checking state inside the timer). `END_TURN`'s existing doubles branch clears dice, keeps `currentPlayer`, preserves `doublesCount`, and appends the "main lagi (dadu ganda)!" log — so the roll button reappears with no intermediate click.

Guard: the timer re-checks `phase === Waiting && !pendingAction && dice[0] === dice[1] && doublesCount > 0` before dispatching, so a jail-to-card or other state change in that window does not misfire.

### 2. Build button in center panel

**Where:** `src/components/ActionSection.tsx`, `src/components/Sidebar.tsx`, `src/components/PropertyTooltip.tsx`.

- Remove the "Bangun" `<Button>` block from `PropertyTooltip`.
- Add a "Bangun (cost)" button in `ActionSection`'s default (no-pending-action) branch, shown when:
  - `space = board[currentPlayer.position]`, `space.type === 'property'`, `space.owner === currentPlayer`, `space.houses < 5`, `!space.mortgaged`, and not `PendingActionType.Bankruptcy`.
- Disabled with "uang kurang" when `money < nextHouseCost` (reuse `getHouseCost`).
- Thread `onBuild: (spaceId) => void` through `Sidebar` → `ActionSection` (Sidebar already receives it from `GameView`).
- Available both before and after rolling (no `dice`/`hasRolled` condition).

### 3. "Tebus" disabled when unaffordable

**Where:** `src/components/PropertyTooltip.tsx`.

Compute `unmortgageCost = Math.floor((space.price ?? 0) / 2 * 1.1)`; add `disabled={money < unmortgageCost}` to the "Tebus" button and append " - uang kurang" to its label when unaffordable (mirroring the existing "Bangun" pattern).

### 4. GO money animation

**Where:** `src/components/PlayerPanel.tsx`.

Delete the `passedGO` short-circuit so the money-diff float (`MoneyChange`) fires for the GO salary too. The float already renders `+{formatMoney(diff)}`; no other change needed.

### 5. Center panel responsive fix

**Where:** `src/components/Sidebar.tsx` (and `src/index.css` tokens if needed).

Reproduce at a small viewport; constrain the center card so it stays within the board's inner area (smaller max-width/max-height, allow internal scroll) without overlapping the surrounding board cells.

### 6. Turn gating (multiplayer only)

**Where:** `src/types/game.ts`, `src/hooks/useGame.ts`, `src/hooks/useNetworkGame.ts`, `src/components/GameView.tsx`, `src/components/DiceRoller.tsx`, `src/components/ActionSection.tsx`.

- Add `myPlayerId: number | null` to `GameApi`.
- `useGame` returns `myPlayerId: null` (local = always your turn).
- `useNetworkGame` returns `myPlayerId: playerId`.
- `GameView` computes `isMyTurn = game.myPlayerId === null || game.myPlayerId === state.currentPlayer` and passes it to `DiceRoller` (hide/disable the "Lempar Dadu" button) and `ActionSection` (disable action buttons).
- Local mode is unaffected (`myPlayerId === null` → always `isMyTurn`).

## Files summary

| File | Change |
|------|--------|
| `src/hooks/useGame.ts` | Add doubles auto-`END_TURN` effect; return `myPlayerId: null` |
| `server/gameServer.ts` | Add doubles auto-`END_TURN` in `scheduleAutoSteps` |
| `src/components/PropertyTooltip.tsx` | Remove "Bangun"; disable "Tebus" when unaffordable |
| `src/components/ActionSection.tsx` | Add "Bangun" button; accept `isMyTurn` |
| `src/components/Sidebar.tsx` | Thread `onBuild`; pass `isMyTurn`; responsive center-panel fix |
| `src/components/DiceRoller.tsx` | Accept `isMyTurn`, disable roll button |
| `src/components/PlayerPanel.tsx` | Remove `passedGO` suppression |
| `src/index.css` | Responsive tokens if needed |
| `src/types/game.ts` | Add `myPlayerId` to `GameApi` |
| `src/hooks/useNetworkGame.ts` | Return `myPlayerId: playerId` |
| `src/components/GameView.tsx` | Compute and pass `isMyTurn` |

## Testing

- Unit: reducer/flow tests for doubles auto-advance (local hook + `GameServer` with fake timers); `PropertyTooltip` disabled states; `DiceRoller`/`ActionSection` disabled when `isMyTurn === false`.
- E2E: existing multiplayer smoke test stays green; local e2e stays green.

## Out of scope

- Changing GO salary rules (land-on-GO is still a single salary, not doubled).
- Reconnecting/disconnect-recovery improvements.
- Any change to rent, jail, or bankruptcy logic.
