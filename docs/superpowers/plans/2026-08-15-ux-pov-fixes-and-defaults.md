# UX/POV Fixes & Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix eight UX issues (language-bar placement, turn-POV gating, negative-money color, doubles build window, income tax basis, title, setup toggles) and switch defaults to Indonesian (`id`) language and `IDR` currency.

**Architecture:** Client-side turn gating via the existing `isMyTurn` flag (server already rejects non-current-player actions). Remove the doubles auto-`END_TURN` on both client and server. All shared UI strings are in `src/i18n/locales/{en,id}/translation.json`. Unit tests keep asserting English strings, so a Vitest setup file seeds the stored language/currency preferences to English.

**Tech Stack:** React 19 + TypeScript + Vite 8, Vitest 4, Playwright 1.62, i18next, `ws` server.

## Global Constraints

- Default language is `id`; default currency is `IDR` (spec §9). Stored localStorage preferences still override defaults.
- Every new/changed UI string must be added to **both** `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json`.
- Unit/component tests keep asserting **English** strings; `src/test/setup.ts` (added in Task 1) seeds `monopoly-language='en'` + `monopoly-currency='USD'` before i18n loads.
- Gameplay e2e specs seed English via `addInitScript` (added in Task 1).
- The server (`server/gameServer.ts`) is authoritative for whose turn it is; all UI gating is client-only.
- Run `npm run test:unit` (unit+component), `npm run typecheck`, and `npm run lint` at the end of each task. Run `npm run test:e2e` at the end of Tasks 1 and 9.
- Commit after each task with the message given in the task.

---

### Task 1: Defaults — ID language, IDR currency + test scaffolding

**Files:**
- Create: `src/test/setup.ts`
- Modify: `vite.config.ts:8-10`
- Modify: `src/i18n/index.ts:7`
- Modify: `src/data/currency.ts:15`
- Modify: `src/data/__tests__/currency.test.ts:5-7`
- Modify: `e2e/i18n.spec.ts` (full rewrite)
- Modify: `e2e/monopoly.spec.ts:50-52`
- Modify: `e2e/multiplayer.spec.ts:42-45,68-71`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `DEFAULT_LANGUAGE: 'id'`, `DEFAULT_CURRENCY: 'IDR'`; Vitest seeds English for all later tasks; e2e gameplay specs seed English.

- [ ] **Step 1: Create the Vitest setup file that seeds English**

Create `src/test/setup.ts`:

```ts
// Component/hook tests assert against English UI strings. The app now defaults
// to Indonesian, so seed the stored preferences before the i18n singleton loads.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  }
} catch {
  // node environment without localStorage (pure logic tests)
}
```

- [ ] **Step 2: Register the setup file in Vitest**

Modify `vite.config.ts`:

```ts
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['src/test/setup.ts'],
  },
```

- [ ] **Step 3: Write the failing default tests**

Update `src/data/__tests__/currency.test.ts`:

```ts
  it('defaults to IDR', () => {
    expect(DEFAULT_CURRENCY).toBe('IDR');
  });
```

Run: `npm run test:unit -- src/data/__tests__/currency.test.ts`
Expected: FAIL ("expected 'USD' to be 'IDR'").

- [ ] **Step 4: Implement the defaults**

In `src/i18n/index.ts:7`:
```ts
export const DEFAULT_LANGUAGE = 'id'
```

In `src/data/currency.ts:15`:
```ts
export const DEFAULT_CURRENCY: Currency = 'IDR'
```

- [ ] **Step 5: Run the unit suite to verify the seeds hold**

Run: `npm run test:unit`
Expected: all existing tests PASS in English (setup file seeds `en` before i18n import).

- [ ] **Step 6: Rewrite the i18n e2e spec for Indonesian default**

Replace `e2e/i18n.spec.ts` entirely:

```ts
import { test, expect } from '@playwright/test'

test('defaults to Indonesian and toggles to English', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Mulai Permainan')).toBeVisible()
  await page.getByRole('button', { name: 'Pengaturan' }).click()
  await page.getByLabel('Bahasa').selectOption('en')
  await expect(page.getByText('Start Game')).toBeVisible()
})

test('currency defaults to IDR and toggles money symbol', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('player-count').selectOption('2')
  await page.locator('input[type="text"]').nth(0).fill('Alpha')
  await page.locator('input[type="text"]').nth(1).fill('Beta')
  await page.getByRole('button', { name: 'Mulai Permainan' }).click()
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('Rp')
  await page.getByRole('button', { name: 'Pengaturan' }).click()
  await page.getByLabel('Mata Uang').selectOption('USD')
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('$')
})
```

- [ ] **Step 7: Seed English in the gameplay e2e specs**

In `e2e/monopoly.spec.ts`, change the `beforeEach` (lines 50-52):

```ts
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('monopoly-language', 'en')
      localStorage.setItem('monopoly-currency', 'USD')
    })
    await page.goto('/')
  })
```

In `e2e/multiplayer.spec.ts`, wrap each test's pages in a seeded context. In the first test (line 42), replace:

```ts
test('two clients create and join a room, then start a game', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()
```

Do the same for the second test (`a player can leave the room mid-game…`, line 68): create `context` with the same `addInitScript`, then `pageA`/`pageB` from it.

- [ ] **Step 8: Verify typecheck, lint, and e2e**

Run: `npm run typecheck && npm run lint`
Expected: PASS (no errors).

Run: `npm run test:e2e`
Expected: all specs PASS (gameplay specs run in English via the seed; `i18n.spec.ts` asserts Indonesian default).

- [ ] **Step 9: Commit**

```bash
git add src/test/setup.ts vite.config.ts src/i18n/index.ts src/data/currency.ts src/data/__tests__/currency.test.ts e2e/i18n.spec.ts e2e/monopoly.spec.ts e2e/multiplayer.spec.ts
git commit -m "feat: default language to Indonesian and currency to IDR"
```

---

### Task 2: Language/currency widget collapsed to an icon button

**Files:**
- Modify: `src/components/LanguageCurrencyBar.tsx:41-50`
- Create: `src/components/__tests__/LanguageCurrencyBar.test.tsx`

**Interfaces:**
- Consumes: `t('settings.toggle')` (already exists).
- Produces: compact 🌐 toggle; `aria-label` unchanged so existing e2e selectors keep working.

- [ ] **Step 1: Write the failing component test**

Create `src/components/__tests__/LanguageCurrencyBar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import LanguageCurrencyBar from '../LanguageCurrencyBar'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('LanguageCurrencyBar', () => {
  it('shows a collapsed toggle without the EN·USD label', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
    expect(screen.queryByText(/EN · USD/)).toBeNull()
  })

  it('opens the panel when clicked', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByLabel('Language')).toBeVisible()
    expect(screen.getByLabel('Currency')).toBeVisible()
  })
})
```

Run: `npm run test:unit -- src/components/__tests__/LanguageCurrencyBar.test.tsx`
Expected: FAIL (`/EN · USD/` is found because the label is rendered).

- [ ] **Step 2: Implement the collapsed toggle**

In `src/components/LanguageCurrencyBar.tsx`, replace the toggle `<button>` (lines 41-50) with:

```tsx
      <button
        type="button"
        aria-label={t('settings.toggle')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1 text-xs text-text cursor-pointer hover:opacity-90"
      >
        <span aria-hidden>🌐</span>
      </button>
```

This removes the `<span>{i18n.language.toUpperCase()} · {currency}</span>` text. The `i18n.language`/`currency` variables become unused — delete their usages only if the linter flags them (they are still used by the panel above, so leave `t`/`i18n` and `useCurrency` imports intact).

- [ ] **Step 3: Run the test**

Run: `npm run test:unit -- src/components/__tests__/LanguageCurrencyBar.test.tsx`
Expected: PASS.

- [ ] **Step 4: Verify suite, typecheck, lint**

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LanguageCurrencyBar.tsx src/components/__tests__/LanguageCurrencyBar.test.tsx
git commit -m "feat: collapse language/currency bar to icon-only toggle"
```

---

### Task 3: Hide roll button and show waiting status for non-current players

**Files:**
- Modify: `src/components/DiceRoller.tsx:33-37`
- Modify: `src/components/Sidebar.tsx:38-40`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`
- Modify: `src/components/__tests__/DiceRoller.test.tsx:16-25`

**Interfaces:**
- Consumes: `Sidebar` already receives `isMyTurn: boolean`; `DiceRoller` already receives `isMyTurn?: boolean`.
- Produces: new i18n key `turn.waitingFor` (params: `name`); roll button rendered only when `isMyTurn`.

- [ ] **Step 1: Write the failing test updates**

In `src/components/__tests__/DiceRoller.test.tsx`, replace the first test (lines 17-20) so the button is hidden, not disabled:

```tsx
  it('hides the roll button when it is not the current player turn', () => {
    renderWithProviders(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={false} />)
    expect(screen.queryByRole('button', { name: 'Roll Dice' })).toBeNull()
  })
```

Run: `npm run test:unit -- src/components/__tests__/DiceRoller.test.tsx`
Expected: FAIL (button still present and disabled).

- [ ] **Step 2: Hide the roll button when not my turn**

In `src/components/DiceRoller.tsx:33-37`, change the button render condition and drop the now-redundant `disabled`:

```tsx
      {(canRoll || canRollJail) && isMyTurn && (
        <Button variant="primary" size="lg" onClick={handleRoll}>
          {player.inJail ? t('dice.rollJail') : t('dice.roll')}
        </Button>
      )}
```

- [ ] **Step 3: Add the "waiting for" line in Sidebar**

In `src/components/Sidebar.tsx`, replace the `ActionSection` line (line 40):

```tsx
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} />
        {isMyTurn ? (
          <ActionSection state={state} {...actions} isMyTurn={isMyTurn} />
        ) : (
          <p className="text-base text-muted text-center" data-testid="waiting-for">
            {t('turn.waitingFor', { name: state.players[state.currentPlayer].name })}
          </p>
        )}
```

- [ ] **Step 4: Add the i18n strings**

In both `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json`, add under the `turn` object:

```json
"turn.waitingFor": "Waiting for {{name}}…"
```
```json
"turn.waitingFor": "Menunggu {{name}}…"
```

- [ ] **Step 5: Run the tests**

Run: `npm run test:unit -- src/components/__tests__/DiceRoller.test.tsx`
Expected: PASS.

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DiceRoller.tsx src/components/Sidebar.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/components/__tests__/DiceRoller.test.tsx
git commit -m "feat: hide roll button and show waiting status for non-current players"
```

---

### Task 4: Gate modal and tooltip action buttons by `isMyTurn`

**Files:**
- Modify: `src/components/GameView.tsx:10-41`
- Modify: `src/components/GameBoard.tsx:7-29`
- Modify: `src/components/BoardGrid.tsx:79,159-180`
- Modify: `src/components/PropertyTooltip.tsx:8-14,94`
- Modify: `src/components/Modals/CardModal.tsx`
- Modify: `src/components/Modals/BankruptcyModal.tsx`
- Create: `src/components/__tests__/CardModal.test.tsx`
- Create: `src/components/__tests__/BankruptcyModal.test.tsx`
- Modify: `src/components/__tests__/PropertyTooltip.test.tsx`

**Interfaces:**
- Consumes: `GameView` already computes `isMyTurn`.
- Produces: `GameBoard`/`BoardGrid`/`PropertyTooltip` gain `isMyTurn: boolean`; `CardModal`/`BankruptcyModal` gain `isMyTurn: boolean`; `PropertyTooltip.isMyTurn` defaults to `true`.

- [ ] **Step 1: Write failing tests for CardModal and BankruptcyModal**

Create `src/components/__tests__/CardModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import CardModal from '../Modals/CardModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, PendingActionType, type GameState } from '../../types/game'

function makeState(): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, pendingAction: { type: PendingActionType.CardEffect, card: { id: 0, type: 'chance', effect: { action: 'collect', amount: 50 } } } }
}

afterEach(cleanup)

describe('CardModal', () => {
  it('shows OK for the current player', () => {
    renderWithProviders(<CardModal state={makeState()} isMyTurn={true} onResolve={() => {}} />)
    expect(screen.getByRole('button', { name: 'OK' })).toBeVisible()
  })

  it('hides OK and shows a waiting note for other players', () => {
    renderWithProviders(<CardModal state={makeState()} isMyTurn={false} onResolve={() => {}} />)
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()
    expect(screen.getByText(/Waiting for/)).toBeVisible()
  })
})
```

Create `src/components/__tests__/BankruptcyModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import BankruptcyModal from '../Modals/BankruptcyModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, PendingActionType, type GameState } from '../../types/game'

function makeState(amount: number): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, pendingAction: { type: PendingActionType.Bankruptcy, amount, spaceId: 1 } }
}

afterEach(cleanup)

describe('BankruptcyModal', () => {
  it('shows action buttons for the current player', () => {
    renderWithProviders(<BankruptcyModal state={makeState(99999)} isMyTurn={true} onClose={() => {}} onBankruptcy={() => {}} />)
    expect(screen.getByRole('button', { name: /Declare Bankruptcy/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Close/ })).toBeVisible()
  })

  it('hides action buttons for other players', () => {
    renderWithProviders(<BankruptcyModal state={makeState(99999)} isMyTurn={false} onClose={() => {}} onBankruptcy={() => {}} />)
    expect(screen.queryByRole('button', { name: /Declare Bankruptcy/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Close/ })).toBeNull()
    expect(screen.getByText(/Waiting for/)).toBeVisible()
  })
})
```

Add to `src/components/__tests__/PropertyTooltip.test.tsx`:

```tsx
  it('hides owner action buttons when it is not your turn', () => {
    renderWithProviders(<PropertyTooltip space={{ ...mortgagedSpace, mortgaged: false }} state={makeState(100)} isMyTurn={false} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.queryByRole('button', { name: /Mortgage/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Sell to Bank/ })).toBeNull()
  })
```

Run: `npm run test:unit -- src/components/__tests__/CardModal.test.tsx src/components/__tests__/BankruptcyModal.test.tsx src/components/__tests__/PropertyTooltip.test.tsx`
Expected: type errors / FAIL (components don't accept `isMyTurn` yet; PropertyTooltip still shows buttons).

- [ ] **Step 2: Thread `isMyTurn` through GameView → GameBoard → BoardGrid → PropertyTooltip**

In `src/components/GameView.tsx`, pass `isMyTurn` to `GameBoard` and the modals:

```tsx
      <GameBoard
        state={state}
        isMyTurn={isMyTurn}
        onSell={game.sellHouse}
        onMortgage={game.mortgage}
        onUnmortgage={game.unmortgage}
        onSellProperty={game.sellProperty}
      >
        ...
      </GameBoard>
      <CardModal state={state} isMyTurn={isMyTurn} onResolve={game.resolveCard} />
      <BankruptcyModal state={state} isMyTurn={isMyTurn} onClose={game.skipAction} onBankruptcy={game.declareBankruptcy} />
```

In `src/components/GameBoard.tsx`, add the prop and forward it:

```tsx
interface Props {
  state: GameState
  isMyTurn: boolean
  children?: ReactNode
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onSellProperty: (spaceId: number) => void
}

export default function GameBoard({ state, isMyTurn, children, onSell, onMortgage, onUnmortgage, onSellProperty }: Props) {
```

and add `isMyTurn={isMyTurn}` to the `<BoardGrid ... />` call.

In `src/components/BoardGrid.tsx`, add `isMyTurn: boolean` to `Props`, destructure it, and pass `isMyTurn={isMyTurn}` to `<PropertyTooltip ... />` (line 172).

- [ ] **Step 3: Gate the PropertyTooltip owner-action block**

In `src/components/PropertyTooltip.tsx`, add `isMyTurn` to `Props` with a default, and gate the action block (line 94):

```tsx
interface Props {
  space: Space
  state: GameState
  isMyTurn?: boolean
  onSell: (id: number) => void
  onMortgage: (id: number) => void
  onUnmortgage: (id: number) => void
  onSellProperty: (id: number) => void
}

export default function PropertyTooltip({
  space, state, isMyTurn = true, onSell, onMortgage, onUnmortgage, onSellProperty,
}: Props) {
```

```tsx
      {isOwned && isMyTurn && (
        <div className="mt-1.5 pt-1.5 border-t border-border-light flex flex-col gap-[3px]">
```

- [ ] **Step 4: Gate CardModal**

In `src/components/Modals/CardModal.tsx`, replace the props and actions block:

```tsx
interface Props {
  state: GameState
  isMyTurn: boolean
  onResolve: () => void
}

export default function CardModal({ state, isMyTurn, onResolve }: Props) {
  const { t } = useTranslation()
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.CardEffect) return null
  const player = state.players[state.currentPlayer]

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">
        {t(pending.card.type === CardType.Chance ? 'cardmodal.chance' : 'cardmodal.community')}
      </h3>
      <p className="text-xl p-4 bg-bg-dark rounded-lg text-center">
        {t('card.' + (pending.card.type === CardType.Chance ? 'chance' : 'community') + '.' + pending.card.id)}
      </p>
      <Modal.Actions>
        {isMyTurn ? (
          <Button variant="primary" onClick={onResolve}>OK</Button>
        ) : (
          <p className="text-base text-muted text-center">{t('turn.waitingFor', { name: player.name })}</p>
        )}
      </Modal.Actions>
    </Modal>
  )
}
```

- [ ] **Step 5: Gate BankruptcyModal**

In `src/components/Modals/BankruptcyModal.tsx`, add `isMyTurn: boolean` to `Props`, destructure it, and gate the actions (lines 40-45):

```tsx
      <Modal.Actions>
        {!isMyTurn ? (
          <p className="text-base text-muted text-center">{t('turn.waitingFor', { name: player.name })}</p>
        ) : (
          <>
            {!canPayAfterLiquidation && (
              <Button variant="danger" onClick={onBankruptcy}>{t('bankruptcy.declare')}</Button>
            )}
            <Button variant="secondary" onClick={onClose}>{t('bankruptcy.close')}</Button>
          </>
        )}
      </Modal.Actions>
```

- [ ] **Step 6: Run tests, typecheck, lint**

Run: `npm run test:unit -- src/components/__tests__/CardModal.test.tsx src/components/__tests__/BankruptcyModal.test.tsx src/components/__tests__/PropertyTooltip.test.tsx`
Expected: PASS.

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/GameView.tsx src/components/GameBoard.tsx src/components/BoardGrid.tsx src/components/PropertyTooltip.tsx src/components/Modals/CardModal.tsx src/components/Modals/BankruptcyModal.tsx src/components/__tests__/CardModal.test.tsx src/components/__tests__/BankruptcyModal.test.tsx src/components/__tests__/PropertyTooltip.test.tsx
git commit -m "feat: gate modal and tooltip actions by player turn"
```

---

### Task 5: Negative money shown in red

**Files:**
- Modify: `src/components/PlayerCard.tsx:76,122`
- Modify: `src/components/__tests__/PlayerCard.test.tsx`

**Interfaces:**
- Consumes: existing `Player.money`; class names `text-red-danger` / `text-green-money` already defined in the design system.

- [ ] **Step 1: Write the failing test**

Append to `src/components/__tests__/PlayerCard.test.tsx`:

```tsx
  it('shows negative money in red and positive money in green', () => {
    renderWithProviders(<PlayerCard player={{ ...player, money: -5 }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    const negativeDiv = screen.getByText(/-\$5/).closest('div')!
    expect(negativeDiv.className).toContain('text-red-danger')

    renderWithProviders(<PlayerCard player={{ ...player, money: 15000 }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    const positiveDiv = screen.getByText(/\$15,000/).closest('div')!
    expect(positiveDiv.className).toContain('text-green-money')
  })
```

Run: `npm run test:unit -- src/components/__tests__/PlayerCard.test.tsx`
Expected: FAIL (both divs are `text-green-money`).

- [ ] **Step 2: Implement the conditional color**

In `src/components/PlayerCard.tsx:76`, change the money div:

```tsx
        <div className={[
          'text-sm font-semibold flex items-center relative',
          player.money < 0 ? 'text-red-danger' : 'text-green-money',
        ].join(' ')}>
```

In `src/components/PlayerCard.tsx:122` (`PlayerPopup` money line), apply the same conditional:

```tsx
      <div className={player.money < 0 ? 'text-sm text-red-danger mb-1.5' : 'text-sm text-green-money mb-1.5'}>
        {t('card.money')}<strong>{formatMoney(player.money)}</strong>
      </div>
```

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npm run test:unit -- src/components/__tests__/PlayerCard.test.tsx`
Expected: PASS.

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlayerCard.tsx src/components/__tests__/PlayerCard.test.tsx
git commit -m "feat: show negative money in red on player cards"
```

---

### Task 6: Doubles — remove auto-advance, add "Roll Again"

**Files:**
- Modify: `src/hooks/useGame.ts:84-91`
- Modify: `server/gameServer.ts:263-282`
- Modify: `src/components/ActionSection.tsx:138`
- Modify: `src/components/DiceRoller.tsx:34-36`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`
- Modify: `src/hooks/__tests__/useGame.test.ts:22-39`
- Modify: `server/__tests__/gameServer.test.ts:115-136`
- Modify: `src/components/__tests__/ActionSection.test.tsx`
- Modify: `src/components/__tests__/DiceRoller.test.tsx`

**Interfaces:**
- Consumes: `GameState.doublesCount`, `GameState.dice`.
- Produces: new i18n key `action.rollAgain`. After doubles, `END_TURN` keeps the same player (unchanged reducer behavior) and the roll button reappears labeled "Roll Again".

- [ ] **Step 1: Write the failing hook test**

Replace the single test in `src/hooks/__tests__/useGame.test.ts` (lines 22-39) with:

```ts
  it('does not auto-advance after rolling doubles', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // dice [4,4]
    const { result } = renderHook(() => useGame())
    act(() => result.current.startGame(2, ['Alice', 'Bob']))

    act(() => result.current.roll())
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toEqual([4, 4])
    expect(result.current.state.doublesCount).toBe(1)

    act(() => vi.advanceTimersByTime(500 + 8 * 150))
    expect(result.current.state.phase).toBe(GamePhase.Waiting)
    expect(result.current.state.dice).toEqual([4, 4])

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toEqual([4, 4])
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.eventLog.some((e) => e.key === 'event.doublesAgain')).toBe(false)
  })
```

Run: `npm run test:unit -- src/hooks/__tests__/useGame.test.ts`
Expected: FAIL (dice becomes null and `event.doublesAgain` present).

- [ ] **Step 2: Remove the client auto-advance effect**

In `src/hooks/useGame.ts`, delete the entire effect at lines 84-91:

```ts
  useEffect(() => {
    const dice = state.dice
    const isDoubles = dice !== null && dice[0] === dice[1]
    if (state.phase === GamePhase.Waiting && !state.pendingAction && isDoubles && state.doublesCount > 0) {
      const t = setTimeout(() => dispatch({ type: 'END_TURN' }), 500)
      return () => clearTimeout(t)
    }
  }, [state.phase, state.pendingAction, state.dice, state.doublesCount])
```

- [ ] **Step 3: Remove the server auto-advance branch**

In `server/gameServer.ts`, delete the `else if (... doubles ...)` branch inside `scheduleAutoSteps` (lines 263-282):

```ts
    } else if (
      s.phase === GamePhase.Waiting &&
      !s.pendingAction &&
      s.dice !== null &&
      s.dice[0] === s.dice[1] &&
      s.doublesCount > 0
    ) {
      setTimeout(() => {
        const st = this.state
        if (
          st.phase === GamePhase.Waiting &&
          !st.pendingAction &&
          st.dice !== null &&
          st.dice[0] === st.dice[1] &&
          st.doublesCount > 0
        ) {
          this.dispatch({ type: 'END_TURN' })
        }
      }, 500)
    }
```

- [ ] **Step 4: Update the server test**

Replace the test at `server/__tests__/gameServer.test.ts:115-136` with:

```ts
  it('does not auto-advance after doubles until an explicit END_TURN', () => {
    vi.useFakeTimers()
    const rng = () => 0.5 // dice [4,4], doubles
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0')
    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([4, 4])
    expect(server.getState().doublesCount).toBe(1)

    vi.advanceTimersByTime(500 + 8 * 150) // RESOLVE_SPACE (space 8 unowned → mustCircleBoard → Waiting)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(500) // previously auto END_TURN
    expect(server.getState().dice).toEqual([4, 4])
    expect(server.getState().currentPlayer).toBe(0)
    expect(server.getState().eventLog.some((e) => e.key === 'event.doublesAgain')).toBe(false)
    vi.useRealTimers()
  })
```

- [ ] **Step 5: Add "Roll Again" label tests**

Append to `src/components/__tests__/ActionSection.test.tsx`:

```tsx
  it('labels the advance button Roll Again after rolling doubles', () => {
    let s = makeState()
    s = { ...s, dice: [3, 3], doublesCount: 1 }
    renderWithProviders(<ActionSection state={s} {...actions} />)
    expect(screen.getByRole('button', { name: /Roll Again/ })).toBeVisible()
  })
```

Append to `src/components/__tests__/DiceRoller.test.tsx`:

```tsx
  it('labels the roll button Roll Again when a doubles roll is pending', () => {
    const s = { ...makeState(), doublesCount: 1 } // dice stays null, so canRoll is true
    renderWithProviders(<DiceRoller state={s} onRoll={() => {}} isMyTurn={true} />)
    expect(screen.queryByRole('button', { name: 'Roll Dice' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Roll Again' })).toBeEnabled()
  })
```

Run: `npm run test:unit -- src/components/__tests__/ActionSection.test.tsx src/components/__tests__/DiceRoller.test.tsx`
Expected: FAIL (labels still say "End Turn"/"Roll Dice").

- [ ] **Step 6: Implement the labels**

In `src/components/ActionSection.tsx:138`, use the doubles-aware label:

```tsx
              <Button variant="secondary" onClick={onEndTurn}>{t(state.doublesCount > 0 ? 'action.rollAgain' : 'action.endTurn')}</Button>
```

In `src/components/DiceRoller.tsx:35`, use the doubles-aware label:

```tsx
        <Button variant="primary" size="lg" onClick={handleRoll}>
          {player.inJail ? t('dice.rollJail') : state.doublesCount > 0 ? t('action.rollAgain') : t('dice.roll')}
        </Button>
```

Add the new key to both locale files (under `action`):

```json
"action.rollAgain": "Roll Again"
```
```json
"action.rollAgain": "Lempar Lagi"
```

- [ ] **Step 7: Run all tests, typecheck, lint**

Run: `npm run test:unit -- src/hooks/__tests__/useGame.test.ts src/components/__tests__/ActionSection.test.tsx src/components/__tests__/DiceRoller.test.tsx`
Expected: PASS.

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS (server tests run via `npm run test:unit`).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useGame.ts server/gameServer.ts src/components/ActionSection.tsx src/components/DiceRoller.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/hooks/__tests__/useGame.test.ts server/__tests__/gameServer.test.ts src/components/__tests__/ActionSection.test.tsx src/components/__tests__/DiceRoller.test.tsx
git commit -m "feat: stop auto-advancing after doubles so players can build first"
```

---

### Task 7: Income tax = 10% of current money

**Files:**
- Modify: `src/logic/gameReducer.ts:5,261-282`
- Modify: `src/i18n/log.ts:4`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`
- Modify: `src/logic/__tests__/gameReducer.test.ts:454-464`

**Interfaces:**
- Consumes: `INCOME_TAX_RATE` (0.1).
- Produces: `event.incomeTax` params become `{ name, amount, money }` (was `netWorth`).

- [ ] **Step 1: Write the failing reducer tests**

Replace the test at `src/logic/__tests__/gameReducer.test.ts:455-464` with:

```ts
    it('pays income tax (10% of current money) to free parking', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 4);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(STARTING_MONEY - 150);
      expect(s1.freeParkingPot).toBe(150);
      expect(s1.eventLog).toContainEqual({ key: 'event.incomeTax', params: { name: 'Alice', amount: 150, money: STARTING_MONEY } })
    });

    it('income tax ignores property value (10% of money only)', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: state.players.map((p, i) => i === 0 ? { ...p, money: 1000, properties: [1] } : p),
        board: state.board.map((b) => b.id === 1 ? { ...b, owner: 0 } : b),
      };
      state = setPosition(state, 0, 4);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(1000 - 100);
      expect(s1.freeParkingPot).toBe(100);
    });
```

Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL (event params still use `netWorth`; second test taxes property value too).

- [ ] **Step 2: Implement the tax change**

In `src/logic/gameReducer.ts`, update the `Tax` case (lines 261-282) to use current money and drop `netWorth`:

```ts
        case SpaceType.Tax: {
          const isIncome = space.taxType === 'income';
          const taxAmount = isIncome
            ? Math.floor(player.money * INCOME_TAX_RATE)
            : (space.price ?? 0);
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            money: player.money - taxAmount,
          };
          const message: LogEntry = isIncome
            ? { key: 'event.incomeTax', params: { name: player.name, amount: taxAmount, money: player.money } }
            : { key: 'event.luxuryTax', params: { name: player.name, amount: taxAmount } };
          return {
            ...state,
            phase: GamePhase.Waiting,
            players: newPlayers,
            freeParkingPot: state.freeParkingPot + taxAmount,
            eventLog: [...state.eventLog, message],
          };
        }
```

Remove the now-unused import `getPlayerNetWorth` from line 5 (keep the rest):

```ts
import { calculatePropertyRent, calculateRailroadRentFromBoard, calculateUtilityRentFromBoard, isMonopoly } from './rent';
```

- [ ] **Step 3: Update the money-param key and locale strings**

In `src/i18n/log.ts:4`:

```ts
const MONEY_PARAM_KEYS = new Set(['amount', 'money'])
```

In `src/i18n/locales/en/translation.json`, update `event.incomeTax` and `tooltip.incomeTax`:

```json
"event.incomeTax": "{{name}} paid {{amount}} income tax (10% of current money {{money}})"
```
```json
"tooltip.incomeTax": "Pay 10% of your current money"
```

In `src/i18n/locales/id/translation.json`:

```json
"event.incomeTax": "{{name}} membayar pajak penghasilan {{amount}} (10% dari uang saat ini {{money}})"
```
```json
"tooltip.incomeTax": "Bayar 10% dari uang saat ini"
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npm run test:unit -- src/logic/__tests__/gameReducer.test.ts`
Expected: PASS.

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logic/gameReducer.ts src/i18n/log.ts src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/logic/__tests__/gameReducer.test.ts
git commit -m "feat: income tax is 10% of current money, not total assets"
```

---

### Task 8: Title → "Monopoly"

**Files:**
- Modify: `src/i18n/locales/en/translation.json:113`
- Modify: `src/i18n/locales/id/translation.json:113`
- Modify: `e2e/monopoly.spec.ts:55`

**Interfaces:**
- Consumes: `setup.title` rendered by `GameSetup` `<h1>`.
- Produces: h1 text "Monopoly" (en) / "Monopoli" (id).

- [ ] **Step 1: Update the e2e assertion (failing)**

In `e2e/monopoly.spec.ts:55`:

```ts
    await expect(page.locator('h1')).toHaveText('Monopoly')
```

Run: `npm run test:e2e -- e2e/monopoly.spec.ts`
Expected: FAIL (h1 is "Indonesia Monopoly").

- [ ] **Step 2: Update the locale strings**

In `src/i18n/locales/en/translation.json`:
```json
"setup.title": "Monopoly",
```

In `src/i18n/locales/id/translation.json`:
```json
"setup.title": "Monopoli",
```

- [ ] **Step 3: Verify**

Run: `npm run test:e2e -- e2e/monopoly.spec.ts`
Expected: PASS.

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json e2e/monopoly.spec.ts
git commit -m "feat: rename title to Monopoly"
```

---

### Task 9: Setup toggle clarity

**Files:**
- Modify: `src/components/GameSetup.tsx:43-48,100-105`

**Interfaces:**
- Consumes: `Button` accepts `className` (appended to its own classes).
- Produces: active toggle gets `ring-2 ring-gold/80`; inactive gets `opacity-60`.

- [ ] **Step 1: Write the failing component test**

Append to `src/components/__tests__/GameSetup.test.tsx`:

```tsx
  it('marks the active mode toggle with a gold ring', () => {
    renderWithProviders(<GameSetup onStartLocal={() => {}} onCreate={() => {}} onJoin={() => {}} />)
    const single = screen.getByText('Single Device').closest('button')!
    const multiplayer = screen.getByText('Multiplayer (LAN)').closest('button')!
    expect(single.className).toContain('ring-gold')
    expect(multiplayer.className).toContain('opacity-60')
  })
```

Run: `npm run test:unit -- src/components/__tests__/GameSetup.test.tsx`
Expected: FAIL (neither button has the ring/opacity classes).

- [ ] **Step 2: Implement the active-state classes**

In `src/components/GameSetup.tsx`, update the mode toggle pair (lines 43-48):

```tsx
        <div className="flex gap-2">
          <Button
            variant={mode === 'local' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('local')}
            className={mode === 'local' ? 'ring-2 ring-gold/80' : 'opacity-60'}
          >
            {t('setup.singleDevice')}
          </Button>
          <Button
            variant={mode === 'multiplayer' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('multiplayer')}
            className={mode === 'multiplayer' ? 'ring-2 ring-gold/80' : 'opacity-60'}
          >
            {t('setup.multiplayer')}
          </Button>
        </div>
```

Update the create/join pair (lines 100-105) the same way, keyed on `mpAction === 'create'` / `mpAction === 'join'`.

- [ ] **Step 3: Run tests, typecheck, lint**

Run: `npm run test:unit -- src/components/__tests__/GameSetup.test.tsx`
Expected: PASS.

Run: `npm run test:unit && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 4: Run full e2e and commit**

Run: `npm run test:e2e`
Expected: all specs PASS.

```bash
git add src/components/GameSetup.tsx src/components/__tests__/GameSetup.test.tsx
git commit -m "feat: add clear selected indicator to setup toggles"
```

---

## Self-review notes

- **Spec coverage:** each of the nine spec decisions maps to a task (1→Task 1, 2→Task 3, 3→Task 4, 4→Task 5, 5→Task 6, 6→Task 7, 7→Task 8, 8→Task 9, 9→Task 1). `GameOverModal` is intentionally ungated per spec §3.
- **Doubles flow contract:** the reducer's `END_TURN` already keeps the same player on doubles (`gameReducer.ts:611-623`), so removing the auto-timer is the only change needed for the "roll again" behavior; labels are cosmetic.
- **Type consistency:** `isMyTurn` is threaded as `boolean` from `GameView` through `GameBoard` → `BoardGrid` → `PropertyTooltip` (default `true`), and into `CardModal`/`BankruptcyModal`; `PropertyTooltip`'s default keeps its five existing tests green.
- **Test seeding:** `src/test/setup.ts` runs before test-file imports in Vitest, so the i18n singleton resolves to `en`; the `useGame` test's localStorage stub (which returns `null`) does not affect the already-initialized i18n singleton.
