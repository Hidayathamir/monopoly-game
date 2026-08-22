import { test, expect } from './fixtures'
import { seedGame, buildWaitingState } from './helpers/seed'
import { GamePhase, PendingActionType } from '../src/types/game'

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

test('auto-advances a human turn with no action available, without any click', async ({ browser, serverUrl }) => {
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
    dice: [1, 2],
  })
  state.players[0].position = 1
  await seedGame(serverUrl, code, state)

  await expect(pageA.locator('[data-testid="waiting-for"]')).toContainText('Bravo', { timeout: 5000 })
  await expect(pageA.getByRole('button', { name: /End Turn|Roll Again/ })).toHaveCount(0)
})

test('auto-draws a card without showing a Draw Card button', async ({ browser, serverUrl }) => {
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
  state.pendingAction = { type: PendingActionType.DrawCard, cardType: 'chance' }
  state.phase = GamePhase.Resolving
  await seedGame(serverUrl, code, state)

  // The Draw Card button must never appear
  await expect(pageA.getByRole('button', { name: /Draw Card/i })).toHaveCount(0)

  // The card is auto-drawn within 300ms, so the CardEffect modal appears
  await expect(pageA.getByRole('button', { name: 'OK' })).toBeVisible({ timeout: 3000 })
})
