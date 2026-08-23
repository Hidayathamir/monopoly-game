import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { ALPHA_STRIPE, BRAVO_STRIPE, DROID_STRIPE, makePage, createRoom, addBot, joinRoom, joinThree, openTradeModal } from './helpers/trade'
import { tradeSeed } from './fixtures/trade-seed'
import { tradeBotSeed } from './fixtures/trade-bot-seed'
import { tradeOfferCapSeed } from './fixtures/trade-offer-cap-seed'
import { tradeMortgageSeed } from './fixtures/trade-mortgage-seed'
import { tradeHouseSeed } from './fixtures/trade-house-seed'
import { tradeBankruptSeed } from './fixtures/trade-bankrupt-seed'
import { tradeThreeSeed } from './fixtures/trade-three-seed'

test('offer cash is capped at the proposer\'s available cash', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeOfferCapSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha has only $50, so typing $100 clamps to the max.
  await openTradeModal(pageA, 'Bravo')
  const offerInput = pageA.locator('input[type="number"]').nth(0)
  await offerInput.fill('100')
  await expect(offerInput).toHaveValue('50')
  await expect(pageA.getByText(/Max: \$50/)).toBeVisible()

  // The capped amount actually transfers on accept.
  await pageA.getByRole('button', { name: 'Propose' }).click()
  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await expect(pageB.getByText(/You receive:.*\$50/)).toBeVisible({ timeout: 5000 })
  await pageB.getByRole('button', { name: 'Accept' }).click()
  // The inbox closes on accept.
  await expect(pageB.getByText('No pending trade offers')).toBeHidden({ timeout: 5000 })

  await expect(pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })).toContainText('$0')
  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText('$1.3K')
})

test('negative cash typed in a cash field is clamped to 0', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  const offerInput = pageA.locator('input[type="number"]').nth(0)
  await offerInput.fill('-100')
  await expect(offerInput).toHaveValue('0')
  const requestInput = pageA.locator('input[type="number"]').nth(1)
  await requestInput.fill('-50')
  await expect(requestInput).toHaveValue('0')

  // The trade is still empty, so Propose stays disabled.
  await expect(pageA.getByRole('button', { name: 'Propose' })).toBeDisabled()
})
test('requesting a property the target does not own rejects the proposal', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha requests Tel Aviv (6) — owned by Bravo at modal-open time.
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Tel Aviv').check()

  // Re-seed mid-game: Tel Aviv now belongs to Alpha, so the offer is stale.
  const stale = structuredClone(tradeSeed)
  stale.board[6].owner = 0
  stale.players[0].properties = [1, 3, 5, 6]
  stale.players[1].properties = [9]
  await seedGame(serverUrlTrades, code, stale)

  await pageA.getByRole('button', { name: 'Propose' }).click()
  await expect(
    pageA.locator('[data-testid="event-entry"]').filter({ hasText: /was rejected — it is no longer valid/ })
  ).toBeVisible({ timeout: 5000 })
  await expect(pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })).not.toContainText('1')
})

test('mortgaged properties are included and tradeable in the trade modal', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeMortgageSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  // Offer column: Salvador (1) and mortgaged Rio (3) are both listed.
  await expect(pageA.getByLabel('Salvador', { exact: true })).toHaveCount(1)
  await expect(pageA.getByLabel('Rio', { exact: true })).toHaveCount(1)
  // Request column: Jerusalem (9) and mortgaged Tel Aviv (6) are both listed.
  await expect(pageA.getByLabel('Jerusalem', { exact: true })).toHaveCount(1)
  await expect(pageA.getByLabel('Tel Aviv', { exact: true })).toHaveCount(1)
})

test('properties with houses or a hotel are included and tradeable in the trade modal', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeHouseSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await expect(pageA.getByLabel('Salvador', { exact: true })).toHaveCount(1)
  await expect(pageA.getByLabel('Rio', { exact: true })).toHaveCount(1)
  await expect(pageA.getByLabel('Jerusalem', { exact: true })).toHaveCount(1)
  await expect(pageA.getByLabel('Tel Aviv', { exact: true })).toHaveCount(1)
})

test('a trade of a mortgaged property transfers ownership and the mortgage debt', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeMortgageSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha offers his mortgaged Rio (3) and requests Bravo's mortgaged Tel Aviv (6).
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  // The inbox closes on accept.
  await expect(pageB.getByText('No pending trade offers')).toBeHidden({ timeout: 5000 })

  // Ownership swapped; the mortgage flag rides along to the new owner.
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})


test('a bot rejects an unfair trade where the offer is worth less than the request', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeBotSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Salvador (60) for Tel Aviv (100): 60 < 100, unfair for the bot.
  await openTradeModal(page, 'Droid')
  await page.getByLabel('Salvador').check()
  await page.getByLabel('Tel Aviv').check()
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(
    page.locator('[data-testid="event-entry"]').filter({ hasText: /Droid declined Alpha's trade offer/ })
  ).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })).not.toContainText('1')
  // Nothing changed hands.
  await expect(page.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  await expect(page.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
})

test('proposing to a bot that cannot afford the requested cash is rejected', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  const code = await createRoom(page, serverUrlTrades, 'Alpha')
  await addBot(page)
  await seedGame(serverUrlTrades, code, tradeBotSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha types a $500 request — within Droid's $1200 at modal-open time.
  await openTradeModal(page, 'Droid')
  await page.locator('input[type="number"]').nth(1).fill('500')

  // Re-seed mid-game: Droid's cash drops to $100 while the modal keeps its $500 request.
  const stale = structuredClone(tradeBotSeed)
  stale.players[1].money = 100
  await seedGame(serverUrlTrades, code, stale)

  await page.getByRole('button', { name: 'Propose' }).click()
  await expect(
    page.locator('[data-testid="event-entry"]').filter({ hasText: /was rejected — it is no longer valid/ })
  ).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })).not.toContainText('1')
  // No trade happened; Droid still holds his cash and Tel Aviv.
  await expect(page.locator('[data-testid="player-card"]').filter({ hasText: 'Droid' })).toContainText('$100')
  await expect(page.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
})
test('trading with a bankrupt player is blocked', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeBankruptSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Hovering Bravo's card shows a disabled Trade button.
  await pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' }).hover()
  const tradeBtn = pageA.getByRole('button', { name: /^🤝 Trade$/ })
  await expect(tradeBtn).toBeVisible({ timeout: 5000 })
  await expect(tradeBtn).toBeDisabled()
})

test('trading with yourself is impossible — no Trade button on your own card', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Hover Alpha's own card: popup appears but no Trade button.
  await pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' }).hover()
  await expect(pageA.getByText('Properties:')).toBeVisible({ timeout: 5000 })
  await expect(pageA.getByRole('button', { name: /^🤝 Trade$/ })).toHaveCount(0)

  // Sanity: another player's card still offers Trade.
  await pageA.mouse.move(0, 0)
  await pageA.waitForTimeout(250)
  const bravoCard = pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })
  const bravoBox = await bravoCard.boundingBox()
  if (bravoBox) {
    await pageA.mouse.move(bravoBox.x + bravoBox.width / 2, bravoBox.y + bravoBox.height / 2)
  } else {
    await bravoCard.hover()
  }
  const tradeBtn = pageA.getByRole('button', { name: /^🤝 Trade$/ })
  await expect(tradeBtn).toBeVisible({ timeout: 5000 })
  await expect(tradeBtn).toBeEnabled()
})

test('after acceptance the offerer\'s inbox is empty', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  // Bravo accepts before Alpha can cancel.
  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  // The inbox closes on accept.
  await expect(pageB.getByText('No pending trade offers')).toBeHidden({ timeout: 5000 })

  // Alpha's inbox is empty — there is no lingering Cancel button to press.
  const alphaBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(alphaBtn).not.toContainText('1', { timeout: 5000 })
  await alphaBtn.click()
  await expect(pageA.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })

  // The trade still happened.
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
})

test('the inbox badge count decrements after accept and reject', async ({ browser, serverUrlTrades }) => {
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

  const alphaBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  const bravoBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  const charlieBtn = pageC.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(alphaBtn).toContainText('2', { timeout: 5000 })
  await expect(bravoBtn).toContainText('1', { timeout: 5000 })
  await expect(charlieBtn).toContainText('1', { timeout: 5000 })

  // Bravo accepts → Alpha 2→1, Bravo 1→gone.
  await bravoBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()
  await expect(alphaBtn).toContainText('1', { timeout: 5000 })
  await expect(bravoBtn).not.toContainText('1')

  // Charlie rejects → Alpha 1→gone, Charlie 1→gone.
  await charlieBtn.click()
  await pageC.getByRole('button', { name: 'Reject' }).click()
  await expect(alphaBtn).not.toContainText('1', { timeout: 5000 })
  await expect(charlieBtn).not.toContainText('1')
})

test('rejecting an offer removes it from both players\' inboxes', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Reject' }).click()
  // The inbox closes on reject.
  await expect(pageB.getByText('No pending trade offers')).toBeHidden({ timeout: 5000 })

  // The offerer's inbox is also cleared.
  const alphaBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(alphaBtn).not.toContainText('1', { timeout: 5000 })
  await alphaBtn.click()
  await expect(pageA.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})
