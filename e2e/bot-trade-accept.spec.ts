import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import {
  ALPHA_STRIPE,
  DROID_STRIPE,
  makePage,
  createRoom,
  addBot,
  openTradeModal,
} from './helpers/trade'
import {
  tradeAcceptMonopolySeed,
  tradeRejectDevelopedSeed,
  tradeRejectBrokeSeed,
  tradeAcceptCashSurplusSeed,
} from './fixtures/trade-bot-accept-seed'

test('bot rejects a trade that gives away a developed property for base price', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeRejectDevelopedSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Salvador (60) + $60 cash for developed Tel Aviv (2 houses, valued 180): 120 < 198.
  await openTradeModal(page, 'Droid')
  await page.getByLabel('Salvador').check()
  await page.locator('input[type="number"]').nth(0).fill('60')
  await page.getByLabel('Tel Aviv').check()
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(
    page.locator('[data-testid="event-entry"]').filter({ hasText: /Droid declined Alpha's trade offer/ })
  ).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
})

test('bot accepts a trade that completes its color set for fair cash', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeAcceptMonopolySeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Salvador (60) completes Droid's brown set → valued 90; Alpha asks only $70.
  await openTradeModal(page, 'Droid')
  await page.getByLabel('Salvador').check()
  await page.locator('input[type="number"]').nth(1).fill('70')
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(page.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
  await expect(page.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
  await expect(page.locator('[data-testid="player-card"]').filter({ hasText: 'Droid' })).toContainText('$1.1K')
})

test('bot rejects a trade that would leave it below its cash reserve', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeRejectBrokeSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Droid has $100; paying $40 leaves $60 (< $150 reserve) and the offer is
  // only 1.5x value — not the 2x the reserve rule demands.
  await openTradeModal(page, 'Droid')
  await page.getByLabel('Salvador').check()
  await page.locator('input[type="number"]').nth(1).fill('40')
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(
    page.locator('[data-testid="event-entry"]').filter({ hasText: /Droid declined Alpha's trade offer/ })
  ).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('bot accepts a trade with a significant cash surplus', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeAcceptCashSurplusSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // $200 cash for Salvador (60): a clear win for the bot.
  await openTradeModal(page, 'Droid')
  await page.locator('input[type="number"]').nth(0).fill('200')
  await page.getByLabel('Salvador').check()
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(page.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  await expect(page.locator('[data-testid="player-card"]').filter({ hasText: 'Droid' })).toContainText('$1.4K')
})
