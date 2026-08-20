import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { bankruptcyLiquidationSeed } from './fixtures/bankruptcy-liquidation-seed'

test('a bankrupt player has all assets liquidated to the creditor as cash, properties return to the bank', async ({ browser, serverUrl }) => {
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

  // Seed the decision point: Bravo owes $1700 on Alpha's Boardwalk. Bravo has
  // $50 plus Mediterranean (1 house), Reading Railroad and Electric Company —
  // too little to pay even after liquidating everything ($375 total).
  await seedGame(serverUrl, code, bankruptcyLiquidationSeed)

  // Bravo's properties are owned on the board before the liquidation.
  await expect(pageB.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCount(1)

  // Bravo cannot pay, so only "Declare Bankruptcy" is actionable; he holds the
  // 5-second confirm button straight from the rent prompt.
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
  await expect(
    pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })
  ).toContainText(/bankrupt/i)

  // All of Bravo's assets were transferred to Alpha as cash: 1000 + 375 = 1375.
  await expect(
    pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })
  ).toContainText('$1.4K')
  // Bravo ends with zero cash.
  await expect(
    pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })
  ).toContainText('$0')

  // The log records the exact liquidated amount going to the creditor.
  await expect(
    pageB.locator('[data-testid="event-entry"]').filter({ hasText: /liquidated to Alpha for \$375/ })
  ).toBeVisible()

  // The properties were sold to the bank, not handed to Alpha: no owner stripe.
  for (const id of [3, 5, 12]) {
    await expect(pageB.locator(`[data-testid="board-cell-${id}"] div.absolute`)).toHaveCount(0)
  }
})
