# Tailwind v4 Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Monopoly game from a monolithic `App.css` (765 lines) to Tailwind CSS v4 utility classes, extracting reusable components along the way.

**Architecture:** Install Tailwind v4 via Vite plugin, define `@theme` tokens in `index.css`, and migrate 12 existing components file-by-file in leaf-to-root dependency order. Extract 5 new reusable components (Button, Modal, ActionSection, PlayerCard, Dice). Delete `App.css` at the end.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4, `@tailwindcss/vite`, Vitest, Playwright

## Global Constraints

- Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)
- Full utility-class migration — delete `App.css` when done
- Extract reusable components during migration (Button, Modal, ActionSection, PlayerCard, Dice)
- Keep `npm run typecheck && npm run test:unit` passing after every task
- E2e tests will be updated with `data-testid` selectors in the final task
- Inline styles for dynamic values (player colors, token positions, tooltip positioning) remain — they are not replaceable by Tailwind

---

### Task 1: Install Tailwind v4 & Configure Theme

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: Tailwind CSS available globally; theme tokens `bg-main`, `bg-card`, `bg-cell`, `gold`, `muted`, `text`, `text-dim`, `green-money`, `red-danger`, `border`, `border-light`, `blue-primary`, `green-success`, `orange`, `input-bg`; animations `animate-dice-shake`, `animate-money-float`

- [ ] **Step 1: Install dependencies**

```bash
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add Tailwind plugin to vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
```

- [ ] **Step 3: Rewrite src/index.css**

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
  --color-cell-free-parking: #2a3a2a;

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

- [ ] **Step 4: Remove old import from src/main.tsx**

Change:
```tsx
import './index.css'
```
to keep only:
```tsx
import './index.css'
```
(No change needed — this import stays, file content replaced above.)

- [ ] **Step 5: Verify**

```bash
npx tsc -b
npm run test:unit
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/index.css
git commit -m "chore: install Tailwind CSS v4 with @theme configuration"
```

---

### Task 2: Create Button Component

**Files:**
- Create: `src/components/Button.tsx`

**Interfaces:**
- Consumes: Tailwind theme tokens from Task 1
- Produces: `<Button variant="primary" size="md" onClick={fn}>Label</Button>`
  - variant: `"primary" | "success" | "secondary" | "danger" | "start"`
  - size: `"sm" | "md" | "lg"` (default `"md"`)
  - All standard button props forwarded

- [ ] **Step 1: Create Button.tsx**

```tsx
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'secondary' | 'danger' | 'start'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses: Record<string, string> = {
  primary: 'bg-blue-primary text-white',
  success: 'bg-green-success text-white',
  secondary: 'bg-orange text-white',
  danger: 'bg-red-danger text-white',
  start: 'bg-gold text-bg-main',
}

const sizeClasses: Record<string, string> = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3.5 py-1.5 text-xs',
  lg: 'px-5 py-2.5 text-[15px]',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'rounded-lg border-none cursor-pointer font-semibold w-full my-[3px] transition-transform duration-150 hover:-translate-y-px hover:opacity-90',
        variantClasses[variant],
        sizeClasses[size],
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className,
      ].join(' ')}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Button.tsx
git commit -m "feat: add reusable Button component with Tailwind variants"
```

---

### Task 3: Create Modal Base Component

**Files:**
- Create: `src/components/Modals/Modal.tsx`

**Interfaces:**
- Consumes: Button from Task 2
- Produces: `<Modal onClose={fn}>{children}</Modal>` with `Modal.Actions` for button row
  - Renders overlay with centered modal card
  - `Modal.Actions` renders a flex row with gap

- [ ] **Step 1: Create Modal.tsx**

```tsx
import type { ReactNode } from 'react'

interface ModalProps {
  children: ReactNode
  onClose?: () => void
  className?: string
}

export default function Modal({ children, className = '', onClose }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
    >
      <div
        className={[
          'bg-bg-card rounded-xl p-6 min-w-80 max-w-[500px] flex flex-col gap-3',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}

function ModalActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 mt-2">
      {children}
    </div>
  )
}

Modal.Actions = ModalActions
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Modals/Modal.tsx
git commit -m "feat: add reusable Modal base component"
```

---

### Task 4: Extract Dice Component + Migrate DiceRoller

**Files:**
- Create: `src/components/Dice.tsx`
- Modify: `src/components/DiceRoller.tsx`

**Interfaces:**
- Consumes: Button from Task 2, Tailwind from Task 1
- Produces: `<Dice value={3} rolling={false} />` — renders a single die face
- Since Button is now available, migrate DiceRoller to use Button + Dice + Tailwind classes

- [ ] **Step 1: Create Dice.tsx**

```tsx
interface DiceProps {
  value?: number | null
  rolling: boolean
}

export default function Dice({ value, rolling }: DiceProps) {
  return (
    <div
      className={[
        'w-11 h-11 bg-white text-bg-main rounded-lg flex items-center justify-center text-xl font-bold',
        rolling ? 'animate-dice-shake' : '',
      ].join(' ')}
    >
      {value ?? '?'}
    </div>
  )
}
```

- [ ] **Step 2: Verify Dice**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Migrate DiceRoller.tsx**

Replace all current `className` strings with Tailwind utilities, and use `Button` + `Dice` components:

```tsx
import { useState } from 'react'
import { GamePhase, type GameState } from '../types/game'
import Dice from './Dice'
import Button from './Button'

interface Props {
  state: GameState
  onRoll: () => void
}

export default function DiceRoller({ state, onRoll }: Props) {
  const [rolling, setRolling] = useState(false)
  const player = state.players[state.currentPlayer]

  function handleRoll() {
    setRolling(true)
    onRoll()
    setTimeout(() => setRolling(false), 500)
  }

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail

  return (
    <div className="bg-bg-card rounded-lg p-2 flex-shrink-0">
      <div className="flex gap-3 justify-center mb-1.5">
        <Dice value={state.dice?.[0]} rolling={rolling} />
        <Dice value={state.dice?.[1]} rolling={rolling} />
      </div>
      {(canRoll || canRollJail) && (
        <Button variant="primary" size="lg" onClick={handleRoll}>
          {player.inJail ? '🎲 Lempar Dadu (Penjara)' : '🎲 Lempar Dadu'}
        </Button>
      )}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="text-[11px] text-muted text-center mt-1">
          Ganda? {state.dice[0] === state.dice[1] ? 'Ya! 🎉' : 'Tidak 😔'} — {3 - player.jailTurns}x lagi
        </p>
      )}
      {state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice !== null && (
        <p className="text-[11px] text-muted text-center mt-1">
          {state.dice[0]} + {state.dice[1]} = {state.dice[0] + state.dice[1]}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Dice.tsx src/components/DiceRoller.tsx
git commit -m "feat: extract Dice component, migrate DiceRoller to Tailwind + Button"
```

---

### Task 5: Migrate EventLog

**Files:**
- Modify: `src/components/EventLog.tsx`

**Interfaces:**
- Consumes: Tailwind from Task 1
- Produces: Unchanged component API — `{ log: string[] }`

- [ ] **Step 1: Migrate EventLog.tsx**

```tsx
import { useRef, useEffect } from 'react'

interface Props {
  log: string[]
}

export default function EventLog({ log }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [log])

  return (
    <div
      data-testid="event-log"
      className="max-h-10 overflow-y-auto text-[9px] flex flex-col gap-px flex-shrink-0 w-full p-1 bg-bg-dark rounded"
      ref={ref}
    >
      {log.map((entry, i) => (
        <div
          key={i}
          data-testid="event-entry"
          className="py-0.5 px-1 border-b border-[#1a2a4a] text-muted"
        >
          {entry}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/EventLog.tsx
git commit -m "feat: migrate EventLog to Tailwind, add data-testid"
```

---

### Task 6: Extract PlayerCard Component

**Files:**
- Create: `src/components/PlayerCard.tsx`

**Interfaces:**
- Consumes: Tailwind from Task 1
- Produces: `<PlayerCard player={Player} isCurrent={boolean} color={string} properties={Space[]} diff={number|null} diffKey={number} />`
  - Renders a player card with header (dot + name + badges), money with optional MoneyChange, and property chips
  - Includes internal `MoneyChange` sub-component

- [ ] **Step 1: Create PlayerCard.tsx**

```tsx
import { useEffect, useState } from 'react'
import type { Player, Space } from '../types/game'
import { formatMoney } from '../utils/format'

function MoneyChange({ diff }: { diff: number }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1200)
    return () => clearTimeout(t)
  }, [diff])

  if (!visible) return null
  const isGain = diff > 0
  return (
    <span
      className={[
        'ml-2 text-[13px] font-bold inline-block animate-money-float',
        isGain ? 'text-green-money' : 'text-red-danger',
      ].join(' ')}
    >
      {isGain ? '+' : ''}{formatMoney(diff)}
    </span>
  )
}

interface PlayerCardProps {
  player: Player
  isCurrent: boolean
  color: string
  properties: Space[]
  diff?: { diff: number; key: number } | null
}

export default function PlayerCard({ player, isCurrent, color, properties, diff }: PlayerCardProps) {
  return (
    <div
      data-testid="player-card"
      className={[
        'p-1.5 mb-1 rounded-md bg-bg-dark border-l-[3px] overflow-hidden',
        isCurrent ? 'bg-[#1a4a7a] border-l-[4px]' : '',
        player.bankrupt ? 'opacity-50' : '',
      ].join(' ')}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center gap-1.5 text-xs mb-0.5">
        <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: color }} />
        <strong>{player.name}</strong>
        {player.inJail && <span className="text-xs">🔒</span>}
        {player.bankrupt && <span className="text-[9px] font-bold text-red-danger">BANGKRUT</span>}
      </div>
      <div className="text-sm font-bold text-green-money">
        {formatMoney(player.money)}
        {diff && <MoneyChange key={diff.key} diff={diff.diff} />}
      </div>
      {properties.length > 0 && (
        <div className="flex flex-wrap gap-[3px] mt-1">
          {properties.map((s) => (
            <span
              key={s.id}
              className="text-[9px] py-0.5 px-1.5 bg-bg-darker rounded border-l-2 whitespace-nowrap"
              style={{ borderLeftColor: s.color ?? '#888' }}
              title={`${s.name}${s.mortgaged ? ' (Digadai)' : ''}${s.houses > 0 ? ` (${s.houses === 5 ? 'Hotel' : `${s.houses}🏠`})` : ''}`}
            >
              {s.mortgaged ? '🔸' : ''}{s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerCard.tsx
git commit -m "feat: extract PlayerCard component with Tailwind styling"
```

---

### Task 7: Migrate PlayerPanel (uses PlayerCard)

**Files:**
- Modify: `src/components/PlayerPanel.tsx`

**Interfaces:**
- Consumes: PlayerCard from Task 6, Tailwind from Task 1
- Produces: Unchanged API — `{ state: GameState; playerColors: string[] }`

- [ ] **Step 1: Migrate PlayerPanel.tsx to use PlayerCard + Tailwind**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types/game'
import { GO_SALARY } from '../data/board'
import PlayerCard from './PlayerCard'

interface Props {
  state: GameState
  playerColors: string[]
}

export default function PlayerPanel({ state, playerColors }: Props) {
  const { players, board, currentPlayer } = state
  const prevMoney = useRef<Record<number, number>>({})
  const prevPos = useRef<Record<number, number>>({})
  const [diffs, setDiffs] = useState<Record<number, { diff: number; key: number }>>({})
  const diffCounter = useRef(0)

  useEffect(() => {
    const newDiffs: Record<number, { diff: number; key: number }> = {}
    players.forEach((p) => {
      const prev = prevMoney.current[p.id]
      const oldPos = prevPos.current[p.id]
      if (prev !== undefined && prev !== p.money) {
        const passedGO = oldPos !== undefined && p.position < oldPos && (p.money - prev) >= GO_SALARY
        if (!passedGO) {
          diffCounter.current += 1
          newDiffs[p.id] = { diff: p.money - prev, key: diffCounter.current }
        }
      }
      prevMoney.current[p.id] = p.money
      prevPos.current[p.id] = p.position
    })
    if (Object.keys(newDiffs).length > 0) setDiffs(newDiffs)
  }, [players])

  return (
    <div className="bg-bg-card rounded-lg p-2 flex-1 min-h-0 overflow-y-auto flex flex-col">
      <h3 className="text-sm text-gold m-0 mb-1.5">Pemain</h3>
      {players.map((player) => {
        const isCurrent = player.id === currentPlayer
        const properties = board.filter((s) => s.owner === player.id)

        return (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrent={isCurrent}
            color={playerColors[player.id]}
            properties={properties}
            diff={diffs[player.id] ?? null}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerPanel.tsx
git commit -m "feat: migrate PlayerPanel to Tailwind, use PlayerCard component"
```

---

### Task 8: Migrate PropertyTooltip

**Files:**
- Modify: `src/components/PropertyTooltip.tsx`

**Interfaces:**
- Consumes: Button from Task 2, Tailwind from Task 1
- Produces: Unchanged API — `{ space: Space; state: GameState; rect: DOMRect; boardRect: DOMRect; side: CellSide; onSell; onMortgage; onUnmortgage; onBuild }`

- [ ] **Step 1: Migrate PropertyTooltip.tsx**

Replace all className strings and use Button component:

```tsx
import { PendingActionType, type GameState, type Space } from '../types/game'
import { formatMoney } from '../utils/format'
import Button from './Button'

export type CellSide = 'top' | 'right' | 'bottom' | 'left' | 'corner'

interface Props {
  space: Space
  state: GameState
  rect: DOMRect
  boardRect: DOMRect
  side: CellSide
  onSell: (id: number) => void
  onMortgage: (id: number) => void
  onUnmortgage: (id: number) => void
  onBuild: (id: number) => void
}

export default function PropertyTooltip({
  space, state, rect, boardRect, side, onSell, onMortgage, onUnmortgage, onBuild,
}: Props) {
  const owner = space.owner !== null ? state.players[space.owner] : null
  const isBuyable = space.type === 'property' || space.type === 'railroad' || space.type === 'utility'
  const isOwned = space.owner === state.currentPlayer
  const isBankruptcy = state.pendingAction?.type === PendingActionType.Bankruptcy

  const canBuild =
    space.type === 'property' &&
    space.houses < 5 &&
    !space.mortgaged &&
    !isBankruptcy &&
    state.players[state.currentPlayer]?.money >= (space.houseCost ?? Infinity)

  const gap = 6
  const top = rect.top - boardRect.top
  const left = rect.left - boardRect.left
  const topCorner = space.id === 20 || space.id === 30

  let tooltipStyle: React.CSSProperties
  switch (side) {
    case 'left':
      tooltipStyle = {
        position: 'absolute', top: top + rect.height + gap, left: left + rect.width / 2,
        bottom: 'auto', right: 'auto', transform: 'translateX(-50%)',
      }
      break
    case 'right':
      tooltipStyle = {
        position: 'absolute', top: top + rect.height / 2, left: left - gap,
        bottom: 'auto', right: 'auto', transform: 'translate(-100%, -50%)',
      }
      break
    case 'top':
      tooltipStyle = {
        position: 'absolute', top: top + rect.height / 2, left: left + rect.width + gap,
        bottom: 'auto', right: 'auto', transform: 'translateY(-50%)',
      }
      break
    case 'corner':
      if (topCorner) {
        tooltipStyle = {
          position: 'absolute', top: top + rect.height + gap, left: left + rect.width / 2,
          bottom: 'auto', right: 'auto', transform: 'translateX(-50%)',
        }
      } else {
        tooltipStyle = {
          position: 'absolute', top: top - gap, left: left + rect.width / 2,
          bottom: 'auto', right: 'auto', transform: 'translate(-50%, -100%)',
        }
      }
      break
    case 'bottom':
    default:
      tooltipStyle = {
        position: 'absolute', top: top - gap, left: left + rect.width / 2,
        bottom: 'auto', right: 'auto', transform: 'translate(-50%, -100%)',
      }
      break
  }

  return (
    <div
      className="absolute bg-bg-dark border border-border-light rounded-lg px-3 py-2.5 min-w-[160px] z-[999] shadow-lg pointer-events-auto"
      style={tooltipStyle}
    >
      <div className="text-xs text-gold mb-1 border-l-[3px] pl-1.5" style={space.color ? { borderLeftColor: space.color } : {}}>
        <strong>{space.name}</strong>
      </div>
      {space.mortgaged && <div className="text-[10px] text-red-danger font-bold">Digadaikan</div>}
      {isBuyable && space.price && (
        <>
          <div className="text-[10px] text-text-dim m-0.5">Harga: <strong className="text-green-money">{formatMoney(space.price)}</strong></div>
          {space.rent && space.type === 'property' && (
            <div className="my-1 p-1 bg-bg-darker rounded text-[10px]">
              <div className="text-text-dim">Sewa dasar: {formatMoney(space.rent[0])}</div>
              <div className="text-text-dim">1 🏠 : {formatMoney(space.rent[1])}</div>
              <div className="text-text-dim">2 🏠 : {formatMoney(space.rent[2])}</div>
              <div className="text-text-dim">3 🏠 : {formatMoney(space.rent[3])}</div>
              <div className="text-text-dim">4 🏠 : {formatMoney(space.rent[4])}</div>
              <div className="text-text-dim">🏨 : {formatMoney(space.rent[space.rent.length - 1])}</div>
            </div>
          )}
          {space.rent && space.type === 'railroad' && (
            <div className="my-1 p-1 bg-bg-darker rounded text-[10px]">
              <div className="text-text-dim">1 Stasiun: {formatMoney(space.rent[0])}</div>
              <div className="text-text-dim">2 Stasiun: {formatMoney(space.rent[1])}</div>
              <div className="text-text-dim">3 Stasiun: {formatMoney(space.rent[2])}</div>
              <div className="text-text-dim">4 Stasiun: {formatMoney(space.rent[3])}</div>
            </div>
          )}
          {space.type === 'utility' && (
            <div className="my-1 p-1 bg-bg-darker rounded text-[10px]">
              <div className="text-text-dim">1 Perusahaan: 4× Dadu</div>
              <div className="text-text-dim">2 Perusahaan: 10× Dadu</div>
            </div>
          )}
          {space.houseCost && <div className="text-[10px] text-text-dim">Biaya rumah: {formatMoney(space.houseCost)}</div>}
          {space.houses > 0 && (
            <div className="text-[10px] text-text-dim">
              Level: {space.houses === 5 ? '🏨 Hotel' : '🏠'.repeat(space.houses)}
            </div>
          )}
        </>
      )}
      {owner && (
        <div className="text-[10px] text-text-dim">
          Pemilik: <span className="text-gold">{owner.name}</span>
        </div>
      )}
      {isOwned && (
        <div className="mt-1.5 pt-1.5 border-t border-border-light flex flex-col gap-[3px]">
          {space.houses > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onSell(space.id) }}
            >
              Jual {space.houses === 5 ? 'Hotel' : 'Rumah'} (+{formatMoney(Math.floor((space.houseCost ?? 0) / 2))})
            </Button>
          )}
          {!space.mortgaged && space.houses === 0 && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onMortgage(space.id) }}>
              Gadai (+{formatMoney(Math.floor((space.price ?? 0) / 2))})
            </Button>
          )}
          {space.mortgaged && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onUnmortgage(space.id) }}>
              Tebus (-{formatMoney(Math.floor((space.price ?? 0) / 2 * 1.1))})
            </Button>
          )}
          {canBuild && (
            <Button
              size="sm"
              variant="success"
              onClick={(e) => { e.stopPropagation(); onBuild(space.id) }}
            >
              Bangun ({formatMoney(space.houseCost!)})
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PropertyTooltip.tsx
git commit -m "feat: migrate PropertyTooltip to Tailwind + Button component"
```

---

### Task 9: Migrate BoardGrid

**Files:**
- Modify: `src/components/BoardGrid.tsx`

**Interfaces:**
- Consumes: PropertyTooltip from Task 8, Tailwind from Task 1
- Produces: Unchanged API

**Key challenge:** 40 `.cell-id-X` classes for grid positioning. Replace with computed inline styles on each cell. Cell type classes (`.cell-go`, `.cell-jail`, etc.) become a Tailwind class lookup map.

- [ ] **Step 1: Migrate BoardGrid.tsx**

```tsx
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { GameState } from '../types/game'
import { formatMoney } from '../utils/format'
import PropertyTooltip, { type CellSide } from './PropertyTooltip'

interface Props {
  state: GameState
  playerColors: string[]
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onBuild: (spaceId: number) => void
}

function getSide(id: number): CellSide {
  if (id === 0 || id === 10 || id === 20 || id === 30) return 'corner'
  if (id <= 9) return 'bottom'
  if (id <= 19) return 'right'
  if (id <= 29) return 'left'
  return 'top'
}

function getCellPosition(id: number): { gridColumn: number; gridRow: number } | null {
  if (id === 0) return { gridColumn: 11, gridRow: 11 }
  if (id >= 1 && id <= 9) return { gridColumn: 10 - (id - 1), gridRow: 11 }
  if (id === 10) return { gridColumn: 1, gridRow: 11 }
  if (id >= 11 && id <= 19) return { gridColumn: 1, gridRow: 10 - (id - 11) }
  if (id === 20) return { gridColumn: 1, gridRow: 1 }
  if (id >= 21 && id <= 29) return { gridColumn: 2 + (id - 21), gridRow: 1 }
  if (id === 30) return { gridColumn: 11, gridRow: 1 }
  return { gridColumn: 11, gridRow: 2 + (id - 31) }
}

const TYPE_BG: Record<string, string> = {
  go: 'bg-cell-go',
  jail: 'bg-cell-jail',
  goToJail: 'bg-cell-jail',
  freeParking: 'bg-cell-free-parking',
  tax: 'bg-cell-tax',
  chance: 'bg-cell-chance',
  community: 'bg-cell-community',
}

const HIDE_DELAY = 400

export default function BoardGrid({ state, playerColors, onSell, onMortgage, onUnmortgage, onBuild }: Props) {
  const { board } = state
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [tooltipCellRect, setTooltipCellRect] = useState<DOMRect | null>(null)
  const [boardRect, setBoardRect] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardGridRef = useRef<HTMLDivElement | null>(null)

  function handleEnter(id: number, e: React.MouseEvent) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const board = boardGridRef.current?.closest('.game-board')
    if (board) setBoardRect(board.getBoundingClientRect())
    setTooltipCellRect((e.currentTarget as HTMLElement).getBoundingClientRect())
    setHoveredId(id)
  }

  function handleLeave() {
    timerRef.current = setTimeout(() => setHoveredId(null), HIDE_DELAY)
  }

  const portalTarget = boardGridRef.current?.closest('.game-board') as HTMLElement | null

  return (
    <div
      className="grid grid-cols-11 grid-rows-11 w-full h-full overflow-visible relative z-[1]"
      ref={boardGridRef}
    >
      {board.map((space) => {
        const owner = space.owner !== null ? state.players[space.owner] : null
        const pos = getCellPosition(space.id)

        return (
          <div
            key={space.id}
            className={[
              'border border-border text-[9px] flex flex-col items-center justify-center relative overflow-visible p-0.5',
              'hover:bg-bg-cell-hover hover:z-[2]',
              TYPE_BG[space.type] ?? 'bg-bg-cell',
              space.type === 'chance' ? '[&_.cell-name]:text-gold' : '',
              space.type === 'community' ? '[&_.cell-name]:text-[#40c0f0]' : '',
            ].join(' ')}
            style={{
              ...(pos ? { gridColumn: pos.gridColumn, gridRow: pos.gridRow } : {}),
              ...(space.color ? { background: `${space.color}30` } : {}),
            }}
            onMouseEnter={(e) => handleEnter(space.id, e)}
            onMouseLeave={handleLeave}
          >
            <div className="text-[7px] text-center font-semibold leading-tight text-text-dim">{space.name}</div>
            {space.price && <div className="text-[7px] text-[#80c080]">{formatMoney(space.price)}</div>}
            {space.houses > 0 && space.houses < 5 && (
              <div className="text-[7px] tracking-[-1px]">{'🏠'.repeat(space.houses)}</div>
            )}
            {space.houses === 5 && <div className="text-[10px]">🏨</div>}
            {space.mortgaged && (
              <div className="absolute top-px right-0.5 text-[7px] bg-red-danger text-white rounded-sm px-0.5 font-bold">M</div>
            )}
            {owner && (
              <div
                className="absolute bottom-0 left-0 w-full h-1 z-[1]"
                style={{ backgroundColor: playerColors[owner.id] }}
              />
            )}
          </div>
        )
      })}

      {hoveredId != null && tooltipCellRect && boardRect && portalTarget &&
        createPortal(
          <PropertyTooltip
            space={board[hoveredId]}
            state={state}
            rect={tooltipCellRect}
            boardRect={boardRect}
            side={getSide(hoveredId)}
            onSell={onSell}
            onMortgage={onMortgage}
            onUnmortgage={onUnmortgage}
            onBuild={onBuild}
          />,
          portalTarget,
        )
      }
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BoardGrid.tsx
git commit -m "feat: migrate BoardGrid to Tailwind, replace 40 CSS classes with computed positioning"
```

---

### Task 10: Migrate PlayerTokens

**Files:**
- Modify: `src/components/PlayerTokens.tsx`

**Interfaces:**
- Consumes: Tailwind from Task 1
- Produces: Unchanged API

- [ ] **Step 1: Migrate PlayerTokens.tsx**

```tsx
import { useState, useEffect, useRef } from 'react'
import type { GameState } from '../types/game'

interface Props {
  state: GameState
  playerColors: string[]
}

const RATIO = 100 / 11

function c(col: number, row: number) {
  return {
    x: Math.round((col - 0.5) * RATIO * 100) / 100,
    y: Math.round((row - 0.5) * RATIO * 100) / 100,
  }
}

const POSITIONS: Record<number, { x: number; y: number }> = {
  0: c(11, 11), 1: c(10, 11), 2: c(9, 11), 3: c(8, 11),
  4: c(7, 11), 5: c(6, 11), 6: c(5, 11), 7: c(4, 11),
  8: c(3, 11), 9: c(2, 11), 10: c(1, 11), 11: c(1, 10),
  12: c(1, 9), 13: c(1, 8), 14: c(1, 7), 15: c(1, 6),
  16: c(1, 5), 17: c(1, 4), 18: c(1, 3), 19: c(1, 2),
  20: c(1, 1), 21: c(2, 1), 22: c(3, 1), 23: c(4, 1),
  24: c(5, 1), 25: c(6, 1), 26: c(7, 1), 27: c(8, 1),
  28: c(9, 1), 29: c(10, 1), 30: c(11, 1), 31: c(11, 2),
  32: c(11, 3), 33: c(11, 4), 34: c(11, 5), 35: c(11, 6),
  36: c(11, 7), 37: c(11, 8), 38: c(11, 9), 39: c(11, 10),
}

const OFFSETS: Record<number, { dx: number; dy: number }> = {
  0: { dx: -8, dy: -8 }, 1: { dx: 8, dy: -8 },
  2: { dx: -8, dy: 8 }, 3: { dx: 8, dy: 8 },
}

function getPath(from: number, to: number): number[] {
  if (from === to) return []
  const path: number[] = []
  let current = from
  if (to === 0 && from > 0) {
    for (let i = 0; i < 40 - from; i++) {
      current = (current + 1) % 40
      path.push(current)
    }
    return path
  }
  if (to < from && from - to <= 12) {
    for (let i = 0; i < from - to; i++) {
      current = (current - 1 + 40) % 40
      path.push(current)
    }
    return path
  }
  const steps = to > from ? to - from : 40 - from + to
  for (let i = 0; i < steps; i++) {
    current = (current + 1) % 40
    path.push(current)
  }
  return path
}

export default function PlayerTokens({ state, playerColors }: Props) {
  const { players } = state
  const [displayPositions, setDisplayPositions] = useState<Record<number, number>>({})
  const prevTargets = useRef<Record<number, number>>({})
  const animating = useRef<Record<number, boolean>>({})

  useEffect(() => {
    players.forEach((player) => {
      const prevTarget = prevTargets.current[player.id] ?? 0
      if (prevTarget === player.position) return
      if (animating.current[player.id]) return
      prevTargets.current[player.id] = player.position
      if (player.inJail && player.position === 10) {
        setDisplayPositions((prev) => ({ ...prev, [player.id]: 10 }))
        animating.current[player.id] = false
        return
      }
      animating.current[player.id] = true
      const path = getPath(displayPositions[player.id] ?? prevTarget, player.position)
      function step(index: number) {
        if (index >= path.length) { animating.current[player.id] = false; return }
        setDisplayPositions((prev) => ({ ...prev, [player.id]: path[index] }))
        setTimeout(() => step(index + 1), 150)
      }
      if (path.length > 0) { setTimeout(() => step(0), 50) }
      else { animating.current[player.id] = false }
    })
  }, [players.map((p) => `${p.id}:${p.position}`).join(','), displayPositions])

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {players.map((player) => {
        const posId = displayPositions[player.id] ?? player.position
        const pos = POSITIONS[posId] ?? POSITIONS[0]
        const offset = OFFSETS[player.id] ?? OFFSETS[0]
        return (
          <div
            key={player.id}
            className={[
              'absolute w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold text-white',
              'border-2 border-white -translate-x-1/2 -translate-y-1/2 z-10',
              state.currentPlayer === player.id ? 'border-[3px] shadow-[0_0_8px_rgba(255,255,255,0.5)]' : '',
              player.bankrupt ? 'opacity-30' : '',
            ].join(' ')}
            style={{
              backgroundColor: playerColors[player.id],
              left: `calc(${pos.x}% + ${offset.dx}px)`,
              top: `calc(${pos.y}% + ${offset.dy}px)`,
              transition: 'left 0.12s ease-in-out, top 0.12s ease-in-out',
            }}
            title={player.name}
          >
            {player.id + 1}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerTokens.tsx
git commit -m "feat: migrate PlayerTokens to Tailwind"
```

---

### Task 11: Extract ActionSection from Sidebar

**Files:**
- Create: `src/components/ActionSection.tsx`
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: Button from Task 2, Tailwind from Task 1
- Produces: Standalone `ActionSection` component with same props as current inline block
- Sidebar.tsx imports and uses `ActionSection`, removing the inline `ActionSection` function

- [ ] **Step 1: Create ActionSection.tsx**

```tsx
import { GamePhase, PendingActionType, type GameState } from '../types/game'
import { formatMoney } from '../utils/format'
import { JAIL_FINE } from '../data/board'
import Button from './Button'

interface Props {
  state: GameState
  onEndTurn: () => void
  onDrawCard: () => void
  onProposeTrade: () => void
  onBuyProperty: () => void
  onDeclineBuy: () => void
  onPayRent: () => void
  onDeclareBankruptcy: () => void
  onPayJailFine: () => void
  onUseGetOutOfJailFree: () => void
}

export default function ActionSection({
  state, onEndTurn, onDrawCard, onProposeTrade, onBuyProperty,
  onDeclineBuy, onPayRent, onDeclareBankruptcy, onPayJailFine, onUseGetOutOfJailFree,
}: Props) {
  const player = state.players[state.currentPlayer]
  const pending = state.pendingAction
  const canAct = state.phase === GamePhase.Waiting && !pending
  const hasRolled = state.dice !== null

  if (pending?.type === PendingActionType.BuyProperty) {
    const space = state.board[pending.spaceId]
    return (
      <div className="bg-bg-card rounded-lg p-2 flex-shrink-0">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-xs my-[3px] text-center">Beli <strong>{space.name}</strong>?</p>
          <p className="text-xs my-[3px] text-center">Harga: <strong>{formatMoney(space.price)}</strong></p>
          <Button variant="success" onClick={onBuyProperty}>Beli ({formatMoney(space.price)})</Button>
          <Button variant="secondary" onClick={onDeclineBuy}>Tidak</Button>
        </div>
      </div>
    )
  }

  if (pending?.type === PendingActionType.PayRent || pending?.type === PendingActionType.Bankruptcy) {
    const amount = pending.amount
    const canAffordNow = player.money >= amount
    const label = pending.type === PendingActionType.PayRent ? 'Bayar sewa' : 'Uang tidak cukup!'
    return (
      <div className="bg-bg-card rounded-lg p-2 flex-shrink-0">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-xs my-[3px] text-center">{label} <strong>{formatMoney(amount)}</strong></p>
          {!canAffordNow && (
            <p className="text-[11px] text-muted text-center font-bold" style={{ color: '#f39c12' }}>
              Hover properti di papan untuk jual/gadai/tebus aset
            </p>
          )}
          <Button variant="success" onClick={onPayRent} disabled={!canAffordNow}>
            {canAffordNow ? 'Bayar Sewa' : 'Uang Masih Kurang'}
          </Button>
          <Button variant="danger" onClick={onDeclareBankruptcy}>Nyatakan Bangkrut</Button>
        </div>
      </div>
    )
  }

  if (pending?.type === PendingActionType.DrawCard) {
    return (
      <div className="bg-bg-card rounded-lg p-2 flex-shrink-0">
        <Button variant="primary" onClick={onDrawCard}>Ambil Kartu</Button>
      </div>
    )
  }

  if (pending?.type === PendingActionType.CardEffect) {
    return (
      <div className="bg-bg-card rounded-lg p-2 flex-shrink-0">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-xs my-[3px] text-center">{pending.card.description}</p>
          <p className="text-[11px] text-muted text-center">Klik tombol untuk melanjutkan</p>
        </div>
      </div>
    )
  }

  if (!canAct) return null

  return (
    <div className="bg-bg-card rounded-lg p-2 flex-shrink-0">
      {player.inJail ? (
        <>
          <p className="text-[11px] text-muted text-center mt-1">Di Penjara — pilih:</p>
          {player.hasGetOutOfJailFree && (
            <Button variant="success" size="sm" onClick={onUseGetOutOfJailFree}>
              🎴 Gunakan Kartu Bebas Penjara
            </Button>
          )}
          {player.jailTurns > 0 && (
            <>
              <Button variant="success" size="sm" onClick={onPayJailFine} disabled={player.money < JAIL_FINE}>
                Bayar {formatMoney(JAIL_FINE)}
              </Button>
              {player.money < JAIL_FINE && (
                <p className="text-[11px] text-muted text-center mt-1">Uang tidak cukup</p>
              )}
              <p className="text-[11px] text-muted text-center mt-1">
                atau lempar dadu ganda ({3 - player.jailTurns}x lagi)
              </p>
            </>
          )}
          {player.jailTurns === 0 && (
            <p className="text-[11px] text-muted text-center mt-1">
              Lempar dadu ganda untuk keluar. Bayar bisa mulai putaran depan.
            </p>
          )}
        </>
      ) : hasRolled ? (
        <>
          {player.money >= 0 ? (
            <>
              <Button variant="secondary" onClick={onEndTurn}>Akhiri Giliran</Button>
              <Button size="sm" onClick={onProposeTrade}>🤝 Tukar</Button>
            </>
          ) : (
            <p className="text-[11px] text-muted text-center mt-1" style={{ color: '#e74c3c' }}>
              Uang minus! Jual aset dulu sebelum akhiri giliran.
            </p>
          )}
        </>
      ) : (
        <p className="text-[11px] text-muted text-center mt-1">
          Giliran {player.name} — lempar dadu
        </p>
      )}
      {(hasRolled && !player.inJail) || player.money < 0 ? (
        <p className="text-[11px] text-muted text-center" style={{ fontSize: '10px' }}>
          Hover properti di papan untuk jual/gadai
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ActionSection.tsx
git commit -m "feat: extract ActionSection component with Tailwind + Button"
```

---

### Task 12: Migrate Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: DiceRoller from Task 4, PlayerPanel from Task 7, EventLog from Task 5, ActionSection from Task 11, Tailwind from Task 1
- Produces: Unchanged API — `{ state: GameState; onRoll; onEndTurn; ... }`

- [ ] **Step 1: Migrate Sidebar.tsx to use Tailwind and extracted components**

```tsx
import type { GameState } from '../types/game'
import DiceRoller from './DiceRoller'
import PlayerPanel from './PlayerPanel'
import EventLog from './EventLog'
import ActionSection from './ActionSection'

interface Props {
  state: GameState
  onRoll: () => void
  onEndTurn: () => void
  onProposeTrade: () => void
  onDrawCard: () => void
  onBuyProperty: () => void
  onDeclineBuy: () => void
  onPayRent: () => void
  onDeclareBankruptcy: () => void
  onSkipAction: () => void
  onPayJailFine: () => void
  onUseGetOutOfJailFree: () => void
}

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']

export default function Sidebar({ state, ...actions }: Props) {
  return (
    <div
      data-testid="sidebar"
      className="absolute top-[calc(100%/11)] left-[calc(100%/11)] w-[calc(100%*9/11)] h-[calc(100%*9/11)] flex flex-col items-center gap-1 p-2 overflow-hidden z-[5] bg-bg-main/92 rounded"
    >
      <DiceRoller state={state} onRoll={actions.onRoll} />
      <ActionSection state={state} {...actions} />
      <PlayerPanel state={state} playerColors={PLAYER_COLORS} />
      <EventLog log={state.eventLog} />
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: migrate Sidebar to Tailwind, use extracted sub-components"
```

---

### Task 13: Migrate GameBoard

**Files:**
- Modify: `src/components/GameBoard.tsx`

**Interfaces:**
- Consumes: BoardGrid from Task 9, PlayerTokens from Task 10, Tailwind from Task 1
- Produces: Unchanged API

- [ ] **Step 1: Migrate GameBoard.tsx**

```tsx
import type { ReactNode } from 'react'
import type { GameState } from '../types/game'
import BoardGrid from './BoardGrid'
import PlayerTokens from './PlayerTokens'

interface Props {
  state: GameState
  children?: ReactNode
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onBuild: (spaceId: number) => void
}

export default function GameBoard({ state, children, onSell, onMortgage, onUnmortgage, onBuild }: Props) {
  return (
    <div className="flex items-center justify-center w-screen h-screen">
      <div className="relative w-[min(calc(100vw-16px),calc(100vh-16px))] aspect-square flex-shrink-0">
        <BoardGrid
          state={state}
          playerColors={['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']}
          onSell={onSell}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
          onBuild={onBuild}
        />
        <PlayerTokens state={state} playerColors={['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']} />
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/GameBoard.tsx
git commit -m "feat: migrate GameBoard to Tailwind"
```

---

### Task 14: Migrate GameSetup

**Files:**
- Modify: `src/components/GameSetup.tsx`

**Interfaces:**
- Consumes: Button from Task 2, Tailwind from Task 1
- Produces: Unchanged API — `{ onStart: (playerCount: number, names: string[]) => void }`

- [ ] **Step 1: Migrate GameSetup.tsx**

```tsx
import { useState } from 'react'
import Button from './Button'

interface Props {
  onStart: (playerCount: number, names: string[]) => void
}

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']

export default function GameSetup({ onStart }: Props) {
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState<string[]>(['', '', '', ''])

  function handleNameChange(index: number, value: string) {
    const newNames = [...names]
    newNames[index] = value
    setNames(newNames)
  }

  function handleStart() {
    const filledNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Pemain ${i + 1}`)
    onStart(playerCount, filledNames)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-[48px] text-gold m-0">Monopoli Indonesia</h1>
      <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Jumlah Pemain</label>
          <select
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-sm"
          >
            <option value={2}>2 Pemain</option>
            <option value={3}>3 Pemain</option>
            <option value={4}>4 Pemain</option>
          </select>
        </div>
        {Array.from({ length: playerCount }).map((_, i) => (
          <div className="flex flex-col gap-1.5" key={i}>
            <label className="text-sm text-muted flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
              Nama Pemain {i + 1}
            </label>
            <input
              type="text"
              value={names[i]}
              onChange={(e) => handleNameChange(i, e.target.value)}
              placeholder={`Pemain ${i + 1}`}
              maxLength={12}
              className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-sm"
            />
          </div>
        ))}
        <Button variant="start" size="lg" onClick={handleStart}>
          Mulai Permainan
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/GameSetup.tsx
git commit -m "feat: migrate GameSetup to Tailwind + Button component"
```

---

### Task 15: Migrate All 5 Modals to Use Modal Base

**Files:**
- Modify: `src/components/Modals/BuyPropertyModal.tsx` — NOTE: this component exists but is NOT currently rendered; the buy UI is inline in ActionSection. Keep the file but migrate to Tailwind.
- Modify: `src/components/Modals/BankruptcyModal.tsx`
- Modify: `src/components/Modals/GameOverModal.tsx`
- Modify: `src/components/Modals/CardModal.tsx`
- Modify: `src/components/Modals/TradeModal.tsx`

**Interfaces:**
- Consumes: Modal from Task 3, Button from Task 2, Tailwind from Task 1
- Produces: Unchanged component APIs

- [ ] **Step 1: Migrate BuyPropertyModal.tsx**

```tsx
import { PendingActionType, type GameState } from '../../types/game'
import { formatMoney } from '../../utils/format'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onBuy: () => void
  onDecline: () => void
}

export default function BuyPropertyModal({ state, onBuy, onDecline }: Props) {
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.BuyProperty) return null
  const space = state.board[pending.spaceId]
  if (!space) return null

  return (
    <Modal>
      <h3 className="text-lg text-gold m-0">{space.name}</h3>
      <p className="text-sm m-0">Harga: <strong>{formatMoney(space.price)}</strong></p>
      {space.rent && (
        <div className="bg-bg-dark rounded-lg px-3 py-2 text-xs">
          <p className="my-0.5">Sewa: {space.rent[0]}</p>
          <p className="my-0.5">Sewa 1🏠: {space.rent[1]}</p>
          <p className="my-0.5">Hotel: {space.rent[space.rent.length - 1]}</p>
        </div>
      )}
      <Modal.Actions>
        <Button variant="success" onClick={onBuy}>Beli ({formatMoney(space.price)})</Button>
        <Button variant="secondary" onClick={onDecline}>Tidak</Button>
      </Modal.Actions>
    </Modal>
  )
}
```

- [ ] **Step 2: Migrate BankruptcyModal.tsx**

```tsx
import { PendingActionType, type GameState } from '../../types/game'
import { formatMoney } from '../../utils/format'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onClose: () => void
  onBankruptcy: () => void
}

export default function BankruptcyModal({ state, onClose, onBankruptcy }: Props) {
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.Bankruptcy) return null
  const player = state.players[state.currentPlayer]
  const amount = pending.amount

  const canPayAfterLiquidation = (() => {
    let money = player.money
    const ownedProps = state.board.filter((s) => s.owner === state.currentPlayer && !s.mortgaged)
    for (const s of ownedProps) {
      money += Math.floor((s.houseCost ?? 0) / 2) * s.houses
      money += Math.floor((s.price ?? 0) / 2)
    }
    return money >= amount
  })()

  return (
    <Modal>
      <h3 className="text-lg text-gold m-0">⚠️ Kebangkrutan</h3>
      <p className="text-sm m-0">{player.name} tidak bisa membayar <strong>{formatMoney(amount)}</strong>.</p>
      <p className="text-sm m-0">Uang saat ini: {formatMoney(player.money)}</p>
      {canPayAfterLiquidation && (
        <p className="text-muted text-xs">Jual rumah / gadaikan properti untuk mendapatkan uang.</p>
      )}
      <Modal.Actions>
        {!canPayAfterLiquidation && (
          <Button variant="danger" onClick={onBankruptcy}>Nyatakan Bangkrut</Button>
        )}
        <Button variant="secondary" onClick={onClose}>Tutup (Jual/Gadai lebih dulu)</Button>
      </Modal.Actions>
    </Modal>
  )
}
```

- [ ] **Step 3: Migrate GameOverModal.tsx**

```tsx
import { GamePhase, type GameState } from '../../types/game'
import { formatMoney } from '../../utils/format'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onReset: () => void
}

export default function GameOverModal({ state, onReset }: Props) {
  if (state.phase !== GamePhase.GameOver) return null
  const winner = state.players.find((p) => !p.bankrupt)
  if (!winner) return null

  const netWorth = winner.money + state.board
    .filter((s) => s.owner === winner.id)
    .reduce((sum, s) => sum + (s.price ?? 0) + (s.houseCost ?? 0) * s.houses, 0)

  return (
    <Modal className="text-center">
      <h2 className="text-2xl text-gold m-0">🏆 Permainan Selesai!</h2>
      <p className="text-[28px] text-gold font-bold">{winner.name} menang!</p>
      <p className="text-sm m-0">Dengan kekayaan bersih: {formatMoney(netWorth)}</p>
      <Modal.Actions>
        <Button variant="primary" onClick={onReset}>Main Lagi</Button>
      </Modal.Actions>
    </Modal>
  )
}
```

- [ ] **Step 4: Migrate CardModal.tsx**

```tsx
import { CardType, PendingActionType, type GameState } from '../../types/game'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onResolve: () => void
}

export default function CardModal({ state, onResolve }: Props) {
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.CardEffect) return null

  return (
    <Modal>
      <h3 className="text-lg text-gold m-0">
        {pending.card.type === CardType.Chance ? 'Kesempatan' : 'Dana Umum'}
      </h3>
      <p className="text-base p-4 bg-bg-dark rounded-lg text-center">
        {pending.card.description}
      </p>
      <Modal.Actions>
        <Button variant="primary" onClick={onResolve}>OK</Button>
      </Modal.Actions>
    </Modal>
  )
}
```

- [ ] **Step 5: Migrate TradeModal.tsx**

```tsx
import { useState } from 'react'
import type { GameState, TradeOffer } from '../../types/game'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onPropose: (offer: TradeOffer) => void
  onClose: () => void
}

export default function TradeModal({ state, onPropose, onClose }: Props) {
  const [targetPlayer, setTargetPlayer] = useState<number | null>(null)
  const [offerProperties, setOfferProperties] = useState<number[]>([])
  const [offerCash, setOfferCash] = useState(0)
  const [requestProperties] = useState<number[]>([])
  const [requestCash, setRequestCash] = useState(0)

  const currentProps = state.board.filter(
    (s) => s.owner === state.currentPlayer && !s.mortgaged && s.houses === 0
  )

  function handlePropose() {
    if (targetPlayer === null) return
    onPropose({
      fromId: state.currentPlayer,
      toId: targetPlayer,
      offerProperties,
      offerCash,
      requestProperties,
      requestCash,
    })
  }

  return (
    <Modal>
      <h3 className="text-lg text-gold m-0">🤝 Tukar</h3>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-dim">Dengan:</label>
        <select
          value={targetPlayer ?? ''}
          onChange={(e) => setTargetPlayer(Number(e.target.value))}
          className="p-2 rounded-md border border-border bg-input-bg text-text"
        >
          <option value="">Pilih pemain</option>
          {state.players
            .filter((p) => p.id !== state.currentPlayer && !p.bankrupt)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <h4 className="text-sm text-gold m-0">Anda tawarkan:</h4>
          <label className="text-xs flex items-center gap-1 text-text-dim">
            Uang: <input type="number" value={offerCash} onChange={(e) => setOfferCash(Number(e.target.value))} min={0} className="w-20 py-1 px-2 rounded border border-border bg-input-bg text-text text-xs" />
          </label>
          {currentProps.map((s) => (
            <label key={s.id} className="text-xs flex items-center gap-1 text-text-dim">
              <input
                type="checkbox"
                checked={offerProperties.includes(s.id)}
                onChange={() =>
                  setOfferProperties((prev) =>
                    prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                  )
                }
                className="mr-1"
              />
              {s.name}
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 className="text-sm text-gold m-0">Anda minta:</h4>
          <label className="text-xs flex items-center gap-1 text-text-dim">
            Uang: <input type="number" value={requestCash} onChange={(e) => setRequestCash(Number(e.target.value))} min={0} className="w-20 py-1 px-2 rounded border border-border bg-input-bg text-text text-xs" />
          </label>
        </div>
      </div>
      <Modal.Actions>
        <Button variant="success" onClick={handlePropose}>Ajukan</Button>
        <Button variant="secondary" onClick={onClose}>Batal</Button>
      </Modal.Actions>
    </Modal>
  )
}
```

- [ ] **Step 6: Verify**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/Modals/
git commit -m "feat: migrate all modals to Modal base component + Tailwind"
```

---

### Task 16: Migrate App.tsx + Delete App.css

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/App.css`

**Interfaces:**
- Consumes: All migrated components from Tasks 1-15
- Produces: Root App component, `App.css` deleted

- [ ] **Step 1: Migrate App.tsx**

Remove `import './App.css'` and replace `className` with Tailwind:

```tsx
import { useState, useEffect, useRef } from 'react'
import { PendingActionType } from './types/game'
import { useGame } from './hooks/useGame'
import GameSetup from './components/GameSetup'
import GameBoard from './components/GameBoard'
import Sidebar from './components/Sidebar'
import TradeModal from './components/Modals/TradeModal'
import CardModal from './components/Modals/CardModal'
import BankruptcyModal from './components/Modals/BankruptcyModal'
import GameOverModal from './components/Modals/GameOverModal'
import { GamePhase, type TradeOffer } from './types/game'

export default function App() {
  const game = useGame()
  const { state } = game
  const [showTrade, setShowTrade] = useState(false)

  function handleRoll() {
    game.rollDice()
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    const total = d1 + d2
    const animDuration = 500 + (total * 150)
    setTimeout(() => {
      game.diceAnimated([d1, d2])
      setTimeout(() => {
        game.resolveSpace()
      }, animDuration)
    }, 500)
  }

  function handleDrawCard() {
    game.drawCard()
  }

  useEffect(() => {
    if (state.phase === GamePhase.Resolving && !state.pendingAction) {
      game.resolveSpace()
    }
  }, [state.phase, state.pendingAction, game])

  useEffect(() => {
    if (state.pendingAction?.type === PendingActionType.DrawCard) {
      const t = setTimeout(() => game.drawCard(), 300)
      return () => clearTimeout(t)
    }
  }, [state.pendingAction, game])

  const wasInJailRef = useRef<Record<number, boolean>>({})
  useEffect(() => {
    const player = state.players[state.currentPlayer]
    const wasInJail = wasInJailRef.current[player.id] ?? false
    wasInJailRef.current[player.id] = player.inJail

    if (player.inJail && !wasInJail && state.phase === GamePhase.Waiting && !state.pendingAction) {
      setTimeout(() => game.endTurn(), 300)
    }
  }, [state.players, state.phase, state.pendingAction, state.currentPlayer, game])

  if (state.phase === GamePhase.Setup) {
    return (
      <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
        <GameSetup onStart={game.startGame} />
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
      <GameBoard state={state} onSell={game.sellHouse} onMortgage={game.mortgage} onUnmortgage={game.unmortgage} onBuild={game.buildHouse}>
        <Sidebar
          state={state}
          onRoll={handleRoll}
          onEndTurn={game.endTurn}
          onProposeTrade={() => setShowTrade(true)}
          onDrawCard={handleDrawCard}
          onBuyProperty={game.buyProperty}
          onDeclineBuy={game.declineBuy}
          onPayRent={game.payRent}
          onDeclareBankruptcy={game.declareBankruptcy}
          onSkipAction={game.skipAction}
          onPayJailFine={game.payJailFine}
          onUseGetOutOfJailFree={game.useGetOutOfJailFree}
        />
      </GameBoard>
      <CardModal state={state} onResolve={game.resolveCard} />
      <BankruptcyModal state={state} onClose={game.skipAction} onBankruptcy={game.declareBankruptcy} />
      <GameOverModal state={state} onReset={game.resetGame} />

      {showTrade && (
        <TradeModal
          state={state}
          onPropose={(offer: TradeOffer) => {
            game.proposeTrade(offer)
            setShowTrade(false)
          }}
          onClose={() => setShowTrade(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete App.css**

```bash
rm src/App.css
```

- [ ] **Step 3: Verify everything**

```bash
npx tsc -b && npm run test:unit
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx && git rm src/App.css
git commit -m "feat: migrate App.tsx to Tailwind, delete App.css"
```

---

### Task 17: Update E2E Tests for New Selectors

**Files:**
- Modify: `e2e/monopoly.spec.ts`

**Consumes:** `data-testid` attributes added in Tasks 5, 6, 12

**Produces:** E2E tests that pass with Tailwind version

- [ ] **Step 1: Replace CSS class selectors with data-testid + text selectors**

```ts
import { test, expect, Page } from '@playwright/test'

async function handleTurn(page: Page) {
  const rollBtn = page.locator('button:has-text("Lempar")').first()
  if (!await rollBtn.isVisible({ timeout: 500 }).catch(() => false)) return false

  await rollBtn.click()
  await page.waitForTimeout(2000)

  const buyBtn = page.locator('button:has-text("Beli (")').first()
  if (await buyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await buyBtn.click()
    await page.waitForTimeout(200)
  }

  const noBtn = page.locator('button:has-text("Tidak")').first()
  if (await noBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await noBtn.click()
    await page.waitForTimeout(200)
  }

  const cardBtn = page.locator('button:has-text("Ambil")').first()
  if (await cardBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await cardBtn.click()
    await page.waitForTimeout(500)
    const okBtn = page.locator('button:has-text("OK")').first()
    if (await okBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await okBtn.click()
      await page.waitForTimeout(500)
    }
  }

  const payBtn = page.locator('button:has-text("Bayar")').first()
  if (await payBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await payBtn.click()
    await page.waitForTimeout(200)
  }

  const endBtn = page.locator('button:has-text("Akhiri")').first()
  if (await endBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await endBtn.click()
    await page.waitForTimeout(200)
  }

  return true
}

test.describe('Monopoly Game E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('setup screen renders correctly', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Monopoli Indonesia')
    await expect(page.locator('button:has-text("Mulai")')).toBeVisible()
    await expect(page.locator('select')).toBeVisible()
  })

  test('start game with 2 players', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Alpha')
    await page.locator('input[type="text"]').nth(1).fill('Beta')
    await page.click('button:has-text("Mulai")')

    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Lempar")')).toBeVisible()

    const panel = page.locator('[data-testid="player-card"]')
    await expect(panel).toHaveCount(2)
    await expect(panel.first()).toContainText('Alpha')
    await expect(panel.nth(1)).toContainText('Beta')
    await expect(panel.first()).toContainText('Rp1,5M')
  })

  test('dice roll and turn switching works', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('P1')
    await page.locator('input[type="text"]').nth(1).fill('P2')
    await page.click('button:has-text("Mulai")')

    await handleTurn(page)
    await handleTurn(page)

    const log = page.locator('[data-testid="event-log"]')
    await expect(log).toContainText('P1')
    await expect(log).toContainText('P2')
  })

  test('buy property and see it in panel', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Buyer')
    await page.locator('input[type="text"]').nth(1).fill('Other')
    await page.click('button:has-text("Mulai")')

    for (let i = 0; i < 15; i++) {
      await handleTurn(page)
    }

    const cards = page.locator('[data-testid="player-card"]')
    const firstCardText = await cards.first().textContent()
    expect(firstCardText).not.toBe('Rp1,5M')
  })

  test('card modal appears and dismisses', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('X')
    await page.locator('input[type="text"]').nth(1).fill('Y')
    await page.click('button:has-text("Mulai")')

    let foundCard = false
    for (let i = 0; i < 30; i++) {
      await handleTurn(page)

      const entries = page.locator('[data-testid="event-entry"]')
      const cardEntries = entries.filter({ hasText: /Kesempatan|Dana Umum|mengambil kartu/ })
      if (await cardEntries.count() > 0) {
        foundCard = true
        break
      }
    }

    expect(foundCard).toBe(true)
  })

  test('4-player game survives many turns without crash', async ({ page }) => {
    await page.locator('select').selectOption('4')
    await page.locator('input[type="text"]').nth(0).fill('P1')
    await page.locator('input[type="text"]').nth(1).fill('P2')
    await page.locator('input[type="text"]').nth(2).fill('P3')
    await page.locator('input[type="text"]').nth(3).fill('P4')
    await page.click('button:has-text("Mulai")')

    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(4)
    await expect(page.locator('button:has-text("Lempar")')).toBeVisible()

    for (let t = 0; t < 12; t++) {
      const played = await handleTurn(page)
      if (!played) break
    }

    const cards = page.locator('[data-testid="player-card"]')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b && npm run test:unit && npm run test:e2e
```

- [ ] **Step 3: Commit**

```bash
git add e2e/monopoly.spec.ts
git commit -m "test: update e2e selectors for Tailwind migration"
```
