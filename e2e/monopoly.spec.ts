import { test, expect } from './fixtures'
import type { Browser, Page } from '@playwright/test'
import { playHostTurns } from './helpers/gameplay'
import { seedWaitingGame } from './helpers/seed'

async function newGamePage(browser: Browser, serverUrl: string): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()
  await page.goto(serverUrl)
  return page
}

async function createRoom(page: Page, name = 'Host'): Promise<void> {
  await page.fill('input[placeholder="Name"]', name)
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
}

async function startWithBots(page: Page, botCount: number): Promise<void> {
  for (let i = 0; i < botCount; i++) {
    await page.click('button:has-text("Add Bot")')
    await page.waitForTimeout(300)
  }
  await page.click(`button:has-text("Start (${botCount + 1}/6)")`)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
}

test.describe('Monopoly Game E2E', () => {
  test('setup screen renders the multiplayer form', async ({ browser, serverUrl }) => {
    const page = await newGamePage(browser, serverUrl)
    await expect(page.locator('h1')).toHaveText('Monopoly')
    await expect(page.locator('button:has-text("Create Room")')).toBeVisible()
    await expect(page.locator('button:has-text("Join Room")')).toBeVisible()
    await expect(page.locator('input[placeholder="Name"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Code"]')).toHaveCount(0)
  })

  test('start game with 2 players', async ({ browser, serverUrl }) => {
    const page = await newGamePage(browser, serverUrl)
    await createRoom(page, 'Alpha')
    await startWithBots(page, 1)
    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="player-card"]').first()).toContainText('$')
    const texts = await page.locator('[data-testid="player-card"]').allTextContents()
    expect(texts.some((t) => t.includes('Alpha'))).toBe(true)
  })

  test('gameplay survives turns', async ({ browser, serverUrl }) => {
    test.setTimeout(120000)
    const page = await newGamePage(browser, serverUrl)
    await createRoom(page, 'Buyer')
    await startWithBots(page, 1)
    await playHostTurns(page, 15)
    const firstCard = page.locator('[data-testid="player-card"]').first()
    await expect(firstCard).toContainText('$')
    const text = await firstCard.textContent()
    expect(text).toBeDefined()
    expect(text).not.toBe('')
  })

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 667, height: 375 },
    { width: 812, height: 375 },
  ]) {
    test(`center panel fits on ${viewport.width}x${viewport.height}`, async ({ browser, serverUrl }) => {
      const page = await newGamePage(browser, serverUrl)
      await page.setViewportSize(viewport)
      await createRoom(page)
      await page.click('button:has-text("Add Bot")')
      await expect(page.locator('text=Droid')).toBeVisible()
      const codeLocator = page.locator('[data-testid="room-code"]')
      const code = (await codeLocator.innerText()).trim()
      await seedWaitingGame(serverUrl, code, {
        players: [
          { id: 0, name: 'Host', money: 1500 },
          { id: 1, name: 'Droid', money: 1500, isBot: true },
        ],
        currentPlayer: 0,
      })
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
      const board = await page.locator('[data-game-board]').boundingBox()
      const sidebar = await page.locator('[data-testid="sidebar"]').boundingBox()
      expect(board).not.toBeNull()
      expect(sidebar).not.toBeNull()
      if (!board || !sidebar) return

      const innerW = (board.width * 9) / 11
      const innerH = (board.height * 9) / 11
      const innerLeft = board.x + board.width / 11
      const innerRight = board.x + (board.width * 10) / 11
      const innerTop = board.y + board.height / 11
      const innerBottom = board.y + (board.height * 10) / 11
      expect(sidebar.width).toBeLessThanOrEqual(innerW)
      expect(sidebar.height).toBeLessThanOrEqual(innerH)
      expect(sidebar.x).toBeGreaterThanOrEqual(innerLeft)
      expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(innerRight)
      expect(sidebar.y).toBeGreaterThanOrEqual(innerTop)
      expect(sidebar.y + sidebar.height).toBeLessThanOrEqual(innerBottom)
    })
  }

  test('4-player game survives many turns without crash', async ({ browser, serverUrl }) => {
    test.setTimeout(120000)
    const page = await newGamePage(browser, serverUrl)
    await createRoom(page, 'P1')
    await startWithBots(page, 3)
    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(4)
    await playHostTurns(page, 10)
    const count = await page.locator('[data-testid="player-card"]').count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
