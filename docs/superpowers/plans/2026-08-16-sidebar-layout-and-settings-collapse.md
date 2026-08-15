# Sidebar Layout & Settings Auto-Collapse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-collapse the language/currency settings panel, move all action buttons above the player list in the sidebar, and replace the cryptic footer ⚙ leave toggle with a compact leave icon at the top of the sidebar.

**Architecture:** Three small component changes. `LanguageCurrencyBar` gains auto-close on selection / outside-click / Escape. `RoomExit` drops its expand-toggle in favor of an `icon`/`button` variant. `Sidebar` reorders its children (header row with the leave icon → DiceRoller → ActionSection → PlayerPanel → EventLog). Each change is covered by unit tests; the multiplayer e2e leave flow is updated to the new one-click path.

**Tech Stack:** React 19, TypeScript, Tailwind v4, i18next, Vitest + Testing Library, Playwright.

## Global Constraints

- **Test setup:** `src/test/setup.ts` fixes `localStorage['monopoly-language'] = 'en'` and `monopoly-currency = 'USD'` before i18n init, so unit tests run in English. Do not rely on the Indonesian default.
- **i18n is a per-file singleton:** `i18n.changeLanguage()` persists across tests in one file. Any test that switches language must reset it (`i18n.changeLanguage('en')`) in `afterEach`, or later tests in that file will render with wrong labels.
- **Icon pattern:** the codebase uses emoji glyphs for icon buttons (🌐 in `LanguageCurrencyBar`, ⚙ in old `RoomExit`, 🔒/🎴 in `PlayerCard`). Use 🚪 for the leave icon; no SVG icon library exists.
- **Buttons:** always reuse `src/components/Button.tsx` for labeled buttons; icon-only buttons are plain `<button>` with `aria-label` (existing pattern in `LanguageCurrencyBar.tsx:41-49` and `RoomExit.tsx:19-27`).
- **Verification commands:** unit — `npx vitest run <file>`; full unit — `npm run test:unit`; typecheck — `npm run typecheck`; lint — `npm run lint`; e2e (needs `dist/` built first) — `npm run build && npx playwright test e2e/multiplayer.spec.ts`.
- **i18n keys:** keys are flat strings with dots (`"lobby.leaveRoom"`), `keySeparator: false`. Remove `confirm.leaveExpand` when it becomes unused.

---

### Task 1: RoomExit icon/button variant

**Files:**
- Modify: `src/components/RoomExit.tsx` (whole file)
- Modify: `src/components/__tests__/RoomExit.test.tsx` (whole file)
- Modify: `src/i18n/locales/en/translation.json` (remove line 148)
- Modify: `src/i18n/locales/id/translation.json` (remove line 148)

**Interfaces:**
- Consumes: `Button` (`src/components/Button.tsx`), `Modal` (`src/components/Modals/Modal.tsx`), i18n keys `lobby.leaveRoom`, `confirm.leaveTitle`, `confirm.leaveMessage`, `confirm.cancel`, `confirm.leave`.
- Produces: `RoomExit` props `{ onLeave: () => void; variant?: 'icon' | 'button' }` (default `'button'`). The `collapsed` prop and the expand-toggle state are removed. Task 3 renders `<RoomExit onLeave={onLeave} variant="icon" />`.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/components/__tests__/RoomExit.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import RoomExit from '../RoomExit'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('RoomExit', () => {
  it('shows the leave button directly for the default button variant', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} />)
    expect(screen.getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })

  it('renders a compact icon-only button for the icon variant', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} variant="icon" />)
    const btn = screen.getByRole('button', { name: 'Leave Room' })
    expect(btn).toBeVisible()
    expect(btn.textContent?.trim()).toBe('🚪')
  })

  it('opens the confirmation modal and does not leave on cancel (icon variant)', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} variant="icon" />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    expect(screen.getByText('Are you sure you want to leave this room?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('calls onLeave only after confirming (icon variant)', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} variant="icon" />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/RoomExit.test.tsx`
Expected: FAIL — the "compact icon-only button" test fails because the current component has no `variant` prop; the icon button renders text "Leave Room" instead of 🚪.

- [ ] **Step 3: Refactor RoomExit to a variant prop**

Replace the entire contents of `src/components/RoomExit.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import Modal from './Modals/Modal'

interface Props {
  onLeave: () => void
  variant?: 'icon' | 'button'
}

export default function RoomExit({ onLeave, variant = 'button' }: Props) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={variant === 'icon' ? 'flex flex-col items-center' : 'flex flex-col items-stretch gap-1.5 w-full'}>
      {variant === 'icon' ? (
        <button
          type="button"
          aria-label={t('lobby.leaveRoom')}
          title={t('lobby.leaveRoom')}
          onClick={() => setConfirming(true)}
          className="flex items-center justify-center bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1 text-sm text-text cursor-pointer hover:opacity-90"
        >
          <span aria-hidden>🚪</span>
        </button>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          {t('lobby.leaveRoom')}
        </Button>
      )}
      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <h3 className="text-2xl text-gold m-0">{t('confirm.leaveTitle')}</h3>
          <p className="text-base text-text">{t('confirm.leaveMessage')}</p>
          <Modal.Actions>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button variant="danger" onClick={onLeave}>
              {t('confirm.leave')}
            </Button>
          </Modal.Actions>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Remove the now-unused `confirm.leaveExpand` i18n key**

In both `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json`, delete the line containing `"confirm.leaveExpand"` (line 148 in each; en value `"Leave Room Options"`, id value `"Opsi Keluar Ruangan"`). Leave the surrounding keys intact.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/RoomExit.test.tsx`
Expected: PASS (all 4 tests).

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0. If lint flags the test file (unused import), remove the unused import and re-run.

- [ ] **Step 7: Commit**

```bash
git add src/components/RoomExit.tsx src/components/__tests__/RoomExit.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: replace RoomExit collapse toggle with icon/button variants"
```

---

### Task 2: LanguageCurrencyBar auto-collapse

**Files:**
- Modify: `src/components/LanguageCurrencyBar.tsx` (whole file)
- Modify: `src/components/__tests__/LanguageCurrencyBar.test.tsx`

**Interfaces:**
- Consumes: `useTranslation`, `useCurrency` (`src/i18n/CurrencyContext.tsx`), `Currency` type (`src/data/currency.ts`).
- Produces: same component API (`LanguageCurrencyBar` takes no props). New behavior: the panel closes after a language/currency selection, on outside `pointerdown`, and on `Escape`.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/components/__tests__/LanguageCurrencyBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import LanguageCurrencyBar from '../LanguageCurrencyBar'
import { renderWithProviders } from '../../test/test-utils'
import i18n from '../../i18n'

afterEach(() => {
  cleanup()
  i18n.changeLanguage('en')
})

describe('LanguageCurrencyBar', () => {
  it('shows a collapsed toggle without the panel', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
    expect(screen.queryByLabelText('Language')).toBeNull()
  })

  it('opens the panel when clicked', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByLabelText('Language')).toBeVisible()
    expect(screen.getByLabelText('Currency')).toBeVisible()
  })

  it('closes the panel after selecting a language', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'id' } })
    expect(screen.queryByLabelText('Language')).toBeNull()
  })

  it('closes the panel after selecting a currency', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'IDR' } })
    expect(screen.queryByLabelText('Currency')).toBeNull()
  })

  it('closes the panel when clicking outside', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByLabelText('Language')).toBeNull()
  })

  it('closes the panel when pressing Escape', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText('Language')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/LanguageCurrencyBar.test.tsx`
Expected: FAIL — the four new auto-close tests fail (panel stays open after selection / outside click / Escape).

- [ ] **Step 3: Implement auto-collapse**

Replace the entire contents of `src/components/LanguageCurrencyBar.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../i18n/CurrencyContext'
import type { Currency } from '../data/currency'

export default function LanguageCurrencyBar() {
  const { t, i18n } = useTranslation()
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="fixed top-2 right-2 z-[200] flex flex-col items-end gap-1.5">
      {open && (
        <div className="flex flex-col gap-2 bg-bg-dark/95 border border-border-light rounded-lg p-2.5 shadow-lg">
          <label className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>{t('settings.language')}</span>
            <select
              aria-label={t('settings.language')}
              value={i18n.language}
              onChange={(e) => {
                i18n.changeLanguage(e.target.value)
                setOpen(false)
              }}
              className="bg-input-bg text-text text-xs rounded px-1 py-0.5 border border-border"
            >
              <option value="en">EN</option>
              <option value="id">ID</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>{t('settings.currency')}</span>
            <select
              aria-label={t('settings.currency')}
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value as Currency)
                setOpen(false)
              }}
              className="bg-input-bg text-text text-xs rounded px-1 py-0.5 border border-border"
            >
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
            </select>
          </label>
        </div>
      )}
      <button
        type="button"
        aria-label={t('settings.toggle')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1 text-xs text-text cursor-pointer hover:opacity-90"
      >
        <span aria-hidden>🌐</span>
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/LanguageCurrencyBar.test.tsx`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/LanguageCurrencyBar.tsx src/components/__tests__/LanguageCurrencyBar.test.tsx
git commit -m "feat: auto-collapse language/currency settings panel"
```

---

### Task 3: Sidebar reorder with leave icon at top

**Files:**
- Modify: `src/components/Sidebar.tsx` (whole file)
- Create: `src/components/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `TurnHeader`, `DiceRoller`, `RoomExit` (with `variant="icon"`, from Task 1), `PlayerPanel`, `ActionSection`, `EventLog`, `PLAYER_COLORS` (`src/data/players.ts`). All `Sidebar` props are unchanged from current code.
- Produces: `Sidebar` with identical props; new child order. A new `Sidebar` test asserts the order and the leave icon placement.

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/Sidebar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Sidebar from '../Sidebar'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

const noop = () => {}

function makeRolledState(): GameState {
  const s = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  })
  return { ...s, dice: [2, 3] }
}

function makeProps() {
  return {
    onRoll: noop,
    onEndTurn: noop,
    onProposeTrade: noop,
    onDrawCard: noop,
    onBuyProperty: noop,
    onDeclineBuy: noop,
    onPayRent: noop,
    onDeclareBankruptcy: noop,
    onSkipAction: noop,
    onPayJailFine: noop,
    onUseGetOutOfJailFree: noop,
    onBuild: noop,
  }
}

function domIndex(el: HTMLElement): number {
  return Array.from(document.querySelectorAll('[data-testid="sidebar"] *')).indexOf(el)
}

afterEach(cleanup)

describe('Sidebar', () => {
  it('places action buttons above the player list and event log', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} />)
    const turnLabel = screen.getByText('Turn')
    const endTurn = screen.getByRole('button', { name: 'End Turn' })
    const playersLabel = screen.getByText('Players')
    const eventLog = screen.getByTestId('event-log')
    expect(domIndex(turnLabel)).toBeLessThan(domIndex(endTurn))
    expect(domIndex(endTurn)).toBeLessThan(domIndex(playersLabel))
    expect(domIndex(playersLabel)).toBeLessThan(domIndex(eventLog))
  })

  it('renders the leave icon at the top of the sidebar', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} />)
    const sidebar = screen.getByTestId('sidebar')
    const firstChild = sidebar.children[0] as HTMLElement
    expect(within(firstChild).getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/Sidebar.test.tsx`
Expected: FAIL — in the current sidebar, `End Turn` (ActionSection) comes after `Players` (PlayerPanel), so the first `domIndex` assertion fails; and the leave button is in the last child, not the first.

- [ ] **Step 3: Reorder the sidebar**

Replace the entire contents of `src/components/Sidebar.tsx`:

```tsx
import type { GameState } from '../types/game'
import { useTranslation } from 'react-i18next'
import { PLAYER_COLORS } from '../data/players'
import TurnHeader from './TurnHeader'
import DiceRoller from './DiceRoller'
import RoomExit from './RoomExit'
import PlayerPanel from './PlayerPanel'
import ActionSection from './ActionSection'
import EventLog from './EventLog'

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
  onBuild: (spaceId: number) => void
  onLeave?: () => void
  isMyTurn: boolean
}

export default function Sidebar({ state, isMyTurn, onLeave, ...actions }: Props) {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
      <div
        data-testid="sidebar"
        className="pointer-events-auto w-[min(380px,calc((100vw-16px)*9/11-16px))] min-h-0 max-h-[calc((100vh-16px)*9/11-16px)] overflow-y-auto rounded-2xl border border-panel-border bg-panel backdrop-blur-md shadow-2xl px-5 py-4 flex flex-col gap-4"
      >
        <div className="relative">
          <TurnHeader state={state} />
          {onLeave && (
            <div className="absolute top-0 right-0">
              <RoomExit onLeave={onLeave} variant="icon" />
            </div>
          )}
        </div>
        <DiceRoller state={state} onRoll={actions.onRoll} isMyTurn={isMyTurn} />
        {isMyTurn ? (
          <ActionSection state={state} {...actions} isMyTurn={isMyTurn} />
        ) : (
          <p className="text-base text-muted text-center" data-testid="waiting-for">
            {t('turn.waitingFor', { name: state.players[state.currentPlayer].name })}
          </p>
        )}
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} />
        <EventLog log={state.eventLog} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/Sidebar.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Run the full unit suite**

Run: `npm run test:unit`
Expected: all tests pass, including the existing `PlayerPanel`, `ActionSection`, `DiceRoller`, `EventLog`, and `RoomExit` suites.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat: move action buttons above player list and add leave icon to header"
```

---

### Task 4: Update multiplayer e2e leave flow

**Files:**
- Modify: `e2e/multiplayer.spec.ts:105-107`

**Interfaces:**
- Consumes: the new `RoomExit` icon variant (Task 1) and reordered `Sidebar` (Task 3). The e2e runs with `localStorage['monopoly-language'] = 'en'`, so the icon button's accessible name is "Leave Room" and the modal confirm button is "Leave".
- Produces: no new interfaces; the leave flow now goes straight from the icon to the confirmation modal.

- [ ] **Step 1: Update the leave flow steps**

In `e2e/multiplayer.spec.ts`, replace lines 105-107:

```ts
await pageB.click('button[aria-label="Leave Room Options"]')
await pageB.click('button:has-text("Leave Room")')
await pageB.getByRole('button', { name: 'Leave', exact: true }).click()
```

with:

```ts
await pageB.click('button[aria-label="Leave Room"]')
await pageB.getByRole('button', { name: 'Leave', exact: true }).click()
```

The icon click opens the confirmation modal directly; the `exact: true` matcher ensures the confirm "Leave" button is matched, not the "Leave Room" icon.

- [ ] **Step 2: Build and run the e2e suite**

Run: `npm run build && npx playwright test e2e/multiplayer.spec.ts`
Expected: all tests in `multiplayer.spec.ts` pass (the server is auto-spawned on `PORT=3123`, serving `dist/`).

- [ ] **Step 3: Commit**

```bash
git add e2e/multiplayer.spec.ts
git commit -m "test: update e2e leave flow for one-click leave icon"
```

---

## Self-Review Notes

- **Spec coverage:** Issue 1 → Task 2 (auto-close on selection + outside click + Escape). Issue 2 → Task 3 (Roll + ActionSection grouped above PlayerPanel). Issue 3 → Task 1 + Task 3 (compact leave icon at top of the header row, no footer toggle). i18n cleanup (`confirm.leaveExpand` removal) → Task 1 Step 4.
- **Type consistency:** `variant?: 'icon' | 'button'` defined in Task 1, consumed in Task 3; all `Sidebar` props unchanged from the existing interface. e2e labels match Task 1's `aria-label={t('lobby.leaveRoom')}` and `confirm.leave`.
- **Placeholder scan:** no TBD/TODO; every code step includes full file contents.
- **Test isolation:** Task 2 resets i18n language to `en` in `afterEach` (see Global Constraints).
