# Trade Inbox UX & Off-Turn Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trade inbox text perspective-correct for the viewer, rename the footer close button to "Close", and allow trading when it is not the viewer's turn.

**Architecture:** Pure client-side changes. `TradeInboxModal` derives "give"/"receive" from the viewer's relation to the trade; `GameView` drops the `isMyTurn` gate on `canTrade`; both locale files gain five new keys. The server and reducer already permit off-turn trades, so no logic changes are needed there.

**Tech Stack:** React 19, react-i18next, TypeScript, Vitest (unit), Playwright (e2e).

## Global Constraints

- No TS enums; string-constant union types only. `verbatimModuleSyntax` → type-only imports use `import type`.
- Every UI string must exist in BOTH `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json` (flat keys, `keySeparator: false`).
- `erasableSyntaxOnly` is on; keep code erasable. `noUnusedLocals`/`noUnusedParameters` are on.
- Repo default language is English; tests pin `en`/`USD` via `renderWithProviders`.
- After changes run `npm run typecheck`, `npm run lint`, `npm run test:unit`.

---

### Task 1: Add i18n keys (en + id)

**Files:**
- Modify: `src/i18n/locales/en/translation.json:272-281`
- Modify: `src/i18n/locales/id/translation.json:272-281`

**Interfaces:**
- Consumes: existing `trade.*` keys.
- Produces: new keys `trade.youGive`, `trade.youReceive`, `trade.gives`, `trade.wants`, `trade.close` for Tasks 2–3.

- [ ] **Step 1: Add keys after `trade.youRequest` in the en locale**

In `src/i18n/locales/en/translation.json`, insert after line 275 (`"trade.youRequest": "You request:",`):
```json
  "trade.youGive": "You give:",
  "trade.youReceive": "You receive:",
  "trade.gives": "{{name}} gives:",
  "trade.wants": "{{name}} wants:",
```
And after line 277 (`"trade.cancel": "Cancel",`) add:
```json
  "trade.close": "Close",
```

- [ ] **Step 2: Add matching keys in the id locale**

In `src/i18n/locales/id/translation.json`, insert after line 275 (`"trade.youRequest": "Anda minta:",`):
```json
  "trade.youGive": "Anda berikan:",
  "trade.youReceive": "Anda terima:",
  "trade.gives": "{{name}} berikan:",
  "trade.wants": "{{name}} minta:",
```
And after line 277 (`"trade.cancel": "Batal",`) add:
```json
  "trade.close": "Tutup",
```

- [ ] **Step 3: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en/translation.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/id/translation.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "i18n: add trade give/receive/close keys (en + id)"
```

---

### Task 2: Perspective-aware inbox text + Close footer button

**Files:**
- Modify: `src/components/Modals/TradeInboxModal.tsx:29-64`
- Test: `src/components/__tests__/TradeInboxModal.test.tsx`

**Interfaces:**
- Consumes: keys from Task 1 (`trade.youGive`, `trade.youReceive`, `trade.gives`, `trade.wants`, `trade.close`), props `state`, `myPlayerId`, `onAccept`, `onReject`, `onCancel`, `onClose`.
- Produces: a modal that labels each trade from the viewer's perspective; footer uses `trade.close`.

- [ ] **Step 1: Write the failing unit test for perspective**

Replace `src/components/__tests__/TradeInboxModal.test.tsx` with a version that asserts the recipient sees "You receive:" / "You give:". Use this full file:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import TradeInboxModal from '../Modals/TradeInboxModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeStateWithTrades(): GameState {
  let state = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 3,
    names: ['Alice', 'Bob', 'Charlie'],
  })
  state = {
    ...state,
    pendingTrades: [
      // Alice (id 0) offers Bob (id 1): gives Rio(3)+$0, wants $100.
      { id: 0, fromId: 0, toId: 1, offerProperties: [3], offerCash: 0, requestProperties: [], requestCash: 100 },
    ],
  }
  return state
}

afterEach(cleanup)

describe('TradeInboxModal', () => {
  it('shows the recipient perspective (You receive / You give)', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const onCancel = vi.fn()
    // Bob (id 1) is the recipient of the trade above.
    renderWithProviders(
      <TradeInboxModal state={makeStateWithTrades()} myPlayerId={1} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={() => {}} />,
    )
    expect(screen.getByText(/You receive:/)).toBeTruthy()
    expect(screen.getByText(/You give:/)).toBeTruthy()
    // The recipient receives Rio and gives $100.
    expect(screen.getByText(/You receive:.*Rio/)).toBeTruthy()
    expect(screen.getByText(/You give:.*100/)).toBeTruthy()
    // The proposer-frame labels must NOT appear.
    expect(screen.queryByText(/You offer:/)).toBeNull()
    expect(screen.queryByText(/You request:/)).toBeNull()
  })

  it('shows accept/reject for the recipient and cancel for the proposer', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <TradeInboxModal state={makeStateWithTrades()} myPlayerId={0} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Accept/ }))
    expect(onAccept).toHaveBeenCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(onCancel).toHaveBeenCalledWith(0)
  })

  it('shows a no-offers message when the inbox is empty', () => {
    const state = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 2,
      names: ['Alice', 'Bob'],
    })
    renderWithProviders(<TradeInboxModal state={state} myPlayerId={0} onAccept={() => {}} onReject={() => {}} onCancel={() => {}} onClose={() => {}} />)
    expect(screen.getByText('No pending trade offers')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run: `npm run test:unit -- TradeInboxModal`
Expected: FAIL (current implementation renders "You offer:" / "You request:" and never "You receive:" / "You give:").

- [ ] **Step 3: Rewrite the trade card rendering in TradeInboxModal.tsx**

Replace the `{relevant.map((tr) => { ... })}` block (lines 29–60) with perspective-aware logic. Replace lines 29–60 with:

```tsx
        {relevant.map((tr) => {
          const from = state.players[tr.fromId]?.name ?? '?'
          const to = state.players[tr.toId]?.name ?? '?'
          const offerProps = tr.offerProperties.map((id) => t('board.space.' + id)).join(', ')
          const requestProps = tr.requestProperties.map((id) => t('board.space.' + id)).join(', ')
          const canAccept = myPlayerId === null || tr.toId === myPlayerId
          const canCancel = myPlayerId === null || tr.fromId === myPlayerId

          // Derive the viewer's perspective.
          const viewerIsRecipient = myPlayerId !== null && tr.toId === myPlayerId
          const viewerIsProposer = myPlayerId !== null && tr.fromId === myPlayerId
          const giveProps = viewerIsRecipient ? requestProps : offerProps
          const giveCash = viewerIsRecipient ? tr.requestCash : tr.offerCash
          const receiveProps = viewerIsRecipient ? offerProps : requestProps
          const receiveCash = viewerIsRecipient ? tr.offerCash : tr.requestCash

          let giveLabel: string
          let receiveLabel: string
          if (viewerIsRecipient || viewerIsProposer) {
            giveLabel = t('trade.youGive')
            receiveLabel = t('trade.youReceive')
          } else {
            giveLabel = t('trade.gives', { name: from })
            receiveLabel = t('trade.wants', { name: from })
          }

          return (
            <div key={tr.id} data-testid="trade-offer" className="bg-bg-darker rounded p-2">
              <p className="text-sm text-text-dim">
                <strong>{from}</strong> → <strong>{to}</strong>
              </p>
              <p className="text-sm text-text-dim">
                {receiveLabel} {receiveProps || '—'} + {formatMoney(receiveCash)}
              </p>
              <p className="text-sm text-text-dim">
                {giveLabel} {giveProps || '—'} + {formatMoney(giveCash)}
              </p>
              <div className="flex gap-1 mt-1">
                {canAccept && (
                  <Button size="sm" variant="success" onClick={() => onAccept(tr.id)}>{t('trade.accept')}</Button>
                )}
                {canAccept && (
                  <Button size="sm" variant="secondary" onClick={() => onReject(tr.id)}>{t('trade.reject')}</Button>
                )}
                {canCancel && (
                  <Button size="sm" variant="danger" onClick={() => onCancel(tr.id)}>{t('trade.cancel')}</Button>
                )}
              </div>
            </div>
          )
        })}
```

And replace the footer button (line 63) `>{t('trade.cancel')}<` with `>{t('trade.close')}<`:

```tsx
      <Modal.Actions>
        <Button variant="secondary" onClick={onClose}>{t('trade.close')}</Button>
      </Modal.Actions>
```

- [ ] **Step 4: Run the unit test to confirm it passes**

Run: `npm run test:unit -- TradeInboxModal`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Modals/TradeInboxModal.tsx src/components/__tests__/TradeInboxModal.test.tsx
git commit -m "fix: perspective-correct trade inbox text + Close footer button"
```

---

### Task 3: Allow trading off-turn

**Files:**
- Modify: `src/components/GameView.tsx:19-20`

**Interfaces:**
- Consumes: `state.tradesEnabled`, `state.phase`, `state.pendingAction`, `GamePhase.Waiting`.
- Produces: `canTrade` available to any non-bankrupt player regardless of whose turn it is; flows into `PlayerPanel` → `PlayerCard` → `PlayerPopup` Trade button.

- [ ] **Step 1: Remove the `isMyTurn` gate from `canTrade`**

In `src/components/GameView.tsx`, change line 20:
```ts
  const canTrade = tradesEnabled && isMyTurn && state.phase === GamePhase.Waiting && !state.pendingAction
```
to:
```ts
  const canTrade = tradesEnabled && state.phase === GamePhase.Waiting && !state.pendingAction
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass (no unused `isMyTurn` — it is still used for `useMyTurnSound` and `isMyTurn` in other places).

- [ ] **Step 3: Commit**

```bash
git add src/components/GameView.tsx
git commit -m "feat: allow proposing/accepting trades off-turn"
```

---

### Task 4: Update e2e selectors for new labels

**Files:**
- Modify: `e2e/trade-positive.spec.ts:256-259,296,257,336,365`

**Interfaces:**
- Consumes: new recipient-facing text "You receive:" and footer "Close" button.

- [ ] **Step 1: Update recipient assertions from "You offer:" to "You receive:"**

In `e2e/trade-positive.spec.ts`:
- line ~256: `await expect(pageB.getByText(/You offer:.*Rio/)).toBeVisible(...)` → `await expect(pageB.getByText(/You receive:.*Rio/)).toBeVisible(...)`
- line ~259: `await expect(pageC.getByText(/You offer:.*Salvador/)).toBeVisible(...)` → `await expect(pageC.getByText(/You receive:.*Salvador/)).toBeVisible(...)`
- line ~296: `await expect(pageC.getByText(/You offer:.*Salvador/)).toBeVisible(...)` → `await expect(pageC.getByText(/You receive:.*Salvador/)).toBeVisible(...)`

- [ ] **Step 2: Update footer close presses from "Cancel" to "Close"**

In `e2e/trade-positive.spec.ts`:
- line ~257: `await pageB.getByRole('button', { name: 'Cancel' }).click()` (closes Bravo's inbox) → `await pageB.getByRole('button', { name: 'Close' }).click()`
- line ~336: `await pageB.getByRole('button', { name: 'Cancel' }).last().click()` (closes Bravo's inbox) → `await pageB.getByRole('button', { name: 'Close' }).last().click()`
- line ~365: `await pageB.getByRole('button', { name: 'Cancel' }).click()` (closes Bravo's inbox) → `await pageB.getByRole('button', { name: 'Close' }).click()`

Note: the per-offer `Cancel` button (used to cancel a trade offer, e.g. lines 323, 339) stays as "Cancel" — do NOT change those.

- [ ] **Step 3: Commit**

```bash
git add e2e/trade-positive.spec.ts
git commit -m "test(e2e): update trade inbox selectors for receive/close labels"
```

---

### Task 5: Final verification

**Files:** (none new)

- [ ] **Step 1: Typecheck + lint + unit tests**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 2: (Optional) build for e2e**

If you want to run the e2e trade specs, first build: `npm run build`, then
`npm run test:e2e -- trade-positive`. The e2e env auto-enables trades. Only run
if `dist/` artifacts are present; otherwise skip (unit + typecheck + lint is
the required bar).
