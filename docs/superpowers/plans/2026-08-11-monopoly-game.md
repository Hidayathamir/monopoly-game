# Monopoly Game — Indonesian Edition Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured 2-4 player Monopoly game with Indonesian cities in React + TypeScript.

**Architecture:** Single-page app with `useReducer` state machine. No routing. All game logic in pure functions. Components are stateless, dispatching actions to the reducer.

**Tech Stack:** React 19, TypeScript 6, Vite 8, plain CSS

## Global Constraints

- No external UI libraries — plain CSS only
- No backend — all state in memory
- Pass-and-play single device
- Player colors: #E74C3C, #3498DB, #2ECC71, #F39C12
- All money/costs use `$` prefix
- Indonesian city names for properties
- GO = "MULAI", Jail = "Penjara", Free Parking = "Parkir Gratis"

## File Structure

```
src/
├── App.tsx, App.css, main.tsx
├── types/game.ts
├── data/board.ts, chanceCards.ts, communityCards.ts
├── logic/gameReducer.ts, rent.ts, cards.ts
├── hooks/useGame.ts
├── components/
│   ├── GameSetup.tsx, GameBoard.tsx, BoardGrid.tsx
│   ├── PlayerTokens.tsx, PropertyCard.tsx
│   ├── Sidebar.tsx, DiceRoller.tsx, ActionButtons.tsx
│   ├── PlayerPanel.tsx, EventLog.tsx
│   └── Modals/*.tsx (7 files)
└── styles/board.css
```

---

### Task 1: Types and Data Foundation

**Files:** Create `src/types/game.ts`, `src/data/board.ts`, `src/data/chanceCards.ts`, `src/data/communityCards.ts`

**Interfaces:**
- Produces: `GameState`, `Player`, `Space`, `Card`, `GameAction` types; `INITIAL_BOARD`, `CHANCE_CARDS`, `COMMUNITY_CARDS` constants

- [ ] Create types/game.ts with all type definitions
- [ ] Create data/board.ts with 40 spaces
- [ ] Create data/chanceCards.ts with ~10 cards
- [ ] Create data/communityCards.ts with ~10 cards
- [ ] Run `npx tsc -b --noEmit` to verify types compile

### Task 2: Logic Layer

**Files:** Create `src/logic/rent.ts`, `src/logic/cards.ts`

**Interfaces:**
- Consumes: `Space`, `Player`, `GameState`, `Card` from types
- Produces: `calculateRent()`, `calculateRailroadRent()`, `calculateUtilityRent()`, `resolveCardEffect()`

- [ ] Create rent.ts with rent calculation for properties, railroads, utilities
- [ ] Create cards.ts with card effect resolution
- [ ] Write unit tests for rent.ts

### Task 3: Game Reducer

**Files:** Create `src/logic/gameReducer.ts`

**Interfaces:**
- Consumes: All types, rent.ts, cards.ts, board data
- Produces: `gameReducer(state, action)`, `createInitialState()`, action creators

- [ ] Create gameReducer with full state machine
- [ ] Implement all actions: ROLL_DICE, MOVE, BUY, BUILD, SELL, MORTGAGE, UNMORTGAGE, TRADE, DRAW_CARD, END_TURN, etc.

### Task 4: useGame Hook

**Files:** Create `src/hooks/useGame.ts`

- [ ] Wrap useReducer in useGame hook with convenience methods

### Task 5: GameSetup Component

**Files:** Create `src/components/GameSetup.tsx`

- [ ] Player count selector + name inputs + start button

### Task 6: Board Components

**Files:** Create `src/components/GameBoard.tsx`, `BoardGrid.tsx`, `PlayerTokens.tsx`, `PropertyCard.tsx`

- [ ] BoardGrid — CSS grid rendering 40 spaces
- [ ] PlayerTokens — colored tokens on board
- [ ] PropertyCard — hover tooltip
- [ ] GameBoard — compose all three

### Task 7: Sidebar Components

**Files:** Create `src/components/Sidebar.tsx`, `DiceRoller.tsx`, `ActionButtons.tsx`, `PlayerPanel.tsx`, `EventLog.tsx`

- [ ] DiceRoller with animated dice
- [ ] ActionButtons (buy, build, sell, mortgage, trade, end turn)
- [ ] PlayerPanel showing money + properties
- [ ] EventLog — scrollable history
- [ ] Sidebar — compose all

### Task 8: Modals

**Files:** Create `src/components/Modals/BuyPropertyModal.tsx`, `BuildModal.tsx`, `TradeModal.tsx`, `MortgageModal.tsx`, `CardModal.tsx`, `BankruptcyModal.tsx`, `GameOverModal.tsx`

- [ ] All 7 modals with proper dispatch logic

### Task 9: App Integration + CSS

**Files:** Modify `src/App.tsx`, `src/App.css`, create `src/styles/board.css`

- [ ] Wire all components in App.tsx
- [ ] Write all CSS styles

### Task 10: Verification

- [ ] `npx tsc -b` — typecheck
- [ ] `npx vitest run` — tests
- [ ] `npm run lint` — lint

---
