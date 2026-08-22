import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import {
  ALPHA_STRIPE,
  BRAVO_STRIPE,
  DROID_STRIPE,
  CHARLIE_STRIPE,
  makePage,
  createRoom,
  addBot,
  joinRoom,
  joinThree,
  openTradeModal,
} from './helpers/trade'
import { tradeSeed } from './fixtures/trade-seed'
import { tradeBotSeed } from './fixtures/trade-bot-seed'
import { tradeCashSeed } from './fixtures/trade-cash-seed'
import { tradeUtilitySeed } from './fixtures/trade-utility-seed'
import { tradeReverseSeed } from './fixtures/trade-reverse-seed'
import { tradeThreeSeed } from './fixtures/trade-three-seed'

test('a cash-only trade swaps cash with no properties on either side', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha offers $200 and requests $100 — both sides cash, no properties.
  await openTradeModal(pageA, 'Bravo')
  await pageA.locator('input[type="number"]').nth(0).fill('200')
  await pageA.locator('input[type="number"]').nth(1).fill('100')
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  // Cash: Alpha 1200−200+100=1100, Bravo 1200+200−100=1300.
  await expect(pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })).toContainText('$1.1K')
  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText('$1.3K')
  // Ownership unchanged.
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
})

test('a property-only trade swaps ownership with no cash on either side', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  // Cash untouched, stripes swap.
  await expect(pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })).toContainText('$1.2K')
  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText('$1.2K')
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('a multi-property trade swaps several properties in both directions', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Salvador').check()
  await pageA.getByLabel('Rio').check()
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByLabel('Jerusalem').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-9"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('a trade can include a railroad and a utility', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeUtilitySeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha offers TLV Airport (railroad) for Power Company (utility).
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('TLV Airport').check()
  await pageA.getByLabel('Power Company').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  await expect(pageA.locator('[data-testid="board-cell-5"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-12"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('a trade completes when the request equals the target\'s entire cash', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeCashSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Bravo has $50; request exactly $50 (requestCash == target.money → ends at $0).
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Salvador').check()
  await pageA.locator('input[type="number"]').nth(1).fill('50')
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText('$0')
  await expect(pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })).toContainText('$1.3K')
  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
})

test('a bot auto-accepts at the exact fair-value boundary', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeBotSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Offer Salvador (60) + $40 = exactly the value of the requested Tel Aviv (100).
  await openTradeModal(page, 'Droid')
  await page.getByLabel('Salvador').check()
  await page.locator('input[type="number"]').nth(0).fill('40')
  await page.getByLabel('Tel Aviv').check()
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(page.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
  await expect(page.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('Bravo can propose a trade to Alpha on Bravo\'s turn', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeReverseSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Bravo is current. He proposes Jerusalem (9) for Salvador (1).
  await openTradeModal(pageB, 'Alpha')
  await pageB.getByLabel('Jerusalem').check()
  await pageB.getByLabel('Salvador').check()
  await pageB.getByRole('button', { name: 'Propose' }).click()

  await expect(
    pageA.locator('[data-testid="event-entry"]').filter({ hasText: /proposed a trade to Alpha/ })
  ).toBeVisible({ timeout: 5000 })

  const inboxBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageA.getByRole('button', { name: 'Accept' }).click()
  await expect(pageA.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-9"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('a third neutral player sees no inbox badge for others\' offers', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const pageC = await makePage(browser)
  const code = await joinThree(pageA, pageB, pageC, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeThreeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageC.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  // Bravo sees the offer; neutral Charlie does not.
  const bravoBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(bravoBtn).toContainText('1', { timeout: 5000 })
  const charlieBtn = pageC.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(charlieBtn).not.toContainText('1')

  // Charlie's inbox is empty too.
  await charlieBtn.click()
  await expect(pageC.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
})

test('one proposer can hold two pending offers to two different targets', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const pageC = await makePage(browser)
  const code = await joinThree(pageA, pageB, pageC, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeThreeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Offer 1 → Bravo (Rio for Tel Aviv).
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  // Offer 2 → Charlie (Salvador for Haifa).
  await openTradeModal(pageA, 'Charlie')
  await pageA.getByLabel('Salvador').check()
  await pageA.getByLabel('Haifa').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const alphaBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  const bravoBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  const charlieBtn = pageC.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(alphaBtn).toContainText('2', { timeout: 5000 })
  await expect(bravoBtn).toContainText('1', { timeout: 5000 })
  await expect(charlieBtn).toContainText('1', { timeout: 5000 })

  // Each target's inbox shows its own offer.
  await bravoBtn.click()
  await expect(pageB.getByText(/You receive:.*Rio/)).toBeVisible({ timeout: 5000 })
  await pageB.getByRole('button', { name: 'Close' }).click()
  await charlieBtn.click()
  await expect(pageC.getByText(/You receive:.*Salvador/)).toBeVisible({ timeout: 5000 })
})

test('accepting one of two pending offers leaves the other pending', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const pageC = await makePage(browser)
  const code = await joinThree(pageA, pageB, pageC, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeThreeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  await openTradeModal(pageA, 'Charlie')
  await pageA.getByLabel('Salvador').check()
  await pageA.getByLabel('Haifa').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  // Bravo accepts his offer.
  const bravoBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(bravoBtn).toContainText('1', { timeout: 5000 })
  await bravoBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  // Alpha's badge drops to 1; Charlie's offer is untouched.
  const alphaBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(alphaBtn).toContainText('1', { timeout: 5000 })
  const charlieBtn = pageC.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(charlieBtn).toContainText('1', { timeout: 5000 })

  // The remaining offer still works.
  await charlieBtn.click()
  await expect(pageC.getByText(/You receive:.*Salvador/)).toBeVisible({ timeout: 5000 })
  await pageC.getByRole('button', { name: 'Accept' }).click()
  await expect(pageC.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', CHARLIE_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-8"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('the offerer sees Cancel on an offer while the target sees Accept/Reject', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  // Offerer's inbox: only Cancel on the offer card.
  const alphaBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(alphaBtn).toContainText('1', { timeout: 5000 })
  await alphaBtn.click()
  const alphaOffer = pageA.locator('[data-testid="trade-offer"]')
  await expect(alphaOffer.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5000 })
  await expect(alphaOffer.getByRole('button', { name: 'Accept' })).toHaveCount(0)
  await expect(alphaOffer.getByRole('button', { name: 'Reject' })).toHaveCount(0)

  // Target's inbox: Accept + Reject, no Cancel on the offer card.
  const bravoBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(bravoBtn).toContainText('1', { timeout: 5000 })
  await bravoBtn.click()
  const bravoOffer = pageB.locator('[data-testid="trade-offer"]')
  await expect(bravoOffer.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 5000 })
  await expect(bravoOffer.getByRole('button', { name: 'Reject' })).toBeVisible()
  await expect(bravoOffer.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  // Close Bravo's inbox (footer close button) without affecting the trade.
  await pageB.getByRole('button', { name: 'Close' }).last().click()

  // Offerer cancels via the trade-card Cancel button (scoped to the offer, not the modal footer).
  await alphaOffer.getByRole('button', { name: 'Cancel' }).click()
  await expect(alphaBtn).not.toContainText('1', { timeout: 5000 })
  await expect(pageA.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
})

test('two sequential trades in one game both complete', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Trade 1: Rio for Tel Aviv.
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()
  let inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  // Close Bravo's inbox (footer Close) so the sidebar is reachable for trade 2 —
  // TradeInboxModal stays open after Accept by design.
  await pageB.getByRole('button', { name: 'Close' }).click()

  // Trade 2: Salvador for Jerusalem (Bravo still owns Jerusalem).
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Salvador').check()
  await pageA.getByLabel('Jerusalem').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()
  inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  // Both trades landed.
  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-9"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('a bot auto-accepts when it gives a property and receives cash', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeBotSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha offers $150 cash for Droid's Tel Aviv (100): 150 >= 100.
  await openTradeModal(page, 'Droid')
  await page.locator('input[type="number"]').nth(0).fill('150')
  await page.getByLabel('Tel Aviv').check()
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(page.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  await expect(page.locator('[data-testid="player-card"]').filter({ hasText: 'Droid' })).toContainText('$1.4K')
  await expect(page.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })).toContainText('$1.1K')
})

test('a bot auto-accepts when it is on the receiving end of a bargain', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeBotSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha offers TLV Airport (200) for nothing — a bargain for the bot.
  await openTradeModal(page, 'Droid')
  await page.getByLabel('TLV Airport').check()
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(page.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-5"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
  await expect(page.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
})

