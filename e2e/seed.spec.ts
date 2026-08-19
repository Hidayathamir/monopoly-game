import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { bankruptcySeed } from './fixtures/bankruptcy-seed'

test('a player cannot pay rent, declares bankruptcy, and the opponent wins', async ({ browser, serverUrl }) => {
  const contextA = await browser.newContext()
  await contextA.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  // Alpha (host) creates the room.
  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Alpha')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  // Bravo joins by code.
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Bravo')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Bravo')).toBeVisible({ timeout: 5000 })

  // Seed the decision point: Bravo owes $1,700 rent on Alpha's Boardwalk.
  await seedGame(serverUrl, code, bankruptcySeed)

  // Bravo (current player) is at the rent prompt on both clients. He cannot pay
  // ($1 < $1,700), so the Pay Rent button is disabled and only Declare Bankruptcy
  // is actionable.
  await expect(pageB.getByRole('button', { name: /Declare Bankruptcy/i })).toBeVisible({ timeout: 5000 })
  await expect(pageB.getByRole('button', { name: /Pay Rent/i })).toHaveCount(0)
  await expect(pageB.getByText(/Still Not Enough Money/i)).toBeVisible()
  await expect(pageA.locator('[data-testid="waiting-for"]')).toContainText('Bravo')

  // Bravo declares bankruptcy directly by holding the 5-second confirm button.
  const declareBtn = pageB.getByRole('button', { name: /Declare Bankruptcy/i })
  await expect(declareBtn).toBeVisible({ timeout: 5000 })
  const box = await declareBtn.boundingBox()
  if (box) {
    await pageB.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await pageB.mouse.down()
    await pageB.waitForTimeout(5300)
    await pageB.mouse.up()
  }

  // Game over: Alpha wins on both clients; Bravo shows the bankrupt badge.
  await expect(pageB.getByText('Alpha wins!', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(pageA.getByText('Alpha wins!', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText(/bankrupt/i)
})