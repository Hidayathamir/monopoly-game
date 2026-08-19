import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { monopolyRentSeed } from './fixtures/monopoly-rent-seed'

test('a full color group doubles rent and the renter pays the doubled amount', async ({ browser, serverUrl }) => {
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

  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Alpha')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Bravo')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Bravo')).toBeVisible({ timeout: 5000 })

  // Seed the decision point: Bravo is current on Boardwalk (39) and owes doubled rent.
  await seedGame(serverUrl, code, monopolyRentSeed)

  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // The prompt shows exactly the doubled amount ($100 = $50 base x 2).
  const baseRent = monopolyRentSeed.board[39].rent![0]
  const doubled = baseRent * 2
  await expect(pageB.getByText(`$${doubled}`, { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(pageB.getByRole('button', { name: 'Pay Rent' })).toBeVisible()
  await expect(
    pageB.locator('[data-testid="event-entry"]').filter({ hasText: /owns the full color group/ })
  ).toBeVisible()

  await expect(pageA.locator('[data-testid="waiting-for"]')).toContainText('Bravo')

  // Paying transfers exactly the doubled amount: Bravo 1500-100=1400, Alpha 1000+100=1100.
  await pageB.getByRole('button', { name: 'Pay Rent' }).click()
  await expect(
    pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })
  ).toContainText('$1.4K')
  await expect(
    pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })
  ).toContainText('$1.1K')
  await expect(
    pageB.locator('[data-testid="event-entry"]').filter({ hasText: /paid \$100 rent to Alpha/ })
  ).toBeVisible()
})
