# Monopoly — Center Panel Rework

**Date**: 2026-08-14
**Stack**: React 19 + TypeScript + Vite 8, Tailwind CSS v4 (`@theme` in `src/index.css`)

## Goal

Rework the center-of-board overlay from four disconnected cards (dice, actions, players, log) into one cohesive, floating "glass" HUD. Logic and handlers stay untouched; this is a presentation rework only.

## Decisions

| Decision | Choice |
|----------|--------|
| Scope | Entire center overlay (all four sections) |
| Panel shape | Smaller floating card, vertically centered, board visible around it |
| Surface | Glass: translucent navy + `backdrop-blur`, gold hairline border |
| Internal layout | Vertical, focused: header → dice/roll → players → actions → mini-log |
| Player display | Horizontal chips (color dot + name + money), current player highlighted |
| Event log | Collapsed mini-log (last 1–2 lines), expandable to full history |
| Dice | Pip faces (`⚀`…`⚅`) instead of numbers, larger, shake + settle animation |
| Stack note | Styling uses Tailwind v4 (`@theme`), not plain CSS (supersedes older specs) |

## Design tokens (extend `@theme` in `src/index.css`)

Keep all existing colors. Add:

```
--color-panel: rgba(22, 33, 62, 0.72);        /* glass base */
--color-panel-border: rgba(240, 192, 64, 0.18); /* gold hairline */
--color-glass-highlight: rgba(255, 255, 255, 0.06);
```

Type: keep the system font stack; establish a scale via existing Tailwind utilities:
- Eyebrow labels (`GILIRAN`, `PEMAIN`): uppercase, tracked, `text-muted`
- Current player name: `text-gold`, bold, larger
- Body/status: base size, `text-text`/`text-muted`

## Signature element

Pip-faced dice. `Dice.tsx` renders a 3×3 pip grid based on value 1–6 instead of a number, sized up, with `animate-dice-shake` while rolling and a short settle after. This is the single memorable element; all else stays quiet.

## Component changes

### Rewrite: `src/components/Sidebar.tsx`

Becomes a single glass card. Remove the two-branch landscape/portrait grid. Structure (one container, sections as children):

1. **TurnHeader** — eyebrow `GILIRAN` + current player name (gold) + status line.
2. **DiceRoller** — pip dice + `Lempar Dadu` button (context-aware in jail) + roll total after rolling.
3. **PlayerPanel** — horizontal chips, current player highlighted (gold ring/glow).
4. **ActionSection** — contextual buttons, restyled, no inner card boxes.
5. **EventLog** — mini-log (collapsed), expand on click.

The panel is absolutely centered over the board's inner area (keep `data-game-board` coordinate scheme), but sized as a card (`max-w` ~340–380px, `w-[min(90%,…)]`) rather than filling 9×9.

### Rewrite: `src/components/Dice.tsx`

Pip rendering. Keep props `{ value?: number | null, rolling: boolean }`. Internal 3×3 grid with a `PIPS: Record<number, number[]>` map; empty slots hidden. Larger size, rounded, white face, subtle inner shadow.

### Rewrite: `src/components/DiceRoller.tsx`

Same props/logic (`canRoll`, `canRollJail`, `handleRoll`). Visual only: center dice, gold-accented CTA, total line.

### Modify: `src/components/PlayerCard.tsx`

Add a money-balance line (`formatMoney(player.money)`) to the card body. Keep the existing hover popup (owned properties) and money-diff float untouched.

### Rewrite: `src/components/PlayerPanel.tsx`

Keep the money-diff effect logic. Render `PlayerCard`s in a horizontal, wrapping row of chips; the current player's card gets a gold ring/glow. Bankruptcy dims the chip.

### Rewrite: `src/components/ActionSection.tsx`

Keep all branch logic (BuyProperty, PayRent/Bankruptcy, DrawCard, CardEffect, jail, end-turn, trade). Restyle to the panel's flat visual language — no per-branch `bg-bg-card` boxes.

### Rewrite: `src/components/EventLog.tsx`

Keep auto-scroll. Render as collapsed mini-log (last 1–2 entries, dim, one line each with truncation) with a chevron/toggle that expands the full scrollable list in place.

### New: `src/components/TurnHeader.tsx`

Small presentational component: eyebrow, current player name in gold, status line (started, jail, pending-action summary, etc.).

### Unchanged

`App.tsx`, `GameBoard.tsx`, `BoardGrid.tsx`, `Button.tsx`, all logic/hooks/reducers.

## Files changed summary

| File | Change |
|------|--------|
| `src/index.css` | Add glass tokens to `@theme` |
| `src/components/Sidebar.tsx` | Rewrite: single glass card, drop landscape/portrait branches |
| `src/components/Dice.tsx` | Rewrite: pip faces |
| `src/components/DiceRoller.tsx` | Rewrite visuals |
| `src/components/PlayerPanel.tsx` | Rewrite: horizontal chip row |
| `src/components/PlayerCard.tsx` | Add money line, keep popup |
| `src/components/ActionSection.tsx` | Rewrite visuals |
| `src/components/EventLog.tsx` | Rewrite: collapsed mini-log + expand |
| `src/components/TurnHeader.tsx` | **NEW** |

## Out of scope

- Any game logic, reducer, hook, or handler change.
- Modal redesign.
- Board cell / token / tooltip changes.
