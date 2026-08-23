# Board Token Highlight + Dice Hints

## Problem
During a player's turn, it's hard to locate their token on the board. Additionally, there's no visual indication of which cells correspond to dice values 2-12, making it difficult to plan which dice target to aim for.

## Solution
Two visual enhancements:

1. **Token highlight**: Make the current player's own token more prominent with a pulsing glow animation and larger size
2. **Dice hints**: Show numbered badges (2-12) on board cells during the aiming phase, indicating which cell each dice result would land on

## Design

### 1. Token Visibility Enhancement
**File: `src/components/PlayerTokens.tsx`**

When it's the player's turn, their own token (identified by `myPlayerId`) gets:
- **Larger size**: 22px -> 28px
- **Pulsing glow animation**: CSS keyframes pulse on box-shadow using player color
- **Higher z-index**: z-10 -> z-20 to stay on top

Requires new prop `myPlayerId: number | null` to distinguish "my token" from "current player's token" in multiplayer.

The existing `state.currentPlayer === player.id` white border remains for all players to see whose turn it is. The pulsing glow is only visible to the player whose turn it is (on their own token).

### 2. Dice Hints Overlay
**New file: `src/components/DiceHints.tsx`**

A transparent overlay (like `PlayerTokens`) that renders badge-style dice value numbers on board cells.

- **Visibility**: Only shown during aiming phase (when speedometer is sweeping)
- **Input props**: `state: GameState`, `myPlayerId: number | null`
- **Condition**: `state.dice === null && state.phase === GamePhase.Waiting && !state.pendingAction && isMyTurn`
- **Logic**: For each value v in [2..12], compute `targetCell = (currentPlayer.position + v) % 40`, render a badge at that cell's position using the same `POSITIONS` map from `PlayerTokens.tsx`
- **Badge style**:
  - 18px circle
  - Semi-transparent player color background
  - White bold number text
  - Positioned absolutely using the same percentage-based positioning as tokens
  - Subtle entrance animation (fade-in)

### 3. State Approach
No prop lifting needed. The aiming phase is already determinable from game state:
- `state.dice === null` (no roll yet)
- `state.phase === GamePhase.Waiting` (waiting for action)
- `state.pendingAction === null` (no pending decision)
- Player is in jail check handled separately

This avoids coupling `DiceRoller` with the hints overlay.

### 4. Integration
**File: `src/components/GameBoard.tsx`**

Add `DiceHints` alongside `PlayerTokens`:

```tsx
<PlayerTokens state={state} myPlayerId={myPlayerId} />
<DiceHints state={state} myPlayerId={myPlayerId} />
```

Also pass `myPlayerId` to `PlayerTokens` (new prop).

### 5. CSS Animations
**File: `src/index.css`**

Add keyframes for the token pulse:

```css
@keyframes token-pulse {
  0%, 100% { box-shadow: 0 0 8px 2px var(--pulse-color); }
  50% { box-shadow: 0 0 16px 4px var(--pulse-color); }
}
```

Add fade-in for dice hint badges.

## Files to Modify
- `src/components/PlayerTokens.tsx` — add `myPlayerId` prop, pulsing animation
- `src/components/DiceHints.tsx` — **new file**, dice hint overlay
- `src/components/GameBoard.tsx` — add `DiceHints`, pass `myPlayerId`
- `src/index.css` — add keyframe animations

## Testing
- **Unit test**: Test `DiceHints` renders correct target cells for various player positions
- **E2E test**: Verify hints appear during aiming phase, disappear after rolling, token is highlighted for current player
