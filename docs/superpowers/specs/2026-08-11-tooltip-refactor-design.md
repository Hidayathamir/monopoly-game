# Monopoly — Property Tooltip Refactor

**Date**: 2026-08-11
**Stack**: React 19 + TypeScript + Vite 8, plain CSS

## Goal

Move all property action buttons (sell, mortgage, unmortgage, build) from the sidebar into the property hover/click tooltip on the board. Sidebar keeps only turn-flow actions.

## Decisions

| Decision | Choice |
|----------|--------|
| Build action | Click "Bangun" in tooltip → builds immediately (no confirmation) |
| Tooltip persistence | Click cell → pin tooltip; click anywhere outside → dismiss |
| Bankruptcy hint | Text only: "Hover properti di papan untuk jual/gadai/tebus aset" |
| Component structure | Extract PropertyTooltip to standalone component with React portal |
| Build pending action | Remove `PendingActionType.Build` entirely |

## Architecture Changes

### New: `src/components/PropertyTooltip.tsx`

Standalone component rendered via React `createPortal` to `document.body`.

Props:
- `space: Space` — board space data
- `state: GameState` — full game state
- `side: CellSide` — board side (top/bottom/left/right/corner)
- `rect: DOMRect` — cell bounding rect for positioning
- `onSell: (id: number) => void`
- `onMortgage: (id: number) => void`
- `onUnmortgage: (id: number) => void`
- `onBuild: (id: number) => void`
- `onDismiss: () => void` — clears pin

Positioning: `position: fixed` + coordinates from `rect` prop. CSS classes (`tooltip-top/-left/-right`) adapted for fixed positioning.

Action buttons:
- **Jual Rumah/Hotel**: `space.houses > 0` → shows sell button
- **Gadai**: `!space.mortgaged && space.houses === 0` → shows mortgage button
- **Tebus**: `space.mortgaged` → shows unmortgage button
- **Bangun**: `space.owner === currentPlayer`, `space.type === 'property'`, `space.houses < 5`, `!space.mortgaged`, `player.money >= space.houseCost`, NOT during bankruptcy → shows build button

All buttons use `e.stopPropagation()` to prevent click propagation.

### Modified: `src/components/BoardGrid.tsx`

Remove `PropertyTooltip` function definition (moves to new file).

Add state:
```ts
const [hoveredId, setHoveredId] = useState<number | null>(null);
const [pinnedId, setPinnedId] = useState<number | null>(null);
const tooltipRef = useRef<HTMLDivElement | null>(null);
```

Logic:
- `onMouseEnter(id)` → clear hide timer, set `hoveredId` (unless `pinnedId` is set)
- `onMouseLeave` → start 150ms timer to clear `hoveredId` (only if `pinnedId !== id`)
- `onClick(id)` → `e.stopPropagation()`, set `pinnedId = id`, clear `hoveredId`
- `useEffect` document `mousedown` listener → if click target is NOT inside tooltip portal AND NOT on a board cell, clear `pinnedId`
- Render: if `pinnedId` → show tooltip for that cell; else if `hoveredId` → show tooltip for that cell

Pass `rect` from cell ref via `ref.getBoundingClientRect()`.

### Modified: `src/components/Sidebar.tsx`

**Removed:**
- Property action buttons from PayRent/Bankruptcy section (lines 94-108)
- Build confirmation section (lines 124-146)
- Props: `onSell`, `onMortgage`, `onUnmortgage`, `onBuild`, `onSkipAction` (if only for build)

**Kept in PayRent/Bankruptcy section:**
- Debt amount display
- Text hint: "Hover properti di papan untuk jual/gadai/tebus aset" (always visible during bankruptcy, styled prominently)
- "Bayar Sewa" button (disabled if can't afford)
- "Nyatakan Bangkrut" button

**Kept unchanged:**
- Buy property offer
- Draw card / card effect
- Jail options
- End turn / trade
- Normal-game hint text

### Modified: `src/App.tsx`

- Add `onBuild={game.buildHouse}` prop to `GameBoard`
- Remove `onSell`, `onMortgage`, `onUnmortgage` from Sidebar props (no longer needed)

### Modified: `src/components/GameBoard.tsx`

- Add `onBuild` prop, pass through to `BoardGrid`

### Modified: `src/types/game.ts`

- Remove `Build: 'build'` from `PendingActionType`
- Remove `{ type: typeof PendingActionType.Build; spaceId: number }` from `PendingAction` union

### Modified: `src/hooks/useGame.ts`

- Remove `buildHouse` — wait, it's still needed. `buildHouse` dispatches `BUILD_HOUSE`. No change needed here.

### Modified: `src/logic/gameReducer.ts`

- `ResolveSpace` (land on own property, line 293-303): Change from setting `pendingAction: { type: PendingActionType.Build }` to just returning `{ ...state, phase: GamePhase.Waiting }`
- `BuildHouse` reducer (line 395): Change `pendingAction: canBuildMore ? { type: PendingActionType.Build, spaceId: action.spaceId } : null` to `pendingAction: null`

### Modified: `src/App.css`

- Move tooltip CSS to standalone styles (tooltip positioning still in App.css or co-located)
- Adjust tooltip positioning classes for `position: fixed` coordinates

## Files Changed Summary

| File | Change |
|------|--------|
| `src/components/PropertyTooltip.tsx` | **NEW** |
| `src/components/BoardGrid.tsx` | Remove PropertyTooltip, add pin/hover state, render new component via portal |
| `src/components/Sidebar.tsx` | Remove property action sections, add bankruptcy hint |
| `src/components/GameBoard.tsx` | Add `onBuild` prop passthrough |
| `src/App.tsx` | Pass `onBuild`, remove unused sidebar props |
| `src/types/game.ts` | Remove `Build` from PendingActionType |
| `src/logic/gameReducer.ts` | Remove Build pending action from ResolveSpace + BuildHouse |
| `src/App.css` | Adjust tooltip CSS if needed |
