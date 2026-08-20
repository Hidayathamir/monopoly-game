import { test, expect } from './fixtures'
import { seedWaitingGame } from './helpers/seed'

test('board cells show the correct utility and property names', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()

  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()
  const code = (await codeLocator.innerText()).trim()

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
    ],
    currentPlayer: 0,
  })

  // Space 27 is a property (yellow group) → "Toulouse".
  // Space 28 is the utility → "Water Company".
  await expect(page.locator('[data-testid="board-cell-27"]')).toContainText('Toulouse', { timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-28"]')).toContainText('Water Company', { timeout: 5000 })
})
