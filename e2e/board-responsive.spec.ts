import { test, expect } from './fixtures'
import type { Browser, Page } from '@playwright/test'
import { seedWaitingGame } from './helpers/seed'

async function seedGamePage(browser: Browser, serverUrl: string, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height } })
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()

  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()
  const code = (await codeLocator.innerText()).trim()

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
    ],
    currentPlayer: 0,
  })

  await expect(page.locator('[data-testid="board-cell-1"]')).toBeVisible({ timeout: 5000 })
  return page
}

function cellMetrics(page: Page) {
  return page.$$eval('[data-testid^="board-cell-"] .cell-name', (names) =>
    names.map((el) => {
      const name = el as HTMLElement
      const cell = name.closest('[data-testid^="board-cell-"]') as HTMLElement
      const style = getComputedStyle(name)
      return {
        text: name.textContent,
        fontSize: style.fontSize,
        writingMode: style.writingMode,
        hOverflow: name.scrollWidth > cell.clientWidth + 1,
        vOverflow: name.scrollHeight > cell.clientHeight + 1,
      }
    }),
  )
}

test('portrait: board city names rotate vertically and are never clipped', async ({ browser, serverUrl }) => {
  const page = await seedGamePage(browser, serverUrl, 390, 844)

  const results = await cellMetrics(page)

  expect(results.length).toBe(40)
  const clipped = results.filter((r) => r.hOverflow || r.vOverflow)
  expect(clipped).toEqual([])

  const rotated = results.filter((r) => r.writingMode === 'vertical-rl')
  expect(rotated.length).toBe(40)

  const sizes = results.map((r) => parseFloat(r.fontSize)).filter((n) => !Number.isNaN(n))
  expect(sizes.length).toBe(40)
  expect(Math.max(...sizes)).toBeLessThan(12)
})

test('landscape: board city names stay horizontal and are never clipped', async ({ browser, serverUrl }) => {
  const page = await seedGamePage(browser, serverUrl, 844, 390)

  const results = await cellMetrics(page)

  expect(results.length).toBe(40)
  const clipped = results.filter((r) => r.hOverflow || r.vOverflow)
  expect(clipped).toEqual([])

  const horizontal = results.filter((r) => r.writingMode === 'horizontal-tb')
  expect(horizontal.length).toBe(40)
})
