import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { ALPHA_STRIPE, BRAVO_STRIPE, CHARLIE_STRIPE, DROID_STRIPE, makePage, joinRoom, joinThree, openTradeModal } from './helpers/trade'
import { tradeSeed } from './fixtures/trade-seed'
import { tradeThreeSeed } from './fixtures/trade-three-seed'
import { tradeBotSeed } from './fixtures/trade-bot-seed'
import { tradeCashSeed } from './fixtures/trade-cash-seed'

test('the trade UI is hidden when the server runs without TRADES_ENABLED', async ({ browser, serverUrl }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrl)

  // Seed the trade scenario; the room's own tradesEnabled (false) overrides the seed's true.
  await seedGame(serverUrl, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // No Trades inbox button in the sidebar.
  await expect(pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })).toHaveCount(0)

  // Hovering a player card shows the popup, but without the Trade button.
  await pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' }).hover()
  await expect(pageA.getByText('Properties:')).toBeVisible({ timeout: 5000 })
  await expect(pageA.getByRole('button', { name: /^🤝 Trade$/ })).toHaveCount(0)
})

test('Alpha proposes a trade and Bravo accepts — properties and cash swap', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Off-turn trading is allowed: even when it is not Bravo's turn, he can start a
  // trade with the current player. The Trade button on Alpha's (the counterparty's) card is enabled.
  await pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' }).hover()
  const alphaTradeBtn = pageB.getByRole('button', { name: /^🤝 Trade$/ })
  await expect(alphaTradeBtn).toBeVisible({ timeout: 5000 })
  await expect(alphaTradeBtn).toBeEnabled()

  // Alpha (current) proposes: offers Rio (3) + $100, requests Tel Aviv (6).
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.locator('input[type="number"]').nth(0).fill('100')
  await pageA.getByLabel('Tel Aviv').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  await expect(
    pageA.locator('[data-testid="event-entry"]').filter({ hasText: /proposed a trade to Bravo/ })
  ).toBeVisible({ timeout: 5000 })

  // Bravo's sidebar inbox shows a badge of 1 and lists the offer.
  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  // The labels are viewer-relative: Bravo (the recipient) sees "You receive" (what Alpha offers) and "You give" (what Alpha requests).
  await expect(pageB.getByText(/You receive: Rio \+ \$100/)).toBeVisible({ timeout: 5000 })
  await expect(pageB.getByText(/You give: Tel Aviv \+ \$0/)).toBeVisible()
  await pageB.getByRole('button', { name: 'Accept' }).click()

  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  await expect(pageA.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })).toBeVisible()
  await expect(pageB.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })).toBeVisible()

  // Cash: Alpha 1200−100=1100 ($1.1K), Bravo 1200+100=1300 ($1.3K).
  await expect(pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })).toContainText('$1.1K')
  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText('$1.3K')

  // Ownership stripes swap on the board.
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('Bravo can reject an incoming trade — nothing changes hands', async ({ browser, serverUrlTrades }) => {
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
  await expect(pageB.getByText(/You receive: Rio/)).toBeVisible({ timeout: 5000 })
  await pageB.getByRole('button', { name: 'Reject' }).click()

  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  await expect(
    pageB.locator('[data-testid="event-entry"]').filter({ hasText: /declined Alpha's trade offer/ })
  ).toBeVisible()
  // Rio stayed with Alpha.
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('Alpha can cancel a pending offer before Bravo responds', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Rio').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  // Alpha's own inbox also lists the offer (he is the fromId), with a Cancel button.
  const inboxBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await expect(pageA.locator('[data-testid="trade-offer"]')).toBeVisible({ timeout: 5000 })
  await pageA.locator('[data-testid="trade-offer"]').getByRole('button', { name: 'Cancel' }).click()

  await expect(pageA.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  await expect(
    pageA.locator('[data-testid="event-entry"]').filter({ hasText: /cancelled their trade offer/ })
  ).toBeVisible()
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
  // The badge disappears after the cancel.
  await expect(pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })).not.toContainText('1')
})

test('a trade offered to a bot is auto-accepted when the value is fair', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  await page.goto(serverUrlTrades)
  await page.fill('input[placeholder="Name"]', 'Alpha')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()

  await seedGame(serverUrlTrades, code, tradeBotSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha offers TLV Airport (5, $200) for Tel Aviv (6, $100): 200 >= 100, bot accepts.
  await openTradeModal(page, 'Droid')
  await page.getByLabel('TLV Airport').check()
  await page.getByLabel('Tel Aviv').check()
  await page.getByRole('button', { name: 'Propose' }).click()

  await expect(
    page.locator('[data-testid="event-entry"]').filter({ hasText: /completed a trade/ })
  ).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="board-cell-5"] div.absolute')).toHaveCSS('background-color', DROID_STRIPE)
  await expect(page.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)

  // The bot resolved instantly — no pending offer ever existed.
  await page.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ }).click()
  await expect(page.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
})

test('request cash is capped at the target\'s available cash', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeCashSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Bravo has only $50, so typing $100 clamps to the max instead of proposing an impossible offer.
  await openTradeModal(pageA, 'Bravo')
  const requestInput = pageA.locator('input[type="number"]').nth(1)
  await requestInput.fill('100')
  await expect(requestInput).toHaveValue('50')

  await pageA.getByLabel('Salvador').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()

  // The offer lands with the capped amount.
  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await expect(pageB.getByText(/You receive: Salvador \+ \$0/)).toBeVisible({ timeout: 5000 })
  await expect(pageB.getByText(/You give:.*\$50/)).toBeVisible()
  await pageB.getByRole('button', { name: 'Accept' }).click()

  // Alpha 1200+50=1250 ($1.3K with compact rounding), Bravo 50−50=0.
  await expect(pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Alpha' })).toContainText('$1.3K')
  await expect(pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText('$0')
  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
})

test('Propose is disabled until the trade has at least one item', async ({ browser, serverUrlTrades }) => {
  const page = await makePage(browser)
  await page.goto(serverUrlTrades)
  await page.fill('input[placeholder="Name"]', 'Alpha')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()
  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()

  await seedGame(serverUrlTrades, code, tradeBotSeed)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(page, 'Droid')
  const proposeBtn = page.getByRole('button', { name: 'Propose' })
  await expect(proposeBtn).toBeDisabled()

  // Adding one item enables it; clearing it disables again.
  await page.getByLabel('Salvador').check()
  await expect(proposeBtn).toBeEnabled()
  await page.getByLabel('Salvador').uncheck()
  await expect(proposeBtn).toBeDisabled()
})

test('stale offer auto-rejects when the target can no longer afford the requested cash', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Alpha proposes offering Salvador for $100 — valid while Bravo holds $1200.
  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Salvador').check()
  await pageA.locator('input[type="number"]').nth(1).fill('100')
  await pageA.getByRole('button', { name: 'Propose' }).click()
  await expect(
    pageA.locator('[data-testid="event-entry"]').filter({ hasText: /proposed a trade to Bravo/ })
  ).toBeVisible({ timeout: 5000 })

  // Re-seed mid-game: Bravo's cash drops to $50 while the pending offer survives.
  const stale = structuredClone(tradeSeed)
  stale.players[1].money = 50
  stale.pendingTrades = [{ id: 0, fromId: 0, toId: 1, offerProperties: [1], offerCash: 0, requestProperties: [], requestCash: 100 }]
  stale.nextTradeId = 1
  await seedGame(serverUrlTrades, code, stale)

  // Bravo accepts the now-unaffordable offer.
  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await expect(pageB.getByText(/You give:.*\$100/)).toBeVisible({ timeout: 5000 })
  await pageB.getByRole('button', { name: 'Accept' }).click()

  // No trade happens, the offer is gone, and a rejection is logged.
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  await expect(
    pageB.locator('[data-testid="event-entry"]').filter({ hasText: /declined Alpha's trade offer/ })
  ).toBeVisible()
  await expect(pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' })).toContainText('$50')
  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})

test('stale offer auto-rejects when the offered property changed hands after proposal', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await openTradeModal(pageA, 'Bravo')
  await pageA.getByLabel('Salvador').check()
  await pageA.getByRole('button', { name: 'Propose' }).click()
  await expect(
    pageA.locator('[data-testid="event-entry"]').filter({ hasText: /proposed a trade to Bravo/ })
  ).toBeVisible({ timeout: 5000 })

  // Re-seed mid-game: Salvador (1) is sold to the bank while the offer still lists it.
  const stale = structuredClone(tradeSeed)
  stale.board[1].owner = null
  stale.players[0].properties = [3, 5]
  stale.pendingTrades = [{ id: 0, fromId: 0, toId: 1, offerProperties: [1], offerCash: 0, requestProperties: [], requestCash: 0 }]
  stale.nextTradeId = 1
  await seedGame(serverUrlTrades, code, stale)

  const inboxBtn = pageB.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await pageB.getByRole('button', { name: 'Accept' }).click()

  // No trade: offer cleared, rejection logged, Salvador stays unowned (no stripe).
  await expect(pageB.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  await expect(
    pageB.locator('[data-testid="event-entry"]').filter({ hasText: /declined Alpha's trade offer/ })
  ).toBeVisible()
  await expect(pageA.locator('[data-testid="board-cell-1"] div.absolute')).toHaveCount(0)
})

test('off-turn player can propose a trade to another player', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const pageC = await makePage(browser)
  const code = await joinThree(pageA, pageB, pageC, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeThreeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  // Alpha is the current player; Bravo and Charlie are off-turn.

  // Bravo (off-turn) opens the trade modal targeting Charlie and proposes:
  // offers Tel Aviv (6) + $0, requests Haifa (8).
  await openTradeModal(pageB, 'Charlie')
  await pageB.getByLabel('Tel Aviv').check()
  await pageB.getByLabel('Haifa').check()
  await pageB.getByRole('button', { name: 'Propose' }).click()

  // Charlie (the off-turn recipient) sees viewer-relative labels.
  const inboxBtn = pageC.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await expect(pageC.getByText(/You receive: Tel Aviv/)).toBeVisible({ timeout: 5000 })
  await expect(pageC.getByText(/You give: Haifa/)).toBeVisible()
  await pageC.getByRole('button', { name: 'Accept' }).click()

  await expect(pageC.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  // Ownership swaps: Tel Aviv (6) -> Charlie, Haifa (8) -> Bravo.
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', CHARLIE_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-8"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
})

test('off-turn player can propose a trade to the current player (2-player)', async ({ browser, serverUrlTrades }) => {
  const pageA = await makePage(browser)
  const pageB = await makePage(browser)
  const code = await joinRoom(pageA, pageB, serverUrlTrades)

  await seedGame(serverUrlTrades, code, tradeSeed)
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  // Alpha is the current player; in a 2-player game Bravo's only partner is Alpha.

  // Bravo (off-turn) opens the trade modal targeting Alpha and proposes:
  // offers Tel Aviv (6) + $0, requests Rio (3).
  await openTradeModal(pageB, 'Alpha')
  await pageB.getByLabel('Tel Aviv').check()
  await pageB.getByLabel('Rio').check()
  await pageB.getByRole('button', { name: 'Propose' }).click()

  // Alpha (the recipient, currently on turn) sees viewer-relative labels.
  const inboxBtn = pageA.locator('[data-testid="sidebar"]').getByRole('button', { name: /Trades/ })
  await expect(inboxBtn).toContainText('1', { timeout: 5000 })
  await inboxBtn.click()
  await expect(pageA.getByText(/You receive: Tel Aviv/)).toBeVisible({ timeout: 5000 })
  await expect(pageA.getByText(/You give: Rio/)).toBeVisible()
  await pageA.getByRole('button', { name: 'Accept' }).click()

  await expect(pageA.getByText('No pending trade offers')).toBeVisible({ timeout: 5000 })
  // Ownership swaps: Rio -> Bravo, Tel Aviv -> Alpha.
  await expect(pageA.locator('[data-testid="board-cell-3"] div.absolute')).toHaveCSS('background-color', BRAVO_STRIPE)
  await expect(pageA.locator('[data-testid="board-cell-6"] div.absolute')).toHaveCSS('background-color', ALPHA_STRIPE)
})
