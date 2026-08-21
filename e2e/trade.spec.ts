import type { Browser, Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { tradeSeed } from './fixtures/trade-seed'
import { tradeBotSeed } from './fixtures/trade-bot-seed'

const ALPHA_STRIPE = 'rgb(231, 76, 60)'
const BRAVO_STRIPE = 'rgb(52, 152, 219)'
const DROID_STRIPE = 'rgb(52, 152, 219)'

async function makePage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  return context.newPage()
}

async function joinRoom(host: Page, guest: Page, serverUrl: string): Promise<string> {
  await host.goto(serverUrl)
  await host.fill('input[placeholder="Name"]', 'Alpha')
  await host.click('button:has-text("Continue")')
  const codeLocator = host.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await guest.goto(serverUrl)
  await guest.fill('input[placeholder="Name"]', 'Bravo')
  await guest.click('button:has-text("Join Room")')
  await guest.fill('input[placeholder="Code"]', code)
  await guest.click('button:has-text("Continue")')
  await expect(host.locator('text=Bravo')).toBeVisible({ timeout: 5000 })
  return code
}

async function openTradeModal(page: Page, targetCardText: string): Promise<void> {
  const card = page.locator('[data-testid="player-card"]').filter({ hasText: targetCardText })
  await card.hover()
  const tradeBtn = page.getByRole('button', { name: /^🤝 Trade$/ })
  await expect(tradeBtn).toBeVisible({ timeout: 5000 })
  await tradeBtn.hover()
  await tradeBtn.click()
  await expect(page.getByRole('heading', { name: /^🤝 Trade$/ })).toBeVisible({ timeout: 5000 })
}

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

  // Bravo cannot propose when it is not his turn — his card's Trade button is disabled.
  await pageB.locator('[data-testid="player-card"]').filter({ hasText: 'Bravo' }).hover()
  const bravoTradeBtn = pageB.getByRole('button', { name: /^🤝 Trade$/ })
  await expect(bravoTradeBtn).toBeVisible({ timeout: 5000 })
  await expect(bravoTradeBtn).toBeDisabled()

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
  await expect(pageB.getByText(/You offer: Rio \+ \$100/)).toBeVisible({ timeout: 5000 })
  await expect(pageB.getByText(/You request: Tel Aviv \+ \$0/)).toBeVisible()
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
  await expect(pageB.getByText(/You offer: Rio/)).toBeVisible({ timeout: 5000 })
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
