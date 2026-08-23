import { test, expect } from './fixtures'
import { seedWaitingGame, seedGame } from './helpers/seed'
import { buildResolvingPayRentState } from './fixtures/emoticon-seed'

function addLanguageScript(context: import('@playwright/test').BrowserContext) {
  return context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
}

async function twoPlayerLobby(browser: import('@playwright/test').Browser, serverUrl: string) {
  const context = await browser.newContext()
  await addLanguageScript(context)
  const pageA = await context.newPage()
  const pageB = await context.newPage()

  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  return { context, pageA, pageB, code }
}

test('an emitted emoticon floats above the sender token and is visible to the other player', async ({ browser, serverUrl }) => {
  const { pageA, pageB, code } = await twoPlayerLobby(browser, serverUrl)

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await pageA.click('[data-testid="emoticon-button-happy"]')
  await expect(pageB.locator('[data-testid="emoticon-0-happy"]')).toBeVisible({ timeout: 2000 })
  await expect(pageA.locator('[data-testid="emoticon-0-happy"]')).toBeVisible({ timeout: 2000 })
})

test('emoticon buttons apply a 5s cooldown after emitting', async ({ browser, serverUrl }) => {
  const { pageA, code } = await twoPlayerLobby(browser, serverUrl)

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  const happy = pageA.locator('[data-testid="emoticon-button-happy"]')
  await expect(happy).toBeEnabled()
  await happy.click()
  await expect(happy).toBeDisabled()
  await expect(happy).toBeEnabled({ timeout: 6000 })
})

test('a bot auto-emits angry after paying expensive rent', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await addLanguageScript(context)
  const page = await context.newPage()

  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await page.click('button:has-text("Add Bot")')
  await page.click('button:has-text("Add Bot")') // Host + Droid (slot 1) + Byte (slot 2)
  await expect(page.locator('text=Droid')).toBeVisible()

  // Bot (slot 2, "Byte") must pay $500 rent to the host (slot 0) — expensive rent → angry.
  const state = buildResolvingPayRentState({
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
      { id: 2, name: 'Byte', money: 1500, isBot: true },
    ],
    currentPlayer: 2,
    spaceId: 39,
    ownerId: 0,
    amount: 500,
    turnOrder: [0, 1, 2],
  })
  await seedGame(serverUrl, code, state)

  await expect(page.locator('[data-testid="emoticon-2-angry"]')).toBeVisible({ timeout: 3000 })
})
