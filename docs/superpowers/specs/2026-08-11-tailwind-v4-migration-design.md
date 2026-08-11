# Tailwind v4 Migration — Design Spec

## Goal

Migrate the Monopoly game from a monolithic `App.css` (765 lines, ~70 class groups) to Tailwind CSS v4 utility classes. Extract reusable components during migration. Keep all tests passing at every step.

## Approach: File-by-File, Top-Down (Approach C)

1. Install Tailwind v4, configure Vite plugin, define `@theme` in `index.css`
2. Replace `@keyframes` with Tailwind v4 animation utilities
3. Migrate files in dependency order (leaf → root), extracting components as we go
4. Delete `App.css` after last component migrates
5. Run `npm run test` after each file

## Tailwind v4 Setup

- Install `tailwindcss` + `@tailwindcss/vite` (devDependencies)
- Add plugin to `vite.config.ts`
- Rewrite `index.css` with `@import "tailwindcss"` and `@theme` block
- No `tailwind.config.js` — v4 uses CSS-first configuration

### Theme Tokens

```css
@import "tailwindcss";

@theme {
  --color-bg-main: #1a1a2e;
  --color-bg-card: #16213e;
  --color-bg-cell: #1e3a5f;
  --color-bg-cell-hover: #2a4a6f;
  --color-bg-dark: #0f3460;
  --color-bg-darker: #0a2540;
  --color-gold: #f0c040;
  --color-muted: #a0a0c0;
  --color-text: #e0e0e0;
  --color-text-dim: #c0c0e0;
  --color-green-money: #2ecc71;
  --color-red-danger: #e74c3c;
  --color-cell-go: #1a472a;
  --color-cell-jail: #4a2a2a;
  --color-cell-tax: #3a2a1a;
  --color-cell-chance: #2a2a4a;
  --color-cell-community: #2a3a3a;
  --color-border: #2a2a4a;
  --color-border-light: #2a4a7a;
  --color-orange: #e67e22;
  --color-green-success: #27ae60;
  --color-blue-primary: #3498db;
  --color-input-bg: #0f3460;

  --animate-dice-shake: dice-shake 0.3s ease-in-out infinite;
  --animate-money-float: money-float 1.2s ease-out forwards;
}

@keyframes dice-shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(10deg) scale(1.05); }
  75% { transform: rotate(-10deg) scale(1.05); }
}

@keyframes money-float {
  0% { opacity: 1; transform: translateY(0); }
  60% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-24px); }
}
```

## Component Extraction

| New component | Extracted from | Purpose |
|---|---|---|
| `Button` | All files | Variants: primary, success, secondary, danger, start, small, roll |
| `Modal` (base) | 5 modal variants | Shared overlay + container + actions layout |
| `ActionSection` | `Sidebar.tsx` | 4 conditional action UI branches |
| `PlayerCard` | `PlayerPanel.tsx` | Header + money + property chips per player |
| `Dice` | `DiceRoller.tsx` | Single die face display |

## Migration Order (16 steps)

1. **Install Tailwind v4** — npm install, Vite plugin, `index.css` rewrite
2. **`Button`** — new component, 5+ variants, highest reuse
3. **`Modal`** — new base component, shared by 5 modals
4. **`EventLog`** — tiny leaf component
5. **`Dice`** — extracted from DiceRoller
6. **`DiceRoller`** — uses Dice + Button
7. **`PlayerCard`** — extracted from PlayerPanel
8. **`PlayerPanel`** — uses PlayerCard
9. **`PropertyTooltip`** — uses Button
10. **`BoardGrid`** — 40 cell grid + tooltip portal
11. **`PlayerTokens`** — positional inline styles, minimal changes
12. **`ActionSection`** — extracted from Sidebar
13. **`Sidebar`** — aggregates ActionSection, DiceRoller, PlayerPanel, EventLog
14. **`GameBoard`** — wrapper for BoardGrid + PlayerTokens
15. **`GameSetup`** — setup screen with Button
16. **5 Modals → refactored to Modal base** — BuyProperty, Bankruptcy, GameOver, Card, Trade
17. **`App.tsx`** — remove `import './App.css'`, delete `App.css`

## Component Migration Patterns

### Board cell positions (`.cell-id-0` through `.cell-id-39`)

Current CSS: 40 hardcoded classes with `grid-column` + `grid-row`.  
Tailwind: Use arbitrary values via a `getCellStyle(id)` helper returning `style={{ gridColumn: col, gridRow: row }}` — these are computed values, not utilities. Alternative: use `col-[start/span]` and `row-[start/span]` arbitrary Tailwind.

Static type classes (`.cell-go`, `.cell-jail`, `.cell-property`, etc.): Replace with Tailwind `bg-*` utilities via a lookup map.

### Button component API

```tsx
<Button variant="primary" size="sm" onClick={...}>Label</Button>
```

Variants map to Tailwind: `primary` → `bg-blue-primary`, `success` → `bg-green-success`, etc.

### Modal base API

```tsx
<Modal title="Title" onClose={fn}>
  {children}
  <Modal.Actions>
    <Button ... /><Button ... />
  </Modal.Actions>
</Modal>
```

### Inline styles that stay

- Dynamic colors (playerColors array, property colors from board data)
- Token positions (computed from board position)
- Tooltip positioning (computed from DOM rects)
- These **cannot** be replaced by Tailwind and remain as inline `style` props

## Verification

After each step: `npm run typecheck && npm run test:unit && npm run test:e2e`

## Success criteria

- [ ] `App.css` deleted
- [ ] `index.css` contains only Tailwind import + `@theme` + `@keyframes`
- [ ] Zero build warnings from Tailwind
- [ ] All unit tests pass
- [ ] All e2e tests pass
- [ ] 5 new reusable components extracted
- [ ] Visual output matches original (confirmed via e2e screenshots if any exist)
