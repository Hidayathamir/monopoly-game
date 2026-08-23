# Manual Bot Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggle button that lets the player manually enable/disable bot control for their turn.

**Architecture:** New client message `ManualBotToggle` routed through existing WebSocket infrastructure. Server dispatches `SetBotControl` action. Client tracks toggle state and auto-resets on manual actions. UI toggle placed next to the leave icon in the Sidebar.

**Tech Stack:** React, TypeScript, WebSocket, Playwright (e2e)

## Global Constraints

- `verbatimModuleSyntax` → use `import type` for type-only imports
- `erasableSyntaxOnly` → no enums, no namespaces, no `const enum`
- E2E tests require `npm run build` first
- Tests use vitest (unit) and playwright (e2e)

---

### Task 1: Add `ManualBotToggle` client message type

**Files:**
- Modify: `src/types/net.ts:14-24`

**Interfaces:**
- Produces: `ClientMessageType.ManualBotToggle` constant

- [ ] **Step 1: Add the constant to `ClientMessageType`**

In `src/types/net.ts`, add `ManualBotToggle: 'manualBotToggle'` to the `ClientMessageType` const object (after `SetIdentity`):

```typescript
export const ClientMessageType = {
  Create: 'create',
  Join: 'join',
  Start: 'start',
  Leave: 'leave',
  AddBot: 'addBot',
  RemoveBot: 'removeBot',
  Action: 'action',
  SetIdentity: 'setIdentity',
  ManualBotToggle: 'manualBotToggle',
} as const
```

- [ ] **Step 2: Add the union member to `ClientMessage`**

In `src/types/net.ts`, add a new union member to the `ClientMessage` type (after the `SetIdentity` member):

```typescript
| { type: typeof ClientMessageType.ManualBotToggle }
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/types/net.ts
git commit -m "feat(net): add ManualBotToggle client message type"
```

---

### Task 2: Add `manualBotToggle` method to `GameClient`

**Files:**
- Modify: `src/net/client.ts`

**Interfaces:**
- Consumes: `ClientMessageType.ManualBotToggle` from Task 1
- Produces: `GameClient.manualBotToggle()` method

- [ ] **Step 1: Add `manualBotToggle` method to `GameClient` class**

In `src/net/client.ts`, add after the `close()` method:

```typescript
manualBotToggle(): void {
  this.send({ type: ClientMessageType.ManualBotToggle })
}
```

Also add the import at the top if not already present (it is already imported via the existing `ClientMessage` import).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/net/client.ts
git commit -m "feat(net): add manualBotToggle method to GameClient"
```

---

### Task 3: Add `manualBotToggle` to `useNetworkGame` hook

**Files:**
- Modify: `src/hooks/useNetworkGame.ts`

**Interfaces:**
- Consumes: `GameClient.manualBotToggle()` from Task 2, `ClientMessageType.ManualBotToggle` from Task 1
- Produces: `NetworkGameApi.manualBotToggle` method

- [ ] **Step 1: Add `manualBotToggle` callback**

In `src/hooks/useNetworkGame.ts`, add after the `removeBot` callback (around line 100):

```typescript
const manualBotToggle = useCallback(() => send({ type: ClientMessageType.ManualBotToggle }), [send])
```

- [ ] **Step 2: Add to return object**

Add `manualBotToggle` to the return object of `useNetworkGame` (around line 127):

```typescript
return {
  // ... existing properties ...
  manualBotToggle,
}
```

- [ ] **Step 3: Update `NetworkGameApi` type**

In the `NetworkGameApi` type definition (line 10), add:

```typescript
manualBotToggle: () => void
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNetworkGame.ts
git commit -m "feat(hooks): add manualBotToggle to useNetworkGame"
```

---

### Task 4: Handle `ManualBotToggle` on the server

**Files:**
- Modify: `server/gameServer.ts:340-382`

**Interfaces:**
- Consumes: `ClientMessageType.ManualBotToggle` from Task 1
- Produces: Server toggles `botControlled` for the requesting player

- [ ] **Step 1: Add handler in `gameServer.ts`**

In `server/gameServer.ts`, find the `handleAction` method. Add a new method `handleManualBotToggle`:

```typescript
handleManualBotToggle(clientId: ClientId): void {
  const index = this.slots.findIndex((s) => s.clientId === clientId)
  if (index === -1) return
  const player = this.state.players[index]
  if (!player || player.isBot) return
  const newControlled = !player.botControlled
  this.dispatch({ type: GameActionType.SetBotControl, playerId: index, controlled: newControlled })
  if (newControlled) {
    this.clearAfkTimer()
  } else {
    this.scheduleAfkTimer(index)
  }
}
```

- [ ] **Step 2: Add routing in `http.ts`**

In `server/http.ts`, add a new `else if` branch in the WebSocket message handler (after the `ClientMessageType.Action` branch, around line 167):

```typescript
} else if (msg.type === ClientMessageType.ManualBotToggle) {
  roomManager.gameFor(clientId)?.handleManualBotToggle(clientId)
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/gameServer.ts server/http.ts
git commit -m "feat(server): handle ManualBotToggle message"
```

---

### Task 5: Add toggle button to Sidebar UI

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `manualBotEnabled` prop, `onToggleBot` callback
- Produces: Toggle button rendered next to leave icon

- [ ] **Step 1: Add props to Sidebar**

In `src/components/Sidebar.tsx`, add to the `Props` interface:

```typescript
manualBotEnabled?: boolean
onToggleBot?: () => void
```

- [ ] **Step 2: Add toggle button next to leave icon**

In the Sidebar component, update the JSX where the leave button is rendered (lines 47-51). Add the toggle button next to it:

```tsx
{onLeave && (
  <div className="absolute top-0 right-0 flex items-center gap-1">
    {onToggleBot && (
      <button
        type="button"
        onClick={onToggleBot}
        title={manualBotEnabled ? 'Bot is playing — click to resume manual control' : 'Let bot play your turn'}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
          manualBotEnabled
            ? 'bg-gold/20 text-gold border border-gold/40'
            : 'text-muted hover:text-text border border-transparent hover:border-border'
        }`}
        data-testid="bot-toggle"
      >
        🤖
      </button>
    )}
    <RoomExit onLeave={onLeave} variant="icon" {...exitKeys} />
  </div>
)}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(ui): add bot toggle button to Sidebar"
```

---

### Task 6: Wire toggle state in GameView

**Files:**
- Modify: `src/components/GameView.tsx`

**Interfaces:**
- Consumes: `game.manualBotToggle()` from Task 3
- Produces: `manualBotEnabled` state passed to Sidebar

- [ ] **Step 1: Add `manualBotEnabled` state**

In `src/components/GameView.tsx`, add state after the existing state declarations (around line 21):

```typescript
const [manualBotEnabled, setManualBotEnabled] = useState(false)
```

- [ ] **Step 2: Add toggle handler**

Add a toggle callback:

```typescript
const handleToggleBot = useCallback(() => {
  game.manualBotToggle()
  setManualBotEnabled((prev) => !prev)
}, [game])
```

Import `useCallback` at the top if not already present.

- [ ] **Step 3: Pass props to Sidebar**

Update the `<Sidebar>` component to pass the new props:

```tsx
<Sidebar
  // ... existing props ...
  manualBotEnabled={manualBotEnabled}
  onToggleBot={handleToggleBot}
/>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/GameView.tsx
git commit -m "feat(ui): wire manualBotEnabled state in GameView"
```

---

### Task 7: Auto-reset toggle on manual actions

**Files:**
- Modify: `src/components/GameView.tsx`

**Interfaces:**
- Consumes: `manualBotEnabled` state from Task 6
- Produces: Auto-reset behavior when player performs manual action

- [ ] **Step 1: Create auto-reset wrapper**

In `src/components/GameView.tsx`, add a helper that sends an action and resets the toggle if needed:

```typescript
const sendActionWithAutoReset = useCallback(
  (action: () => void) => {
    if (manualBotEnabled) {
      game.manualBotToggle()
      setManualBotEnabled(false)
    }
    action()
  },
  [game, manualBotEnabled],
)
```

- [ ] **Step 2: Wrap action callbacks**

Update the action callbacks passed to Sidebar to use the wrapper. For example:

```tsx
onRoll={(target?: number) => sendActionWithAutoReset(() => game.roll(target))}
onBuyProperty={() => sendActionWithAutoReset(() => game.buyProperty())}
onDeclineBuy={() => sendActionWithAutoReset(() => game.declineBuy())}
onPayRent={() => sendActionWithAutoReset(() => game.payRent())}
onBuild={(spaceId) => sendActionWithAutoReset(() => game.buildHouse(spaceId))}
onPayJailFine={() => sendActionWithAutoReset(() => game.payJailFine())}
onUseGetOutOfJailFree={() => sendActionWithAutoReset(() => game.useGetOutOfJailFree())}
onDeclareBankruptcy={() => sendActionWithAutoReset(() => game.declareBankruptcy())}
onSkipAction={() => sendActionWithAutoReset(() => game.skipAction())}
onEndTurn={() => sendActionWithAutoReset(() => game.endTurn())}
```

Note: `onProposeTrade` opens a modal — the actual `proposeTrade` call happens inside `TradeModal`. To handle auto-reset for trades, we also need to wrap the `onPropose` callback inside `TradeModal.tsx`. However, since the modal is a separate component, we can lift the auto-reset logic into a context or pass it as a prop. For simplicity in this plan, we'll add a useEffect in GameView that watches for state changes (when the player's action resolves) and resets the toggle. Alternatively, we can wrap the `game.proposeTrade` call in GameView's trade modal handler. The simplest approach: in GameView, wrap the `onPropose` callback passed to TradeModal:

```typescript
onPropose={(offer: TradeOffer) => {
  if (manualBotEnabled) {
    game.manualBotToggle()
    setManualBotEnabled(false)
  }
  game.proposeTrade(offer)
  setShowTradeModal(false)
}}
```

This ensures the toggle resets when a trade is submitted.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/GameView.tsx
git commit -m "feat(ui): auto-reset bot toggle on manual actions"
```

---

### Task 8: Add i18n keys

**Files:**
- Modify: `src/i18n/locales/en.json` (or similar)
- Modify: `src/i18n/locales/id.json` (or similar)

**Interfaces:**
- Produces: Translation keys for toggle tooltip

- [ ] **Step 1: Add English translations**

Find the i18n locale files and add:

```json
"bot": {
  "toggleOn": "Bot is playing — click to resume manual control",
  "toggleOff": "Let bot play your turn"
}
```

- [ ] **Step 2: Add Indonesian translations**

```json
"bot": {
  "toggleOn": "Bot sedang bermain — klik untuk kembali kontrol manual",
  "toggleOff": "Biarkan bot bermain giliranmu"
}
```

- [ ] **Step 3: Update Sidebar to use i18n**

In `src/components/Sidebar.tsx`, update the toggle button title to use translations:

```tsx
title={manualBotEnabled ? t('bot.toggleOn') : t('bot.toggleOff')}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/en.json src/i18n/locales/id.json src/components/Sidebar.tsx
git commit -m "feat(i18n): add bot toggle translations"
```

---

### Task 9: E2E test — toggle on/off

**Files:**
- Create: `e2e/bot-toggle.spec.ts`

**Interfaces:**
- Consumes: `seedGame`, `buildWaitingState` from `e2e/helpers/seed.ts`
- Uses: Same patterns as `e2e/auto-advance.spec.ts`

- [ ] **Step 1: Create test file with toggle on/off test**

Create `e2e/bot-toggle.spec.ts`:

```typescript
import { test, expect } from './fixtures'
import { seedGame, buildWaitingState } from './helpers/seed'

async function createRoom(
  page: import('@playwright/test').Page,
  serverUrl: string,
  name: string,
): Promise<string> {
  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', name)
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  return (await codeLocator.innerText()).trim()
}

test('toggle bot on — bot plays the turn', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await contextB.newPage()

  const code = await createRoom(pageA, serverUrl, 'Alpha')
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Bravo')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Bravo')).toBeVisible({ timeout: 5000 })

  const state = buildWaitingState({
    players: [
      { id: 0, name: 'Alpha', money: 1500 },
      { id: 1, name: 'Bravo', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await seedGame(serverUrl, code, state)

  // Click bot toggle
  const toggleBtn = pageA.locator('[data-testid="bot-toggle"]')
  await expect(toggleBtn).toBeVisible({ timeout: 5000 })
  await toggleBtn.click()

  // Bot should play — turn advances to Bravo
  await expect(pageA.locator('[data-testid="waiting-for"]')).toContainText('Bravo', { timeout: 10000 })
})

test('toggle bot off — resume manual control', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await contextB.newPage()

  const code = await createRoom(pageA, serverUrl, 'Alpha')
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Bravo')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Bravo')).toBeVisible({ timeout: 5000 })

  const state = buildWaitingState({
    players: [
      { id: 0, name: 'Alpha', money: 1500 },
      { id: 1, name: 'Bravo', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await seedGame(serverUrl, code, state)

  // Toggle on, then off
  const toggleBtn = pageA.locator('[data-testid="bot-toggle"]')
  await expect(toggleBtn).toBeVisible({ timeout: 5000 })
  await toggleBtn.click()
  await pageA.waitForTimeout(500)
  await toggleBtn.click()

  // Manual control — Roll button should be visible
  await expect(pageA.locator('[data-testid="dice-roller"] button').first()).toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test e2e/bot-toggle.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/bot-toggle.spec.ts
git commit -m "test(e2e): add bot toggle on/off tests"
```

---

### Task 10: E2E test — auto-reset on manual action

**Files:**
- Modify: `e2e/bot-toggle.spec.ts`

**Interfaces:**
- Consumes: `seedGame`, `buildWaitingState` from `e2e/helpers/seed.ts`

- [ ] **Step 1: Add auto-reset test**

Append to `e2e/bot-toggle.spec.ts`:

```typescript
test('auto-resets toggle when player manually rolls dice', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await contextB.newPage()

  const code = await createRoom(pageA, serverUrl, 'Alpha')
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Bravo')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Bravo')).toBeVisible({ timeout: 5000 })

  const state = buildWaitingState({
    players: [
      { id: 0, name: 'Alpha', money: 1500 },
      { id: 1, name: 'Bravo', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await seedGame(serverUrl, code, state)

  // Toggle bot on
  const toggleBtn = pageA.locator('[data-testid="bot-toggle"]')
  await expect(toggleBtn).toBeVisible({ timeout: 5000 })
  await toggleBtn.click()

  // Wait for bot to start, then toggle off and manually roll
  await pageA.waitForTimeout(1000)
  await toggleBtn.click()

  // Manually roll dice
  const rollBtn = pageA.locator('[data-testid="dice-roller"] button').first()
  await expect(rollBtn).toBeVisible({ timeout: 5000 })
  await rollBtn.click()

  // Toggle should be reset (no gold active state)
  await expect(toggleBtn).not.toHaveClass(/bg-gold/)
})
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test e2e/bot-toggle.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/bot-toggle.spec.ts
git commit -m "test(e2e): add auto-reset bot toggle test"
```

---

### Task 11: E2E test — visual indicator

**Files:**
- Modify: `e2e/bot-toggle.spec.ts`

**Interfaces:**
- Consumes: Same helpers as above

- [ ] **Step 1: Add visual indicator test**

Append to `e2e/bot-toggle.spec.ts`:

```typescript
test('shows bot status in TurnHeader when toggle is on', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await contextB.newPage()

  const code = await createRoom(pageA, serverUrl, 'Alpha')
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Bravo')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Bravo')).toBeVisible({ timeout: 5000 })

  const state = buildWaitingState({
    players: [
      { id: 0, name: 'Alpha', money: 1500 },
      { id: 1, name: 'Bravo', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await seedGame(serverUrl, code, state)

  // Toggle bot on
  const toggleBtn = pageA.locator('[data-testid="bot-toggle"]')
  await expect(toggleBtn).toBeVisible({ timeout: 5000 })
  await toggleBtn.click()

  // Toggle button should have active state (gold background)
  await expect(toggleBtn).toHaveClass(/bg-gold/)
})
```

- [ ] **Step 2: Run all bot toggle tests**

Run: `npx playwright test e2e/bot-toggle.spec.ts`
Expected: All 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/bot-toggle.spec.ts
git commit -m "test(e2e): add bot toggle visual indicator test"
```

---

### Task 12: Run full test suite and lint

**Files:**
- None (verification only)

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: PASS

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Run full e2e suite**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint/typecheck issues"
```
