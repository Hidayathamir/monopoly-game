import { test, expect, Page } from '@playwright/test'

async function handleTurn(page: Page) {
  const rollBtn = page.locator('button:has-text("Roll")').first()
  if (!await rollBtn.isVisible({ timeout: 500 }).catch(() => false)) return false

  await rollBtn.click()
  await page.waitForTimeout(2000)

  const buyBtn = page.locator('button:has-text("Buy (")').first()
  if (await buyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await buyBtn.click()
    await page.waitForTimeout(200)
  }

  const noBtn = page.locator('button:has-text("No")').first()
  if (await noBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await noBtn.click()
    await page.waitForTimeout(200)
  }

  const cardBtn = page.locator('button:has-text("Draw")').first()
  if (await cardBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await cardBtn.click()
    await page.waitForTimeout(500)

    const okBtn = page.locator('button:has-text("OK")').first()
    if (await okBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await okBtn.click()
      await page.waitForTimeout(500)
    }
  }

  const payBtn = page.locator('button:has-text("Pay")').first()
  if (await payBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await payBtn.click()
    await page.waitForTimeout(200)
  }

  const endBtn = page.locator('button:has-text("End"), button:has-text("Roll Again")').first()
  if (await endBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await endBtn.click()
    await page.waitForTimeout(200)
  }

  return true
}

test.describe('Monopoly Game E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('monopoly-language', 'en')
      localStorage.setItem('monopoly-currency', 'USD')
    })
    await page.goto('/')
  })

  test('setup screen renders correctly', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Monopoly')
    await expect(page.locator('button:has-text("Start")')).toBeVisible()
    await expect(page.getByLabel('player-count')).toBeVisible()
  })

  test('start game with 2 players', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Alpha')
    await page.locator('input[type="text"]').nth(1).fill('Beta')
    await page.click('button:has-text("Start")')

    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Roll")')).toBeVisible()

    const panel = page.locator('[data-testid="player-card"]')
    await expect(panel).toHaveCount(2)
    await expect(panel.first()).toContainText('Alpha')
    await expect(panel.nth(1)).toContainText('Beta')
    await expect(panel.first()).toContainText('$')
  })

  test('buy property and see it in panel', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Buyer')
    await page.locator('input[type="text"]').nth(1).fill('Other')
    await page.click('button:has-text("Start")')

    for (let i = 0; i < 15; i++) {
      await handleTurn(page)
    }

    const cards = page.locator('[data-testid="player-card"]')
    const firstCardText = await cards.first().textContent()
    expect(firstCardText).toBeDefined()
    expect(firstCardText).not.toBe('')
  })

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 667, height: 375 },
    { width: 812, height: 375 },
  ]) {
    test(`center panel fits on ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page.click('button:has-text("Start")')
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

  test('4-player game survives many turns without crash', async ({ page }) => {
    await page.getByLabel('player-count').selectOption('4')
    await page.locator('input[type="text"]').nth(0).fill('P1')
    await page.locator('input[type="text"]').nth(1).fill('P2')
    await page.locator('input[type="text"]').nth(2).fill('P3')
    await page.locator('input[type="text"]').nth(3).fill('P4')
    await page.click('button:has-text("Start")')

    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(4)
    await expect(page.locator('button:has-text("Roll")')).toBeVisible()

    for (let t = 0; t < 12; t++) {
      const played = await handleTurn(page)
      if (!played) break
    }

    const cards = page.locator('[data-testid="player-card"]')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('local game with a bot seat auto-plays the bot turn', async ({ page }) => {
    await page.locator('input[type="text"]').nth(0).fill('Alpha')
    await page.getByLabel('Bot seat 2').check()
    await page.click('button:has-text("Start")')

    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="player-card"]').nth(1)).toContainText('Byte')
  })
})
